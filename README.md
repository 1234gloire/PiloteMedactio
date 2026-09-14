# Medactio Pilotage — MVP V1

Cette version du MVP fournit cinq pôles opérationnels : le **CRM Commercial & B2B**, le **pôle Marketing & Contenu**, la **Gestion des Clients & Licences**, le **pôle Secrétariat & Support** et le **pôle Direction & Analytics**. L’interface est entièrement en français, responsive et alignée sur l’identité professionnelle et médicale de Medactio.

## Fonctionnalités livrées

| Domaine | Fonctionnalités |
|---|---|
| Tableau de bord | Pipeline total et pondéré, taux de conversion, cycle de vente moyen, chiffre d’affaires gagné, répartition par étape, classement commercial et relances à traiter |
| Organisations | Recherche, filtre, création, consultation, modification et suppression ; statut, source d’acquisition, valeur annuelle et vue consolidée des contacts/deals |
| Contacts | Recherche, création, consultation, modification et suppression ; rattachement à une organisation et historique d’interactions |
| Pipeline | Vues Kanban et liste, glisser-déposer entre les étapes, recherche et CRUD complet des opportunités |
| Fiche opportunité | Étape, montant, échéance, journal chronologique, contacts, devis et relances |
| Devis | Création d’un brouillon, numéro automatique, date de validité et suivi des statuts jusqu’à la signature |
| Relances | Programmation, suivi et clôture des relances commerciales |
| Dashboard Marketing | Leads capturés, CPL, conversion, ROI, performance par canal, cadence éditoriale et rendement des événements |
| Campagnes Marketing | Canaux, budget, objectif, dates, responsable, cible de leads, revenu attribué et fiche consolidée |
| Leads Marketing | Capture du site ou saisie interne, consentement, déduplication, qualification et création d’une opportunité CRM |
| Webinaires & démonstrations | Inscrits, présents, rendez-vous générés, statut et rattachement aux campagnes |
| Calendrier éditorial | Articles, posts, newsletters et vidéos avec brief, audience, brouillon, responsable et statut de publication |
| Bibliothèque Marketing | Plaquettes, argumentaires, études de cas, présentations et visuels stockés hors base |
| Tableau de bord Succès Client | Clients actifs, MRR/ARR estimés, adoption des sièges, volume d’écrits, comptes à risque, churn et renouvellements à venir |
| Onboarding client | Checklist par établissement : compte créé, formation effectuée et premiers écrits générés |
| Licences praticiens | Sièges souscrits versus actifs, activation et désactivation des accès par praticien |
| Usage et santé client | Historique d’usage par établissement et praticien, évolution sur six mois et health score explicable |
| Renouvellements et churn | Échéances à 30/60/90 jours, résiliation avec motif et analyse du churn |
| Alertes Succès Client | Détection idempotente de la sous-utilisation, des onboardings incomplets, des comptes à risque et des renouvellements |
| Tableau de bord Support | Tickets ouverts et urgents, SLA dépassés, temps moyen de résolution, tâches en retard, impayés, alertes et rendez-vous à venir |
| Tickets de support | Catégorie, priorité, statut, assignation, SLA par priorité, première réponse, résolution et journal chronologique |
| Tâches administratives | Assignation, priorité, échéance, avancement et clôture rapide |
| Facturation | Factures émises, statuts de paiement, échéances, impayés, relances historisées et prochaine relance |
| Conventions & contrats | Dates clés, statut, échéance de renouvellement et document associé stocké hors base |
| Agenda partagé | Rendez-vous internes et clients, démonstrations et échéances, avec rattachement aux établissements et contacts |
| Alertes Support | Détection idempotente des SLA dépassés, tâches proches, impayés, contrats à renouveler et rendez-vous à venir |
| Dashboard Direction | MRR, ARR, clients actifs, churn, CAC, LTV, usages, pipeline pondéré, encaissements et alertes exécutives |
| Reporting par pôle | Rapports Commercial, Clients & SaaS, Support et Marketing avec performances par collaborateur |
| Usage global | Historique mensuel des écrits générés et des requêtes IA toutes organisations confondues |
| Exports Direction | CSV compatible tableur et rapport exécutif PDF A4 généré localement |
| Sécurité | Authentification, profils internes, accès financier restreint et contrôle d’écriture selon le rôle métier |

## Architecture de cette livraison

La prévisualisation hébergée utilise le socle full-stack géré de l’environnement : **React 19, TypeScript, Tailwind CSS, shadcn/ui, tRPC, Drizzle ORM, base SQL et authentification OAuth**. La migration cible Supabase/PostgreSQL demandée dans le cahier des charges est fournie dans `supabase/migrations/20260911_initial_schema.sql` avec le schéma V1/V2, les clés étrangères, les politiques RLS et l’audit des tables sensibles. Elle pourra être appliquée lors du raccordement au projet Supabase de production.

## Lancer le projet en local

Installez Node.js 22 et pnpm, puis configurez les variables d’environnement d’authentification et de base de données fournies par l’hébergeur. Lancez ensuite :

```bash
pnpm install
pnpm dev
```

La vérification complète s’exécute avec :

```bash
pnpm check
pnpm test
pnpm build
```

Le jeu de démonstration est idempotent :

```bash
pnpm tsx scripts/seed.ts
```

Le test d’intégration CRUD crée, vérifie puis supprime ses propres données temporaires :

```bash
pnpm tsx scripts/smoke-crud.ts
pnpm tsx scripts/smoke-customer-success.ts
pnpm tsx scripts/smoke-support.ts
pnpm tsx scripts/smoke-analytics.ts
pnpm tsx scripts/smoke-analytics-pdf.ts
pnpm tsx scripts/smoke-marketing.ts
```

Le jeu de démonstration du deuxième pôle se charge séparément et peut être rejoué sans dupliquer les abonnements :

```bash
pnpm tsx scripts/seed-customer-success.ts
pnpm tsx scripts/seed-support.ts
pnpm tsx scripts/seed-analytics.ts
pnpm tsx scripts/seed-marketing.ts
```

## Conventions des indicateurs Direction

| Indicateur | Convention V1 |
|---|---|
| MRR | Abonnements mensuels actifs + valeur annuelle active divisée par 12 |
| ARR | MRR × 12 |
| Churn | Résiliations observées rapportées à la base active et résiliée de la période, puis annualisées |
| CAC | Budgets marketing engagés sur la période / nouveaux clients gagnés |
| LTV indicative | Revenu mensuel moyen par client × marge brute conventionnelle de 80 % / churn mensuel |
| Pipeline pondéré | Montant de chaque opportunité ouverte × probabilité de son étape |
| Encaissements attendus | Factures envoyées ou en retard non encore réglées |

Les écrans affichent explicitement la période d’analyse et la date d’arrêté. Le CAC et la LTV restent des estimations de pilotage tant que les coûts complets d’acquisition et la marge brute comptable ne sont pas synchronisés.
## Alertes et traitements automatiques

Deux mécanismes complémentaires sont disponibles pour Succès Client et Support. Le bouton **Recalculer** de chaque dashboard exécute immédiatement son moteur dans la requête utilisateur. Après publication, l’option **Automatisation quotidienne** crée un traitement géré : Succès Client s’exécute à 06:00 UTC via `/api/scheduled/customer-success-alerts`, puis Support à 06:30 UTC via `/api/scheduled/support-alerts`. Les traitements sont authentifiés, idempotents et liés à leur identifiant de tâche.

| Approche | Compromis | Coût | Complexité de mise en place |
|---|---|---|---|
| Recalcul à la demande | Immédiat et transparent, mais dépend d’une action humaine | Inclus dans l’application | Aucune |
| Traitement quotidien géré | Fonctionne sans navigateur ouvert et maintient les alertes à jour | Exécution légère selon l’usage d’hébergement | Activation en un clic après publication |

Le bouton **Relancer** d’une facture enregistre la relance, incrémente son compteur et programme la prochaine à J+7. L’envoi effectif d’un email sera branché lors de l’intégration Mailjet ; aucune communication externe n’est envoyée dans ce lot.

## Documents contractuels

Les fichiers associés aux contrats sont envoyés dans le stockage objet intégré et seule leur référence est conservée en base. Les formats PDF, Word et image sont acceptés par l’interface, avec une limite de 10 Mo par document.

Les supports Marketing suivent la même règle : le fichier est stocké dans l’espace objet sécurisé, tandis que son titre, son type, sa campagne et sa référence sont conservés en base. La limite est également de 10 Mo.

## Capture des leads Marketing

Le formulaire public de `medactio.fr` peut transmettre une demande en `POST` vers `/api/public/marketing/leads`. L’endpoint limite les origines autorisées aux domaines Medactio, exige un consentement explicite, valide toutes les données, utilise un champ honeypot contre les robots et déduplique l’e-mail au sein d’une campagne. Une organisation et un contact en statut prospect sont créés dans le CRM si nécessaire. Aucun email ni publication externe n’est envoyé automatiquement dans cette version.

## Variables et intégrations à préparer

| Intégration | Utilité | État de cette livraison |
|---|---|---|
| Supabase | Base PostgreSQL, Auth et RLS cibles | Migration prête ; raccordement au projet de production à effectuer |
| Yousign ou DocuSign | Envoi et signature électronique des devis | Champs et cycle de statut prêts ; clé API non requise pour ce lot |
| Mailjet | Emails transactionnels, newsletters et relances | Préparation et suivi internes opérationnels ; envoi externe à brancher |
| Réseaux sociaux | Publication des contenus planifiés | Calendrier, briefs et statuts prêts ; publication externe non activée |
| Stripe | Paiement et facturation récurrente | Abonnements gérés dans l’application ; synchronisation Stripe non branchée |

Aucun secret ne doit être commité. Les environnements développement, staging et production doivent conserver des variables séparées.

## Données et conformité

Cette plateforme est un outil de pilotage interne et ne doit pas recevoir de données de santé identifiantes. Les fiches de démonstration sont fictives. Si des données de santé devaient transiter ultérieurement, le déploiement devrait être revu avec un hébergement HDS, une analyse RGPD et des procédures de minimisation adaptées.

## Prochaine étape recommandée

Les cinq pôles prioritaires du MVP V1 sont désormais opérationnels. Après adoption du MVP, le prochain lot recommandé est le **pôle Finance & Comptabilité V2** : trésorerie, dépenses, transactions bancaires, rapprochement et export comptable.
