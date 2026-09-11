import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  contacts,
  customerOnboardingTasks,
  organizations,
  subscriptions,
  supportTickets,
  usageLogs,
} from "../drizzle/schema";
import { refreshCustomerAlerts } from "../server/customer-success.db";

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (days: number) => new Date(Date.now() + days * 86_400_000);

async function seed() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  const db = drizzle(process.env.DATABASE_URL);
  const existingSubscription = await db.select({ id: subscriptions.id }).from(subscriptions).limit(1);
  if (existingSubscription.length) {
    await refreshCustomerAlerts();
    console.log("Les données Clients & Licences existent déjà ; alertes recalculées.");
    return;
  }

  const initialOrganizations = await db.select().from(organizations);
  const newOrganizations = [
    { name: "CHU de Rennes", type: "Hopital Public" as const, city: "Rennes", postalCode: "35000", status: "Client Actif" as const, leadSource: "Salon Professionnel" as const, annualContractValue: "54000", contractStartDate: dateOnly(addDays(-220)), contractEndDate: dateOnly(addDays(28)), onboardingStatus: "Termine" as const },
    { name: "Institut Bergonié", type: "Hopital Public" as const, city: "Bordeaux", postalCode: "33000", status: "Client Actif" as const, leadSource: "Recommandation" as const, annualContractValue: "38400", contractStartDate: dateOnly(addDays(-145)), contractEndDate: dateOnly(addDays(74)), onboardingStatus: "En Cours" as const },
    { name: "Clinique du Val d’Ouest", type: "Clinique Privee" as const, city: "Écully", postalCode: "69130", status: "Client Actif" as const, leadSource: "Site Web" as const, annualContractValue: "21600", contractStartDate: dateOnly(addDays(-65)), contractEndDate: dateOnly(addDays(300)), onboardingStatus: "En Cours" as const },
    { name: "Hôpital Foch", type: "Hopital Public" as const, city: "Suresnes", postalCode: "92150", status: "Client Actif" as const, leadSource: "Reseau AGAPE" as const, annualContractValue: "46800", contractStartDate: dateOnly(addDays(-390)), contractEndDate: dateOnly(addDays(52)), onboardingStatus: "Termine" as const },
  ];
  const knownNames = new Set(initialOrganizations.map(org => org.name));
  const missingOrganizations = newOrganizations.filter(org => !knownNames.has(org.name));
  if (missingOrganizations.length) await db.insert(organizations).values(missingOrganizations);

  const orgRows = await db.select().from(organizations);
  const org = (name: string) => {
    const row = orgRows.find(item => item.name === name);
    if (!row) throw new Error(`Organisation manquante : ${name}`);
    return row;
  };

  const contactRows = await db.select().from(contacts);
  const knownEmails = new Set(contactRows.map(contact => contact.email));
  const contactSeeds = [
    { organizationId: org("Centre Hospitalier de Chartres").id, fullName: "Dr Sarah Benhamou", email: "sarah.benhamou@ch-chartres.fr", specialty: "Médecine polyvalente", jobTitle: "Praticienne hospitalière", isLicenseActive: true, licenseActivatedAt: dateOnly(addDays(-230)) },
    { organizationId: org("CH Intercommunal de Créteil").id, fullName: "Dr Nadia Bensaïd", email: "nadia.bensaid@chicreteil.fr", specialty: "Gériatrie", jobTitle: "Cheffe de pôle", isLicenseActive: true, licenseActivatedAt: dateOnly(addDays(-180)) },
    { organizationId: org("CHU de Rennes").id, fullName: "Dr Camille Renard", email: "camille.renard@chu-rennes.fr", specialty: "Urgences", jobTitle: "Référente médicale", isLicenseActive: true, licenseActivatedAt: dateOnly(addDays(-205)) },
    { organizationId: org("CHU de Rennes").id, fullName: "Dr Hugo Lambert", email: "hugo.lambert@chu-rennes.fr", specialty: "Neurologie", jobTitle: "Praticien hospitalier", isLicenseActive: true, licenseActivatedAt: dateOnly(addDays(-190)) },
    { organizationId: org("CHU de Rennes").id, fullName: "Dr Salomé Petit", email: "salome.petit@chu-rennes.fr", specialty: "Cardiologie", jobTitle: "Praticienne hospitalière", isLicenseActive: true, licenseActivatedAt: dateOnly(addDays(-185)) },
    { organizationId: org("Institut Bergonié").id, fullName: "Dr Léa Brun", email: "lea.brun@bergonie.fr", specialty: "Oncologie", jobTitle: "Cheffe de service", isLicenseActive: true, licenseActivatedAt: dateOnly(addDays(-120)) },
    { organizationId: org("Institut Bergonié").id, fullName: "Dr Maxime Girard", email: "maxime.girard@bergonie.fr", specialty: "Radiothérapie", jobTitle: "Praticien", isLicenseActive: false },
    { organizationId: org("Clinique du Val d’Ouest").id, fullName: "Dr Inès Cohen", email: "ines.cohen@cvo.fr", specialty: "Pédiatrie", jobTitle: "Praticienne", isLicenseActive: true, licenseActivatedAt: dateOnly(addDays(-45)) },
    { organizationId: org("Clinique du Val d’Ouest").id, fullName: "Dr Nicolas Roy", email: "nicolas.roy@cvo.fr", specialty: "Chirurgie", jobTitle: "Praticien", isLicenseActive: false },
    { organizationId: org("Hôpital Foch").id, fullName: "Dr Julie Perrin", email: "julie.perrin@hopital-foch.com", specialty: "Pneumologie", jobTitle: "Cheffe de service", isLicenseActive: true, licenseActivatedAt: dateOnly(addDays(-360)) },
    { organizationId: org("Hôpital Foch").id, fullName: "Dr Mehdi Simon", email: "mehdi.simon@hopital-foch.com", specialty: "Médecine interne", jobTitle: "Praticien", isLicenseActive: true, licenseActivatedAt: dateOnly(addDays(-330)) },
  ].filter(contact => !knownEmails.has(contact.email));
  if (contactSeeds.length) await db.insert(contacts).values(contactSeeds);

  await db.insert(subscriptions).values([
    { organizationId: org("Centre Hospitalier de Chartres").id, planName: "Établissement 2", seatsPurchased: 2, pricePerSeat: "12000", billingCycle: "Annuel", status: "Actif", startDate: dateOnly(addDays(-240)), renewalDate: dateOnly(addDays(126)) },
    { organizationId: org("CH Intercommunal de Créteil").id, planName: "Établissement 2", seatsPurchased: 2, pricePerSeat: "13500", billingCycle: "Annuel", status: "Actif", startDate: dateOnly(addDays(-190)), renewalDate: dateOnly(addDays(170)) },
    { organizationId: org("CHU de Rennes").id, planName: "Enterprise 4", seatsPurchased: 4, pricePerSeat: "13500", billingCycle: "Annuel", status: "Actif", startDate: dateOnly(addDays(-220)), renewalDate: dateOnly(addDays(28)) },
    { organizationId: org("Institut Bergonié").id, planName: "Établissement 2", seatsPurchased: 2, pricePerSeat: "19200", billingCycle: "Annuel", status: "Actif", startDate: dateOnly(addDays(-145)), renewalDate: dateOnly(addDays(74)) },
    { organizationId: org("Clinique du Val d’Ouest").id, planName: "Clinique 2", seatsPurchased: 2, pricePerSeat: "900", billingCycle: "Mensuel", status: "Actif", startDate: dateOnly(addDays(-65)), renewalDate: dateOnly(addDays(25)) },
    { organizationId: org("Hôpital Foch").id, planName: "Établissement 2", seatsPurchased: 2, pricePerSeat: "23400", billingCycle: "Annuel", status: "Actif", startDate: dateOnly(addDays(-390)), renewalDate: dateOnly(addDays(52)) },
    { organizationId: org("Groupe Santé Océan").id, planName: "Groupement 3", seatsPurchased: 3, pricePerSeat: "7333.33", billingCycle: "Annuel", status: "Resilie", startDate: dateOnly(addDays(-500)), renewalDate: dateOnly(addDays(-135)), cancelledAt: dateOnly(addDays(-130)), cancellationReason: "Budget gelé et usage insuffisant dans les services pilotes." },
  ]);

  const allContacts = await db.select().from(contacts);
  const byEmail = (email: string) => allContacts.find(contact => contact.email === email)!;
  const onboardingStates = [
    { org: "Centre Hospitalier de Chartres", done: 3 },
    { org: "CH Intercommunal de Créteil", done: 2 },
    { org: "CHU de Rennes", done: 3 },
    { org: "Institut Bergonié", done: 2 },
    { org: "Clinique du Val d’Ouest", done: 1 },
    { org: "Hôpital Foch", done: 3 },
  ];
  const items = ["Compte Cree", "Formation Effectuee", "Premiers Ecrits Generes"] as const;
  await db.insert(customerOnboardingTasks).values(onboardingStates.flatMap(state => items.map((itemKey, index) => ({
    organizationId: org(state.org).id,
    itemKey,
    sortOrder: (index + 1) * 10,
    completed: index < state.done,
    completedAt: index < state.done ? addDays(-60 + index * 12) : null,
  }))));

  const usagePatterns = [
    { org: "Centre Hospitalier de Chartres", email: "sarah.benhamou@ch-chartres.fr", current: [24, 31, 28, 35], previous: [20, 22, 25, 24] },
    { org: "CH Intercommunal de Créteil", email: "nadia.bensaid@chicreteil.fr", current: [7, 5, 4, 3], previous: [18, 16, 14, 12] },
    { org: "CHU de Rennes", email: "camille.renard@chu-rennes.fr", current: [44, 52, 49, 58], previous: [32, 38, 41, 43] },
    { org: "CHU de Rennes", email: "hugo.lambert@chu-rennes.fr", current: [30, 28, 37, 34], previous: [24, 27, 29, 31] },
    { org: "CHU de Rennes", email: "salome.petit@chu-rennes.fr", current: [18, 21, 23, 26], previous: [16, 18, 19, 20] },
    { org: "Institut Bergonié", email: "lea.brun@bergonie.fr", current: [8, 6, 5, 4], previous: [22, 19, 18, 16] },
    { org: "Clinique du Val d’Ouest", email: "ines.cohen@cvo.fr", current: [2, 3, 1, 2], previous: [0, 2, 3, 2] },
    { org: "Hôpital Foch", email: "julie.perrin@hopital-foch.com", current: [38, 42, 45, 40], previous: [35, 37, 39, 41] },
    { org: "Hôpital Foch", email: "mehdi.simon@hopital-foch.com", current: [26, 29, 31, 33], previous: [24, 26, 28, 30] },
  ];
  const logs = usagePatterns.flatMap(pattern => [
    ...pattern.current.map((count, index) => ({ organizationId: org(pattern.org).id, contactId: byEmail(pattern.email).id, documentsGeneratedCount: count, logDate: dateOnly(addDays(-3 - index * 7)) })),
    ...pattern.previous.map((count, index) => ({ organizationId: org(pattern.org).id, contactId: byEmail(pattern.email).id, documentsGeneratedCount: count, logDate: dateOnly(addDays(-34 - index * 7)) })),
  ]);
  await db.insert(usageLogs).values(logs);

  await db.insert(supportTickets).values([
    { organizationId: org("CH Intercommunal de Créteil").id, contactId: byEmail("nadia.bensaid@chicreteil.fr").id, title: "Droits d’accès après changement de service", description: "Le profil doit être rattaché au nouveau pôle.", category: "Acces Licence", priority: "Haute", status: "En cours" },
    { organizationId: org("Institut Bergonié").id, contactId: byEmail("lea.brun@bergonie.fr").id, title: "Modèle de compte rendu non disponible", description: "Le modèle oncologie n’apparaît pas dans la bibliothèque.", category: "Support Technique", priority: "Urgente", status: "Nouveau" },
    { organizationId: org("Clinique du Val d’Ouest").id, contactId: byEmail("ines.cohen@cvo.fr").id, title: "Planifier la formation des nouveaux praticiens", category: "Onboarding", priority: "Moyenne", status: "En attente client" },
  ]);

  const result = await refreshCustomerAlerts();
  console.log(`Jeu de démonstration Succès Client créé : ${result.processedCustomers} comptes et ${result.alerts} alertes analysés.`);
}

seed().catch(error => {
  console.error(error);
  process.exit(1);
});
