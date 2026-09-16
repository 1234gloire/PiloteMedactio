import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DirectionGate } from "@/components/crm/Analytics";
import { EmptyState, PageHeader, formatCurrency, formatDate, labelFor } from "@/components/crm/Common";
import { ExpenseDialog } from "@/components/crm/FinanceForms";
import { trpc } from "@/lib/trpc";
import { Banknote, Loader2, Pencil, Repeat, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const categories = ["Toutes", "Hebergement", "Outils SaaS", "Salaires", "Marketing", "Frais Generaux", "Autre"] as const;

export default function Expenses() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("Toutes");
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; item?: any }>({ open: false });
  const [deleting, setDeleting] = useState<any | null>(null);

  const utils = trpc.useUtils();
  const access = trpc.finance.access.useQuery();
  const canWrite = access.data?.role === "admin" || access.data?.role === "finance";
  const query = trpc.finance.expenses.list.useQuery(
    { search: search || undefined, category, recurringOnly: recurringOnly || undefined },
    { enabled: access.data?.allowed === true }
  );
  const remove = trpc.finance.expenses.delete.useMutation();

  const total = query.data?.reduce((sum, item) => sum + Number(item.amount), 0) ?? 0;

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync({ id: deleting.id });
      await Promise.all([utils.finance.expenses.list.invalidate(), utils.finance.dashboard.invalidate()]);
      toast.success("Dépense supprimée.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <DirectionGate loading={access.isLoading} forbidden={access.data?.allowed === false}>
      <PageHeader
        eyebrow="Finance & Comptabilité"
        title="Dépenses et charges"
        description="Toutes les sorties d’argent de l’entreprise, ponctuelles ou récurrentes."
        actionLabel={canWrite ? "Nouvelle dépense" : undefined}
        onAction={canWrite ? () => setDialog({ open: true }) : undefined}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un libellé ou un fournisseur" className="h-10 rounded-lg border-slate-200 bg-white pl-9" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600">
          {categories.map(item => <option key={item} value={item}>{item === "Toutes" ? "Toutes les catégories" : labelFor(item)}</option>)}
        </select>
        <label className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm">
          <input type="checkbox" checked={recurringOnly} onChange={e => setRecurringOnly(e.target.checked)} className="h-4 w-4 accent-teal-600" />
          Récurrentes
        </label>
      </div>

      {query.isLoading ? (
        <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : query.data?.length ? (
        <>
          <Card className="mb-4 border-0 shadow-sm">
            <CardContent className="flex flex-wrap items-baseline justify-between gap-3 p-4">
              <span className="text-sm text-muted-foreground">{query.data.length} dépense{query.data.length > 1 ? "s" : ""} affichée{query.data.length > 1 ? "s" : ""}</span>
              <span className="text-lg font-semibold text-slate-950">{formatCurrency(total)}</span>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3 font-semibold">Libellé</th>
                      <th className="px-5 py-3 font-semibold">Catégorie</th>
                      <th className="px-5 py-3 font-semibold">Fournisseur</th>
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-5 py-3 text-right font-semibold">Montant</th>
                      {canWrite ? <th className="px-5 py-3" /> : null}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {query.data.map(expense => (
                      <tr key={expense.id} className="transition hover:bg-slate-50/60">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900">{expense.label}</span>
                            {expense.isRecurring ? (
                              <Badge variant="outline" className="rounded-full bg-teal-50 px-2 py-0 text-[11px] font-medium text-teal-700">
                                <Repeat className="mr-1 h-3 w-3" />mensuel
                              </Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600">{labelFor(expense.category)}</td>
                        <td className="px-5 py-3.5 text-slate-600">{expense.supplierName || "—"}</td>
                        <td className="px-5 py-3.5 text-slate-600">{formatDate(expense.expenseDate)}</td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-900">{formatCurrency(expense.amount)}</td>
                        {canWrite ? (
                          <td className="px-5 py-3.5">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" onClick={() => setDialog({ open: true, item: expense })}><Pencil className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" className="text-rose-600" onClick={() => setDeleting(expense)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          icon={Banknote}
          title="Aucune dépense"
          description="Enregistrez vos charges d’hébergement, d’outils et de personnel pour suivre la trésorerie."
          actionLabel={canWrite ? "Nouvelle dépense" : undefined}
          onAction={canWrite ? () => setDialog({ open: true }) : undefined}
        />
      )}

      {dialog.open ? (
        <ExpenseDialog key={dialog.item?.id ?? "new"} open={dialog.open} onOpenChange={open => setDialog({ open })} initial={dialog.item} />
      ) : null}

      <AlertDialog open={Boolean(deleting)} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? `« ${deleting.label} » (${formatCurrency(deleting.amount)}) sera définitivement retirée. Les mouvements bancaires qui lui étaient rapprochés redeviendront à rapprocher.` : null}
            </AlertDialogDescription>
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
