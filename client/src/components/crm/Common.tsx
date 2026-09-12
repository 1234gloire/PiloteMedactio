import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowLeft, type LucideIcon, Plus } from "lucide-react";
import { useLocation } from "wouter";

export const STAGES = [
  "Prospection",
  "Rendez-vous Place",
  "Demo Effectuee",
  "Devis Envoye",
  "Gagne",
  "Perdu",
] as const;

export const labels: Record<string, string> = {
  "Hopital Public": "Hôpital public",
  "Clinique Privee": "Clinique privée",
  "Groupement Hospitalier": "Groupement hospitalier",
  "Cabinet Liberal": "Cabinet libéral",
  "En Demo": "En démo",
  Negociation: "Négociation",
  "Prospection a Froid": "Prospection à froid",
  "Reseau AGAPE": "Réseau AGAPE",
  "Rendez-vous Place": "Rendez-vous placé",
  "Demo Effectuee": "Démo effectuée",
  "Devis Envoye": "Devis envoyé",
  Gagne: "Gagné",
  Perdu: "Perdu",
  Reunion: "Réunion",
  Envoye: "Envoyé",
  Signe: "Signé",
  Effectuee: "Effectuée",
  "A faire": "À faire",
  "Devis sans reponse": "Devis sans réponse",
  "RDV a confirmer": "RDV à confirmer",
  "Non Demarre": "Non démarré",
  "En Cours": "En cours",
  Termine: "Terminé",
  "Compte Cree": "Compte créé",
  "Formation Effectuee": "Formation effectuée",
  "Premiers Ecrits Generes": "Premiers écrits générés",
  Resilie: "Résilié",
  "A Surveiller": "À surveiller",
  "A Risque": "À risque",
  Resolue: "Résolue",
  Ignoree: "Ignorée",
  "Sous Utilisation": "Sous-utilisation",
  "Onboarding Bloque": "Onboarding bloqué",
  "Compte A Risque": "Compte à risque",
  "Acces Licence": "Accès licence",
  "A Faire": "À faire",
  "A Signer": "À signer",
  "En attente client": "En attente client",
  Resolu: "Résolu",
  Envoyee: "Envoyée",
  Payee: "Payée",
  "En Retard": "En retard",
  Echeance: "Échéance",
  Demo: "Démo",
  "SLA Depasse": "SLA dépassé",
  "Echeance Tache": "Échéance tâche",
  "Facture Impayee": "Facture impayée",
  "Contrat A Renouveler": "Contrat à renouveler",
  "Rendez-vous Proche": "Rendez-vous proche",
};

export const labelFor = (value?: string | null) => (value ? labels[value] || value : "—");

export const formatCurrency = (value: string | number | null | undefined) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value || 0));

export const formatDate = (value: Date | string | null | undefined, withTime = false) => {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("fr-FR", withTime
    ? { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

const toneMap: Record<string, string> = {
  Prospect: "bg-slate-100 text-slate-700 border-slate-200",
  "En Demo": "bg-violet-50 text-violet-700 border-violet-200",
  Negociation: "bg-amber-50 text-amber-700 border-amber-200",
  "Client Actif": "bg-emerald-50 text-emerald-700 border-emerald-200",
  Inactif: "bg-slate-100 text-slate-500 border-slate-200",
  Prospection: "bg-slate-100 text-slate-700 border-slate-200",
  "Rendez-vous Place": "bg-sky-50 text-sky-700 border-sky-200",
  "Demo Effectuee": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "Devis Envoye": "bg-amber-50 text-amber-700 border-amber-200",
  Gagne: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Perdu: "bg-rose-50 text-rose-700 border-rose-200",
  Brouillon: "bg-slate-100 text-slate-700 border-slate-200",
  Envoye: "bg-sky-50 text-sky-700 border-sky-200",
  Vu: "bg-indigo-50 text-indigo-700 border-indigo-200",
  Signe: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Expire: "bg-amber-50 text-amber-700 border-amber-200",
  Refuse: "bg-rose-50 text-rose-700 border-rose-200",
  Actif: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Essai: "bg-sky-50 text-sky-700 border-sky-200",
  Suspendu: "bg-amber-50 text-amber-700 border-amber-200",
  Resilie: "bg-slate-100 text-slate-500 border-slate-200",
  Bon: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "A Surveiller": "bg-amber-50 text-amber-700 border-amber-200",
  "A Risque": "bg-rose-50 text-rose-700 border-rose-200",
  Ouverte: "bg-rose-50 text-rose-700 border-rose-200",
  Resolue: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Ignoree: "bg-slate-100 text-slate-500 border-slate-200",
  Info: "bg-sky-50 text-sky-700 border-sky-200",
  Attention: "bg-amber-50 text-amber-700 border-amber-200",
  Critique: "bg-rose-50 text-rose-700 border-rose-200",
  Nouveau: "bg-sky-50 text-sky-700 border-sky-200",
  "En cours": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "En attente client": "bg-amber-50 text-amber-700 border-amber-200",
  Resolu: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "A Faire": "bg-slate-100 text-slate-700 border-slate-200",
  "En Cours": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Fait: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Basse: "bg-slate-100 text-slate-600 border-slate-200",
  Moyenne: "bg-sky-50 text-sky-700 border-sky-200",
  Haute: "bg-amber-50 text-amber-700 border-amber-200",
  Urgente: "bg-rose-50 text-rose-700 border-rose-200",
  Envoyee: "bg-sky-50 text-sky-700 border-sky-200",
  Payee: "bg-emerald-50 text-emerald-700 border-emerald-200",
  "En Retard": "bg-rose-50 text-rose-700 border-rose-200",
  "A Signer": "bg-amber-50 text-amber-700 border-amber-200",
};

export function StatusBadge({ value, className }: { value?: string | null; className?: string }) {
  return (
    <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 font-medium", toneMap[value || ""] || "bg-slate-50 text-slate-600", className)}>
      {labelFor(value)}
    </Badge>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actionLabel,
  onAction,
  backTo,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  backTo?: string;
}) {
  const [, setLocation] = useLocation();
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {backTo ? (
          <button onClick={() => setLocation(backTo)} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Retour
          </button>
        ) : null}
        {eyebrow ? <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.16em] text-teal-700">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      {actionLabel && onAction ? (
        <Button onClick={onAction} className="shrink-0 bg-[#123653] text-white shadow-sm hover:bg-[#0b2941]">
          <Plus className="mr-2 h-4 w-4" /> {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function StatCard({ label, value, detail, icon: Icon, accent = "navy" }: { label: string; value: string; detail?: string; icon: LucideIcon; accent?: "navy" | "teal" | "amber" | "violet" }) {
  const tones = {
    navy: "bg-[#123653]/8 text-[#123653]",
    teal: "bg-teal-50 text-teal-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <Card className="border-0 shadow-[0_1px_2px_rgba(15,23,42,.05),0_8px_24px_rgba(15,23,42,.04)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
            {detail ? <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p> : null}
          </div>
          <div className={cn("rounded-xl p-2.5", tones[accent])}><Icon className="h-5 w-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: { icon: LucideIcon; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed bg-white p-8 text-center">
      <div className="mb-4 rounded-2xl bg-slate-100 p-3 text-slate-500"><Icon className="h-6 w-6" /></div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      {actionLabel && onAction ? <Button onClick={onAction} variant="outline" className="mt-5 bg-white"><Plus className="mr-2 h-4 w-4" />{actionLabel}</Button> : null}
    </div>
  );
}

export const canWriteCrm = (role?: string | null) => role === "admin" || role === "commercial";
export const canWriteCustomerSuccess = (role?: string | null) => role === "admin";
export const canWriteSubscriptions = (role?: string | null) => role === "admin" || role === "finance";
export const canWriteSupport = (role?: string | null) => role === "admin" || role === "secretariat";
export const canWriteInvoices = (role?: string | null) => role === "admin" || role === "secretariat" || role === "finance";
