import { canWriteSupport, EmptyState, formatDate, labelFor, PageHeader, StatusBadge, ticketOrigin } from "@/components/crm/Common";
import { DeleteDialog } from "@/components/crm/Forms";
import { TicketDialog } from "@/components/crm/SupportForms";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Clock3, Headphones, Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const statuses = ["Tous", "Nouveau", "En cours", "En attente client", "Resolu"];
const priorities = ["Toutes", "Basse", "Moyenne", "Haute", "Urgente"];

export default function SupportTickets() {
  const [, setLocation] = useLocation(); const utils = trpc.useUtils(); const profile = trpc.support.profile.useQuery();
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("Tous"); const [priority, setPriority] = useState("Toutes"); const [dialog, setDialog] = useState<{ open: boolean; item?: any }>({ open: false }); const [deleting, setDeleting] = useState<any>(null);
  const query = trpc.support.tickets.list.useQuery({ search, status, priority }); const remove = trpc.support.tickets.delete.useMutation(); const canWrite = canWriteSupport(profile.data?.role);
  const confirmDelete = async () => { if (!deleting) return; try { await remove.mutateAsync({ id: deleting.id }); await Promise.all([utils.support.tickets.invalidate(), utils.support.dashboard.invalidate()]); toast.success("Ticket supprimé"); setDeleting(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Suppression impossible"); } };
  return <div>
    <PageHeader eyebrow="Secrétariat & Support" title="Tickets de support" description="Suivez chaque demande, son responsable et le temps restant avant le délai cible." actionLabel={canWrite ? "Nouveau ticket" : undefined} onAction={() => setDialog({ open: true })} />
    <Card className="mb-5 border-0 shadow-sm"><CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_190px_170px]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un ticket ou un établissement…" className="pl-9" /></div><select value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-lg border bg-white px-3 text-sm">{statuses.map(value => <option key={value} value={value}>{labelFor(value)}</option>)}</select><select value={priority} onChange={e => setPriority(e.target.value)} className="h-10 rounded-lg border bg-white px-3 text-sm">{priorities.map(value => <option key={value}>{value}</option>)}</select></CardContent></Card>
    {query.isLoading ? <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : query.data?.length ? <div className="space-y-3">{query.data.map(ticket => <Card key={ticket.id} className="border-0 shadow-sm transition hover:shadow-md"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"><button onClick={() => setLocation(`/support/tickets/${ticket.id}`)} className="flex min-w-0 flex-1 items-start gap-4 text-left"><div className={`mt-1 h-10 w-1 shrink-0 rounded-full ${ticket.overdue ? "bg-rose-500" : ticket.atRisk ? "bg-amber-500" : "bg-teal-500"}`} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-950">{ticket.title}</p><StatusBadge value={ticket.priority} /><StatusBadge value={ticket.status} /></div><p className="mt-1 text-sm text-muted-foreground">{ticketOrigin(ticket)}{ticket.contactName ? ` · ${ticket.contactName}` : ""}</p><p className="mt-2 text-xs text-muted-foreground">Créé le {formatDate(ticket.createdAt, true)} · {ticket.assignedToName || "Non assigné"}</p></div></button><div className="flex items-center justify-between gap-3 sm:justify-end"><div className={`rounded-xl px-3 py-2 text-right ${ticket.overdue ? "bg-rose-50 text-rose-700" : ticket.atRisk ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-600"}`}><p className="flex items-center gap-1 text-xs font-semibold"><Clock3 className="h-3.5 w-3.5" />{ticket.label}</p><p className="mt-1 text-[11px]">{ticket.status === "Resolu" ? `Résolu ${formatDate(ticket.resolvedAt, true)}` : ticket.overdue ? `${Math.abs(ticket.remainingHours)} h de retard` : `${ticket.remainingHours} h restantes`}</p></div>{canWrite && <><Button size="icon" variant="ghost" onClick={() => setDialog({ open: true, item: ticket })}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => setDeleting(ticket)} className="text-rose-600"><Trash2 className="h-4 w-4" /></Button></>}</div></CardContent></Card>)}</div> : <EmptyState icon={Headphones} title="Aucun ticket" description="Créez le premier ticket pour centraliser les demandes clients." actionLabel={canWrite ? "Nouveau ticket" : undefined} onAction={() => setDialog({ open: true })} />}
    {dialog.open && <TicketDialog key={dialog.item?.id || "new"} open={dialog.open} onOpenChange={open => setDialog({ open })} initial={dialog.item} />}
    <DeleteDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)} title="Supprimer ce ticket ?" description="Le ticket et son journal seront supprimés définitivement." onConfirm={confirmDelete} pending={remove.isPending} />
  </div>;
}
