import { asc, eq } from "drizzle-orm";
import { deals, internalUsers, invoices, marketingCampaigns, marketingLeads, organizations, subscriptions, supportTickets, usageLogs } from "../drizzle/schema";
import { requireDb } from "./db";
import { AnalyticsPeriod, analyticsCsv, calculateAnalytics } from "./analytics.logic";

export async function getAnalytics(period: AnalyticsPeriod = "12m") {
  const db = await requireDb();
  const [subscriptionRows, organizationRows, usageRows, dealRows, campaignRows, ticketRows, invoiceRows, marketingLeadRows] = await Promise.all([
    db.select().from(subscriptions),
    db.select().from(organizations),
    db.select().from(usageLogs).orderBy(asc(usageLogs.logDate)),
    db.select({
      id: deals.id,
      organizationId: deals.organizationId,
      amount: deals.amount,
      stage: deals.stage,
      createdAt: deals.createdAt,
      closedAt: deals.closedAt,
      ownerName: internalUsers.fullName,
    }).from(deals).leftJoin(internalUsers, eq(deals.assignedTo, internalUsers.id)),
    db.select({
      id: marketingCampaigns.id,
      budget: marketingCampaigns.budget,
      attributedRevenue: marketingCampaigns.attributedRevenue,
      leadsGenerated: marketingCampaigns.leadsGenerated,
      status: marketingCampaigns.status,
      startDate: marketingCampaigns.startDate,
      ownerName: internalUsers.fullName,
    }).from(marketingCampaigns).leftJoin(internalUsers, eq(marketingCampaigns.ownerId, internalUsers.id)),
    db.select({
      id: supportTickets.id,
      status: supportTickets.status,
      priority: supportTickets.priority,
      createdAt: supportTickets.createdAt,
      slaDueAt: supportTickets.slaDueAt,
      resolvedAt: supportTickets.resolvedAt,
      ownerName: internalUsers.fullName,
    }).from(supportTickets).leftJoin(internalUsers, eq(supportTickets.assignedTo, internalUsers.id)),
    db.select().from(invoices),
    db.select({ campaignId: marketingLeads.campaignId }).from(marketingLeads),
  ]);
  const campaignsWithCapturedLeads = campaignRows.map(campaign => ({ ...campaign, leadsGenerated: marketingLeadRows.filter(lead => lead.campaignId === campaign.id).length }));
  return calculateAnalytics({ subscriptions: subscriptionRows, organizations: organizationRows, usage: usageRows, deals: dealRows, campaigns: campaignsWithCapturedLeads, tickets: ticketRows, invoices: invoiceRows, period });
}

export async function exportAnalyticsCsv(period: AnalyticsPeriod) {
  const data = await getAnalytics(period);
  return {
    filename: `medactio-direction-${new Date().toISOString().slice(0, 10)}.csv`,
    mimeType: "text/csv;charset=utf-8",
    contentBase64: Buffer.from(analyticsCsv(data), "utf8").toString("base64"),
  };
}
