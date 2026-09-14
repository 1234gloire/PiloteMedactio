import { and, asc, desc, eq } from "drizzle-orm";
import {
  auditLog,
  contacts,
  customerAlerts,
  customerOnboardingTasks,
  customerSuccessAutomations,
  internalUsers,
  organizations,
  subscriptions,
  supportTickets,
  usageLogs,
} from "../drizzle/schema";
import { requireDb } from "./db";
import {
  buildCustomerAlertCandidates,
  calculateCustomerHealth,
  calculateCustomerSuccessMetrics,
  daysBetween,
} from "./customer-success.logic";

export const ONBOARDING_ITEMS = [
  { itemKey: "Compte Cree" as const, sortOrder: 10 },
  { itemKey: "Formation Effectuee" as const, sortOrder: 20 },
  { itemKey: "Premiers Ecrits Generes" as const, sortOrder: 30 },
];

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

async function allCustomerData(referenceDate = new Date()) {
  const db = await requireDb();
  const [organizationRows, subscriptionRows, contactRows, usageRows, onboardingRows, ticketRows] = await Promise.all([
    db.select().from(organizations),
    db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt)),
    db.select().from(contacts),
    db.select().from(usageLogs),
    db.select().from(customerOnboardingTasks).orderBy(asc(customerOnboardingTasks.sortOrder)),
    db.select().from(supportTickets),
  ]);

  const today = dateOnly(referenceDate);
  const startLast30 = dateOnly(addDays(referenceDate, -29));
  const startPrevious30 = dateOnly(addDays(referenceDate, -59));
  const endPrevious30 = dateOnly(addDays(referenceDate, -30));

  return organizationRows
    .filter(org => org.status === "Client Actif" || subscriptionRows.some(subscription => subscription.organizationId === org.id))
    .map(org => {
      const organizationSubscriptions = subscriptionRows.filter(subscription => subscription.organizationId === org.id);
      const subscription = organizationSubscriptions.find(item => ["Actif", "Essai", "Suspendu"].includes(item.status)) || organizationSubscriptions[0] || null;
      const organizationContacts = contactRows.filter(contact => contact.organizationId === org.id);
      const organizationUsage = usageRows.filter(log => log.organizationId === org.id);
      const onboarding = onboardingRows.filter(task => task.organizationId === org.id);
      const tickets = ticketRows.filter(ticket => ticket.organizationId === org.id && ticket.status !== "Resolu");
      const activeSeats = organizationContacts.filter(contact => contact.isLicenseActive).length;
      const documentsLast30 = organizationUsage
        .filter(log => log.logDate >= startLast30 && log.logDate <= today)
        .reduce((sum, log) => sum + log.documentsGeneratedCount, 0);
      const documentsPrevious30 = organizationUsage
        .filter(log => log.logDate >= startPrevious30 && log.logDate <= endPrevious30)
        .reduce((sum, log) => sum + log.documentsGeneratedCount, 0);
      const onboardingProgress = onboarding.length
        ? Math.round((onboarding.filter(task => task.completed).length / onboarding.length) * 100)
        : org.onboardingStatus === "Termine" ? 100 : org.onboardingStatus === "En Cours" ? 33 : 0;
      const startDate = subscription?.startDate || org.contractStartDate || dateOnly(org.createdAt);
      const health = calculateCustomerHealth({
        seatsPurchased: subscription?.seatsPurchased || Math.max(activeSeats, 1),
        activeSeats,
        documentsLast30,
        documentsPrevious30,
        openTickets: tickets.length,
        urgentTickets: tickets.filter(ticket => ticket.priority === "Urgente").length,
        onboardingProgress,
        accountAgeDays: Math.max(daysBetween(startDate, today), 0),
      });
      return {
        organizationId: org.id,
        organizationName: org.name,
        organizationType: org.type,
        city: org.city,
        status: org.status,
        healthLabel: health.label,
        healthScore: health.score,
        healthReasons: health.reasons,
        usageRate: health.usageRate,
        usageTrend: health.usageTrend,
        seatActivationRate: health.seatActivationRate,
        onboardingProgress,
        onboardingCompleted: onboarding.filter(task => task.completed).length,
        onboardingTotal: onboarding.length || ONBOARDING_ITEMS.length,
        subscriptionId: subscription?.id || null,
        planName: subscription?.planName || null,
        subscriptionStatus: subscription?.status || null,
        billingCycle: subscription?.billingCycle || null,
        seatsPurchased: subscription?.seatsPurchased || 0,
        pricePerSeat: Number(subscription?.pricePerSeat || 0),
        startDate: subscription?.startDate || null,
        renewalDate: subscription?.renewalDate || org.contractEndDate || null,
        daysUntilRenewal: subscription?.renewalDate
          ? daysBetween(today, subscription.renewalDate)
          : org.contractEndDate ? daysBetween(today, org.contractEndDate) : null,
        cancelledAt: subscription?.cancelledAt || null,
        cancellationReason: subscription?.cancellationReason || null,
        activeSeats,
        contactsCount: organizationContacts.length,
        documentsLast30,
        documentsPrevious30,
        openTickets: tickets.length,
        urgentTickets: tickets.filter(ticket => ticket.priority === "Urgente").length,
      };
    });
}

export async function listCustomers(input?: {
  search?: string;
  health?: string;
  onboarding?: string;
  renewal?: string;
  status?: string;
}) {
  const customers = await allCustomerData();
  const term = input?.search?.trim().toLowerCase();
  return customers
    .filter(customer => {
      const matchesSearch = !term || [customer.organizationName, customer.city || "", customer.planName || ""]
        .some(value => value.toLowerCase().includes(term));
      const matchesHealth = !input?.health || input.health === "Tous" || customer.healthLabel === input.health;
      const matchesOnboarding = !input?.onboarding || input.onboarding === "Tous"
        || (input.onboarding === "Termine" ? customer.onboardingProgress === 100 : input.onboarding === "En Cours" ? customer.onboardingProgress > 0 && customer.onboardingProgress < 100 : customer.onboardingProgress === 0);
      const matchesRenewal = !input?.renewal || input.renewal === "Tous"
        || (customer.daysUntilRenewal !== null && customer.daysUntilRenewal >= 0 && customer.daysUntilRenewal <= Number(input.renewal));
      const matchesStatus = !input?.status || input.status === "Tous" || customer.subscriptionStatus === input.status;
      return matchesSearch && matchesHealth && matchesOnboarding && matchesRenewal && matchesStatus;
    })
    .sort((a, b) => a.healthScore - b.healthScore || (a.daysUntilRenewal ?? 9999) - (b.daysUntilRenewal ?? 9999));
}

export async function getCustomerDashboard() {
  const db = await requireDb();
  const customers = await allCustomerData();
  const metrics = calculateCustomerSuccessMetrics(customers);
  const alerts = await db
    .select({
      id: customerAlerts.id,
      organizationId: customerAlerts.organizationId,
      organizationName: organizations.name,
      subscriptionId: customerAlerts.subscriptionId,
      type: customerAlerts.type,
      severity: customerAlerts.severity,
      title: customerAlerts.title,
      message: customerAlerts.message,
      dueDate: customerAlerts.dueDate,
      status: customerAlerts.status,
      createdAt: customerAlerts.createdAt,
    })
    .from(customerAlerts)
    .leftJoin(organizations, eq(customerAlerts.organizationId, organizations.id))
    .where(eq(customerAlerts.status, "Ouverte"))
    .orderBy(desc(customerAlerts.severity), asc(customerAlerts.dueDate));
  return {
    ...metrics,
    alerts,
    customersAtRisk: customers
      .filter(customer => ["Actif", "Essai"].includes(customer.subscriptionStatus || "") && customer.healthLabel !== "Bon")
      .slice(0, 6),
    renewals: customers
      .filter(customer => customer.daysUntilRenewal !== null && customer.daysUntilRenewal >= 0 && customer.daysUntilRenewal <= 90)
      .sort((a, b) => (a.daysUntilRenewal || 0) - (b.daysUntilRenewal || 0)),
    adoption: customers
      .filter(customer => customer.subscriptionStatus === "Actif")
      .sort((a, b) => a.seatActivationRate - b.seatActivationRate),
  };
}

export async function getCustomer(organizationId: number) {
  const db = await requireDb();
  const summary = (await allCustomerData()).find(customer => customer.organizationId === organizationId);
  if (!summary) return null;
  const [organization, organizationSubscriptions, organizationContacts, onboarding, alerts, tickets, usage] = await Promise.all([
    db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1),
    db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)).orderBy(desc(subscriptions.createdAt)),
    db.select().from(contacts).where(eq(contacts.organizationId, organizationId)).orderBy(asc(contacts.fullName)),
    db.select({
      id: customerOnboardingTasks.id,
      itemKey: customerOnboardingTasks.itemKey,
      completed: customerOnboardingTasks.completed,
      completedAt: customerOnboardingTasks.completedAt,
      completedBy: customerOnboardingTasks.completedBy,
      completedByName: internalUsers.fullName,
      note: customerOnboardingTasks.note,
      sortOrder: customerOnboardingTasks.sortOrder,
    }).from(customerOnboardingTasks)
      .leftJoin(internalUsers, eq(customerOnboardingTasks.completedBy, internalUsers.id))
      .where(eq(customerOnboardingTasks.organizationId, organizationId))
      .orderBy(asc(customerOnboardingTasks.sortOrder)),
    db.select().from(customerAlerts).where(and(eq(customerAlerts.organizationId, organizationId), eq(customerAlerts.status, "Ouverte"))).orderBy(desc(customerAlerts.createdAt)),
    db.select().from(supportTickets).where(eq(supportTickets.organizationId, organizationId)).orderBy(desc(supportTickets.createdAt)),
    db.select().from(usageLogs).where(eq(usageLogs.organizationId, organizationId)).orderBy(asc(usageLogs.logDate)),
  ]);
  const today = new Date();
  const last30Start = dateOnly(addDays(today, -29));
  const contactUsage = organizationContacts.map(contact => {
    const logs = usage.filter(log => log.contactId === contact.id);
    return {
      ...contact,
      documentsLast30: logs.filter(log => log.logDate >= last30Start).reduce((sum, log) => sum + log.documentsGeneratedCount, 0),
      documentsAllTime: logs.reduce((sum, log) => sum + log.documentsGeneratedCount, 0),
      aiRequestsLast30: logs.filter(log => log.logDate >= last30Start).reduce((sum, log) => sum + log.aiRequestsCount, 0),
      aiRequestsAllTime: logs.reduce((sum, log) => sum + log.aiRequestsCount, 0),
      lastUsageDate: logs.length ? logs[logs.length - 1]?.logDate || null : null,
    };
  });
  const monthlyUsage = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (5 - index), 1));
    const month = date.toISOString().slice(0, 7);
    return {
      month,
      label: new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date),
      documents: usage.filter(log => log.logDate.startsWith(month)).reduce((sum, log) => sum + log.documentsGeneratedCount, 0),
      aiRequests: usage.filter(log => log.logDate.startsWith(month)).reduce((sum, log) => sum + log.aiRequestsCount, 0),
    };
  });
  return {
    organization: organization[0],
    summary,
    subscriptions: organizationSubscriptions,
    contacts: contactUsage,
    onboarding,
    alerts,
    tickets,
    monthlyUsage,
  };
}

export async function ensureOnboardingTasks(organizationId: number) {
  const db = await requireDb();
  const existing = await db.select().from(customerOnboardingTasks).where(eq(customerOnboardingTasks.organizationId, organizationId));
  const existingKeys = new Set(existing.map(task => task.itemKey));
  const missing = ONBOARDING_ITEMS.filter(item => !existingKeys.has(item.itemKey));
  if (missing.length) {
    await db.insert(customerOnboardingTasks).values(missing.map(item => ({ organizationId, ...item })));
  }
  return { created: missing.length };
}

export async function ensureAllCustomerOnboardingTasks() {
  const db = await requireDb();
  const customerOrganizations = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.status, "Client Actif"));
  let created = 0;
  for (const organization of customerOrganizations) {
    created += (await ensureOnboardingTasks(organization.id)).created;
  }
  return { created };
}

export async function toggleOnboardingTask(id: number, completed: boolean, completedBy: number | null) {
  const db = await requireDb();
  await db.update(customerOnboardingTasks).set({
    completed,
    completedAt: completed ? new Date() : null,
    completedBy: completed ? completedBy : null,
  }).where(eq(customerOnboardingTasks.id, id));
  const task = (await db.select().from(customerOnboardingTasks).where(eq(customerOnboardingTasks.id, id)).limit(1))[0];
  if (task) {
    const allTasks = await db.select().from(customerOnboardingTasks).where(eq(customerOnboardingTasks.organizationId, task.organizationId));
    const completeCount = allTasks.filter(item => item.completed).length;
    const onboardingStatus = completeCount === allTasks.length ? "Termine" : completeCount > 0 ? "En Cours" : "Non Demarre";
    await db.update(organizations).set({ onboardingStatus }).where(eq(organizations.id, task.organizationId));
  }
  return { success: true } as const;
}

export async function createSubscription(data: typeof subscriptions.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(subscriptions).values(data);
  const id = Number(result[0].insertId);
  await ensureOnboardingTasks(data.organizationId);
  await db.update(organizations).set({ status: "Client Actif" }).where(eq(organizations.id, data.organizationId));
  return { id };
}

async function auditSubscription(action: string, subscriptionId: number, userId?: number | null) {
  const db = await requireDb();
  await db.insert(auditLog).values({ userId: userId ?? null, action, targetTable: "subscriptions", targetId: subscriptionId });
}

export async function createAuditedSubscription(data: typeof subscriptions.$inferInsert, userId?: number | null) {
  const created = await createSubscription(data);
  await auditSubscription("CREATE", created.id, userId);
  return created;
}

export async function updateSubscription(id: number, data: Partial<typeof subscriptions.$inferInsert>, userId?: number | null) {
  const db = await requireDb();
  await db.update(subscriptions).set(data).where(eq(subscriptions.id, id));
  await auditSubscription("UPDATE", id, userId);
  return { success: true } as const;
}

export async function cancelSubscription(id: number, reason: string, cancelledAt: string, userId?: number | null) {
  const db = await requireDb();
  const subscription = (await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1))[0];
  if (!subscription) throw new Error("Abonnement introuvable");
  await db.update(subscriptions).set({ status: "Resilie", cancellationReason: reason, cancelledAt }).where(eq(subscriptions.id, id));
  await db.update(organizations).set({ status: "Inactif", healthScore: "A Risque" }).where(eq(organizations.id, subscription.organizationId));
  await auditSubscription("CANCEL", id, userId);
  return { success: true } as const;
}

export async function deleteSubscription(id: number, userId?: number | null) {
  const db = await requireDb();
  await auditSubscription("DELETE", id, userId);
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
  return { success: true } as const;
}

export async function setLicenseStatus(contactId: number, active: boolean) {
  const db = await requireDb();
  await db.update(contacts).set({
    isLicenseActive: active,
    licenseActivatedAt: active ? dateOnly(new Date()) : null,
  }).where(eq(contacts.id, contactId));
  return { success: true } as const;
}

export async function addUsage(data: typeof usageLogs.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(usageLogs).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateAlert(id: number, status: "Ouverte" | "Resolue" | "Ignoree") {
  const db = await requireDb();
  await db.update(customerAlerts).set({ status, resolvedAt: status === "Ouverte" ? null : new Date() }).where(eq(customerAlerts.id, id));
  return { success: true } as const;
}

export async function refreshCustomerAlerts(referenceDate = new Date()) {
  const db = await requireDb();
  await ensureAllCustomerOnboardingTasks();
  const customers = await allCustomerData(referenceDate);
  const existingAlerts = await db.select().from(customerAlerts);
  const ignoredKeys = new Set(
    existingAlerts.filter(alert => alert.status === "Ignoree").map(alert => alert.dedupeKey)
  );
  await db.update(customerAlerts).set({ status: "Resolue", resolvedAt: referenceDate }).where(eq(customerAlerts.status, "Ouverte"));
  let createdOrReopened = 0;
  for (const customer of customers.filter(item => item.subscriptionStatus === "Actif" || item.subscriptionStatus === "Essai")) {
    await db.update(organizations).set({ healthScore: customer.healthLabel }).where(eq(organizations.id, customer.organizationId));
    const candidates = buildCustomerAlertCandidates(customer);
    for (const candidate of candidates) {
      if (ignoredKeys.has(candidate.dedupeKey)) continue;
      await db.insert(customerAlerts).values(candidate).onDuplicateKeyUpdate({
        set: {
          subscriptionId: candidate.subscriptionId,
          severity: candidate.severity,
          title: candidate.title,
          message: candidate.message,
          dueDate: candidate.dueDate,
          status: "Ouverte",
          resolvedAt: null,
        },
      });
      createdOrReopened += 1;
    }
  }
  await db.insert(customerSuccessAutomations).values({
    name: "daily-customer-success-alerts",
    enabled: false,
    lastRunAt: referenceDate,
  }).onDuplicateKeyUpdate({ set: { lastRunAt: referenceDate } });
  return { processedCustomers: customers.length, alerts: createdOrReopened, ranAt: referenceDate };
}

export async function getAutomationByTaskUid(taskUid: string) {
  const db = await requireDb();
  return (await db.select().from(customerSuccessAutomations).where(eq(customerSuccessAutomations.scheduleCronTaskUid, taskUid)).limit(1))[0] || null;
}

export async function updateAutomationTaskUid(taskUid: string | null, enabled = true) {
  const db = await requireDb();
  await db.insert(customerSuccessAutomations).values({
    name: "daily-customer-success-alerts",
    scheduleCronTaskUid: taskUid,
    enabled,
  }).onDuplicateKeyUpdate({ set: { scheduleCronTaskUid: taskUid, enabled } });
  return { success: true } as const;
}

export async function getCustomerAutomation() {
  const db = await requireDb();
  return (await db.select().from(customerSuccessAutomations).where(eq(customerSuccessAutomations.name, "daily-customer-success-alerts")).limit(1))[0] || null;
}
