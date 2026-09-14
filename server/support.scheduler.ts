import type { Request, Response } from "express";
import { getSupportAutomation, refreshSupportAlerts } from "./support.db";
import { isAuthorizedCronRequest } from "./_core/cronAuth";

export async function runSupportAlerts(req: Request, res: Response) {
  if (!isAuthorizedCronRequest(req)) {
    return res.status(403).json({ error: "cron-only" });
  }
  try {
    const automation = await getSupportAutomation();
    if (!automation) return res.json({ ok: true, skipped: "orphan" });
    if (!automation.enabled) return res.json({ ok: true, skipped: "disabled" });
    const result = await refreshSupportAlerts();
    return res.json({ ok: true, ...result });
  } catch (error) {
    console.error("[Cron] Alertes Support", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Erreur inconnue",
      timestamp: new Date().toISOString(),
    });
  }
}
