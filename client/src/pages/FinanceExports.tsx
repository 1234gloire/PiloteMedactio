import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DirectionGate, downloadBase64 } from "@/components/crm/Analytics";
import { PageHeader, formatCurrency } from "@/components/crm/Common";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const startOfYear = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

export default function FinanceExports() {
  const [from, setFrom] = useState(startOfYear());
  const [to, setTo] = useState(today());
  const [result, setResult] = useState<{ entries: number; debit: number; credit: number; balanced: boolean; invoiceCount: number; expenseCount: number; fileName: string } | null>(null);

  const access = trpc.finance.access.useQuery();
  const exportFec = trpc.finance.exportFec.useMutation();

  const run = async () => {
    try {
      const data = await exportFec.mutateAsync({ from, to });
      downloadBase64(data.fileName, "text/plain;charset=utf-8", data.contentBase64);
      setResult(data);
      toast.success(`Export généré : ${data.entries} écritures.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L’export n’a pas pu être généré.");
    }
  };

  return (
    <DirectionGate loading={access.isLoading} forbidden={access.data?.allowed === false}>
      <PageHeader
        eyebrow="Finance & Comptabilité"
        title="Export comptable"
        description="Génère le Fichier des Écritures Comptables (FEC) de la période, destiné à votre expert-comptable."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl bg-[#123653]/8 p-2.5 text-[#123653]"><FileSpreadsheet className="h-5 w-5" /></div>
              <div>
                <h2 className="font-semibold text-slate-900">Période à exporter</h2>
                <p className="text-xs text-muted-foreground">Les factures à l’état de brouillon sont exclues : elles ne constituent pas une écriture comptable.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-2 block text-xs font-semibold text-slate-600">Du</Label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-10 rounded-lg border-slate-200 bg-white" />
              </div>
              <div>
                <Label className="mb-2 block text-xs font-semibold text-slate-600">Au</Label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-10 rounded-lg border-slate-200 bg-white" />
              </div>
            </div>

            <Button onClick={run} disabled={exportFec.isPending} className="mt-5 h-11 w-full bg-[#123653] sm:w-auto">
              {exportFec.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Générer le fichier FEC
            </Button>

            {result ? (
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  {result.balanced ? <CheckCircle2 className="h-4 w-4 text-teal-700" /> : <AlertTriangle className="h-4 w-4 text-rose-600" />}
                  <p className={`text-sm font-semibold ${result.balanced ? "text-teal-800" : "text-rose-700"}`}>
                    {result.balanced ? "Écritures équilibrées" : "Déséquilibre détecté"}
                  </p>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <div><dt className="text-xs text-muted-foreground">Écritures</dt><dd className="font-medium text-slate-900">{result.entries}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Total débit</dt><dd className="font-medium text-slate-900">{formatCurrency(result.debit)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Total crédit</dt><dd className="font-medium text-slate-900">{formatCurrency(result.credit)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Pièces</dt><dd className="font-medium text-slate-900">{result.invoiceCount} fact. · {result.expenseCount} dép.</dd></div>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">Fichier téléchargé : {result.fileName}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 text-sm leading-6">
            <h2 className="mb-3 font-semibold text-slate-900">Ce que contient le fichier</h2>
            <p className="text-muted-foreground">
              Le FEC est le format tabulé à 18 colonnes exigé par l’administration fiscale en cas de contrôle. Deux journaux sont produits :
            </p>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              <li><span className="font-medium text-slate-800">Ventes (VE)</span> — chaque facture client, portée au débit du compte 411 et au crédit du compte 706.</li>
              <li><span className="font-medium text-slate-800">Achats (AC)</span> — chaque dépense, portée au débit du compte de charge correspondant à sa catégorie et au crédit du compte 401.</li>
            </ul>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs leading-5 text-amber-900">
                <span className="font-semibold">À faire valider.</span> Le plan de comptes utilisé est une base de travail conforme au plan comptable général. Faites-le vérifier par votre expert-comptable, et ajuster si nécessaire, avant toute transmission à l’administration.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DirectionGate>
  );
}
