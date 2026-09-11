import { canWriteCrm, EmptyState, PageHeader } from "@/components/crm/Common";
import { ContactDialog, DeleteDialog } from "@/components/crm/Forms";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Building2, ChevronRight, Mail, Pencil, Search, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Contacts() {
  const [, setLocation] = useLocation(); const utils = trpc.useUtils(); const [search, setSearch] = useState(""); const [dialog, setDialog] = useState<{ type: "create" | "edit" | "delete"; item?: any } | null>(null);
  const profile = trpc.crm.profile.useQuery(); const query = trpc.crm.contacts.list.useQuery({ search }); const remove = trpc.crm.contacts.delete.useMutation(); const canWrite = canWriteCrm(profile.data?.role);
  const confirmDelete = async () => { if (!dialog?.item) return; try { await remove.mutateAsync({ id: dialog.item.id }); await utils.crm.contacts.invalidate(); toast.success("Contact supprimé"); setDialog(null); } catch (error) { toast.error(error instanceof Error ? error.message : "Suppression impossible"); } };
  return <div className="reveal mx-auto max-w-[1500px]">
    <PageHeader eyebrow="Carnet d’adresses" title="Contacts" description="Décideurs, référents qualité, DSI et praticiens associés aux établissements suivis." actionLabel={canWrite ? "Nouveau contact" : undefined} onAction={() => setDialog({ type: "create" })} />
    <Card className="soft-card overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un nom, un email ou un établissement…" className="h-10 border-slate-200 pl-9" /></div><span className="text-xs font-medium text-muted-foreground sm:px-2">{query.data?.length || 0} contact{query.data?.length === 1 ? "" : "s"}</span></div>
      {query.isLoading ? <div className="space-y-2 p-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}</div> : query.data?.length ? <div className="divide-y divide-slate-100">{query.data.map(contact => <div key={contact.id} className="group flex items-center gap-4 p-4 transition-colors hover:bg-slate-50/70"><button onClick={() => setLocation(`/contacts/${contact.id}`)} className="flex min-w-0 flex-1 items-center gap-4 text-left"><Avatar className="h-11 w-11 shrink-0 border border-slate-100"><AvatarFallback className="bg-teal-50 text-sm font-bold text-teal-700">{contact.fullName.split(" ").map(part => part[0]).slice(-2).join("")}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-semibold text-slate-950">{contact.fullName}</p>{contact.isLicenseActive ? <Badge className="rounded-full border-0 bg-emerald-50 text-[10px] text-emerald-700">Licence active</Badge> : null}</div><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{contact.organizationName || "Sans établissement"}</span><span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</span></div></div><div className="hidden min-w-44 text-right md:block"><p className="text-sm font-medium text-slate-800">{contact.jobTitle || "Fonction non renseignée"}</p><p className="text-xs text-muted-foreground">{contact.specialty || "Spécialité non renseignée"}</p></div></button>{canWrite ? <div className="flex shrink-0 items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"><Button variant="ghost" size="icon" onClick={() => setDialog({ type: "edit", item: contact })}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="text-rose-600" onClick={() => setDialog({ type: "delete", item: contact })}><Trash2 className="h-4 w-4" /></Button></div> : null}<ChevronRight className="h-4 w-4 text-slate-300" /></div>)}</div> : <div className="p-4"><EmptyState icon={UserRound} title="Aucun contact" description="Aucun contact ne correspond à votre recherche." actionLabel={canWrite ? "Créer un contact" : undefined} onAction={() => setDialog({ type: "create" })} /></div>}
    </Card>
    {dialog?.type === "create" ? <ContactDialog open onOpenChange={() => setDialog(null)} /> : null}
    {dialog?.type === "edit" ? <ContactDialog key={dialog.item.id} open onOpenChange={() => setDialog(null)} initial={dialog.item} /> : null}
    {dialog?.type === "delete" ? <DeleteDialog open onOpenChange={() => setDialog(null)} title="Supprimer ce contact ?" description="Le contact sera retiré des interactions futures. L’historique existant restera attaché aux opportunités." onConfirm={confirmDelete} pending={remove.isPending} /> : null}
  </div>;
}
