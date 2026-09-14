import type { Express } from "express";
import { isLocalStorage, localStoragePath } from "../storage";

/**
 * Service des documents en développement local.
 *
 * En production, les fichiers sont servis directement par Supabase Storage via
 * des URL signées : cette route n'est utilisée que par le pilote disque, quand
 * Supabase n'est pas configuré.
 */
export function registerFileRoutes(app: Express) {
  app.get("/api/files/*", (req, res) => {
    if (!isLocalStorage()) {
      res.status(404).send("Les documents sont servis par Supabase Storage");
      return;
    }
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Clé de document manquante");
      return;
    }
    try {
      res.sendFile(localStoragePath(key));
    } catch {
      res.status(400).send("Clé de document invalide");
    }
  });
}
