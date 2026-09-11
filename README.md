# Medactio Pilotage — MVP V1

Cette version du MVP fournit deux pôles opérationnels : le **CRM Commercial & B2B** et la **Gestion des Clients & Licences**. L’interface est entièrement en français, responsive et alignée sur l’identité professionnelle et médicale de Medactio.

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
| Tableau de bord Succès Client | Clients actifs, MRR/ARR estimés, adoption des sièges, volume d’écrits, comptes à risque, churn et renouvellements à venir |
| Onboarding client | Checklist par établissement : compte créé, formation effectuée et premiers écrits générés |
| Licences praticiens | Sièges souscrits versus actifs, activation et désactivation des accès par praticien |
| Usage et santé client | Historique d’usage par établissement et praticien, évolution sur six mois et health score explicable |
| Renouvellements et churn | Échéances à 30/60/90 jours, résiliation avec motif et analyse du churn |
| Alertes Succès Client | Détection idempotente de la sous-utilisation, des onboardings incomplets, des comptes à risque et des renouvellements |
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
pnpm tsx scripts/smoke-customer-success.ts
```

Le jeu de démonstration du deuxième pôle se charge séparément et peut être rejoué sans dupliquer les abonnements :

```bash
pnpm tsx scripts/seed-customer-success.ts
```

## Alertes et renouvellements automatiques

Deux mécanismes complémentaires sont disponibles. Le bouton **Recalculer** du tableau de bord exécute immédiatement le moteur dans la requête utilisateur ; il est disponible en prévisualisation et utile pour tester ou corriger des données. L’option **Automatisation quotidienne** crée, une fois le site publié, un traitement géré qui appelle chaque jour à 06:00 UTC le point d’entrée sécurisé `/api/scheduled/customer-success-alerts`. Les alertes reposent sur des clés de déduplication et peuvent être résolues ou ignorées sans créer de doublons.

| Approche | Compromis | Coût | Complexité de mise en place |
|---|---|---|---|
| Recalcul à la demande | Immédiat et transparent, mais dépend d’une action humaine | Inclus dans l’application | Aucune |
| Traitement quotidien géré | Fonctionne sans navigateur ouvert et maintient les alertes à jour | Exécution légère selon l’usage d’hébergement | Activation en un clic après publication |

## Variables et intégrations à préparer

| Intégration | Utilité | État de cette livraison |
|---|---|---|
| Supabase | Base PostgreSQL, Auth et RLS cibles | Migration prête ; raccordement au projet de production à effectuer |
| Yousign ou DocuSign | Envoi et signature électronique des devis | Champs et cycle de statut prêts ; clé API non requise pour ce lot |
| Mailjet | Emails transactionnels et relances | Prévu pour le pôle Marketing et l’automatisation avancée |
| Stripe | Paiement et facturation récurrente | Abonnements gérés dans l’application ; synchronisation Stripe non branchée |

Aucun secret ne doit être commité. Les environnements développement, staging et production doivent conserver des variables séparées.

## Données et conformité

Cette plateforme est un outil de pilotage interne et ne doit pas recevoir de données de santé identifiantes. Les fiches de démonstration sont fictives. Si des données de santé devaient transiter ultérieurement, le déploiement devrait être revu avec un hébergement HDS, une analyse RGPD et des procédures de minimisation adaptées.

## Prochaine étape recommandée

Après validation des parcours commerciaux et Succès Client, le prochain lot du MVP est le **pôle Secrétariat & Support**. Les tickets déjà pris en compte dans le health score constituent le point de raccordement naturel.
