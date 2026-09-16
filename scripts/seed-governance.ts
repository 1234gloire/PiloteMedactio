import "dotenv/config";
import { createDb } from "../drizzle/client";
import {
  changelogEntries,
  employeeGoals,
  internalUsers,
  knowledgeBaseArticles,
  leaveRequests,
  legalDocuments,
  organizations,
  productRequests,
  supportTickets,
} from "../drizzle/schema";
import { refreshNotifications } from "../server/governance.db";

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const inDays = (days: number) => dateOnly(new Date(Date.now() + days * 86_400_000));
const daysAgo = (days: number) => dateOnly(new Date(Date.now() - days * 86_400_000));

/** Décale une date au jour ouvré suivant : un congé d'un jour posé un week-end
 *  afficherait zéro jour décompté, ce qui rendrait la démonstration trompeuse. */
const nextWeekday = (days: number) => {
  const date = new Date(Date.now() + days * 86_400_000);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1);
  return dateOnly(date);
};

async function run() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL est requis");
  const db = createDb(process.env.DATABASE_URL);

  const team = await db.select().from(internalUsers);
  const orgs = await db.select().from(organizations);
  const tickets = await db.select().from(supportTickets);
  const byEmail = (email: string) => team.find(member => member.email === email);
  const anyMember = team[0];
  if (!anyMember) throw new Error("Aucun utilisateur interne : lancez d’abord scripts/seed.ts.");

  /* ---------------- Juridique & Conformité ---------------- */
  const existingLegal = await db.select().from(legalDocuments);
  const legalSeed = [
    { title: "Conditions générales d’utilisation", type: "CGU" as const, version: "v3.1", effectiveDate: daysAgo(210), expiryDate: null, notes: "Version en vigueur publiée sur medactio.fr." },
    { title: "Conditions générales de vente", type: "CGV" as const, version: "v2.4", effectiveDate: daysAgo(180), expiryDate: null, notes: "Applicables aux établissements et praticiens libéraux." },
    { title: "Certificat d’hébergement de données de santé", type: "Certificat HDS" as const, version: "HDS-2024", effectiveDate: daysAgo(400), expiryDate: inDays(22), notes: "Certificat de l’hébergeur. Renouvellement à anticiper avec OVHcloud." },
    { title: "Statuts de la société", type: "Statuts" as const, version: "Constitution", effectiveDate: daysAgo(900), expiryDate: null, notes: null },
    { title: "Accord de sous-traitance RGPD — CHU de Lille", type: "DPA RGPD" as const, version: "v1.2", effectiveDate: daysAgo(120), expiryDate: inDays(240), notes: "Annexe 28 RGPD signée avec l’établissement.", organizationId: orgs[0]?.id ?? null },
    { title: "Accord de sous-traitance RGPD — Clinique Saint-Michel", type: "DPA RGPD" as const, version: "v1.2", effectiveDate: daysAgo(90), expiryDate: inDays(75), notes: "À renouveler à l’échéance du contrat.", organizationId: orgs[1]?.id ?? null },
  ];
  for (const doc of legalSeed) {
    if (existingLegal.some(row => row.title === doc.title)) continue;
    await db.insert(legalDocuments).values(doc);
  }

  /* ---------------- RH & Équipe interne ---------------- */
  const existingLeaves = await db.select().from(leaveRequests);
  if (!existingLeaves.length) {
    const sophie = byEmail("marketing@medactio.fr") ?? anyMember;
    const finance = byEmail("finance@medactio.fr") ?? anyMember;
    await db.insert(leaveRequests).values([
      { userId: sophie.id, type: "Conges Payes", startDate: daysAgo(40), endDate: daysAgo(34), status: "Valide", validatedBy: anyMember.id },
      { userId: sophie.id, type: "Conges Payes", startDate: inDays(30), endDate: inDays(41), status: "Demande" },
      { userId: finance.id, type: "RTT", startDate: nextWeekday(12), endDate: nextWeekday(12), status: "Demande" },
      { userId: finance.id, type: "Maladie", startDate: daysAgo(15), endDate: daysAgo(14), status: "Valide", validatedBy: anyMember.id },
    ]);
  }

  const existingGoals = await db.select().from(employeeGoals);
  if (!existingGoals.length) {
    const sophie = byEmail("marketing@medactio.fr") ?? anyMember;
    const finance = byEmail("finance@medactio.fr") ?? anyMember;
    await db.insert(employeeGoals).values([
      { userId: sophie.id, title: "Générer 120 leads qualifiés sur le semestre", targetDate: inDays(90), status: "En Cours" },
      { userId: sophie.id, title: "Publier 12 articles de fond sur l’écrit hospitalier", targetDate: inDays(150), status: "En Cours" },
      { userId: finance.id, title: "Automatiser le rapprochement bancaire mensuel", targetDate: inDays(60), status: "En Cours" },
      { userId: anyMember.id, title: "Finaliser la certification HDS de l’hébergeur", targetDate: inDays(25), status: "En Cours" },
    ]);
  }

  /* ---------------- Roadmap Produit ---------------- */
  const existingRequests = await db.select().from(productRequests);
  const requestSeed = [
    { title: "Export des comptes rendus au format Word", description: "Les praticiens souhaitent retravailler le document hors Medactio.", type: "Evolution" as const, priority: "Haute" as const, status: "Backlog" as const, organizationId: orgs[0]?.id ?? null, sourceTicketId: tickets[0]?.id ?? null },
    { title: "Export des comptes rendus au format Word", description: "Même demande remontée par un second établissement.", type: "Evolution" as const, priority: "Haute" as const, status: "Backlog" as const, organizationId: orgs[1]?.id ?? null },
    { title: "Dictée vocale en consultation", description: "Saisie à la voix pendant la consultation.", type: "Evolution" as const, priority: "Moyenne" as const, status: "Idee" as const, organizationId: orgs[2]?.id ?? null },
    { title: "Déconnexion inattendue après 30 minutes", description: "La session expire trop tôt en service.", type: "Bug" as const, priority: "Haute" as const, status: "En Developpement" as const, organizationId: orgs[0]?.id ?? null, sourceTicketId: tickets[1]?.id ?? null },
    { title: "Modèles de courrier par spécialité", description: "Modèles pré-remplis adaptés à chaque spécialité médicale.", type: "Evolution" as const, priority: "Moyenne" as const, status: "Idee" as const, organizationId: null },
    { title: "Intégration au logiciel métier de l’établissement", description: "Reprise automatique de l’identité patient.", type: "Evolution" as const, priority: "Basse" as const, status: "Idee" as const, organizationId: orgs[3]?.id ?? null },
    { title: "Correction de l’accentuation dans les exports PDF", description: "Certains caractères accentués s’affichaient mal.", type: "Bug" as const, priority: "Moyenne" as const, status: "Livre" as const, organizationId: null },
  ];
  for (const request of requestSeed) {
    if (existingRequests.some(row => row.title === request.title && row.organizationId === request.organizationId)) continue;
    await db.insert(productRequests).values(request);
  }

  const existingChangelog = await db.select().from(changelogEntries);
  const changelogSeed = [
    { title: "Modèles de compte rendu opératoire", description: "Nouveaux modèles conformes aux recommandations des sociétés savantes.", releaseDate: daysAgo(12), type: "Nouvelle Fonctionnalite" as const },
    { title: "Génération accélérée de 40 %", description: "Temps de rédaction assistée nettement réduit sur les documents longs.", releaseDate: daysAgo(35), type: "Amelioration" as const },
    { title: "Correction de l’accentuation dans les exports PDF", description: "Les caractères accentués s’affichent correctement dans tous les exports.", releaseDate: daysAgo(48), type: "Correction" as const },
  ];
  for (const entry of changelogSeed) {
    if (existingChangelog.some(row => row.title === entry.title)) continue;
    await db.insert(changelogEntries).values(entry);
  }

  /* ---------------- Base de connaissances ---------------- */
  const existingArticles = await db.select().from(knowledgeBaseArticles);
  const articleSeed = [
    {
      title: "Répondre aux objections d’une direction des systèmes d’information",
      category: "Commercial" as const,
      authorId: anyMember.id,
      content: `Les directions des systèmes d'information soulèvent presque toujours les mêmes trois points.\n\n**« Où sont hébergées les données ? »** Chez un hébergeur certifié HDS, en France. Le certificat est disponible dans le pôle Juridique de cet outil et peut être transmis sur demande.\n\n**« Comment s'intègre l'outil à notre existant ? »** Medactio fonctionne en autonomie depuis un navigateur : aucun déploiement sur les postes n'est nécessaire. Une intégration au logiciel métier peut être étudiée au cas par cas.\n\n**« Que devient la responsabilité médicale ? »** Medactio met en forme et accélère la rédaction. Le praticien reste seul décisionnaire du contenu médical et valide chaque document. Ce point doit être énoncé clairement dès le premier rendez-vous.`,
    },
    {
      title: "Procédure — réactiver l’accès d’un praticien",
      category: "Support" as const,
      authorId: anyMember.id,
      content: `Vérifier d'abord que l'établissement dispose encore d'un siège disponible : fiche client, onglet Licences.\n\nSi un siège est libre, réactiver la licence depuis la fiche du contact. L'accès est rétabli immédiatement, sans nouvelle formation.\n\nSi tous les sièges sont occupés, la demande relève du commercial : créer une opportunité d'extension plutôt que de désactiver un autre praticien sans arbitrage de l'établissement.`,
    },
    {
      title: "Ton et vocabulaire des contenus Medactio",
      category: "Marketing" as const,
      authorId: anyMember.id,
      content: `Nous parlons à des soignants, pas à des acheteurs de logiciel.\n\nÉviter « révolutionner », « disrupter », « IA de pointe ». Préférer des formulations concrètes : temps de rédaction, charge administrative, qualité des écrits.\n\nNe jamais laisser entendre que l'outil pose un diagnostic ou décide à la place du praticien. C'est à la fois faux et réglementairement risqué.\n\nToujours citer l'hébergement HDS lorsque le sujet des données est abordé.`,
    },
    {
      title: "Qui fait quoi dans la plateforme de pilotage",
      category: "General" as const,
      authorId: anyMember.id,
      content: `Chaque rôle n'a accès qu'à ce qui le concerne.\n\n**Commercial** : organisations, contacts, opportunités et interactions.\n**Marketing** : campagnes, contenus, leads et bibliothèque de supports.\n**Secrétariat** : tickets, tâches, factures, contrats et agenda.\n**Finance** : trésorerie, dépenses, rapprochement bancaire et export comptable.\n**Direction** : lecture de l'ensemble, plus les pôles Juridique, RH et Produit.\n\nUne demande d'accès supplémentaire passe par un administrateur.`,
    },
  ];
  for (const article of articleSeed) {
    if (existingArticles.some(row => row.title === article.title)) continue;
    await db.insert(knowledgeBaseArticles).values(article);
  }

  const counts = await Promise.all([
    db.select().from(legalDocuments),
    db.select().from(leaveRequests),
    db.select().from(employeeGoals),
    db.select().from(productRequests),
    db.select().from(changelogEntries),
    db.select().from(knowledgeBaseArticles),
  ]);

  console.log(
    `Données Gouvernance prêtes : ${counts[0].length} documents juridiques, ${counts[1].length} demandes de congés, ` +
      `${counts[2].length} objectifs, ${counts[3].length} demandes produit, ${counts[4].length} entrées de changelog, ` +
      `${counts[5].length} articles de connaissance.`
  );

  const notified = await refreshNotifications();
  console.log(
    `Notifications recalculées : ${notified.created} créées pour ${notified.recipients} destinataire(s) ` +
      `à partir de ${notified.candidates} alertes.`
  );
}

run().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
