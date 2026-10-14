import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { z } from "zod";
import { auditLog, contacts, invoices, organizations, subscriptions } from "../drizzle/schema";
import { requireDb } from "./db";
import { notifyRoles } from "./governance.db";

/**
 * Réception des abonnements et paiements en provenance du produit Medactio.
 *
 * Stripe n'est jamais interrogé depuis cette plateforme : le produit en reste
 * le seul interlocuteur, et relaie ici ce qu'il reçoit. Cela évite deux
 * intégrations concurrentes qui finiraient par diverger sur l'état réel d'un
 * abonnement.
 *
 * Le traitement est idempotent : Stripe réémet volontiers un même événement,
 * et le relais peut lui-même être rejoué. L'identifiant d'abonnement et celui
 * de facture servent de garde-fous.
 */

/** Correspondance entre l'état Stripe et le suivi commercial de la plateforme. */
const STATUS_MAP: Record<string, typeof subscriptions.$inferInsert["status"]> = {
  trialing: "Essai",
  active: "Actif",
  past_due: "Suspendu",
  unpaid: "Suspendu",
  incomplete: "Suspendu",
  incomplete_expired: "Resilie",
  canceled: "Resilie",
  paused: "Suspendu",
};

const payloadSchema = z.object({
  event: z.string().min(3).max(80),
  email: z.string().trim().email().max(320),
  fullName: z.string().trim().max(200).optional().nullable(),
  /** Nom de la structure ; à défaut on retient le praticien lui-même. */
  organizationName: z.string().trim().max(240).optional().nullable(),
  stripeCustomerId: z.string().trim().max(80),
  stripeSubscriptionId: z.string().trim().max(80).optional().nullable(),
  status: z.string().trim().max(40),
  planName: z.string().trim().max(160).optional().nullable(),
  /** Montant en centimes, comme Stripe l'exprime. */
  amountCents: z.coerce.number().int().min(0).optional().nullable(),
  currency: z.string().trim().max(8).optional().nullable(),
  seats: z.coerce.number().int().min(1).max(10_000).optional().nullable(),
  interval: z.enum(["month", "year"]).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  renewalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  cancelledAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  cancellationReason: z.string().trim().max(500).optional().nullable(),
  /** Facture acquittée, le cas échéant. */
  invoice: z
    .object({
      stripeInvoiceId: z.string().trim().max(80),
      number: z.string().trim().max(80).optional().nullable(),
      amountCents: z.coerce.number().int().min(0),
      paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      status: z.enum(["paid", "open", "uncollectible", "void"]).optional().nullable(),
    })
    .optional()
    .nullable(),
});

function isTrustedCall(req: Request): boolean {
  const expected = process.env.BILLING_INTAKE_SECRET;
  if (!expected) return false;
  const header = req.headers.authorization;
  const provided =
    typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const toAmount = (cents?: number | null) => ((cents ?? 0) / 100).toFixed(2);

export async function receiveBillingEvent(req: Request, res: Response) {
  if (!isTrustedCall(req)) {
    return res.status(403).json({ success: false, message: "Appel non autorisé." });
  }

  const parsed = payloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Événement de facturation incomplet.",
      fields: parsed.error.flatten().fieldErrors,
    });
  }

  const input = parsed.data;
  const status = STATUS_MAP[input.status] ?? "Essai";

  try {
    const db = await requireDb();
    const email = input.email.toLowerCase();

    // 1. L'établissement. Un praticien libéral qui souscrit seul constitue à
    //    lui seul sa structure : son nom sert alors d'intitulé.
    const label = input.organizationName?.trim() || input.fullName?.trim() || email;
    let organization = (await db.select().from(organizations).where(eq(organizations.name, label)).limit(1))[0];

    const existingContact = (await db.select().from(contacts).where(eq(contacts.email, email)).limit(1))[0];
    if (!organization && existingContact?.organizationId) {
      organization = (await db.select().from(organizations).where(eq(organizations.id, existingContact.organizationId)).limit(1))[0];
    }
    if (!organization) {
      organization = (
        await db
          .insert(organizations)
          .values({
            name: label,
            type: input.organizationName ? "Autre" : "Cabinet Liberal",
            status: status === "Resilie" ? "Inactif" : "Client Actif",
            leadSource: "Site Web",
          })
          .returning()
      )[0];
    } else if (status !== "Resilie" && organization.status !== "Client Actif") {
      // Un paiement fait d'un prospect un client : le pipeline doit le refléter.
      await db.update(organizations).set({ status: "Client Actif" }).where(eq(organizations.id, organization.id));
    } else if (status === "Resilie" && organization.status === "Client Actif") {
      // Et une résiliation le fait sortir du portefeuille actif.
      await db.update(organizations).set({ status: "Inactif" }).where(eq(organizations.id, organization.id));
    }

    // 2. Le praticien.
    const contact =
      existingContact ??
      (
        await db
          .insert(contacts)
          .values({
            organizationId: organization.id,
            fullName: input.fullName?.trim() || email,
            email,
            isLicenseActive: status === "Actif" || status === "Essai",
          })
          .returning()
      )[0];

    if (existingContact) {
      await db
        .update(contacts)
        .set({ isLicenseActive: status === "Actif" || status === "Essai" })
        .where(eq(contacts.id, existingContact.id));
    }

    // 3. L'abonnement, reconnu à son identifiant Stripe.
    // Un changement de statut ne porte pas toujours le détail du contrat :
    // seuls les champs réellement transmis sont écrits, afin qu'une mise à
    // jour partielle n'efface pas le plan ni le tarif déjà connus.
    const seats = input.seats ?? 1;
    const values: Partial<typeof subscriptions.$inferInsert> = {
      organizationId: organization.id,
      status,
      stripeCustomerId: input.stripeCustomerId,
      stripeSubscriptionId: input.stripeSubscriptionId ?? null,
    };
    if (input.planName?.trim()) values.planName = input.planName.trim();
    if (input.seats) values.seatsPurchased = seats;
    if (input.amountCents !== null && input.amountCents !== undefined) {
      values.pricePerSeat = toAmount(Math.round(input.amountCents / seats));
    }
    if (input.interval) values.billingCycle = input.interval === "year" ? "Annuel" : "Mensuel";
    if (input.startDate) values.startDate = input.startDate;
    if (input.renewalDate) values.renewalDate = input.renewalDate;
    if (input.cancelledAt) values.cancelledAt = input.cancelledAt;
    if (input.cancellationReason) values.cancellationReason = input.cancellationReason;

    let subscriptionId: number | null = null;
    if (input.stripeSubscriptionId) {
      const existing = (
        await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, input.stripeSubscriptionId)).limit(1)
      )[0];
      if (existing) {
        await db.update(subscriptions).set(values).where(eq(subscriptions.id, existing.id));
        subscriptionId = existing.id;
      } else {
        subscriptionId = (
          await db
            .insert(subscriptions)
            .values({ planName: "Abonnement Medactio", ...values, organizationId: organization.id })
            .returning({ id: subscriptions.id })
        )[0].id;
      }
    }

    // 4. L'encaissement, s'il accompagne l'événement.
    let invoiceId: number | null = null;
    if (input.invoice) {
      const existing = (
        await db.select().from(invoices).where(eq(invoices.stripeInvoiceId, input.invoice.stripeInvoiceId)).limit(1)
      )[0];
      const invoiceValues = {
        organizationId: organization.id,
        subscriptionId,
        invoiceNumber: input.invoice.number?.trim() || input.invoice.stripeInvoiceId,
        stripeInvoiceId: input.invoice.stripeInvoiceId,
        amount: toAmount(input.invoice.amountCents),
        status: input.invoice.status === "paid" ? ("Payee" as const) : ("Envoyee" as const),
        issuedAt: input.invoice.paidAt ?? null,
        paidAt: input.invoice.status === "paid" ? input.invoice.paidAt ?? null : null,
      };
      if (existing) {
        await db.update(invoices).set(invoiceValues).where(eq(invoices.id, existing.id));
        invoiceId = existing.id;
      } else {
        invoiceId = (await db.insert(invoices).values(invoiceValues).returning({ id: invoices.id }))[0].id;
      }
    }

    await db.insert(auditLog).values({
      userId: null,
      action: `stripe.${input.event}`,
      targetTable: "subscriptions",
      targetId: subscriptionId,
    });

    // 5. L'équipe est prévenue de ce qui mérite une réaction : une nouvelle
    //    souscription, un échec de prélèvement, une résiliation. Les simples
    //    renouvellements n'alertent personne.
    const alert =
      input.event === "customer.subscription.created" || input.event === "checkout.session.completed"
        ? { message: `Nouvel abonnement — ${organization.name} (${status.toLowerCase()}).`, key: `sub-new-${input.stripeSubscriptionId}` }
        : status === "Suspendu"
          ? { message: `Prélèvement en échec — ${organization.name}. Abonnement suspendu.`, key: `sub-fail-${input.stripeSubscriptionId}-${input.status}` }
          : status === "Resilie"
            ? { message: `Résiliation — ${organization.name}.`, key: `sub-cancel-${input.stripeSubscriptionId}` }
            : null;

    if (alert) {
      void notifyRoles(["admin", "direction", "finance"], {
        category: "Finance",
        message: alert.message,
        link: `/clients/${organization.id}`,
        dedupeKey: alert.key,
      });
    }

    return res.status(200).json({
      success: true,
      organizationId: organization.id,
      contactId: contact?.id ?? null,
      subscriptionId,
      invoiceId,
      status,
    });
  } catch (error) {
    console.error("[Facturation] Événement non traité", error);
    return res.status(500).json({ success: false, message: "L’événement n’a pas pu être enregistré." });
  }
}
