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

## Architecture

| Couche | Technologie |
|---|---|
| Interface | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| API | Express + tRPC (typage bout en bout) |
| Base de données | PostgreSQL (Supabase), accès via Drizzle ORM |
| Authentification | Supabase Auth — lien magique par email |
| Documents | Supabase Storage, compartiment privé et URL signées |
| Traitements planifiés | pg_cron (Supabase) vers `/api/scheduled/*` |

L'application est autonome : elle ne dépend d'aucune plateforme propriétaire et
peut être hébergée sur n'importe quel environnement Node.js.

## Lancer le projet en local

Prérequis : **Node.js 22+**, **pnpm**, et une base **PostgreSQL 15+** (locale ou
projet Supabase).

**1. Configurer l'environnement**

Copiez `.env.example` vers `.env` et renseignez au minimum `DATABASE_URL`.

**2. Installer, migrer, alimenter**

```bash
pnpm install
pnpm drizzle-kit migrate
pnpm tsx scripts/seed.ts
pnpm tsx scripts/seed-customer-success.ts
pnpm tsx scripts/seed-support.ts
pnpm tsx scripts/seed-analytics.ts
pnpm tsx scripts/seed-marketing.ts
```

**3. Démarrer**

```bash
pnpm dev
```

L'application écoute sur `http://localhost:3000` (port suivant disponible si
3000 est occupé).

## Raccordement à Supabase

1. Créer le projet Supabase **dans une région européenne** — l'activité relève
   du secteur de la santé et les données doivent rester dans l'Union européenne.
2. Renseigner `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans `.env`.
3. Appliquer le schéma : `pnpm drizzle-kit migrate`.
4. Exécuter `supabase/setup.sql` dans l'éditeur SQL du projet. Ce script active
   RLS sur les 37 tables et planifie les traitements quotidiens.
5. Créer le compartiment de stockage **privé** nommé `documents`
   (Storage → New bucket, *Public bucket* décoché).
6. Inviter les membres de l'équipe depuis Authentication → Users.

### Authentification

La connexion se fait par **lien magique** : l'utilisateur saisit son adresse
professionnelle et reçoit un lien à usage unique. Aucun mot de passe n'est
stocké par l'application. Seules les adresses enregistrées dans le projet
Supabase peuvent se connecter. L'adresse indiquée dans `OWNER_EMAIL` reçoit
automatiquement le rôle administrateur.

Pour travailler sans réseau, `DEV_AUTH_ENABLED=true` ouvre une session locale en
rôle administrateur. Cette bascule est sans effet dès que `NODE_ENV` vaut
`production`.

### Accès direct aux données

La clé `anon` est publique par conception. L'accès direct aux tables via l'API
REST de Supabase est donc **entièrement bloqué par RLS** : l'application est le
seul chemin d'accès aux données, et les droits par rôle sont appliqués dans les
routeurs tRPC. Voir `supabase/setup.sql`.

### Documents

Les contrats et supports marketing sont déposés dans un compartiment privé. La
base ne conserve que la clé du fichier : le lien de téléchargement est signé à
chaque affichage et expire au bout d'une heure. Sans configuration Supabase, les
fichiers sont écrits dans `.local-storage/` pour le développement.

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

Deux mécanismes complémentaires couvrent Succès Client et Support.

Le bouton **Recalculer** de chaque tableau de bord exécute immédiatement le
moteur d'alertes dans la requête utilisateur.

L'interrupteur **Automatisation quotidienne** active le traitement planifié :
Succès Client à 06:00 UTC via `/api/scheduled/customer-success-alerts`, Support à
06:30 UTC via `/api/scheduled/support-alerts`. La planification est portée par
`pg_cron` côté Supabase (voir `supabase/setup.sql`) ; l'interrupteur de
l'interface décide si le calcul est réellement effectué à chaque déclenchement.

Ces endpoints sont protégés par le secret partagé `CRON_SECRET`, comparé à durée
constante. Un appel sans secret valide reçoit une réponse 403. Les traitements
sont idempotents : les rejouer ne crée pas de doublon d'alerte.

Le bouton **Relancer** d'une facture enregistre la relance, incrémente son
compteur et programme la prochaine à J+7. L'envoi effectif d'un email sera
branché lors de l'intégration Mailjet ; aucune communication externe n'est
émise dans cette version.

## Documents contractuels

Les fichiers associés aux contrats et les supports Marketing sont déposés dans le
compartiment privé Supabase, avec une limite de 10 Mo par document (PDF, Word,
image). La base ne conserve que la clé du fichier et ses métadonnées : le lien de
téléchargement est signé à l'affichage et expire au bout d'une heure.

## Capture des leads Marketing

Le formulaire public de `medactio.fr` peut transmettre une demande en `POST` vers `/api/public/marketing/leads`. L’endpoint limite les origines autorisées aux domaines Medactio, exige un consentement explicite, valide toutes les données, utilise un champ honeypot contre les robots et déduplique l’e-mail au sein d’une campagne. Une organisation et un contact en statut prospect sont créés dans le CRM si nécessaire. Aucun email ni publication externe n’est envoyé automatiquement dans cette version.

## Intégrations restant à brancher

| Intégration | Utilité | État |
|---|---|---|
| Mailjet | Emails transactionnels, newsletters et relances | Suivi interne opérationnel ; envoi externe à brancher |
| Stripe | Paiement et facturation récurrente | Abonnements gérés dans l'application ; synchronisation à brancher |
| Yousign ou DocuSign | Signature électronique des devis | Cycle de statut prêt ; API non branchée |
| Réseaux sociaux | Publication des contenus planifiés | Calendrier prêt ; publication non activée |

Aucun secret ne doit être commité. Les environnements développement, staging et
production doivent conserver des variables séparées.

## Données et conformité

Cette plateforme est un outil de pilotage interne et ne doit pas recevoir de données de santé identifiantes. Les fiches de démonstration sont fictives. Si des données de santé devaient transiter ultérieurement, le déploiement devrait être revu avec un hébergement HDS, une analyse RGPD et des procédures de minimisation adaptées.

## Prochaine étape recommandée

Les cinq pôles prioritaires du MVP V1 sont opérationnels et l'application est
désormais autonome. Le prochain lot est le **pôle Finance & Comptabilité V2** :
trésorerie, dépenses, transactions bancaires, rapprochement et export comptable
au format FEC. Les tables correspondantes existent déjà dans le schéma.
