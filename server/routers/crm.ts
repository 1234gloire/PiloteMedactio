import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

const organizationTypes = ["Hopital Public", "Clinique Privee", "Groupement Hospitalier", "Cabinet Liberal"] as const;
const organizationStatuses = ["Prospect", "En Demo", "Negociation", "Client Actif", "Inactif"] as const;
const leadSources = ["Site Web", "Salon Professionnel", "Recommandation", "Prospection a Froid", "LinkedIn", "Reseau AGAPE", "Autre"] as const;
const dealStages = ["Prospection", "Rendez-vous Place", "Demo Effectuee", "Devis Envoye", "Gagne", "Perdu"] as const;
const interactionTypes = ["Appel", "Email", "Reunion", "Note"] as const;

async function profileFor(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) {
  return db.ensureInternalProfile(ctx.user);
}

async function requireCrmWrite(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) {
  const profile = await profileFor(ctx);
  if (!["admin", "commercial"].includes(profile.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle dispose d’un accès en lecture seule au CRM." });
  }
  return profile;
}

const organizationInput = z.object({
  name: z.string().trim().min(2).max(240),
  type: z.enum(organizationTypes),
  address: z.string().trim().max(1000).optional().nullable(),
  city: z.string().trim().max(160).optional().nullable(),
  postalCode: z.string().trim().max(16).optional().nullable(),
  status: z.enum(organizationStatuses).default("Prospect"),
  leadSource: z.enum(leadSources).default("Autre"),
  annualContractValue: z.coerce.number().min(0).default(0),
});

const contactInput = z.object({
  organizationId: z.number().int().positive().optional().nullable(),
  fullName: z.string().trim().min(2).max(200),
  email: z.string().email().max(320),
  phone: z.string().trim().max(40).optional().nullable(),
  specialty: z.string().trim().max(160).optional().nullable(),
  jobTitle: z.string().trim().max(200).optional().nullable(),
});

const dealInput = z.object({
  organizationId: z.number().int().positive(),
  assignedTo: z.number().int().positive().optional().nullable(),
  title: z.string().trim().min(2).max(240),
  amount: z.coerce.number().min(0),
  stage: z.enum(dealStages).default("Prospection"),
  expectedCloseDate: z.string().date().optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  lossReason: z.string().trim().max(2000).optional().nullable(),
});

export const crmRouter = router({
  profile: protectedProcedure.query(({ ctx }) => profileFor(ctx)),
  users: protectedProcedure.query(() => db.listInternalUsers()),
  dashboard: protectedProcedure.query(() => db.getCommercialDashboard()),

  organizations: router({
    list: protectedProcedure
      .input(z.object({ search: z.string().optional(), status: z.string().optional() }).optional())
      .query(({ input }) => db.listOrganizations(input)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => db.getOrganization(input.id)),
    create: protectedProcedure.input(organizationInput).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      return db.createOrganization({ ...input, annualContractValue: String(input.annualContractValue) });
    }),
    update: protectedProcedure.input(organizationInput.partial().extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      const { id, annualContractValue, ...data } = input;
      return db.updateOrganization(id, { ...data, ...(annualContractValue !== undefined ? { annualContractValue: String(annualContractValue) } : {}) });
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      return db.deleteOrganization(input.id);
    }),
  }),

  contacts: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional(), organizationId: z.number().optional() }).optional()).query(({ input }) => db.listContacts(input)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => db.getContact(input.id)),
    create: protectedProcedure.input(contactInput).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      return db.createContact(input);
    }),
    update: protectedProcedure.input(contactInput.partial().extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      const { id, ...data } = input;
      return db.updateContact(id, data);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      return db.deleteContact(input.id);
    }),
  }),

  deals: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional(), stage: z.string().optional() }).optional()).query(({ input }) => db.listDeals(input)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => db.getDeal(input.id)),
    create: protectedProcedure.input(dealInput).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      return db.createDeal({ ...input, amount: String(input.amount) });
    }),
    update: protectedProcedure.input(dealInput.partial().extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      const { id, amount, ...data } = input;
      return db.updateDeal(id, { ...data, ...(amount !== undefined ? { amount: String(amount) } : {}) });
    }),
    move: protectedProcedure.input(z.object({ id: z.number().int().positive(), stage: z.enum(dealStages) })).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      return db.updateDeal(input.id, { stage: input.stage });
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      return db.deleteDeal(input.id);
    }),
  }),

  interactions: router({
    create: protectedProcedure.input(z.object({
      dealId: z.number().int().positive(),
      contactId: z.number().int().positive().optional().nullable(),
      type: z.enum(interactionTypes),
      content: z.string().trim().min(2).max(5000),
    })).mutation(async ({ ctx, input }) => {
      const profile = await requireCrmWrite(ctx);
      return db.createInteraction({ ...input, createdBy: profile.id });
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      return db.deleteInteraction(input.id);
    }),
  }),

  quotes: router({
    create: protectedProcedure.input(z.object({
      dealId: z.number().int().positive(),
      amount: z.coerce.number().min(0),
      validUntil: z.string().date().optional().nullable(),
    })).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      const quoteNumber = `DEV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
      return db.createQuote({ ...input, amount: String(input.amount), quoteNumber });
    }),
    updateStatus: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      status: z.enum(["Brouillon", "Envoye", "Vu", "Signe", "Expire", "Refuse"]),
    })).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      return db.updateQuote(input.id, {
        status: input.status,
        ...(input.status === "Envoye" ? { sentAt: new Date() } : {}),
        ...(input.status === "Signe" ? { signedAt: new Date() } : {}),
      });
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      return db.deleteQuote(input.id);
    }),
  }),

  followUps: router({
    create: protectedProcedure.input(z.object({
      dealId: z.number().int().positive(),
      type: z.enum(["Devis sans reponse", "RDV a confirmer", "Relance commerciale", "Autre"]),
      dueAt: z.coerce.date(),
      note: z.string().trim().max(2000).optional().nullable(),
    })).mutation(async ({ ctx, input }) => {
      const profile = await requireCrmWrite(ctx);
      return db.createFollowUp({ ...input, assignedTo: profile.id });
    }),
    complete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      return db.updateFollowUp(input.id, { status: "Effectuee" });
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireCrmWrite(ctx);
      return db.deleteFollowUp(input.id);
    }),
  }),
});
