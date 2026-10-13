import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { CalendarClock, X } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "./Common";

/** Libellés des déclencheurs d'envoi automatique, dans l'ordre du menu. */
export const TRIGGERS = [
  { value: "ticket:En cours", label: "Ticket passé en cours" },
  { value: "ticket:En attente client", label: "Ticket en attente client" },
  { value: "ticket:Resolu", label: "Ticket marqué résolu" },
  { value: "deal:Demo Effectuee", label: "Démonstration effectuée" },
  { value: "deal:Devis Envoye", label: "Devis envoyé" },
] as const;

export type TriggerValue = (typeof TRIGGERS)[number]["value"];

export function triggerLabel(value?: string | null) {
  return TRIGGERS.find(item => item.value === value)?.label ?? null;
}

export function delayLabel(days: number) {
  return days > 0 ? `J+${days}` : "immédiat";
}

type MailResult = { templates: number; sent: number; scheduled: number; reason?: string } | null | undefined;

/**
 * Complète le message de confirmation d'un changement d'étape avec ce qui est
 * parti vers le client : l'équipe doit savoir qu'un email a été envoyé en son
 * nom.
 */
export function describeMailResult(base: string, mail: MailResult) {
  if (!mail) return { ok: true, message: base };
  const parts: string[] = [];
  if (mail.sent) parts.push(mail.sent > 1 ? `${mail.sent} emails envoyés au client` : "email envoyé au client");
  if (mail.scheduled) parts.push(mail.scheduled > 1 ? `${mail.scheduled} relances programmées` : "relance programmée");
  if (!parts.length && mail.reason) return { ok: false, message: `${base} — aucun email envoyé : ${mail.reason}` };
  return { ok: true, message: parts.length ? `${base} — ${parts.join(", ")}.` : base };
}

const statusLabel: Record<string, { label: string; className: string }> = {
  Programme: { label: "Programmé", className: "bg-sky-50 text-sky-700" },
  Envoye: { label: "Envoyé", className: "bg-emerald-50 text-emerald-700" },
  Echec: { label: "Échec", className: "bg-rose-50 text-rose-700" },
  Annule: { label: "Annulé", className: "bg-slate-100 text-slate-500" },
};

/** Emails programmés d'une opportunité, d'un ticket, ou de toute l'équipe. */
export function ScheduledEmailsCard({
  dealId,
  ticketId,
  canCancel,
  className = "soft-card",
  emptyHidden = false,
  pendingOnly = false,
}: {
  dealId?: number;
  ticketId?: number;
  canCancel: boolean;
  className?: string;
  /** Masque la carte quand rien n'est programmé, pour ne pas encombrer une fiche. */
  emptyHidden?: boolean;
  /** N'affiche que les envois encore à venir (vue d'ensemble de l'équipe). */
  pendingOnly?: boolean;
}) {
  const utils = trpc.useUtils();
  const query = trpc.email.scheduled.list.useQuery({ dealId, ticketId, pendingOnly });
  const cancel = trpc.email.scheduled.cancel.useMutation();

  const items = query.data ?? [];
  if (emptyHidden && !items.length) return null;

  const onCancel = async (id: number) => {
    try {
      await cancel.mutateAsync({ id });
      await utils.email.scheduled.list.invalidate();
      toast.success("Envoi annulé.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Annulation impossible.");
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-sky-700" />Emails programmés</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">Relances automatiques et envois différés vers le client</p>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <div className="space-y-2">
            {items.map(item => {
              const tone = statusLabel[item.status] ?? statusLabel.Programme;
              return (
                <div key={item.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.subject}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.toName || item.toEmail} · {item.status === "Envoye" ? `envoyé ${formatDate(item.sentAt, true)}` : formatDate(item.sendAt, true)}
                      {item.trigger ? ` · ${triggerLabel(item.trigger)}` : " · programmé à la main"}
                    </p>
                    {item.lastError && item.status !== "Envoye" ? <p className="mt-1 text-xs text-rose-600">{item.lastError}</p> : null}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.className}`}>{tone.label}</span>
                  {canCancel && item.status === "Programme" ? (
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-rose-500" title="Annuler l’envoi" onClick={() => void onCancel(item.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">Aucun email programmé.</p>
        )}
      </CardContent>
    </Card>
  );
}
