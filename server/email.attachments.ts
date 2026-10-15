import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { emailAttachments } from "../drizzle/schema";
import { requireDb } from "./db";
import { storageDelete, storagePut, storageRead } from "./storage";

/**
 * Pièces jointes des messages écrits depuis la plateforme.
 *
 * Le fichier est téléversé dès que le collaborateur le choisit, avant l'envoi :
 * la fenêtre de rédaction reste réactive, et une relance programmée à J+7
 * retrouvera son document intact — ce qu'une pièce gardée dans le navigateur
 * ne permettrait pas.
 *
 * Mailjet attend le contenu en base64 dans la requête d'envoi, d'où les
 * plafonds ci-dessous : ils protègent l'appel autant que la boîte du
 * destinataire.
 */

/** Taille maximale d'un fichier, en octets. */
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Taille maximale cumulée des pièces d'un même message, en octets.
 *
 * Mailjet refuse une requête d'envoi au-delà de 15 Mo, et l'encodage base64
 * ajoute un tiers au poids des fichiers : 10 Mo de pièces pèsent environ
 * 13,4 Mo dans la requête, ce qui laisse la place au corps du message.
 */
export const ATTACHMENT_TOTAL_MAX_BYTES = 10 * 1024 * 1024;

/** Nombre maximal de pièces par message. */
export const ATTACHMENT_MAX_COUNT = 10;

/**
 * Extensions acceptées.
 *
 * Une liste d'autorisation plutôt qu'une liste d'interdiction : ce qui part de
 * Medactio vers un établissement de santé doit être un document, jamais un
 * exécutable ou un script, même sous une extension inattendue.
 */
const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc", "docx", "odt", "rtf",
  "xls", "xlsx", "ods", "csv",
  "ppt", "pptx", "odp",
  "txt",
  "png", "jpg", "jpeg", "webp", "gif", "heic",
  "zip",
] as const;

export function extensionOf(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot === -1 ? "" : fileName.slice(lastDot + 1).toLowerCase();
}

export function isAllowedAttachment(fileName: string): boolean {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(fileName));
}

export const allowedAttachmentLabel = ALLOWED_EXTENSIONS.join(", ");

/** Nom de fichier sûr pour une clé de stockage, en conservant l'extension. */
function storageSafeName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

export async function uploadAttachment(
  file: { fileName: string; mimeType: string; base64: string },
  authorId: number
) {
  if (!isAllowedAttachment(file.fileName)) {
    throw new Error(`Ce type de fichier n’est pas accepté. Formats admis : ${allowedAttachmentLabel}.`);
  }

  const bytes = Buffer.from(file.base64.split(",").pop() || "", "base64");
  if (!bytes.length) throw new Error("Le fichier transmis est vide.");
  if (bytes.length > ATTACHMENT_MAX_BYTES) {
    throw new Error(`« ${file.fileName} » dépasse ${Math.round(ATTACHMENT_MAX_BYTES / 1024 / 1024)} Mo.`);
  }

  const db = await requireDb();
  const month = new Date().toISOString().slice(0, 7);
  const uploaded = await storagePut(
    `emails/pieces-jointes/${month}/${storageSafeName(file.fileName)}`,
    bytes,
    file.mimeType
  );

  const row = (
    await db
      .insert(emailAttachments)
      .values({
        storageKey: uploaded.key,
        fileName: file.fileName.slice(0, 240),
        mimeType: file.mimeType.slice(0, 160),
        sizeBytes: bytes.length,
        createdBy: authorId,
      })
      .returning({ id: emailAttachments.id, fileName: emailAttachments.fileName, sizeBytes: emailAttachments.sizeBytes })
  )[0];

  return row;
}

/**
 * Vérifie que les pièces désignées peuvent être joignées à un message, et les
 * renvoie. Une pièce déjà rattachée à un autre message, ou téléversée par un
 * autre collaborateur, est refusée : rien ne doit permettre d'envoyer un
 * document qu'on n'a pas soi-même déposé.
 */
export async function claimAttachments(ids: number[], authorId: number) {
  if (!ids.length) return [];
  if (ids.length > ATTACHMENT_MAX_COUNT) {
    throw new Error(`Pas plus de ${ATTACHMENT_MAX_COUNT} pièces jointes par message.`);
  }

  const db = await requireDb();
  const rows = await db
    .select()
    .from(emailAttachments)
    .where(
      and(
        inArray(emailAttachments.id, ids),
        eq(emailAttachments.createdBy, authorId),
        isNull(emailAttachments.scheduledEmailId),
        isNull(emailAttachments.interactionId)
      )
    );

  if (rows.length !== ids.length) {
    throw new Error("Une des pièces jointes n’est plus disponible. Joignez-la de nouveau.");
  }

  const total = rows.reduce((sum, row) => sum + row.sizeBytes, 0);
  if (total > ATTACHMENT_TOTAL_MAX_BYTES) {
    throw new Error(
      `Les pièces jointes dépassent ${Math.round(ATTACHMENT_TOTAL_MAX_BYTES / 1024 / 1024)} Mo au total.`
    );
  }

  return rows;
}

/** Charge le contenu des pièces, prêt pour l'envoi. */
export async function loadAttachmentsForSending(rows: { fileName: string; mimeType: string; storageKey: string }[]) {
  return Promise.all(
    rows.map(async row => ({
      fileName: row.fileName,
      mimeType: row.mimeType || "application/octet-stream",
      base64: (await storageRead(row.storageKey)).toString("base64"),
    }))
  );
}

/** Pièces d'un envoi programmé, à charger au moment où il part. */
export async function attachmentsOfScheduled(scheduledEmailId: number) {
  const db = await requireDb();
  return db.select().from(emailAttachments).where(eq(emailAttachments.scheduledEmailId, scheduledEmailId));
}

export async function attachToScheduled(ids: number[], scheduledEmailId: number) {
  if (!ids.length) return;
  const db = await requireDb();
  await db.update(emailAttachments).set({ scheduledEmailId }).where(inArray(emailAttachments.id, ids));
}

export async function attachToInteraction(ids: number[], interactionId: number) {
  if (!ids.length) return;
  const db = await requireDb();
  await db.update(emailAttachments).set({ interactionId }).where(inArray(emailAttachments.id, ids));
}

/** Pièces jointes par message, pour afficher un trombone dans les listes. */
export async function countAttachmentsByScheduled(scheduledEmailIds: number[]) {
  if (!scheduledEmailIds.length) return new Map<number, number>();
  const db = await requireDb();
  const rows = await db
    .select({ scheduledEmailId: emailAttachments.scheduledEmailId, fileName: emailAttachments.fileName })
    .from(emailAttachments)
    .where(inArray(emailAttachments.scheduledEmailId, scheduledEmailIds));

  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.scheduledEmailId === null) continue;
    counts.set(row.scheduledEmailId, (counts.get(row.scheduledEmailId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Supprime les brouillons abandonnés : fichiers téléversés dans une fenêtre
 * de rédaction refermée sans envoi. Sans ce ménage, le compartiment de
 * stockage conserverait indéfiniment des documents que personne n'a envoyés.
 */
export async function purgeOrphanAttachments(now = new Date()) {
  const db = await requireDb();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const orphans = await db
    .select({ id: emailAttachments.id, storageKey: emailAttachments.storageKey })
    .from(emailAttachments)
    .where(
      and(
        isNull(emailAttachments.scheduledEmailId),
        isNull(emailAttachments.interactionId),
        lt(emailAttachments.createdAt, cutoff)
      )
    )
    .limit(200);

  for (const orphan of orphans) {
    await storageDelete(orphan.storageKey);
  }
  if (orphans.length) {
    await db.delete(emailAttachments).where(inArray(emailAttachments.id, orphans.map(item => item.id)));
  }
  return orphans.length;
}

/** Retire une pièce que le collaborateur décroche avant d'envoyer. */
export async function discardAttachment(id: number, authorId: number) {
  const db = await requireDb();
  const row = (
    await db
      .select()
      .from(emailAttachments)
      .where(
        and(
          eq(emailAttachments.id, id),
          eq(emailAttachments.createdBy, authorId),
          isNull(emailAttachments.scheduledEmailId),
          isNull(emailAttachments.interactionId)
        )
      )
      .limit(1)
  )[0];
  if (!row) return { success: false } as const;

  await storageDelete(row.storageKey);
  await db.delete(emailAttachments).where(eq(emailAttachments.id, id));
  return { success: true } as const;
}
