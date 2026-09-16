import { and, asc, desc, eq, inArray } from "drizzle-orm";
import {
  auditLog,
  changelogEntries,
  employeeGoals,
  expenses,
  internalUsers,
  knowledgeBaseArticles,
  leaveRequests,
  legalDocuments,
  notifications,
  organizations,
  productRequests,
  suppliers,
  supportTickets,
} from "../drizzle/schema";
import { requireDb } from "./db";
import { storagePut, storageUrlFor } from "./storage";
import {
  buildDeadlineSchedule,
  businessDaysBetween,
  daysUntil,
  deadlineSeverity,
  excerpt,
  prioritizeRequests,
  searchArticles,
  summarizeLeave,
  summarizeRoadmap,
} from "./governance.logic";

async function audit(action: string, targetTable: string, targetId: number, userId?: number | null) {
  const db = await requireDb();
  await db.insert(auditLog).values({ userId: userId ?? null, action, targetTable, targetId });
}

/* ================================================================== */
/* JURIDIQUE & CONFORMITÉ                                              */
/* ================================================================== */

export async function listLegalDocuments(input?: { search?: string; type?: string; organizationId?: number }) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: legalDocuments.id,
      organizationId: legalDocuments.organizationId,
      organizationName: organizations.name,
      title: legalDocuments.title,
      type: legalDocuments.type,
      version: legalDocuments.version,
      effectiveDate: legalDocuments.effectiveDate,
      expiryDate: legalDocuments.expiryDate,
      documentKey: legalDocuments.documentKey,
      documentName: legalDocuments.documentName,
      notes: legalDocuments.notes,
      createdAt: legalDocuments.createdAt,
    })
    .from(legalDocuments)
    .leftJoin(organizations, eq(legalDocuments.organizationId, organizations.id))
    .orderBy(asc(legalDocuments.expiryDate), desc(legalDocuments.createdAt));

  const term = input?.search?.trim().toLowerCase();
  const filtered = rows.filter(
    row =>
      (!term || [row.title || "", row.type || "", row.organizationName || "", row.version || ""].some(value => value.toLowerCase().includes(term))) &&
      (!input?.type || input.type === "Tous" || row.type === input.type) &&
      (!input?.organizationId || row.organizationId === input.organizationId)
  );

  // Le lien de téléchargement est signé à la lecture, comme pour les contrats.
  return Promise.all(
    filtered.map(async row => {
      const days = daysUntil(row.expiryDate);
      return {
        ...row,
        daysUntilExpiry: days,
        severity: deadlineSeverity(days),
        documentUrl: await storageUrlFor(row.documentKey),
      };
    })
  );
}

export async function createLegalDocument(data: typeof legalDocuments.$inferInsert, userId?: number | null) {
  const db = await requireDb();
  const result = await db.insert(legalDocuments).values(data).returning({ id: legalDocuments.id });
  const id = result[0].id;
  await audit("legal_document.create", "legal_documents", id, userId);
  return { id };
}

export async function updateLegalDocument(
  id: number,
  data: Partial<typeof legalDocuments.$inferInsert>,
  userId?: number | null
) {
  const db = await requireDb();
  await db.update(legalDocuments).set(data).where(eq(legalDocuments.id, id));
  await audit("legal_document.update", "legal_documents", id, userId);
  return { success: true } as const;
}

export async function deleteLegalDocument(id: number, userId?: number | null) {
  const db = await requireDb();
  await db.delete(legalDocuments).where(eq(legalDocuments.id, id));
  await audit("legal_document.delete", "legal_documents", id, userId);
  return { success: true } as const;
}

export async function uploadLegalDocumentFile(
  id: number,
  file: { fileName: string; mimeType: string; base64: string },
  userId?: number | null
) {
  const db = await requireDb();
  const bytes = Buffer.from(file.base64.split(",").pop() || "", "base64");
  if (!bytes.length) throw new Error("Le fichier transmis est vide.");
  const safeName = file.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const uploaded = await storagePut(`juridique/${id}/${safeName}`, bytes, file.mimeType);
  await db
    .update(legalDocuments)
    .set({ documentKey: uploaded.key, documentName: file.fileName, fileUrl: uploaded.url })
    .where(eq(legalDocuments.id, id));
  await audit("legal_document.upload", "legal_documents", id, userId);
  return { success: true } as const;
}

/* ================================================================== */
/* FOURNISSEURS & PARTENAIRES                                          */
/* ================================================================== */

export async function listSuppliersDetailed(input?: { search?: string; category?: string }) {
  const db = await requireDb();
  const [supplierRows, expenseRows] = await Promise.all([
    db.select().from(suppliers).orderBy(asc(suppliers.contractRenewalDate), asc(suppliers.name)),
    db.select({ supplierId: expenses.supplierId, amount: expenses.amount, expenseDate: expenses.expenseDate, label: expenses.label }).from(expenses),
  ]);

  const term = input?.search?.trim().toLowerCase();
  return supplierRows
    .filter(
      row =>
        (!term || [row.name, row.contactName || "", row.contactEmail || ""].some(value => value.toLowerCase().includes(term))) &&
        (!input?.category || input.category === "Toutes" || row.category === input.category)
    )
    .map(supplier => {
      const related = expenseRows.filter(expense => expense.supplierId === supplier.id);
      const days = daysUntil(supplier.contractRenewalDate);
      return {
        ...supplier,
        daysUntilRenewal: days,
        severity: deadlineSeverity(days),
        expenseCount: related.length,
        spentTotal: related.reduce((sum, expense) => sum + Number(expense.amount), 0),
      };
    });
}

export async function getSupplier(id: number) {
  const db = await requireDb();
  const supplier = (await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1))[0];
  if (!supplier) return null;
  const history = await db
    .select()
    .from(expenses)
    .where(eq(expenses.supplierId, id))
    .orderBy(desc(expenses.expenseDate));
  const days = daysUntil(supplier.contractRenewalDate);
  return {
    supplier: { ...supplier, daysUntilRenewal: days, severity: deadlineSeverity(days) },
    expenses: history,
    spentTotal: history.reduce((sum, expense) => sum + Number(expense.amount), 0),
  };
}

export async function createSupplier(data: typeof suppliers.$inferInsert, userId?: number | null) {
  const db = await requireDb();
  const result = await db.insert(suppliers).values(data).returning({ id: suppliers.id });
  const id = result[0].id;
  await audit("supplier.create", "suppliers", id, userId);
  return { id };
}

export async function updateSupplier(id: number, data: Partial<typeof suppliers.$inferInsert>, userId?: number | null) {
  const db = await requireDb();
  await db.update(suppliers).set(data).where(eq(suppliers.id, id));
  await audit("supplier.update", "suppliers", id, userId);
  return { success: true } as const;
}

export async function deleteSupplier(id: number, userId?: number | null) {
  const db = await requireDb();
  await db.delete(suppliers).where(eq(suppliers.id, id));
  await audit("supplier.delete", "suppliers", id, userId);
  return { success: true } as const;
}

/** Échéancier consolidé des renouvellements et des documents juridiques. */
export async function getDeadlineSchedule() {
  const db = await requireDb();
  const [documents, supplierRows] = await Promise.all([
    db.select({ id: legalDocuments.id, title: legalDocuments.title, type: legalDocuments.type, expiryDate: legalDocuments.expiryDate }).from(legalDocuments),
    db.select({ id: suppliers.id, name: suppliers.name, contractRenewalDate: suppliers.contractRenewalDate }).from(suppliers),
  ]);
  return buildDeadlineSchedule(documents, supplierRows);
}

/* ================================================================== */
/* RH & ÉQUIPE INTERNE                                                 */
/* ================================================================== */

export async function listTeam() {
  const db = await requireDb();
  const [members, leaves, goals] = await Promise.all([
    db.select().from(internalUsers).orderBy(asc(internalUsers.fullName)),
    db.select().from(leaveRequests),
    db.select().from(employeeGoals),
  ]);

  return members.map(member => {
    const memberLeaves = leaves.filter(leave => leave.userId === member.id);
    const memberGoals = goals.filter(goal => goal.userId === member.id);
    return {
      ...member,
      leave: summarizeLeave(memberLeaves),
      pendingLeaveCount: memberLeaves.filter(leave => leave.status === "Demande").length,
      goalsTotal: memberGoals.length,
      goalsReached: memberGoals.filter(goal => goal.status === "Atteint").length,
    };
  });
}

export async function getTeamMember(id: number) {
  const db = await requireDb();
  const member = (await db.select().from(internalUsers).where(eq(internalUsers.id, id)).limit(1))[0];
  if (!member) return null;
  const [leaves, goals] = await Promise.all([
    db.select().from(leaveRequests).where(eq(leaveRequests.userId, id)).orderBy(desc(leaveRequests.startDate)),
    db.select().from(employeeGoals).where(eq(employeeGoals.userId, id)).orderBy(asc(employeeGoals.targetDate)),
  ]);
  return {
    member,
    leaves: leaves.map(leave => ({ ...leave, businessDays: businessDaysBetween(leave.startDate, leave.endDate) })),
    goals,
    summary: summarizeLeave(leaves),
  };
}

export async function listLeaveRequests(input?: { status?: string; userId?: number }) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: leaveRequests.id,
      userId: leaveRequests.userId,
      userName: internalUsers.fullName,
      type: leaveRequests.type,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      status: leaveRequests.status,
      validatedBy: leaveRequests.validatedBy,
      createdAt: leaveRequests.createdAt,
    })
    .from(leaveRequests)
    .leftJoin(internalUsers, eq(leaveRequests.userId, internalUsers.id))
    .orderBy(desc(leaveRequests.startDate));

  return rows
    .filter(
      row =>
        (!input?.status || input.status === "Tous" || row.status === input.status) &&
        (!input?.userId || row.userId === input.userId)
    )
    .map(row => ({ ...row, businessDays: businessDaysBetween(row.startDate, row.endDate) }));
}

export async function createLeaveRequest(data: typeof leaveRequests.$inferInsert, userId?: number | null) {
  const db = await requireDb();
  if (data.endDate < data.startDate) throw new Error("La date de fin doit suivre la date de début.");
  const result = await db.insert(leaveRequests).values(data).returning({ id: leaveRequests.id });
  const id = result[0].id;
  await audit("leave_request.create", "leave_requests", id, userId);
  return { id };
}

export async function decideLeaveRequest(
  id: number,
  status: "Valide" | "Refuse",
  validatorId: number
) {
  const db = await requireDb();
  await db.update(leaveRequests).set({ status, validatedBy: validatorId }).where(eq(leaveRequests.id, id));
  await audit(`leave_request.${status === "Valide" ? "approve" : "reject"}`, "leave_requests", id, validatorId);
  return { success: true } as const;
}

export async function deleteLeaveRequest(id: number, userId?: number | null) {
  const db = await requireDb();
  await db.delete(leaveRequests).where(eq(leaveRequests.id, id));
  await audit("leave_request.delete", "leave_requests", id, userId);
  return { success: true } as const;
}

export async function createGoal(data: typeof employeeGoals.$inferInsert, userId?: number | null) {
  const db = await requireDb();
  const result = await db.insert(employeeGoals).values(data).returning({ id: employeeGoals.id });
  const id = result[0].id;
  await audit("employee_goal.create", "employee_goals", id, userId);
  return { id };
}

export async function updateGoal(id: number, data: Partial<typeof employeeGoals.$inferInsert>, userId?: number | null) {
  const db = await requireDb();
  await db.update(employeeGoals).set(data).where(eq(employeeGoals.id, id));
  await audit("employee_goal.update", "employee_goals", id, userId);
  return { success: true } as const;
}

export async function deleteGoal(id: number, userId?: number | null) {
  const db = await requireDb();
  await db.delete(employeeGoals).where(eq(employeeGoals.id, id));
  await audit("employee_goal.delete", "employee_goals", id, userId);
  return { success: true } as const;
}

/* ================================================================== */
/* ROADMAP PRODUIT                                                     */
/* ================================================================== */

export async function listProductRequests(input?: { search?: string; status?: string; type?: string }) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: productRequests.id,
      sourceTicketId: productRequests.sourceTicketId,
      sourceTicketTitle: supportTickets.title,
      organizationId: productRequests.organizationId,
      organizationName: organizations.name,
      title: productRequests.title,
      description: productRequests.description,
      type: productRequests.type,
      priority: productRequests.priority,
      status: productRequests.status,
      createdAt: productRequests.createdAt,
    })
    .from(productRequests)
    .leftJoin(supportTickets, eq(productRequests.sourceTicketId, supportTickets.id))
    .leftJoin(organizations, eq(productRequests.organizationId, organizations.id))
    .orderBy(desc(productRequests.createdAt));

  const term = input?.search?.trim().toLowerCase();
  const filtered = rows.filter(
    row =>
      (!term || [row.title, row.description || "", row.organizationName || ""].some(value => value.toLowerCase().includes(term))) &&
      (!input?.status || input.status === "Tous" || row.status === input.status) &&
      (!input?.type || input.type === "Tous" || row.type === input.type)
  );
  return prioritizeRequests(filtered);
}

export async function getRoadmapSummary() {
  const db = await requireDb();
  const rows = await db.select({ status: productRequests.status, type: productRequests.type }).from(productRequests);
  return summarizeRoadmap(rows);
}

export async function createProductRequest(data: typeof productRequests.$inferInsert, userId?: number | null) {
  const db = await requireDb();
  const result = await db.insert(productRequests).values(data).returning({ id: productRequests.id });
  const id = result[0].id;
  await audit("product_request.create", "product_requests", id, userId);
  return { id };
}

export async function updateProductRequest(
  id: number,
  data: Partial<typeof productRequests.$inferInsert>,
  userId?: number | null
) {
  const db = await requireDb();
  await db.update(productRequests).set(data).where(eq(productRequests.id, id));
  await audit("product_request.update", "product_requests", id, userId);
  return { success: true } as const;
}

export async function deleteProductRequest(id: number, userId?: number | null) {
  const db = await requireDb();
  await db.delete(productRequests).where(eq(productRequests.id, id));
  await audit("product_request.delete", "product_requests", id, userId);
  return { success: true } as const;
}

export async function listChangelog() {
  const db = await requireDb();
  return db.select().from(changelogEntries).orderBy(desc(changelogEntries.releaseDate), desc(changelogEntries.id));
}

export async function createChangelogEntry(data: typeof changelogEntries.$inferInsert, userId?: number | null) {
  const db = await requireDb();
  const result = await db.insert(changelogEntries).values(data).returning({ id: changelogEntries.id });
  const id = result[0].id;
  await audit("changelog.create", "changelog_entries", id, userId);
  return { id };
}

export async function deleteChangelogEntry(id: number, userId?: number | null) {
  const db = await requireDb();
  await db.delete(changelogEntries).where(eq(changelogEntries.id, id));
  await audit("changelog.delete", "changelog_entries", id, userId);
  return { success: true } as const;
}

/* ================================================================== */
/* BASE DE CONNAISSANCES                                               */
/* ================================================================== */

export async function listArticles(input?: { search?: string; category?: string }) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: knowledgeBaseArticles.id,
      title: knowledgeBaseArticles.title,
      category: knowledgeBaseArticles.category,
      content: knowledgeBaseArticles.content,
      authorId: knowledgeBaseArticles.authorId,
      authorName: internalUsers.fullName,
      createdAt: knowledgeBaseArticles.createdAt,
      updatedAt: knowledgeBaseArticles.updatedAt,
    })
    .from(knowledgeBaseArticles)
    .leftJoin(internalUsers, eq(knowledgeBaseArticles.authorId, internalUsers.id))
    .orderBy(desc(knowledgeBaseArticles.updatedAt));

  return searchArticles(rows, input?.search, input?.category).map(article => ({
    ...article,
    excerpt: excerpt(article.content),
  }));
}

export async function getArticle(id: number) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: knowledgeBaseArticles.id,
      title: knowledgeBaseArticles.title,
      category: knowledgeBaseArticles.category,
      content: knowledgeBaseArticles.content,
      authorId: knowledgeBaseArticles.authorId,
      authorName: internalUsers.fullName,
      createdAt: knowledgeBaseArticles.createdAt,
      updatedAt: knowledgeBaseArticles.updatedAt,
    })
    .from(knowledgeBaseArticles)
    .leftJoin(internalUsers, eq(knowledgeBaseArticles.authorId, internalUsers.id))
    .where(eq(knowledgeBaseArticles.id, id))
    .limit(1);
  return rows[0] || null;
}

export async function createArticle(data: typeof knowledgeBaseArticles.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(knowledgeBaseArticles).values(data).returning({ id: knowledgeBaseArticles.id });
  return { id: result[0].id };
}

export async function updateArticle(id: number, data: Partial<typeof knowledgeBaseArticles.$inferInsert>) {
  const db = await requireDb();
  await db.update(knowledgeBaseArticles).set(data).where(eq(knowledgeBaseArticles.id, id));
  return { success: true } as const;
}

export async function deleteArticle(id: number) {
  const db = await requireDb();
  await db.delete(knowledgeBaseArticles).where(eq(knowledgeBaseArticles.id, id));
  return { success: true } as const;
}

/* ================================================================== */
/* NOTIFICATIONS CENTRALISÉES                                          */
/* ================================================================== */

export async function listNotifications(userId: number, input?: { category?: string; unreadOnly?: boolean }) {
  const db = await requireDb();
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt));

  return rows.filter(
    row =>
      (!input?.category || input.category === "Toutes" || row.category === input.category) &&
      (!input?.unreadOnly || !row.isRead)
  );
}

export async function countUnread(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return { unread: rows.length };
}

export async function markNotificationRead(id: number, userId: number) {
  const db = await requireDb();
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return { success: true } as const;
}

export async function markAllRead(userId: number) {
  const db = await requireDb();
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  return { success: true } as const;
}

/**
 * Recalcule les notifications transverses pour les destinataires concernés.
 *
 * Le traitement est idempotent : chaque alerte porte une clé de déduplication
 * stable, si bien qu'un second passage ne crée aucun doublon. Sont couvertes
 * les sources V2 prévues au cahier des charges — échéances juridiques,
 * renouvellements fournisseurs, congés à valider et demandes produit à
 * prioriser.
 */
export async function refreshNotifications() {
  const db = await requireDb();
  const [documents, supplierRows, leaves, requests, team] = await Promise.all([
    db.select({ id: legalDocuments.id, title: legalDocuments.title, type: legalDocuments.type, expiryDate: legalDocuments.expiryDate }).from(legalDocuments),
    db.select({ id: suppliers.id, name: suppliers.name, contractRenewalDate: suppliers.contractRenewalDate }).from(suppliers),
    db.select().from(leaveRequests).where(eq(leaveRequests.status, "Demande")),
    db.select().from(productRequests).where(inArray(productRequests.status, ["Idee", "Backlog"])),
    db.select().from(internalUsers),
  ]);

  // Ces alertes relèvent du pilotage : elles sont adressées à la direction et
  // aux administrateurs, seuls habilités sur ces pôles.
  const recipients = team.filter(member => ["admin", "direction"].includes(member.role));
  if (!recipients.length) return { created: 0, recipients: 0 };

  type Candidate = { dedupeKey: string; category: typeof notifications.$inferInsert["category"]; message: string; link: string };
  const candidates: Candidate[] = [];

  for (const item of buildDeadlineSchedule(documents, supplierRows)) {
    if (item.severity !== "Critique" && item.severity !== "Expire") continue;
    const when = item.days !== null && item.days < 0 ? `expiré depuis ${Math.abs(item.days)} j` : `échéance dans ${item.days} j`;
    candidates.push({
      dedupeKey: `${item.kind.toLowerCase()}-${item.id}-${item.date}`,
      category: item.kind === "Juridique" ? "Juridique" : "Fournisseurs",
      message: `${item.label} — ${when}.`,
      link: item.link,
    });
  }

  for (const leave of leaves) {
    const member = team.find(person => person.id === leave.userId);
    candidates.push({
      dedupeKey: `leave-${leave.id}`,
      category: "RH",
      message: `Demande de congés à valider — ${member?.fullName ?? "collaborateur"}, du ${leave.startDate} au ${leave.endDate}.`,
      link: "/rh/conges",
    });
  }

  for (const request of requests.filter(item => item.priority === "Haute")) {
    candidates.push({
      dedupeKey: `product-${request.id}`,
      category: "Produit",
      message: `Demande produit prioritaire à arbitrer — ${request.title}.`,
      link: "/produit",
    });
  }

  let created = 0;
  for (const candidate of candidates) {
    for (const recipient of recipients) {
      const result = await db
        .insert(notifications)
        .values({
          userId: recipient.id,
          category: candidate.category,
          // La clé inclut le destinataire : chacun reçoit son exemplaire.
          dedupeKey: `${candidate.dedupeKey}-u${recipient.id}`,
          message: candidate.message,
          link: candidate.link,
        })
        .onConflictDoNothing({ target: notifications.dedupeKey })
        .returning({ id: notifications.id });
      created += result.length;
    }
  }

  return { created, recipients: recipients.length, candidates: candidates.length };
}
