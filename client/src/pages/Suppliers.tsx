import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DirectionGate } from "@/components/crm/Analytics";
import { EmptyState, PageHeader, StatCard, formatCurrency, formatDate, labelFor } from "@/components/crm/Common";
import { SupplierDialog } from "@/components/crm/GovernanceForms";
import { trpc } from "@/lib/trpc";
import { CalendarClock, Handshake, Loader2, Mail, Pencil, Search, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const categories = ["Toutes", "Hebergement", "Outil SaaS Interne", "Partenaire Commercial", "Autre"] as const;

const severityTone: Record<string, string> = {
  Expire: "bg-rose-50 text-rose-700 border-rose-200",
  Critique: "bg-amber-50 text-amber-800 border-amber-200",
  "A surveiller": "bg-sky-50 text-sky-700 border-sky-200",
  Sereine: "bg-teal-50 text-teal-700 border-teal-200",
};

export default function Suppliers() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("Toutes");
  const [dialog, setDialog] = useState<{ open: boolean; item?: any }>({ open: false });
  const [deleting, setDeleting] = useState<any | null>(null);

  const utils = trpc.useUtils();
  const access = trpc.governance.access.useQuery();
  const canWrite = access.data?.role === "admin" || access.data?.role === "direction";
  const query = trpc.governance.suppliers.list.useQuery({ search: search || undefined, category }, { enabled: access.data?.suppliers === true });
  const remove = trpc.governance.suppliers.delete.useMutation();

  const rows = query.data ?? [];
  const annualTotal = rows.reduce((sum, row) => sum + Number(row.annualCost), 0);
  const upcoming = rows.filter(row => row.severity === "Critique" || row.severity === "Expire").length;

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync({ id: deleting.id });
      await utils.governance.suppliers.list.invalidate();
      toast.success("Fournisseur supprimé.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <DirectionGate loading={access.isLoading} forbidden={access.data?.suppliers === false}>
      <PageHeader
        eyebrow="Fournisseurs & Partenaires"
        title="Prestataires et partenaires"
        description="Coût annuel, contacts et échéances de renouvellement, avec l’historique des dépenses rattachées."
        actionLabel={canWrite ? "Nouveau fournisseur" : undefined}
        onAction={canWrite ? () => setDialog({ open: true }) : undefined}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Fournisseurs suivis" value={String(rows.length)} icon={Handshake} accent="navy" />
        <StatCard label="Coût annuel cumulé" value={formatCurrency(annualTotal)} icon={Wallet} accent="teal" />
        <StatCard label="Renouvellements proches" value={String(upcoming)} detail="Sous 30 jours ou dépassés" icon={CalendarClock} accent={upcoming > 0 ? "amber" : "violet"} />
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un fournisseur ou un contact" className="h-10 rounded-lg border-slate-200 bg-white pl-9" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600">
          {categories.map(item => <option key={item} value={item}>{item === "Toutes" ? "Toutes les catégories" : labelFor(item)}</option>)}
        </select>
      </div>

      {query.isLoading ? (
        <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : rows.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map(supplier => (
            <Card key={supplier.id} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{supplier.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{labelFor(supplier.category)}</p>
                  </div>
                  {supplier.contractRenewalDate ? (
                    <Badge variant="outline" className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${severityTone[supplier.severity] ?? severityTone.Sereine}`}>
                      {supplier.daysUntilRenewal !== null && supplier.daysUntilRenewal < 0 ? `Échu depuis ${Math.abs(supplier.daysUntilRenewal)} j` : `J-${supplier.daysUntilRenewal}`}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-3 text-xs">
                  <div><p className="text-muted-foreground">Coût annuel</p><p className="mt-1 font-semibold text-slate-900">{formatCurrency(supplier.annualCost)}</p></div>
                  <div><p className="text-muted-foreground">Dépensé</p><p className="mt-1 font-semibold text-slate-900">{formatCurrency(supplier.spentTotal)}</p></div>
                  <div><p className="text-muted-foreground">Renouvellement</p><p className="mt-1 font-medium">{formatDate(supplier.contractRenewalDate)}</p></div>
                </div>

                {supplier.contactName || supplier.contactEmail ? (
                  <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {supplier.contactName}{supplier.contactName && supplier.contactEmail ? " · " : ""}{supplier.contactEmail}
                  </p>
                ) : null}
                {supplier.notes ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{supplier.notes}</p> : null}

                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{supplier.expenseCount} dépense{supplier.expenseCount > 1 ? "s" : ""} rattachée{supplier.expenseCount > 1 ? "s" : ""}</span>
                  {canWrite ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setDialog({ open: true, item: supplier })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-rose-600" onClick={() => setDeleting(supplier)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Handshake} title="Aucun fournisseur" description="Référencez vos prestataires d’hébergement, outils SaaS et partenaires commerciaux." actionLabel={canWrite ? "Nouveau fournisseur" : undefined} onAction={canWrite ? () => setDialog({ open: true }) : undefined} />
      )}

      {dialog.open ? <SupplierDialog key={dialog.item?.id ?? "new"} open={dialog.open} onOpenChange={open => setDialog({ open })} initial={dialog.item} /> : null}

      <AlertDialog open={Boolean(deleting)} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce fournisseur ?</AlertDialogTitle>
            <AlertDialogDescription>{deleting ? `« ${deleting.name} » sera retiré. Les dépenses qui lui étaient rattachées sont conservées, sans fournisseur.` : null}</AlertDialogDescription>
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
