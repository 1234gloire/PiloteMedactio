import type { Request } from "express";
import { timingSafeEqual } from "crypto";

/**
 * Authentification des traitements planifiés.
 *
 * Les déclenchements proviennent de `pg_cron` côté Supabase, qui appelle les
 * endpoints `/api/scheduled/*` en présentant le secret partagé `CRON_SECRET`
 * dans l'en-tête `Authorization`. La comparaison est faite à durée constante
 * pour ne pas laisser fuiter le secret par le temps de réponse.
 */
export function isAuthorizedCronRequest(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = req.headers.authorization;
  const provided =
    typeof header === "string" && header.startsWith("Bearer ")
      ? header.slice(7)
      : undefined;
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
