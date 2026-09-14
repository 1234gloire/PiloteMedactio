import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { protectedProcedure, router } from "../_core/trpc";
import * as customerDb from "../customer-success.db";
import * as db from "../db";

async function profileFor(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) {
  return db.ensureInternalProfile(ctx.user);
}

async function requireCustomerWrite(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) {
  const profile = await profileFor(ctx);
  if (profile.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Seuls les administrateurs peuvent modifier le suivi Succès Client." });
  }
  return profile;
}

async function requireSubscriptionWrite(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) {
  const profile = await profileFor(ctx);
  if (!["admin", "finance"].includes(profile.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle dispose d’un accès en lecture seule aux abonnements." });
  }
  return profile;
}

const subscriptionInput = z.object({
  organizationId: z.number().int().positive(),
  planName: z.string().trim().min(2).max(160),
  seatsPurchased: z.coerce.number().int().positive(),
  pricePerSeat: z.coerce.number().min(0),
  billingCycle: z.enum(["Mensuel", "Annuel"]),
  status: z.enum(["Essai", "Actif", "Suspendu", "Resilie"]),
  startDate: z.string().date().optional().nullable(),
  renewalDate: z.string().date().optional().nullable(),
});

function sessionTokenFrom(ctx: { req: { headers: { cookie?: string } } }) {
  return parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
}

export const customerSuccessRouter = router({
  dashboard: protectedProcedure.query(() => customerDb.getCustomerDashboard()),
  list: protectedProcedure.input(z.object({
    search: z.string().optional(),
    health: z.string().optional(),
    onboarding: z.string().optional(),
    renewal: z.string().optional(),
    status: z.string().optional(),
  }).optional()).query(({ input }) => customerDb.listCustomers(input)),
  get: protectedProcedure.input(z.object({ organizationId: z.number().int().positive() })).query(({ input }) => customerDb.getCustomer(input.organizationId)),

  onboarding: router({
    initialize: protectedProcedure.input(z.object({ organizationId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requireCustomerWrite(ctx);
      return customerDb.ensureOnboardingTasks(input.organizationId);
    }),
    toggle: protectedProcedure.input(z.object({ id: z.number().int().positive(), completed: z.boolean() })).mutation(async ({ ctx, input }) => {
      const profile = await requireCustomerWrite(ctx);
      return customerDb.toggleOnboardingTask(input.id, input.completed, profile.id);
    }),
  }),

  subscriptions: router({
    create: protectedProcedure.input(subscriptionInput).mutation(async ({ ctx, input }) => {
      const profile = await requireSubscriptionWrite(ctx);
      return customerDb.createAuditedSubscription({ ...input, pricePerSeat: String(input.pricePerSeat) }, profile.id);
    }),
    update: protectedProcedure.input(subscriptionInput.partial().extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const profile = await requireSubscriptionWrite(ctx);
      const { id, pricePerSeat, ...data } = input;
      return customerDb.updateSubscription(id, { ...data, ...(pricePerSeat !== undefined ? { pricePerSeat: String(pricePerSeat) } : {}) }, profile.id);
    }),
    cancel: protectedProcedure.input(z.object({ id: z.number().int().positive(), reason: z.string().trim().min(3).max(2000), cancelledAt: z.string().date() })).mutation(async ({ ctx, input }) => {
      const profile = await requireSubscriptionWrite(ctx);
      return customerDb.cancelSubscription(input.id, input.reason, input.cancelledAt, profile.id);
    }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const profile = await requireSubscriptionWrite(ctx);
      return customerDb.deleteSubscription(input.id, profile.id);
    }),
  }),

  licenses: router({
    setStatus: protectedProcedure.input(z.object({ contactId: z.number().int().positive(), active: z.boolean() })).mutation(async ({ ctx, input }) => {
      await requireCustomerWrite(ctx);
      return customerDb.setLicenseStatus(input.contactId, input.active);
    }),
  }),

  usage: router({
    create: protectedProcedure.input(z.object({
      organizationId: z.number().int().positive(),
      contactId: z.number().int().positive().optional().nullable(),
      documentsGeneratedCount: z.coerce.number().int().positive().max(100000),
      aiRequestsCount: z.coerce.number().int().min(0).max(1000000).default(0),
      logDate: z.string().date(),
    })).mutation(async ({ ctx, input }) => {
      await requireCustomerWrite(ctx);
      return customerDb.addUsage(input);
    }),
  }),

  alerts: router({
    refresh: protectedProcedure.mutation(async ({ ctx }) => {
      await requireCustomerWrite(ctx);
      return customerDb.refreshCustomerAlerts();
    }),
    updateStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["Ouverte", "Resolue", "Ignoree"]) })).mutation(async ({ ctx, input }) => {
      await requireCustomerWrite(ctx);
      return customerDb.updateAlert(input.id, input.status);
    }),
  }),

  automation: router({
    status: protectedProcedure.query(() => customerDb.getCustomerAutomation()),
    enable: protectedProcedure.mutation(async ({ ctx }) => {
      await requireCustomerWrite(ctx);
      const sessionToken = sessionTokenFrom(ctx);
      if (!sessionToken) throw new TRPCError({ code: "UNAUTHORIZED", message: "Reconnectez-vous avant d’activer l’automatisation." });
      const current = await customerDb.getCustomerAutomation();
      if (current?.scheduleCronTaskUid) {
        await updateHeartbeatJob(current.scheduleCronTaskUid, { enable: true, cron: "0 0 6 * * *" }, sessionToken);
        await customerDb.updateAutomationTaskUid(current.scheduleCronTaskUid, true);
        return { taskUid: current.scheduleCronTaskUid, enabled: true };
      }
      const job = await createHeartbeatJob({
        name: "daily-customer-success-alerts",
        cron: "0 0 6 * * *",
        path: "/api/scheduled/customer-success-alerts",
        description: "Recalcule chaque jour les alertes de renouvellement, d’usage et de santé client Medactio.",
      }, sessionToken);
      await customerDb.updateAutomationTaskUid(job.taskUid, true);
      return { taskUid: job.taskUid, enabled: true, nextExecutionAt: job.nextExecutionAt };
    }),
    disable: protectedProcedure.mutation(async ({ ctx }) => {
      await requireCustomerWrite(ctx);
      const sessionToken = sessionTokenFrom(ctx);
      const current = await customerDb.getCustomerAutomation();
      if (!current?.scheduleCronTaskUid) return { enabled: false };
      await deleteHeartbeatJob(current.scheduleCronTaskUid, sessionToken);
      await customerDb.updateAutomationTaskUid(null, false);
      return { enabled: false };
    }),
  }),
});
