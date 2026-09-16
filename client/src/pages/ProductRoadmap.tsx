import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader, formatDate, labelFor } from "@/components/crm/Common";
import { ChangelogDialog, ProductRequestDialog } from "@/components/crm/GovernanceForms";
import { trpc } from "@/lib/trpc";
import { Bug, Lightbulb, Loader2, Pencil, Plus, Rocket, Search, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const columns = [
  { status: "Idee", label: "Idées", icon: Lightbulb },
  { status: "Backlog", label: "Backlog", icon: Sparkles },
  { status: "En Developpement", label: "En développement", icon: Rocket },
  { status: "Livre", label: "Livré", icon: Bug },
] as const;

const priorityTone: Record<string, string> = {
  Haute: "bg-rose-50 text-rose-700 border-rose-200",
  Moyenne: "bg-amber-50 text-amber-800 border-amber-200",
  Basse: "bg-slate-100 text-slate-600 border-slate-200",
};

const changelogTone: Record<string, string> = {
  "Nouvelle Fonctionnalite": "bg-teal-50 text-teal-700",
  Amelioration: "bg-sky-50 text-sky-700",
  Correction: "bg-amber-50 text-amber-800",
};

export default function ProductRoadmap() {
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; item?: any }>({ open: false });
  const [changelogOpen, setChangelogOpen] = useState(false);

  const utils = trpc.useUtils();
  const access = trpc.governance.access.useQuery();
  const canWrite = access.data?.role === "admin" || access.data?.role === "direction";
  const requests = trpc.governance.product.list.useQuery({ search: search || undefined });
  const summary = trpc.governance.product.summary.useQuery();
  const changelog = trpc.governance.product.changelog.useQuery();
  const update = trpc.governance.product.update.useMutation();
  const remove = trpc.governance.product.delete.useMutation();

  const move = async (id: number, status: (typeof columns)[number]["status"]) => {
    try {
      await update.mutateAsync({ id, status });
      await Promise.all([utils.governance.product.list.invalidate(), utils.governance.product.summary.invalidate()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Déplacement impossible.");
    }
  };

  const drop = async (id: number) => {
    try {
      await remove.mutateAsync({ id });
      await Promise.all([utils.governance.product.list.invalidate(), utils.governance.product.summary.invalidate()]);
      toast.success("Demande supprimée.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible.");
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Roadmap Produit"
        title="Demandes et évolutions"
        description="Bugs et demandes d’évolution remontés par les établissements, priorisés puis publiés au changelog."
        actionLabel={canWrite ? "Nouvelle demande" : undefined}
        onAction={canWrite ? () => setDialog({ open: true }) : undefined}
      />

      <Tabs defaultValue="backlog">
        <TabsList className="mb-5">
          <TabsTrigger value="backlog">Backlog{summary.data ? ` (${summary.data.total})` : ""}</TabsTrigger>
          <TabsTrigger value="changelog">Changelog</TabsTrigger>
        </TabsList>

        <TabsContent value="backlog">
          <div className="relative mb-5 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une demande" className="h-10 rounded-lg border-slate-200 bg-white pl-9" />
          </div>

          {requests.isLoading ? (
            <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : requests.data?.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {columns.map(column => {
                const items = requests.data.filter(request => request.status === column.status);
                return (
                  <div key={column.status} className="rounded-2xl bg-slate-100/70 p-3">
                    <div className="mb-3 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <column.icon className="h-4 w-4 text-slate-500" />
                        <p className="text-sm font-semibold text-slate-700">{column.label}</p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600">{items.length}</span>
                    </div>
                    <div className="space-y-2.5">
                      {items.map(request => (
                        <Card key={request.id} className="border-0 shadow-sm">
                          <CardContent className="p-3.5">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium leading-5 text-slate-900">{request.title}</p>
                              <Badge variant="outline" className={`shrink-0 rounded-full px-2 py-0 text-[10px] font-medium ${priorityTone[request.priority]}`}>{labelFor(request.priority)}</Badge>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className={`rounded-full px-1.5 py-0.5 ${request.type === "Bug" ? "bg-rose-50 text-rose-700" : "bg-slate-100"}`}>{labelFor(request.type)}</span>
                              {request.requesterCount > 1 ? <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-violet-700">{request.requesterCount} établissements</span> : null}
                              <span>score {request.score}</span>
                            </div>
                            {request.organizationName ? <p className="mt-2 truncate text-[11px] text-muted-foreground">{request.organizationName}</p> : null}
                            {request.sourceTicketTitle ? <p className="mt-1 truncate text-[11px] text-teal-700">↳ ticket : {request.sourceTicketTitle}</p> : null}

                            {canWrite ? (
                              <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-2.5">
                                <select
                                  value={request.status}
                                  onChange={e => move(request.id, e.target.value as (typeof columns)[number]["status"])}
                                  className="h-7 flex-1 rounded-md border border-slate-200 bg-white px-1.5 text-[11px] outline-none focus:border-teal-600"
                                >
                                  {columns.map(item => <option key={item.status} value={item.status}>{item.label}</option>)}
                                </select>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDialog({ open: true, item: request })}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600" onClick={() => drop(request.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      ))}
                      {!items.length ? <p className="px-1 py-4 text-center text-xs text-muted-foreground">Aucune demande</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={Lightbulb} title="Backlog vide" description="Consignez ici les bugs et demandes d’évolution remontés par les établissements." actionLabel={canWrite ? "Nouvelle demande" : undefined} onAction={canWrite ? () => setDialog({ open: true }) : undefined} />
          )}
        </TabsContent>

        <TabsContent value="changelog">
          {canWrite ? (
            <Button onClick={() => setChangelogOpen(true)} className="mb-5 bg-[#123653]"><Plus className="mr-2 h-4 w-4" />Nouvelle entrée</Button>
          ) : null}
          {changelog.isLoading ? (
            <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : changelog.data?.length ? (
            <div className="space-y-3">
              {changelog.data.map(entry => (
                <Card key={entry.id} className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${changelogTone[entry.type]}`}>{labelFor(entry.type)}</span>
                      <p className="font-semibold text-slate-900">{entry.title}</p>
                      <span className="ml-auto text-xs text-muted-foreground">{formatDate(entry.releaseDate)}</span>
                    </div>
                    {entry.description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{entry.description}</p> : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState icon={Rocket} title="Changelog vide" description="Publiez ici les nouveautés livrées sur Medactio, communicables aux établissements." />
          )}
        </TabsContent>
      </Tabs>

      {dialog.open ? <ProductRequestDialog key={dialog.item?.id ?? "new"} open={dialog.open} onOpenChange={open => setDialog({ open })} initial={dialog.item} /> : null}
      <ChangelogDialog open={changelogOpen} onOpenChange={setChangelogOpen} />
    </>
  );
}
