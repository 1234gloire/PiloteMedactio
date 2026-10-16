import { canWriteSupport, EmptyState, formatDate, labelFor, PageHeader, StatusBadge } from "@/components/crm/Common";
import { DeleteDialog } from "@/components/crm/Forms";
import { CalendarEventDialog } from "@/components/crm/SupportForms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  CalendarCheck, CalendarDays, CalendarX2, Clock3, ExternalLink,
  Loader2, MapPin, Pencil, RefreshCw, Trash2, Users, Video,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const FILTERS = ["Tous", "Rendez-vous Interne", "Demo", "Rendez-vous Client", "Echeance", "Autre"];

const hourFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "short" });

/** Créneau d'un événement, en une lecture. */
function timeRange(event: { allDay: boolean; startAt: Date; endAt: Date | null }) {
  if (event.allDay) return "Toute la journée";
  const start = formatDate(event.startAt, true);
  return event.endAt ? `${start} – ${hourFormat.format(event.endAt)}` : start;
}

/**
 * Description d'un événement.
 *
 * Les lignes sont conservées, et les adresses web rendues cliquables : une
 * URL recopiée à la main dans un événement interne doit s'ouvrir comme celles
 * des réservations.
 */
function Description({ text }: { text: string }) {
  return (
    <div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">
      {text.split("\n").map((line, lineIndex) => (
        <p key={lineIndex} className="break-words">
          {line.split(/(https?:\/\/\S+)/g).map((part, index) =>
            /^https?:\/\//.test(part) ? (
              <a key={index} href={part} target="_blank" rel="noreferrer"
                className="font-medium text-teal-700 underline underline-offset-2 hover:text-teal-800">
                {part.replace(/^https?:\/\//, "").slice(0, 60)}
              </a>
            ) : (
              <span key={index}>{part}</span>
            )
          )}
        </p>
      ))}
    </div>
  );
}

/** Actions proposées par le service de réservation. */
function BookingActions({ event }: {
  event: { meetingUrl: string | null; rescheduleUrl: string | null; cancelUrl: string | null; externalSource: string | null };
}) {
  if (!event.meetingUrl && !event.rescheduleUrl && !event.cancelUrl) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {event.meetingUrl ? (
        <a href={event.meetingUrl} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-teal-700">
          <Video className="h-3.5 w-3.5" />Rejoindre
        </a>
      ) : null}
      {event.rescheduleUrl ? (
        <a href={event.rescheduleUrl} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
          <RefreshCw className="h-3.5 w-3.5" />Reprogrammer
        </a>
      ) : null}
      {event.cancelUrl ? (
        <a href={event.cancelUrl} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:border-rose-200 hover:bg-rose-50">
          <CalendarX2 className="h-3.5 w-3.5" />Annuler
        </a>
      ) : null}
      {event.externalSource === "calendly" && (event.rescheduleUrl || event.cancelUrl) ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <ExternalLink className="h-3 w-3" />reprogrammer et annuler se font chez Calendly
        </span>
      ) : null}
    </div>
  );
}

export default function SupportCalendar() {
  const utils = trpc.useUtils();
  const profile = trpc.support.profile.useQuery();
  const query = trpc.support.events.list.useQuery();
  const remove = trpc.support.events.delete.useMutation();
  const [type, setType] = useState("Tous");
  const [dialog, setDialog] = useState<{ open: boolean; item?: any }>({ open: false });
  const [deleting, setDeleting] = useState<any>(null);
  const canWrite = canWriteSupport(profile.data?.role);

  const groups = useMemo(() => {
    const rows = (query.data || []).filter(event => type === "Tous" || event.eventType === type);
    return rows.reduce<Record<string, typeof rows>>((acc, event) => {
      const key = event.startAt.toISOString().slice(0, 10);
      (acc[key] ||= []).push(event);
      return acc;
    }, {});
  }, [query.data, type]);

  const confirmDelete = async () => {
    if (!deleting) return;
    await remove.mutateAsync({ id: deleting.id });
    await Promise.all([query.refetch(), utils.support.dashboard.invalidate()]);
    setDeleting(null);
    toast.success("Événement supprimé");
  };

  return (
    <div>
      <PageHeader
        eyebrow="Secrétariat & Support"
        title="Agenda partagé"
        description="Coordonnez les rendez-vous internes, démos, échanges clients et échéances."
        actionLabel={canWrite ? "Nouvel événement" : undefined}
        onAction={() => setDialog({ open: true })}
      />

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map(value => (
          <Button key={value} size="sm" variant={type === value ? "default" : "outline"}
            onClick={() => setType(value)} className={type === value ? "bg-[#123653]" : "bg-white"}>
            {labelFor(value)}
          </Button>
        ))}
      </div>

      {query.isLoading ? (
        <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : Object.keys(groups).length ? (
        <div className="space-y-6">
          {Object.entries(groups).map(([date, events]) => (
            <section key={date}>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-[#123653] text-white">
                  <span className="text-[10px] font-bold uppercase">{monthFormat.format(new Date(`${date}T12:00:00`))}</span>
                  <span className="text-lg font-semibold leading-none">{new Date(`${date}T12:00:00`).getDate()}</span>
                </div>
                <div>
                  <p className="font-semibold capitalize">{dayFormat.format(new Date(`${date}T12:00:00`))}</p>
                  <p className="text-xs text-muted-foreground">{events.length} événement{events.length > 1 ? "s" : ""}</p>
                </div>
              </div>

              <div className="ml-5 space-y-3 border-l border-slate-200 pl-8">
                {events.map(event => (
                  <Card key={event.id}
                    className="relative border-0 shadow-sm before:absolute before:-left-[37px] before:top-6 before:h-4 before:w-4 before:rounded-full before:border-4 before:border-[#f6f8fa] before:bg-teal-500">
                    <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-950">{event.title}</p>
                          <StatusBadge value={event.eventType} />
                          {event.externalSource === "calendly" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                              <CalendarCheck className="h-3 w-3" />Réservé en ligne
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{timeRange(event)}</span>
                          {event.location ? (
                            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>
                          ) : null}
                          {event.organizationName || event.organizerName ? (
                            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{event.organizationName || event.organizerName}</span>
                          ) : null}
                        </div>

                        <BookingActions event={event} />
                        {event.description ? <Description text={event.description} /> : null}
                      </div>

                      {canWrite ? (
                        <div className="flex shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => setDialog({ open: true, item: event })}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-rose-600" onClick={() => setDeleting(event)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CalendarDays}
          title="Agenda vide"
          description="Ajoutez les prochains rendez-vous et échéances partagés."
          actionLabel={canWrite ? "Nouvel événement" : undefined}
          onAction={() => setDialog({ open: true })}
        />
      )}

      {dialog.open && <CalendarEventDialog key={dialog.item?.id || "new"} open={dialog.open} onOpenChange={open => setDialog({ open })} initial={dialog.item} />}
      <DeleteDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}
        title="Supprimer cet événement ?" description="Il disparaîtra de l’agenda partagé."
        onConfirm={confirmDelete} pending={remove.isPending} />
    </div>
  );
}
