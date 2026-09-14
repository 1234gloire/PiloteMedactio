# Suivi — Pôle Direction & Analytics

| Lot | État | Validation |
|---|---|---|
| Cadrage | Terminé | KPI, périodes, conventions de calcul et confidentialité définis |
| Calculs consolidés | Terminé | MRR, ARR, churn, CAC, LTV, usages, pipeline, cash et séries mensuelles déterministes |
| Backend | Terminé | API sécurisée Direction et export CSV opérationnels |
| Données de démonstration | Terminé | 5 campagnes marketing et 12 mois d’usage multi-organisations |
| Interface | Terminé | Dashboard exécutif, 4 rapports par pôle et centre d’exports responsive |
| Exports | Terminé | CSV réel et PDF A4 inspecté visuellement et validé techniquement |
| Tests | Terminé | 25 tests automatisés, smoke base réelle et smoke PDF réussis |
| Validation | Terminé | TypeScript, build production et revue desktop/mobile réussis |

## Conventions appliquées

- MRR : abonnements mensuels actifs + abonnements annuels actifs divisés par 12.
- ARR : MRR multiplié par 12.
- Churn : résiliations de la période rapportées à la base active et résiliée, puis annualisées.
- CAC : budgets marketing de la période divisés par les nouveaux clients gagnés.
- LTV indicative : revenu mensuel moyen par client × marge brute conventionnelle de 80 % ÷ churn mensuel.
- Pipeline pondéré : montant × probabilité de l’étape commerciale.

## Anomalies

Aucune anomalie ouverte. Le build conserve uniquement l’avertissement Vite non bloquant relatif à la taille du bundle principal ; le générateur PDF est déjà chargé dynamiquement dans un fragment séparé.
