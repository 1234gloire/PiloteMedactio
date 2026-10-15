import { and, asc, desc, eq, isNotNull, lte, ne, type SQL } from "drizzle-orm";
import {
  contacts,
  deals,
  emailTemplates,
  interactions,
  internalUsers,
  organizations,
  scheduledEmails,
  supportTicketEvents,
  supportTickets,
} from "../drizzle/schema";
import {
  attachToInteraction,
  attachToScheduled,
  attachmentsOfScheduled,
  claimAttachments,
  countAttachmentsByScheduled,
  purgeOrphanAttachments,
  loadAttachmentsForSending,
} from "./email.attachments";
import { automaticSenderKey, resolveSender, senderByKey } from "./email.senders";
import { requireDb } from "./db";
import { applyVariables, resolveRecipient, type MessageVariables, type RecipientRef } from "./email.db";
import { dealTrigger, MAX_SEND_ATTEMPTS, relanceSendAt, ticketTrigger, type EmailTrigger } from "./email.logic";
import { sendMail } from "./_core/mailer";

/**
 * Envois automatiques déclenchés par les modèles d'email.
 *
 * Un modèle porte un déclencheur (ticket résolu, démonstration effectuée…) et
 * un délai. Au moment de l'événement, chaque modèle concerné part aussitôt
 * (délai 0) ou rejoint la file des envois programmés, vidée par un traitement
 * planifié. Un changement d'étape annule les relances qui n'ont plus lieu
 * d'être : on ne relance pas après démonstration un client qui a déjà signé.
 */

const SENDER = "Equipe Medactio";

type Recipient = {
  email: string;
  name: string | null;
  contactId: number | null;
  organizationName: string | null;
};

type Target =
  | { kind: "ticket"; ticket: typeof supportTickets.$inferSelect }
  | { kind: "deal"; dealId: number };

export type TriggerResult = {
  /** Nombre de modèles rattachés à l'événement. */
  templates: number;
  sent: number;
  scheduled: number;
  /** Motif lisible si rien n'a pu partir alors qu'un modèle existait. */
  reason?: string;
};

/* ------------------------------------------------------------------ */
/* Destinataires                                                       */
/* ------------------------------------------------------------------ */

/**
 * Adresse à laquelle répondre à un demandeur, et son nom.
 *
 * Un ticket ouvert depuis le produit par une adresse inconnue du CRM reste
 * joignable : son adresse figure dans la description, faute de contact.
 */
export async function ticketRecipient(ticket: typeof supportTickets.$inferSelect): Promise<Recipient | null> {
  const db = await requireDb();
  const organizationName = ticket.organizationId
    ? (await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, ticket.organizationId)).limit(1))[0]?.name ?? null
    : null;
  if (ticket.contactId) {
    const contact = (await db.select().from(contacts).where(eq(contacts.id, ticket.contactId)).limit(1))[0];
    if (contact?.email) return { email: contact.email, name: contact.fullName, contactId: contact.id, organizationName };
  }
  const match = (ticket.description || "").match(/<([^>]+@[^>]+)>/);
  return match ? { email: match[1], name: null, contactId: null, organizationName } : null;
}

/** Premier contact joignable de l'établissement de l'opportunité. */
async function dealRecipient(dealId: number): Promise<Recipient | null> {
  const db = await requireDb();
  const row = (
    await db
      .select({ email: contacts.email, name: contacts.fullName, contactId: contacts.id, organizationName: organizations.name })
      .from(deals)
      .innerJoin(organizations, eq(deals.organizationId, organizations.id))
      .innerJoin(contacts, eq(contacts.organizationId, organizations.id))
      .where(and(eq(deals.id, dealId), isNotNull(contacts.email)))
      .orderBy(asc(contacts.id))
      .limit(1)
  )[0];
  return row?.email ? row : null;
}

async function authorEmail(authorId: number | null | undefined) {
  if (!authorId) return null;
  const db = await requireDb();
  return (await db.select({ email: internalUsers.email }).from(internalUsers).where(eq(internalUsers.id, authorId)).limit(1))[0]?.email ?? null;
}

/* ------------------------------------------------------------------ */
/* Envoi et journalisation                                             */
/* ------------------------------------------------------------------ */

/**
 * Inscrit l'envoi à l'historique : au fil du ticket pour le support, aux
 * échanges du contact pour le commercial. Renvoie l'identifiant de l'échange
 * créé, auquel rattacher les pièces jointes.
 */
async function logSent(input: {
  subject: string;
  body: string;
  contactId: number | null;
  dealId: number | null;
  ticketId: number | null;
  authorId: number | null;
  automatic: boolean;
  attachmentNames?: string[];
}) {
  const db = await requireDb();
  const joined = input.attachmentNames?.length
    ? `\n\nPièces jointes : ${input.attachmentNames.join(", ")}`
    : "";
  const interaction = (
    await db
      .insert(interactions)
      .values({
        dealId: input.dealId,
        contactId: input.contactId,
        createdBy: input.authorId,
        type: "Email",
        content: `Objet : ${input.subject}\n\n${input.body}${joined}`,
      })
      .returning({ id: interactions.id })
  )[0];
  if (input.ticketId) {
    await db.insert(supportTicketEvents).values({
      ticketId: input.ticketId,
      authorId: input.authorId,
      eventType: "Relance Client",
      content: `${input.automatic ? "Email automatique envoyé" : "Email programmé envoyé"} au demandeur : « ${input.subject} »${input.attachmentNames?.length ? ` (${input.attachmentNames.length} pièce${input.attachmentNames.length > 1 ? "s" : ""} jointe${input.attachmentNames.length > 1 ? "s" : ""})` : ""}.`,
    });
  }
  return interaction?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Déclenchement                                                       */
/* ------------------------------------------------------------------ */

async function fireTrigger(trigger: EmailTrigger, target: Target, authorId: number | null): Promise<TriggerResult> {
  const db = await requireDb();
  const templates = await db.select().from(emailTemplates).where(eq(emailTemplates.trigger, trigger)).orderBy(asc(emailTemplates.delayDays));
  if (!templates.length) return { templates: 0, sent: 0, scheduled: 0 };

  const recipient = target.kind === "ticket" ? await ticketRecipient(target.ticket) : await dealRecipient(target.dealId);
  if (!recipient) return { templates: templates.length, sent: 0, scheduled: 0, reason: "Aucune adresse connue pour ce client." };

  const variables: MessageVariables = {
    contact: recipient.name,
    etablissement: recipient.organizationName,
    expediteur: SENDER,
    poste: "",
    ticket: target.kind === "ticket" ? target.ticket.title : "",
    numero: target.kind === "ticket" ? `#${target.ticket.id}` : "",
  };
  const ticketId = target.kind === "ticket" ? target.ticket.id : null;
  const dealId = target.kind === "deal" ? target.dealId : null;
  const replyTo = await authorEmail(authorId);
  const now = new Date();

  let sent = 0;
  let scheduled = 0;
  let reason: string | undefined;

  // Un envoi automatique n'a pas de rédacteur qui choisirait sa boîte : elle
  // découle de ce qui le déclenche — un incident part du support, une relance
  // commerciale du commercial.
  const senderKey = automaticSenderKey(target.kind);
  const sender = senderByKey(senderKey);

  for (const template of templates) {
    const subject = applyVariables(template.subject, variables).trim();
    const body = applyVariables(template.body, variables).trim();

    if (template.delayDays <= 0) {
      const result = await sendMail({ to: recipient.email, toName: recipient.name, subject, text: body, replyTo, from: sender });
      if (result.sent) {
        sent += 1;
        await logSent({ subject, body, contactId: recipient.contactId, dealId, ticketId, authorId, automatic: true });
      } else {
        reason = result.reason;
      }
      continue;
    }

    await db.insert(scheduledEmails).values({
      templateId: template.id,
      trigger,
      ticketId,
      dealId,
      contactId: recipient.contactId,
      toEmail: recipient.email,
      toName: recipient.name,
      subject,
      body,
      sendAt: relanceSendAt(now, template.delayDays),
      senderKey,
      createdBy: authorId,
    });
    scheduled += 1;
  }

  return { templates: templates.length, sent, scheduled, ...(reason ? { reason } : {}) };
}

/**
 * Annule les envois programmés d'un ticket ou d'une opportunité, sauf ceux du
 * déclencheur courant. Les envois programmés à la main (sans déclencheur)
 * restent : c'est un choix délibéré du collaborateur.
 */
async function cancelObsolete(scope: { ticketId: number } | { dealId: number }, keep: EmailTrigger | null) {
  const db = await requireDb();
  const conditions: SQL[] = [
    eq(scheduledEmails.status, "Programme"),
    isNotNull(scheduledEmails.trigger),
    "ticketId" in scope ? eq(scheduledEmails.ticketId, scope.ticketId) : eq(scheduledEmails.dealId, scope.dealId),
  ];
  if (keep) conditions.push(ne(scheduledEmails.trigger, keep));
  await db.update(scheduledEmails).set({ status: "Annule" }).where(and(...conditions));
}

export async function onTicketStatusChanged(
  ticket: typeof supportTickets.$inferSelect,
  status: string,
  authorId: number | null
): Promise<TriggerResult> {
  const trigger = ticketTrigger(status);
  await cancelObsolete({ ticketId: ticket.id }, trigger);
  if (!trigger) return { templates: 0, sent: 0, scheduled: 0 };
  return fireTrigger(trigger, { kind: "ticket", ticket }, authorId);
}

export async function currentDealStage(dealId: number) {
  const db = await requireDb();
  return (await db.select({ stage: deals.stage }).from(deals).where(eq(deals.id, dealId)).limit(1))[0]?.stage ?? null;
}

export async function onDealStageChanged(dealId: number, stage: string, authorId: number | null): Promise<TriggerResult> {
  const trigger = dealTrigger(stage);
  await cancelObsolete({ dealId }, trigger);
  if (!trigger) return { templates: 0, sent: 0, scheduled: 0 };
  return fireTrigger(trigger, { kind: "deal", dealId }, authorId);
}

/* ------------------------------------------------------------------ */
/* Programmation manuelle                                              */
/* ------------------------------------------------------------------ */

export async function scheduleManual(
  input: {
    recipient: RecipientRef;
    subject: string;
    body: string;
    sendAt: Date;
    dealId?: number | null;
    attachmentIds?: number[];
    senderKey?: string | null;
  },
  author: typeof internalUsers.$inferSelect
) {
  const recipient = await resolveRecipient(input.recipient);
  if (!recipient?.email) return { scheduled: false as const, reason: "Aucune adresse connue pour ce destinataire." };

  const variables: MessageVariables = {
    contact: recipient.name,
    etablissement: recipient.organizationName,
    expediteur: SENDER,
    poste: "",
  };
  const subject = applyVariables(input.subject, variables).trim();
  const body = applyVariables(input.body, variables).trim();

  // Les pièces sont vérifiées maintenant : un document manquant doit être
  // signalé à la rédaction, pas découvert au moment de l'envoi.
  const attachmentIds = input.attachmentIds ?? [];
  const claimed = await claimAttachments(attachmentIds, author.id);

  // La boîte est validée maintenant, pas au moment de l'envoi : un refus doit
  // se voir à la rédaction.
  const sender = resolveSender(input.senderKey, author.role);

  const db = await requireDb();
  const result = await db
    .insert(scheduledEmails)
    .values({
      dealId: input.dealId ?? null,
      contactId: recipient.contactId ?? null,
      toEmail: recipient.email,
      toName: recipient.name,
      subject,
      body,
      sendAt: input.sendAt,
      senderKey: sender.key,
      createdBy: author.id,
    })
    .returning({ id: scheduledEmails.id });

  await attachToScheduled(attachmentIds, result[0].id);

  return {
    scheduled: true as const,
    id: result[0].id,
    to: recipient.email,
    sendAt: input.sendAt,
    attachments: claimed.length,
    from: sender.email,
  };
}

export async function listScheduled(input?: { dealId?: number; ticketId?: number; pendingOnly?: boolean }) {
  const rows = await listScheduledRows(input);
  // Le trombone de la liste a besoin du compte, pas du contenu des pièces.
  const counts = await countAttachmentsByScheduled(rows.map(row => row.id));
  return rows.map(row => ({ ...row, attachments: counts.get(row.id) ?? 0 }));
}

async function listScheduledRows(input?: { dealId?: number; ticketId?: number; pendingOnly?: boolean }) {
  const db = await requireDb();
  const conditions: SQL[] = [];
  if (input?.dealId) conditions.push(eq(scheduledEmails.dealId, input.dealId));
  if (input?.ticketId) conditions.push(eq(scheduledEmails.ticketId, input.ticketId));
  if (input?.pendingOnly) conditions.push(eq(scheduledEmails.status, "Programme"));
  return db
    .select({
      id: scheduledEmails.id,
      toEmail: scheduledEmails.toEmail,
      toName: scheduledEmails.toName,
      subject: scheduledEmails.subject,
      body: scheduledEmails.body,
      sendAt: scheduledEmails.sendAt,
      status: scheduledEmails.status,
      trigger: scheduledEmails.trigger,
      senderKey: scheduledEmails.senderKey,
      lastError: scheduledEmails.lastError,
      sentAt: scheduledEmails.sentAt,
      dealId: scheduledEmails.dealId,
      ticketId: scheduledEmails.ticketId,
      templateName: emailTemplates.name,
      authorName: internalUsers.fullName,
    })
    .from(scheduledEmails)
    .leftJoin(emailTemplates, eq(scheduledEmails.templateId, emailTemplates.id))
    .leftJoin(internalUsers, eq(scheduledEmails.createdBy, internalUsers.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(eq(scheduledEmails.status, "Programme")), asc(scheduledEmails.sendAt))
    .limit(100);
}

export async function cancelScheduled(id: number) {
  const db = await requireDb();
  await db
    .update(scheduledEmails)
    .set({ status: "Annule" })
    .where(and(eq(scheduledEmails.id, id), eq(scheduledEmails.status, "Programme")));
  return { success: true } as const;
}

/* ------------------------------------------------------------------ */
/* Traitement planifié                                                 */
/* ------------------------------------------------------------------ */

/**
 * Envoie les messages arrivés à échéance. Un échec laisse le message en file
 * pour le passage suivant, jusqu'à trois essais : une panne passagère de
 * Mailjet ne doit pas faire perdre une relance.
 */
export async function processDueEmails(now = new Date()) {
  const db = await requireDb();
  const due = await db
    .select()
    .from(scheduledEmails)
    .where(and(eq(scheduledEmails.status, "Programme"), lte(scheduledEmails.sendAt, now)))
    .orderBy(asc(scheduledEmails.sendAt))
    .limit(100);

  let sent = 0;
  let failed = 0;
  const authorEmails = new Map<number, string | null>();

  for (const item of due) {
    // Revérifie le statut : une annulation a pu intervenir entre-temps.
    const claimed = await db
      .update(scheduledEmails)
      .set({ attempts: item.attempts + 1 })
      .where(and(eq(scheduledEmails.id, item.id), eq(scheduledEmails.status, "Programme"), eq(scheduledEmails.attempts, item.attempts)))
      .returning({ id: scheduledEmails.id });
    if (!claimed.length) continue;

    if (item.createdBy && !authorEmails.has(item.createdBy)) authorEmails.set(item.createdBy, await authorEmail(item.createdBy));

    // Les pièces sont relues au moment de l'envoi : un document de plusieurs
    // mégaoctets n'a pas à encombrer la file pendant des jours.
    const joined = await attachmentsOfScheduled(item.id);
    let attachments: Awaited<ReturnType<typeof loadAttachmentsForSending>> = [];
    try {
      attachments = await loadAttachmentsForSending(joined);
    } catch (error) {
      // Pièce devenue illisible : l'envoi est mis en échec plutôt qu'expédié
      // amputé du document qui en faisait tout l'objet.
      failed += 1;
      await db
        .update(scheduledEmails)
        .set({
          status: "Echec",
          lastError: error instanceof Error ? error.message : "Pièce jointe illisible.",
        })
        .where(eq(scheduledEmails.id, item.id));
      continue;
    }

    const result = await sendMail({
      to: item.toEmail,
      toName: item.toName,
      subject: item.subject,
      text: item.body,
      replyTo: item.createdBy ? authorEmails.get(item.createdBy) : null,
      attachments,
      from: senderByKey(item.senderKey),
    });

    if (result.sent) {
      sent += 1;
      await db.update(scheduledEmails).set({ status: "Envoye", sentAt: new Date(), lastError: null }).where(eq(scheduledEmails.id, item.id));
      const interactionId = await logSent({
        subject: item.subject,
        body: item.body,
        contactId: item.contactId,
        dealId: item.dealId,
        ticketId: item.ticketId,
        authorId: item.createdBy,
        automatic: Boolean(item.trigger),
        attachmentNames: joined.map(file => file.fileName),
      });
      // La pièce reste rattachée à l'envoi programmé et rejoint l'échange :
      // l'historique du contact montre ce qui lui a été transmis.
      if (interactionId) await attachToInteraction(joined.map(file => file.id), interactionId);
    } else {
      failed += 1;
      const exhausted = item.attempts + 1 >= MAX_SEND_ATTEMPTS;
      await db
        .update(scheduledEmails)
        .set({ lastError: result.reason ?? "Envoi impossible.", ...(exhausted ? { status: "Echec" as const } : {}) })
        .where(eq(scheduledEmails.id, item.id));
    }
  }

  // Le même passage fait le ménage : les fichiers téléversés dans une fenêtre
  // refermée sans envoi n'ont pas à rester en stockage.
  const purged = await purgeOrphanAttachments(now).catch(error => {
    console.error("[Emails programmés] Ménage des pièces jointes", error);
    return 0;
  });

  return { due: due.length, sent, failed, purged };
}
