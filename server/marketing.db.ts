import { and, asc, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import {
  contacts,
  contentCalendar,
  deals,
  internalUsers,
  marketingAssets,
  marketingCampaigns,
  marketingEvents,
  marketingLeads,
  organizations,
} from "../drizzle/schema";
import { requireDb } from "./db";
import { calculateMarketingMetrics } from "./marketing.logic";
import { storagePut, storageUrlFor } from "./storage";

export type LeadCaptureInput = {
  campaignId?: number | null;
  fullName: string;
  email: string;
  phone?: string | null;
  jobTitle?: string | null;
  organizationName: string;
  organizationType: typeof organizations.type.enumValues[number];
  source?: typeof marketingLeads.source.enumValues[number];
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  consentToContact: boolean;
  notes?: string | null;
};

async function campaignRows() {
  const db = await requireDb();
  return db.select({
    id: marketingCampaigns.id,
    name: marketingCampaigns.name,
    channel: marketingCampaigns.channel,
    objective: marketingCampaigns.objective,
    budget: marketingCampaigns.budget,
    targetLeads: marketingCampaigns.targetLeads,
    attributedRevenue: marketingCampaigns.attributedRevenue,
    startDate: marketingCampaigns.startDate,
    endDate: marketingCampaigns.endDate,
    status: marketingCampaigns.status,
    ownerId: marketingCampaigns.ownerId,
    ownerName: internalUsers.fullName,
    leadsGenerated: marketingCampaigns.leadsGenerated,
    createdAt: marketingCampaigns.createdAt,
  }).from(marketingCampaigns)
    .leftJoin(internalUsers, eq(marketingCampaigns.ownerId, internalUsers.id))
    .orderBy(desc(marketingCampaigns.startDate), asc(marketingCampaigns.name));
}

export async function getMarketingDashboard() {
  const db = await requireDb();
  const [campaigns, leads, events, content] = await Promise.all([
    campaignRows(),
    db.select().from(marketingLeads).orderBy(desc(marketingLeads.createdAt)),
    db.select().from(marketingEvents).orderBy(asc(marketingEvents.scheduledAt)),
    db.select().from(contentCalendar).orderBy(asc(contentCalendar.publishDate)),
  ]);
  const metrics = calculateMarketingMetrics({ campaigns, leads, events, content });
  const now = new Date();
  return {
    ...metrics,
    recentLeads: leads.slice(0, 6),
    upcomingEvents: events.filter(event => event.scheduledAt >= now && event.status === "Planifie").slice(0, 5),
    upcomingContent: content.filter(item => item.publishDate && new Date(`${item.publishDate}T23:59:59Z`) >= now && item.status !== "Publie").slice(0, 6),
  };
}

export async function listCampaigns(input?: { search?: string; channel?: string; status?: string }) {
  const db = await requireDb();
  const [campaigns, leads, events, content] = await Promise.all([
    campaignRows(),
    db.select().from(marketingLeads),
    db.select().from(marketingEvents),
    db.select().from(contentCalendar),
  ]);
  const metrics = calculateMarketingMetrics({ campaigns, leads, events, content }).campaigns;
  const search = input?.search?.trim().toLowerCase();
  return metrics.filter(campaign =>
    (!search || [campaign.name, campaign.objective || "", campaign.ownerName || ""].some(value => value.toLowerCase().includes(search)))
    && (!input?.channel || input.channel === "Tous" || campaign.channel === input.channel)
    && (!input?.status || input.status === "Tous" || campaign.status === input.status)
  );
}

export async function getCampaign(id: number) {
  const db = await requireDb();
  const campaigns = await campaignRows();
  const campaign = campaigns.find(item => item.id === id);
  if (!campaign) return null;
  const [leadRows, eventRows, contentRows, assetRows, dealRows] = await Promise.all([
    listLeads({ campaignId: id }),
    listEvents({ campaignId: id }),
    listContent({ campaignId: id }),
    listAssets({ campaignId: id }),
    db.select({ id: deals.id, title: deals.title, stage: deals.stage, amount: deals.amount, organizationName: organizations.name })
      .from(deals).leftJoin(organizations, eq(deals.organizationId, organizations.id)).where(eq(deals.campaignId, id)).orderBy(desc(deals.createdAt)),
  ]);
  const metric = calculateMarketingMetrics({ campaigns: [campaign], leads: leadRows, events: eventRows, content: contentRows }).campaigns[0];
  return { campaign: metric, leads: leadRows, events: eventRows, content: contentRows, assets: assetRows, deals: dealRows };
}

export async function createCampaign(data: typeof marketingCampaigns.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(marketingCampaigns).values(data).returning({ id: marketingCampaigns.id });
  return { id: result[0].id };
}
export async function updateCampaign(id: number, data: Partial<typeof marketingCampaigns.$inferInsert>) { const db = await requireDb(); await db.update(marketingCampaigns).set(data).where(eq(marketingCampaigns.id, id)); return { success: true } as const; }
export async function deleteCampaign(id: number) { const db = await requireDb(); await db.delete(marketingCampaigns).where(eq(marketingCampaigns.id, id)); return { success: true } as const; }

export async function listContent(input?: { search?: string; status?: string; type?: string; campaignId?: number }) {
  const db = await requireDb();
  const rows = await db.select({
    id: contentCalendar.id, campaignId: contentCalendar.campaignId, campaignName: marketingCampaigns.name,
    title: contentCalendar.title, contentType: contentCalendar.contentType, brief: contentCalendar.brief,
    targetAudience: contentCalendar.targetAudience, draftContent: contentCalendar.draftContent,
    publishDate: contentCalendar.publishDate, publicationUrl: contentCalendar.publicationUrl,
    status: contentCalendar.status, assignedTo: contentCalendar.assignedTo, assignedName: internalUsers.fullName,
    createdAt: contentCalendar.createdAt, updatedAt: contentCalendar.updatedAt,
  }).from(contentCalendar)
    .leftJoin(marketingCampaigns, eq(contentCalendar.campaignId, marketingCampaigns.id))
    .leftJoin(internalUsers, eq(contentCalendar.assignedTo, internalUsers.id))
    .orderBy(asc(contentCalendar.publishDate), desc(contentCalendar.updatedAt));
  const search = input?.search?.trim().toLowerCase();
  return rows.filter(item =>
    (!search || [item.title, item.brief || "", item.campaignName || ""].some(value => value.toLowerCase().includes(search)))
    && (!input?.status || input.status === "Tous" || item.status === input.status)
    && (!input?.type || input.type === "Tous" || item.contentType === input.type)
    && (!input?.campaignId || item.campaignId === input.campaignId)
  );
}
export async function createContent(data: typeof contentCalendar.$inferInsert) { const db = await requireDb(); const result = await db.insert(contentCalendar).values(data).returning({ id: contentCalendar.id }); return { id: result[0].id }; }
export async function updateContent(id: number, data: Partial<typeof contentCalendar.$inferInsert>) { const db = await requireDb(); await db.update(contentCalendar).set(data).where(eq(contentCalendar.id, id)); return { success: true } as const; }
export async function deleteContent(id: number) { const db = await requireDb(); await db.delete(contentCalendar).where(eq(contentCalendar.id, id)); return { success: true } as const; }

export async function listLeads(input?: { search?: string; status?: string; campaignId?: number }) {
  const db = await requireDb();
  const rows = await db.select({
    id: marketingLeads.id, campaignId: marketingLeads.campaignId, campaignName: marketingCampaigns.name,
    organizationId: marketingLeads.organizationId, contactId: marketingLeads.contactId, dealId: marketingLeads.dealId,
    fullName: marketingLeads.fullName, email: marketingLeads.email, phone: marketingLeads.phone, jobTitle: marketingLeads.jobTitle,
    organizationName: marketingLeads.organizationName, organizationType: marketingLeads.organizationType,
    status: marketingLeads.status, source: marketingLeads.source, utmSource: marketingLeads.utmSource,
    utmMedium: marketingLeads.utmMedium, utmCampaign: marketingLeads.utmCampaign,
    consentToContact: marketingLeads.consentToContact, notes: marketingLeads.notes,
    qualifiedAt: marketingLeads.qualifiedAt, convertedAt: marketingLeads.convertedAt,
    createdAt: marketingLeads.createdAt, updatedAt: marketingLeads.updatedAt,
  }).from(marketingLeads)
    .leftJoin(marketingCampaigns, eq(marketingLeads.campaignId, marketingCampaigns.id))
    .orderBy(desc(marketingLeads.createdAt));
  const search = input?.search?.trim().toLowerCase();
  return rows.filter(item =>
    (!search || [item.fullName, item.email, item.organizationName, item.campaignName || ""].some(value => value.toLowerCase().includes(search)))
    && (!input?.status || input.status === "Tous" || item.status === input.status)
    && (!input?.campaignId || item.campaignId === input.campaignId)
  );
}

export async function captureLead(input: LeadCaptureInput) {
  const db = await requireDb();
  let campaignId = input.campaignId ?? null;
  if (!campaignId && input.utmCampaign) {
    const campaign = (await db.select({ id: marketingCampaigns.id }).from(marketingCampaigns).where(eq(marketingCampaigns.name, input.utmCampaign)).limit(1))[0];
    campaignId = campaign?.id ?? null;
  }
  const duplicateConditions = [eq(marketingLeads.email, input.email.toLowerCase())];
  duplicateConditions.push(campaignId ? eq(marketingLeads.campaignId, campaignId) : isNull(marketingLeads.campaignId));
  const duplicate = (await db.select().from(marketingLeads).where(and(...duplicateConditions)).limit(1))[0];
  if (duplicate) return { id: duplicate.id, duplicate: true, organizationId: duplicate.organizationId, contactId: duplicate.contactId };

  let organization = (await db.select().from(organizations).where(eq(organizations.name, input.organizationName)).limit(1))[0];
  if (!organization) {
    organization = (await db.insert(organizations).values({ name: input.organizationName, type: input.organizationType, status: "Prospect", leadSource: "Site Web" }).returning())[0];
  }
  let contact = (await db.select().from(contacts).where(eq(contacts.email, input.email.toLowerCase())).limit(1))[0];
  if (!contact) {
    contact = (await db.insert(contacts).values({ organizationId: organization.id, fullName: input.fullName, email: input.email.toLowerCase(), phone: input.phone, jobTitle: input.jobTitle }).returning())[0];
  }
  const result = await db.insert(marketingLeads).values({ ...input, email: input.email.toLowerCase(), campaignId, organizationId: organization.id, contactId: contact.id, source: input.source ?? "Site Web" }).returning({ id: marketingLeads.id });
  const id = result[0].id;
  if (campaignId) await db.update(marketingCampaigns).set({ leadsGenerated: sql`${marketingCampaigns.leadsGenerated} + 1` }).where(eq(marketingCampaigns.id, campaignId));
  return { id, duplicate: false, organizationId: organization.id, contactId: contact.id };
}

export async function updateLead(id: number, data: Partial<typeof marketingLeads.$inferInsert>) {
  const db = await requireDb();
  const timestamps = data.status === "Converti" ? { convertedAt: new Date(), qualifiedAt: new Date() }
    : ["Qualifie", "RDV Planifie"].includes(data.status || "") ? { qualifiedAt: new Date() } : {};
  await db.update(marketingLeads).set({ ...data, ...timestamps }).where(eq(marketingLeads.id, id));
  return { success: true } as const;
}

export async function promoteLeadToDeal(id: number, input: { assignedTo?: number | null; amount?: string; expectedCloseDate?: string | null }) {
  const db = await requireDb();
  const lead = (await db.select().from(marketingLeads).where(eq(marketingLeads.id, id)).limit(1))[0];
  if (!lead?.organizationId) throw new Error("Lead ou organisation introuvable");
  if (lead.dealId) return { id: lead.dealId, existing: true };
  const result = await db.insert(deals).values({
    organizationId: lead.organizationId, assignedTo: input.assignedTo ?? null, campaignId: lead.campaignId,
    title: `Opportunité — ${lead.organizationName}`, amount: input.amount ?? "0", stage: "Rendez-vous Place",
    expectedCloseDate: input.expectedCloseDate ?? null, notes: `Créée depuis le lead marketing ${lead.fullName} (${lead.email}).`,
  }).returning({ id: deals.id });
  const dealId = result[0].id;
  await db.update(marketingLeads).set({ dealId, status: "RDV Planifie", qualifiedAt: new Date() }).where(eq(marketingLeads.id, id));
  return { id: dealId, existing: false };
}
export async function deleteLead(id: number) { const db = await requireDb(); await db.delete(marketingLeads).where(eq(marketingLeads.id, id)); return { success: true } as const; }

export async function listEvents(input?: { campaignId?: number; status?: string }) {
  const db = await requireDb();
  const rows = await db.select({
    id: marketingEvents.id, campaignId: marketingEvents.campaignId, campaignName: marketingCampaigns.name,
    title: marketingEvents.title, eventType: marketingEvents.eventType, scheduledAt: marketingEvents.scheduledAt,
    registrationCount: marketingEvents.registrationCount, attendeeCount: marketingEvents.attendeeCount,
    meetingsBooked: marketingEvents.meetingsBooked, status: marketingEvents.status, meetingUrl: marketingEvents.meetingUrl,
    notes: marketingEvents.notes, createdAt: marketingEvents.createdAt, updatedAt: marketingEvents.updatedAt,
  }).from(marketingEvents).leftJoin(marketingCampaigns, eq(marketingEvents.campaignId, marketingCampaigns.id)).orderBy(asc(marketingEvents.scheduledAt));
  return rows.filter(item => (!input?.campaignId || item.campaignId === input.campaignId) && (!input?.status || input.status === "Tous" || item.status === input.status));
}
export async function createEvent(data: typeof marketingEvents.$inferInsert) { const db = await requireDb(); const result = await db.insert(marketingEvents).values(data).returning({ id: marketingEvents.id }); return { id: result[0].id }; }
export async function updateEvent(id: number, data: Partial<typeof marketingEvents.$inferInsert>) { const db = await requireDb(); await db.update(marketingEvents).set(data).where(eq(marketingEvents.id, id)); return { success: true } as const; }
export async function deleteEvent(id: number) { const db = await requireDb(); await db.delete(marketingEvents).where(eq(marketingEvents.id, id)); return { success: true } as const; }

export async function listAssets(input?: { search?: string; type?: string; campaignId?: number }) {
  const db = await requireDb();
  const rows = await db.select({
    id: marketingAssets.id, campaignId: marketingAssets.campaignId, campaignName: marketingCampaigns.name,
    title: marketingAssets.title, assetType: marketingAssets.assetType, description: marketingAssets.description,
    storageKey: marketingAssets.storageKey, fileUrl: marketingAssets.fileUrl, fileName: marketingAssets.fileName,
    mimeType: marketingAssets.mimeType, sizeBytes: marketingAssets.sizeBytes, createdBy: marketingAssets.createdBy,
    createdByName: internalUsers.fullName, createdAt: marketingAssets.createdAt, updatedAt: marketingAssets.updatedAt,
  }).from(marketingAssets)
    .leftJoin(marketingCampaigns, eq(marketingAssets.campaignId, marketingCampaigns.id))
    .leftJoin(internalUsers, eq(marketingAssets.createdBy, internalUsers.id))
    .orderBy(desc(marketingAssets.createdAt));
  const search = input?.search?.trim().toLowerCase();
  const filtered = rows.filter(item =>
    (!search || [item.title, item.fileName, item.description || ""].some(value => value.toLowerCase().includes(search)))
    && (!input?.type || input.type === "Tous" || item.assetType === input.type)
    && (!input?.campaignId || item.campaignId === input.campaignId)
  );
  // L'URL de téléchargement est signée à chaque lecture : rien de permanent
  // n'est exposé, et le lien expire au bout d'une heure.
  return Promise.all(
    filtered.map(async item => ({ ...item, fileUrl: (await storageUrlFor(item.storageKey)) ?? item.fileUrl }))
  );
}

export async function uploadAsset(data: { campaignId?: number | null; title: string; assetType: typeof marketingAssets.assetType.enumValues[number]; description?: string | null; fileName: string; mimeType: string; base64: string }, userId: number) {
  const db = await requireDb();
  const content = data.base64.replace(/^data:[^;]+;base64,/, "");
  const bytes = Buffer.from(content, "base64");
  if (bytes.length > 10 * 1024 * 1024) throw new Error("Le support dépasse la limite de 10 Mo.");
  const safeName = data.fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const uploaded = await storagePut(`marketing/assets/${data.campaignId || "shared"}/${safeName}`, bytes, data.mimeType || "application/octet-stream");
  const result = await db.insert(marketingAssets).values({ campaignId: data.campaignId ?? null, title: data.title, assetType: data.assetType, description: data.description, storageKey: uploaded.key, fileUrl: uploaded.url, fileName: data.fileName, mimeType: data.mimeType, sizeBytes: bytes.length, createdBy: userId }).returning({ id: marketingAssets.id });
  return { id: result[0].id, ...uploaded };
}
export async function deleteAsset(id: number) { const db = await requireDb(); await db.delete(marketingAssets).where(eq(marketingAssets.id, id)); return { success: true } as const; }
