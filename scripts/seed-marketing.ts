import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { contentCalendar, internalUsers, marketingAssets, marketingCampaigns, marketingEvents } from "../drizzle/schema";
import { captureLead, updateLead } from "../server/marketing.db";
import { storagePut } from "../server/storage";

const utc = (value: string) => new Date(`${value}T10:00:00Z`);

async function run() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL manquante");
  const db = drizzle(process.env.DATABASE_URL);
  const owner = (await db.select().from(internalUsers).where(eq(internalUsers.email, "marketing@medactio.fr")).limit(1))[0];
  if (!owner) throw new Error("Profil Marketing absent : exécutez seed-analytics.ts d’abord.");

  const enrichment = [
    ["Congrès Santé Numérique 2026", "Rencontrer les directions d’établissements et générer des rendez-vous qualifiés.", 40, "36000"],
    ["Webinaires Adoption IA", "Démontrer les usages concrets de Medactio et convertir les participants en démonstrations individuelles.", 55, "22000"],
    ["Contenus SEO par spécialité", "Accroître la visibilité organique sur les problématiques de rédaction médicale.", 85, "18000"],
    ["Acquisition établissements — T4", "Accélérer l’acquisition de nouveaux établissements par les réseaux sociaux professionnels.", 45, "12000"],
    ["Partenariat réseau AGAPE", "Activer le réseau partenaire pour obtenir des recommandations qualifiées.", 30, "27000"],
  ] as const;
  for (const [name, objective, targetLeads, attributedRevenue] of enrichment) {
    await db.update(marketingCampaigns).set({ objective, targetLeads, attributedRevenue }).where(eq(marketingCampaigns.name, name));
  }
  const campaigns = await db.select().from(marketingCampaigns);
  const campaign = (name: string) => {
    const row = campaigns.find(item => item.name === name);
    if (!row) throw new Error(`Campagne absente : ${name}`);
    return row;
  };

  const contents = [
    { campaign: "Contenus SEO par spécialité", title: "IA et comptes-rendus en psychiatrie : les bonnes pratiques", contentType: "Article de Blog", status: "Publie", publishDate: "2026-08-28", targetAudience: "Psychiatres et directions médicales", brief: "Article pédagogique orienté conformité et gain de temps.", draftContent: "Présenter les usages, garde-fous et bénéfices opérationnels de la rédaction assistée.", publicationUrl: "https://www.medactio.fr" },
    { campaign: "Acquisition établissements — T4", title: "Carrousel LinkedIn — 5 minutes gagnées par consultation", contentType: "Post Reseau Social", status: "Planifie", publishDate: "2026-09-18", targetAudience: "Directions d’établissements", brief: "Carrousel chiffré avec appel à réserver une démonstration.", draftContent: "Slide 1 : le temps médical est précieux. Slides suivantes : bénéfices et preuve.", publicationUrl: null },
    { campaign: "Webinaires Adoption IA", title: "Newsletter — invitation au webinaire d’octobre", contentType: "Newsletter", status: "En Redaction", publishDate: "2026-09-22", targetAudience: "Professionnels inscrits à la newsletter", brief: "Invitation courte, bénéfice métier et lien d’inscription.", draftContent: "Objet : Et si vos comptes-rendus se rédigeaient pendant la consultation ?", publicationUrl: null },
    { campaign: "Partenariat réseau AGAPE", title: "Étude de cas — déploiement multi-sites", contentType: "Article de Blog", status: "En Redaction", publishDate: "2026-10-02", targetAudience: "Groupements hospitaliers", brief: "Retour d’expérience structuré autour du déploiement et de l’adoption.", draftContent: "Contexte, méthode, adoption, résultats et prochaines étapes.", publicationUrl: null },
    { campaign: "Acquisition établissements — T4", title: "Post témoignage praticien", contentType: "Post Reseau Social", status: "Idee", publishDate: "2026-10-08", targetAudience: "Praticiens libéraux", brief: "Témoignage centré sur la simplicité et la qualité documentaire.", draftContent: null, publicationUrl: null },
    { campaign: "Webinaires Adoption IA", title: "Replay — sécuriser l’adoption de l’IA en santé", contentType: "Video", status: "Planifie", publishDate: "2026-10-16", targetAudience: "Directions SI et médicales", brief: "Découper le replay en chapitre et inclure un CTA de démonstration.", draftContent: null, publicationUrl: null },
  ] as const;
  for (const item of contents) {
    const campaignId = campaign(item.campaign).id;
    const existing = (await db.select().from(contentCalendar).where(and(eq(contentCalendar.title, item.title), eq(contentCalendar.campaignId, campaignId))).limit(1))[0];
    const data = { campaignId, title: item.title, contentType: item.contentType, status: item.status, publishDate: item.publishDate, targetAudience: item.targetAudience, brief: item.brief, draftContent: item.draftContent, publicationUrl: item.publicationUrl, assignedTo: owner.id };
    if (existing) await db.update(contentCalendar).set(data).where(eq(contentCalendar.id, existing.id)); else await db.insert(contentCalendar).values(data);
  }

  const events = [
    { campaign: "Webinaires Adoption IA", title: "Webinaire — Réduire la charge documentaire", eventType: "Webinaire", scheduledAt: utc("2026-08-27"), registrationCount: 58, attendeeCount: 41, meetingsBooked: 12, status: "Termine", meetingUrl: "https://www.medactio.fr", notes: "Replay transmis et relance des participants à fort intérêt." },
    { campaign: "Congrès Santé Numérique 2026", title: "Démonstration collective — Congrès Santé Numérique", eventType: "Demo Collective", scheduledAt: utc("2026-03-19"), registrationCount: 36, attendeeCount: 31, meetingsBooked: 9, status: "Termine", meetingUrl: null, notes: "Démonstration de 30 minutes sur le stand Medactio." },
    { campaign: "Webinaires Adoption IA", title: "Webinaire — IA responsable et pratique clinique", eventType: "Webinaire", scheduledAt: utc("2026-10-09"), registrationCount: 27, attendeeCount: 0, meetingsBooked: 0, status: "Planifie", meetingUrl: "https://www.medactio.fr", notes: "Invitations programmées en deux vagues." },
    { campaign: "Partenariat réseau AGAPE", title: "Atelier partenaires — parcours de recommandation", eventType: "Atelier", scheduledAt: utc("2026-10-21"), registrationCount: 18, attendeeCount: 0, meetingsBooked: 0, status: "Planifie", meetingUrl: "https://www.medactio.fr", notes: "Atelier de co-construction avec les référents régionaux." },
  ] as const;
  for (const item of events) {
    const campaignId = campaign(item.campaign).id;
    const existing = (await db.select().from(marketingEvents).where(and(eq(marketingEvents.title, item.title), eq(marketingEvents.campaignId, campaignId))).limit(1))[0];
    const data = { campaignId, title: item.title, eventType: item.eventType, scheduledAt: item.scheduledAt, registrationCount: item.registrationCount, attendeeCount: item.attendeeCount, meetingsBooked: item.meetingsBooked, status: item.status, meetingUrl: item.meetingUrl, notes: item.notes };
    if (existing) await db.update(marketingEvents).set(data).where(eq(marketingEvents.id, existing.id)); else await db.insert(marketingEvents).values(data);
  }

  const leads = [
    { campaign: "Webinaires Adoption IA", fullName: "Dr Camille Roussel", email: "camille.roussel.demo@medactio.fr", organizationName: "Clinique des Cèdres", organizationType: "Clinique Privee", status: "Qualifie", source: "Evenement", consentToContact: true, notes: "Souhaite une démonstration auprès de l’équipe médicale." },
    { campaign: "Acquisition établissements — T4", fullName: "Nicolas Aubert", email: "nicolas.aubert.demo@medactio.fr", organizationName: "GHT Horizon Santé", organizationType: "Groupement Hospitalier", status: "RDV Planifie", source: "Site Web", consentToContact: true, notes: "Formulaire LinkedIn, rendez-vous demandé pour octobre." },
    { campaign: "Contenus SEO par spécialité", fullName: "Dr Sarah Benali", email: "sarah.benali.demo@medactio.fr", organizationName: "Cabinet Médical République", organizationType: "Cabinet Liberal", status: "Nouveau", source: "Site Web", consentToContact: true, notes: "Téléchargement d’un guide SEO psychiatrie." },
    { campaign: "Partenariat réseau AGAPE", fullName: "Claire Dubois", email: "claire.dubois.demo@medactio.fr", organizationName: "Centre Hospitalier du Parc", organizationType: "Hopital Public", status: "Converti", source: "Evenement", consentToContact: true, notes: "Recommandation partenaire, opportunité gagnée." },
    { campaign: "Congrès Santé Numérique 2026", fullName: "Marc Legrand", email: "marc.legrand.demo@medactio.fr", organizationName: "Clinique Saint-Louis", organizationType: "Clinique Privee", status: "Rejete", source: "Evenement", consentToContact: true, notes: "Projet reporté à plus de douze mois." },
    { campaign: "Webinaires Adoption IA", fullName: "Dr Anne Richard", email: "anne.richard.demo@medactio.fr", organizationName: "Maison de Santé Valmy", organizationType: "Cabinet Liberal", status: "Qualifie", source: "Evenement", consentToContact: true, notes: "Intérêt pour un pilote de cinq praticiens." },
  ] as const;
  for (const item of leads) {
    const result = await captureLead({ campaignId: campaign(item.campaign).id, fullName: item.fullName, email: item.email, organizationName: item.organizationName, organizationType: item.organizationType, source: item.source, consentToContact: item.consentToContact, notes: item.notes, utmCampaign: item.campaign });
    await updateLead(result.id, { status: item.status });
  }

  const assetSeeds = [
    { campaign: "Acquisition établissements — T4", title: "Argumentaire établissements", assetType: "Argumentaire", fileName: "argumentaire-etablissements.txt", body: "Argumentaire Medactio — bénéfices, objections fréquentes et réponses recommandées." },
    { campaign: "Partenariat réseau AGAPE", title: "Étude de cas multi-sites", assetType: "Etude de Cas", fileName: "etude-cas-multisites.txt", body: "Étude de cas Medactio — contexte, déploiement, adoption et résultats observés." },
    { campaign: "Congrès Santé Numérique 2026", title: "Plaquette institutionnelle", assetType: "Plaquette", fileName: "plaquette-medactio.txt", body: "Plaquette Medactio — présentation de la solution et coordonnées de contact." },
  ] as const;
  for (const item of assetSeeds) {
    const exists = (await db.select().from(marketingAssets).where(eq(marketingAssets.title, item.title)).limit(1))[0];
    if (exists) continue;
    const uploaded = await storagePut(`marketing/assets/demo/${item.fileName}`, item.body, "text/plain");
    await db.insert(marketingAssets).values({ campaignId: campaign(item.campaign).id, title: item.title, assetType: item.assetType, description: "Support de démonstration partagé avec l’équipe.", storageKey: uploaded.key, fileUrl: uploaded.url, fileName: item.fileName, mimeType: "text/plain", sizeBytes: Buffer.byteLength(item.body), createdBy: owner.id });
  }

  console.log(`Données Marketing prêtes : ${contents.length} contenus, ${events.length} événements, ${leads.length} leads et ${assetSeeds.length} supports.`);
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
