import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import * as emailDb from "../email.db";
import { knowledgeCategories } from "../../drizzle/schema";
import { isMailConfigured } from "../_core/mailer";

type Ctx = { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> };

/**
 * Écrire à un client engage l'image de Medactio : la rédaction est réservée
 * aux rôles en relation avec les établissements. Le marketing, le commercial,
 * le secrétariat et la finance écrivent chacun dans leur domaine.
 */
const WRITERS = ["admin", "direction", "commercial", "marketing", "secretariat", "finance"];

async function requireWriter(ctx: Ctx) {
  const profile = await db.ensureInternalProfile(ctx.user);
  if (!WRITERS.includes(profile.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle ne permet pas d’écrire aux établissements." });
  }
  return profile;
}

// Les modèles suivent le classement des procédures, pour éviter deux
// taxonomies concurrentes.
const categories = knowledgeCategories;

const recipientInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("contact"), id: z.number().int().positive() }),
  z.object({ kind: z.literal("lead"), id: z.number().int().positive() }),
  z.object({ kind: z.literal("organization"), id: z.number().int().positive() }),
]);

export const emailRouter = router({
  /** Permet à l'interface de masquer la rédaction si l'envoi est indisponible. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const profile = await db.ensureInternalProfile(ctx.user);
    return { configured: isMailConfigured(), canWrite: WRITERS.includes(profile.role), from: profile.email };
  }),

  templates: router({
    list: protectedProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(({ input }) => emailDb.listTemplates(input?.category)),

    create: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(2).max(160),
        category: z.enum(categories).default("INT"),
        subject: z.string().trim().min(2).max(240),
        body: z.string().trim().min(10).max(20_000),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireWriter(ctx);
        return emailDb.createTemplate({ ...input, createdBy: profile.id });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(2).max(160).optional(),
        category: z.enum(categories).optional(),
        subject: z.string().trim().min(2).max(240).optional(),
        body: z.string().trim().min(10).max(20_000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await requireWriter(ctx);
        const { id, ...rest } = input;
        return emailDb.updateTemplate(id, rest);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await requireWriter(ctx);
        return emailDb.deleteTemplate(input.id);
      }),
  }),

  /** Destinataires possibles pour un établissement ou une opportunité. */
  recipients: protectedProcedure
    .input(z.object({
      organizationId: z.number().int().positive().optional(),
      dealId: z.number().int().positive().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await db.ensureInternalProfile(ctx.user);
      if (input.dealId) return emailDb.dealRecipients(input.dealId);
      if (input.organizationId) return emailDb.listOrganizationContacts(input.organizationId);
      return [];
    }),

  send: protectedProcedure
    .input(z.object({
      recipient: recipientInput,
      subject: z.string().trim().min(2).max(240),
      body: z.string().trim().min(5).max(20_000),
      dealId: z.number().int().positive().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const profile = await requireWriter(ctx);
      const result = await emailDb.composeAndSend(
        { recipient: input.recipient, subject: input.subject, body: input.body, dealId: input.dealId ?? null },
        profile
      );
      if (!result.sent) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.reason ?? "Le message n’a pas pu être envoyé." });
      }
      return result;
    }),

  recent: protectedProcedure.query(async ({ ctx }) => {
    await db.ensureInternalProfile(ctx.user);
    return emailDb.recentSentEmails();
  }),
});
