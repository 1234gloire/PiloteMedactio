import { PageHeader, formatDate } from "@/components/crm/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, PauseCircle, Play, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Pilotage des traitements quotidiens.
 *
 * Chaque traitement est déclenché à heure fixe côté base de données ; cet
 * écran décide s'il s'exécute réellement, et restitue l'issue de sa dernière
 * exécution. « Exécuter maintenant » permet de vérifier un traitement avant
 * de le laisser tourner seul.
 */
export default function Automations() {
  const utils = trpc.useUtils();
  const automations = trpc.governance.automations.list.useQuery();
  const setEnabled = trpc.governance.automations.setEnabled.useMutation();
  const runNow = trpc.governance.automations.runNow.useMutation();
  const [running, setRunning] = useState<string | null>(null);

  const toggle = async (key: string, enabled: boolean) => {
    try {
      await setEnabled.mutateAsync({ key: key as never, enabled });
      await utils.governance.automations.list.invalidate();
      toast.success(enabled ? "Traitement activé." : "Traitement suspendu.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Modification impossible.");
    }
  };

  const execute = async (key: string) => {
    setRunning(key);
    try {
      const result = await runNow.mutateAsync({ key: key as never });
      await utils.governance.automations.list.invalidate();
      toast.success(result.summary);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Exécution impossible.");
    } finally {
      setRunning(null);
    }
  };

  const active = automations.data?.filter(item => item.enabled).length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Pôle Direction & Analytics"
        title="Automatisations"
        description="Les traitements qui tournent chaque nuit : veille des comptes, SLA, relances d’impayés et échéances internes."
      />

      {automations.isLoading ? (
        <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-teal-600" /></div>
      ) : automations.data ? (
        <>
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="rounded-xl bg-teal-50 p-2 text-teal-700"><ShieldCheck className="h-4 w-4" /></div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {active} traitement{active > 1 ? "s" : ""} actif{active > 1 ? "s" : ""} sur {automations.data.length}
              </p>
              <p className="text-xs text-muted-foreground">
                Un traitement suspendu reste planifié : il est déclenché, puis ignoré.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {automations.data.map(item => {
              const failed = item.lastStatus === "Echec";
              return (
                <Card key={item.key} className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-950">{item.label}</p>
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">{item.pole}</span>
                          {item.enabled ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" />Actif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                              <PauseCircle className="h-3 w-3" />Suspendu
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Clock3 className="h-3.5 w-3.5" />{item.schedule} (heure UTC)
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button variant="outline" className="bg-white" disabled={running === item.key} onClick={() => execute(item.key)}>
                          {running === item.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                          Exécuter maintenant
                        </Button>
                        <Switch checked={item.enabled} onCheckedChange={value => toggle(item.key, value)} aria-label={`Activer ${item.label}`} />
                      </div>
                    </div>

                    <div className={`mt-4 rounded-xl p-3 text-xs leading-5 ${failed ? "bg-rose-50 text-rose-900" : "bg-slate-50 text-slate-600"}`}>
                      {item.lastRunAt ? (
                        <>
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            {failed ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                            Dernière exécution : {formatDate(item.lastRunAt, true)}
                          </span>
                          {item.lastDetail ? <span> — {item.lastDetail}</span> : null}
                        </>
                      ) : (
                        "Ce traitement n’a jamais été exécuté."
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : (
        <div className="rounded-2xl bg-white p-8 text-center text-muted-foreground">
          Les automatisations ne sont accessibles qu’à l’administration et à la direction.
        </div>
      )}
    </>
  );
}
