import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DirectionGate } from "@/components/crm/Analytics";
import { EmptyState, PageHeader, formatCurrency, formatDate } from "@/components/crm/Common";
import { BankTransactionDialog, ReconcileDialog } from "@/components/crm/FinanceForms";
import { trpc } from "@/lib/trpc";
import { ArrowDownRight, ArrowUpRight, Check, Landmark, Link2, Loader2, Search, Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const filters = [
  { value: "A rapprocher", label: "À rapprocher" },
  { value: "Rapprochees", label: "Rapprochés" },
  { value: "Toutes", label: "Tous" },
] as const;

export default function BankTransactions() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof filters)[number]["value"]>("A rapprocher");
  const [createOpen, setCreateOpen] = useState(false);
  const [reconciling, setReconciling] = useState<any | null>(null);

  const utils = trpc.useUtils();
  const access = trpc.finance.access.useQuery();
  const canWrite = access.data?.role === "admin" || access.data?.role === "finance";
  const query = trpc.finance.transactions.list.useQuery(
    { search: search || undefined, status },
    { enabled: access.data?.allowed === true }
  );
  const unreconcile = trpc.finance.transactions.unreconcile.useMutation();

  const cancelMatch = async (id: number) => {
    try {
      await unreconcile.mutateAsync({ id });
      await Promise.all([utils.finance.transactions.list.invalidate(), utils.finance.dashboard.invalidate()]);
      toast.success("Rapprochement annulé.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Annulation impossible.");
    }
  };

  return (
    <DirectionGate loading={access.isLoading} forbidden={access.data?.allowed === false}>
      <PageHeader
        eyebrow="Finance & Comptabilité"
        title="Rapprochement bancaire"
        description="Associez chaque mouvement bancaire à sa facture client ou à sa dépense. Seules les pièces de montant identique sont proposées."
        actionLabel={canWrite ? "Nouveau mouvement" : undefined}
        onAction={canWrite ? () => setCreateOpen(true) : undefined}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un libellé bancaire" className="h-10 rounded-lg border-slate-200 bg-white pl-9" />
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          {filters.map(filter => (
            <button
              key={filter.value}
              onClick={() => setStatus(filter.value)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${status === filter.value ? "bg-[#123653] text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {query.isLoading ? (
        <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : query.data?.length ? (
        <div className="space-y-3">
          {query.data.map(transaction => (
            <Card key={transaction.id} className="border-0 shadow-sm">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className={`shrink-0 rounded-xl p-2.5 ${transaction.type === "Credit" ? "bg-teal-50 text-teal-700" : "bg-rose-50 text-rose-600"}`}>
                  {transaction.type === "Credit" ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{transaction.description || "Mouvement bancaire"}</p>
                    {transaction.isReconciled ? (
                      <Badge variant="outline" className="rounded-full bg-teal-50 px-2 py-0 text-[11px] font-medium text-teal-700">
                        <Check className="mr-1 h-3 w-3" />rapproché
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full bg-amber-50 px-2 py-0 text-[11px] font-medium text-amber-700">à rapprocher</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(transaction.transactionDate)}
                    {transaction.matchedInvoiceNumber ? ` · facture ${transaction.matchedInvoiceNumber}` : ""}
                    {transaction.matchedExpenseLabel ? ` · dépense « ${transaction.matchedExpenseLabel} »` : ""}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className={`text-base font-semibold ${transaction.type === "Credit" ? "text-teal-700" : "text-slate-900"}`}>
                    {transaction.type === "Credit" ? "+" : "−"}{formatCurrency(transaction.amount)}
                  </span>
                  {canWrite ? (
                    transaction.isReconciled ? (
                      <Button size="sm" variant="outline" className="bg-white" onClick={() => cancelMatch(transaction.id)} disabled={unreconcile.isPending}>
                        <Undo2 className="mr-2 h-4 w-4" />Annuler
                      </Button>
                    ) : (
                      <Button size="sm" className="bg-[#123653]" onClick={() => setReconciling(transaction)}>
                        <Link2 className="mr-2 h-4 w-4" />Rapprocher
                      </Button>
                    )
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Landmark}
          title={status === "A rapprocher" ? "Tout est rapproché" : "Aucun mouvement"}
          description={status === "A rapprocher" ? "Chaque mouvement bancaire est associé à sa pièce comptable." : "Saisissez vos mouvements bancaires pour lancer le rapprochement."}
          actionLabel={canWrite && status !== "A rapprocher" ? "Nouveau mouvement" : undefined}
          onAction={canWrite ? () => setCreateOpen(true) : undefined}
        />
      )}

      <BankTransactionDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ReconcileDialog transaction={reconciling} onOpenChange={open => !open && setReconciling(null)} />
    </DirectionGate>
  );
}
