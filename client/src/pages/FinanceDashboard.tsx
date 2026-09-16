import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, StatCard, formatCurrency, formatDate, labelFor } from "@/components/crm/Common";
import { DirectionGate, formatPercent } from "@/components/crm/Analytics";
import { trpc } from "@/lib/trpc";
import { ArrowDownRight, ArrowUpRight, Banknote, Landmark, Loader2, PiggyBank, Repeat, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

const horizons = [
  { value: 30, label: "30 jours" },
  { value: 60, label: "60 jours" },
  { value: 90, label: "90 jours" },
];

export default function FinanceDashboard() {
  const [horizonDays, setHorizonDays] = useState(30);
  const access = trpc.finance.access.useQuery();
  const query = trpc.finance.dashboard.useQuery({ horizonDays }, { enabled: access.data?.allowed === true });

  const data = query.data;

  return (
    <DirectionGate loading={access.isLoading} forbidden={access.data?.allowed === false}>
      <PageHeader
        eyebrow="Finance & Comptabilité"
        title="Trésorerie"
        description="Solde réellement disponible en banque, et projection des encaissements et décaissements attendus."
      />

      <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1">
        {horizons.map(horizon => (
          <button
            key={horizon.value}
            onClick={() => setHorizonDays(horizon.value)}
            className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${horizonDays === horizon.value ? "bg-[#123653] text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            {horizon.label}
          </button>
        ))}
      </div>

      {query.isLoading || !data ? (
        <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Solde en banque" value={formatCurrency(data.balance)} detail="Mouvements constatés uniquement" icon={Landmark} accent="navy" />
            <StatCard label={`Solde projeté à ${data.horizonDays} jours`} value={formatCurrency(data.projectedBalance)} detail="Solde + encaissements − décaissements" icon={PiggyBank} accent={data.projectedBalance >= 0 ? "teal" : "amber"} />
            <StatCard label="Encaissements attendus" value={formatCurrency(data.expectedInflows)} detail={data.overdueInflows > 0 ? `dont ${formatCurrency(data.overdueInflows)} en retard` : "Aucune facture en retard"} icon={TrendingUp} accent="teal" />
            <StatCard label="Décaissements attendus" value={formatCurrency(data.expectedOutflows)} detail={`dont ${formatCurrency(data.monthlyRecurring)} de charges par mois`} icon={TrendingDown} accent="amber" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="border-0 shadow-sm lg:col-span-2">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900">Répartition des dépenses</h2>
                  <span className="text-xs text-muted-foreground">{data.expenseCount} dépense{data.expenseCount > 1 ? "s" : ""}</span>
                </div>
                {data.byCategory.length ? (
                  <div className="space-y-3.5">
                    {data.byCategory.map(category => (
                      <div key={category.category}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                          <span className="font-medium text-slate-800">{labelFor(category.category)}</span>
                          <span className="shrink-0 text-slate-600">
                            {formatCurrency(category.total)}
                            {category.recurring > 0 ? <span className="ml-2 text-xs text-teal-700">dont {formatCurrency(category.recurring)} récurrent</span> : null}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-[#123653]" style={{ width: `${Math.max(category.share, 2)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Banknote} title="Aucune dépense" description="Enregistrez vos charges pour suivre leur répartition." />
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <h2 className="mb-4 font-semibold text-slate-900">Revenu récurrent</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">MRR théorique</span><span className="font-semibold text-slate-900">{formatCurrency(data.revenue.mrr)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">ARR</span><span className="font-semibold text-slate-900">{formatCurrency(data.revenue.arr)}</span></div>
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Encaissé en banque</span><span className="font-semibold text-slate-900">{formatCurrency(data.revenue.collected)}</span></div>
                  <div className="mt-4 rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">Écart encaissé / MRR</p>
                    <p className={`mt-1 text-lg font-semibold ${data.revenue.gap >= 0 ? "text-teal-700" : "text-rose-600"}`}>
                      {data.revenue.gap >= 0 ? "+" : ""}{formatCurrency(data.revenue.gap)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Couverture {formatPercent(data.revenue.coverageRate)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="border-0 shadow-sm lg:col-span-2">
              <CardContent className="p-5">
                <h2 className="mb-4 font-semibold text-slate-900">Derniers mouvements bancaires</h2>
                {data.recentTransactions.length ? (
                  <div className="divide-y divide-slate-100">
                    {data.recentTransactions.map(transaction => (
                      <div key={transaction.id} className="flex items-center gap-3 py-3">
                        <div className={`rounded-lg p-2 ${transaction.type === "Credit" ? "bg-teal-50 text-teal-700" : "bg-rose-50 text-rose-600"}`}>
                          {transaction.type === "Credit" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{transaction.description || "Mouvement bancaire"}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(transaction.transactionDate)}{transaction.isReconciled ? " · rapproché" : " · à rapprocher"}</p>
                        </div>
                        <span className={`shrink-0 text-sm font-semibold ${transaction.type === "Credit" ? "text-teal-700" : "text-slate-900"}`}>
                          {transaction.type === "Credit" ? "+" : "−"}{formatCurrency(transaction.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon={Landmark} title="Aucun mouvement" description="Importez ou saisissez vos mouvements bancaires pour suivre la trésorerie." />
                )}
              </CardContent>
            </Card>

            <div className="space-y-5">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2"><Scale className="h-4 w-4 text-slate-500" /><h2 className="font-semibold text-slate-900">Rapprochement</h2></div>
                  <p className="text-2xl font-semibold text-slate-950">{data.reconciliation.reconciled} / {data.reconciliation.total}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-teal-600" style={{ width: `${data.reconciliation.rate}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {data.reconciliation.pending > 0 ? `${data.reconciliation.pending} mouvement${data.reconciliation.pending > 1 ? "s" : ""} à rapprocher (${formatCurrency(data.reconciliation.pendingAmount)})` : "Tous les mouvements sont rapprochés."}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center gap-2"><Repeat className="h-4 w-4 text-slate-500" /><h2 className="font-semibold text-slate-900">Charges récurrentes</h2></div>
                  {data.upcomingRecurring.length ? (
                    <div className="space-y-2.5">
                      {data.upcomingRecurring.map(expense => (
                        <div key={expense.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-slate-700">{expense.label}</span>
                          <span className="shrink-0 font-medium text-slate-900">{formatCurrency(expense.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Aucune charge récurrente enregistrée.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </DirectionGate>
  );
}
