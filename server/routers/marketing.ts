import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import * as marketingDb from "../marketing.db";

async function profileFor(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) { return db.ensureInternalProfile(ctx.user); }
async function requireMarketingRead(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) {
  const profile = await profileFor(ctx);
  if (!['admin', 'direction', 'marketing', 'commercial'].includes(profile.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle n’a pas accès au pôle Marketing." });
  return profile;
}
async function requireMarketingWrite(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) {
  const profile = await profileFor(ctx);
  if (!['admin', 'marketing'].includes(profile.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle dispose d’un accès en lecture seule au pôle Marketing." });
  return profile;
}

const nullableId = z.number().int().positive().optional().nullable();
const campaignInput = z.object({
  name: z.string().trim().min(3).max(240),
  channel: z.enum(["Email", "Reseaux Sociaux", "SEO-Contenu", "Salon Professionnel", "Webinaire", "Publicite Payante", "Autre"]),
  objective: z.string().trim().max(5000).optional().nullable(),
  budget: z.coerce.number().min(0), targetLeads: z.coerce.number().int().min(0), attributedRevenue: z.coerce.number().min(0),
  startDate: z.string().date().optional().nullable(), endDate: z.string().date().optional().nullable(),
  status: z.enum(["Planifiee", "En Cours", "Terminee"]), ownerId: nullableId,
});
const contentInput = z.object({
  campaignId: nullableId, title: z.string().trim().min(3).max(240),
  contentType: z.enum(["Article de Blog", "Post Reseau Social", "Newsletter", "Video", "Autre"]),
  brief: z.string().trim().max(5000).optional().nullable(), targetAudience: z.string().trim().max(240).optional().nullable(),
  draftContent: z.string().trim().max(20000).optional().nullable(), publishDate: z.string().date().optional().nullable(),
  publicationUrl: z.string().url().max(2000).optional().nullable().or(z.literal("")),
  status: z.enum(["Idee", "En Redaction", "Planifie", "Publie"]), assignedTo: nullableId,
});
const eventInput = z.object({
  campaignId: nullableId, title: z.string().trim().min(3).max(240),
  eventType: z.enum(["Webinaire", "Demo Collective", "Salon", "Atelier"]), scheduledAt: z.coerce.date(),
  registrationCount: z.coerce.number().int().min(0), attendeeCount: z.coerce.number().int().min(0), meetingsBooked: z.coerce.number().int().min(0),
  status: z.enum(["Planifie", "Termine", "Annule"]), meetingUrl: z.string().url().max(2000).optional().nullable().or(z.literal("")), notes: z.string().trim().max(5000).optional().nullable(),
});
const leadInput = z.object({
  campaignId: nullableId, fullName: z.string().trim().min(2).max(200), email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional().nullable(), jobTitle: z.string().trim().max(200).optional().nullable(),
  organizationName: z.string().trim().min(2).max(240), organizationType: z.enum(["Hopital Public", "Clinique Privee", "Groupement Hospitalier", "Cabinet Liberal"]),
  source: z.enum(["Site Web", "Import", "Evenement", "Manuel"]), consentToContact: z.boolean(), notes: z.string().trim().max(5000).optional().nullable(),
});

export const marketingRouter = router({
  profile: protectedProcedure.query(({ ctx }) => requireMarketingRead(ctx)),
  users: protectedProcedure.query(async ({ ctx }) => { await requireMarketingRead(ctx); return db.listInternalUsers(); }),
  dashboard: protectedProcedure.query(async ({ ctx }) => { await requireMarketingRead(ctx); return marketingDb.getMarketingDashboard(); }),
  campaigns: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional(), channel: z.string().optional(), status: z.string().optional() }).optional()).query(async ({ ctx, input }) => { await requireMarketingRead(ctx); return marketingDb.listCampaigns(input); }),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => { await requireMarketingRead(ctx); return marketingDb.getCampaign(input.id); }),
    create: protectedProcedure.input(campaignInput).mutation(async ({ ctx, input }) => { await requireMarketingWrite(ctx); return marketingDb.createCampaign({ ...input, budget: String(input.budget), attributedRevenue: String(input.attributedRevenue) }); }),
    update: protectedProcedure.input(campaignInput.partial().extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireMarketingWrite(ctx); const { id, budget, attributedRevenue, ...data } = input; return marketingDb.updateCampaign(id, { ...data, ...(budget !== undefined ? { budget: String(budget) } : {}), ...(attributedRevenue !== undefined ? { attributedRevenue: String(attributedRevenue) } : {}) }); }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireMarketingWrite(ctx); return marketingDb.deleteCampaign(input.id); }),
  }),
  content: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional(), status: z.string().optional(), type: z.string().optional(), campaignId: z.number().optional() }).optional()).query(async ({ ctx, input }) => { await requireMarketingRead(ctx); return marketingDb.listContent(input); }),
    create: protectedProcedure.input(contentInput).mutation(async ({ ctx, input }) => { await requireMarketingWrite(ctx); return marketingDb.createContent({ ...input, publicationUrl: input.publicationUrl || null }); }),
    update: protectedProcedure.input(contentInput.partial().extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireMarketingWrite(ctx); const { id, ...data } = input; return marketingDb.updateContent(id, { ...data, publicationUrl: data.publicationUrl || null }); }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireMarketingWrite(ctx); return marketingDb.deleteContent(input.id); }),
  }),
  leads: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional(), status: z.string().optional(), campaignId: z.number().optional() }).optional()).query(async ({ ctx, input }) => { await requireMarketingRead(ctx); return marketingDb.listLeads(input); }),
    create: protectedProcedure.input(leadInput).mutation(async ({ ctx, input }) => { await requireMarketingWrite(ctx); return marketingDb.captureLead(input); }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["Nouveau", "Qualifie", "RDV Planifie", "Converti", "Rejete"]), notes: z.string().trim().max(5000).optional().nullable() })).mutation(async ({ ctx, input }) => { await requireMarketingWrite(ctx); const { id, ...data } = input; return marketingDb.updateLead(id, data); }),
    promote: protectedProcedure.input(z.object({ id: z.number().int().positive(), assignedTo: nullableId, amount: z.coerce.number().min(0).default(0), expectedCloseDate: z.string().date().optional().nullable() })).mutation(async ({ ctx, input }) => { await requireMarketingWrite(ctx); return marketingDb.promoteLeadToDeal(input.id, { assignedTo: input.assignedTo, amount: String(input.amount), expectedCloseDate: input.expectedCloseDate }); }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireMarketingWrite(ctx); return marketingDb.deleteLead(input.id); }),
  }),
  events: router({
    list: protectedProcedure.input(z.object({ campaignId: z.number().optional(), status: z.string().optional() }).optional()).query(async ({ ctx, input }) => { await requireMarketingRead(ctx); return marketingDb.listEvents(input); }),
    create: protectedProcedure.input(eventInput).mutation(async ({ ctx, input }) => { await requireMarketingWrite(ctx); return marketingDb.createEvent({ ...input, meetingUrl: input.meetingUrl || null }); }),
    update: protectedProcedure.input(eventInput.partial().extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireMarketingWrite(ctx); const { id, ...data } = input; return marketingDb.updateEvent(id, { ...data, meetingUrl: data.meetingUrl || null }); }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireMarketingWrite(ctx); return marketingDb.deleteEvent(input.id); }),
  }),
  assets: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional(), type: z.string().optional(), campaignId: z.number().optional() }).optional()).query(async ({ ctx, input }) => { await requireMarketingRead(ctx); return marketingDb.listAssets(input); }),
    upload: protectedProcedure.input(z.object({ campaignId: nullableId, title: z.string().trim().min(3).max(240), assetType: z.enum(["Plaquette", "Argumentaire", "Etude de Cas", "Presentation", "Visuel", "Autre"]), description: z.string().trim().max(5000).optional().nullable(), fileName: z.string().min(1).max(240), mimeType: z.string().min(1).max(160), base64: z.string().min(1).max(14_000_000) })).mutation(async ({ ctx, input }) => { const profile = await requireMarketingWrite(ctx); return marketingDb.uploadAsset(input, profile.id); }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireMarketingWrite(ctx); return marketingDb.deleteAsset(input.id); }),
  }),
});
