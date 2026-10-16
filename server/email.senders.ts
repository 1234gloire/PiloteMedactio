/**
 * Boîtes d'expédition de Medactio.
 *
 * Un message n'engage pas la même voix selon qu'il règle un incident, relance
 * un devis ou vient de la présidence : le destinataire doit voir d'où on lui
 * écrit. Toutes ces adresses sont servies par le domaine `medactio.fr`, validé
 * chez Mailjet (SPF et DKIM), ce qui autorise l'envoi sans déclarer chaque
 * adresse une à une.
 *
 * Ce fichier ne fait aucun accès aux données : il est directement testable.
 */

export type SenderKey = "contact" | "support" | "secretariat" | "commercial" | "presidence";

export type SenderIdentity = {
  key: SenderKey;
  email: string;
  /** Intitulé présenté dans la liste de choix. */
  label: string;
  /** Nom affiché par le client de messagerie du destinataire. */
  name: string;
  /**
   * Rôles autorisés à écrire depuis cette boîte. `null` : tous les rôles qui
   * écrivent aux établissements.
   */
  roles: string[] | null;
};

export const senderIdentities: SenderIdentity[] = [
  {
    key: "contact",
    email: "contact@medactio.fr",
    label: "Medactio — accueil",
    name: "Equipe Medactio",
    roles: null,
  },
  {
    key: "support",
    email: "support@medactio.fr",
    label: "Support technique",
    name: "Support Medactio",
    roles: null,
  },
  {
    key: "secretariat",
    email: "secretariat@medactio.fr",
    label: "Secrétariat",
    name: "Secretariat Medactio",
    roles: null,
  },
  {
    key: "commercial",
    email: "commercial@medactio.fr",
    label: "Commercial",
    name: "Equipe commerciale Medactio",
    roles: null,
  },
  {
    // Adresse nominative : écrire au nom de la présidence ne s'improvise pas.
    key: "presidence",
    email: "roland.mafouta@medactio.fr",
    label: "Présidence",
    name: "Roland Mafouta — Medactio",
    roles: ["admin", "direction"],
  },
];

/** Boîte utilisée quand rien n'est précisé. */
export const FALLBACK_SENDER_KEY: SenderKey = "contact";

/**
 * Boîte proposée par défaut à un rôle : celle de son équipe. Chacun écrit
 * depuis sa propre boîte sans avoir à y penser.
 */
const DEFAULT_BY_ROLE: Record<string, SenderKey> = {
  commercial: "commercial",
  secretariat: "secretariat",
};

export function senderByKey(key: string | null | undefined): SenderIdentity | null {
  return senderIdentities.find(item => item.key === key) ?? null;
}

export function canUseSender(identity: SenderIdentity, role: string): boolean {
  return identity.roles === null || identity.roles.includes(role);
}

export function sendersForRole(role: string): SenderIdentity[] {
  return senderIdentities.filter(identity => canUseSender(identity, role));
}

export function defaultSenderKey(role: string): SenderKey {
  return DEFAULT_BY_ROLE[role] ?? FALLBACK_SENDER_KEY;
}

/**
 * Détermine la boîte d'expédition d'un message.
 *
 * Le choix venu de l'interface n'est jamais pris pour acquis : un rôle qui
 * n'a pas accès à une boîte ne doit pas pouvoir écrire en son nom, même en
 * forgeant l'appel.
 */
export function resolveSender(key: string | null | undefined, role: string): SenderIdentity {
  if (!key) return senderByKey(defaultSenderKey(role)) as SenderIdentity;

  const identity = senderByKey(key);
  if (!identity) throw new Error("Cette boîte d’expédition n’existe pas.");
  if (!canUseSender(identity, role)) {
    throw new Error(`Votre rôle ne permet pas d’écrire depuis ${identity.email}.`);
  }
  return identity;
}

/**
 * Boîte d'un envoi automatique, selon ce qui le déclenche : un incident part
 * du support, une demande entrante ou une relance commerciale du commercial,
 * un impayé du secrétariat.
 */
export function automaticSenderKey(context: "ticket" | "deal" | "lead" | "invoice"): SenderKey {
  if (context === "ticket") return "support";
  if (context === "deal" || context === "lead") return "commercial";
  return "secretariat";
}
