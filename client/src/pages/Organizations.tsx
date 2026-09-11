import { canWriteCrm, EmptyState, formatCurrency, labelFor, PageHeader, StatusBadge } from "@/components/crm/Common";
import { DeleteDialog, OrganizationDialog } from "@/components/crm/Forms";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Building2, ChevronRight, MapPin, Pencil, Search, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Organizations() {
  const [, setLocation] = useLocation(); const utils = trpc.useUtils();
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("Tous"); const [dialog, setDialog] = useState<{ type: "create" | "edit" | "delete"; item?: any } | null>(null);
  const profile = trpc.crm.profile.useQuery(); const query = trpc.crm.organizations.list.useQuery({ search, status }); const remove = trpc.crm.organizations.delete.useMutation(); const canWrite = canWriteCrm(profile.data?.role);
  const confirmDelete = async () => { if (!dialog?.item) return; try { await remove.mutateAsync({ id: dialog.item.id }); await Promise.all([utils.crm.organizations.invalidate(), utils.crm.deals.invalidate(), utils.crm.dashboard.invalidate()]); toast.success("Organisation supprimée"); setDialog(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Suppression impossible"); } };
  return <div className="reveal mx-auto max-w-[1500px]">
    <PageHeader eyebrow="Référentiel commercial" title="Organisations" description="Établissements de santé, groupements et cabinets suivis par l’équipe commerciale." actionLabel={canWrite ? "Nouvelle organisation" : undefined} onAction={() => setDialog({ type: "create" })} />
    <Card className="soft-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un établissement ou une ville…" className="h-10 border-slate-200 pl-9" /></div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600"><option>Tous</option>{["Prospect", "En Demo", "Negociation", "Client Actif", "Inactif"].map(item => <option key={item} value={item}>{labelFor(item)}</option>)}</select>
        <span className="text-xs font-medium text-muted-foreground sm:px-2">{query.data?.length || 0} organisation{query.data?.length === 1 ? "" : "s"}</span>
      </div>
      {query.isLoading ? <div className="space-y-2 p-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}</div> : query.data?.length ? <div className="divide-y divide-slate-100">{query.data.map(org => <div key={org.id} className="group flex items-center gap-4 p-4 transition-colors hover:bg-slate-50/70">
        <button onClick={() => setLocation(`/organisations/${org.id}`)} className="flex min-w-0 flex-1 items-center gap-4 text-left"><div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#123653]/7 text-[#123653] sm:flex"><Building2 className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-slate-950">{org.name}</p><StatusBadge value={org.status} /></div><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>{labelFor(org.type)}</span><span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{org.city || "Ville non renseignée"}</span><span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{org.contactCount} contact{org.contactCount > 1 ? "s" : ""}</span></div></div><div className="hidden text-right md:block"><p className="text-sm font-semibold text-slate-900">{formatCurrency(org.openPipeline)}</p><p className="text-xs text-muted-foreground">pipeline ouvert</p></div></button>
        {canWrite ? <div className="flex shrink-0 items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"><Button variant="ghost" size="icon" onClick={() => setDialog({ type: "edit", item: org })}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-rose-600" onClick={() => setDialog({ type: "delete", item: org })}><Trash2 className="h-4 w-4" /></Button></div> : null}<ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
      </div>)}</div> : <div className="p-4"><EmptyState icon={Building2} title="Aucune organisation" description="Aucun établissement ne correspond à vos filtres." actionLabel={canWrite ? "Créer une organisation" : undefined} onAction={() => setDialog({ type: "create" })} /></div>}
    </Card>
    {dialog?.type === "create" ? <OrganizationDialog open onOpenChange={() => setDialog(null)} /> : null}
    {dialog?.type === "edit" ? <OrganizationDialog key={dialog.item.id} open onOpenChange={() => setDialog(null)} initial={dialog.item} /> : null}
    {dialog?.type === "delete" ? <DeleteDialog open onOpenChange={() => setDialog(null)} title="Supprimer cette organisation ?" description="Ses opportunités seront supprimées et ses contacts conservés sans établissement associé. Cette action est irréversible." onConfirm={confirmDelete} pending={remove.isPending} /> : null}
  </div>;
}
