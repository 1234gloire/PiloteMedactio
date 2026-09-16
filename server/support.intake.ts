import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { contacts, organizations, supportTicketEvents } from "../drizzle/schema";
import { requireDb } from "./db";
import { createTicket } from "./support.db";

/**
 * Ouverture de tickets depuis le produit Medactio.
 *
 * Les praticiens signalent un problème depuis l'application qu'ils utilisent ;
 * le backend de Medactio relaie la demande ici, de serveur à serveur, en
 * présentant le secret partagé `TICKET_INTAKE_SECRET`. Le navigateur du
 * praticien n'appelle jamais la plateforme de pilotage.
 *
 * Le praticien est identifié par son adresse email, rapprochée des contacts du
 * CRM : le ticket est alors rattaché à son établissement. Une adresse inconnue
 * n'empêche pas la création du ticket — perdre une demande d'assistance serait
 * pire qu'un ticket non rattaché — mais le journal le signale explicitement.
 */

const intakeSchema = z.object({
  email: z.string().trim().email().max(320),
  fullName: z.string().trim().max(200).optional().nullable(),
  organizationName: z.string().trim().max(240).optional().nullable(),
  title: z.string().trim().min(4).max(240),
  description: z.string().trim().max(10_000).optional().nullable(),
  category: z.enum(["Facturation", "Acces Licence", "Support Technique", "Onboarding", "Autre"]).default("Support Technique"),
  /** Contexte technique facultatif : version, navigateur, écran concerné. */
  context: z.record(z.string(), z.string().max(500)).optional(),
  website: z.string().max(200).optional(),
});

function isTrustedCall(req: Request): boolean {
  const expected = process.env.TICKET_INTAKE_SECRET;
  if (!expected) return false;
  const header = req.headers.authorization;
  const provided =
    typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Met en forme le contexte technique transmis par le produit. */
function formatContext(context?: Record<string, string>): string {
  if (!context) return "";
  const lines = Object.entries(context)
    .filter(([, value]) => value?.trim())
    .map(([key, value]) => `- ${key} : ${value.trim()}`);
  return lines.length ? `\n\nContexte technique\n${lines.join("\n")}` : "";
}

export async function openSupportTicket(req: Request, res: Response) {
  if (!isTrustedCall(req)) {
    return res.status(403).json({ success: false, message: "Appel non autorisé." });
  }

  const parsed = intakeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "La demande d’assistance est incomplète.",
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const input = parsed.data;
  // Champ piège : rempli par un robot, invisible pour un humain.
  if (input.website) return res.status(202).json({ success: true });

  try {
    const db = await requireDb();
    const email = input.email.toLowerCase();

    const contact = (await db.select().from(contacts).where(eq(contacts.email, email)).limit(1))[0];
    let organizationId = contact?.organizationId ?? null;

    // À défaut de contact connu, on tente le rapprochement par nom
    // d'établissement pour que le ticket rejoigne tout de même son compte.
    if (!organizationId && input.organizationName) {
      const organization = (
        await db.select().from(organizations).where(eq(organizations.name, input.organizationName)).limit(1)
      )[0];
      organizationId = organization?.id ?? null;
    }

    const identity = contact
      ? ""
      : `\n\nDemandeur non rattaché au CRM : ${input.fullName || "nom non communiqué"} <${email}>` +
        (input.organizationName ? ` — ${input.organizationName}` : "");

    const { id } = await createTicket({
      organizationId,
      contactId: contact?.id ?? null,
      title: input.title,
      description: `${input.description ?? ""}${formatContext(input.context)}${identity}`.trim() || null,
      category: input.category,
      source: "Produit Medactio",
      // La priorité reste un arbitrage interne : elle n'est pas laissée au
      // demandeur, sans quoi toute demande arriverait en urgence.
      priority: "Moyenne",
      status: "Nouveau",
      assignedTo: null,
    });

    await db.insert(supportTicketEvents).values({
      ticketId: id,
      authorId: null,
      eventType: "Note Interne",
      content: contact
        ? `Ticket ouvert depuis l’application Medactio par ${contact.fullName}.`
        : `Ticket ouvert depuis l’application Medactio par une adresse inconnue du CRM (${email}).`,
    });

    return res.status(201).json({ success: true, ticketId: id, linked: Boolean(contact) });
  } catch (error) {
    console.error("[Support] Ouverture de ticket impossible", error);
    return res.status(500).json({ success: false, message: "La demande n’a pas pu être enregistrée." });
  }
}
