import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getSupportAutomationByTaskUid, refreshSupportAlerts } from "./support.db";

export async function runSupportAlerts(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const automation = await getSupportAutomationByTaskUid(user.taskUid);
    if (!automation) return res.json({ ok: true, skipped: "orphan" });
    if (!automation.enabled) return res.json({ ok: true, skipped: "disabled" });
    const result = await refreshSupportAlerts();
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Erreur inconnue",
      stack: error instanceof Error ? error.stack : undefined,
      context: { url: req.originalUrl },
      timestamp: new Date().toISOString(),
    });
  }
}
