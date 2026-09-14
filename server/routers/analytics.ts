import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ensureInternalProfile } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { exportAnalyticsCsv, getAnalytics } from "../analytics.db";

const periodSchema = z.enum(["30d", "90d", "12m", "all"]).default("12m");

const directionProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const profile = await ensureInternalProfile(ctx.user);
  if (!profile || !["admin", "direction"].includes(profile.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Le pôle Direction & Analytics est réservé à la Direction et aux administrateurs." });
  return next({ ctx: { ...ctx, internalProfile: profile } });
});

export const analyticsRouter = router({
  access: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ensureInternalProfile(ctx.user);
    return { role: profile.role, allowed: ["admin", "direction"].includes(profile.role) };
  }),
  dashboard: directionProcedure.input(z.object({ period: periodSchema }).optional()).query(({ input }) => getAnalytics(input?.period || "12m")),
  exportCsv: directionProcedure.input(z.object({ period: periodSchema })).mutation(({ input }) => exportAnalyticsCsv(input.period)),
});
