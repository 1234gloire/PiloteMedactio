import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";

/**
 * Authentification via Supabase Auth (lien magique par email).
 *
 * Le navigateur conserve la session Supabase et transmet son jeton d'accès dans
 * l'en-tête `Authorization`. Le serveur le fait valider par Supabase, puis
 * projette l'identité obtenue sur la table interne `users` : `openId` porte
 * l'identifiant Supabase de l'utilisateur.
 *
 * Seuls les emails déjà invités dans le projet Supabase peuvent se connecter :
 * la liste des personnes autorisées se gère depuis le tableau de bord Supabase
 * (Authentication → Users), sans redéploiement.
 */
let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  if (!_client) {
    _client = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _client;
}

export function isSupabaseAuthConfigured(): boolean {
  return getSupabaseAdmin() !== null;
}

function bearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return undefined;
  const token = header.slice(7).trim();
  return token.length ? token : undefined;
}

/**
 * Valide le jeton porté par la requête et renvoie l'utilisateur interne
 * correspondant, ou `null` si la requête n'est pas authentifiée.
 */
export async function authenticateSupabaseRequest(req: Request): Promise<User | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const token = bearerToken(req);
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  const authUser = data.user;
  const email = authUser.email ?? null;
  const ownerEmail = process.env.OWNER_EMAIL?.toLowerCase();
  const isOwner = Boolean(ownerEmail && email && email.toLowerCase() === ownerEmail);

  await db.upsertUser({
    openId: authUser.id,
    name:
      (authUser.user_metadata?.full_name as string | undefined) ||
      (authUser.user_metadata?.name as string | undefined) ||
      email ||
      "Utilisateur Medactio",
    email,
    loginMethod: "supabase",
    lastSignedIn: new Date(),
    ...(isOwner ? { role: "admin" as const } : {}),
  });

  const user = await db.getUserByOpenId(authUser.id);
  if (!user) return null;

  // Garantit l'existence du profil métier (rôle, intitulé de poste).
  await db.ensureInternalProfile(user);
  return user;
}
