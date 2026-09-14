# Suivi — Pôle Marketing & Contenu

| Lot | État | Validation |
|---|---|---|
| Cadrage | Terminé | Campagnes, leads, contenus, événements et bibliothèque alignés sur le MVP |
| Modèle de données | Terminé | Migration Drizzle additive et migration Supabase/RLS disponibles |
| Backend | Terminé | API typée, CRUD, agrégations, capture publique contrôlée et stockage opérationnels |
| Données de démonstration | Terminé | 5 campagnes, 6 leads, 6 contenus, 4 événements et 3 supports partagés |
| Interface | Terminé | Dashboard, campagnes, fiche, calendrier, leads et bibliothèque responsive |
| Direction | Terminé | Revenu attribué, ROI et leads réels intégrés au reporting consolidé |
| Tests | Terminé | 35 tests automatisés et smoke test réel avec stockage réussis |
| Validation | Terminé | TypeScript, build production, CORS/honeypot et revue desktop/mobile réussis |
| Livraison | En cours | Checkpoint et synchronisation GitHub à finaliser |

## Sécurité et intégrations

La capture publique exige le consentement, valide les champs, déduplique les demandes et utilise un honeypot. Les origines CORS sont limitées à `medactio.fr`, `www.medactio.fr` et aux environnements locaux de développement. Le module ne publie aucun contenu et n’envoie aucune campagne à un service externe : Mailjet et les réseaux sociaux pourront être branchés dans un lot ultérieur avec les autorisations dédiées.

## Anomalies

Aucune anomalie ouverte. La compression initiale de la sidebar desktop et l’affichage des petits fichiers à 0 Ko ont été corrigés puis recapturés. Le build conserve uniquement l’avertissement Vite non bloquant relatif à la taille du bundle principal.
