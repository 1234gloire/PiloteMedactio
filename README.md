# Medactio Pilotage — Pôle Commercial & B2B

Cette première livraison du MVP fournit un **CRM B2B opérationnel** pour piloter la prospection des établissements de santé jusqu’à la signature. L’interface est entièrement en français, responsive et alignée sur l’identité professionnelle et médicale de Medactio.

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
| Sécurité | Authentification, profils internes et contrôle d’écriture réservé aux rôles `admin` et `commercial` |

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
```

## Variables et intégrations à préparer

| Intégration | Utilité | État de cette livraison |
|---|---|---|
| Supabase | Base PostgreSQL, Auth et RLS cibles | Migration prête ; raccordement au projet de production à effectuer |
| Yousign ou DocuSign | Envoi et signature électronique des devis | Champs et cycle de statut prêts ; clé API non requise pour ce lot |
| Mailjet | Emails transactionnels et relances | Prévu pour le pôle Marketing et l’automatisation avancée |
| Stripe | Paiement et facturation récurrente | Tables préparées ; non branché dans ce premier pôle |

Aucun secret ne doit être commité. Les environnements développement, staging et production doivent conserver des variables séparées.

## Données et conformité

Cette plateforme est un outil de pilotage interne et ne doit pas recevoir de données de santé identifiantes. Les fiches de démonstration sont fictives. Si des données de santé devaient transiter ultérieurement, le déploiement devrait être revu avec un hébergement HDS, une analyse RGPD et des procédures de minimisation adaptées.

## Prochaine étape recommandée

Après validation fonctionnelle du CRM, le prochain lot du MVP est le **pôle Gestion des Clients & Licences**. Les tables nécessaires sont déjà présentes afin d’éviter une refonte du modèle de données.
