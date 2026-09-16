import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import {
  auditLog,
  bankTransactions,
  expenses,
  invoices,
  organizations,
  subscriptions,
  suppliers,
} from "../drizzle/schema";
import { requireDb } from "./db";
import {
  buildFecLines,
  calculateTreasury,
  checkFecBalance,
  reconcileRecurringRevenue,
  reconciliationProgress,
  serializeFec,
  suggestReconciliation,
  summarizeExpensesByCategory,
  toAmount,
} from "./finance.logic";

/**
 * Toute écriture sur une table financière est journalisée : ces données
 * alimentent la comptabilité et doivent rester traçables.
 */
async function audit(action: string, targetTable: string, targetId: number, userId?: number | null) {
  const db = await requireDb();
  await db.insert(auditLog).values({ userId: userId ?? null, action, targetTable, targetId });
}

/* ------------------------------------------------------------------ */
/* Tableau de bord de trésorerie                                       */
/* ------------------------------------------------------------------ */

export async function getFinanceDashboard(horizonDays = 30) {
  const db = await requireDb();
  const [transactionRows, invoiceRows, expenseRows, subscriptionRows] = await Promise.all([
    db.select().from(bankTransactions),
    db.select().from(invoices),
    db.select().from(expenses),
    db.select().from(subscriptions),
  ]);

  const treasury = calculateTreasury({
    transactions: transactionRows,
    invoices: invoiceRows,
    expenses: expenseRows,
    horizonDays,
  });

  const collected = transactionRows
    .filter(row => row.type === "Credit")
    .reduce((sum, row) => sum + Math.abs(toAmount(row.amount)), 0);

  const recentTransactions = [...transactionRows]
    .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
    .slice(0, 8);

  const upcomingRecurring = expenseRows
    .filter(row => row.isRecurring)
    .sort((a, b) => toAmount(b.amount) - toAmount(a.amount))
    .slice(0, 5);

  return {
    ...treasury,
    byCategory: summarizeExpensesByCategory(expenseRows),
    reconciliation: reconciliationProgress(transactionRows),
    revenue: reconcileRecurringRevenue(subscriptionRows, collected),
    recentTransactions,
    upcomingRecurring,
    expenseCount: expenseRows.length,
  };
}

/* ------------------------------------------------------------------ */
/* Dépenses                                                            */
/* ------------------------------------------------------------------ */

export async function listExpenses(input?: {
  search?: string;
  category?: string;
  from?: string;
  to?: string;
  recurringOnly?: boolean;
}) {
  const db = await requireDb();
  const conditions = [];
  if (input?.from) conditions.push(gte(expenses.expenseDate, input.from));
  if (input?.to) conditions.push(lte(expenses.expenseDate, input.to));

  const rows = await db
    .select({
      id: expenses.id,
      supplierId: expenses.supplierId,
      supplierName: suppliers.name,
      label: expenses.label,
      category: expenses.category,
      amount: expenses.amount,
      expenseDate: expenses.expenseDate,
      isRecurring: expenses.isRecurring,
      createdAt: expenses.createdAt,
    })
    .from(expenses)
    .leftJoin(suppliers, eq(expenses.supplierId, suppliers.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(expenses.expenseDate), desc(expenses.id));

  const term = input?.search?.trim().toLowerCase();
  return rows.filter(
    row =>
      (!term || [row.label, row.supplierName || ""].some(value => value.toLowerCase().includes(term))) &&
      (!input?.category || input.category === "Toutes" || row.category === input.category) &&
      (!input?.recurringOnly || row.isRecurring)
  );
}

export async function createExpense(data: typeof expenses.$inferInsert, userId?: number | null) {
  const db = await requireDb();
  const result = await db.insert(expenses).values(data).returning({ id: expenses.id });
  const id = result[0].id;
  await audit("expense.create", "expenses", id, userId);
  return { id };
}

export async function updateExpense(
  id: number,
  data: Partial<typeof expenses.$inferInsert>,
  userId?: number | null
) {
  const db = await requireDb();
  await db.update(expenses).set(data).where(eq(expenses.id, id));
  await audit("expense.update", "expenses", id, userId);
  return { success: true } as const;
}

export async function deleteExpense(id: number, userId?: number | null) {
  const db = await requireDb();
  await db.delete(expenses).where(eq(expenses.id, id));
  await audit("expense.delete", "expenses", id, userId);
  return { success: true } as const;
}

/* ------------------------------------------------------------------ */
/* Fournisseurs                                                        */
/* ------------------------------------------------------------------ */

export async function listSuppliers() {
  const db = await requireDb();
  const [supplierRows, expenseRows] = await Promise.all([
    db.select().from(suppliers).orderBy(asc(suppliers.name)),
    db.select({ supplierId: expenses.supplierId, amount: expenses.amount }).from(expenses),
  ]);
  return supplierRows.map(supplier => ({
    ...supplier,
    spentTotal: expenseRows
      .filter(expense => expense.supplierId === supplier.id)
      .reduce((sum, expense) => sum + toAmount(expense.amount), 0),
  }));
}

/* ------------------------------------------------------------------ */
/* Transactions bancaires et rapprochement                             */
/* ------------------------------------------------------------------ */

export async function listBankTransactions(input?: {
  search?: string;
  status?: "Toutes" | "Rapprochees" | "A rapprocher";
  from?: string;
  to?: string;
}) {
  const db = await requireDb();
  const conditions = [];
  if (input?.from) conditions.push(gte(bankTransactions.transactionDate, input.from));
  if (input?.to) conditions.push(lte(bankTransactions.transactionDate, input.to));

  const rows = await db
    .select({
      id: bankTransactions.id,
      transactionDate: bankTransactions.transactionDate,
      amount: bankTransactions.amount,
      type: bankTransactions.type,
      description: bankTransactions.description,
      matchedInvoiceId: bankTransactions.matchedInvoiceId,
      matchedExpenseId: bankTransactions.matchedExpenseId,
      isReconciled: bankTransactions.isReconciled,
      matchedInvoiceNumber: invoices.invoiceNumber,
      matchedExpenseLabel: expenses.label,
      createdAt: bankTransactions.createdAt,
    })
    .from(bankTransactions)
    .leftJoin(invoices, eq(bankTransactions.matchedInvoiceId, invoices.id))
    .leftJoin(expenses, eq(bankTransactions.matchedExpenseId, expenses.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(bankTransactions.transactionDate), desc(bankTransactions.id));

  const term = input?.search?.trim().toLowerCase();
  return rows.filter(
    row =>
      (!term || (row.description || "").toLowerCase().includes(term)) &&
      (!input?.status ||
        input.status === "Toutes" ||
        (input.status === "Rapprochees" ? row.isReconciled : !row.isReconciled))
  );
}

/** Pièces candidates au rapprochement d'un mouvement bancaire donné. */
export async function getReconciliationCandidates(transactionId: number) {
  const db = await requireDb();
  const transaction = (
    await db.select().from(bankTransactions).where(eq(bankTransactions.id, transactionId)).limit(1)
  )[0];
  if (!transaction) return null;

  const [invoiceRows, expenseRows] = await Promise.all([
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        amount: invoices.amount,
        paidAt: invoices.paidAt,
        issuedAt: invoices.issuedAt,
        organizationName: organizations.name,
      })
      .from(invoices)
      .leftJoin(organizations, eq(invoices.organizationId, organizations.id)),
    db.select({ id: expenses.id, label: expenses.label, amount: expenses.amount, expenseDate: expenses.expenseDate }).from(expenses),
  ]);

  // Une facture sans date de règlement reste rapprochable : on se rabat alors
  // sur sa date d'émission pour mesurer l'écart.
  const invoiceCandidates = invoiceRows.map(invoice => ({
    ...invoice,
    paidAt: invoice.paidAt ?? invoice.issuedAt,
  }));

  return {
    transaction,
    candidates: suggestReconciliation(transaction, invoiceCandidates, expenseRows),
  };
}

export async function reconcileTransaction(
  id: number,
  match: { kind: "invoice" | "expense"; targetId: number },
  userId?: number | null
) {
  const db = await requireDb();
  await db
    .update(bankTransactions)
    .set({
      matchedInvoiceId: match.kind === "invoice" ? match.targetId : null,
      matchedExpenseId: match.kind === "expense" ? match.targetId : null,
      isReconciled: true,
    })
    .where(eq(bankTransactions.id, id));
  await audit(`bank_transaction.reconcile.${match.kind}`, "bank_transactions", id, userId);
  return { success: true } as const;
}

export async function unreconcileTransaction(id: number, userId?: number | null) {
  const db = await requireDb();
  await db
    .update(bankTransactions)
    .set({ matchedInvoiceId: null, matchedExpenseId: null, isReconciled: false })
    .where(eq(bankTransactions.id, id));
  await audit("bank_transaction.unreconcile", "bank_transactions", id, userId);
  return { success: true } as const;
}

export async function createBankTransaction(
  data: typeof bankTransactions.$inferInsert,
  userId?: number | null
) {
  const db = await requireDb();
  const result = await db.insert(bankTransactions).values(data).returning({ id: bankTransactions.id });
  const id = result[0].id;
  await audit("bank_transaction.create", "bank_transactions", id, userId);
  return { id };
}

export async function deleteBankTransaction(id: number, userId?: number | null) {
  const db = await requireDb();
  await db.delete(bankTransactions).where(eq(bankTransactions.id, id));
  await audit("bank_transaction.delete", "bank_transactions", id, userId);
  return { success: true } as const;
}

/* ------------------------------------------------------------------ */
/* Export comptable                                                    */
/* ------------------------------------------------------------------ */

/**
 * Produit le Fichier des Écritures Comptables de la période demandée.
 * Le contenu est renvoyé encodé en base64 pour traverser l'API sans
 * altération des tabulations et des retours chariot exigés par la norme.
 */
export async function exportFec(input: { from: string; to: string }, userId?: number | null) {
  const db = await requireDb();
  const [invoiceRows, expenseRows] = await Promise.all([
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        amount: invoices.amount,
        status: invoices.status,
        issuedAt: invoices.issuedAt,
        organizationId: invoices.organizationId,
        organizationName: organizations.name,
      })
      .from(invoices)
      .leftJoin(organizations, eq(invoices.organizationId, organizations.id))
      .where(and(gte(invoices.issuedAt, input.from), lte(invoices.issuedAt, input.to))),
    db
      .select({
        id: expenses.id,
        label: expenses.label,
        amount: expenses.amount,
        category: expenses.category,
        expenseDate: expenses.expenseDate,
        supplierId: expenses.supplierId,
        supplierName: suppliers.name,
      })
      .from(expenses)
      .leftJoin(suppliers, eq(expenses.supplierId, suppliers.id))
      .where(and(gte(expenses.expenseDate, input.from), lte(expenses.expenseDate, input.to))),
  ]);

  const lines = buildFecLines({ invoices: invoiceRows, expenses: expenseRows });
  const content = serializeFec(lines);
  const balance = checkFecBalance(lines);

  await audit(`fec.export.${input.from}_${input.to}`, "invoices", invoiceRows.length, userId);

  return {
    fileName: `FEC_${input.from.replace(/-/g, "")}_${input.to.replace(/-/g, "")}.txt`,
    contentBase64: Buffer.from(content, "utf8").toString("base64"),
    ...balance,
    invoiceCount: invoiceRows.length,
    expenseCount: expenseRows.length,
  };
}
