import { DealDialog } from "@/components/crm/Forms";
import { EmptyState, formatCurrency, formatDate, labelFor, PageHeader, StatCard, StatusBadge, canWriteCrm } from "@/components/crm/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CalendarClock, CircleDollarSign, Clock3, Percent, Target, Trophy } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const [, setLocation] = useLocation();
  const [dealOpen, setDealOpen] = useState(false);
  const profile = trpc.crm.profile.useQuery();
  const dashboard = trpc.crm.dashboard.useQuery();
  const canWrite = canWriteCrm(profile.data?.role);
  if (dashboard.isLoading) return <DashboardSkeleton />;
  if (!dashboard.data) return <EmptyState icon={Target} title="Tableau de bord indisponible" description="Les indicateurs commerciaux n’ont pas pu être chargés." />;
  const data = dashboard.data;
  const maxStage = Math.max(...data.byStage.map(item => item.amount), 1);
  return <div className="reveal mx-auto max-w-[1500px]">
    <PageHeader eyebrow="Pôle Commercial & B2B" title="Bonjour, votre pipeline avance." description="Les priorités commerciales, les échéances et la performance de l’équipe en un coup d’œil." actionLabel={canWrite ? "Nouvelle opportunité" : undefined} onAction={() => setDealOpen(true)} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Pipeline total" value={formatCurrency(data.totalPipeline)} detail={`${data.activeDeals} opportunités actives`} icon={CircleDollarSign} />
      <StatCard label="Pipeline pondéré" value={formatCurrency(data.weightedPipeline)} detail="Selon la probabilité par étape" icon={Target} accent="teal" />
      <StatCard label="Taux de conversion" value={`${data.conversionRate.toFixed(1)} %`} detail={`${formatCurrency(data.wonRevenue)} remportés`} icon={Percent} accent="violet" />
      <StatCard label="Cycle de vente moyen" value={`${Math.round(data.averageCycleDays)} j`} detail="Sur les opportunités clôturées" icon={Clock3} accent="amber" />
    </div>

    <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_.85fr]">
      <Card className="soft-card">
        <CardHeader className="flex flex-row items-center justify-between pb-3"><div><CardTitle className="text-base">Répartition du pipeline</CardTitle><p className="mt-1 text-xs text-muted-foreground">Volume et valeur par étape</p></div><Button variant="ghost" size="sm" onClick={() => setLocation("/pipeline")} className="text-teal-700">Ouvrir le pipeline <ArrowRight className="ml-1 h-4 w-4" /></Button></CardHeader>
        <CardContent className="space-y-5 pt-2">{data.byStage.map((item, index) => <div key={item.stage} className="grid grid-cols-[112px_1fr_auto] items-center gap-3 text-sm" style={{ animationDelay: `${index * 45}ms` }}><span className="truncate font-medium text-slate-700">{labelFor(item.stage)}</span><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-[#123653] to-teal-500 transition-[width] duration-500" style={{ width: `${Math.max((item.amount / maxStage) * 100, item.count ? 6 : 0)}%` }} /></div><div className="min-w-24 text-right"><span className="font-semibold text-slate-900">{formatCurrency(item.amount)}</span><span className="ml-2 text-xs text-muted-foreground">{item.count}</span></div></div>)}</CardContent>
      </Card>

      <Card className="soft-card">
        <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-amber-600" /> Relances à traiter</CardTitle><p className="text-xs text-muted-foreground">Les prochaines échéances commerciales</p></CardHeader>
        <CardContent className="space-y-1">{data.upcomingFollowUps.length ? data.upcomingFollowUps.map(item => <button key={item.id} onClick={() => setLocation(`/deals/${item.dealId}`)} className="flex w-full items-start gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-slate-50"><div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{item.dealTitle}</p><p className="truncate text-xs text-muted-foreground">{item.organizationName} · {labelFor(item.type)}</p></div><span className="shrink-0 text-xs font-medium text-amber-700">{formatDate(item.dueAt, true)}</span></button>) : <p className="py-8 text-center text-sm text-muted-foreground">Aucune relance en attente.</p>}</CardContent>
      </Card>
    </div>

    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <Card className="soft-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Trophy className="h-4 w-4 text-amber-600" /> Classement commercial</CardTitle></CardHeader><CardContent>{data.leaderboard.length ? <div className="space-y-2">{data.leaderboard.map((owner, index) => <div key={owner.name} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{index + 1}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{owner.name}</p><p className="text-xs text-muted-foreground">{owner.won} gagné{owner.won > 1 ? "s" : ""} · {owner.active} actif{owner.active > 1 ? "s" : ""}</p></div><p className="text-sm font-semibold text-slate-900">{formatCurrency(owner.amount)}</p></div>)}</div> : <p className="py-8 text-center text-sm text-muted-foreground">Pas encore de données.</p>}</CardContent></Card>
      <Card className="soft-card"><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Opportunités récentes</CardTitle><Button variant="ghost" size="sm" onClick={() => setLocation("/pipeline")} className="text-teal-700">Tout voir</Button></CardHeader><CardContent className="space-y-2">{data.recentDeals.map(deal => <button key={deal.id} onClick={() => setLocation(`/deals/${deal.id}`)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-slate-50"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{deal.title}</p><p className="truncate text-xs text-muted-foreground">{deal.organizationName}</p></div><StatusBadge value={deal.stage} /><p className="hidden min-w-20 text-right text-sm font-semibold sm:block">{formatCurrency(deal.amount)}</p></button>)}</CardContent></Card>
    </div>
    {dealOpen ? <DealDialog open={dealOpen} onOpenChange={setDealOpen} /> : null}
  </div>;
}

function DashboardSkeleton() { return <div className="mx-auto max-w-[1500px] space-y-5"><Skeleton className="h-24 w-full" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}</div><div className="grid gap-5 xl:grid-cols-[1.45fr_.85fr]"><Skeleton className="h-80" /><Skeleton className="h-80" /></div></div>; }
