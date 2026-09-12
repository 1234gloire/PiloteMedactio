import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { z } from "zod";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import * as supportDb from "../support.db";

async function profileFor(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) {
  return db.ensureInternalProfile(ctx.user);
}

async function requireSupportWrite(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) {
  const profile = await profileFor(ctx);
  if (!["admin", "secretariat"].includes(profile.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle dispose d’un accès en lecture seule au pôle Support." });
  return profile;
}

async function requireInvoiceRead(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) {
  const profile = await profileFor(ctx);
  if (!["admin", "direction", "secretariat", "finance"].includes(profile.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Vous n’avez pas accès aux données de facturation." });
  return profile;
}

async function requireInvoiceWrite(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) {
  const profile = await profileFor(ctx);
  if (!["admin", "secretariat", "finance"].includes(profile.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle ne permet pas de modifier la facturation." });
  return profile;
}

const nullableId = z.number().int().positive().optional().nullable();
const ticketInput = z.object({
  organizationId: nullableId,
  contactId: nullableId,
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().max(5000).optional().nullable(),
  category: z.enum(["Facturation", "Acces Licence", "Support Technique", "Onboarding", "Autre"]),
  priority: z.enum(["Basse", "Moyenne", "Haute", "Urgente"]),
  status: z.enum(["Nouveau", "En cours", "En attente client", "Resolu"]),
  assignedTo: nullableId,
});
const taskInput = z.object({
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().max(5000).optional().nullable(),
  organizationId: nullableId,
  assignedTo: nullableId,
  dueDate: z.string().date().optional().nullable(),
  priority: z.enum(["Basse", "Moyenne", "Haute"]),
  status: z.enum(["A Faire", "En Cours", "Fait"]),
});
const invoiceInput = z.object({
  organizationId: z.number().int().positive(),
  subscriptionId: nullableId,
  invoiceNumber: z.string().trim().min(3).max(80),
  amount: z.coerce.number().positive(),
  status: z.enum(["Brouillon", "Envoyee", "Payee", "En Retard"]),
  issuedAt: z.string().date().optional().nullable(),
  dueDate: z.string().date().optional().nullable(),
  paidAt: z.string().date().optional().nullable(),
  nextReminderDate: z.string().date().optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
});
const contractInput = z.object({
  organizationId: z.number().int().positive(),
  title: z.string().trim().min(3).max(240),
  type: z.enum(["Convention", "Contrat", "DPA", "Avenant", "Autre"]),
  status: z.enum(["Brouillon", "A Signer", "Actif", "Expire", "Resilie"]),
  startDate: z.string().date().optional().nullable(),
  endDate: z.string().date().optional().nullable(),
  signedAt: z.string().date().optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
});
const eventInput = z.object({
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().max(5000).optional().nullable(),
  eventType: z.enum(["Rendez-vous Interne", "Demo", "Rendez-vous Client", "Echeance", "Autre"]),
  organizationId: nullableId,
  contactId: nullableId,
  organizerId: nullableId,
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional().nullable(),
  allDay: z.boolean(),
  location: z.string().trim().max(240).optional().nullable(),
});

function sessionTokenFrom(ctx: { req: { headers: { cookie?: string } } }) {
  return parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
}

export const supportRouter = router({
  profile: protectedProcedure.query(({ ctx }) => profileFor(ctx)),
  users: protectedProcedure.query(() => db.listInternalUsers()),
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const profile = await profileFor(ctx);
    const dashboard = await supportDb.getSupportDashboard();
    if (["admin", "direction", "secretariat", "finance"].includes(profile.role)) return dashboard;
    return { ...dashboard, outstandingInvoices: 0, overdueInvoiceAmount: 0, unpaidInvoices: [] };
  }),
  tickets: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional(), status: z.string().optional(), priority: z.string().optional(), assignedTo: z.number().optional() }).optional()).query(({ input }) => supportDb.listTickets(input)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => supportDb.getTicket(input.id)),
    create: protectedProcedure.input(ticketInput).mutation(async ({ ctx, input }) => { const profile = await requireSupportWrite(ctx); return supportDb.createTicket(input, profile.id); }),
    update: protectedProcedure.input(ticketInput.partial().extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const profile = await requireSupportWrite(ctx); const { id, ...data } = input; return supportDb.updateTicket(id, data, profile.id); }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireSupportWrite(ctx); return supportDb.deleteTicket(input.id); }),
    addEvent: protectedProcedure.input(z.object({ ticketId: z.number().int().positive(), eventType: z.enum(["Commentaire", "Changement Statut", "Note Interne", "Relance Client"]), content: z.string().trim().min(2).max(5000) })).mutation(async ({ ctx, input }) => { const profile = await requireSupportWrite(ctx); return supportDb.addTicketEvent({ ...input, authorId: profile.id }); }),
  }),
  tasks: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional(), status: z.string().optional(), assignedTo: z.number().optional() }).optional()).query(({ input }) => supportDb.listTasks(input)),
    create: protectedProcedure.input(taskInput).mutation(async ({ ctx, input }) => { await requireSupportWrite(ctx); return supportDb.createTask(input); }),
    update: protectedProcedure.input(taskInput.partial().extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireSupportWrite(ctx); const { id, ...data } = input; return supportDb.updateTask(id, data); }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireSupportWrite(ctx); return supportDb.deleteTask(input.id); }),
  }),
  invoices: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional(), status: z.string().optional() }).optional()).query(async ({ ctx, input }) => { await requireInvoiceRead(ctx); return supportDb.listInvoices(input); }),
    create: protectedProcedure.input(invoiceInput).mutation(async ({ ctx, input }) => { const profile = await requireInvoiceWrite(ctx); return supportDb.createInvoice({ ...input, amount: String(input.amount) }, profile.id); }),
    update: protectedProcedure.input(invoiceInput.partial().extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const profile = await requireInvoiceWrite(ctx); const { id, amount, ...data } = input; return supportDb.updateInvoice(id, { ...data, ...(amount !== undefined ? { amount: String(amount) } : {}) }, profile.id); }),
    remind: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const profile = await requireInvoiceWrite(ctx); return supportDb.remindInvoice(input.id, profile.id); }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const profile = await requireInvoiceWrite(ctx); return supportDb.deleteInvoice(input.id, profile.id); }),
  }),
  contracts: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional(), status: z.string().optional(), type: z.string().optional() }).optional()).query(({ input }) => supportDb.listContracts(input)),
    create: protectedProcedure.input(contractInput).mutation(async ({ ctx, input }) => { const profile = await requireSupportWrite(ctx); return supportDb.createContract(input, profile.id); }),
    update: protectedProcedure.input(contractInput.partial().extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const profile = await requireSupportWrite(ctx); const { id, ...data } = input; return supportDb.updateContract(id, data, profile.id); }),
    upload: protectedProcedure.input(z.object({ id: z.number().int().positive(), fileName: z.string().min(1).max(240), mimeType: z.string().max(120), base64: z.string().min(1).max(14_000_000) })).mutation(async ({ ctx, input }) => { const profile = await requireSupportWrite(ctx); const { id, ...file } = input; return supportDb.uploadContractDocument(id, file, profile.id); }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const profile = await requireSupportWrite(ctx); return supportDb.deleteContract(input.id, profile.id); }),
  }),
  events: router({
    list: protectedProcedure.input(z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional(), type: z.string().optional() }).optional()).query(({ input }) => supportDb.listEvents(input)),
    create: protectedProcedure.input(eventInput).mutation(async ({ ctx, input }) => { await requireSupportWrite(ctx); return supportDb.createEvent(input); }),
    update: protectedProcedure.input(eventInput.partial().extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireSupportWrite(ctx); const { id, ...data } = input; return supportDb.updateEvent(id, data); }),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await requireSupportWrite(ctx); return supportDb.deleteEvent(input.id); }),
  }),
  alerts: router({
    refresh: protectedProcedure.mutation(async ({ ctx }) => { await requireSupportWrite(ctx); return supportDb.refreshSupportAlerts(); }),
    updateStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["Ouverte", "Resolue", "Ignoree"]) })).mutation(async ({ ctx, input }) => { await requireSupportWrite(ctx); return supportDb.updateSupportAlert(input.id, input.status); }),
  }),
  automation: router({
    status: protectedProcedure.query(() => supportDb.getSupportAutomation()),
    enable: protectedProcedure.mutation(async ({ ctx }) => {
      await requireSupportWrite(ctx);
      const token = sessionTokenFrom(ctx);
      if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "Reconnectez-vous avant d’activer l’automatisation." });
      const current = await supportDb.getSupportAutomation();
      if (current?.scheduleCronTaskUid) {
        await updateHeartbeatJob(current.scheduleCronTaskUid, { enable: true, cron: "0 30 6 * * *" }, token);
        await supportDb.updateSupportAutomationTaskUid(current.scheduleCronTaskUid, true);
        return { taskUid: current.scheduleCronTaskUid, enabled: true };
      }
      const job = await createHeartbeatJob({ name: "daily-support-alerts", cron: "0 30 6 * * *", path: "/api/scheduled/support-alerts", description: "Contrôle quotidien des SLA, tâches, impayés, contrats et rendez-vous Medactio." }, token);
      await supportDb.updateSupportAutomationTaskUid(job.taskUid, true);
      return { taskUid: job.taskUid, enabled: true, nextExecutionAt: job.nextExecutionAt };
    }),
    disable: protectedProcedure.mutation(async ({ ctx }) => {
      await requireSupportWrite(ctx);
      const token = sessionTokenFrom(ctx);
      const current = await supportDb.getSupportAutomation();
      if (!current?.scheduleCronTaskUid) return { enabled: false };
      await deleteHeartbeatJob(current.scheduleCronTaskUid, token);
      await supportDb.updateSupportAutomationTaskUid(null, false);
      return { enabled: false };
    }),
  }),
});
