import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DirectionGate } from "@/components/crm/Analytics";
import { EmptyState, PageHeader, formatDate, labelFor } from "@/components/crm/Common";
import { LegalDocumentDialog } from "@/components/crm/GovernanceForms";
import { trpc } from "@/lib/trpc";
import { CalendarClock, Download, Loader2, Pencil, Scale, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const types = ["Tous", "CGU", "CGV", "DPA RGPD", "Contrat Fournisseur", "Certificat HDS", "Statuts", "Autre"] as const;

const severityTone: Record<string, string> = {
  Expire: "bg-rose-50 text-rose-700 border-rose-200",
  Critique: "bg-amber-50 text-amber-800 border-amber-200",
  "A surveiller": "bg-sky-50 text-sky-700 border-sky-200",
  Sereine: "bg-teal-50 text-teal-700 border-teal-200",
};

function DeadlineBadge({ severity, days }: { severity: string; days: number | null }) {
  const text =
    days === null ? "Sans échéance" : days < 0 ? `Expiré depuis ${Math.abs(days)} j` : `J-${days}`;
  return <Badge variant="outline" className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${severityTone[severity] ?? severityTone.Sereine}`}>{text}</Badge>;
}

export default function Legal() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string>("Tous");
  const [dialog, setDialog] = useState<{ open: boolean; item?: any }>({ open: false });
  const [deleting, setDeleting] = useState<any | null>(null);

  const utils = trpc.useUtils();
  const access = trpc.governance.access.useQuery();
  const canWrite = access.data?.legal === true;
  const documents = trpc.governance.legal.list.useQuery({ search: search || undefined, type }, { enabled: access.data?.legal === true });
  const schedule = trpc.governance.legal.schedule.useQuery(undefined, { enabled: access.data?.legal === true });
  const remove = trpc.governance.legal.delete.useMutation();

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync({ id: deleting.id });
      await Promise.all([utils.governance.legal.list.invalidate(), utils.governance.legal.schedule.invalidate()]);
      toast.success("Document supprimé.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <DirectionGate loading={access.isLoading} forbidden={access.data?.legal === false}>
      <PageHeader
        eyebrow="Juridique & Conformité"
        title="Documents et conformité"
        description="CGU, CGV, accords de sous-traitance RGPD, certificat HDS et statuts, avec leurs échéances."
        actionLabel={canWrite ? "Nouveau document" : undefined}
        onAction={canWrite ? () => setDialog({ open: true }) : undefined}
      />

      <Tabs defaultValue="documents">
        <TabsList className="mb-5">
          <TabsTrigger value="documents">Bibliothèque</TabsTrigger>
          <TabsTrigger value="echeancier">Échéancier de conformité</TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un document" className="h-10 rounded-lg border-slate-200 bg-white pl-9" />
            </div>
            <select value={type} onChange={e => setType(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600">
              {types.map(item => <option key={item} value={item}>{item === "Tous" ? "Tous les types" : labelFor(item)}</option>)}
            </select>
          </div>

          {documents.isLoading ? (
            <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : documents.data?.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {documents.data.map(document => (
                <Card key={document.id} className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="rounded-xl bg-teal-50 p-3 text-teal-700"><ShieldCheck className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{document.title || labelFor(document.type)}</p>
                          <DeadlineBadge severity={document.severity} days={document.daysUntilExpiry} />
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {labelFor(document.type)}{document.version ? ` · ${document.version}` : ""}{document.organizationName ? ` · ${document.organizationName}` : " · document interne"}
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                          <div><p className="text-muted-foreground">Entrée en vigueur</p><p className="mt-1 font-medium">{formatDate(document.effectiveDate)}</p></div>
                          <div><p className="text-muted-foreground">Expiration</p><p className="mt-1 font-medium">{formatDate(document.expiryDate)}</p></div>
                        </div>
                        {document.notes ? <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">{document.notes}</p> : null}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                      {document.documentUrl ? (
                        <Button variant="outline" size="sm" asChild className="mr-auto bg-white">
                          <a href={document.documentUrl} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />{document.documentName || "Document"}</a>
                        </Button>
                      ) : (
                        <span className="mr-auto text-xs text-muted-foreground">Aucun fichier joint</span>
                      )}
                      {canWrite ? (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => setDialog({ open: true, item: document })}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-rose-600" onClick={() => setDeleting(document)}><Trash2 className="h-4 w-4" /></Button>
                        </>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState icon={Scale} title="Aucun document" description="Référencez vos CGU, CGV, accords RGPD et certificats de conformité." actionLabel={canWrite ? "Nouveau document" : undefined} onAction={canWrite ? () => setDialog({ open: true }) : undefined} />
          )}
        </TabsContent>

        <TabsContent value="echeancier">
          {schedule.isLoading ? (
            <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : schedule.data?.length ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0">
                <div className="divide-y divide-slate-100">
                  {schedule.data.map(item => (
                    <div key={`${item.kind}-${item.id}`} className="flex items-center gap-4 p-4">
                      <div className={`rounded-lg p-2 ${item.kind === "Juridique" ? "bg-teal-50 text-teal-700" : "bg-violet-50 text-violet-700"}`}>
                        <CalendarClock className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.kind === "Juridique" ? "Document juridique" : "Contrat fournisseur"} · {formatDate(item.date)}</p>
                      </div>
                      <DeadlineBadge severity={item.severity} days={item.days} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState icon={CalendarClock} title="Aucune échéance" description="Renseignez les dates d’expiration de vos documents et contrats pour les suivre ici." />
          )}
        </TabsContent>
      </Tabs>

      {dialog.open ? <LegalDocumentDialog key={dialog.item?.id ?? "new"} open={dialog.open} onOpenChange={open => setDialog({ open })} initial={dialog.item} /> : null}

      <AlertDialog open={Boolean(deleting)} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>{deleting ? `« ${deleting.title || labelFor(deleting.type)} » et le fichier associé seront définitivement retirés.` : null}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DirectionGate>
  );
}
