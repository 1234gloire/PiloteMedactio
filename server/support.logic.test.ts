import { describe, expect, it } from "vitest";
import { buildSupportAlertCandidates, calculateSupportMetrics, computeSlaDueAt, ticketSlaState } from "./support.logic";

const now = new Date("2026-09-12T12:00:00.000Z");

describe("logique Secrétariat & Support", () => {
  it("calcule le SLA selon la priorité", () => {
    const createdAt = new Date("2026-09-12T08:00:00.000Z");
    expect(computeSlaDueAt(createdAt, "Urgente").toISOString()).toBe("2026-09-12T12:00:00.000Z");
    expect(computeSlaDueAt(createdAt, "Basse").toISOString()).toBe("2026-09-14T08:00:00.000Z");
    expect(ticketSlaState({ status: "Nouveau", createdAt, slaDueAt: new Date("2026-09-12T10:00:00.000Z") }, now).overdue).toBe(true);
  });

  it("agrège les indicateurs opérationnels et financiers", () => {
    const metrics = calculateSupportMetrics({
      tickets: [
        { status: "Nouveau", priority: "Urgente", createdAt: new Date("2026-09-12T06:00:00Z"), slaDueAt: new Date("2026-09-12T10:00:00Z"), resolvedAt: null },
        { status: "Resolu", priority: "Moyenne", createdAt: new Date("2026-09-10T08:00:00Z"), slaDueAt: new Date("2026-09-11T08:00:00Z"), resolvedAt: new Date("2026-09-10T18:00:00Z") },
      ],
      tasks: [{ status: "A Faire", dueDate: "2026-09-11" }, { status: "Fait", dueDate: "2026-09-10" }],
      invoices: [{ status: "En Retard", amount: "1200", dueDate: "2026-09-01", createdAt: now, paidAt: null }],
      contracts: [{ status: "Actif", endDate: "2026-10-10" }],
      events: [{ startAt: new Date("2026-09-15T10:00:00Z") }],
      now,
    });
    expect(metrics).toMatchObject({ openTickets: 1, urgentTickets: 1, slaBreaches: 1, averageResolutionHours: 10, pendingTasks: 1, overdueTasks: 1, outstandingInvoices: 1, overdueInvoiceAmount: 1200, contractsToRenew: 1, eventsNext7Days: 1 });
  });

  it("génère une alerte pour chaque risque à traiter", () => {
    const alerts = buildSupportAlertCandidates({
      tickets: [{ id: 1, title: "Incident urgent", status: "Nouveau", priority: "Urgente", createdAt: new Date("2026-09-12T06:00:00Z"), slaDueAt: new Date("2026-09-12T10:00:00Z") }],
      tasks: [{ id: 2, title: "Convention", status: "A Faire", dueDate: "2026-09-11" }],
      invoices: [{ id: 3, invoiceNumber: "FAC-1", status: "Envoyee", amount: "800", dueDate: "2026-09-01" }],
      contracts: [{ id: 4, title: "Contrat cadre", status: "Actif", endDate: "2026-10-01" }],
      events: [{ id: 5, title: "Point client", startAt: new Date("2026-09-13T08:00:00Z") }],
      now,
    });
    expect(alerts).toHaveLength(5);
    expect(new Set(alerts.map(alert => alert.entityType))).toEqual(new Set(["Ticket", "Tache", "Facture", "Contrat", "Evenement"]));
    expect(alerts.every(alert => alert.dedupeKey.length > 5)).toBe(true);
  });
});
