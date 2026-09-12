import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  adminTasks,
  calendarEvents,
  contacts,
  establishmentContracts,
  internalUsers,
  invoices,
  organizations,
  subscriptions,
  supportTicketEvents,
  supportTickets,
} from "../drizzle/schema";
import { refreshSupportAlerts } from "../server/support.db";
import { computeSlaDueAt } from "../server/support.logic";

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (days: number, hour = 10) => {
  const date = new Date(Date.now() + days * 86_400_000);
  const wholeHour = Math.floor(hour);
  date.setUTCHours(wholeHour, Math.round((hour - wholeHour) * 60), 0, 0);
  return date;
};
const addHours = (hours: number) => new Date(Date.now() + hours * 3_600_000);

async function seed() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  const db = drizzle(process.env.DATABASE_URL);
  const existing = await db.select({ id: calendarEvents.id }).from(calendarEvents).limit(1);
  if (existing.length) {
    const result = await refreshSupportAlerts();
    console.log(`Les données Support existent déjà ; ${result.alerts} alertes recalculées.`);
    return;
  }

  const users = await db.select().from(internalUsers);
  let secretary = users.find(user => user.email === "emilie.laurent@medactio.fr");
  if (!secretary) {
    await db.insert(internalUsers).values({ fullName: "Émilie Laurent", email: "emilie.laurent@medactio.fr", role: "secretariat", jobTitle: "Office & Customer Support" });
    secretary = (await db.select().from(internalUsers).where(eq(internalUsers.email, "emilie.laurent@medactio.fr")).limit(1))[0]!;
  }
  const admin = users.find(user => user.role === "direction") || secretary;
  const orgRows = await db.select().from(organizations);
  const contactRows = await db.select().from(contacts);
  const subscriptionRows = await db.select().from(subscriptions);
  const org = (name: string) => orgRows.find(item => item.name === name)!;
  const contact = (email: string) => contactRows.find(item => item.email === email)!;
  const subscription = (name: string) => subscriptionRows.find(item => item.organizationId === org(name).id);

  const existingTickets = await db.select().from(supportTickets);
  for (const ticket of existingTickets) {
    await db.update(supportTickets).set({
      assignedTo: secretary.id,
      slaDueAt: computeSlaDueAt(ticket.createdAt, ticket.priority),
      firstRespondedAt: ticket.status === "Nouveau" ? null : new Date(ticket.createdAt.getTime() + 2 * 3_600_000),
    }).where(eq(supportTickets.id, ticket.id));
  }

  const newTicketRows = [
    { organizationId: org("CHU de Rennes").id, contactId: contact("camille.renard@chu-rennes.fr").id, title: "Synchronisation du dictionnaire médical", description: "Les nouveaux termes validés n’apparaissent pas dans le profil urgences.", category: "Support Technique" as const, priority: "Haute" as const, status: "En cours" as const, assignedTo: secretary.id, createdAt: addHours(-6), firstRespondedAt: addHours(-5), slaDueAt: addHours(2) },
    { organizationId: org("Hôpital Foch").id, contactId: contact("julie.perrin@hopital-foch.com").id, title: "Ajout d’un nouveau praticien", description: "Créer l’accès du Dr Morel avant sa prise de poste.", category: "Acces Licence" as const, priority: "Moyenne" as const, status: "Nouveau" as const, assignedTo: secretary.id, createdAt: addHours(-4), slaDueAt: addHours(20) },
    { organizationId: org("Centre Hospitalier de Chartres").id, contactId: contact("sarah.benhamou@ch-chartres.fr").id, title: "Question sur la facture de septembre", description: "Le service financier demande le détail des licences facturées.", category: "Facturation" as const, priority: "Basse" as const, status: "Resolu" as const, assignedTo: secretary.id, createdAt: addHours(-120), firstRespondedAt: addHours(-116), resolvedAt: addHours(-96), slaDueAt: addHours(-72) },
    { organizationId: org("Clinique du Val d’Ouest").id, contactId: contact("ines.cohen@cvo.fr").id, title: "Microphone non reconnu sur un poste", description: "Le périphérique USB n’est plus détecté après mise à jour.", category: "Support Technique" as const, priority: "Urgente" as const, status: "Nouveau" as const, assignedTo: secretary.id, createdAt: addHours(-7), slaDueAt: addHours(-3) },
  ];
  await db.insert(supportTickets).values(newTicketRows);
  const allTickets = await db.select().from(supportTickets);
  const ticketByTitle = (title: string) => allTickets.find(ticket => ticket.title === title)!;
  await db.insert(supportTicketEvents).values([
    { ticketId: ticketByTitle("Synchronisation du dictionnaire médical").id, authorId: secretary.id, eventType: "Commentaire", content: "Demande reproduite et transmise à l’équipe technique avec le profil concerné." },
    { ticketId: ticketByTitle("Synchronisation du dictionnaire médical").id, authorId: secretary.id, eventType: "Changement Statut", content: "Prise en charge du ticket et passage au statut En cours." },
    { ticketId: ticketByTitle("Question sur la facture de septembre").id, authorId: secretary.id, eventType: "Relance Client", content: "Détail des lignes transmis au service financier de l’établissement." },
    { ticketId: ticketByTitle("Question sur la facture de septembre").id, authorId: secretary.id, eventType: "Changement Statut", content: "Confirmation reçue, ticket résolu." },
  ]);

  await db.insert(adminTasks).values([
    { title: "Préparer les accès de la nouvelle alternante", description: "Créer les comptes et transmettre le guide d’accueil.", assignedTo: secretary.id, dueDate: dateOnly(addDays(1)), priority: "Haute", status: "En Cours" },
    { title: "Mettre à jour le registre des conventions", description: "Contrôler les échéances du trimestre.", assignedTo: secretary.id, dueDate: dateOnly(addDays(-2)), priority: "Haute", status: "A Faire" },
    { title: "Réserver la salle du comité produit", assignedTo: secretary.id, dueDate: dateOnly(addDays(4)), priority: "Moyenne", status: "A Faire" },
    { title: "Archiver les factures d’août", assignedTo: secretary.id, dueDate: dateOnly(addDays(-8)), priority: "Basse", status: "Fait", completedAt: addDays(-7) },
    { title: "Confirmer le rendez-vous DPO", organizationId: org("Institut Bergonié").id, assignedTo: secretary.id, dueDate: dateOnly(addDays(2)), priority: "Moyenne", status: "A Faire" },
  ]);

  await db.insert(invoices).values([
    { organizationId: org("CHU de Rennes").id, subscriptionId: subscription("CHU de Rennes")?.id, invoiceNumber: "FAC-2026-0091", amount: "13500", status: "Envoyee", issuedAt: dateOnly(addDays(-12)), dueDate: dateOnly(addDays(18)), nextReminderDate: dateOnly(addDays(12)) },
    { organizationId: org("Institut Bergonié").id, subscriptionId: subscription("Institut Bergonié")?.id, invoiceNumber: "FAC-2026-0087", amount: "19200", status: "En Retard", issuedAt: dateOnly(addDays(-52)), dueDate: dateOnly(addDays(-22)), reminderCount: 1, lastReminderAt: addDays(-8), nextReminderDate: dateOnly(addDays(1)), notes: "Relance adressée au service comptable." },
    { organizationId: org("Clinique du Val d’Ouest").id, subscriptionId: subscription("Clinique du Val d’Ouest")?.id, invoiceNumber: "FAC-2026-0094", amount: "1800", status: "Brouillon", issuedAt: dateOnly(addDays(-2)), dueDate: dateOnly(addDays(28)) },
    { organizationId: org("Hôpital Foch").id, subscriptionId: subscription("Hôpital Foch")?.id, invoiceNumber: "FAC-2026-0082", amount: "23400", status: "Payee", issuedAt: dateOnly(addDays(-68)), dueDate: dateOnly(addDays(-38)), paidAt: dateOnly(addDays(-41)) },
    { organizationId: org("Centre Hospitalier de Chartres").id, subscriptionId: subscription("Centre Hospitalier de Chartres")?.id, invoiceNumber: "FAC-2026-0089", amount: "12000", status: "En Retard", issuedAt: dateOnly(addDays(-45)), dueDate: dateOnly(addDays(-15)), reminderCount: 2, lastReminderAt: addDays(-5), nextReminderDate: dateOnly(addDays(2)) },
  ]);

  await db.insert(establishmentContracts).values([
    { organizationId: org("CHU de Rennes").id, title: "Convention de déploiement urgences", type: "Convention", status: "Actif", startDate: dateOnly(addDays(-220)), endDate: dateOnly(addDays(28)), signedAt: dateOnly(addDays(-225)), notes: "Prévoir l’avenant de renouvellement." },
    { organizationId: org("Institut Bergonié").id, title: "Contrat de licence établissement", type: "Contrat", status: "Actif", startDate: dateOnly(addDays(-145)), endDate: dateOnly(addDays(74)), signedAt: dateOnly(addDays(-150)) },
    { organizationId: org("Clinique du Val d’Ouest").id, title: "DPA relatif au traitement des données", type: "DPA", status: "A Signer", startDate: dateOnly(addDays(-65)), notes: "Version validée par le DPO, signature attendue." },
    { organizationId: org("Hôpital Foch").id, title: "Avenant extension médecine interne", type: "Avenant", status: "Actif", startDate: dateOnly(addDays(-120)), endDate: dateOnly(addDays(52)), signedAt: dateOnly(addDays(-125)) },
    { organizationId: org("Centre Hospitalier de Chartres").id, title: "Convention cadre 2026", type: "Convention", status: "Actif", startDate: dateOnly(addDays(-240)), endDate: dateOnly(addDays(126)), signedAt: dateOnly(addDays(-245)) },
  ]);

  await db.insert(calendarEvents).values([
    { title: "Point support hebdomadaire", description: "Revue des tickets prioritaires et répartition.", eventType: "Rendez-vous Interne", organizerId: secretary.id, startAt: addDays(1, 9), endAt: addDays(1, 9.5), location: "Visioconférence" },
    { title: "Suivi DPO — Institut Bergonié", eventType: "Rendez-vous Client", organizationId: org("Institut Bergonié").id, contactId: contact("lea.brun@bergonie.fr").id, organizerId: secretary.id, startAt: addDays(2, 14), endAt: addDays(2, 15), location: "Teams" },
    { title: "Démo nouveaux praticiens", eventType: "Demo", organizationId: org("Clinique du Val d’Ouest").id, contactId: contact("ines.cohen@cvo.fr").id, organizerId: secretary.id, startAt: addDays(4, 11), endAt: addDays(4, 12), location: "Visioconférence" },
    { title: "Échéance facture FAC-2026-0091", eventType: "Echeance", organizationId: org("CHU de Rennes").id, organizerId: secretary.id, startAt: addDays(18, 9), allDay: true },
    { title: "Comité produit mensuel", eventType: "Rendez-vous Interne", organizerId: admin.id, startAt: addDays(6, 16), endAt: addDays(6, 17.5), location: "Bureau Medactio" },
  ]);

  const result = await refreshSupportAlerts();
  console.log(`Jeu de démonstration Support créé : ${result.processed} éléments et ${result.alerts} alertes analysés.`);
}

seed().catch(error => {
  console.error(error);
  process.exit(1);
});
