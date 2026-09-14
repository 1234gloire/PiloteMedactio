import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getDevUser, isDevAuthEnabled } from "./devAuth";
import { authenticateSupabaseRequest } from "./supabaseAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Session locale déterministe pour le développement hors ligne (devAuth.ts).
  // Inopérante dès que NODE_ENV vaut "production".
  if (isDevAuthEnabled()) {
    try {
      user = await getDevUser();
    } catch (error) {
      console.warn("[DevAuth] Session locale indisponible:", error);
    }
    return { req: opts.req, res: opts.res, user };
  }

  try {
    user = await authenticateSupabaseRequest(opts.req);
  } catch (error) {
    // L'authentification reste facultative pour les procédures publiques.
    console.warn("[Auth] Vérification de session échouée:", error);
    user = null;
  }

  return { req: opts.req, res: opts.res, user };
}
