/**
 * Calculs du pôle Finance & Comptabilité.
 *
 * Toutes les fonctions de ce fichier sont pures : elles reçoivent les lignes
 * déjà lues en base et n'effectuent aucun accès aux données, ce qui les rend
 * directement testables et réutilisables par le pôle Direction.
 *
 * Les montants circulent en base sous forme de chaînes (type `numeric` de
 * PostgreSQL) ; `toAmount` les ramène à des nombres en neutralisant les valeurs
 * absentes ou illisibles.
 */

export const EXPENSE_CATEGORIES = [
  "Hebergement",
  "Outils SaaS",
  "Salaires",
  "Marketing",
  "Frais Generaux",
  "Autre",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function toAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const dayMs = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Trésorerie                                                          */
/* ------------------------------------------------------------------ */

export type TreasuryInput = {
  transactions: { amount: string | number; type: "Credit" | "Debit"; transactionDate: string }[];
  invoices: { amount: string | number; status: string; dueDate: string | null; paidAt: string | null }[];
  expenses: { amount: string | number; expenseDate: string; isRecurring: boolean }[];
  horizonDays?: number;
  now?: Date;
};

/**
 * Photographie de la trésorerie.
 *
 * Le solde est établi à partir des seuls mouvements bancaires constatés : il
 * reflète l'argent réellement disponible, sans tenir compte des factures
 * émises mais non encore encaissées. Le prévisionnel, lui, projette les
 * encaissements et décaissements attendus sur l'horizon demandé.
 */
export function calculateTreasury(input: TreasuryInput) {
  const now = input.now ?? new Date();
  const horizonDays = input.horizonDays ?? 30;
  const horizon = new Date(now.getTime() + horizonDays * dayMs);

  let inflows = 0;
  let outflows = 0;
  for (const transaction of input.transactions) {
    const amount = Math.abs(toAmount(transaction.amount));
    if (transaction.type === "Credit") inflows += amount;
    else outflows += amount;
  }
  const balance = inflows - outflows;

  // Encaissements attendus : factures émises, non réglées, quel que soit leur
  // retard — une facture en retard reste due.
  let expectedInflows = 0;
  let overdueInflows = 0;
  for (const invoice of input.invoices) {
    if (invoice.paidAt || !["Envoyee", "En Retard"].includes(invoice.status)) continue;
    const amount = toAmount(invoice.amount);
    const due = toDate(invoice.dueDate);
    if (due && due.getTime() < now.getTime()) {
      overdueInflows += amount;
      expectedInflows += amount;
    } else if (!due || due.getTime() <= horizon.getTime()) {
      expectedInflows += amount;
    }
  }

  // Décaissements attendus : les charges récurrentes sont reconduites sur
  // l'horizon, les dépenses ponctuelles déjà datées dans la fenêtre s'y
  // ajoutent.
  const monthlyRecurring = input.expenses
    .filter(expense => expense.isRecurring)
    .reduce((sum, expense) => sum + toAmount(expense.amount), 0);
  const recurringOverHorizon = (monthlyRecurring * horizonDays) / 30;

  const plannedOneOff = input.expenses
    .filter(expense => {
      if (expense.isRecurring) return false;
      const date = toDate(expense.expenseDate);
      return Boolean(date && date.getTime() >= now.getTime() && date.getTime() <= horizon.getTime());
    })
    .reduce((sum, expense) => sum + toAmount(expense.amount), 0);

  const expectedOutflows = recurringOverHorizon + plannedOneOff;

  return {
    balance: roundAmount(balance),
    inflows: roundAmount(inflows),
    outflows: roundAmount(outflows),
    expectedInflows: roundAmount(expectedInflows),
    overdueInflows: roundAmount(overdueInflows),
    expectedOutflows: roundAmount(expectedOutflows),
    monthlyRecurring: roundAmount(monthlyRecurring),
    projectedBalance: roundAmount(balance + expectedInflows - expectedOutflows),
    horizonDays,
  };
}

/* ------------------------------------------------------------------ */
/* Dépenses                                                            */
/* ------------------------------------------------------------------ */

export function summarizeExpensesByCategory(
  expenses: { amount: string | number; category: string | null; isRecurring: boolean }[]
) {
  const totals = new Map<string, { total: number; recurring: number; count: number }>();
  let grandTotal = 0;

  for (const expense of expenses) {
    const category = expense.category || "Autre";
    const amount = toAmount(expense.amount);
    const entry = totals.get(category) ?? { total: 0, recurring: 0, count: 0 };
    entry.total += amount;
    entry.count += 1;
    if (expense.isRecurring) entry.recurring += amount;
    totals.set(category, entry);
    grandTotal += amount;
  }

  return Array.from(totals.entries())
    .map(([category, entry]) => ({
      category,
      total: roundAmount(entry.total),
      recurring: roundAmount(entry.recurring),
      count: entry.count,
      share: grandTotal > 0 ? roundAmount((entry.total / grandTotal) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/* ------------------------------------------------------------------ */
/* Rapprochement bancaire                                              */
/* ------------------------------------------------------------------ */

export type ReconciliationCandidate = {
  kind: "invoice" | "expense";
  id: number;
  label: string;
  amount: number;
  date: string | null;
  /** Écart de date en jours entre la pièce et le mouvement bancaire. */
  dayGap: number;
};

/**
 * Propose les pièces susceptibles de correspondre à un mouvement bancaire.
 *
 * Le rapprochement retenu est volontairement prudent : seuls les montants
 * identiques au centime près sont proposés, et la décision finale reste
 * manuelle. Les propositions sont classées par proximité de date.
 */
export function suggestReconciliation(
  transaction: { amount: string | number; type: "Credit" | "Debit"; transactionDate: string },
  invoices: { id: number; invoiceNumber: string; amount: string | number; paidAt: string | null; organizationName?: string | null }[],
  expenses: { id: number; label: string; amount: string | number; expenseDate: string }[],
  maxDayGap = 15
): ReconciliationCandidate[] {
  const target = roundAmount(Math.abs(toAmount(transaction.amount)));
  const transactionDate = toDate(transaction.transactionDate);
  if (!transactionDate) return [];

  const gapFrom = (value: string | null) => {
    const date = toDate(value);
    if (!date) return Number.POSITIVE_INFINITY;
    return Math.round(Math.abs(date.getTime() - transactionDate.getTime()) / dayMs);
  };

  const candidates: ReconciliationCandidate[] = [];

  // Un encaissement se rapproche d'une facture, un décaissement d'une dépense.
  if (transaction.type === "Credit") {
    for (const invoice of invoices) {
      if (roundAmount(toAmount(invoice.amount)) !== target) continue;
      const dayGap = gapFrom(invoice.paidAt);
      candidates.push({
        kind: "invoice",
        id: invoice.id,
        label: invoice.organizationName
          ? `${invoice.invoiceNumber} — ${invoice.organizationName}`
          : invoice.invoiceNumber,
        amount: target,
        date: invoice.paidAt,
        dayGap,
      });
    }
  } else {
    for (const expense of expenses) {
      if (roundAmount(toAmount(expense.amount)) !== target) continue;
      candidates.push({
        kind: "expense",
        id: expense.id,
        label: expense.label,
        amount: target,
        date: expense.expenseDate,
        dayGap: gapFrom(expense.expenseDate),
      });
    }
  }

  return candidates
    .filter(candidate => candidate.dayGap <= maxDayGap)
    .sort((a, b) => a.dayGap - b.dayGap)
    .slice(0, 5);
}

export function reconciliationProgress(
  transactions: { isReconciled: boolean; amount: string | number }[]
) {
  const total = transactions.length;
  const reconciled = transactions.filter(transaction => transaction.isReconciled).length;
  const pendingAmount = transactions
    .filter(transaction => !transaction.isReconciled)
    .reduce((sum, transaction) => sum + Math.abs(toAmount(transaction.amount)), 0);
  return {
    total,
    reconciled,
    pending: total - reconciled,
    pendingAmount: roundAmount(pendingAmount),
    rate: total > 0 ? roundAmount((reconciled / total) * 100) : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Réconciliation du revenu récurrent                                  */
/* ------------------------------------------------------------------ */

/**
 * Confronte le revenu récurrent théorique, issu des abonnements actifs, aux
 * encaissements réellement constatés en banque sur la période.
 *
 * L'écart met en évidence les abonnements facturés mais non encaissés — ou
 * inversement des encaissements sans abonnement correspondant.
 */
export function reconcileRecurringRevenue(
  subscriptions: { seatsPurchased: number; pricePerSeat: string | number; billingCycle: string; status: string }[],
  collectedInflows: number
) {
  let mrr = 0;
  for (const subscription of subscriptions) {
    if (!["Actif", "Essai"].includes(subscription.status)) continue;
    const monthly = subscription.seatsPurchased * toAmount(subscription.pricePerSeat);
    mrr += subscription.billingCycle === "Annuel" ? monthly / 12 : monthly;
  }
  mrr = roundAmount(mrr);
  const collected = roundAmount(collectedInflows);
  return {
    mrr,
    arr: roundAmount(mrr * 12),
    collected,
    gap: roundAmount(collected - mrr),
    coverageRate: mrr > 0 ? roundAmount((collected / mrr) * 100) : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Export comptable au format FEC                                      */
/* ------------------------------------------------------------------ */

/**
 * Comptes utilisés pour l'export. Ce plan est une base de travail conforme au
 * plan comptable général : il doit être validé, et le cas échéant ajusté, par
 * l'expert-comptable avant toute transmission à l'administration fiscale.
 */
export const FEC_ACCOUNTS = {
  clients: { num: "411000", lib: "Clients" },
  ventes: { num: "706000", lib: "Prestations de services" },
  fournisseurs: { num: "401000", lib: "Fournisseurs" },
  banque: { num: "512000", lib: "Banque" },
  charges: {
    Hebergement: { num: "613500", lib: "Locations - hebergement" },
    "Outils SaaS": { num: "651600", lib: "Redevances logiciels" },
    Salaires: { num: "641100", lib: "Salaires et appointements" },
    Marketing: { num: "623000", lib: "Publicite et relations publiques" },
    "Frais Generaux": { num: "606400", lib: "Fournitures administratives" },
    Autre: { num: "628000", lib: "Divers" },
  } as Record<string, { num: string; lib: string }>,
} as const;

export type FecLine = {
  JournalCode: string;
  JournalLib: string;
  EcritureNum: string;
  EcritureDate: string;
  CompteNum: string;
  CompteLib: string;
  CompAuxNum: string;
  CompAuxLib: string;
  PieceRef: string;
  PieceDate: string;
  EcritureLib: string;
  Debit: string;
  Credit: string;
  EcritureLet: string;
  DateLet: string;
  ValidDate: string;
  Montantdevise: string;
  Idevise: string;
};

export const FEC_COLUMNS: (keyof FecLine)[] = [
  "JournalCode", "JournalLib", "EcritureNum", "EcritureDate", "CompteNum", "CompteLib",
  "CompAuxNum", "CompAuxLib", "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit",
  "EcritureLet", "DateLet", "ValidDate", "Montantdevise", "Idevise",
];

/** Date au format AAAAMMJJ exigé par le FEC. */
export function fecDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

/** Montant à deux décimales, séparateur virgule comme l'exige le format. */
export function fecAmount(value: number): string {
  return roundAmount(value).toFixed(2).replace(".", ",");
}

/** Nettoie un libellé : le FEC est tabulé, aucune tabulation ne doit subsister. */
function fecText(value: string | null | undefined): string {
  return (value ?? "").replace(/[\t\r\n]+/g, " ").trim();
}

export type FecInput = {
  invoices: {
    id: number;
    invoiceNumber: string;
    amount: string | number;
    status: string;
    issuedAt: string | null;
    organizationName: string | null;
    organizationId: number;
  }[];
  expenses: {
    id: number;
    label: string;
    amount: string | number;
    category: string | null;
    expenseDate: string;
    supplierName: string | null;
    supplierId: number | null;
  }[];
};

/**
 * Construit les écritures comptables de la période.
 *
 * Deux journaux sont produits : les ventes (facture client) et les achats
 * (dépense fournisseur). Chaque pièce donne lieu à deux lignes équilibrées,
 * un débit et un crédit de même montant, comme l'exige la partie double.
 * Les factures encore à l'état de brouillon sont exclues : elles ne
 * constituent pas une écriture comptable.
 */
export function buildFecLines(input: FecInput): FecLine[] {
  const lines: FecLine[] = [];
  const base = {
    EcritureLet: "",
    DateLet: "",
    Montantdevise: "",
    Idevise: "",
  };

  const sortedInvoices = [...input.invoices]
    .filter(invoice => invoice.status !== "Brouillon")
    .sort((a, b) => (a.issuedAt ?? "").localeCompare(b.issuedAt ?? ""));

  sortedInvoices.forEach((invoice, index) => {
    const amount = toAmount(invoice.amount);
    const num = String(index + 1).padStart(5, "0");
    const date = fecDate(invoice.issuedAt);
    const label = fecText(`Facture ${invoice.invoiceNumber} - ${invoice.organizationName ?? "Client"}`);
    const shared = {
      JournalCode: "VE",
      JournalLib: "Ventes",
      EcritureNum: `VE${num}`,
      EcritureDate: date,
      CompAuxNum: `C${String(invoice.organizationId).padStart(5, "0")}`,
      CompAuxLib: fecText(invoice.organizationName ?? "Client"),
      PieceRef: fecText(invoice.invoiceNumber),
      PieceDate: date,
      EcritureLib: label,
      ValidDate: date,
      ...base,
    };
    lines.push({
      ...shared,
      CompteNum: FEC_ACCOUNTS.clients.num,
      CompteLib: FEC_ACCOUNTS.clients.lib,
      Debit: fecAmount(amount),
      Credit: fecAmount(0),
    });
    lines.push({
      ...shared,
      CompteNum: FEC_ACCOUNTS.ventes.num,
      CompteLib: FEC_ACCOUNTS.ventes.lib,
      Debit: fecAmount(0),
      Credit: fecAmount(amount),
    });
  });

  const sortedExpenses = [...input.expenses].sort((a, b) => a.expenseDate.localeCompare(b.expenseDate));

  sortedExpenses.forEach((expense, index) => {
    const amount = toAmount(expense.amount);
    const num = String(index + 1).padStart(5, "0");
    const date = fecDate(expense.expenseDate);
    const account = FEC_ACCOUNTS.charges[expense.category || "Autre"] ?? FEC_ACCOUNTS.charges.Autre;
    const shared = {
      JournalCode: "AC",
      JournalLib: "Achats",
      EcritureNum: `AC${num}`,
      EcritureDate: date,
      CompAuxNum: expense.supplierId ? `F${String(expense.supplierId).padStart(5, "0")}` : "",
      CompAuxLib: fecText(expense.supplierName ?? ""),
      PieceRef: `DEP-${String(expense.id).padStart(5, "0")}`,
      PieceDate: date,
      EcritureLib: fecText(expense.label),
      ValidDate: date,
      ...base,
    };
    lines.push({
      ...shared,
      CompteNum: account.num,
      CompteLib: account.lib,
      Debit: fecAmount(amount),
      Credit: fecAmount(0),
    });
    lines.push({
      ...shared,
      CompteNum: FEC_ACCOUNTS.fournisseurs.num,
      CompteLib: FEC_ACCOUNTS.fournisseurs.lib,
      Debit: fecAmount(0),
      Credit: fecAmount(amount),
    });
  });

  return lines;
}

/** Sérialise les écritures au format tabulé attendu par l'administration. */
export function serializeFec(lines: FecLine[]): string {
  const header = FEC_COLUMNS.join("\t");
  const body = lines.map(line => FEC_COLUMNS.map(column => line[column]).join("\t"));
  return [header, ...body].join("\r\n");
}

/** Contrôle d'équilibre : la somme des débits doit égaler celle des crédits. */
export function checkFecBalance(lines: FecLine[]) {
  const parse = (value: string) => Number(value.replace(",", ".")) || 0;
  const debit = roundAmount(lines.reduce((sum, line) => sum + parse(line.Debit), 0));
  const credit = roundAmount(lines.reduce((sum, line) => sum + parse(line.Credit), 0));
  return { debit, credit, balanced: Math.abs(debit - credit) < 0.01, entries: lines.length };
}
