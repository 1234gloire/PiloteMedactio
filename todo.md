# Suivi — Phase V2 complète

Les douze pôles du cahier des charges sont livrés.

| Pôle | Phase | État |
|---|---|---|
| Commercial & B2B | V1 | Terminé |
| Marketing & Contenu | V1 | Terminé |
| Clients & Licences | V1 | Terminé |
| Secrétariat & Support | V1 | Terminé |
| Direction & Analytics | V1 | Terminé |
| Finance & Comptabilité | V2 | Terminé |
| Juridique & Conformité | V2 | Terminé |
| Fournisseurs & Partenaires | V2 | Terminé |
| RH & Équipe interne | V2 | Terminé |
| Roadmap Produit | V2 | Terminé |
| Base de connaissances | V2 | Terminé |
| Notifications & automatisations | V2 | Terminé |

## Validation du dernier lot

| Contrôle | Résultat |
|---|---|
| TypeScript | sans erreur |
| Tests automatisés | 89 tests, 16 fichiers |
| Build de production | réussi |
| Tests d'intégration | 7 smoke tests, dont Gouvernance |
| Migration Supabase | additive, appliquée, RLS conservé |

## Points de vigilance

Le plan de comptes de l'export FEC doit être validé par l'expert-comptable avant
toute transmission à l'administration fiscale.

Les jours fériés ne sont pas déduits du décompte des congés : seuls les samedis
et dimanches le sont.

Le recalcul des notifications est manuel. Il pourra être planifié avec les
traitements quotidiens existants une fois l'application déployée.

## Reste à faire avant mise en production

Aucun de ces points ne relève du développement fonctionnel : il s'agit du
raccordement aux services externes.

- Raccorder le formulaire de medactio.fr à l'endpoint public de capture de leads
- Brancher Mailjet en SMTP — aucun email n'est envoyé par l'application à ce jour
- Fermer les inscriptions publiques dans Supabase
- Déployer, puis reprogrammer les tâches `pg_cron` avec l'URL publique
- Brancher Stripe et la signature électronique des devis
