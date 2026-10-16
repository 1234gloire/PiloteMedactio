import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { calendarEvents, contacts, organizations } from "../drizzle/schema";
import {
  agendaTitle,
  agendaTypeFor,
  categoryFromAnswer,
  findAnswer,
  locationLabelOf,
  meetingUrlOf,
  notificationCategoryFor,
  recipientsFor,
  verifyCalendlySignature,
  type BookingCategory,
} from "./calendly.logic";
import { requireDb } from "./db";
import { notifyRoles } from "./governance.db";
import { captureLead, updateLead } from "./marketing.db";

/**
 * Réception des réservations Calendly.
 *
 * Calendly appelle ce point d'entrée à chaque réservation et à chaque
 * annulation, en signant son appel. La liaison est à sens unique : la
 * plateforme reçoit, elle n'écrit jamais chez Calendly. Les disponibilités
 * restent calculées par Calendly depuis l'agenda Google de l'équipe.
 *
 * Le traitement est idempotent : l'identifiant Calendly de l'événement est
 * conservé en base, et un même appel rejoué — Calendly réessaie en cas
 * d'erreur — ne crée pas un second rendez-vous.
 *
 * Un report est traité par Calendly comme une annulation suivie d'une
 * nouvelle réservation : l'agenda suit sans traitement particulier.
 */

/** Intitulés reconnus pour chaque information attendue du formulaire. */
const QUESTION_KEYS = {
  category: ["objet", "demande concerne", "type de demande"],
  organization: ["etablissement", "structure", "hopital", "clinique"],
  jobTitle: ["fonction", "poste", "role"],
};

const payloadSchema = z.object({
  event: z.string().min(3).max(80),
  payload: z.object({
    email: z.string().trim().email().max(320),
    name: z.string().trim().max(240).optional().nullable(),
    questions_and_answers: z
      .array(z.object({ question: z.string().max(1000), answer: z.string().max(5000) }))
      .optional()
      .nullable(),
    cancel_url: z.string().max(1000).optional().nullable(),
    reschedule_url: z.string().max(1000).optional().nullable(),
    scheduled_event: z.object({
      uri: z.string().min(10).max(240),
      name: z.string().max(240).optional().nullable(),
      status: z.string().max(40).optional().nullable(),
      start_time: z.string().min(10),
      end_time: z.string().min(10).optional().nullable(),
      location: z.unknown().optional().nullable(),
    }),
  }),
});

function isTrustedCall(req: Request): { valid: boolean; reason?: string } {
  return verifyCalendlySignature({
    header: req.headers["calendly-webhook-signature"] as string | undefined,
    rawBody: (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})),
    signingKey: process.env.CALENDLY_WEBHOOK_SIGNING_KEY ?? "",
  });
}

/** Établissement du réservant : retrouvé sur son nom, à défaut sur son contact. */
async function resolveOrganization(organizationName: string | null, email: string) {
  const db = await requireDb();
  if (organizationName) {
    const existing = (
      await db.select().from(organizations).where(eq(organizations.name, organizationName)).limit(1)
    )[0];
    if (existing) return existing;
  }
  const contact = (await db.select().from(contacts).where(eq(contacts.email, email)).limit(1))[0];
  if (contact?.organizationId) {
    return (await db.select().from(organizations).where(eq(organizations.id, contact.organizationId)).limit(1))[0] ?? null;
  }
  return null;
}

export async function receiveCalendlyEvent(req: Request, res: Response) {
  const trust = isTrustedCall(req);
  if (!trust.valid) {
    console.warn("[Calendly] Appel rejeté", trust.reason);
    return res.status(403).json({ success: false, message: "Appel non autorisé." });
  }

  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Réservation incomplète.",
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const { event, payload } = parsed.data;
  const externalId = payload.scheduled_event.uri;

  try {
    const db = await requireDb();

    /* -------------------- Annulation -------------------- */
    if (event === "invitee.canceled") {
      const removed = await db
        .delete(calendarEvents)
        .where(eq(calendarEvents.externalId, externalId))
        .returning({ id: calendarEvents.id, title: calendarEvents.title, startAt: calendarEvents.startAt });

      if (removed.length) {
        const when = removed[0].startAt.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
        void notifyRoles(["admin", "secretariat", "commercial"], {
          category: "Support",
          message: `Rendez-vous annulé — ${removed[0].title}, prévu le ${when}.`,
          link: "/support/agenda",
          dedupeKey: `calendly-cancel-${externalId}`,
        });
      }
      return res.status(200).json({ success: true, canceled: removed.length });
    }

    if (event !== "invitee.created") {
      // Un événement non géré n'est pas une erreur : Calendly pourrait en
      // ajouter, et un 200 évite qu'il réessaie indéfiniment.
      return res.status(200).json({ success: true, ignored: event });
    }

    /* -------------------- Réservation -------------------- */
    const answers = payload.questions_and_answers ?? [];
    const category: BookingCategory = categoryFromAnswer(findAnswer(answers, QUESTION_KEYS.category));
    const organizationName = findAnswer(answers, QUESTION_KEYS.organization);
    const jobTitle = findAnswer(answers, QUESTION_KEYS.jobTitle);
    const email = payload.email.toLowerCase();
    const inviteeName = payload.name?.trim() || email;

    // Les réponses qui ne correspondent à aucune question connue sont
    // conservées : c'est souvent là que le client explique son besoin.
    const knownKeys = [...QUESTION_KEYS.category, ...QUESTION_KEYS.organization, ...QUESTION_KEYS.jobTitle];
    const extraNotes = answers
      .filter(entry => {
        const label = entry.question.toLowerCase();
        return entry.answer?.trim() && !knownKeys.some(key => label.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().includes(key));
      })
      .map(entry => `${entry.question.trim()} : ${entry.answer.trim()}`)
      .join("\n");

    let organization = await resolveOrganization(organizationName, email);
    let leadId: number | null = null;

    // Une démonstration réservée par un inconnu est une demande entrante :
    // elle rejoint le CRM comme celles du formulaire de medactio.fr.
    if (category === "Demonstration") {
      const lead = await captureLead({
        fullName: inviteeName,
        email,
        jobTitle,
        organizationName: organizationName || inviteeName,
        organizationType: "Autre",
        source: "Calendly",
        consentToContact: true,
        notes: extraNotes || null,
      });
      leadId = lead.id;
      // Le rendez-vous est déjà pris : le lead ne part pas de zéro.
      if (!lead.duplicate) await updateLead(lead.id, { status: "RDV Planifie" });
      if (!organization && lead.organizationId) {
        organization = (await db.select().from(organizations).where(eq(organizations.id, lead.organizationId)).limit(1))[0] ?? null;
      }
    }

    const contact = (await db.select().from(contacts).where(eq(contacts.email, email)).limit(1))[0] ?? null;

    const startAt = new Date(payload.scheduled_event.start_time);
    const endAt = payload.scheduled_event.end_time ? new Date(payload.scheduled_event.end_time) : null;

    const description = [
      `Réservé via Calendly par ${inviteeName} (${email}).`,
      organizationName ? `Établissement déclaré : ${organizationName}.` : null,
      jobTitle ? `Fonction : ${jobTitle}.` : null,
      extraNotes || null,
      payload.cancel_url ? `Annuler : ${payload.cancel_url}` : null,
      payload.reschedule_url ? `Reprogrammer : ${payload.reschedule_url}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const values = {
      title: agendaTitle(category, inviteeName, organizationName),
      description,
      eventType: agendaTypeFor(category),
      organizationId: organization?.id ?? null,
      contactId: contact?.id ?? null,
      startAt,
      endAt,
      location: locationLabelOf(payload.scheduled_event.location),
      meetingUrl: meetingUrlOf(payload.scheduled_event.location),
      externalSource: "calendly" as const,
      externalId,
    };

    // Idempotence : un appel rejoué met à jour le rendez-vous plutôt que
    // d'en créer un second.
    const inserted = await db
      .insert(calendarEvents)
      .values(values)
      .onConflictDoUpdate({ target: calendarEvents.externalId, set: values })
      .returning({ id: calendarEvents.id });

    const when = startAt.toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
    void notifyRoles(recipientsFor(category), {
      category: notificationCategoryFor(category),
      message: `${values.title} — ${when}, réservé par ${inviteeName}.`,
      link: organization ? `/organisations/${organization.id}` : "/support/agenda",
      dedupeKey: `calendly-booking-${externalId}`,
    });

    return res.status(200).json({
      success: true,
      eventId: inserted[0]?.id ?? null,
      category,
      organizationId: organization?.id ?? null,
      leadId,
    });
  } catch (error) {
    console.error("[Calendly] Réservation non traitée", error);
    return res.status(500).json({ success: false, message: "La réservation n’a pas pu être enregistrée." });
  }
}
