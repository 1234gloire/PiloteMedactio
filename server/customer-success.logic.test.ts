import { describe, expect, it } from "vitest";
import { buildCustomerAlertCandidates, calculateCustomerHealth, calculateCustomerSuccessMetrics } from "./customer-success.logic";

describe("calculateCustomerHealth", () => {
  it("classe un compte adopté et actif en bonne santé", () => {
    const result = calculateCustomerHealth({ seatsPurchased: 10, activeSeats: 9, documentsLast30: 220, documentsPrevious30: 180, openTickets: 0, urgentTickets: 0, onboardingProgress: 100, accountAgeDays: 240 });
    expect(result.label).toBe("Bon");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.seatActivationRate).toBe(90);
    expect(result.usageTrend).toBe(22);
  });

  it("signale un compte sous-utilisé avec ticket urgent et onboarding incomplet", () => {
    const result = calculateCustomerHealth({ seatsPurchased: 20, activeSeats: 2, documentsLast30: 3, documentsPrevious30: 40, openTickets: 2, urgentTickets: 1, onboardingProgress: 33, accountAgeDays: 45 });
    expect(result.label).toBe("A Risque");
    expect(result.reasons).toContain("Ticket urgent ouvert");
    expect(result.reasons).toContain("Usage en baisse de plus de 25 %");
  });
});

describe("calculateCustomerSuccessMetrics", () => {
  it("normalise les abonnements annuels en MRR et calcule le churn", () => {
    const result = calculateCustomerSuccessMetrics([
      { subscriptionStatus: "Actif", billingCycle: "Annuel", seatsPurchased: 12, activeSeats: 9, pricePerSeat: 1200, documentsLast30: 200, healthLabel: "Bon", onboardingProgress: 100, daysUntilRenewal: 30 },
      { subscriptionStatus: "Actif", billingCycle: "Mensuel", seatsPurchased: 5, activeSeats: 2, pricePerSeat: 100, documentsLast30: 20, healthLabel: "A Surveiller", onboardingProgress: 66, daysUntilRenewal: 120 },
      { subscriptionStatus: "Resilie", billingCycle: "Annuel", seatsPurchased: 4, activeSeats: 0, pricePerSeat: 900, documentsLast30: 0, healthLabel: "A Risque", onboardingProgress: 100, daysUntilRenewal: null },
    ]);
    expect(result.mrr).toBe(1700);
    expect(result.arr).toBe(20400);
    expect(result.seatActivationRate).toBe(65);
    expect(result.renewingSoon).toBe(1);
    expect(result.churnRate).toBe(33.3);
  });
});

describe("buildCustomerAlertCandidates", () => {
  it("génère des clés idempotentes pour renouvellement, sous-usage et risque", () => {
    const alerts = buildCustomerAlertCandidates({ organizationId: 4, organizationName: "CH Test", subscriptionId: 9, renewalDate: "2026-10-01", daysUntilRenewal: 20, documentsLast30: 0, healthLabel: "A Risque", healthScore: 24, onboardingProgress: 33 });
    expect(alerts.map(alert => alert.type)).toEqual(["Renouvellement", "Sous Utilisation", "Onboarding Bloque", "Compte A Risque"]);
    expect(new Set(alerts.map(alert => alert.dedupeKey)).size).toBe(4);
    expect(alerts[0]?.severity).toBe("Critique");
  });
});
