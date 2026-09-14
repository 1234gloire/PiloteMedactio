import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, LockKeyhole, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type AnalyticsPeriod = "30d" | "90d" | "12m" | "all";

export const periodLabels: Record<AnalyticsPeriod, string> = { "30d": "30 jours", "90d": "90 jours", "12m": "12 mois", all: "Depuis le début" };

export function PeriodSelector({ value, onChange }: { value: AnalyticsPeriod; onChange: (value: AnalyticsPeriod) => void }) {
  return <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">{(Object.keys(periodLabels) as AnalyticsPeriod[]).map(period => <Button key={period} size="sm" variant="ghost" onClick={() => onChange(period)} className={value === period ? "bg-[#123653] text-white hover:bg-[#123653] hover:text-white" : "text-slate-600"}>{periodLabels[period]}</Button>)}</div>;
}

export function ExecutiveMetric({ label, value, detail, icon: Icon, tone = "navy", trend }: { label: string; value: string; detail: string; icon: LucideIcon; tone?: "navy" | "teal" | "violet" | "amber"; trend?: number | null }) {
  const tones = { navy: "bg-[#123653] text-white", teal: "bg-teal-600 text-white", violet: "bg-violet-600 text-white", amber: "bg-amber-500 text-slate-950" };
  return <Card className={`overflow-hidden border-0 shadow-sm ${tones[tone]}`}><CardContent className="relative p-5"><div className="absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10" /><div className="relative flex items-start justify-between gap-3"><div><p className="text-xs font-medium opacity-75">{label}</p><p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs opacity-75">{detail}</p></div><div className="rounded-xl bg-white/15 p-2.5"><Icon className="h-5 w-5" /></div></div>{trend !== undefined && trend !== null && <div className="relative mt-4 flex items-center gap-1 text-xs font-semibold">{trend >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{Math.abs(trend)} % sur 30 jours</div>}</CardContent></Card>;
}

export function DirectionGate({ loading, forbidden, children }: { loading: boolean; forbidden: boolean; children: React.ReactNode }) {
  if (loading) return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-teal-600" /></div>;
  if (forbidden) return <div className="flex min-h-[420px] flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><div className="rounded-2xl bg-slate-100 p-4"><LockKeyhole className="h-8 w-8 text-slate-500" /></div><h2 className="mt-5 text-xl font-semibold">Accès Direction restreint</h2><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Ces indicateurs consolidés sont réservés à la Direction et aux administrateurs.</p></div>;
  return <>{children}</>;
}

export function InsightCard({ title, value, detail, accent = "teal" }: { title: string; value: string; detail: string; accent?: "teal" | "amber" | "rose" | "blue" }) {
  const colors = { teal: "border-teal-500", amber: "border-amber-500", rose: "border-rose-500", blue: "border-sky-500" };
  return <div className={`rounded-2xl border-l-4 bg-white p-4 shadow-sm ${colors[accent]}`}><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p></div>;
}

export const formatPercent = (value: number | null | undefined) => value === null || value === undefined ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} %`;
export const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
export const shortCurrency = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", notation: "compact", maximumFractionDigits: 1 }).format(value);

export function downloadBase64(filename: string, mimeType: string, contentBase64: string) {
  const bytes = Uint8Array.from(atob(contentBase64), char => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
