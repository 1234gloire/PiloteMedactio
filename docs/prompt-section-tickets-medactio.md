# Prompt — Ajouter la section « Assistance » à l'application Medactio

> À copier dans l'outil de développement utilisé pour l'application Medactio
> (le produit utilisé par les praticiens), ou à remettre au développeur.

---

## Contexte

Medactio est une solution d'aide à la rédaction des écrits hospitaliers
assistée par intelligence artificielle. Elle est utilisée par des praticiens
hospitaliers et libéraux, authentifiés dans l'application.

L'éditeur dispose par ailleurs d'une plateforme interne de pilotage, déployée
sur `https://pilotage.medactio.fr`, où l'équipe support traite les demandes
d'assistance. Aujourd'hui, les tickets y sont saisis manuellement par le
secrétariat après un appel ou un email.

**Objectif : permettre aux praticiens d'ouvrir une demande d'assistance
directement depuis l'application, sans quitter leur travail.** Chaque demande
crée automatiquement un ticket dans la plateforme de pilotage, rattaché à son
établissement.

## Ce qu'il faut construire

### 1. Un point d'entrée visible mais discret

Un bouton « Besoin d'aide ? » accessible depuis toutes les pages de
l'application, par exemple en bas à droite ou dans le menu utilisateur. Il ne
doit jamais masquer la zone de rédaction ni interrompre le praticien.

### 2. Un formulaire court

Le praticien est déjà connecté : **ne lui redemandez ni son nom, ni son email,
ni son établissement.** Ces informations sont reprises de sa session.

Champs à saisir :

| Champ | Type | Obligatoire |
|---|---|---|
| Objet | texte court, 4 caractères minimum | oui |
| Description | texte long | non, mais fortement encouragé |
| Catégorie | liste déroulante | oui, avec une valeur par défaut |

Valeurs exactes de la liste déroulante, à respecter à la lettre :

- `Support Technique` — libellé affiché : « Problème technique »
- `Acces Licence` — libellé affiché : « Accès ou compte »
- `Facturation` — libellé affiché : « Facturation »
- `Onboarding` — libellé affiché : « Prise en main »
- `Autre` — libellé affiché : « Autre »

Valeur par défaut : `Support Technique`.

**Ne demandez pas au praticien de définir une priorité.** Elle est arbitrée par
l'équipe support. Un champ de priorité conduirait toutes les demandes à être
signalées comme urgentes.

### 3. Un champ piège contre les robots

Ajoutez au formulaire un champ nommé `website`, masqué en CSS (`position:
absolute; left: -9999px`), avec `tabindex="-1"` et `autocomplete="off"`. Un
humain ne le voit pas, un robot le remplit. Sa valeur est transmise telle
quelle : la plateforme se charge de filtrer.

### 4. Le relais côté serveur

**Point important : l'appel à la plateforme de pilotage se fait depuis votre
backend, jamais depuis le navigateur du praticien.** Le secret partagé ne doit
jamais apparaître dans le code côté client.

Deux variables d'environnement, déjà disponibles :

```
PILOTAGE_TICKET_URL=https://pilotage.medactio.fr/api/public/support/tickets
PILOTAGE_TICKET_SECRET=<secret partagé>
```

Créez une route interne, par exemple `POST /api/support/ticket`, qui :

1. vérifie que le praticien est authentifié ;
2. récupère son email, son nom et son établissement depuis la session ;
3. relaie la demande vers la plateforme de pilotage ;
4. renvoie une confirmation au praticien.

```js
async function ouvrirTicketPilotage({ praticien, objet, description, categorie, website, contexte }) {
  const url = process.env.PILOTAGE_TICKET_URL;
  const secret = process.env.PILOTAGE_TICKET_SECRET;
  if (!url || !secret) throw new Error("Raccordement au pilotage non configuré.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        email: praticien.email,
        fullName: praticien.nomComplet,
        organizationName: praticien.etablissement,
        title: objet,
        description,
        category: categorie,
        context: contexte,
        website,
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[Pilotage] Ticket refusé :", response.status, payload);
      throw new Error("La demande n’a pas pu être transmise.");
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}
```

### 5. Le contexte technique

Le champ `context` est un objet de chaînes de caractères, facultatif mais très
utile au support. Transmettez ce que vous connaissez de la session :

```js
const contexte = {
  version: APP_VERSION,
  navigateur: `${navigateurNom} ${navigateurVersion}`,
  ecran: pageCourante,          // ex. "Rédaction", "Historique"
  identifiantSession: sessionId, // facilite le rapprochement avec vos journaux
};
```

Ces informations sont reprises dans la description du ticket côté support et
évitent un aller-retour avec le praticien.

### 6. Retour à l'utilisateur

En cas de succès, la réponse contient l'identifiant du ticket :

```json
{ "success": true, "ticketId": 42, "linked": true }
```

Affichez une confirmation claire, par exemple : « Votre demande a bien été
transmise. Notre équipe vous répond sous 24 heures ouvrées. »

**N'affichez jamais le numéro de ticket comme une référence de suivi** tant
qu'il n'existe pas d'espace où le praticien pourrait le consulter.

En cas d'échec, proposez un repli : « Votre demande n'a pas pu être transmise.
Écrivez-nous à support@medactio.fr. » Ne perdez jamais le message saisi par le
praticien — repeuplez le formulaire.

### 7. Codes de réponse à gérer

| Code | Signification | Conduite à tenir |
|---|---|---|
| `201` | Ticket créé | Confirmation |
| `202` | Champ piège rempli | Afficher une confirmation identique, sans rien signaler |
| `400` | Données invalides | Afficher les erreurs de champ |
| `403` | Secret invalide | Erreur technique, à journaliser et alerter |
| `500` | Erreur côté plateforme | Proposer le repli par email |

## Exigences transversales

**Interface en français**, cohérente avec le reste de l'application Medactio.

**Accessibilité** : le formulaire doit être utilisable au clavier, les champs
correctement étiquetés, et les erreurs annoncées aux lecteurs d'écran.

**Aucune donnée de santé.** Le formulaire ne doit jamais inciter le praticien à
recopier le contenu d'un compte rendu ou une information concernant un patient.
Ajoutez sous le champ de description une mention explicite : « Merci de ne
communiquer aucune donnée concernant un patient. »

**Ne bloquez pas le travail en cours.** L'envoi se fait en arrière-plan, le
praticien doit pouvoir continuer à rédiger pendant la transmission.

## Vérification

Une fois développé, testez avec un compte praticien existant :

```bash
curl -X POST "$PILOTAGE_TICKET_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PILOTAGE_TICKET_SECRET" \
  -d '{"email":"<email d un praticien connu>","title":"Test de raccordement","description":"Verification.","category":"Support Technique","context":{"version":"test"}}'
```

La réponse attendue est `{"success":true,"ticketId":<n>,"linked":true}`.
`linked: true` confirme que le praticien a bien été rattaché à son
établissement dans le CRM. S'il vaut `false`, l'adresse email du praticien
n'est pas connue du CRM : le ticket est tout de même créé, mais sans
rattachement.
