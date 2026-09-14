import "dotenv/config";
import { eq } from "drizzle-orm";
import { contacts, contentCalendar, deals, internalUsers, marketingAssets, marketingCampaigns, marketingEvents, marketingLeads, organizations } from "../drizzle/schema";
import { requireDb } from "../server/db";
import { captureLead, createCampaign, createContent, createEvent, getCampaign, getMarketingDashboard, promoteLeadToDeal, uploadAsset } from "../server/marketing.db";

async function run() {
  const db = await requireDb();
  const author = (await db.select().from(internalUsers).limit(1))[0];
  if (!author) throw new Error("Aucun utilisateur interne disponible pour le test.");
  const stamp = Date.now();
  let campaignId = 0, contentId = 0, eventId = 0, leadId = 0, assetId = 0, dealId = 0, organizationId = 0, contactId = 0;
  try {
    campaignId = (await createCampaign({ name: `Smoke Marketing ${stamp}`, channel: "Webinaire", objective: "Vérification intégrée", budget: "1000", targetLeads: 10, attributedRevenue: "2500", status: "En Cours", startDate: "2026-09-01", endDate: "2026-10-31" })).id;
    contentId = (await createContent({ campaignId, title: `Contenu smoke ${stamp}`, contentType: "Newsletter", brief: "Test", publishDate: "2026-10-01", status: "Planifie" })).id;
    eventId = (await createEvent({ campaignId, title: `Webinaire smoke ${stamp}`, eventType: "Webinaire", scheduledAt: new Date("2026-10-02T10:00:00Z"), registrationCount: 5, attendeeCount: 4, meetingsBooked: 2, status: "Termine" })).id;
    const lead = await captureLead({ campaignId, fullName: "Lead Smoke", email: `lead-${stamp}@example.fr`, organizationName: `Organisation Smoke ${stamp}`, organizationType: "Cabinet Liberal", source: "Site Web", consentToContact: true });
    leadId = lead.id; organizationId = lead.organizationId!; contactId = lead.contactId!;
    const duplicate = await captureLead({ campaignId, fullName: "Lead Smoke", email: `lead-${stamp}@example.fr`, organizationName: `Organisation Smoke ${stamp}`, organizationType: "Cabinet Liberal", source: "Site Web", consentToContact: true });
    if (!duplicate.duplicate || duplicate.id !== leadId) throw new Error("La déduplication du formulaire public a échoué.");
    dealId = (await promoteLeadToDeal(leadId, { amount: "5000", expectedCloseDate: "2026-11-30" })).id;
    assetId = (await uploadAsset({ campaignId, title: `Support smoke ${stamp}`, assetType: "Argumentaire", description: "Test stockage", fileName: "smoke-marketing.txt", mimeType: "text/plain", base64: Buffer.from("Support Marketing Medactio").toString("base64") }, author.id)).id;
    const detail = await getCampaign(campaignId); const dashboard = await getMarketingDashboard();
    if (!detail || detail.leads.length !== 1 || detail.content.length !== 1 || detail.events.length !== 1 || detail.assets.length !== 1 || detail.deals.length !== 1) throw new Error("La fiche campagne ne consolide pas toutes les entités.");
    if (!dashboard.campaigns.some(item => item.id === campaignId)) throw new Error("La campagne smoke n’apparaît pas au dashboard.");
    console.log(`Smoke Marketing réussi : campagne ${campaignId}, lead ${leadId}, deal ${dealId}, support ${assetId}.`);
  } finally {
    if (assetId) await db.delete(marketingAssets).where(eq(marketingAssets.id, assetId));
    if (leadId) await db.delete(marketingLeads).where(eq(marketingLeads.id, leadId));
    if (dealId) await db.delete(deals).where(eq(deals.id, dealId));
    if (contentId) await db.delete(contentCalendar).where(eq(contentCalendar.id, contentId));
    if (eventId) await db.delete(marketingEvents).where(eq(marketingEvents.id, eventId));
    if (contactId) await db.delete(contacts).where(eq(contacts.id, contactId));
    if (organizationId) await db.delete(organizations).where(eq(organizations.id, organizationId));
    if (campaignId) await db.delete(marketingCampaigns).where(eq(marketingCampaigns.id, campaignId));
  }
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
