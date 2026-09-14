// Stockage des documents (contrats d'établissement, supports marketing).
//
// Deux pilotes, choisis automatiquement :
//  - Supabase Storage, sur un compartiment privé, dès que la configuration est
//    présente. Les fichiers ne sont jamais publics : chaque lecture passe par
//    une URL signée à durée limitée, régénérée à l'affichage.
//  - Disque local (`.local-storage/`), pour le développement hors ligne.
//
// La base conserve la clé de stockage (`storageKey`) ; l'URL de consultation
// est dérivée de cette clé au moment de la lecture, jamais figée en base.

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { getSupabaseAdmin } from "./_core/supabaseAuth";

/** Compartiment Supabase hébergeant les documents internes. */
export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "documents";

/** Durée de validité des URL signées, en secondes. */
const SIGNED_URL_TTL = 60 * 60;

export const LOCAL_STORAGE_ROOT = path.resolve(process.cwd(), ".local-storage");

/** Vrai lorsque Supabase n'est pas configuré : on écrit sur disque. */
export function isLocalStorage(): boolean {
  return getSupabaseAdmin() === null;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

/** Chemin disque d'une clé, protégé contre les remontées d'arborescence. */
export function localStoragePath(key: string): string {
  const target = path.resolve(LOCAL_STORAGE_ROOT, normalizeKey(key));
  if (target !== LOCAL_STORAGE_ROOT && !target.startsWith(LOCAL_STORAGE_ROOT + path.sep)) {
    throw new Error("Clé de stockage invalide");
  }
  return target;
}

export async function localStorageRead(key: string): Promise<Buffer> {
  return readFile(localStoragePath(key));
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    const target = localStoragePath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
    return { key, url: `/api/files/${key}` };
  }

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(key, bytes, { contentType, upsert: false });
  if (error) throw new Error(`Envoi du fichier impossible : ${error.message}`);

  return { key, url: (await storageUrlFor(key)) ?? "" };
}

/**
 * URL de consultation d'un document, valable une heure.
 * Renvoie `null` si la clé est absente ou si la signature échoue.
 */
export async function storageUrlFor(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return `/api/files/${normalizeKey(key)}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(normalizeKey(key), SIGNED_URL_TTL);
  if (error || !data) {
    console.error("[Storage] URL signée indisponible", error);
    return null;
  }
  return data.signedUrl;
}

export async function storageDelete(key: string | null | undefined): Promise<void> {
  if (!key) return;
  const supabase = getSupabaseAdmin();
  if (!supabase) return;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([normalizeKey(key)]);
  if (error) console.error("[Storage] Suppression impossible", error);
}
