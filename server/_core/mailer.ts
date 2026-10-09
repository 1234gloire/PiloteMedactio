/**
 * Envoi d'emails transactionnels via Mailjet.
 *
 * Un échec d'envoi ne doit jamais faire échouer l'action métier qui l'a
 * déclenchée : une relance de facture reste enregistrée même si le message ne
 * part pas. Les erreurs sont journalisées et le résultat renvoyé à l'appelant,
 * qui décide quoi en afficher.
 *
 * Tant que `MJ_APIKEY_PUBLIC` et `MJ_APIKEY_PRIVATE` ne sont pas configurés,
 * l'envoi est ignoré en silence : l'application reste utilisable sans email.
 */

const MAILJET_ENDPOINT = "https://api.mailjet.com/v3.1/send";
const TIMEOUT_MS = 10_000;

export type MailResult = { sent: boolean; reason?: string };

export type MailInput = {
  to: string;
  toName?: string | null;
  subject: string;
  text: string;
  /** Corps HTML facultatif. À défaut, le texte brut est mis en forme. */
  html?: string;
  /**
   * Adresse à laquelle le destinataire répondra. Permet qu'une réponse
   * revienne au collaborateur qui a écrit, et non à une boîte collective.
   */
  replyTo?: string | null;
};

function config() {
  const publicKey = process.env.MJ_APIKEY_PUBLIC;
  const privateKey = process.env.MJ_APIKEY_PRIVATE;
  const from = process.env.MAIL_FROM;
  if (!publicKey || !privateKey || !from) return null;
  return {
    publicKey,
    privateKey,
    from,
    fromName: process.env.MAIL_FROM_NAME || "Medactio",
    replyTo: process.env.MAIL_REPLY_TO || from,
  };
}

export function isMailConfigured(): boolean {
  return config() !== null;
}

/** Échappe le texte inséré dans le gabarit HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Gabarit sobre, aux couleurs de Medactio. Les clients de messagerie
 * supportent mal les feuilles de style : tout est en style en ligne, et le
 * texte brut reste la version de référence.
 */
export function wrapHtml(title: string, body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map(block => `<p style="margin:0 0 16px;line-height:1.6;color:#334155;">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f8f8;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
<tr><td>
<p style="margin:0 0 24px;font-weight:700;letter-spacing:.14em;font-size:12px;color:#123653;">MEDACTIO</p>
<h1 style="margin:0 0 20px;font-size:20px;line-height:1.3;color:#0f172a;">${escapeHtml(title)}</h1>
${paragraphs}
<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;">
Medactio — aide à la rédaction des écrits hospitaliers.
</p>
</td></tr></table></body></html>`;
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const settings = config();
  if (!settings) return { sent: false, reason: "Mailjet n’est pas configuré." };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(MAILJET_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${settings.publicKey}:${settings.privateKey}`).toString("base64")}`,
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: settings.from, Name: settings.fromName },
            ReplyTo: { Email: input.replyTo || settings.replyTo },
            To: [{ Email: input.to, Name: input.toName || input.to }],
            Subject: input.subject,
            TextPart: input.text,
            HTMLPart: input.html ?? wrapHtml(input.subject, input.text),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("[Mailjet] Envoi refusé", { status: response.status, detail: detail.slice(0, 400) });
      return { sent: false, reason: `Mailjet a refusé l’envoi (${response.status}).` };
    }

    const payload = (await response.json().catch(() => null)) as
      | { Messages?: { Status?: string; Errors?: unknown }[] }
      | null;
    const status = payload?.Messages?.[0]?.Status;
    if (status !== "success") {
      console.error("[Mailjet] Message non accepté", payload?.Messages?.[0]);
      return { sent: false, reason: "Le message n’a pas été accepté." };
    }

    return { sent: true };
  } catch (error) {
    console.error("[Mailjet] Envoi impossible", {
      message: error instanceof Error ? error.message : String(error),
    });
    return { sent: false, reason: "Le service d’envoi est injoignable." };
  } finally {
    clearTimeout(timeout);
  }
}
