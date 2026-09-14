import "dotenv/config";
import { createDb } from "../drizzle/client";
import { eq } from "drizzle-orm";
import {
  contacts,
  deals,
  followUps,
  interactions,
  internalUsers,
  organizations,
  quotes,
} from "../drizzle/schema";

async function seed() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  const db = createDb(process.env.DATABASE_URL);
  const existing = await db.select({ id: organizations.id }).from(organizations).limit(1);
  if (existing.length) {
    console.log("Le jeu de démonstration existe déjà.");
    return;
  }

  await db.insert(internalUsers).values([
    { fullName: "Sophie Bernard", email: "sophie.bernard@medactio.fr", role: "commercial", jobTitle: "Responsable Grands Comptes" },
    { fullName: "Thomas Leroy", email: "thomas.leroy@medactio.fr", role: "commercial", jobTitle: "Business Developer" },
    { fullName: "Claire Moreau", email: "claire.moreau@medactio.fr", role: "direction", jobTitle: "Direction" },
  ]);

  const ownerRows = await db.select().from(internalUsers);
  const sophie = ownerRows.find(row => row.email === "sophie.bernard@medactio.fr")!;
  const thomas = ownerRows.find(row => row.email === "thomas.leroy@medactio.fr")!;

  await db.insert(organizations).values([
    { name: "CHU de Nantes", type: "Hopital Public", city: "Nantes", postalCode: "44000", address: "1 place Alexis-Ricordeau", status: "Negociation", leadSource: "Salon Professionnel", annualContractValue: "42000" },
    { name: "Clinique Saint-Augustin", type: "Clinique Privee", city: "Bordeaux", postalCode: "33000", address: "114 avenue d'Arès", status: "En Demo", leadSource: "Recommandation", annualContractValue: "18500" },
    { name: "GHT Alpes Dauphiné", type: "Groupement Hospitalier", city: "Grenoble", postalCode: "38000", status: "Prospect", leadSource: "LinkedIn", annualContractValue: "68000" },
    { name: "Centre Hospitalier de Chartres", type: "Hopital Public", city: "Chartres", postalCode: "28000", status: "Client Actif", leadSource: "Reseau AGAPE", annualContractValue: "24000", contractStartDate: "2026-01-15", contractEndDate: "2027-01-14", onboardingStatus: "Termine" },
    { name: "Hôpital Privé de Provence", type: "Clinique Privee", city: "Aix-en-Provence", postalCode: "13100", status: "En Demo", leadSource: "Site Web", annualContractValue: "31500" },
    { name: "Cabinet Dr Martin", type: "Cabinet Liberal", city: "Lyon", postalCode: "69006", status: "Prospect", leadSource: "Site Web", annualContractValue: "3600" },
    { name: "CH Intercommunal de Créteil", type: "Hopital Public", city: "Créteil", postalCode: "94000", status: "Client Actif", leadSource: "Salon Professionnel", annualContractValue: "27000", contractStartDate: "2026-03-01", contractEndDate: "2027-02-28", onboardingStatus: "En Cours" },
    { name: "Groupe Santé Océan", type: "Groupement Hospitalier", city: "La Rochelle", postalCode: "17000", status: "Inactif", leadSource: "Prospection a Froid", annualContractValue: "0" },
  ]);

  const orgRows = await db.select().from(organizations);
  const org = (name: string) => orgRows.find(row => row.name === name)!;

  await db.insert(contacts).values([
    { organizationId: org("CHU de Nantes").id, fullName: "Dr Élodie Martin", email: "elodie.martin@chu-nantes.fr", phone: "02 40 08 33 33", specialty: "Cardiologie", jobTitle: "Cheffe de service" },
    { organizationId: org("CHU de Nantes").id, fullName: "Marc Duval", email: "marc.duval@chu-nantes.fr", phone: "02 40 08 31 20", specialty: "Systèmes d'information", jobTitle: "DSI adjoint" },
    { organizationId: org("Clinique Saint-Augustin").id, fullName: "Anne Rousseau", email: "anne.rousseau@saint-augustin.fr", phone: "05 56 00 22 14", specialty: "Direction", jobTitle: "Directrice des opérations" },
    { organizationId: org("GHT Alpes Dauphiné").id, fullName: "Pierre Fabre", email: "pierre.fabre@ght-alpes.fr", phone: "04 76 76 55 44", specialty: "Qualité", jobTitle: "Responsable qualité" },
    { organizationId: org("Centre Hospitalier de Chartres").id, fullName: "Dr Sarah Benhamou", email: "sarah.benhamou@ch-chartres.fr", specialty: "Médecine polyvalente", jobTitle: "Praticienne hospitalière", isLicenseActive: true, licenseActivatedAt: "2026-01-22" },
    { organizationId: org("Hôpital Privé de Provence").id, fullName: "Julien Caron", email: "julien.caron@hpp.fr", phone: "04 42 00 19 02", specialty: "Achats", jobTitle: "Directeur des achats" },
    { organizationId: org("Cabinet Dr Martin").id, fullName: "Dr Luc Martin", email: "luc.martin@cabinet-martin.fr", phone: "04 72 10 20 30", specialty: "Médecine générale", jobTitle: "Médecin généraliste" },
    { organizationId: org("CH Intercommunal de Créteil").id, fullName: "Dr Nadia Bensaïd", email: "nadia.bensaid@chicreteil.fr", specialty: "Gériatrie", jobTitle: "Cheffe de pôle", isLicenseActive: true, licenseActivatedAt: "2026-03-10" },
  ]);

  await db.insert(deals).values([
    { organizationId: org("CHU de Nantes").id, assignedTo: sophie.id, title: "Déploiement pilote — cardiologie", amount: "42000", stage: "Devis Envoye", expectedCloseDate: "2026-10-15", notes: "Pilote de 3 mois sur 25 praticiens.", createdAt: new Date("2026-06-18T09:00:00Z") },
    { organizationId: org("Clinique Saint-Augustin").id, assignedTo: thomas.id, title: "Équipement service médecine", amount: "18500", stage: "Demo Effectuee", expectedCloseDate: "2026-10-30", notes: "Comité de direction favorable, validation DPO en cours.", createdAt: new Date("2026-07-12T09:00:00Z") },
    { organizationId: org("GHT Alpes Dauphiné").id, assignedTo: sophie.id, title: "Accord-cadre GHT", amount: "68000", stage: "Rendez-vous Place", expectedCloseDate: "2026-12-18", createdAt: new Date("2026-08-25T09:00:00Z") },
    { organizationId: org("Hôpital Privé de Provence").id, assignedTo: thomas.id, title: "Pilote SSR — 30 licences", amount: "31500", stage: "Demo Effectuee", expectedCloseDate: "2026-11-07", createdAt: new Date("2026-07-30T09:00:00Z") },
    { organizationId: org("Cabinet Dr Martin").id, assignedTo: thomas.id, title: "Offre praticien annuel", amount: "3600", stage: "Prospection", expectedCloseDate: "2026-09-25", createdAt: new Date("2026-09-03T09:00:00Z") },
    { organizationId: org("Centre Hospitalier de Chartres").id, assignedTo: sophie.id, title: "Contrat établissement 2026", amount: "24000", stage: "Gagne", expectedCloseDate: "2026-01-10", createdAt: new Date("2025-10-06T09:00:00Z"), closedAt: new Date("2026-01-08T14:00:00Z") },
    { organizationId: org("CH Intercommunal de Créteil").id, assignedTo: sophie.id, title: "Déploiement gériatrie", amount: "27000", stage: "Gagne", expectedCloseDate: "2026-02-20", createdAt: new Date("2025-11-18T09:00:00Z"), closedAt: new Date("2026-02-16T14:00:00Z") },
    { organizationId: org("Groupe Santé Océan").id, assignedTo: thomas.id, title: "Consultation solution rédaction", amount: "22000", stage: "Perdu", expectedCloseDate: "2026-06-30", lossReason: "Projet interne reporté au prochain exercice.", createdAt: new Date("2026-03-02T09:00:00Z"), closedAt: new Date("2026-06-22T14:00:00Z") },
    { organizationId: org("CHU de Nantes").id, assignedTo: sophie.id, title: "Extension médecine polyvalente", amount: "15500", stage: "Prospection", expectedCloseDate: "2027-01-15", createdAt: new Date("2026-09-05T09:00:00Z") },
  ]);

  const dealRows = await db.select().from(deals);
  const deal = (title: string) => dealRows.find(row => row.title === title)!;
  const contactRows = await db.select().from(contacts);
  const contact = (email: string) => contactRows.find(row => row.email === email)!;

  await db.insert(interactions).values([
    { dealId: deal("Déploiement pilote — cardiologie").id, contactId: contact("elodie.martin@chu-nantes.fr").id, createdBy: sophie.id, type: "Reunion", content: "Démonstration réalisée avec le service. Très bon accueil sur la dictée et la pseudonymisation.", occurredAt: new Date("2026-09-02T12:30:00Z") },
    { dealId: deal("Déploiement pilote — cardiologie").id, contactId: contact("marc.duval@chu-nantes.fr").id, createdBy: sophie.id, type: "Email", content: "Devis et dossier de sécurité transmis à la DSI.", occurredAt: new Date("2026-09-08T15:15:00Z") },
    { dealId: deal("Équipement service médecine").id, contactId: contact("anne.rousseau@saint-augustin.fr").id, createdBy: thomas.id, type: "Appel", content: "Retour positif du comité médical. Le DPO souhaite recevoir le modèle de DPA.", occurredAt: new Date("2026-09-09T08:45:00Z") },
    { dealId: deal("Accord-cadre GHT").id, contactId: contact("pierre.fabre@ght-alpes.fr").id, createdBy: sophie.id, type: "Note", content: "Préparer un cas d'usage centré sur la lettre de liaison et les critères QLS.", occurredAt: new Date("2026-09-10T14:20:00Z") },
  ]);

  await db.insert(quotes).values([
    { dealId: deal("Déploiement pilote — cardiologie").id, quoteNumber: "DEV-2026-0042", amount: "42000", status: "Envoye", validUntil: "2026-10-15", sentAt: new Date("2026-09-08T15:15:00Z") },
    { dealId: deal("Équipement service médecine").id, quoteNumber: "DEV-2026-0041", amount: "18500", status: "Brouillon", validUntil: "2026-10-30" },
  ]);

  await db.insert(followUps).values([
    { dealId: deal("Déploiement pilote — cardiologie").id, assignedTo: sophie.id, type: "Devis sans reponse", dueAt: new Date("2026-09-15T08:00:00Z"), note: "Relancer la DSI et confirmer le calendrier du pilote." },
    { dealId: deal("Accord-cadre GHT").id, assignedTo: sophie.id, type: "RDV a confirmer", dueAt: new Date("2026-09-12T09:30:00Z"), note: "Confirmer la présence de la direction qualité." },
    { dealId: deal("Équipement service médecine").id, assignedTo: thomas.id, type: "Relance commerciale", dueAt: new Date("2026-09-16T10:00:00Z"), note: "Envoyer le DPA et proposer deux créneaux de suivi." },
  ]);

  console.log("Jeu de démonstration CRM créé avec succès.");
}

seed().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
