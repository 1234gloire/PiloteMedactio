import { timingSafeEqual } from "crypto";
import type { Request, Response } from "express";
import { z } from "zod";
import { captureLead } from "./marketing.db";

/**
 * Capture des leads issus du site public medactio.fr.
 *
 * Deux modes d'appel coexistent :
 *
 *  - **Serveur à serveur** (recommandé) : le backend de medactio.fr relaie la
 *    demande de démonstration en présentant le secret partagé
 *    `LEAD_INTAKE_SECRET`. Aucune contrainte d'origine ne s'applique, le
 *    navigateur du visiteur n'appelle jamais cette plateforme directement, et
 *    le site continue de fonctionner si le pilotage est indisponible.
 *
 *  - **Navigateur** : un formulaire posté directement depuis medactio.fr. Les
 *    origines autorisées sont alors vérifiées et le consentement explicite est
 *    exigé.
 *
 * Le format du formulaire existant de medactio.fr est accepté tel quel
 * (`name`, `fonction`, `etablissement`, `praticiensConcernes`, `besoin`), ce
 * qui permet de relayer la demande sans la remanier côté site.
 */

const organizationTypes = [
  "Hopital Public",
  "Clinique Privee",
  "Groupement Hospitalier",
  "Cabinet Liberal",
  "Autre",
] as const;

/** Format natif de la plateforme. */
const nativeSchema = z.object({
  campaignId: z.coerce.number().int().positive().optional().nullable(),
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(40).optional().nullable(),
  jobTitle: z.string().trim().max(200).optional().nullable(),
  organizationName: z.string().trim().min(2).max(240),
  // Le formulaire public ne demande pas le type d'établissement : il reste à
  // qualifier par le commercial.
  organizationType: z.enum(organizationTypes).default("Autre"),
  utmSource: z.string().trim().max(160).optional().nullable(),
  utmMedium: z.string().trim().max(160).optional().nullable(),
  utmCampaign: z.string().trim().max(240).optional().nullable(),
  consentToContact: z.literal(true),
  notes: z.string().trim().max(3000).optional().nullable(),
  website: z.string().max(200).optional(),
});

/** Format du formulaire « Demander une démonstration » de medactio.fr. */
const demoRequestSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  fonction: z.string().trim().max(200).optional().nullable(),
  etablissement: z.string().trim().min(2).max(240),
  praticiensConcernes: z.string().trim().max(200).optional().nullable(),
  besoin: z.string().trim().max(3000).optional().nullable(),
  telephone: z.string().trim().max(40).optional().nullable(),
  utmSource: z.string().trim().max(160).optional().nullable(),
  utmMedium: z.string().trim().max(160).optional().nullable(),
  utmCampaign: z.string().trim().max(240).optional().nullable(),
  website: z.string().max(200).optional(),
});

type NativeInput = z.infer<typeof nativeSchema>;

/** Ramène une demande de démonstration au format natif. */
function fromDemoRequest(input: z.infer<typeof demoRequestSchema>): NativeInput {
  const notes = [
    input.besoin?.trim(),
    input.praticiensConcernes?.trim() ? `Praticiens concernés : ${input.praticiensConcernes.trim()}` : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    campaignId: null,
    fullName: input.name,
    email: input.email,
    phone: input.telephone ?? null,
    jobTitle: input.fonction ?? null,
    organizationName: input.etablissement,
    organizationType: "Autre",
    utmSource: input.utmSource ?? null,
    utmMedium: input.utmMedium ?? null,
    utmCampaign: input.utmCampaign ?? null,
    // Remplir un formulaire de demande de démonstration vaut demande explicite
    // d'être recontacté : le site doit l'indiquer clairement à l'utilisateur.
    consentToContact: true,
    notes: notes || null,
    website: input.website,
  };
}

/**
 * Origines autorisées pour un appel depuis un navigateur.
 * Configurables par `LEAD_CAPTURE_ORIGINS` (liste séparée par des virgules).
 */
function allowedOrigins(): Set<string> {
  const configured = (process.env.LEAD_CAPTURE_ORIGINS ?? "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);
  return new Set([
    "https://medactio.fr",
    "https://www.medactio.fr",
    ...configured,
    ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000", "http://localhost:3100", "http://localhost:5173"]),
  ]);
}

export function applyLeadCaptureCors(req: Request, res: Response) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins().has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

/** Vrai lorsque l'appel présente le secret partagé attendu. */
function isTrustedServerCall(req: Request): boolean {
  const expected = process.env.LEAD_INTAKE_SECRET;
  if (!expected) return false;

  const header = req.headers.authorization;
  const provided =
    typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
  if (!provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function captureMarketingLead(req: Request, res: Response) {
  applyLeadCaptureCors(req, res);

  const trusted = isTrustedServerCall(req);

  // Un appel depuis un navigateur doit provenir d'une origine connue. Les
  // appels serveur à serveur n'ont pas d'origine et sont authentifiés par le
  // secret partagé.
  const origin = req.headers.origin;
  if (!trusted && origin && !allowedOrigins().has(origin)) {
    return res.status(403).json({ success: false, message: "Origine non autorisée." });
  }

  try {
    // Le format natif prime ; à défaut, on tente celui du formulaire du site.
    const native = nativeSchema.safeParse(req.body);
    let input: NativeInput;
    if (native.success) {
      input = native.data;
    } else {
      const demo = demoRequestSchema.safeParse(req.body);
      if (!demo.success) {
        return res.status(400).json({
          success: false,
          message: "Les informations du formulaire sont invalides.",
          fields: native.error.flatten().fieldErrors,
        });
      }
      input = fromDemoRequest(demo.data);
    }

    // Champ piège : un robot le remplit, un humain ne le voit pas. On répond
    // comme si tout s'était bien passé, sans rien enregistrer.
    if (input.website) return res.status(202).json({ success: true });

    const { website: _, ...payload } = input;
    const created = await captureLead({ ...payload, source: "Site Web" });
    return res.status(created.duplicate ? 200 : 201).json({ success: true, duplicate: created.duplicate });
  } catch (error) {
    console.error("[Marketing] Lead capture failed", error);
    return res.status(500).json({ success: false, message: "Le formulaire n’a pas pu être enregistré." });
  }
}
