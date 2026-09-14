import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { crmRouter } from "./routers/crm";
import { customerSuccessRouter } from "./routers/customer-success";
import { supportRouter } from "./routers/support";
import { analyticsRouter } from "./routers/analytics";
import { marketingRouter } from "./routers/marketing";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    // La session est détenue par Supabase côté navigateur : sa révocation est
    // faite par le client (`supabase.auth.signOut()`). Ce point d'entrée reste
    // le signal de fin de session côté serveur.
    logout: publicProcedure.mutation(() => ({ success: true }) as const),
  }),
  crm: crmRouter,
  customerSuccess: customerSuccessRouter,
  support: supportRouter,
  analytics: analyticsRouter,
  marketing: marketingRouter,
});

export type AppRouter = typeof appRouter;
