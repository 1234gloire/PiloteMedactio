import { STAGE_PROBABILITIES } from "./crm.logic";
import { ticketSlaState } from "./support.logic";

export type AnalyticsPeriod = "30d" | "90d" | "12m" | "all";

export type AnalyticsInput = {
  subscriptions: Array<{ organizationId: number; billingCycle: string; seatsPurchased: number; pricePerSeat: string | number; status: string; startDate: string | null; cancelledAt: string | null }>;
  organizations: Array<{ id: number; status: string; healthScore: string; createdAt: Date }>;
  usage: Array<{ documentsGeneratedCount: number; aiRequestsCount: number; logDate: string }>;
  deals: Array<{ id: number; organizationId: number; amount: string | number; stage: string; createdAt: Date; closedAt: Date | null; ownerName: string | null }>;
  campaigns: Array<{ id: number; budget: string | number; attributedRevenue?: string | number; leadsGenerated: number; status: string; startDate: string | null; ownerName: string | null }>;
  tickets: Array<{ id: number; status: string; priority: string; createdAt: Date; slaDueAt: Date | null; resolvedAt: Date | null; ownerName: string | null }>;
  invoices: Array<{ amount: string | number; status: string; issuedAt: string | null; dueDate: string | null; paidAt: string | null }>;
  now?: Date;
  period?: AnalyticsPeriod;
  grossMargin?: number;
};

const dayMs = 86_400_000;
const monthNames = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const asDate = (value: Date | string | null | undefined) => value instanceof Date ? value : value ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value) : null;
const round = (value: number, precision = 0) => Number(value.toFixed(precision));
const recurringMonthlyValue = (subscription: AnalyticsInput["subscriptions"][number]) => subscription.seatsPurchased * Number(subscription.pricePerSeat) / (subscription.billingCycle === "Annuel" ? 12 : 1);

export function periodStart(period: AnalyticsPeriod, now = new Date()) {
  if (period === "all") return new Date(0);
  const days = period === "30d" ? 30 : period === "90d" ? 90 : 365;
  return new Date(now.getTime() - days * dayMs);
}

function activeDuringMonth(subscription: AnalyticsInput["subscriptions"][number], monthStart: Date, monthEnd: Date) {
  const started = asDate(subscription.startDate);
  const cancelled = asDate(subscription.cancelledAt);
  return (!started || started <= monthEnd) && (!cancelled || cancelled >= monthStart) && subscription.status !== "Essai";
}

function percentageChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return round(((current - previous) / previous) * 100, 1);
}

export function calculateAnalytics(input: AnalyticsInput) {
  const now = input.now || new Date();
  const period = input.period || "12m";
  const start = periodStart(period, now);
  const grossMargin = input.grossMargin ?? 0.8;
  const activeSubscriptions = input.subscriptions.filter(item => item.status === "Actif");
  const cancelledInPeriod = input.subscriptions.filter(item => item.status === "Resilie" && asDate(item.cancelledAt) && asDate(item.cancelledAt)! >= start);
  const activeCustomerIds = new Set(activeSubscriptions.map(item => item.organizationId));
  const mrr = activeSubscriptions.reduce((sum, item) => sum + recurringMonthlyValue(item), 0);
  const churnRate = activeSubscriptions.length + cancelledInPeriod.length ? cancelledInPeriod.length / (activeSubscriptions.length + cancelledInPeriod.length) * 100 : 0;
  const annualizedChurn = period === "30d" ? churnRate * 12 : period === "90d" ? churnRate * 4 : churnRate;
  const monthlyChurnDecimal = annualizedChurn > 0 ? annualizedChurn / 100 / 12 : 0;
  const arpc = activeCustomerIds.size ? mrr / activeCustomerIds.size : 0;

  const campaignsInPeriod = input.campaigns.filter(item => !item.startDate || asDate(item.startDate)! >= start);
  const marketingSpend = campaignsInPeriod.reduce((sum, item) => sum + Number(item.budget), 0);
  const marketingRevenue = campaignsInPeriod.reduce((sum, item) => sum + Number(item.attributedRevenue || 0), 0);
  const wonDealsInPeriod = input.deals.filter(item => item.stage === "Gagne" && item.closedAt && item.closedAt >= start);
  const newCustomerIds = new Set(wonDealsInPeriod.map(item => item.organizationId));
  const cac = newCustomerIds.size ? marketingSpend / newCustomerIds.size : null;
  const ltv = monthlyChurnDecimal ? arpc * grossMargin / monthlyChurnDecimal : null;

  const usageInPeriod = input.usage.filter(item => asDate(item.logDate)! >= start);
  const last30Start = new Date(now.getTime() - 30 * dayMs);
  const previous30Start = new Date(now.getTime() - 60 * dayMs);
  const currentUsage = input.usage.filter(item => asDate(item.logDate)! >= last30Start);
  const previousUsage = input.usage.filter(item => asDate(item.logDate)! >= previous30Start && asDate(item.logDate)! < last30Start);
  const documents30 = currentUsage.reduce((sum, item) => sum + item.documentsGeneratedCount, 0);
  const previousDocuments30 = previousUsage.reduce((sum, item) => sum + item.documentsGeneratedCount, 0);
  const aiRequests30 = currentUsage.reduce((sum, item) => sum + item.aiRequestsCount, 0);
  const previousAiRequests30 = previousUsage.reduce((sum, item) => sum + item.aiRequestsCount, 0);

  const openDeals = input.deals.filter(item => !["Gagne", "Perdu"].includes(item.stage));
  const closedDealsInPeriod = input.deals.filter(item => ["Gagne", "Perdu"].includes(item.stage) && item.closedAt && item.closedAt >= start);
  const weightedPipeline = openDeals.reduce((sum, item) => sum + Number(item.amount) * (STAGE_PROBABILITIES[item.stage] ?? 0), 0);
  const totalPipeline = openDeals.reduce((sum, item) => sum + Number(item.amount), 0);
  const wonRevenue = wonDealsInPeriod.reduce((sum, item) => sum + Number(item.amount), 0);
  const conversionRate = closedDealsInPeriod.length ? wonDealsInPeriod.length / closedDealsInPeriod.length * 100 : 0;

  const outstandingInvoices = input.invoices.filter(item => ["Envoyee", "En Retard"].includes(item.status));
  const overdueInvoices = outstandingInvoices.filter(item => item.dueDate && asDate(item.dueDate)! < now);
  const paidInPeriod = input.invoices.filter(item => item.status === "Payee" && item.paidAt && asDate(item.paidAt)! >= start);
  const expectedCollections = outstandingInvoices.reduce((sum, item) => sum + Number(item.amount), 0);
  const overdueAmount = overdueInvoices.reduce((sum, item) => sum + Number(item.amount), 0);
  const collectedRevenue = paidInPeriod.reduce((sum, item) => sum + Number(item.amount), 0);

  const ticketsInPeriod = input.tickets.filter(item => item.createdAt >= start);
  const resolvedTickets = ticketsInPeriod.filter(item => item.status === "Resolu" && item.resolvedAt);
  const openTickets = input.tickets.filter(item => item.status !== "Resolu");
  const slaBreaches = openTickets.filter(item => ticketSlaState(item, now).overdue).length;
  const averageResolutionHours = resolvedTickets.length ? resolvedTickets.reduce((sum, item) => sum + (item.resolvedAt!.getTime() - item.createdAt.getTime()) / 3_600_000, 0) / resolvedTickets.length : 0;

  const commercialPerformance = aggregateByOwner(input.deals, item => item.ownerName, (rows, name) => ({
    name,
    primary: rows.filter(item => item.stage === "Gagne" && item.closedAt && item.closedAt >= start).length,
    primaryLabel: "deals gagnés",
    value: rows.filter(item => item.stage === "Gagne" && item.closedAt && item.closedAt >= start).reduce((sum, item) => sum + Number(item.amount), 0),
    valueLabel: "CA gagné",
    secondary: rows.filter(item => !["Gagne", "Perdu"].includes(item.stage)).length,
    secondaryLabel: "opportunités actives",
  }));
  const supportPerformance = aggregateByOwner(input.tickets, item => item.ownerName, (rows, name) => {
    const resolved = rows.filter(item => item.status === "Resolu" && item.resolvedAt && item.resolvedAt >= start);
    return { name, primary: resolved.length, primaryLabel: "tickets résolus", value: resolved.length ? round(resolved.reduce((sum, item) => sum + (item.resolvedAt!.getTime() - item.createdAt.getTime()) / 3_600_000, 0) / resolved.length, 1) : 0, valueLabel: "heures moyennes", secondary: rows.filter(item => item.status !== "Resolu").length, secondaryLabel: "tickets ouverts" };
  });
  const marketingPerformance = aggregateByOwner(input.campaigns, item => item.ownerName, (rows, name) => {
    const selected = rows.filter(item => !item.startDate || asDate(item.startDate)! >= start);
    return { name, primary: selected.length, primaryLabel: "campagnes menées", value: selected.reduce((sum, item) => sum + item.leadsGenerated, 0), valueLabel: "leads générés", secondary: selected.reduce((sum, item) => sum + Number(item.budget), 0), secondaryLabel: "budget engagé" };
  });

  const months = Array.from({ length: 12 }, (_, index) => {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + index, 1));
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 23, 59, 59));
    const monthUsage = input.usage.filter(item => { const date = asDate(item.logDate)!; return date >= monthStart && date <= monthEnd; });
    const monthDeals = input.deals.filter(item => item.stage === "Gagne" && item.closedAt && item.closedAt >= monthStart && item.closedAt <= monthEnd);
    const monthPaid = input.invoices.filter(item => item.status === "Payee" && item.paidAt && asDate(item.paidAt)! >= monthStart && asDate(item.paidAt)! <= monthEnd);
    return {
      key: monthStart.toISOString().slice(0, 7),
      label: `${monthNames[monthStart.getUTCMonth()]} ${String(monthStart.getUTCFullYear()).slice(-2)}`,
      mrr: round(input.subscriptions.filter(item => activeDuringMonth(item, monthStart, monthEnd)).reduce((sum, item) => sum + recurringMonthlyValue(item), 0)),
      documents: monthUsage.reduce((sum, item) => sum + item.documentsGeneratedCount, 0),
      aiRequests: monthUsage.reduce((sum, item) => sum + item.aiRequestsCount, 0),
      wonRevenue: monthDeals.reduce((sum, item) => sum + Number(item.amount), 0),
      collected: monthPaid.reduce((sum, item) => sum + Number(item.amount), 0),
    };
  });

  const atRiskCustomers = input.organizations.filter(item => activeCustomerIds.has(item.id) && item.healthScore === "A Risque").length;
  const monitoredCustomers = input.organizations.filter(item => activeCustomerIds.has(item.id) && item.healthScore === "A Surveiller").length;
  const activeCampaigns = input.campaigns.filter(item => item.status === "En Cours").length;
  const leadsGenerated = campaignsInPeriod.reduce((sum, item) => sum + item.leadsGenerated, 0);

  return {
    period,
    asOf: now,
    saas: { activeCustomers: activeCustomerIds.size, mrr: round(mrr), arr: round(mrr * 12), churnRate: round(annualizedChurn, 1), arpc: round(arpc), cac: cac === null ? null : round(cac), ltv: ltv === null ? null : round(ltv), grossMarginAssumption: grossMargin * 100, atRiskCustomers, monitoredCustomers },
    usage: { documents: usageInPeriod.reduce((sum, item) => sum + item.documentsGeneratedCount, 0), aiRequests: usageInPeriod.reduce((sum, item) => sum + item.aiRequestsCount, 0), documents30, aiRequests30, documentsTrend: percentageChange(documents30, previousDocuments30), aiRequestsTrend: percentageChange(aiRequests30, previousAiRequests30) },
    commercial: { totalPipeline: round(totalPipeline), weightedPipeline: round(weightedPipeline), wonRevenue: round(wonRevenue), conversionRate: round(conversionRate, 1), activeDeals: openDeals.length },
    cash: { expectedCollections: round(expectedCollections), overdueAmount: round(overdueAmount), collectedRevenue: round(collectedRevenue), outstandingInvoices: outstandingInvoices.length, overdueInvoices: overdueInvoices.length },
    support: { ticketsCreated: ticketsInPeriod.length, ticketsResolved: resolvedTickets.length, openTickets: openTickets.length, slaBreaches, averageResolutionHours: round(averageResolutionHours, 1), resolutionRate: ticketsInPeriod.length ? round(resolvedTickets.length / ticketsInPeriod.length * 100, 1) : 0 },
    marketing: { spend: round(marketingSpend), attributedRevenue: round(marketingRevenue), campaigns: campaignsInPeriod.length, activeCampaigns, leadsGenerated, costPerLead: leadsGenerated ? round(marketingSpend / leadsGenerated) : null, roi: marketingSpend ? round((marketingRevenue - marketingSpend) / marketingSpend * 100, 1) : null },
    performance: { commercial: commercialPerformance, support: supportPerformance, marketing: marketingPerformance },
    monthly: months,
  };
}

function aggregateByOwner<T, R>(rows: T[], getName: (item: T) => string | null, build: (rows: T[], name: string) => R): R[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const name = getName(row) || "Non assigné";
    groups.set(name, [...(groups.get(name) || []), row]);
  }
  return Array.from(groups.entries()).map(([name, values]) => build(values, name));
}

export function analyticsCsv(data: ReturnType<typeof calculateAnalytics>) {
  const rows: Array<Array<string | number | null>> = [
    ["MEDACTIO — RAPPORT DIRECTION", "Valeur", "Unité"],
    ["Date d'arrêté", data.asOf.toISOString(), "UTC"],
    ["Période", data.period, ""],
    ["MRR", data.saas.mrr, "EUR"], ["ARR", data.saas.arr, "EUR"], ["Clients actifs", data.saas.activeCustomers, "comptes"], ["Churn", data.saas.churnRate, "%"], ["CAC", data.saas.cac, "EUR"], ["LTV indicative", data.saas.ltv, "EUR"],
    ["Écrits générés", data.usage.documents, "écrits"], ["Requêtes IA", data.usage.aiRequests, "requêtes"],
    ["Pipeline total", data.commercial.totalPipeline, "EUR"], ["Pipeline pondéré", data.commercial.weightedPipeline, "EUR"], ["CA gagné", data.commercial.wonRevenue, "EUR"],
    ["Encaissements attendus", data.cash.expectedCollections, "EUR"], ["Montant en retard", data.cash.overdueAmount, "EUR"], ["Encaissements période", data.cash.collectedRevenue, "EUR"],
    ["Tickets ouverts", data.support.openTickets, "tickets"], ["SLA dépassés", data.support.slaBreaches, "tickets"], ["Temps moyen de résolution", data.support.averageResolutionHours, "heures"],
    ["Budget marketing", data.marketing.spend, "EUR"], ["Revenu attribué au marketing", data.marketing.attributedRevenue, "EUR"], ["ROI marketing", data.marketing.roi, "%"], ["Leads générés", data.marketing.leadsGenerated, "leads"],
    [], ["HISTORIQUE 12 MOIS", "MRR", "Écrits", "Requêtes IA", "CA gagné", "Encaissé"],
    ...data.monthly.map(month => [month.label, month.mrr, month.documents, month.aiRequests, month.wonRevenue, month.collected]),
  ];
  const escape = (value: string | number | null) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return `\uFEFF${rows.map(row => row.map(escape).join(";")).join("\n")}`;
}
