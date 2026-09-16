import "dotenv/config";
import { eq } from "drizzle-orm";
import { createDb } from "../drizzle/client";
import { bankTransactions, expenses, internalUsers, invoices, suppliers } from "../drizzle/schema";

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const daysAgo = (days: number) => dateOnly(new Date(Date.now() - days * 24 * 60 * 60 * 1000));
const inDays = (days: number) => dateOnly(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

async function run() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL est requis");
  const db = createDb(process.env.DATABASE_URL);

  // Le jeu est idempotent : on repart des fournisseurs déjà connus.
  const existingSuppliers = await db.select().from(suppliers);
  const supplierSeed = [
    { name: "OVHcloud — Hébergement HDS", category: "Hebergement" as const, contactName: "Service commercial", contactEmail: "contact@ovhcloud.example", annualCost: "18000", contractRenewalDate: inDays(120), notes: "Hébergement certifié HDS des environnements de production." },
    { name: "Mailjet", category: "Outil SaaS Interne" as const, contactName: "Support Mailjet", contactEmail: "support@mailjet.example", annualCost: "2400", contractRenewalDate: inDays(45), notes: "Emails transactionnels et campagnes marketing." },
    { name: "Supabase", category: "Outil SaaS Interne" as const, contactName: "Support Supabase", contactEmail: "support@supabase.example", annualCost: "3000", contractRenewalDate: inDays(250), notes: "Base de données et authentification de la plateforme interne." },
    { name: "Cabinet Duval & Associés", category: "Autre" as const, contactName: "Marie Duval", contactEmail: "m.duval@cabinet-duval.example", annualCost: "7200", contractRenewalDate: inDays(300), notes: "Expertise comptable et social." },
    { name: "Réseau AGAPE", category: "Partenaire Commercial" as const, contactName: "Délégation régionale", contactEmail: "contact@agape.example", annualCost: "1500", contractRenewalDate: inDays(80), notes: "Partenariat d’apport d’affaires auprès des établissements." },
  ];

  for (const supplier of supplierSeed) {
    if (existingSuppliers.some(row => row.name === supplier.name)) continue;
    await db.insert(suppliers).values(supplier);
  }
  const allSuppliers = await db.select().from(suppliers);
  const supplierId = (name: string) => allSuppliers.find(row => row.name.startsWith(name))?.id ?? null;

  const existingExpenses = await db.select().from(expenses);
  const expenseSeed = [
    { supplierId: supplierId("OVHcloud"), label: "Hébergement HDS — production", category: "Hebergement" as const, amount: "1500.00", expenseDate: daysAgo(12), isRecurring: true },
    { supplierId: supplierId("Supabase"), label: "Abonnement Supabase Pro", category: "Outils SaaS" as const, amount: "250.00", expenseDate: daysAgo(10), isRecurring: true },
    { supplierId: supplierId("Mailjet"), label: "Abonnement Mailjet", category: "Outils SaaS" as const, amount: "200.00", expenseDate: daysAgo(9), isRecurring: true },
    { supplierId: null, label: "Salaires équipe — mois en cours", category: "Salaires" as const, amount: "14500.00", expenseDate: daysAgo(6), isRecurring: true },
    { supplierId: supplierId("Cabinet Duval"), label: "Honoraires expertise comptable", category: "Frais Generaux" as const, amount: "600.00", expenseDate: daysAgo(20), isRecurring: true },
    { supplierId: supplierId("Réseau AGAPE"), label: "Stand Congrès Santé Numérique", category: "Marketing" as const, amount: "4200.00", expenseDate: daysAgo(35), isRecurring: false },
    { supplierId: null, label: "Campagne LinkedIn ciblage DSI", category: "Marketing" as const, amount: "1800.00", expenseDate: daysAgo(18), isRecurring: false },
    { supplierId: null, label: "Matériel bureautique", category: "Frais Generaux" as const, amount: "950.00", expenseDate: daysAgo(48), isRecurring: false },
    { supplierId: null, label: "Audit de sécurité annuel", category: "Autre" as const, amount: "3500.00", expenseDate: inDays(12), isRecurring: false },
  ];

  for (const expense of expenseSeed) {
    if (existingExpenses.some(row => row.label === expense.label)) continue;
    await db.insert(expenses).values(expense);
  }
  const allExpenses = await db.select().from(expenses);
  const expenseId = (label: string) => allExpenses.find(row => row.label === label)?.id ?? null;

  // Quelques factures clients déjà réglées servent de contrepartie aux
  // encaissements bancaires, pour rendre le rapprochement démontrable.
  const paidInvoices = (await db.select().from(invoices)).filter(row => row.status === "Payee").slice(0, 3);

  const existingTransactions = await db.select().from(bankTransactions);
  const transactionSeed: (typeof bankTransactions.$inferInsert)[] = [
    { transactionDate: daysAgo(40), amount: "62000.00", type: "Credit", description: "Apport en compte courant des associés", isReconciled: true },
    { transactionDate: daysAgo(12), amount: "1500.00", type: "Debit", description: "PRLV OVHCLOUD HEBERGEMENT", matchedExpenseId: expenseId("Hébergement HDS — production"), isReconciled: true },
    { transactionDate: daysAgo(10), amount: "250.00", type: "Debit", description: "PRLV SUPABASE PRO", matchedExpenseId: expenseId("Abonnement Supabase Pro"), isReconciled: true },
    { transactionDate: daysAgo(6), amount: "14500.00", type: "Debit", description: "VIR SALAIRES", matchedExpenseId: expenseId("Salaires équipe — mois en cours"), isReconciled: true },
    { transactionDate: daysAgo(9), amount: "200.00", type: "Debit", description: "PRLV MAILJET", isReconciled: false },
    { transactionDate: daysAgo(18), amount: "1800.00", type: "Debit", description: "CB LINKEDIN ADS", isReconciled: false },
    { transactionDate: daysAgo(4), amount: "890.00", type: "Debit", description: "FRAIS DEPLACEMENT CONGRES", isReconciled: false },
  ];

  paidInvoices.forEach((invoice, index) => {
    transactionSeed.push({
      transactionDate: invoice.paidAt ?? daysAgo(15 + index),
      amount: invoice.amount,
      type: "Credit",
      description: `VIR RECU ${invoice.invoiceNumber}`,
      matchedInvoiceId: index === 0 ? invoice.id : null,
      isReconciled: index === 0,
    });
  });

  for (const transaction of transactionSeed) {
    if (existingTransactions.some(row => row.description === transaction.description)) continue;
    await db.insert(bankTransactions).values(transaction);
  }

  const finalSuppliers = await db.select().from(suppliers);
  const finalExpenses = await db.select().from(expenses);
  const finalTransactions = await db.select().from(bankTransactions);
  const pending = finalTransactions.filter(row => !row.isReconciled).length;

  console.log(
    `Données Finance prêtes : ${finalSuppliers.length} fournisseurs, ${finalExpenses.length} dépenses, ` +
      `${finalTransactions.length} mouvements bancaires dont ${pending} à rapprocher.`
  );

  // Garantit qu'un profil finance existe pour tester les droits du pôle.
  const financeUser = (await db.select().from(internalUsers).where(eq(internalUsers.email, "finance@medactio.fr")))[0];
  if (!financeUser) {
    await db.insert(internalUsers).values({
      fullName: "Claire Bonnet",
      email: "finance@medactio.fr",
      role: "finance",
      jobTitle: "Responsable Administratif et Financier",
    });
    console.log("Profil finance de démonstration créé : finance@medactio.fr");
  }
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
