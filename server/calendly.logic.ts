import { createHmac, timingSafeEqual } from "crypto";

/**
 * Lecture des réservations Calendly.
 *
 * Tout ce fichier est pur : aucune base, aucun réseau. La correspondance entre
 * ce qu'un client répond sur la page de réservation et ce que la plateforme en
 * fait est donc directement testable.
 */

/** Catégories proposées par la question « Objet de votre demande ». */
export type BookingCategory = "Demonstration" | "Support" | "Direction" | "Autre";

/**
 * Retire accents, ponctuation et casse.
 *
 * Les intitulés de questions sont saisis à la main dans Calendly : une
 * majuscule ou un accent qui change ne doit pas faire perdre la réponse.
 */
export function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type QuestionAnswer = { question: string; answer: string };

/** Réponse à la première question dont l'intitulé contient l'un des mots-clés. */
export function findAnswer(entries: QuestionAnswer[], keywords: string[]): string | null {
  for (const entry of entries) {
    const label = normalizeLabel(entry.question || "");
    if (keywords.some(keyword => label.includes(keyword))) {
      const answer = (entry.answer || "").trim();
      if (answer) return answer;
    }
  }
  return null;
}

/**
 * Catégorie de la demande, d'après la réponse au menu déroulant.
 *
 * La comparaison est tolérante : « Démonstration », « demonstration » ou
 * « Démo » conduisent au même traitement. Une réponse inattendue — question
 * renommée, choix ajouté — retombe sur « Autre » plutôt que d'être perdue.
 */
export function categoryFromAnswer(answer: string | null): BookingCategory {
  const value = normalizeLabel(answer || "");
  if (!value) return "Autre";
  if (value.includes("demo")) return "Demonstration";
  if (value.includes("support") || value.includes("technique")) return "Support";
  if (value.includes("direction") || value.includes("presidence")) return "Direction";
  return "Autre";
}

/** Type d'événement d'agenda correspondant à la catégorie. */
export function agendaTypeFor(category: BookingCategory): "Demo" | "Rendez-vous Client" | "Autre" {
  if (category === "Demonstration") return "Demo";
  if (category === "Support" || category === "Direction") return "Rendez-vous Client";
  return "Autre";
}

/** Rôles prévenus d'une réservation, selon ce qu'elle concerne. */
export function recipientsFor(category: BookingCategory): string[] {
  if (category === "Demonstration") return ["admin", "direction", "commercial"];
  if (category === "Support") return ["admin", "secretariat"];
  if (category === "Direction") return ["admin", "direction"];
  return ["admin", "secretariat"];
}

/** Catégorie de notification correspondante. */
export function notificationCategoryFor(category: BookingCategory) {
  if (category === "Demonstration") return "Commercial" as const;
  if (category === "Support") return "Support" as const;
  return "Succes Client" as const;
}

/* ------------------------------------------------------------------ */
/* Signature                                                           */
/* ------------------------------------------------------------------ */

/** Tolérance sur l'horodatage d'un appel, en secondes. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Vérifie la signature d'un appel Calendly.
 *
 * L'en-tête a la forme `t=<horodatage>,v1=<empreinte>`, et l'empreinte porte
 * sur `<horodatage>.<corps brut>`. Le corps doit donc être celui reçu, octet
 * pour octet : un JSON ré-encodé ne donnerait pas la même empreinte.
 *
 * L'horodatage est vérifié en plus de l'empreinte : sans cela, un appel
 * authentique intercepté pourrait être rejoué indéfiniment.
 */
export function verifyCalendlySignature(input: {
  header: string | undefined;
  rawBody: Buffer | string;
  signingKey: string;
  now?: Date;
}): { valid: boolean; reason?: string } {
  if (!input.signingKey) return { valid: false, reason: "clé de signature absente" };
  if (!input.header) return { valid: false, reason: "signature absente" };

  const parts = new Map<string, string>();
  for (const chunk of input.header.split(",")) {
    const [key, value] = chunk.split("=");
    if (key && value) parts.set(key.trim(), value.trim());
  }

  const timestamp = parts.get("t");
  const provided = parts.get("v1");
  if (!timestamp || !provided) return { valid: false, reason: "signature mal formée" };

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return { valid: false, reason: "horodatage illisible" };

  const now = input.now ?? new Date();
  const drift = Math.abs(now.getTime() / 1000 - seconds);
  if (drift > SIGNATURE_TOLERANCE_SECONDS) return { valid: false, reason: "appel trop ancien" };

  const body = typeof input.rawBody === "string" ? Buffer.from(input.rawBody, "utf8") : input.rawBody;
  const expected = createHmac("sha256", input.signingKey)
    .update(Buffer.concat([Buffer.from(`${timestamp}.`, "utf8"), body]))
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { valid: false, reason: "signature invalide" };
  }
  return { valid: true };
}

/* ------------------------------------------------------------------ */
/* Mise en forme                                                       */
/* ------------------------------------------------------------------ */

/** Intitulé de l'événement tel qu'il apparaîtra dans l'agenda. */
export function agendaTitle(category: BookingCategory, inviteeName: string, organizationName: string | null) {
  const prefix =
    category === "Demonstration" ? "Démonstration" :
    category === "Support" ? "Support" :
    category === "Direction" ? "Direction" : "Rendez-vous";
  const who = organizationName?.trim() || inviteeName.trim() || "Client";
  return `${prefix} — ${who}`.slice(0, 240);
}

/** Lien de visioconférence, quand la réservation en porte un. */
export function meetingUrlOf(location: unknown): string | null {
  if (!location || typeof location !== "object") return null;
  const value = (location as { join_url?: unknown; location?: unknown });
  if (typeof value.join_url === "string" && value.join_url.startsWith("http")) return value.join_url;
  if (typeof value.location === "string" && value.location.startsWith("http")) return value.location;
  return null;
}

/** Libellé du lieu, pour l'agenda. */
export function locationLabelOf(location: unknown): string | null {
  if (!location || typeof location !== "object") return null;
  const value = location as { type?: unknown; location?: unknown };
  const type = typeof value.type === "string" ? value.type : null;
  const labels: Record<string, string> = {
    zoom: "Zoom",
    google_conference: "Google Meet",
    microsoft_teams_conference: "Microsoft Teams",
    physical: "Sur place",
    outbound_call: "Appel sortant",
    inbound_call: "Appel entrant",
    custom: "À préciser",
  };
  if (type && labels[type]) {
    const detail = typeof value.location === "string" && !value.location.startsWith("http") ? value.location : null;
    return (detail ? `${labels[type]} — ${detail}` : labels[type]).slice(0, 240);
  }
  if (typeof value.location === "string") return value.location.slice(0, 240);
  return null;
}
