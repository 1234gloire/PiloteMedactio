export const STAGE_PROBABILITIES: Record<string, number> = {
  Prospection: 0.1,
  "Rendez-vous Place": 0.25,
  "Demo Effectuee": 0.5,
  "Devis Envoye": 0.75,
  Gagne: 1,
  Perdu: 0,
};

export const PIPELINE_STAGES = [
  "Prospection",
  "Rendez-vous Place",
  "Demo Effectuee",
  "Devis Envoye",
  "Gagne",
  "Perdu",
] as const;

type DealForMetrics = {
  amount: string | number;
  stage: string;
  createdAt: Date;
  closedAt?: Date | null;
  assignedTo?: number | null;
  ownerName?: string | null;
};

export function calculateCommercialMetrics(deals: DealForMetrics[]) {
  const openDeals = deals.filter(deal => !["Gagne", "Perdu"].includes(deal.stage));
  const wonDeals = deals.filter(deal => deal.stage === "Gagne");
  const lostDeals = deals.filter(deal => deal.stage === "Perdu");
  const closedDeals = [...wonDeals, ...lostDeals];
  const totalPipeline = openDeals.reduce((sum, deal) => sum + Number(deal.amount), 0);
  const weightedPipeline = openDeals.reduce(
    (sum, deal) => sum + Number(deal.amount) * (STAGE_PROBABILITIES[deal.stage] ?? 0),
    0
  );
  const conversionRate = closedDeals.length ? (wonDeals.length / closedDeals.length) * 100 : 0;
  const closedWithDates = closedDeals.filter(deal => deal.closedAt);
  const averageCycleDays = closedWithDates.length
    ? closedWithDates.reduce((sum, deal) => {
        const elapsed = deal.closedAt!.getTime() - deal.createdAt.getTime();
        return sum + Math.max(0, elapsed / 86_400_000);
      }, 0) / closedWithDates.length
    : 0;

  const byStage = PIPELINE_STAGES.map(stage => {
    const stageDeals = deals.filter(deal => deal.stage === stage);
    return {
      stage,
      count: stageDeals.length,
      amount: stageDeals.reduce((sum, deal) => sum + Number(deal.amount), 0),
      share: deals.length ? (stageDeals.length / deals.length) * 100 : 0,
    };
  });

  const owners = new Map<string, { name: string; won: number; amount: number; active: number }>();
  for (const deal of deals) {
    const key = deal.ownerName || "Non assigné";
    const owner = owners.get(key) || { name: key, won: 0, amount: 0, active: 0 };
    if (deal.stage === "Gagne") {
      owner.won += 1;
      owner.amount += Number(deal.amount);
    }
    if (!["Gagne", "Perdu"].includes(deal.stage)) owner.active += 1;
    owners.set(key, owner);
  }

  return {
    totalPipeline,
    weightedPipeline,
    wonRevenue: wonDeals.reduce((sum, deal) => sum + Number(deal.amount), 0),
    conversionRate,
    averageCycleDays,
    activeDeals: openDeals.length,
    byStage,
    leaderboard: Array.from(owners.values()).sort(
      (a, b) => b.amount - a.amount || b.won - a.won
    ),
  };
}
