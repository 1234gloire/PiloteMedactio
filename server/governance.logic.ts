/**
 * Calculs partagés par les pôles de gouvernance : Juridique & Conformité,
 * Fournisseurs & Partenaires, RH et Roadmap Produit.
 *
 * Ces pôles ont en commun de surveiller des échéances et d'alimenter le centre
 * de notifications. La logique est regroupée ici pour que la règle « à quel
 * moment une échéance devient-elle urgente » soit définie une seule fois.
 */

export const dayMs = 24 * 60 * 60 * 1000;

export function daysUntil(value: Date | string | null | undefined, now = new Date()): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const end = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.round((end - start) / dayMs);
}

export type DeadlineSeverity = "Expire" | "Critique" | "A surveiller" | "Sereine";

/**
 * Qualifie une échéance. Le seuil critique est fixé à 30 jours : c'est le
 * délai de préavis courant des contrats d'hébergement et des certifications,
 * en deçà duquel une renégociation devient difficile.
 */
export function deadlineSeverity(days: number | null): DeadlineSeverity {
  if (days === null) return "Sereine";
  if (days < 0) return "Expire";
  if (days <= 30) return "Critique";
  if (days <= 90) return "A surveiller";
  return "Sereine";
}

export type DeadlineItem = {
  id: number;
  label: string;
  kind: "Juridique" | "Fournisseurs";
  date: string | null;
  days: number | null;
  severity: DeadlineSeverity;
  link: string;
};

/** Échéancier consolidé, trié du plus urgent au plus lointain. */
export function buildDeadlineSchedule(
  legalDocuments: { id: number; title: string | null; type: string | null; expiryDate: string | null }[],
  suppliers: { id: number; name: string; contractRenewalDate: string | null }[],
  now = new Date()
): DeadlineItem[] {
  const items: DeadlineItem[] = [];

  for (const document of legalDocuments) {
    if (!document.expiryDate) continue;
    const days = daysUntil(document.expiryDate, now);
    items.push({
      id: document.id,
      label: document.title || document.type || "Document juridique",
      kind: "Juridique",
      date: document.expiryDate,
      days,
      severity: deadlineSeverity(days),
      link: "/juridique",
    });
  }

  for (const supplier of suppliers) {
    if (!supplier.contractRenewalDate) continue;
    const days = daysUntil(supplier.contractRenewalDate, now);
    items.push({
      id: supplier.id,
      label: supplier.name,
      kind: "Fournisseurs",
      date: supplier.contractRenewalDate,
      days,
      severity: deadlineSeverity(days),
      link: "/fournisseurs",
    });
  }

  return items.sort((a, b) => (a.days ?? Number.MAX_SAFE_INTEGER) - (b.days ?? Number.MAX_SAFE_INTEGER));
}

/* ------------------------------------------------------------------ */
/* Congés                                                              */
/* ------------------------------------------------------------------ */

/**
 * Nombre de jours ouvrés d'une demande de congés, samedis et dimanches exclus.
 * Les jours fériés ne sont pas déduits : ils relèvent d'un calendrier légal
 * qui sortirait du périmètre de cet outil interne.
 */
export function businessDaysBetween(start: string, end: string): number {
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0;

  let days = 0;
  for (let cursor = from.getTime(); cursor <= to.getTime(); cursor += dayMs) {
    const weekday = new Date(cursor).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days += 1;
  }
  return days;
}

/** Nombre de jours de congés payés acquis par an, convention courante. */
export const ANNUAL_LEAVE_ALLOWANCE = 25;

export function summarizeLeave(
  requests: { type: string; status: string; startDate: string; endDate: string }[],
  allowance = ANNUAL_LEAVE_ALLOWANCE
) {
  let taken = 0;
  let pending = 0;
  for (const request of requests) {
    const days = businessDaysBetween(request.startDate, request.endDate);
    if (request.status === "Valide" && request.type === "Conges Payes") taken += days;
    if (request.status === "Demande") pending += days;
  }
  return { allowance, taken, pending, remaining: allowance - taken };
}

/** Collaborateurs absents à une date donnée, pour le calendrier d'équipe. */
export function absencesOn(
  requests: { userId: number; status: string; startDate: string; endDate: string }[],
  date: string
) {
  return requests.filter(
    request => request.status === "Valide" && request.startDate <= date && request.endDate >= date
  );
}

/* ------------------------------------------------------------------ */
/* Roadmap produit                                                     */
/* ------------------------------------------------------------------ */

export const PRODUCT_STATUSES = ["Idee", "Backlog", "En Developpement", "Livre"] as const;

const priorityWeight: Record<string, number> = { Haute: 3, Moyenne: 2, Basse: 1 };

/**
 * Score de priorisation d'une demande produit.
 *
 * Il combine la priorité saisie, le type (un bug prime sur une évolution à
 * priorité égale) et le nombre d'établissements qui ont remonté le besoin :
 * une demande portée par plusieurs clients pèse davantage.
 */
export function prioritizeRequests<T extends { priority: string; type: string; organizationId: number | null; title: string }>(
  requests: T[]
): (T & { score: number; requesterCount: number })[] {
  const demandByTitle = new Map<string, Set<number>>();
  for (const request of requests) {
    const key = request.title.trim().toLowerCase();
    const set = demandByTitle.get(key) ?? new Set<number>();
    if (request.organizationId) set.add(request.organizationId);
    demandByTitle.set(key, set);
  }

  return requests
    .map(request => {
      const requesterCount = demandByTitle.get(request.title.trim().toLowerCase())?.size ?? 0;
      const score =
        (priorityWeight[request.priority] ?? 1) * 10 +
        (request.type === "Bug" ? 5 : 0) +
        requesterCount * 3;
      return { ...request, score, requesterCount };
    })
    .sort((a, b) => b.score - a.score);
}

export function summarizeRoadmap(requests: { status: string; type: string }[]) {
  const byStatus = Object.fromEntries(PRODUCT_STATUSES.map(status => [status, 0])) as Record<string, number>;
  let bugs = 0;
  for (const request of requests) {
    byStatus[request.status] = (byStatus[request.status] ?? 0) + 1;
    if (request.type === "Bug") bugs += 1;
  }
  return { total: requests.length, byStatus, bugs, evolutions: requests.length - bugs };
}

/* ------------------------------------------------------------------ */
/* Base de connaissances                                               */
/* ------------------------------------------------------------------ */

/** Recherche plein texte simple : tous les mots doivent apparaître. */
export function searchArticles<T extends { title: string; content: string; category: string }>(
  articles: T[],
  query?: string,
  category?: string
): T[] {
  const terms = (query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .map(term => term.trim())
    .filter(Boolean);

  return articles.filter(article => {
    if (category && category !== "Toutes" && article.category !== category) return false;
    if (!terms.length) return true;
    const haystack = `${article.title} ${article.content}`.toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
}

/** Extrait un aperçu lisible, sans couper un mot en deux. */
export function excerpt(content: string, length = 160): string {
  const flat = content.replace(/\s+/g, " ").trim();
  if (flat.length <= length) return flat;
  const cut = flat.slice(0, length);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : length)}…`;
}
