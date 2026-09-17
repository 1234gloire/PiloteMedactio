import { systemRouter } from "./_core/systemRouter";
import { ensureInternalProfile, UnknownCollaboratorError } from "./db";
import { publicProcedure, router } from "./_core/trpc";
import { crmRouter } from "./routers/crm";
import { financeRouter } from "./routers/finance";
import { governanceRouter } from "./routers/governance";
import { customerSuccessRouter } from "./routers/customer-success";
import { supportRouter } from "./routers/support";
import { analyticsRouter } from "./routers/analytics";
import { marketingRouter } from "./routers/marketing";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    // Une adresse authentifiée mais non enregistrée ne doit pas voir
    // l'application : l'interface la renvoie vers l'écran de connexion.
    me: publicProcedure.query(async opts => {
      if (!opts.ctx.user) return null;
      try {
        await ensureInternalProfile(opts.ctx.user);
        return opts.ctx.user;
      } catch (error) {
        if (error instanceof UnknownCollaboratorError) return null;
        throw error;
      }
    }),
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
  finance: financeRouter,
  governance: governanceRouter,
});

export type AppRouter = typeof appRouter;
