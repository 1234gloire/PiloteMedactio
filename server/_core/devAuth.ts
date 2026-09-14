import type { User } from "../../drizzle/schema";
import * as db from "../db";

/**
 * Authentification de développement local.
 *
 * Le socle d'origine délègue toute l'authentification au service OAuth de la
 * plateforme d'hébergement (voir `sdk.authenticateRequest`), ce qui rend
 * l'application impossible à lancer en dehors de cette plateforme. Ce module
 * fournit une session locale déterministe pour le développement, en attendant
 * le branchement d'un fournisseur d'identité définitif.
 *
 * Il ne s'active jamais en production : `NODE_ENV=production` le désactive
 * quelle que soit la valeur de `DEV_AUTH_ENABLED`.
 */
export function isDevAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_ENABLED === "true"
  );
}

let cachedUser: User | null = null;

export async function getDevUser(): Promise<User | null> {
  if (!isDevAuthEnabled()) return null;
  if (cachedUser) return cachedUser;

  const openId = process.env.DEV_AUTH_OPEN_ID || "dev-admin";
  const name = process.env.DEV_AUTH_NAME || "Utilisateur de développement";
  const email = process.env.DEV_AUTH_EMAIL || "dev@medactio.local";

  await db.upsertUser({
    openId,
    name,
    email,
    loginMethod: "dev",
    role: "admin",
    lastSignedIn: new Date(),
  });

  const user = await db.getUserByOpenId(openId);
  if (!user) return null;

  // Le rôle métier (internal_users.businessRole) porte les droits applicatifs ;
  // on garantit un profil admin pour pouvoir parcourir tous les pôles.
  await db.ensureInternalProfile(user);

  cachedUser = user;
  return user;
}
