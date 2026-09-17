import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import * as gov from "../governance.db";

type Ctx = { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> };

async function profileFor(ctx: Ctx) {
  return db.ensureInternalProfile(ctx.user);
}

/**
 * Juridique, Roadmap, Fournisseurs et Changelog n'ont pas de rôle dédié : leur
 * écriture est réservée à l'administration et à la direction, conformément au
 * cahier des charges.
 */
async function requireGovernanceWrite(ctx: Ctx, pole: string) {
  const profile = await profileFor(ctx);
  if (!["admin", "direction"].includes(profile.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: `Votre rôle dispose d’un accès en lecture seule au pôle ${pole}.` });
  }
  return profile;
}

/** Les documents juridiques restent réservés à l'administration et à la direction. */
async function requireLegalRead(ctx: Ctx) {
  const profile = await profileFor(ctx);
  if (!["admin", "direction"].includes(profile.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle n’a pas accès au pôle Juridique & Conformité." });
  }
  return profile;
}

/** Les fournisseurs intéressent aussi la finance, qui en porte les dépenses. */
async function requireSupplierRead(ctx: Ctx) {
  const profile = await profileFor(ctx);
  if (!["admin", "direction", "finance"].includes(profile.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle n’a pas accès au pôle Fournisseurs & Partenaires." });
  }
  return profile;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");
const nullableId = z.number().int().positive().optional().nullable();
const id = z.object({ id: z.number().int().positive() });

export const governanceRouter = router({
  profile: protectedProcedure.query(({ ctx }) => profileFor(ctx)),

  access: protectedProcedure.query(async ({ ctx }) => {
    const profile = await profileFor(ctx);
    const governance = ["admin", "direction"].includes(profile.role);
    return {
      role: profile.role,
      legal: governance,
      suppliers: governance || profile.role === "finance",
      hrAdmin: governance,
      product: true,
      knowledge: true,
    };
  }),

  /* ---------------- Juridique & Conformité ---------------- */
  legal: router({
    list: protectedProcedure
      .input(z.object({ search: z.string().optional(), type: z.string().optional(), organizationId: z.number().optional() }).optional())
      .query(async ({ ctx, input }) => {
        await requireLegalRead(ctx);
        return gov.listLegalDocuments(input);
      }),

    create: protectedProcedure
      .input(z.object({
        organizationId: nullableId,
        title: z.string().trim().min(2).max(240),
        type: z.enum(["CGU", "CGV", "DPA RGPD", "Contrat Fournisseur", "Certificat HDS", "Statuts", "Autre"]),
        version: z.string().trim().max(60).optional().nullable(),
        effectiveDate: isoDate.optional().nullable(),
        expiryDate: isoDate.optional().nullable(),
        notes: z.string().trim().max(5000).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireGovernanceWrite(ctx, "Juridique & Conformité");
        return gov.createLegalDocument(input, profile.id);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        organizationId: nullableId,
        title: z.string().trim().min(2).max(240).optional(),
        type: z.enum(["CGU", "CGV", "DPA RGPD", "Contrat Fournisseur", "Certificat HDS", "Statuts", "Autre"]).optional(),
        version: z.string().trim().max(60).optional().nullable(),
        effectiveDate: isoDate.optional().nullable(),
        expiryDate: isoDate.optional().nullable(),
        notes: z.string().trim().max(5000).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireGovernanceWrite(ctx, "Juridique & Conformité");
        const { id: documentId, ...rest } = input;
        return gov.updateLegalDocument(documentId, rest, profile.id);
      }),

    upload: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        fileName: z.string().min(1).max(240),
        mimeType: z.string().min(1).max(160),
        base64: z.string().min(1).max(14_000_000),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireGovernanceWrite(ctx, "Juridique & Conformité");
        const { id: documentId, ...file } = input;
        return gov.uploadLegalDocumentFile(documentId, file, profile.id);
      }),

    delete: protectedProcedure.input(id).mutation(async ({ ctx, input }) => {
      const profile = await requireGovernanceWrite(ctx, "Juridique & Conformité");
      return gov.deleteLegalDocument(input.id, profile.id);
    }),

    schedule: protectedProcedure.query(async ({ ctx }) => {
      await requireLegalRead(ctx);
      return gov.getDeadlineSchedule();
    }),
  }),

  /* ---------------- Fournisseurs & Partenaires ---------------- */
  suppliers: router({
    list: protectedProcedure
      .input(z.object({ search: z.string().optional(), category: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        await requireSupplierRead(ctx);
        return gov.listSuppliersDetailed(input);
      }),

    get: protectedProcedure.input(id).query(async ({ ctx, input }) => {
      await requireSupplierRead(ctx);
      return gov.getSupplier(input.id);
    }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(2).max(240),
        category: z.enum(["Hebergement", "Outil SaaS Interne", "Partenaire Commercial", "Autre"]),
        contactName: z.string().trim().max(200).optional().nullable(),
        contactEmail: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
        annualCost: z.number().nonnegative().max(100_000_000).default(0),
        contractRenewalDate: isoDate.optional().nullable(),
        notes: z.string().trim().max(5000).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireGovernanceWrite(ctx, "Fournisseurs & Partenaires");
        return gov.createSupplier({ ...input, annualCost: input.annualCost.toFixed(2), contactEmail: input.contactEmail || null }, profile.id);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(2).max(240).optional(),
        category: z.enum(["Hebergement", "Outil SaaS Interne", "Partenaire Commercial", "Autre"]).optional(),
        contactName: z.string().trim().max(200).optional().nullable(),
        contactEmail: z.string().trim().email().max(320).optional().nullable().or(z.literal("")),
        annualCost: z.number().nonnegative().max(100_000_000).optional(),
        contractRenewalDate: isoDate.optional().nullable(),
        notes: z.string().trim().max(5000).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireGovernanceWrite(ctx, "Fournisseurs & Partenaires");
        const { id: supplierId, annualCost, contactEmail, ...rest } = input;
        return gov.updateSupplier(
          supplierId,
          {
            ...rest,
            ...(annualCost === undefined ? {} : { annualCost: annualCost.toFixed(2) }),
            ...(contactEmail === undefined ? {} : { contactEmail: contactEmail || null }),
          },
          profile.id
        );
      }),

    delete: protectedProcedure.input(id).mutation(async ({ ctx, input }) => {
      const profile = await requireGovernanceWrite(ctx, "Fournisseurs & Partenaires");
      return gov.deleteSupplier(input.id, profile.id);
    }),
  }),

  /* ---------------- RH & Équipe interne ---------------- */
  hr: router({
    team: protectedProcedure.query(async ({ ctx }) => {
      await requireGovernanceWrite(ctx, "RH & Équipe interne");
      return gov.listTeam();
    }),

    member: protectedProcedure.input(id).query(async ({ ctx, input }) => {
      const profile = await profileFor(ctx);
      // Chacun consulte sa propre fiche ; la direction consulte toute l'équipe.
      if (profile.id !== input.id && !["admin", "direction"].includes(profile.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Vous ne pouvez consulter que votre propre fiche." });
      }
      return gov.getTeamMember(input.id);
    }),

    leaves: protectedProcedure
      .input(z.object({ status: z.string().optional(), mineOnly: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const profile = await profileFor(ctx);
        const isManager = ["admin", "direction"].includes(profile.role);
        // Sans droits de validation, on ne voit que ses propres demandes.
        return gov.listLeaveRequests({
          status: input?.status,
          userId: !isManager || input?.mineOnly ? profile.id : undefined,
        });
      }),

    requestLeave: protectedProcedure
      .input(z.object({
        type: z.enum(["Conges Payes", "RTT", "Maladie", "Autre"]).default("Conges Payes"),
        startDate: isoDate,
        endDate: isoDate,
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await profileFor(ctx);
        if (input.endDate < input.startDate) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "La date de fin doit suivre la date de début." });
        }
        return gov.createLeaveRequest({ ...input, userId: profile.id }, profile.id);
      }),

    decideLeave: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["Valide", "Refuse"]) }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireGovernanceWrite(ctx, "RH & Équipe interne");
        return gov.decideLeaveRequest(input.id, input.status, profile.id);
      }),

    deleteLeave: protectedProcedure.input(id).mutation(async ({ ctx, input }) => {
      const profile = await profileFor(ctx);
      const own = await gov.listLeaveRequests({ userId: profile.id });
      const isManager = ["admin", "direction"].includes(profile.role);
      if (!isManager && !own.some(leave => leave.id === input.id)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Vous ne pouvez retirer que vos propres demandes." });
      }
      return gov.deleteLeaveRequest(input.id, profile.id);
    }),

    registerCollaborator: protectedProcedure
      .input(z.object({
        fullName: z.string().trim().min(2).max(200),
        email: z.string().trim().email().max(320),
        role: z.enum(["admin", "direction", "commercial", "marketing", "secretariat", "finance"]),
        jobTitle: z.string().trim().max(160).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await profileFor(ctx);
        // Ouvrir un accès est une action d'administration : la direction
        // consulte l'équipe mais n'accorde pas les droits.
        if (profile.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Seul un administrateur peut enregistrer un collaborateur." });
        }
        try {
          return await gov.registerCollaborator(input, profile.id);
        } catch (error) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Enregistrement impossible.",
          });
        }
      }),

    createGoal: protectedProcedure
      .input(z.object({
        userId: z.number().int().positive(),
        title: z.string().trim().min(2).max(240),
        targetDate: isoDate.optional().nullable(),
        status: z.enum(["En Cours", "Atteint", "Non Atteint"]).default("En Cours"),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireGovernanceWrite(ctx, "RH & Équipe interne");
        return gov.createGoal(input, profile.id);
      }),

    updateGoal: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(2).max(240).optional(),
        targetDate: isoDate.optional().nullable(),
        status: z.enum(["En Cours", "Atteint", "Non Atteint"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireGovernanceWrite(ctx, "RH & Équipe interne");
        const { id: goalId, ...rest } = input;
        return gov.updateGoal(goalId, rest, profile.id);
      }),

    deleteGoal: protectedProcedure.input(id).mutation(async ({ ctx, input }) => {
      const profile = await requireGovernanceWrite(ctx, "RH & Équipe interne");
      return gov.deleteGoal(input.id, profile.id);
    }),
  }),

  /* ---------------- Roadmap Produit ---------------- */
  product: router({
    // Le commercial et le secrétariat consultent le backlog pour suivre une
    // demande client : la lecture est ouverte à toute l'équipe interne.
    list: protectedProcedure
      .input(z.object({ search: z.string().optional(), status: z.string().optional(), type: z.string().optional() }).optional())
      .query(({ input }) => gov.listProductRequests(input)),

    summary: protectedProcedure.query(() => gov.getRoadmapSummary()),

    create: protectedProcedure
      .input(z.object({
        sourceTicketId: nullableId,
        organizationId: nullableId,
        title: z.string().trim().min(3).max(240),
        description: z.string().trim().max(5000).optional().nullable(),
        type: z.enum(["Bug", "Evolution"]).default("Evolution"),
        priority: z.enum(["Basse", "Moyenne", "Haute"]).default("Moyenne"),
        status: z.enum(["Idee", "Backlog", "En Developpement", "Livre"]).default("Idee"),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireGovernanceWrite(ctx, "Roadmap Produit");
        return gov.createProductRequest(input, profile.id);
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        sourceTicketId: nullableId,
        organizationId: nullableId,
        title: z.string().trim().min(3).max(240).optional(),
        description: z.string().trim().max(5000).optional().nullable(),
        type: z.enum(["Bug", "Evolution"]).optional(),
        priority: z.enum(["Basse", "Moyenne", "Haute"]).optional(),
        status: z.enum(["Idee", "Backlog", "En Developpement", "Livre"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireGovernanceWrite(ctx, "Roadmap Produit");
        const { id: requestId, ...rest } = input;
        return gov.updateProductRequest(requestId, rest, profile.id);
      }),

    delete: protectedProcedure.input(id).mutation(async ({ ctx, input }) => {
      const profile = await requireGovernanceWrite(ctx, "Roadmap Produit");
      return gov.deleteProductRequest(input.id, profile.id);
    }),

    changelog: protectedProcedure.query(() => gov.listChangelog()),

    createChangelog: protectedProcedure
      .input(z.object({
        title: z.string().trim().min(3).max(240),
        description: z.string().trim().max(5000).optional().nullable(),
        releaseDate: isoDate.optional().nullable(),
        type: z.enum(["Nouvelle Fonctionnalite", "Amelioration", "Correction"]).default("Amelioration"),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireGovernanceWrite(ctx, "Roadmap Produit");
        return gov.createChangelogEntry(input, profile.id);
      }),

    deleteChangelog: protectedProcedure.input(id).mutation(async ({ ctx, input }) => {
      const profile = await requireGovernanceWrite(ctx, "Roadmap Produit");
      return gov.deleteChangelogEntry(input.id, profile.id);
    }),
  }),

  /* ---------------- Base de connaissances ---------------- */
  knowledge: router({
    // Lecture ouverte à toute l'équipe : c'est une base partagée.
    list: protectedProcedure
      .input(z.object({ search: z.string().optional(), category: z.string().optional() }).optional())
      .query(({ input }) => gov.listArticles(input)),

    get: protectedProcedure.input(id).query(({ input }) => gov.getArticle(input.id)),

    create: protectedProcedure
      .input(z.object({
        title: z.string().trim().min(3).max(240),
        category: z.enum(["Commercial", "Support", "Marketing", "General"]).default("General"),
        content: z.string().trim().min(10).max(100_000),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await profileFor(ctx);
        return gov.createArticle({ ...input, authorId: profile.id });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(3).max(240).optional(),
        category: z.enum(["Commercial", "Support", "Marketing", "General"]).optional(),
        content: z.string().trim().min(10).max(100_000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const profile = await profileFor(ctx);
        const article = await gov.getArticle(input.id);
        if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "Article introuvable." });
        // L'écriture est réservée à l'auteur, à l'administration et à la direction.
        if (article.authorId !== profile.id && !["admin", "direction"].includes(profile.role)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Seul l’auteur de l’article peut le modifier." });
        }
        const { id: articleId, ...rest } = input;
        return gov.updateArticle(articleId, rest);
      }),

    delete: protectedProcedure.input(id).mutation(async ({ ctx, input }) => {
      const profile = await profileFor(ctx);
      const article = await gov.getArticle(input.id);
      if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "Article introuvable." });
      if (article.authorId !== profile.id && !["admin", "direction"].includes(profile.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Seul l’auteur de l’article peut le supprimer." });
      }
      return gov.deleteArticle(input.id);
    }),
  }),

  /* ---------------- Notifications ---------------- */
  notifications: router({
    list: protectedProcedure
      .input(z.object({ category: z.string().optional(), unreadOnly: z.boolean().optional() }).optional())
      .query(async ({ ctx, input }) => {
        const profile = await profileFor(ctx);
        return gov.listNotifications(profile.id, input);
      }),

    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      const profile = await profileFor(ctx);
      return gov.countUnread(profile.id);
    }),

    markRead: protectedProcedure.input(id).mutation(async ({ ctx, input }) => {
      const profile = await profileFor(ctx);
      return gov.markNotificationRead(input.id, profile.id);
    }),

    markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
      const profile = await profileFor(ctx);
      return gov.markAllRead(profile.id);
    }),

    refresh: protectedProcedure.mutation(async ({ ctx }) => {
      await requireGovernanceWrite(ctx, "Notifications");
      return gov.refreshNotifications();
    }),
  }),
});
