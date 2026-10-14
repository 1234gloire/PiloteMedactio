import { ENV } from "./_core/env";

/**
 * Relais des abonnements Stripe vers la plateforme de pilotage.
 *
 * Stripe n'est interrogé que depuis ce produit : le pilotage se contente de
 * recevoir ce qui s'y passe, afin que les deux systèmes ne divergent jamais
 * sur l'état réel d'un abonnement.
 *
 * Le relais ne doit jamais faire échouer le traitement du webhook : Stripe
 * réessaierait, et une indisponibilité du pilotage perturberait la
 * facturation. Toute erreur est journalisée puis ignorée.
 */
const PILOTAGE_TIMEOUT_MS = 6000;

export type PilotageBillingEvent = {
  event: string;
  email: string;
  fullName?: string | null;
  organizationName?: string | null;
  stripeCustomerId: string;
  stripeSubscriptionId?: string | null;
  status: string;
  planName?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  seats?: number | null;
  interval?: "month" | "year" | null;
  startDate?: string | null;
  renewalDate?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  invoice?: {
    stripeInvoiceId: string;
    number?: string | null;
    amountCents: number;
    paidAt?: string | null;
    status?: "paid" | "open" | "uncollectible" | "void" | null;
  } | null;
};

/** Date au format AAAA-MM-JJ attendu par le pilotage. */
export function pilotageDate(timestamp?: number | null): string | null {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

export async function relayBillingToPilotage(payload: PilotageBillingEvent): Promise<void> {
  const url = ENV.pilotageBillingUrl;
  const secret = ENV.pilotageBillingSecret;
  if (!url || !secret) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PILOTAGE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[Pilotage] Relais de facturation refusé", { status: response.status, detail: detail.slice(0, 300) });
    }
  } catch (error) {
    console.error("[Pilotage] Relais de facturation impossible", {
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeout);
  }
}
