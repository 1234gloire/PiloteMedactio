import { describe, expect, it } from "vitest";
import { analyticsCsv, calculateAnalytics } from "./analytics.logic";

const now = new Date("2026-09-12T12:00:00Z");
const data = calculateAnalytics({
  now,
  period: "12m",
  subscriptions: [
    { organizationId: 1, billingCycle: "Mensuel", seatsPurchased: 10, pricePerSeat: 100, status: "Actif", startDate: "2026-01-01", cancelledAt: null },
    { organizationId: 2, billingCycle: "Annuel", seatsPurchased: 5, pricePerSeat: 240, status: "Actif", startDate: "2026-03-01", cancelledAt: null },
    { organizationId: 3, billingCycle: "Annuel", seatsPurchased: 1, pricePerSeat: 1200, status: "Resilie", startDate: "2025-10-01", cancelledAt: "2026-07-01" },
  ],
  organizations: [
    { id: 1, status: "Client Actif", healthScore: "Bon", createdAt: now },
    { id: 2, status: "Client Actif", healthScore: "A Risque", createdAt: now },
    { id: 3, status: "Inactif", healthScore: "A Surveiller", createdAt: now },
  ],
  usage: [
    { documentsGeneratedCount: 100, aiRequestsCount: 150, logDate: "2026-09-05" },
    { documentsGeneratedCount: 50, aiRequestsCount: 70, logDate: "2026-08-01" },
  ],
  deals: [
    { id: 1, organizationId: 1, amount: 50000, stage: "Gagne", createdAt: new Date("2026-01-01"), closedAt: new Date("2026-06-01"), ownerName: "Alice" },
    { id: 2, organizationId: 2, amount: 10000, stage: "Prospection", createdAt: now, closedAt: null, ownerName: "Alice" },
    { id: 3, organizationId: 3, amount: 20000, stage: "Devis Envoye", createdAt: now, closedAt: null, ownerName: "Bruno" },
  ],
  campaigns: [{ id: 1, budget: 2000, leadsGenerated: 20, status: "Terminee", startDate: "2026-02-01", ownerName: "Chloé" }],
  tickets: [
    { id: 1, status: "Nouveau", priority: "Urgente", createdAt: new Date("2026-09-12T06:00:00Z"), slaDueAt: new Date("2026-09-12T10:00:00Z"), resolvedAt: null, ownerName: "Émilie" },
    { id: 2, status: "Resolu", priority: "Moyenne", createdAt: new Date("2026-09-10T08:00:00Z"), slaDueAt: new Date("2026-09-11T08:00:00Z"), resolvedAt: new Date("2026-09-10T18:00:00Z"), ownerName: "Émilie" },
  ],
  invoices: [
    { amount: 10000, status: "Envoyee", issuedAt: "2026-09-01", dueDate: "2026-09-30", paidAt: null },
    { amount: 5000, status: "En Retard", issuedAt: "2026-08-01", dueDate: "2026-08-31", paidAt: null },
    { amount: 3000, status: "Payee", issuedAt: "2026-09-01", dueDate: "2026-09-10", paidAt: "2026-09-09" },
  ],
});

describe("analytics Direction", () => {
  it("calcule les KPI SaaS avec annualisation explicite", () => {
    expect(data.saas).toMatchObject({ activeCustomers: 2, mrr: 1100, arr: 13200, churnRate: 33.3, cac: 2000, ltv: 15840, atRiskCustomers: 1 });
  });
  it("consolide usages, pipeline, cash et support", () => {
    expect(data.usage).toMatchObject({ documents30: 100, aiRequests30: 150, documentsTrend: 100 });
    expect(data.commercial).toMatchObject({ totalPipeline: 30000, weightedPipeline: 16000, wonRevenue: 50000 });
    expect(data.cash).toMatchObject({ expectedCollections: 15000, overdueAmount: 5000, collectedRevenue: 3000 });
    expect(data.support).toMatchObject({ ticketsCreated: 2, ticketsResolved: 1, slaBreaches: 1, averageResolutionHours: 10, resolutionRate: 50 });
  });
  it("produit un historique de douze mois et un CSV français", () => {
    expect(data.monthly).toHaveLength(12);
    const csv = analyticsCsv(data);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"MRR";"1100";"EUR"');
    expect(csv).toContain('"HISTORIQUE 12 MOIS"');
  });
});
