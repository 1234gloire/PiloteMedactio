import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { formatCurrency, formatDate, labelFor } from "./Common";

const fieldClass = "h-10 rounded-lg border-slate-200 bg-white focus:border-teal-600";
const selectClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15";

const expenseCategories = ["Hebergement", "Outils SaaS", "Salaires", "Marketing", "Frais Generaux", "Autre"] as const;

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-2 block text-xs font-semibold text-slate-600">{label}</Label>{children}</div>;
}
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Une erreur est survenue."; }
function dateValue(value?: Date | string | null) { return value ? new Date(value).toISOString().slice(0, 10) : ""; }
const today = () => new Date().toISOString().slice(0, 10);

export function ExpenseDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (open: boolean) => void; initial?: any }) {
  const utils = trpc.useUtils();
  const suppliers = trpc.finance.suppliers.useQuery(undefined, { enabled: open });
  const [form, setForm] = useState({
    supplierId: String(initial?.supplierId || "none"),
    label: initial?.label || "",
    category: initial?.category || "Outils SaaS",
    amount: initial?.amount ? String(initial.amount) : "",
    expenseDate: dateValue(initial?.expenseDate) || today(),
    isRecurring: Boolean(initial?.isRecurring),
  });

  const create = trpc.finance.expenses.create.useMutation();
  const update = trpc.finance.expenses.update.useMutation();
  const pending = create.isPending || update.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        supplierId: form.supplierId === "none" ? null : Number(form.supplierId),
        label: form.label,
        category: form.category as (typeof expenseCategories)[number],
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        isRecurring: form.isRecurring,
      };
      if (initial?.id) await update.mutateAsync({ id: initial.id, ...payload });
      else await create.mutateAsync(payload);
      await Promise.all([utils.finance.expenses.list.invalidate(), utils.finance.dashboard.invalidate()]);
      toast.success(initial?.id ? "Dépense mise à jour." : "Dépense enregistrée.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
          <DialogDescription>Les charges cochées comme récurrentes sont reconduites dans le prévisionnel de trésorerie.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Libellé">
            <Input required minLength={2} maxLength={240} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className={fieldClass} placeholder="Hébergement HDS — production" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Montant (€)">
              <Input required type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={fieldClass} />
            </Field>
            <Field label="Date">
              <Input required type="date" value={form.expenseDate} onChange={e => setForm({ ...form, expenseDate: e.target.value })} className={fieldClass} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Catégorie">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={selectClass}>
                {expenseCategories.map(category => <option key={category} value={category}>{labelFor(category)}</option>)}
              </select>
            </Field>
            <Field label="Fournisseur">
              <select value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })} className={selectClass}>
                <option value="none">Aucun</option>
                {suppliers.data?.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm">
            <input type="checkbox" checked={form.isRecurring} onChange={e => setForm({ ...form, isRecurring: e.target.checked })} className="h-4 w-4 accent-teal-600" />
            <span>Charge récurrente mensuelle</span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={pending} className="bg-[#123653]">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {initial?.id ? "Enregistrer" : "Créer la dépense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BankTransactionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ transactionDate: today(), amount: "", type: "Debit", description: "" });
  const create = trpc.finance.transactions.create.useMutation();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await create.mutateAsync({
        transactionDate: form.transactionDate,
        amount: Number(form.amount),
        type: form.type as "Credit" | "Debit",
        description: form.description || null,
      });
      await Promise.all([utils.finance.transactions.list.invalidate(), utils.finance.dashboard.invalidate()]);
      toast.success("Mouvement bancaire enregistré.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouveau mouvement bancaire</DialogTitle>
          <DialogDescription>Saisissez le montant en valeur absolue : le sens est donné par le type de mouvement.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date">
              <Input required type="date" value={form.transactionDate} onChange={e => setForm({ ...form, transactionDate: e.target.value })} className={fieldClass} />
            </Field>
            <Field label="Montant (€)">
              <Input required type="number" min="0.01" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={fieldClass} />
            </Field>
          </div>
          <Field label="Sens">
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={selectClass}>
              <option value="Debit">Débit — sortie d’argent</option>
              <option value="Credit">Crédit — entrée d’argent</option>
            </select>
          </Field>
          <Field label="Libellé bancaire">
            <Textarea maxLength={1000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="min-h-20 rounded-lg border-slate-200 bg-white focus:border-teal-600" placeholder="PRLV OVHCLOUD HEBERGEMENT" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={create.isPending} className="bg-[#123653]">
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Rapprochement d'un mouvement bancaire : l'application propose les pièces de
 * même montant, la validation reste manuelle.
 */
export function ReconcileDialog({ transaction, onOpenChange }: { transaction: any | null; onOpenChange: (open: boolean) => void }) {
  const utils = trpc.useUtils();
  const open = Boolean(transaction);
  const candidates = trpc.finance.transactions.candidates.useQuery({ id: transaction?.id ?? 0 }, { enabled: open });
  const reconcile = trpc.finance.transactions.reconcile.useMutation();

  const apply = async (kind: "invoice" | "expense", targetId: number) => {
    try {
      await reconcile.mutateAsync({ id: transaction.id, kind, targetId });
      await Promise.all([utils.finance.transactions.list.invalidate(), utils.finance.dashboard.invalidate()]);
      toast.success("Mouvement rapproché.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rapprocher le mouvement</DialogTitle>
          <DialogDescription>
            {transaction ? `${formatDate(transaction.transactionDate)} · ${formatCurrency(transaction.amount)} · ${transaction.type === "Credit" ? "entrée" : "sortie"}` : null}
          </DialogDescription>
        </DialogHeader>

        {candidates.isLoading ? (
          <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : candidates.data?.candidates.length ? (
          <div className="space-y-2">
            {candidates.data.candidates.map(candidate => (
              <button
                key={`${candidate.kind}-${candidate.id}`}
                onClick={() => apply(candidate.kind, candidate.id)}
                disabled={reconcile.isPending}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-teal-500 hover:bg-teal-50/40 disabled:opacity-60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{candidate.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {candidate.kind === "invoice" ? "Facture client" : "Dépense"} · {formatDate(candidate.date)} · écart {candidate.dayGap} j
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-slate-900">{formatCurrency(candidate.amount)}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-slate-50 p-6 text-center text-sm text-muted-foreground">
            Aucune pièce du même montant dans les quinze jours. Enregistrez la facture ou la dépense correspondante, puis relancez le rapprochement.
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
