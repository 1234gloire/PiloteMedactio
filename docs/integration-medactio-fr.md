# Raccordement du formulaire de medactio.fr

Ce document décrit comment relier le formulaire « Demander une démonstration »
du site public à la plateforme de pilotage, afin que chaque demande crée
automatiquement un lead, une organisation et un contact dans le CRM.

## Principe retenu

Le site possède déjà son propre formulaire, qui poste vers son backend Express
sur `/api/demo-request`. Plutôt que de faire appeler la plateforme de pilotage
par le navigateur du visiteur, **le backend de medactio.fr relaie la demande**
de serveur à serveur.

```
Visiteur ──► medactio.fr  ──► POST /api/demo-request   (inchangé)
                   │
                   └──► POST https://<pilotage>/api/public/marketing/leads
                        Authorization: Bearer <LEAD_INTAKE_SECRET>
```

Ce choix a trois avantages sur un appel direct depuis le navigateur :

- **Aucune contrainte de CORS**, et la plateforme de pilotage n'est jamais
  exposée au navigateur du visiteur ;
- **le secret partagé ne transite jamais côté client**, contrairement à une clé
  qui serait embarquée dans le JavaScript du site ;
- **le site continue de fonctionner** si la plateforme est indisponible : le
  relais échoue en silence, la demande de démonstration reste traitée.

## Ce qu'il faut ajouter au backend de medactio.fr

Deux variables d'environnement :

```bash
PILOTAGE_LEAD_URL=https://<url-publique-du-pilotage>/api/public/marketing/leads
PILOTAGE_LEAD_SECRET=<valeur identique à LEAD_INTAKE_SECRET côté pilotage>
```

Puis, dans le gestionnaire existant de `/api/demo-request`, après le traitement
actuel de la demande :

```js
/**
 * Relaie la demande de démonstration vers la plateforme de pilotage Medactio.
 * Le relais ne doit jamais faire échouer la demande du visiteur : toute erreur
 * est journalisée puis ignorée.
 */
async function relayToPilotage(demande) {
  const url = process.env.PILOTAGE_LEAD_URL;
  const secret = process.env.PILOTAGE_LEAD_SECRET;
  if (!url || !secret) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      // Les champs du formulaire sont transmis tels quels : la plateforme
      // reconnaît ce format et se charge de la transposition.
      body: JSON.stringify(demande),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) {
      console.error("[Pilotage] Relais du lead refusé :", response.status, await response.text());
    }
  } catch (error) {
    console.error("[Pilotage] Relais du lead impossible :", error);
  }
}
```

Appel, sans `await` bloquant pour ne pas ralentir la réponse au visiteur :

```js
app.post("/api/demo-request", async (req, res) => {
  // ... traitement existant de la demande (email interne, enregistrement, etc.)

  void relayToPilotage(req.body);

  res.json({ ok: true });
});
```

Aucune modification du formulaire HTML n'est nécessaire.

## Champs transmis et correspondance

Le formulaire du site envoie déjà ces champs, repris tels quels :

| Champ du site | Destination dans le CRM |
|---|---|
| `name` | Nom du contact et du lead |
| `fonction` | Intitulé de poste du contact |
| `etablissement` | Nom de l'organisation, créée en statut **Prospect** |
| `email` | Email du lead et du contact, sert à la déduplication |
| `praticiensConcernes` | Ajouté aux notes du lead |
| `besoin` | Notes du lead |

Champs facultatifs supplémentaires, si le site peut les fournir :
`telephone`, `utmSource`, `utmMedium`, `utmCampaign`. Lorsque `utmCampaign`
correspond au nom exact d'une campagne existante, le lead lui est rattaché et
son compteur de leads générés est incrémenté.

Le **type d'établissement n'est pas demandé** par le formulaire : l'organisation
est créée avec le type `Autre`, à préciser par le commercial lors de la
qualification.

## Comportements à connaître

**Déduplication.** Une même adresse email pour une même campagne ne crée qu'un
seul lead. Un rejeu renvoie `200` avec `{"duplicate": true}` au lieu de `201`,
sans rien dupliquer dans le CRM.

**Champ piège.** Si le corps contient un champ `website` non vide, la demande
est ignorée silencieusement et l'API répond `202`. Ajouter au formulaire un
champ `website` masqué en CSS filtre l'essentiel des robots.

**Consentement.** Le fait de remplir un formulaire de demande de démonstration
vaut demande explicite d'être recontacté. Le site doit néanmoins l'indiquer
clairement à proximité du bouton d'envoi, avec un lien vers la politique de
confidentialité — l'activité relève du secteur de la santé.

## Réponses de l'API

| Code | Signification |
|---|---|
| `201` | Lead créé |
| `200` | Demande déjà connue, rien n'a été dupliqué |
| `202` | Champ piège rempli, demande ignorée |
| `400` | Données invalides — le détail figure dans `fields` |
| `403` | Origine non autorisée ou secret invalide |
| `500` | Erreur côté plateforme |

## Vérification

Une fois les deux variables renseignées de chaque côté :

```bash
curl -X POST "$PILOTAGE_LEAD_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PILOTAGE_LEAD_SECRET" \
  -d '{"name":"Test Integration","fonction":"Chef de service","etablissement":"CHU de Test","email":"test@exemple.fr","praticiensConcernes":"5","besoin":"Vérification du raccordement."}'
```

La réponse attendue est `{"success":true,"duplicate":false}`. Le lead apparaît
alors dans **Marketing → Leads**, avec son organisation en statut Prospect et le
contact associé.

## Prérequis

Le raccordement suppose que la plateforme de pilotage soit **déployée et
accessible publiquement** : le serveur de medactio.fr doit pouvoir l'atteindre.
Tant qu'elle ne tourne qu'en local, le relais ne peut pas aboutir.
