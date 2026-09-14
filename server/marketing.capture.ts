import type { Request, Response } from "express";
import { z } from "zod";
import { captureLead } from "./marketing.db";

const captureSchema = z.object({
  campaignId: z.coerce.number().int().positive().optional().nullable(),
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional().nullable(),
  jobTitle: z.string().trim().max(200).optional().nullable(),
  organizationName: z.string().trim().min(2).max(240),
  organizationType: z.enum(["Hopital Public", "Clinique Privee", "Groupement Hospitalier", "Cabinet Liberal"]),
  utmSource: z.string().trim().max(160).optional().nullable(),
  utmMedium: z.string().trim().max(160).optional().nullable(),
  utmCampaign: z.string().trim().max(240).optional().nullable(),
  consentToContact: z.literal(true),
  notes: z.string().trim().max(3000).optional().nullable(),
  website: z.string().max(200).optional(),
});

const allowedOrigins = new Set([
  "https://medactio.fr",
  "https://www.medactio.fr",
  "http://localhost:3000",
  "http://localhost:5173",
]);

export function applyLeadCaptureCors(req: Request, res: Response) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

export async function captureMarketingLead(req: Request, res: Response) {
  applyLeadCaptureCors(req, res);
  try {
    const input = captureSchema.parse(req.body);
    if (input.website) return res.status(202).json({ success: true });
    const { website: _, ...payload } = input;
    const created = await captureLead({ ...payload, source: "Site Web" });
    return res.status(created.duplicate ? 200 : 201).json({ success: true, duplicate: created.duplicate });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, message: "Les informations du formulaire sont invalides.", fields: error.flatten().fieldErrors });
    console.error("[Marketing] Lead capture failed", error);
    return res.status(500).json({ success: false, message: "Le formulaire n’a pas pu être enregistré." });
  }
}
