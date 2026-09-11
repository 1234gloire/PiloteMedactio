import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { labelFor } from "./Common";

const inputClass = "h-10 rounded-lg border-slate-200 bg-white focus:border-teal-600";
const selectClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15";
const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Une erreur est survenue.";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-2 block text-xs font-semibold text-slate-600">{label}</Label>{children}</div>;
}

export function SubscriptionDialog({ open, onOpenChange, initial, defaultOrganizationId }: { open: boolean; onOpenChange: (open: boolean) => void; initial?: any; defaultOrganizationId?: number }) {
  const utils = trpc.useUtils();
  const organizations = trpc.crm.organizations.list.useQuery();
  const [form, setForm] = useState({
    organizationId: String(initial?.organizationId || defaultOrganizationId || ""),
    planName: initial?.planName || "Établissement",
    seatsPurchased: String(initial?.seatsPurchased || 10),
    pricePerSeat: String(initial?.pricePerSeat || 100),
    billingCycle: initial?.billingCycle || "Annuel",
    status: initial?.status || "Actif",
    startDate: initial?.startDate || new Date().toISOString().slice(0, 10),
    renewalDate: initial?.renewalDate || "",
  });
  const create = trpc.customerSuccess.subscriptions.create.useMutation();
  const update = trpc.customerSuccess.subscriptions.update.useMutation();
  const pending = create.isPending || update.isPending;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        organizationId: Number(form.organizationId),
        planName: form.planName,
        seatsPurchased: Number(form.seatsPurchased),
        pricePerSeat: Number(form.pricePerSeat),
        billingCycle: form.billingCycle as "Mensuel" | "Annuel",
        status: form.status as "Essai" | "Actif" | "Suspendu" | "Resilie",
        startDate: form.startDate || null,
        renewalDate: form.renewalDate || null,
      };
      if (initial?.id) await update.mutateAsync({ id: initial.id, ...payload }); else await create.mutateAsync(payload);
      await Promise.all([utils.customerSuccess.invalidate(), utils.crm.organizations.invalidate()]);
      toast.success(initial ? "Abonnement mis à jour" : "Client et abonnement activés");
      onOpenChange(false);
    } catch (error) { toast.error(errorMessage(error)); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
    <DialogHeader><DialogTitle>{initial ? "Modifier l’abonnement" : "Activer un client"}</DialogTitle><DialogDescription>Configurez le plan, les sièges et la prochaine échéance contractuelle.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">
      <Field label="Organisation" className="sm:col-span-2"><select required value={form.organizationId} disabled={Boolean(initial || defaultOrganizationId)} onChange={event => setForm({ ...form, organizationId: event.target.value })} className={selectClass}><option value="" disabled>Sélectionner un établissement</option>{organizations.data?.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></Field>
      <Field label="Nom du plan"><Input required value={form.planName} onChange={event => setForm({ ...form, planName: event.target.value })} className={inputClass} /></Field>
      <Field label="Statut"><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} className={selectClass}>{["Essai", "Actif", "Suspendu", "Resilie"].map(value => <option key={value} value={value}>{labelFor(value)}</option>)}</select></Field>
      <Field label="Sièges souscrits"><Input required type="number" min="1" value={form.seatsPurchased} onChange={event => setForm({ ...form, seatsPurchased: event.target.value })} className={inputClass} /></Field>
      <Field label="Prix par siège (€)"><Input required type="number" min="0" step="0.01" value={form.pricePerSeat} onChange={event => setForm({ ...form, pricePerSeat: event.target.value })} className={inputClass} /></Field>
      <Field label="Cycle de facturation"><select value={form.billingCycle} onChange={event => setForm({ ...form, billingCycle: event.target.value })} className={selectClass}><option value="Mensuel">Mensuel</option><option value="Annuel">Annuel</option></select></Field>
      <Field label="Date de début"><Input type="date" value={form.startDate} onChange={event => setForm({ ...form, startDate: event.target.value })} className={inputClass} /></Field>
      <Field label="Date de renouvellement" className="sm:col-span-2"><Input type="date" value={form.renewalDate} onChange={event => setForm({ ...form, renewalDate: event.target.value })} className={inputClass} /></Field>
    </div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{initial ? "Enregistrer" : "Activer le client"}</Button></DialogFooter></form>
  </DialogContent></Dialog>;
}

export function CancellationDialog({ open, onOpenChange, subscriptionId, organizationName }: { open: boolean; onOpenChange: (open: boolean) => void; subscriptionId: number; organizationName: string }) {
  const utils = trpc.useUtils(); const mutation = trpc.customerSuccess.subscriptions.cancel.useMutation();
  const [reason, setReason] = useState(""); const [cancelledAt, setCancelledAt] = useState(new Date().toISOString().slice(0, 10));
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await mutation.mutateAsync({ id: subscriptionId, reason, cancelledAt }); await Promise.all([utils.customerSuccess.invalidate(), utils.crm.organizations.invalidate()]); toast.success("Résiliation enregistrée"); onOpenChange(false); } catch (error) { toast.error(errorMessage(error)); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Enregistrer la résiliation</DialogTitle><DialogDescription>Le compte {organizationName} passera en inactif. Le motif alimentera l’analyse du churn.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><Field label="Date de résiliation"><Input required type="date" value={cancelledAt} onChange={event => setCancelledAt(event.target.value)} className={inputClass} /></Field><Field label="Motif"><Textarea required minLength={3} value={reason} onChange={event => setReason(event.target.value)} className="min-h-28" placeholder="Budget, faible usage, changement de solution…" /></Field><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" variant="destructive" disabled={mutation.isPending}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmer la résiliation</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function UsageDialog({ open, onOpenChange, organizationId, contacts }: { open: boolean; onOpenChange: (open: boolean) => void; organizationId: number; contacts: any[] }) {
  const utils = trpc.useUtils(); const mutation = trpc.customerSuccess.usage.create.useMutation();
  const [form, setForm] = useState({ contactId: "none", documentsGeneratedCount: "1", logDate: new Date().toISOString().slice(0, 10) });
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await mutation.mutateAsync({ organizationId, contactId: form.contactId === "none" ? null : Number(form.contactId), documentsGeneratedCount: Number(form.documentsGeneratedCount), logDate: form.logDate }); await utils.customerSuccess.invalidate(); toast.success("Usage ajouté"); onOpenChange(false); } catch (error) { toast.error(errorMessage(error)); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Ajouter un relevé d’usage</DialogTitle><DialogDescription>Enregistrez un volume d’écrits générés pour l’établissement ou un praticien.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><Field label="Praticien"><select value={form.contactId} onChange={event => setForm({ ...form, contactId: event.target.value })} className={selectClass}><option value="none">Usage global établissement</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.fullName}</option>)}</select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Écrits générés"><Input required type="number" min="1" value={form.documentsGeneratedCount} onChange={event => setForm({ ...form, documentsGeneratedCount: event.target.value })} className={inputClass} /></Field><Field label="Date"><Input required type="date" value={form.logDate} onChange={event => setForm({ ...form, logDate: event.target.value })} className={inputClass} /></Field></div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" disabled={mutation.isPending}>Ajouter</Button></DialogFooter></form></DialogContent></Dialog>;
}
