import { and, asc, desc, eq } from "drizzle-orm";
import {
  adminTasks,
  auditLog,
  calendarEvents,
  contacts,
  establishmentContracts,
  internalUsers,
  invoices,
  organizations,
  subscriptions,
  supportAlerts,
  supportAutomations,
  supportTicketEvents,
  supportTickets,
} from "../drizzle/schema";
import { requireDb } from "./db";
import { storagePut, storageUrlFor } from "./storage";
import {
  buildSupportAlertCandidates,
  calculateSupportMetrics,
  computeSlaDueAt,
  daysUntil,
  ticketSlaState,
  type SupportPriority,
} from "./support.logic";

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

async function audit(action: string, targetTable: string, targetId: number, userId?: number | null) {
  const db = await requireDb();
  await db.insert(auditLog).values({ userId: userId ?? null, action, targetTable, targetId });
}

export async function getSupportDashboard() {
  const db = await requireDb();
  const [ticketRows, taskRows, invoiceRows, contractRows, eventRows, alertRows] = await Promise.all([
    db.select().from(supportTickets),
    db.select().from(adminTasks),
    db.select().from(invoices),
    db.select().from(establishmentContracts),
    db.select().from(calendarEvents),
    db.select().from(supportAlerts).where(eq(supportAlerts.status, "Ouverte")).orderBy(asc(supportAlerts.dueAt)),
  ]);
  const metrics = calculateSupportMetrics({ tickets: ticketRows, tasks: taskRows, invoices: invoiceRows, contracts: contractRows, events: eventRows });
  const tickets = await listTickets();
  const tasks = await listTasks();
  const invoiceList = await listInvoices();
  const events = await listEvents();
  return {
    ...metrics,
    alerts: alertRows,
    priorityTickets: tickets.filter(ticket => ticket.status !== "Resolu").sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.remainingHours - b.remainingHours).slice(0, 6),
    dueTasks: tasks.filter(task => task.status !== "Fait" && task.daysUntilDue !== null && task.daysUntilDue <= 3).slice(0, 6),
    unpaidInvoices: invoiceList.filter(invoice => invoice.status === "En Retard" || (invoice.status === "Envoyee" && invoice.daysUntilDue !== null && invoice.daysUntilDue < 0)).slice(0, 6),
    upcomingEvents: events.filter(event => event.startAt >= new Date()).slice(0, 6),
  };
}

export async function listTickets(input?: { search?: string; status?: string; priority?: string; assignedTo?: number }) {
  const db = await requireDb();
  const rows = await db.select({
    id: supportTickets.id,
    organizationId: supportTickets.organizationId,
    organizationName: organizations.name,
    contactId: supportTickets.contactId,
    contactName: contacts.fullName,
    title: supportTickets.title,
    description: supportTickets.description,
    category: supportTickets.category,
    source: supportTickets.source,
    priority: supportTickets.priority,
    status: supportTickets.status,
    assignedTo: supportTickets.assignedTo,
    assignedToName: internalUsers.fullName,
    slaDueAt: supportTickets.slaDueAt,
    firstRespondedAt: supportTickets.firstRespondedAt,
    resolvedAt: supportTickets.resolvedAt,
    createdAt: supportTickets.createdAt,
    updatedAt: supportTickets.updatedAt,
  }).from(supportTickets)
    .leftJoin(organizations, eq(supportTickets.organizationId, organizations.id))
    .leftJoin(contacts, eq(supportTickets.contactId, contacts.id))
    .leftJoin(internalUsers, eq(supportTickets.assignedTo, internalUsers.id))
    .orderBy(desc(supportTickets.createdAt));
  const term = input?.search?.trim().toLowerCase();
  return rows.map(row => ({ ...row, ...ticketSlaState(row) })).filter(row => {
    const matchesSearch = !term || [row.title, row.organizationName || "", row.contactName || "", row.category].some(value => value.toLowerCase().includes(term));
    const matchesStatus = !input?.status || input.status === "Tous" || row.status === input.status;
    const matchesPriority = !input?.priority || input.priority === "Toutes" || row.priority === input.priority;
    const matchesAssignee = !input?.assignedTo || row.assignedTo === input.assignedTo;
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
  });
}

export async function getTicket(id: number) {
  const db = await requireDb();
  const ticket = (await listTickets()).find(row => row.id === id);
  if (!ticket) return null;
  const events = await db.select({
    id: supportTicketEvents.id,
    eventType: supportTicketEvents.eventType,
    content: supportTicketEvents.content,
    authorId: supportTicketEvents.authorId,
    authorName: internalUsers.fullName,
    createdAt: supportTicketEvents.createdAt,
  }).from(supportTicketEvents)
    .leftJoin(internalUsers, eq(supportTicketEvents.authorId, internalUsers.id))
    .where(eq(supportTicketEvents.ticketId, id))
    .orderBy(desc(supportTicketEvents.createdAt));
  return { ticket, events };
}

export async function createTicket(data: Omit<typeof supportTickets.$inferInsert, "slaDueAt">, authorId?: number | null) {
  const db = await requireDb();
  const createdAt = data.createdAt || new Date();
  const result = await db.insert(supportTickets).values({
    ...data,
    createdAt,
    slaDueAt: computeSlaDueAt(createdAt, data.priority as SupportPriority),
  }).returning({ id: supportTickets.id });
  const id = result[0].id;
  await db.insert(supportTicketEvents).values({ ticketId: id, authorId: authorId ?? null, eventType: "Changement Statut", content: "Ticket créé avec le statut Nouveau." });
  return { id };
}

export async function updateTicket(id: number, data: Partial<typeof supportTickets.$inferInsert>, authorId?: number | null) {
  const db = await requireDb();
  const current = (await db.select().from(supportTickets).where(eq(supportTickets.id, id)).limit(1))[0];
  if (!current) throw new Error("Ticket introuvable");
  const now = new Date();
  const update: Partial<typeof supportTickets.$inferInsert> = { ...data };
  if (data.priority && data.priority !== current.priority) update.slaDueAt = computeSlaDueAt(current.createdAt, data.priority as SupportPriority);
  if (data.status && data.status !== "Nouveau" && !current.firstRespondedAt) update.firstRespondedAt = now;
  if (data.status === "Resolu") update.resolvedAt = now;
  if (data.status && data.status !== "Resolu" && current.status === "Resolu") update.resolvedAt = null;
  await db.update(supportTickets).set(update).where(eq(supportTickets.id, id));
  if (data.status && data.status !== current.status) {
    await db.insert(supportTicketEvents).values({ ticketId: id, authorId: authorId ?? null, eventType: "Changement Statut", content: `Statut modifié : ${current.status} → ${data.status}.` });
  }
  return { success: true } as const;
}

export async function deleteTicket(id: number) {
  const db = await requireDb();
  await db.delete(supportTickets).where(eq(supportTickets.id, id));
  return { success: true } as const;
}

export async function addTicketEvent(data: typeof supportTicketEvents.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(supportTicketEvents).values(data).returning({ id: supportTicketEvents.id });
  const ticket = (await db.select().from(supportTickets).where(eq(supportTickets.id, data.ticketId)).limit(1))[0];
  if (ticket && !ticket.firstRespondedAt) {
    await db.update(supportTickets).set({ firstRespondedAt: new Date(), status: ticket.status === "Nouveau" ? "En cours" : ticket.status }).where(eq(supportTickets.id, data.ticketId));
  }
  return { id: result[0].id };
}

export async function listTasks(input?: { search?: string; status?: string; assignedTo?: number }) {
  const db = await requireDb();
  const rows = await db.select({
    id: adminTasks.id,
    title: adminTasks.title,
    description: adminTasks.description,
    organizationId: adminTasks.organizationId,
    organizationName: organizations.name,
    assignedTo: adminTasks.assignedTo,
    assignedToName: internalUsers.fullName,
    dueDate: adminTasks.dueDate,
    priority: adminTasks.priority,
    status: adminTasks.status,
    completedAt: adminTasks.completedAt,
    createdAt: adminTasks.createdAt,
    updatedAt: adminTasks.updatedAt,
  }).from(adminTasks)
    .leftJoin(organizations, eq(adminTasks.organizationId, organizations.id))
    .leftJoin(internalUsers, eq(adminTasks.assignedTo, internalUsers.id))
    .orderBy(asc(adminTasks.dueDate), desc(adminTasks.createdAt));
  const term = input?.search?.trim().toLowerCase();
  return rows.map(row => ({ ...row, daysUntilDue: daysUntil(row.dueDate) })).filter(row =>
    (!term || [row.title, row.description || "", row.organizationName || ""].some(value => value.toLowerCase().includes(term)))
    && (!input?.status || input.status === "Tous" || row.status === input.status)
    && (!input?.assignedTo || row.assignedTo === input.assignedTo)
  );
}

export async function createTask(data: typeof adminTasks.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(adminTasks).values(data).returning({ id: adminTasks.id });
  return { id: result[0].id };
}

export async function updateTask(id: number, data: Partial<typeof adminTasks.$inferInsert>) {
  const db = await requireDb();
  const update = { ...data, ...(data.status === "Fait" ? { completedAt: new Date() } : data.status ? { completedAt: null } : {}) };
  await db.update(adminTasks).set(update).where(eq(adminTasks.id, id));
  return { success: true } as const;
}

export async function deleteTask(id: number) {
  const db = await requireDb();
  await db.delete(adminTasks).where(eq(adminTasks.id, id));
  return { success: true } as const;
}

export async function listInvoices(input?: { search?: string; status?: string }) {
  const db = await requireDb();
  const rows = await db.select({
    id: invoices.id,
    organizationId: invoices.organizationId,
    organizationName: organizations.name,
    subscriptionId: invoices.subscriptionId,
    planName: subscriptions.planName,
    invoiceNumber: invoices.invoiceNumber,
    amount: invoices.amount,
    status: invoices.status,
    issuedAt: invoices.issuedAt,
    dueDate: invoices.dueDate,
    paidAt: invoices.paidAt,
    reminderCount: invoices.reminderCount,
    lastReminderAt: invoices.lastReminderAt,
    nextReminderDate: invoices.nextReminderDate,
    notes: invoices.notes,
    createdAt: invoices.createdAt,
    updatedAt: invoices.updatedAt,
  }).from(invoices)
    .leftJoin(organizations, eq(invoices.organizationId, organizations.id))
    .leftJoin(subscriptions, eq(invoices.subscriptionId, subscriptions.id))
    .orderBy(desc(invoices.createdAt));
  const term = input?.search?.trim().toLowerCase();
  return rows.map(row => ({ ...row, daysUntilDue: daysUntil(row.dueDate) })).filter(row =>
    (!term || [row.invoiceNumber, row.organizationName || ""].some(value => value.toLowerCase().includes(term)))
    && (!input?.status || input.status === "Tous" || row.status === input.status)
  );
}

export async function createInvoice(data: typeof invoices.$inferInsert, userId?: number | null) {
  const db = await requireDb();
  const result = await db.insert(invoices).values(data).returning({ id: invoices.id });
  const id = result[0].id;
  await audit("CREATE", "invoices", id, userId);
  return { id };
}

export async function updateInvoice(id: number, data: Partial<typeof invoices.$inferInsert>, userId?: number | null) {
  const db = await requireDb();
  await db.update(invoices).set(data).where(eq(invoices.id, id));
  await audit("UPDATE", "invoices", id, userId);
  return { success: true } as const;
}

export async function remindInvoice(id: number, userId?: number | null) {
  const db = await requireDb();
  const invoice = (await db.select().from(invoices).where(eq(invoices.id, id)).limit(1))[0];
  if (!invoice) throw new Error("Facture introuvable");
  const now = new Date();
  const nextReminderDate = dateOnly(new Date(now.getTime() + 7 * 86_400_000));
  await db.update(invoices).set({
    reminderCount: invoice.reminderCount + 1,
    lastReminderAt: now,
    nextReminderDate,
    status: invoice.status === "Envoyee" && Number(daysUntil(invoice.dueDate, now)) < 0 ? "En Retard" : invoice.status,
  }).where(eq(invoices.id, id));
  await audit("REMINDER", "invoices", id, userId);
  return { success: true, nextReminderDate } as const;
}

export async function deleteInvoice(id: number, userId?: number | null) {
  const db = await requireDb();
  await audit("DELETE", "invoices", id, userId);
  await db.delete(invoices).where(eq(invoices.id, id));
  return { success: true } as const;
}

export async function listContracts(input?: { search?: string; status?: string; type?: string }) {
  const db = await requireDb();
  const rows = await db.select({
    id: establishmentContracts.id,
    organizationId: establishmentContracts.organizationId,
    organizationName: organizations.name,
    title: establishmentContracts.title,
    type: establishmentContracts.type,
    status: establishmentContracts.status,
    startDate: establishmentContracts.startDate,
    endDate: establishmentContracts.endDate,
    signedAt: establishmentContracts.signedAt,
    documentKey: establishmentContracts.documentKey,
    documentUrl: establishmentContracts.documentUrl,
    documentName: establishmentContracts.documentName,
    documentMimeType: establishmentContracts.documentMimeType,
    notes: establishmentContracts.notes,
    createdAt: establishmentContracts.createdAt,
    updatedAt: establishmentContracts.updatedAt,
  }).from(establishmentContracts)
    .leftJoin(organizations, eq(establishmentContracts.organizationId, organizations.id))
    .orderBy(asc(establishmentContracts.endDate), desc(establishmentContracts.createdAt));
  const term = input?.search?.trim().toLowerCase();
  const filtered = rows.map(row => ({ ...row, daysUntilEnd: daysUntil(row.endDate) })).filter(row =>
    (!term || [row.title, row.organizationName || ""].some(value => value.toLowerCase().includes(term)))
    && (!input?.status || input.status === "Tous" || row.status === input.status)
    && (!input?.type || input.type === "Tous" || row.type === input.type)
  );
  // Voir `listAssets` : le lien vers le document est signé à chaque lecture.
  return Promise.all(
    filtered.map(async row => ({ ...row, documentUrl: (await storageUrlFor(row.documentKey)) ?? row.documentUrl }))
  );
}

export async function createContract(data: typeof establishmentContracts.$inferInsert, userId?: number | null) {
  const db = await requireDb();
  const result = await db.insert(establishmentContracts).values(data).returning({ id: establishmentContracts.id });
  const id = result[0].id;
  await audit("CREATE", "establishment_contracts", id, userId);
  return { id };
}

export async function updateContract(id: number, data: Partial<typeof establishmentContracts.$inferInsert>, userId?: number | null) {
  const db = await requireDb();
  await db.update(establishmentContracts).set(data).where(eq(establishmentContracts.id, id));
  await audit("UPDATE", "establishment_contracts", id, userId);
  return { success: true } as const;
}

export async function uploadContractDocument(id: number, file: { fileName: string; mimeType: string; base64: string }, userId?: number | null) {
  const db = await requireDb();
  const content = file.base64.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(content, "base64");
  if (bytes.length > 10 * 1024 * 1024) throw new Error("Le document dépasse la limite de 10 Mo.");
  const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const uploaded = await storagePut(`support/contracts/${id}/${safeName}`, bytes, file.mimeType || "application/octet-stream");
  await db.update(establishmentContracts).set({ documentKey: uploaded.key, documentUrl: uploaded.url, documentName: file.fileName, documentMimeType: file.mimeType }).where(eq(establishmentContracts.id, id));
  await audit("UPLOAD_DOCUMENT", "establishment_contracts", id, userId);
  return uploaded;
}

export async function deleteContract(id: number, userId?: number | null) {
  const db = await requireDb();
  await audit("DELETE", "establishment_contracts", id, userId);
  await db.delete(establishmentContracts).where(eq(establishmentContracts.id, id));
  return { success: true } as const;
}

export async function listEvents(input?: { from?: Date; to?: Date; type?: string }) {
  const db = await requireDb();
  const rows = await db.select({
    id: calendarEvents.id,
    title: calendarEvents.title,
    description: calendarEvents.description,
    eventType: calendarEvents.eventType,
    organizationId: calendarEvents.organizationId,
    organizationName: organizations.name,
    contactId: calendarEvents.contactId,
    contactName: contacts.fullName,
    organizerId: calendarEvents.organizerId,
    organizerName: internalUsers.fullName,
    startAt: calendarEvents.startAt,
    endAt: calendarEvents.endAt,
    allDay: calendarEvents.allDay,
    location: calendarEvents.location,
    createdAt: calendarEvents.createdAt,
    updatedAt: calendarEvents.updatedAt,
  }).from(calendarEvents)
    .leftJoin(organizations, eq(calendarEvents.organizationId, organizations.id))
    .leftJoin(contacts, eq(calendarEvents.contactId, contacts.id))
    .leftJoin(internalUsers, eq(calendarEvents.organizerId, internalUsers.id))
    .orderBy(asc(calendarEvents.startAt));
  return rows.filter(row => (!input?.from || row.startAt >= input.from) && (!input?.to || row.startAt <= input.to) && (!input?.type || input.type === "Tous" || row.eventType === input.type));
}

export async function createEvent(data: typeof calendarEvents.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(calendarEvents).values(data).returning({ id: calendarEvents.id });
  return { id: result[0].id };
}

export async function updateEvent(id: number, data: Partial<typeof calendarEvents.$inferInsert>) {
  const db = await requireDb();
  await db.update(calendarEvents).set(data).where(eq(calendarEvents.id, id));
  return { success: true } as const;
}

export async function deleteEvent(id: number) {
  const db = await requireDb();
  await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  return { success: true } as const;
}

export async function updateSupportAlert(id: number, status: "Ouverte" | "Resolue" | "Ignoree") {
  const db = await requireDb();
  await db.update(supportAlerts).set({ status, resolvedAt: status === "Ouverte" ? null : new Date() }).where(eq(supportAlerts.id, id));
  return { success: true } as const;
}

export async function refreshSupportAlerts(referenceDate = new Date()) {
  const db = await requireDb();
  const [ticketRows, taskRows, invoiceRows, contractRows, eventRows, existingAlerts] = await Promise.all([
    db.select().from(supportTickets),
    db.select().from(adminTasks),
    db.select().from(invoices),
    db.select().from(establishmentContracts),
    db.select().from(calendarEvents),
    db.select().from(supportAlerts),
  ]);
  const ignoredKeys = new Set(existingAlerts.filter(alert => alert.status === "Ignoree").map(alert => alert.dedupeKey));
  await db.update(supportAlerts).set({ status: "Resolue", resolvedAt: referenceDate }).where(eq(supportAlerts.status, "Ouverte"));
  const candidates = buildSupportAlertCandidates({ tickets: ticketRows, tasks: taskRows, invoices: invoiceRows, contracts: contractRows, events: eventRows, now: referenceDate });
  let active = 0;
  for (const candidate of candidates) {
    if (ignoredKeys.has(candidate.dedupeKey)) continue;
    await db.insert(supportAlerts).values(candidate).onConflictDoUpdate({ target: supportAlerts.dedupeKey, set: { severity: candidate.severity, title: candidate.title, message: candidate.message, dueAt: candidate.dueAt, link: candidate.link, status: "Ouverte", resolvedAt: null } });
    active += 1;
  }
  for (const invoice of invoiceRows.filter(item => item.status === "Envoyee" && Number(daysUntil(item.dueDate, referenceDate)) < 0)) {
    await db.update(invoices).set({ status: "En Retard" }).where(eq(invoices.id, invoice.id));
  }
  for (const contract of contractRows.filter(item => item.status === "Actif" && Number(daysUntil(item.endDate, referenceDate)) < 0)) {
    await db.update(establishmentContracts).set({ status: "Expire" }).where(eq(establishmentContracts.id, contract.id));
  }
  await db.insert(supportAutomations).values({ name: "daily-support-alerts", enabled: false, lastRunAt: referenceDate }).onConflictDoUpdate({ target: supportAutomations.name, set: { lastRunAt: referenceDate } });
  return { alerts: active, processed: ticketRows.length + taskRows.length + invoiceRows.length + contractRows.length + eventRows.length, ranAt: referenceDate };
}

export async function getSupportAutomation() {
  const db = await requireDb();
  return (await db.select().from(supportAutomations).where(eq(supportAutomations.name, "daily-support-alerts")).limit(1))[0] || null;
}

/** Voir `setCustomerAutomationEnabled` : la planification est portée par pg_cron. */
export async function setSupportAutomationEnabled(enabled: boolean) {
  const db = await requireDb();
  await db.insert(supportAutomations).values({ name: "daily-support-alerts", enabled }).onConflictDoUpdate({ target: supportAutomations.name, set: { enabled } });
  return { success: true } as const;
}
