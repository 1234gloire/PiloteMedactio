import "dotenv/config";
import { eq } from "drizzle-orm";
import { auditLog, bankTransactions, expenses, internalUsers } from "../drizzle/schema";
import { requireDb } from "../server/db";
import {
  createBankTransaction,
  createExpense,
  deleteBankTransaction,
  deleteExpense,
  exportFec,
  getFinanceDashboard,
  getReconciliationCandidates,
  listBankTransactions,
  listExpenses,
  reconcileTransaction,
  unreconcileTransaction,
} from "../server/finance.db";

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

async function run() {
  const db = await requireDb();
  const author = (await db.select().from(internalUsers).limit(1))[0];
  if (!author) throw new Error("Aucun utilisateur interne disponible pour le test.");

  const stamp = Date.now();
  const label = `Dépense smoke ${stamp}`;
  const description = `PRLV SMOKE ${stamp}`;
  const today = dateOnly(new Date());
  let expenseId = 0;
  let transactionId = 0;

  try {
    // 1. Création d'une dépense et d'un mouvement bancaire de même montant.
    expenseId = (
      await createExpense(
        { label, category: "Outils SaaS", amount: "427.30", expenseDate: today, isRecurring: false, supplierId: null },
        author.id
      )
    ).id;

    transactionId = (
      await createBankTransaction(
        { transactionDate: today, amount: "427.30", type: "Debit", description },
        author.id
      )
    ).id;

    // 2. La dépense doit être retrouvée par la recherche.
    const found = await listExpenses({ search: `smoke ${stamp}` });
    if (found.length !== 1 || found[0].id !== expenseId) {
      throw new Error("La recherche de dépenses ne retrouve pas la ligne créée.");
    }

    // 3. Le moteur doit proposer la dépense comme contrepartie du mouvement.
    const suggestion = await getReconciliationCandidates(transactionId);
    const match = suggestion?.candidates.find(item => item.kind === "expense" && item.id === expenseId);
    if (!match) throw new Error("Le rapprochement ne propose pas la dépense de même montant et de même date.");

    // 4. Rapprochement, puis annulation.
    await reconcileTransaction(transactionId, { kind: "expense", targetId: expenseId }, author.id);
    let reloaded = (await listBankTransactions({ search: `SMOKE ${stamp}` }))[0];
    if (!reloaded?.isReconciled || reloaded.matchedExpenseId !== expenseId) {
      throw new Error("Le mouvement n’a pas été marqué comme rapproché.");
    }

    await unreconcileTransaction(transactionId, author.id);
    reloaded = (await listBankTransactions({ search: `SMOKE ${stamp}` }))[0];
    if (reloaded?.isReconciled || reloaded?.matchedExpenseId !== null) {
      throw new Error("L’annulation du rapprochement n’a pas été prise en compte.");
    }

    // 5. Le tableau de bord doit intégrer la nouvelle dépense.
    const dashboard = await getFinanceDashboard(30);
    if (dashboard.expenseCount < 1) throw new Error("Le tableau de bord ne voit aucune dépense.");
    if (dashboard.reconciliation.total < 1) throw new Error("Le tableau de bord ne voit aucun mouvement bancaire.");

    // 6. L'export comptable doit être équilibré et contenir la dépense.
    const fec = await exportFec({ from: today, to: today }, author.id);
    if (!fec.balanced) throw new Error(`Export FEC déséquilibré : débit ${fec.debit} / crédit ${fec.credit}.`);
    const content = Buffer.from(fec.contentBase64, "base64").toString("utf8");
    const rows = content.split("\r\n");
    if (!rows[0].startsWith("JournalCode\t")) throw new Error("L’en-tête FEC est incorrect.");
    if (rows.some(row => row.split("\t").length !== 18)) throw new Error("Une ligne FEC n’a pas 18 colonnes.");
    if (!content.includes(label)) throw new Error("La dépense créée est absente de l’export FEC.");

    // 7. Les écritures sensibles doivent être journalisées.
    const audits = await db.select().from(auditLog).where(eq(auditLog.targetTable, "bank_transactions"));
    if (!audits.some(entry => entry.targetId === transactionId && entry.action.startsWith("bank_transaction.reconcile"))) {
      throw new Error("Le rapprochement n’a pas été journalisé dans l’audit.");
    }

    console.log(
      `Smoke Finance réussi : dépense ${expenseId}, mouvement ${transactionId}, rapprochement et annulation vérifiés, ` +
        `export FEC équilibré (${fec.entries} écritures, ${fec.debit} € de part et d’autre).`
    );
  } finally {
    if (transactionId) await deleteBankTransaction(transactionId, author.id);
    if (expenseId) await deleteExpense(expenseId, author.id);
    // Les lignes d'audit produites par le test sont retirées pour ne pas
    // polluer le journal réel.
    if (transactionId) await db.delete(auditLog).where(eq(auditLog.targetId, transactionId));
    await db.delete(expenses).where(eq(expenses.label, label));
    await db.delete(bankTransactions).where(eq(bankTransactions.description, description));
  }
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
