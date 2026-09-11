export type HealthLabel = "Bon" | "A Surveiller" | "A Risque";

export type CustomerHealthInput = {
  seatsPurchased: number;
  activeSeats: number;
  documentsLast30: number;
  documentsPrevious30: number;
  openTickets: number;
  urgentTickets: number;
  onboardingProgress: number;
  accountAgeDays: number;
};

export type CustomerHealthResult = {
  score: number;
  label: HealthLabel;
  usageRate: number;
  seatActivationRate: number;
  usageTrend: number;
  reasons: string[];
};

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function daysBetween(from: Date | string, to: Date | string) {
  const start = typeof from === "string" ? new Date(`${from}T00:00:00Z`) : from;
  const end = typeof to === "string" ? new Date(`${to}T00:00:00Z`) : to;
  return Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
}

export function calculateCustomerHealth(input: CustomerHealthInput): CustomerHealthResult {
  const seatsPurchased = Math.max(input.seatsPurchased, 1);
  const activeSeats = Math.max(input.activeSeats, 0);
  const expectedMonthlyDocuments = Math.max(activeSeats * 20, 20);
  const usageRate = clamp((input.documentsLast30 / expectedMonthlyDocuments) * 100);
  const seatActivationRate = clamp((activeSeats / seatsPurchased) * 100);
  const usageTrend = input.documentsPrevious30 > 0
    ? ((input.documentsLast30 - input.documentsPrevious30) / input.documentsPrevious30) * 100
    : input.documentsLast30 > 0 ? 100 : 0;

  const usagePoints = usageRate * 0.4;
  const adoptionPoints = seatActivationRate * 0.2;
  const supportPoints = clamp(100 - input.openTickets * 16 - input.urgentTickets * 24) * 0.2;
  const onboardingPoints = clamp(input.onboardingProgress) * 0.1;
  const tenurePoints = clamp((input.accountAgeDays / 180) * 100) * 0.1;
  const score = Math.round(clamp(usagePoints + adoptionPoints + supportPoints + onboardingPoints + tenurePoints));
  const label: HealthLabel = score >= 70 ? "Bon" : score >= 45 ? "A Surveiller" : "A Risque";

  const reasons: string[] = [];
  if (seatActivationRate < 60) reasons.push("Moins de 60 % des sièges sont actifs");
  if (usageRate < 40) reasons.push("Usage inférieur à 40 % du niveau attendu");
  if (usageTrend < -25) reasons.push("Usage en baisse de plus de 25 %");
  if (input.urgentTickets > 0) reasons.push("Ticket urgent ouvert");
  else if (input.openTickets >= 2) reasons.push("Plusieurs tickets sont encore ouverts");
  if (input.onboardingProgress < 100) reasons.push("Onboarding incomplet");
  if (!reasons.length) reasons.push("Adoption et usage satisfaisants");

  return {
    score,
    label,
    usageRate: Math.round(usageRate),
    seatActivationRate: Math.round(seatActivationRate),
    usageTrend: Math.round(usageTrend),
    reasons,
  };
}

export function calculateCustomerSuccessMetrics(customers: Array<{
  subscriptionStatus: string | null;
  billingCycle: string | null;
  seatsPurchased: number;
  activeSeats: number;
  pricePerSeat: number;
  documentsLast30: number;
  healthLabel: HealthLabel;
  onboardingProgress: number;
  daysUntilRenewal: number | null;
}>) {
  const active = customers.filter(customer => customer.subscriptionStatus === "Actif");
  const cancelled = customers.filter(customer => customer.subscriptionStatus === "Resilie");
  const mrr = active.reduce((total, customer) => {
    const recurringValue = customer.seatsPurchased * customer.pricePerSeat;
    return total + (customer.billingCycle === "Annuel" ? recurringValue / 12 : recurringValue);
  }, 0);
  const seatsPurchased = active.reduce((total, customer) => total + customer.seatsPurchased, 0);
  const activeSeats = active.reduce((total, customer) => total + customer.activeSeats, 0);
  const renewingSoon = active.filter(customer => customer.daysUntilRenewal !== null && customer.daysUntilRenewal >= 0 && customer.daysUntilRenewal <= 90).length;
  return {
    activeCustomers: active.length,
    mrr: Math.round(mrr),
    arr: Math.round(mrr * 12),
    seatsPurchased,
    activeSeats,
    seatActivationRate: seatsPurchased ? Math.round((activeSeats / seatsPurchased) * 100) : 0,
    documentsLast30: active.reduce((total, customer) => total + customer.documentsLast30, 0),
    atRiskCustomers: active.filter(customer => customer.healthLabel === "A Risque").length,
    monitoredCustomers: active.filter(customer => customer.healthLabel === "A Surveiller").length,
    incompleteOnboarding: active.filter(customer => customer.onboardingProgress < 100).length,
    renewingSoon,
    churnRate: active.length + cancelled.length ? Math.round((cancelled.length / (active.length + cancelled.length)) * 1000) / 10 : 0,
  };
}

export function buildCustomerAlertCandidates(customer: {
  organizationId: number;
  organizationName: string;
  subscriptionId: number | null;
  renewalDate: string | null;
  daysUntilRenewal: number | null;
  documentsLast30: number;
  healthLabel: HealthLabel;
  healthScore: number;
  onboardingProgress: number;
}) {
  const alerts: Array<{
    organizationId: number;
    subscriptionId: number | null;
    type: "Renouvellement" | "Sous Utilisation" | "Onboarding Bloque" | "Compte A Risque";
    severity: "Info" | "Attention" | "Critique";
    title: string;
    message: string;
    dueDate: string | null;
    dedupeKey: string;
  }> = [];

  if (customer.subscriptionId && customer.renewalDate && customer.daysUntilRenewal !== null && customer.daysUntilRenewal >= 0 && customer.daysUntilRenewal <= 90) {
    const horizon = customer.daysUntilRenewal <= 30 ? "30j" : customer.daysUntilRenewal <= 60 ? "60j" : "90j";
    alerts.push({
      organizationId: customer.organizationId,
      subscriptionId: customer.subscriptionId,
      type: "Renouvellement",
      severity: customer.daysUntilRenewal <= 30 ? "Critique" : "Attention",
      title: `Renouvellement à préparer — ${customer.organizationName}`,
      message: `Le contrat arrive à échéance dans ${customer.daysUntilRenewal} jour${customer.daysUntilRenewal > 1 ? "s" : ""}.`,
      dueDate: customer.renewalDate,
      dedupeKey: `renewal:${customer.subscriptionId}:${customer.renewalDate}:${horizon}`,
    });
  }

  if (customer.documentsLast30 < 20) {
    alerts.push({
      organizationId: customer.organizationId,
      subscriptionId: customer.subscriptionId,
      type: "Sous Utilisation",
      severity: customer.documentsLast30 === 0 ? "Critique" : "Attention",
      title: `Sous-utilisation — ${customer.organizationName}`,
      message: `${customer.documentsLast30} écrit${customer.documentsLast30 > 1 ? "s" : ""} généré${customer.documentsLast30 > 1 ? "s" : ""} sur les 30 derniers jours.`,
      dueDate: null,
      dedupeKey: `usage:${customer.organizationId}:${new Date().toISOString().slice(0, 7)}`,
    });
  }

  if (customer.onboardingProgress < 100) {
    alerts.push({
      organizationId: customer.organizationId,
      subscriptionId: customer.subscriptionId,
      type: "Onboarding Bloque",
      severity: customer.onboardingProgress === 0 ? "Critique" : "Attention",
      title: `Onboarding incomplet — ${customer.organizationName}`,
      message: `La checklist d’onboarding est complétée à ${customer.onboardingProgress} %.`,
      dueDate: null,
      dedupeKey: `onboarding:${customer.organizationId}:${customer.onboardingProgress}`,
    });
  }

  if (customer.healthLabel === "A Risque") {
    alerts.push({
      organizationId: customer.organizationId,
      subscriptionId: customer.subscriptionId,
      type: "Compte A Risque",
      severity: "Critique",
      title: `Compte à risque — ${customer.organizationName}`,
      message: `Le score de santé est descendu à ${customer.healthScore}/100.`,
      dueDate: null,
      dedupeKey: `risk:${customer.organizationId}:${new Date().toISOString().slice(0, 7)}`,
    });
  }
  return alerts;
}
