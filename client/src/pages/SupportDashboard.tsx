import { canWriteSupport, formatCurrency, formatDate, PageHeader, StatCard, StatusBadge } from "@/components/crm/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock3, FileWarning, Headphones, Loader2, RefreshCw, ReceiptText, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function SupportDashboard() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const dashboard = trpc.support.dashboard.useQuery();
  const profile = trpc.support.profile.useQuery();
  const automation = trpc.support.automation.status.useQuery();
  const refresh = trpc.support.alerts.refresh.useMutation();
  const enable = trpc.support.automation.enable.useMutation();
  const disable = trpc.support.automation.disable.useMutation();
  const canWrite = canWriteSupport(profile.data?.role);

  const refreshAlerts = async () => { try { const result = await refresh.mutateAsync(); await utils.support.invalidate(); toast.success(`${result.alerts} alerte${result.alerts > 1 ? "s" : ""} active${result.alerts > 1 ? "s" : ""}`); } catch (error) { toast.error(error instanceof Error ? error.message : "Impossible de recalculer les alertes"); } };
  const toggleAutomation = async () => { try { if (automation.data?.enabled) await disable.mutateAsync(); else await enable.mutateAsync(); await automation.refetch(); toast.success(automation.data?.enabled ? "Automatisation désactivée" : "Automatisation quotidienne activée"); } catch (error) { toast.error(error instanceof Error ? error.message : "Publiez d’abord l’application pour activer le traitement quotidien."); } };

  if (dashboard.isLoading) return <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>;
  if (!dashboard.data) return <div className="rounded-2xl bg-white p-8 text-center text-muted-foreground">Impossible de charger le tableau de bord Support.</div>;
  const data = dashboard.data;
  return <div className="space-y-7">
    <PageHeader eyebrow="Pôle Secrétariat & Support" title="Le quotidien, sous contrôle." description="Priorisez les demandes clients, les échéances administratives, les impayés et les rendez-vous depuis une vue unique." />
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mr-auto flex items-center gap-3 px-1"><div className="rounded-xl bg-teal-50 p-2 text-teal-700"><Sparkles className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-900">Veille opérationnelle</p><p className="text-xs text-muted-foreground">SLA, échéances, factures et contrats</p></div></div>
      <Button variant="outline" onClick={refreshAlerts} disabled={!canWrite || refresh.isPending} className="bg-white"><RefreshCw className={`mr-2 h-4 w-4 ${refresh.isPending ? "animate-spin" : ""}`} />Recalculer</Button>
      <Button onClick={toggleAutomation} disabled={!canWrite || enable.isPending || disable.isPending} className={automation.data?.enabled ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#123653] hover:bg-[#0b2941]"}><ShieldCheck className="mr-2 h-4 w-4" />{automation.data?.enabled ? "Quotidien actif" : "Activer le quotidien"}</Button>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Tickets ouverts" value={String(data.openTickets)} detail={`${data.urgentTickets} urgent${data.urgentTickets > 1 ? "s" : ""}`} icon={Headphones} />
      <StatCard label="SLA dépassés" value={String(data.slaBreaches)} detail={data.averageResolutionHours ? `${data.averageResolutionHours} h de résolution moyenne` : "Aucun ticket résolu"} icon={Clock3} accent="amber" />
      <StatCard label="Tâches à traiter" value={String(data.pendingTasks)} detail={`${data.overdueTasks} en retard`} icon={CheckCircle2} accent="teal" />
      <StatCard label="Impayés" value={formatCurrency(data.overdueInvoiceAmount)} detail={`${data.outstandingInvoices} facture${data.outstandingInvoices > 1 ? "s" : ""} en attente`} icon={ReceiptText} accent="violet" />
    </div>
    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Card className="border-0 shadow-sm"><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-lg">Tickets prioritaires</CardTitle><p className="mt-1 text-xs text-muted-foreground">Classés par risque de dépassement</p></div><Button variant="ghost" onClick={() => setLocation("/support/tickets")}>Voir tous</Button></CardHeader><CardContent className="space-y-2">{data.priorityTickets.length ? data.priorityTickets.map(ticket => <button key={ticket.id} onClick={() => setLocation(`/support/tickets/${ticket.id}`)} className="flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-teal-200 hover:bg-teal-50/30"><div className={`h-9 w-1 rounded-full ${ticket.overdue ? "bg-rose-500" : ticket.atRisk ? "bg-amber-500" : "bg-teal-500"}`} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{ticket.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{ticket.organizationName || "Interne"} · {ticket.assignedToName || "Non assigné"}</p></div><div className="text-right"><StatusBadge value={ticket.priority} /><p className={`mt-1 text-[11px] ${ticket.overdue ? "font-semibold text-rose-600" : "text-muted-foreground"}`}>{ticket.overdue ? `${Math.abs(ticket.remainingHours)} h de retard` : `${ticket.remainingHours} h restantes`}</p></div></button>) : <p className="py-8 text-center text-sm text-muted-foreground">Aucun ticket ouvert.</p>}</CardContent></Card>
      <Card className="border-0 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><AlertTriangle className="h-5 w-5 text-amber-600" />Alertes actives</CardTitle></CardHeader><CardContent className="space-y-3">{data.alerts.slice(0, 6).map(alert => <button key={alert.id} onClick={() => alert.link && setLocation(alert.link)} className="block w-full rounded-xl bg-slate-50 p-3 text-left transition hover:bg-slate-100"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-slate-900">{alert.title}</p><StatusBadge value={alert.severity} /></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{alert.message}</p></button>)}{!data.alerts.length && <div className="py-8 text-center"><CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-emerald-500" /><p className="text-sm font-medium">Aucune alerte active</p></div>}</CardContent></Card>
    </div>
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="border-0 shadow-sm"><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Tâches proches</CardTitle><Button size="sm" variant="ghost" onClick={() => setLocation("/support/taches")}>Ouvrir</Button></CardHeader><CardContent className="space-y-3">{data.dueTasks.map(task => <div key={task.id} className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{task.title}</p><p className="text-xs text-muted-foreground">{task.assignedToName || "Non assignée"}</p></div><span className={`text-xs font-semibold ${Number(task.daysUntilDue) < 0 ? "text-rose-600" : "text-amber-600"}`}>{Number(task.daysUntilDue) < 0 ? `J+${Math.abs(Number(task.daysUntilDue))}` : `J-${task.daysUntilDue}`}</span></div>)}</CardContent></Card>
      <Card className="border-0 shadow-sm"><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Factures à relancer</CardTitle><Button size="sm" variant="ghost" onClick={() => setLocation("/support/factures")}>Ouvrir</Button></CardHeader><CardContent className="space-y-3">{data.unpaidInvoices.map(invoice => <div key={invoice.id} className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{invoice.invoiceNumber}</p><p className="text-xs text-muted-foreground">{invoice.organizationName}</p></div><p className="text-sm font-semibold text-rose-600">{formatCurrency(invoice.amount)}</p></div>)}</CardContent></Card>
      <Card className="border-0 shadow-sm"><CardHeader className="flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4" />Agenda à venir</CardTitle><Button size="sm" variant="ghost" onClick={() => setLocation("/support/agenda")}>Ouvrir</Button></CardHeader><CardContent className="space-y-3">{data.upcomingEvents.map(event => <div key={event.id} className="rounded-xl border-l-2 border-teal-500 pl-3"><p className="text-sm font-medium">{event.title}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(event.startAt, true)} · {event.location || event.organizationName || "À préciser"}</p></div>)}</CardContent></Card>
    </div>
    <div className="grid gap-4 sm:grid-cols-2"><button onClick={() => setLocation("/support/contrats")} className="group rounded-2xl bg-[#123653] p-5 text-left text-white shadow-sm transition hover:-translate-y-0.5"><FileWarning className="mb-4 h-5 w-5 text-teal-300" /><p className="font-semibold">{data.contractsToRenew} contrat{data.contractsToRenew > 1 ? "s" : ""} à renouveler</p><p className="mt-1 text-sm text-slate-300">Échéances dans les 90 prochains jours</p></button><button onClick={() => setLocation("/support/agenda")} className="group rounded-2xl bg-teal-600 p-5 text-left text-white shadow-sm transition hover:-translate-y-0.5"><CalendarDays className="mb-4 h-5 w-5 text-teal-100" /><p className="font-semibold">{data.eventsNext7Days} rendez-vous cette semaine</p><p className="mt-1 text-sm text-teal-100">Consulter l’agenda partagé</p></button></div>
  </div>;
}
