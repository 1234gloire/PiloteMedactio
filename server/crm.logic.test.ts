import { describe, expect, it } from "vitest";
import { calculateCommercialMetrics } from "./crm.logic";

describe("calculateCommercialMetrics", () => {
  it("calcule le pipeline pondéré, la conversion et le cycle moyen", () => {
    const deals = [
      { amount: "10000", stage: "Prospection", createdAt: new Date("2026-01-01"), ownerName: "Sophie" },
      { amount: "20000", stage: "Devis Envoye", createdAt: new Date("2026-01-10"), ownerName: "Sophie" },
      { amount: "30000", stage: "Gagne", createdAt: new Date("2026-01-01"), closedAt: new Date("2026-01-31"), ownerName: "Thomas" },
      { amount: "15000", stage: "Perdu", createdAt: new Date("2026-02-01"), closedAt: new Date("2026-02-21"), ownerName: "Thomas" },
    ];

    const result = calculateCommercialMetrics(deals);

    expect(result.totalPipeline).toBe(30000);
    expect(result.weightedPipeline).toBe(16000);
    expect(result.wonRevenue).toBe(30000);
    expect(result.conversionRate).toBe(50);
    expect(result.averageCycleDays).toBe(25);
    expect(result.activeDeals).toBe(2);
    expect(result.leaderboard[0]).toMatchObject({ name: "Thomas", won: 1, amount: 30000 });
  });

  it("retourne des valeurs stables lorsque le pipeline est vide", () => {
    const result = calculateCommercialMetrics([]);
    expect(result.totalPipeline).toBe(0);
    expect(result.weightedPipeline).toBe(0);
    expect(result.conversionRate).toBe(0);
    expect(result.averageCycleDays).toBe(0);
    expect(result.byStage).toHaveLength(6);
  });
});
