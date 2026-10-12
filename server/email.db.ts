import { asc, desc, eq } from "drizzle-orm";
import {
  contacts,
  deals,
  emailTemplates,
  internalUsers,
  interactions,
  marketingLeads,
  organizations,
} from "../drizzle/schema";
import { requireDb } from "./db";
import { sendMail } from "./_core/mailer";

/* ------------------------------------------------------------------ */
/* Modèles de message                                                  */
/* ------------------------------------------------------------------ */

export async function listTemplates(category?: string) {
  const db = await requireDb();
  const rows = await db
    .select({
      id: emailTemplates.id,
      name: emailTemplates.name,
      category: emailTemplates.category,
      subject: emailTemplates.subject,
      body: emailTemplates.body,
      createdBy: emailTemplates.createdBy,
      authorName: internalUsers.fullName,
      updatedAt: emailTemplates.updatedAt,
    })
    .from(emailTemplates)
    .leftJoin(internalUsers, eq(emailTemplates.createdBy, internalUsers.id))
    .orderBy(asc(emailTemplates.category), asc(emailTemplates.name));

  return rows.filter(row => !category || category === "Toutes" || row.category === category);
}

export async function createTemplate(data: typeof emailTemplates.$inferInsert) {
  const db = await requireDb();
  const result = await db.insert(emailTemplates).values(data).returning({ id: emailTemplates.id });
  return { id: result[0].id };
}

export async function updateTemplate(id: number, data: Partial<typeof emailTemplates.$inferInsert>) {
  const db = await requireDb();
  await db.update(emailTemplates).set(data).where(eq(emailTemplates.id, id));
  return { success: true } as const;
}

export async function deleteTemplate(id: number) {
  const db = await requireDb();
  await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
  return { success: true } as const;
}

/* ------------------------------------------------------------------ */
/* Variables                                                           */
/* ------------------------------------------------------------------ */

export type MessageVariables = {
  contact?: string | null;
  etablissement?: string | null;
  expediteur?: string | null;
  poste?: string | null;
};

/**
 * Remplace les variables d'un modèle par les valeurs du destinataire.
 * Une variable sans valeur est retirée plutôt que laissée visible : un
 * « Bonjour {{contact}} » dans un email envoyé ferait mauvais effet.
 */
export function applyVariables(text: string, values: MessageVariables): string {
  return text.replace(/\{\{\s*(contact|etablissement|expediteur|poste)\s*\}\}/g, (_, key: keyof MessageVariables) =>
    (values[key] ?? "").trim()
  );
}

/* ------------------------------------------------------------------ */
/* Destinataires                                                       */
/* ------------------------------------------------------------------ */

export type RecipientRef =
  | { kind: "contact"; id: number }
  | { kind: "lead"; id: number }
  | { kind: "organization"; id: number };

/** Résout le destinataire et le contexte servant aux variables. */
export async function resolveRecipient(ref: RecipientRef) {
  const db = await requireDb();

  if (ref.kind === "contact") {
    const rows = await db
      .select({
        email: contacts.email,
        name: contacts.fullName,
        contactId: contacts.id,
        organizationName: organizations.name,
      })
      .from(contacts)
      .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
      .where(eq(contacts.id, ref.id))
      .limit(1);
    return rows[0] ? { ...rows[0], leadId: null as number | null } : null;
  }

  if (ref.kind === "lead") {
    const rows = await db
      .select({
        email: marketingLeads.email,
        name: marketingLeads.fullName,
        contactId: marketingLeads.contactId,
        organizationName: marketingLeads.organizationName,
      })
      .from(marketingLeads)
      .where(eq(marketingLeads.id, ref.id))
      .limit(1);
    return rows[0] ? { ...rows[0], leadId: ref.id } : null;
  }

  // Établissement : on écrit à son premier contact connu.
  const rows = await db
    .select({
      email: contacts.email,
      name: contacts.fullName,
      contactId: contacts.id,
      organizationName: organizations.name,
    })
    .from(contacts)
    .leftJoin(organizations, eq(contacts.organizationId, organizations.id))
    .where(eq(contacts.organizationId, ref.id))
    .orderBy(asc(contacts.id))
    .limit(1);
  return rows[0] ? { ...rows[0], leadId: null as number | null } : null;
}

/* ------------------------------------------------------------------ */
/* Envoi                                                               */
/* ------------------------------------------------------------------ */

export type ComposeInput = {
  recipient: RecipientRef;
  subject: string;
  body: string;
  /** Opportunité à laquelle rattacher l'échange, le cas échéant. */
  dealId?: number | null;
};

/**
 * Envoie un message rédigé depuis la plateforme et l'inscrit à l'historique.
 *
 * L'expéditeur technique reste l'adresse validée chez Mailjet, mais la réponse
 * du destinataire revient au collaborateur qui a écrit : c'est lui qui suit
 * l'échange, pas une boîte collective.
 *
 * L'échange n'est journalisé que si l'envoi a réussi : un historique
 * mentionnant un message jamais parti induirait l'équipe en erreur.
 */
export async function composeAndSend(input: ComposeInput, author: typeof internalUsers.$inferSelect) {
  const db = await requireDb();

  const recipient = await resolveRecipient(input.recipient);
  if (!recipient?.email) {
    return { sent: false as const, reason: "Aucune adresse connue pour ce destinataire." };
  }

  const variables: MessageVariables = {
    contact: recipient.name,
    etablissement: recipient.organizationName,
    expediteur: "Equipe Medactio",
    poste: "",
  };

  const subject = applyVariables(input.subject, variables).trim();
  const body = applyVariables(input.body, variables).trim();

  const result = await sendMail({
    to: recipient.email,
    toName: recipient.name,
    subject,
    text: body,
    replyTo: author.email,
  });

  if (!result.sent) return { sent: false as const, reason: result.reason };

  // L'objet est conservé dans le journal : relire « Relance devis » des mois
  // plus tard est plus parlant que le seul corps du message.
  await db.insert(interactions).values({
    dealId: input.dealId ?? null,
    contactId: recipient.contactId ?? null,
    createdBy: author.id,
    type: "Email",
    content: `Objet : ${subject}\n\n${body}`,
  });

  return { sent: true as const, to: recipient.email, subject };
}

/** Contacts joignables d'un établissement, pour le choix du destinataire. */
export async function listOrganizationContacts(organizationId: number) {
  const db = await requireDb();
  return db
    .select({ id: contacts.id, fullName: contacts.fullName, email: contacts.email, jobTitle: contacts.jobTitle })
    .from(contacts)
    .where(eq(contacts.organizationId, organizationId))
    .orderBy(asc(contacts.fullName));
}

/** Contact rattaché à une opportunité, pour pré-sélectionner le destinataire. */
export async function dealRecipients(dealId: number) {
  const db = await requireDb();
  const deal = (await db.select().from(deals).where(eq(deals.id, dealId)).limit(1))[0];
  if (!deal?.organizationId) return [];
  return listOrganizationContacts(deal.organizationId);
}

/** Derniers échanges écrits depuis la plateforme, tous destinataires confondus. */
export async function recentSentEmails(limit = 20) {
  const db = await requireDb();
  return db
    .select({
      id: interactions.id,
      content: interactions.content,
      occurredAt: interactions.occurredAt,
      contactName: contacts.fullName,
      authorName: internalUsers.fullName,
    })
    .from(interactions)
    .leftJoin(contacts, eq(interactions.contactId, contacts.id))
    .leftJoin(internalUsers, eq(interactions.createdBy, internalUsers.id))
    .where(eq(interactions.type, "Email"))
    .orderBy(desc(interactions.occurredAt))
    .limit(limit);
}
