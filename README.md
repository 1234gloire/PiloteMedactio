# Medactio Pilotage

Les **douze pôles** du cahier des charges sont livrés : les cinq pôles du socle V1 — **CRM Commercial & B2B**, **Marketing & Contenu**, **Clients & Licences**, **Secrétariat & Support**, **Direction & Analytics** — et les sept blocs de la phase V2 — **Finance & Comptabilité**, **Juridique & Conformité**, **Fournisseurs & Partenaires**, **RH & Équipe interne**, **Roadmap Produit**, **Base de connaissances interne** et **Notifications & automatisations centralisées**. L’interface est entièrement en français, responsive et alignée sur l’identité professionnelle et médicale de Medactio.

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
| Trésorerie | Solde bancaire constaté, encaissements et décaissements attendus, solde projeté à 30/60/90 jours et charges récurrentes |
| Dépenses | Recherche, filtre par catégorie, charges ponctuelles ou récurrentes, rattachement fournisseur et CRUD complet |
| Rapprochement bancaire | Mouvements bancaires associés à leur facture ou dépense, suggestions automatiques par montant et date, annulation possible |
| Revenu réconcilié | MRR et ARR théoriques confrontés aux encaissements réellement constatés, avec écart et taux de couverture |
| Export comptable | Fichier des Écritures Comptables (FEC) tabulé à 18 colonnes, journaux Ventes et Achats, contrôle d’équilibre débit/crédit |
| Juridique & Conformité | CGU, CGV, accords RGPD, certificat HDS et statuts, avec documents stockés hors base et échéancier de conformité |
| Fournisseurs & Partenaires | Coût annuel, contacts, renouvellements de contrat avec alerte, et historique des dépenses rattachées |
| RH & Équipe interne | Fiches collaborateurs, demandes de congés en jours ouvrés avec validation, objectifs individuels et calendrier d’absences |
| Roadmap Produit | Backlog en colonnes, priorisation par impact et nombre d’établissements demandeurs, lien vers le ticket d’origine, changelog |
| Base de connaissances | Articles par catégorie, recherche plein texte exigeant tous les mots, édition réservée à l’auteur |
| Notifications centralisées | Centre d’alertes accessible partout, compteur de non-lus, filtrage par pôle et recalcul idempotent |
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
pnpm tsx scripts/seed-finance.ts
pnpm tsx scripts/seed-governance.ts
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

## Pôle Finance & Comptabilité

Ce pôle est le premier lot de la phase V2. Il couvre la trésorerie réelle de
l'entreprise, au-delà de la facturation client déjà gérée par le Secrétariat.

### Accès

| Rôle | Trésorerie, dépenses, rapprochement | Écriture | Export FEC |
|---|---|---|---|
| `admin` | oui | oui | oui |
| `finance` | oui | oui | oui |
| `direction` | oui | non | oui |
| autres rôles | non | non | non |

Le pôle n'apparaît dans la navigation que pour les rôles qui y ont accès. Toute
écriture sur les dépenses et les mouvements bancaires est journalisée dans
`audit_log`.

### Conventions de calcul

| Indicateur | Convention |
|---|---|
| Solde en banque | Somme des crédits moins les débits **réellement constatés**. Les factures émises et non encaissées n'y figurent pas. |
| Encaissements attendus | Factures émises ou en retard, non réglées. Une facture échue reste due et compte intégralement. |
| Décaissements attendus | Charges récurrentes reconduites au prorata de l'horizon, plus les dépenses ponctuelles déjà datées dans la fenêtre. |
| Solde projeté | Solde constaté + encaissements attendus − décaissements attendus. |
| Écart de revenu | Encaissements bancaires constatés moins le MRR théorique issu des abonnements actifs. |

### Rapprochement bancaire

L'application propose les pièces dont le **montant est identique au centime**
et dont la date s'écarte de moins de quinze jours, classées par proximité. Un
encaissement est rapproché d'une facture, un décaissement d'une dépense. La
validation reste manuelle et reste annulable : aucun rapprochement n'est
appliqué automatiquement.

### Export FEC

Le Fichier des Écritures Comptables est le format tabulé à 18 colonnes exigé par
l'administration fiscale française en cas de contrôle. Deux journaux sont
produits, chaque pièce donnant lieu à deux lignes équilibrées :

- **Ventes (VE)** — facture client : débit 411 (clients), crédit 706 (prestations de services) ;
- **Achats (AC)** — dépense : débit du compte de charge correspondant à la catégorie, crédit 401 (fournisseurs).

Les factures à l'état de brouillon sont exclues : elles ne constituent pas une
écriture comptable. L'équilibre débit/crédit est contrôlé et affiché à chaque
export.

> **Le plan de comptes doit être validé par votre expert-comptable.** Celui
> retenu ici est une base de travail conforme au plan comptable général, mais il
> n'engage pas la conformité fiscale de l'export : faites-le vérifier, et
> ajuster si nécessaire, avant toute transmission à l'administration.

## Pôles de gouvernance (V2)

### Accès

| Pôle | Lecture | Écriture |
|---|---|---|
| Juridique & Conformité | `admin`, `direction` | `admin`, `direction` |
| Fournisseurs & Partenaires | `admin`, `direction`, `finance` | `admin`, `direction` |
| RH — fiches et validation | `admin`, `direction` | `admin`, `direction` |
| RH — ses propres congés | chaque collaborateur | chaque collaborateur |
| Roadmap Produit | toute l’équipe interne | `admin`, `direction` |
| Base de connaissances | toute l’équipe interne | l’auteur, `admin`, `direction` |
| Notifications | ses propres alertes | recalcul par `admin`, `direction` |

Chaque collaborateur ne voit que ses propres demandes de congés et sa propre
fiche : la consultation des autres membres suppose un rôle de responsable.

### Conventions de calcul

| Règle | Convention |
|---|---|
| Gravité d’une échéance | Dépassée, puis **Critique** à 30 jours ou moins, **À surveiller** à 90 jours, sinon sereine. Le seuil de 30 jours correspond au préavis courant des contrats d’hébergement et des certifications. |
| Décompte des congés | Jours ouvrés uniquement, samedis et dimanches exclus. Les jours fériés ne sont pas déduits : ils relèvent d’un calendrier légal hors périmètre. |
| Solde de congés | 25 jours acquis par an ; seuls les congés payés **validés** décomptent le solde. |
| Priorisation produit | Priorité saisie, majorée pour un bug et pondérée par le nombre d’établissements distincts ayant exprimé la même demande. |
| Recherche documentaire | Tous les mots saisis doivent être présents dans le titre ou le contenu. |

### Notifications

Le centre d’alertes regroupe les échéances et demandes des pôles transverses :
document juridique ou contrat fournisseur arrivant à terme, congé à valider,
demande produit prioritaire à arbitrer. Chaque alerte porte une clé de
déduplication stable : **un recalcul ne crée jamais de doublon**. Les alertes
sont adressées aux profils `admin` et `direction`, seuls habilités sur ces
pôles, et chacun dispose de son propre exemplaire.

Le recalcul est manuel, depuis l’icône de notification. Il pourra être planifié
avec les traitements quotidiens existants une fois l’application déployée.

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

Le formulaire « Demander une démonstration » de `medactio.fr` alimente
directement le CRM. Le backend du site relaie la demande de serveur à serveur
vers `POST /api/public/marketing/leads`, en présentant le secret partagé
`LEAD_INTAKE_SECRET` : le navigateur du visiteur n'appelle jamais la plateforme
de pilotage, et le site continue de fonctionner si celle-ci est indisponible.

L'endpoint accepte le format du formulaire du site (`name`, `fonction`,
`etablissement`, `praticiensConcernes`, `besoin`) sans remaniement, valide les
données, déduplique par adresse email et campagne, et piège les robots par un
champ masqué. Une organisation en statut Prospect et un contact sont créés si
nécessaire.

Un appel depuis un navigateur reste possible : les origines autorisées sont
alors vérifiées et le consentement explicite exigé. Elles se complètent par
`LEAD_CAPTURE_ORIGINS`.

La procédure complète, avec le code à ajouter au backend de medactio.fr, figure
dans `docs/integration-medactio-fr.md`.

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

Les douze pôles du cahier des charges sont livrés. Ce qui reste relève du
raccordement au monde extérieur, et non du développement fonctionnel :

1. **Raccorder le formulaire de medactio.fr** à l’endpoint public de capture de
   leads, déjà développé et testé.
2. **Brancher Mailjet en SMTP** : aucun email n’est envoyé par l’application à ce
   stade. Cela conditionne les emails de connexion, les relances impayés et les
   relances commerciales, aujourd’hui enregistrées mais jamais expédiées.
3. **Déployer**, puis reprogrammer les tâches `pg_cron` avec l’URL publique et
   fermer les inscriptions publiques dans Supabase.
4. **Brancher Stripe et la signature électronique** (Yousign ou DocuSign) : les
   cycles de statut existent côté application, les API restent à connecter.
