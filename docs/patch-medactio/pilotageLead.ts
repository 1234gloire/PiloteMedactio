import { ENV } from "./_core/env";

/**
 * Relais des demandes de démonstration vers la plateforme de pilotage.
 *
 * Le relais ne doit jamais faire échouer la demande du visiteur : toute erreur
 * est journalisée puis ignorée. Le secret n'est utilisé que côté serveur.
 */
const PILOTAGE_TIMEOUT_MS = 5000;

export type DemoLead = {
  name: string;
  fonction?: string;
  etablissement: string;
  email: string;
  praticiensConcernes?: string;
  besoin?: string;
};

export async function relayDemoRequestToPilotage(lead: DemoLead): Promise<void> {
  const url = ENV.pilotageLeadUrl;
  const secret = ENV.pilotageLeadSecret;
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
      // La plateforme reconnaît ce format et se charge de la transposition.
      body: JSON.stringify(lead),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[Pilotage] Relais du lead refusé", { status: response.status, detail });
    }
  } catch (error) {
    console.error("[Pilotage] Relais du lead impossible", {
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeout);
  }
}
