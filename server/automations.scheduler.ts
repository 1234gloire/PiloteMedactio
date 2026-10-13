import type { Request, RequestHandler, Response } from "express";
import { isAuthorizedCronRequest } from "./_core/cronAuth";
import { type AutomationKey, getAutomation, recordAutomationRun } from "./automations.db";
import { refreshCustomerAlerts } from "./customer-success.db";
import { refreshSupportAlerts } from "./support.db";
import { runInvoiceReminders } from "./finance.reminders";
import { refreshNotifications } from "./governance.db";

/**
 * Déclenchement des traitements planifiés.
 *
 * `pg_cron` appelle ces points d'entrée à heure fixe en présentant le secret
 * partagé. Chaque exécution est consignée dans le registre : la direction
 * constate ainsi un échec sans avoir à lire les journaux du serveur.
 *
 * Un traitement désactivé répond malgré tout en succès : le déclencheur n'a
 * pas à distinguer « éteint » de « en panne », c'est l'écran
 * d'administration qui porte cette lecture.
 */
export function scheduledRoute(
  key: AutomationKey,
  logLabel: string,
  handler: () => Promise<{ summary: string } & Record<string, unknown>>
): RequestHandler {
  return async (req: Request, res: Response) => {
    if (!isAuthorizedCronRequest(req)) {
      return res.status(403).json({ error: "cron-only" });
    }
    try {
      const automation = await getAutomation(key);
      if (!automation) return res.json({ ok: true, skipped: "orphan" });
      if (!automation.enabled) return res.json({ ok: true, skipped: "disabled" });

      const result = await handler();
      await recordAutomationRun(key, "Succes", result.summary);
      return res.json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      console.error(`[Planifié] ${logLabel}`, error);
      // L'échec est consigné pour être visible, mais sans masquer l'erreur :
      // si le registre lui-même est inaccessible, la réponse reste un 500.
      await recordAutomationRun(key, "Echec", message).catch(() => undefined);
      return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
    }
  };
}

export const runCustomerSuccessAlerts = scheduledRoute(
  "daily-customer-success-alerts",
  "Veille des comptes clients",
  async () => {
    const result = await refreshCustomerAlerts();
    return { ...result, summary: `${result.alerts} alerte(s) sur ${result.processedCustomers} client(s).` };
  }
);

export const runSupportAlerts = scheduledRoute("daily-support-alerts", "Veille opérationnelle", async () => {
  const result = await refreshSupportAlerts();
  return { ...result, summary: `${result.alerts} alerte(s) active(s).` };
});

export const runInvoiceRemindersRoute = scheduledRoute(
  "daily-invoice-reminders",
  "Relance des factures impayées",
  async () => {
    const result = await runInvoiceReminders();
    return {
      ...result,
      summary: `${result.markedOverdue} facture(s) passée(s) en retard, ${result.remindersSent} relance(s) envoyée(s)${result.remindersFailed ? `, ${result.remindersFailed} en échec` : ""}.`,
    };
  }
);

export const runGovernanceWatch = scheduledRoute(
  "daily-governance-watch",
  "Veille des échéances internes",
  async () => {
    const result = await refreshNotifications();
    return { ...result, summary: `${result.created} notification(s) créée(s) pour ${result.recipients} destinataire(s).` };
  }
);
