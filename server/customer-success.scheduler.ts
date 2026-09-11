import type { Request, Response } from "express";
import { getAutomationByTaskUid, refreshCustomerAlerts } from "./customer-success.db";
import { sdk } from "./_core/sdk";

export async function runCustomerSuccessAlerts(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }
    const automation = await getAutomationByTaskUid(user.taskUid);
    if (!automation) return res.json({ ok: true, skipped: "orphan" });
    if (!automation.enabled) return res.json({ ok: true, skipped: "disabled" });
    const result = await refreshCustomerAlerts();
    return res.json({ ok: true, ...result });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Erreur inconnue",
      stack: error instanceof Error ? error.stack : undefined,
      context: { url: req.originalUrl, taskUid: (req as any).user?.taskUid },
      timestamp: new Date().toISOString(),
    });
  }
}
