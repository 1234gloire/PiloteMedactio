import { DirectionGate, downloadBase64, PeriodSelector, type AnalyticsPeriod } from "@/components/crm/Analytics";
import { PageHeader } from "@/components/crm/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createAnalyticsPdf } from "@/lib/analyticsPdf";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, FileDown, FileSpreadsheet, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function DirectionExports() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("12m");
  const [pdfLoading, setPdfLoading] = useState(false);
  const query = trpc.analytics.dashboard.useQuery({ period }, { retry: false });
  const csv = trpc.analytics.exportCsv.useMutation();

  const exportCsv = async () => {
    try {
      const file = await csv.mutateAsync({ period });
      downloadBase64(file.filename, file.mimeType, file.contentBase64);
      toast.success("Rapport CSV téléchargé");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Export impossible"); }
  };

  const exportPdf = async () => {
    if (!query.data) return;
    setPdfLoading(true);
    try {
      const file = await createAnalyticsPdf(query.data, period);
      const url = URL.createObjectURL(new Blob([file.bytes as BlobPart], { type: "application/pdf" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.filename; anchor.click(); URL.revokeObjectURL(url);
      toast.success("Rapport PDF téléchargé");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Génération PDF impossible"); }
    finally { setPdfLoading(false); }
  };

  return <DirectionGate loading={query.isLoading} forbidden={!!query.error}><div className="space-y-7">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between"><PageHeader backTo="/direction" eyebrow="Direction & Analytics" title="Centre d’exports" description="Préparez un instantané homogène pour vos réunions d’associés, comités de pilotage ou échanges investisseurs." /><PeriodSelector value={period} onChange={setPeriod} /></div>
    <div className="grid gap-5 lg:grid-cols-2">
      <ExportCard title="Rapport de données CSV" description="Tableau exploitable contenant les KPI consolidés et l’historique mensuel sur douze mois." icon={FileSpreadsheet} color="teal" items={["Compatible Excel et Google Sheets", "Séparateur français point-virgule", "Historique MRR, usages, CA et encaissements"]}><Button onClick={exportCsv} disabled={csv.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700">{csv.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}Télécharger le CSV</Button></ExportCard>
      <ExportCard title="Rapport exécutif PDF" description="Synthèse A4 immédiatement présentable, avec KPI SaaS, activité, performance et historique." icon={FileDown} color="navy" items={["Mise en page aux couleurs Medactio", "Conventions de calcul documentées", "Génération locale sans transmission externe"]}><Button onClick={exportPdf} disabled={pdfLoading || !query.data} className="w-full bg-[#123653] hover:bg-[#0b2941]">{pdfLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}Télécharger le PDF</Button></ExportCard>
    </div>
    <Card className="border-0 bg-slate-900 text-white shadow-sm"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><div className="rounded-xl bg-white/10 p-3"><ShieldCheck className="h-5 w-5 text-teal-300" /></div><div><p className="font-semibold">Périmètre confidentiel</p><p className="mt-1 text-sm text-slate-300">Les exports restent réservés à la Direction et aux administrateurs. Aucun fichier n’est envoyé à un service tiers.</p></div></CardContent></Card>
  </div></DirectionGate>;
}

function ExportCard({ title, description, icon: Icon, color, items, children }: { title: string; description: string; icon: typeof FileDown; color: "teal" | "navy"; items: string[]; children: React.ReactNode }) {
  return <Card className="overflow-hidden border-0 shadow-sm"><div className={`h-1.5 ${color === "teal" ? "bg-teal-500" : "bg-[#123653]"}`} /><CardHeader><div className="flex items-start justify-between"><div><CardTitle className="text-xl">{title}</CardTitle><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></div><div className={`rounded-2xl p-3 ${color === "teal" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-[#123653]"}`}><Icon className="h-6 w-6" /></div></div></CardHeader><CardContent><ul className="mb-6 space-y-2 text-sm text-slate-600">{items.map(item => <li key={item} className="flex items-center gap-2"><CheckCircle2 className={`h-4 w-4 ${color === "teal" ? "text-emerald-500" : "text-teal-500"}`} />{item}</li>)}</ul>{children}</CardContent></Card>;
}
