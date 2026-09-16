import { describe, expect, it } from "vitest";
import {
  buildFecLines,
  calculateTreasury,
  checkFecBalance,
  fecAmount,
  fecDate,
  reconcileRecurringRevenue,
  reconciliationProgress,
  serializeFec,
  suggestReconciliation,
  summarizeExpensesByCategory,
} from "./finance.logic";

const now = new Date("2026-09-15T00:00:00Z");

describe("trésorerie", () => {
  it("établit le solde sur les seuls mouvements bancaires constatés", () => {
    const result = calculateTreasury({
      transactions: [
        { amount: "10000", type: "Credit", transactionDate: "2026-09-01" },
        { amount: "2500", type: "Debit", transactionDate: "2026-09-05" },
      ],
      invoices: [],
      expenses: [],
      now,
    });
    expect(result.balance).toBe(7500);
    expect(result.inflows).toBe(10000);
    expect(result.outflows).toBe(2500);
  });

  it("compte une facture échue non réglée dans les encaissements attendus et en retard", () => {
    const result = calculateTreasury({
      transactions: [],
      invoices: [
        { amount: "4000", status: "En Retard", dueDate: "2026-08-20", paidAt: null },
        { amount: "1000", status: "Envoyee", dueDate: "2026-09-25", paidAt: null },
        { amount: "9999", status: "Payee", dueDate: "2026-09-01", paidAt: "2026-09-02" },
        { amount: "5555", status: "Brouillon", dueDate: "2026-09-20", paidAt: null },
      ],
      expenses: [],
      now,
    });
    expect(result.overdueInflows).toBe(4000);
    expect(result.expectedInflows).toBe(5000);
  });

  it("projette les charges récurrentes sur l’horizon retenu", () => {
    const result = calculateTreasury({
      transactions: [],
      invoices: [],
      expenses: [
        { amount: "600", expenseDate: "2026-09-01", isRecurring: true },
        { amount: "300", expenseDate: "2026-09-20", isRecurring: false },
        { amount: "900", expenseDate: "2026-06-01", isRecurring: false },
      ],
      horizonDays: 60,
      now,
    });
    // 600 € par mois sur 60 jours, plus la dépense ponctuelle du 20 septembre.
    expect(result.monthlyRecurring).toBe(600);
    expect(result.expectedOutflows).toBe(1500);
  });

  it("calcule un solde projeté cohérent", () => {
    const result = calculateTreasury({
      transactions: [{ amount: "5000", type: "Credit", transactionDate: "2026-09-01" }],
      invoices: [{ amount: "2000", status: "Envoyee", dueDate: "2026-09-20", paidAt: null }],
      expenses: [{ amount: "1000", expenseDate: "2026-09-01", isRecurring: true }],
      horizonDays: 30,
      now,
    });
    expect(result.projectedBalance).toBe(6000);
  });
});

describe("dépenses par catégorie", () => {
  it("agrège, isole le récurrent et calcule les parts", () => {
    const result = summarizeExpensesByCategory([
      { amount: "1000", category: "Hebergement", isRecurring: true },
      { amount: "500", category: "Hebergement", isRecurring: false },
      { amount: "500", category: "Marketing", isRecurring: false },
    ]);
    expect(result[0]).toMatchObject({ category: "Hebergement", total: 1500, recurring: 1000, count: 2, share: 75 });
    expect(result[1]).toMatchObject({ category: "Marketing", total: 500, share: 25 });
  });

  it("classe les dépenses sans catégorie en Autre", () => {
    const result = summarizeExpensesByCategory([{ amount: "200", category: null, isRecurring: false }]);
    expect(result[0].category).toBe("Autre");
  });
});

describe("rapprochement bancaire", () => {
  const invoices = [
    { id: 1, invoiceNumber: "FAC-001", amount: "1200.00", paidAt: "2026-09-10", organizationName: "CHU Lille" },
    { id: 2, invoiceNumber: "FAC-002", amount: "800.00", paidAt: "2026-09-10", organizationName: "Clinique Sud" },
  ];
  const expenses = [
    { id: 5, label: "Hébergement HDS", amount: "1200.00", expenseDate: "2026-09-09" },
  ];

  it("propose la facture correspondante pour un encaissement", () => {
    const result = suggestReconciliation(
      { amount: "1200", type: "Credit", transactionDate: "2026-09-12" },
      invoices,
      expenses
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: "invoice", id: 1, dayGap: 2 });
  });

  it("propose la dépense correspondante pour un décaissement", () => {
    const result = suggestReconciliation(
      { amount: "1200", type: "Debit", transactionDate: "2026-09-12" },
      invoices,
      expenses
    );
    expect(result[0]).toMatchObject({ kind: "expense", id: 5 });
  });

  it("écarte les montants différents et les dates trop éloignées", () => {
    expect(
      suggestReconciliation({ amount: "1201", type: "Credit", transactionDate: "2026-09-12" }, invoices, expenses)
    ).toHaveLength(0);
    expect(
      suggestReconciliation({ amount: "1200", type: "Credit", transactionDate: "2026-12-31" }, invoices, expenses)
    ).toHaveLength(0);
  });

  it("mesure l’avancement du rapprochement", () => {
    const result = reconciliationProgress([
      { isReconciled: true, amount: "100" },
      { isReconciled: false, amount: "250" },
      { isReconciled: false, amount: "-50" },
    ]);
    expect(result).toMatchObject({ total: 3, reconciled: 1, pending: 2, pendingAmount: 300 });
    expect(result.rate).toBeCloseTo(33.33, 1);
  });
});

describe("réconciliation du revenu récurrent", () => {
  it("calcule le MRR et l’écart avec les encaissements réels", () => {
    const result = reconcileRecurringRevenue(
      [
        { seatsPurchased: 10, pricePerSeat: "50", billingCycle: "Mensuel", status: "Actif" },
        { seatsPurchased: 12, pricePerSeat: "600", billingCycle: "Annuel", status: "Actif" },
        { seatsPurchased: 5, pricePerSeat: "100", billingCycle: "Mensuel", status: "Resilie" },
      ],
      1000
    );
    expect(result.mrr).toBe(1100);
    expect(result.arr).toBe(13200);
    expect(result.gap).toBe(-100);
  });

  it("ne divise pas par zéro en l’absence d’abonnement", () => {
    expect(reconcileRecurringRevenue([], 500)).toMatchObject({ mrr: 0, arr: 0, coverageRate: 0 });
  });
});

describe("export FEC", () => {
  const input = {
    invoices: [
      { id: 1, invoiceNumber: "FAC-001", amount: "1200.00", status: "Payee", issuedAt: "2026-09-01", organizationName: "CHU de Lille", organizationId: 3 },
      { id: 2, invoiceNumber: "FAC-002", amount: "500.00", status: "Brouillon", issuedAt: "2026-09-02", organizationName: "Clinique Sud", organizationId: 4 },
    ],
    expenses: [
      { id: 9, label: "Hébergement HDS", amount: "800.00", category: "Hebergement", expenseDate: "2026-09-03", supplierName: "OVH", supplierId: 2 },
    ],
  };

  it("formate les dates et montants selon la norme", () => {
    expect(fecDate("2026-09-03")).toBe("20260903");
    expect(fecAmount(1200)).toBe("1200,00");
    expect(fecDate(null)).toBe("");
  });

  it("exclut les brouillons et produit deux lignes équilibrées par pièce", () => {
    const lines = buildFecLines(input);
    // 1 facture retenue + 1 dépense = 2 pièces = 4 lignes.
    expect(lines).toHaveLength(4);
    expect(lines.some(line => line.PieceRef === "FAC-002")).toBe(false);
    const balance = checkFecBalance(lines);
    expect(balance.balanced).toBe(true);
    expect(balance.debit).toBe(2000);
    expect(balance.credit).toBe(2000);
  });

  it("affecte le compte de charge correspondant à la catégorie", () => {
    const lines = buildFecLines(input);
    const charge = lines.find(line => line.JournalCode === "AC" && line.Debit !== "0,00");
    expect(charge?.CompteNum).toBe("613500");
  });

  it("sérialise un fichier tabulé avec en-tête normalisé", () => {
    const content = serializeFec(buildFecLines(input));
    const rows = content.split("\r\n");
    expect(rows[0].split("\t")).toHaveLength(18);
    expect(rows[0].startsWith("JournalCode\tJournalLib")).toBe(true);
    expect(rows).toHaveLength(5);
    // Aucune tabulation parasite ne doit décaler les colonnes.
    rows.forEach(row => expect(row.split("\t")).toHaveLength(18));
  });
});
