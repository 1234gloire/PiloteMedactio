import { asc, eq } from "drizzle-orm";
import { automationKeys, automations } from "../drizzle/schema";
import { requireDb } from "./db";

export type AutomationKey = (typeof automationKeys)[number];

/**
 * Catalogue des traitements planifiés.
 *
 * Le code est la source de vérité : la base ne retient que l'activation et le
 * dernier résultat. Un traitement retiré du catalogue disparaît donc de
 * l'écran d'administration sans laisser de ligne fantôme.
 *
 * `schedule` reprend l'heure réellement configurée dans `pg_cron` (heure UTC) :
 * elle est affichée à titre indicatif, la plateforme ne la pilote pas.
 */
export const automationCatalog: {
  key: AutomationKey;
  label: string;
  description: string;
  pole: string;
  schedule: string;
  endpoint: string;
}[] = [
  {
    key: "daily-customer-success-alerts",
    label: "Veille des comptes clients",
    description:
      "Recalcule les scores de santé, les renouvellements à préparer, les fins d’essai et les onboardings en attente.",
    pole: "Succès client",
    schedule: "Tous les jours à 06:00",
    endpoint: "/api/scheduled/customer-success-alerts",
  },
  {
    key: "daily-support-alerts",
    label: "Veille opérationnelle",
    description: "Contrôle les SLA des tickets, les tâches en retard, les contrats et les factures à relancer.",
    pole: "Secrétariat & Support",
    schedule: "Tous les jours à 06:30",
    endpoint: "/api/scheduled/support-alerts",
  },
  {
    key: "daily-invoice-reminders",
    label: "Relance des factures impayées",
    description:
      "Passe les factures échues en retard et envoie les relances arrivées à échéance, jusqu’à trois rappels espacés de sept jours.",
    pole: "Finance & Comptabilité",
    schedule: "Tous les jours à 07:00",
    endpoint: "/api/scheduled/invoice-reminders",
  },
  {
    key: "daily-governance-watch",
    label: "Veille des échéances internes",
    description:
      "Signale à la direction les documents juridiques et contrats fournisseurs qui expirent, les congés à valider et les demandes produit prioritaires.",
    pole: "Direction",
    schedule: "Tous les jours à 07:30",
    endpoint: "/api/scheduled/governance-watch",
  },
  {
    key: "scheduled-emails",
    label: "Envoi des emails programmés",
    description:
      "Envoie les relances déclenchées par les modèles (après démonstration, après devis, suivi de ticket) et les messages programmés à la main.",
    pole: "Commercial & Support",
    schedule: "Toutes les 15 minutes",
    endpoint: "/api/scheduled/emails",
  },
];

/** Crée les lignes manquantes : un traitement neuf est désactivé par défaut. */
async function ensureRows() {
  const db = await requireDb();
  for (const item of automationCatalog) {
    await db.insert(automations).values({ key: item.key }).onConflictDoNothing({ target: automations.key });
  }
}

export async function listAutomations() {
  await ensureRows();
  const db = await requireDb();
  const rows = await db.select().from(automations).orderBy(asc(automations.key));
  return automationCatalog.map(item => {
    const row = rows.find(candidate => candidate.key === item.key);
    return {
      ...item,
      enabled: row?.enabled ?? false,
      lastRunAt: row?.lastRunAt ?? null,
      lastStatus: row?.lastStatus ?? null,
      lastDetail: row?.lastDetail ?? null,
    };
  });
}

export async function getAutomation(key: AutomationKey) {
  const db = await requireDb();
  const row = (await db.select().from(automations).where(eq(automations.key, key)).limit(1))[0];
  if (row) return row;
  await ensureRows();
  return (await db.select().from(automations).where(eq(automations.key, key)).limit(1))[0] ?? null;
}

export async function setAutomationEnabled(key: AutomationKey, enabled: boolean) {
  const db = await requireDb();
  await db
    .insert(automations)
    .values({ key, enabled })
    .onConflictDoUpdate({ target: automations.key, set: { enabled } });
  return { key, enabled } as const;
}

/** Consigne l'issue d'une exécution, pour que l'écran la restitue. */
export async function recordAutomationRun(
  key: AutomationKey,
  status: "Succes" | "Echec",
  detail: string,
  ranAt = new Date()
) {
  const db = await requireDb();
  await db
    .insert(automations)
    .values({ key, lastRunAt: ranAt, lastStatus: status, lastDetail: detail.slice(0, 2_000) })
    .onConflictDoUpdate({
      target: automations.key,
      set: { lastRunAt: ranAt, lastStatus: status, lastDetail: detail.slice(0, 2_000) },
    });
}
