import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
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
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  crm: crmRouter,
  customerSuccess: customerSuccessRouter,
  support: supportRouter,
  analytics: analyticsRouter,
  marketing: marketingRouter,
});

export type AppRouter = typeof appRouter;
