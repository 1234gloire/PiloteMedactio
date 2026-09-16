import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";
import * as financeDb from "../finance.db";
import { EXPENSE_CATEGORIES } from "../finance.logic";

async function profileFor(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) {
  return db.ensureInternalProfile(ctx.user);
}

/**
 * La trésorerie, les dépenses et les mouvements bancaires ne sont visibles que
 * par la finance et la direction : ce sont les données les plus sensibles de
 * l'outil.
 */
async function requireFinanceRead(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) {
  const profile = await profileFor(ctx);
  if (!["admin", "direction", "finance"].includes(profile.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle n’a pas accès au pôle Finance." });
  }
  return profile;
}

/** La direction consulte mais ne saisit pas : l'écriture reste à la finance. */
async function requireFinanceWrite(ctx: { user: NonNullable<Parameters<typeof db.ensureInternalProfile>[0]> }) {
  const profile = await profileFor(ctx);
  if (!["admin", "finance"].includes(profile.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Votre rôle dispose d’un accès en lecture seule au pôle Finance." });
  }
  return profile;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date attendue au format AAAA-MM-JJ");
const nullableId = z.number().int().positive().optional().nullable();

const expenseInput = z.object({
  supplierId: nullableId,
  label: z.string().trim().min(2).max(240),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().nonnegative().max(100_000_000),
  expenseDate: isoDate,
  isRecurring: z.boolean().default(false),
});

const transactionInput = z.object({
  transactionDate: isoDate,
  amount: z.number().positive().max(100_000_000),
  type: z.enum(["Credit", "Debit"]),
  description: z.string().trim().max(1000).optional().nullable(),
});

/** Les montants sont stockés en `numeric` : Drizzle attend une chaîne. */
const asNumeric = (value: number) => value.toFixed(2);

export const financeRouter = router({
  profile: protectedProcedure.query(({ ctx }) => profileFor(ctx)),

  access: protectedProcedure.query(async ({ ctx }) => {
    const profile = await profileFor(ctx);
    return { role: profile.role, allowed: ["admin", "direction", "finance"].includes(profile.role) };
  }),

  dashboard: protectedProcedure
    .input(z.object({ horizonDays: z.number().int().min(7).max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      await requireFinanceRead(ctx);
      return financeDb.getFinanceDashboard(input?.horizonDays ?? 30);
    }),

  suppliers: protectedProcedure.query(async ({ ctx }) => {
    await requireFinanceRead(ctx);
    return financeDb.listSuppliers();
  }),

  expenses: router({
    list: protectedProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            category: z.string().optional(),
            from: isoDate.optional(),
            to: isoDate.optional(),
            recurringOnly: z.boolean().optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        await requireFinanceRead(ctx);
        return financeDb.listExpenses(input);
      }),

    create: protectedProcedure.input(expenseInput).mutation(async ({ ctx, input }) => {
      const profile = await requireFinanceWrite(ctx);
      return financeDb.createExpense({ ...input, amount: asNumeric(input.amount) }, profile.id);
    }),

    update: protectedProcedure
      .input(expenseInput.partial().extend({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireFinanceWrite(ctx);
        const { id, amount, ...rest } = input;
        return financeDb.updateExpense(
          id,
          { ...rest, ...(amount === undefined ? {} : { amount: asNumeric(amount) }) },
          profile.id
        );
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireFinanceWrite(ctx);
        return financeDb.deleteExpense(input.id, profile.id);
      }),
  }),

  transactions: router({
    list: protectedProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            status: z.enum(["Toutes", "Rapprochees", "A rapprocher"]).optional(),
            from: isoDate.optional(),
            to: isoDate.optional(),
          })
          .optional()
      )
      .query(async ({ ctx, input }) => {
        await requireFinanceRead(ctx);
        return financeDb.listBankTransactions(input);
      }),

    candidates: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await requireFinanceRead(ctx);
        return financeDb.getReconciliationCandidates(input.id);
      }),

    create: protectedProcedure.input(transactionInput).mutation(async ({ ctx, input }) => {
      const profile = await requireFinanceWrite(ctx);
      return financeDb.createBankTransaction({ ...input, amount: asNumeric(input.amount) }, profile.id);
    }),

    reconcile: protectedProcedure
      .input(
        z.object({
          id: z.number().int().positive(),
          kind: z.enum(["invoice", "expense"]),
          targetId: z.number().int().positive(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const profile = await requireFinanceWrite(ctx);
        return financeDb.reconcileTransaction(input.id, { kind: input.kind, targetId: input.targetId }, profile.id);
      }),

    unreconcile: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireFinanceWrite(ctx);
        return financeDb.unreconcileTransaction(input.id, profile.id);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const profile = await requireFinanceWrite(ctx);
        return financeDb.deleteBankTransaction(input.id, profile.id);
      }),
  }),

  exportFec: protectedProcedure
    .input(z.object({ from: isoDate, to: isoDate }))
    .mutation(async ({ ctx, input }) => {
      const profile = await requireFinanceRead(ctx);
      if (input.from > input.to) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La date de début doit précéder la date de fin." });
      }
      return financeDb.exportFec(input, profile.id);
    }),
});
