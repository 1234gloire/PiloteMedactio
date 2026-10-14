import { eq, inArray } from "drizzle-orm";
import { contacts, invoices } from "../drizzle/schema";
import { requireDb } from "./db";
import { planInvoiceReminders, toAmount } from "./finance.logic";
import { notifyRoles } from "./governance.db";
import { remindInvoice } from "./support.db";

/**
 * Relance quotidienne des factures impayées.
 *
 * Le traitement reprend le même envoi que la relance manuelle : le client
 * reçoit un seul et même message, qu'un collaborateur ait cliqué ou que le
 * quotidien s'en soit chargé. Seules les factures échues sont concernées, et
 * au plus trois fois à sept jours d'intervalle — au-delà, le dossier relève
 * d'une décision humaine.
 *
 * Une facture sans contact joignable n'est jamais « relancée dans le vide » :
 * elle est signalée à la finance et son compteur reste intact, pour que le
 * rappel puisse partir dès qu'une adresse est renseignée.
 */
export async function runInvoiceReminders(now = new Date()) {
  const db = await requireDb();

  const rows = await db
    .select({
      id: invoices.id,
      organizationId: invoices.organizationId,
      invoiceNumber: invoices.invoiceNumber,
      amount: invoices.amount,
      status: invoices.status,
      dueDate: invoices.dueDate,
      paidAt: invoices.paidAt,
      reminderCount: invoices.reminderCount,
      lastReminderAt: invoices.lastReminderAt,
      nextReminderDate: invoices.nextReminderDate,
    })
    .from(invoices);

  const plan = planInvoiceReminders(rows, now);

  // 1. Le statut d'abord : une facture échue doit apparaître en retard même
  //    si aucune relance n'est due aujourd'hui.
  if (plan.toMarkOverdue.length) {
    await db
      .update(invoices)
      .set({ status: "En Retard" })
      .where(inArray(invoices.id, plan.toMarkOverdue));
  }

  let remindersSent = 0;
  let remindersFailed = 0;
  const unreachable: string[] = [];

  for (const id of plan.toRemind) {
    const invoice = rows.find(row => row.id === id);
    if (!invoice) continue;

    const recipient = (
      await db.select({ email: contacts.email }).from(contacts).where(eq(contacts.organizationId, invoice.organizationId)).limit(1)
    )[0];
    if (!recipient?.email) {
      unreachable.push(invoice.invoiceNumber);
      continue;
    }

    const result = await remindInvoice(id, null);
    if (result.mail?.sent) remindersSent += 1;
    else remindersFailed += 1;
  }

  // 2. L'équipe est prévenue de ce qui reste à sa main : le montant encore dû
  //    et les factures qu'aucune adresse ne permet de relancer.
  const stillOverdue = rows.filter(
    row => !row.paidAt && (plan.toMarkOverdue.includes(row.id) || row.status === "En Retard")
  );
  if (stillOverdue.length) {
    const total = stillOverdue.reduce((sum, row) => sum + toAmount(row.amount), 0);
    const amount = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(total);
    void notifyRoles(["admin", "direction", "finance"], {
      category: "Finance",
      message: `${stillOverdue.length} facture${stillOverdue.length > 1 ? "s" : ""} en retard — ${amount} en attente de règlement.`,
      link: "/support/factures",
      // Un rappel par jour au plus : la relance est quotidienne, pas l'alerte.
      dedupeKey: `invoices-overdue-${now.toISOString().slice(0, 10)}`,
    });
  }

  for (const invoiceNumber of unreachable) {
    void notifyRoles(["admin", "finance"], {
      category: "Finance",
      message: `Facture ${invoiceNumber} impossible à relancer : aucun contact avec adresse email pour cet établissement.`,
      link: "/support/factures",
      dedupeKey: `invoice-unreachable-${invoiceNumber}`,
    });
  }

  return {
    examined: rows.length,
    markedOverdue: plan.toMarkOverdue.length,
    remindersSent,
    remindersFailed,
    unreachable: unreachable.length,
    overdueTotal: stillOverdue.length,
    ranAt: now,
  };
}
