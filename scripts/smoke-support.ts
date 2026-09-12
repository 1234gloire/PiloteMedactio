import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { adminTasks, calendarEvents, establishmentContracts, internalUsers, invoices, organizations, supportAlerts, supportTicketEvents, supportTickets } from "../drizzle/schema";
import { requireDb } from "../server/db";
import {
  addTicketEvent,
  createContract,
  createEvent,
  createInvoice,
  createTask,
  createTicket,
  deleteContract,
  deleteEvent,
  deleteInvoice,
  deleteTask,
  deleteTicket,
  getTicket,
  refreshSupportAlerts,
  remindInvoice,
  updateContract,
  updateEvent,
  updateInvoice,
  updateTask,
  updateTicket,
  uploadContractDocument,
} from "../server/support.db";

async function smoke() {
  const db = await requireDb();
  const organization = (await db.select().from(organizations).limit(1))[0];
  const author = (await db.select().from(internalUsers).where(eq(internalUsers.role, "admin")).limit(1))[0] || (await db.select().from(internalUsers).limit(1))[0];
  if (!organization || !author) throw new Error("Données de référence manquantes");
  let ticketId = 0, taskId = 0, invoiceId = 0, contractId = 0, eventId = 0;
  try {
    ticketId = (await createTicket({ organizationId: organization.id, title: "SMOKE Support", description: "Ticket temporaire", category: "Autre", priority: "Urgente", status: "Nouveau", assignedTo: author.id }, author.id)).id;
    await updateTicket(ticketId, { status: "En cours" }, author.id);
    await addTicketEvent({ ticketId, authorId: author.id, eventType: "Commentaire", content: "Vérification du journal" });
    const ticket = await getTicket(ticketId);
    if (!ticket || ticket.ticket.status !== "En cours" || ticket.events.length < 2) throw new Error("Cycle ticket invalide");

    taskId = (await createTask({ title: "SMOKE Tâche", assignedTo: author.id, dueDate: new Date().toISOString().slice(0, 10), priority: "Haute", status: "A Faire" })).id;
    await updateTask(taskId, { status: "Fait" });
    const task = (await db.select().from(adminTasks).where(eq(adminTasks.id, taskId)).limit(1))[0];
    if (!task?.completedAt) throw new Error("Clôture de tâche invalide");

    invoiceId = (await createInvoice({ organizationId: organization.id, invoiceNumber: `SMOKE-${Date.now()}`, amount: "123.45", status: "Envoyee", dueDate: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10) }, author.id)).id;
    await remindInvoice(invoiceId, author.id);
    await updateInvoice(invoiceId, { status: "Payee", paidAt: new Date().toISOString().slice(0, 10) }, author.id);
    const invoice = (await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1))[0];
    if (invoice?.status !== "Payee" || invoice.reminderCount !== 1) throw new Error("Cycle facture invalide");

    contractId = (await createContract({ organizationId: organization.id, title: "SMOKE Contrat", type: "Contrat", status: "Brouillon" }, author.id)).id;
    await updateContract(contractId, { status: "Actif", endDate: new Date(Date.now() + 25 * 86_400_000).toISOString().slice(0, 10) }, author.id);
    await uploadContractDocument(contractId, { fileName: "smoke-support.txt", mimeType: "text/plain", base64: Buffer.from("Document de contrôle Support").toString("base64") }, author.id);
    const contract = (await db.select().from(establishmentContracts).where(eq(establishmentContracts.id, contractId)).limit(1))[0];
    if (contract?.status !== "Actif" || !contract.documentUrl) throw new Error("Cycle contrat ou stockage documentaire invalide");

    eventId = (await createEvent({ title: "SMOKE Agenda", eventType: "Rendez-vous Interne", organizerId: author.id, startAt: new Date(Date.now() + 3_600_000), allDay: false })).id;
    await updateEvent(eventId, { location: "Salle test" });
    const calendarEvent = (await db.select().from(calendarEvents).where(eq(calendarEvents.id, eventId)).limit(1))[0];
    if (calendarEvent?.location !== "Salle test") throw new Error("Cycle agenda invalide");

    const refreshed = await refreshSupportAlerts();
    if (!refreshed.processed) throw new Error("Moteur d’alertes non exécuté");
    console.log("Smoke Secrétariat & Support réussi : ticket, journal, tâche, facture, contrat, agenda et alertes vérifiés.");
  } finally {
    if (ticketId) { await db.delete(supportAlerts).where(and(eq(supportAlerts.entityType, "Ticket"), eq(supportAlerts.entityId, ticketId))); await db.delete(supportTicketEvents).where(eq(supportTicketEvents.ticketId, ticketId)); await deleteTicket(ticketId); }
    if (taskId) { await db.delete(supportAlerts).where(and(eq(supportAlerts.entityType, "Tache"), eq(supportAlerts.entityId, taskId))); await deleteTask(taskId); }
    if (invoiceId) { await db.delete(supportAlerts).where(and(eq(supportAlerts.entityType, "Facture"), eq(supportAlerts.entityId, invoiceId))); await deleteInvoice(invoiceId, author.id); }
    if (contractId) { await db.delete(supportAlerts).where(and(eq(supportAlerts.entityType, "Contrat"), eq(supportAlerts.entityId, contractId))); await deleteContract(contractId, author.id); }
    if (eventId) { await db.delete(supportAlerts).where(and(eq(supportAlerts.entityType, "Evenement"), eq(supportAlerts.entityId, eventId))); await deleteEvent(eventId); }
  }
}

smoke().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
