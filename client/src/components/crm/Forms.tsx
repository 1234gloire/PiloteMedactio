import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { labelFor } from "./Common";

const fieldClass = "h-10 rounded-lg border-slate-200 bg-white focus:border-teal-600";
const selectClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15";
const ORG_TYPES = ["Hopital Public", "Clinique Privee", "Groupement Hospitalier", "Cabinet Liberal"] as const;
const ORG_STATUSES = ["Prospect", "En Demo", "Negociation", "Client Actif", "Inactif"] as const;
const SOURCES = ["Site Web", "Salon Professionnel", "Recommandation", "Prospection a Froid", "LinkedIn", "Reseau AGAPE", "Autre"] as const;
const STAGES = ["Prospection", "Rendez-vous Place", "Demo Effectuee", "Devis Envoye", "Gagne", "Perdu"] as const;

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-2 block text-xs font-semibold text-slate-600">{label}</Label>{children}</div>;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

export function OrganizationDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (open: boolean) => void; initial?: any }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    name: initial?.name || "", type: initial?.type || "Hopital Public", address: initial?.address || "", city: initial?.city || "", postalCode: initial?.postalCode || "",
    status: initial?.status || "Prospect", leadSource: initial?.leadSource || "Autre", annualContractValue: String(initial?.annualContractValue || 0),
  });
  const create = trpc.crm.organizations.create.useMutation();
  const update = trpc.crm.organizations.update.useMutation();
  const pending = create.isPending || update.isPending;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = { ...form, type: form.type as typeof ORG_TYPES[number], status: form.status as typeof ORG_STATUSES[number], leadSource: form.leadSource as typeof SOURCES[number], annualContractValue: Number(form.annualContractValue) };
      if (initial?.id) await update.mutateAsync({ id: initial.id, ...payload }); else await create.mutateAsync(payload);
      await Promise.all([utils.crm.organizations.invalidate(), utils.crm.dashboard.invalidate(), utils.crm.deals.invalidate()]);
      toast.success(initial ? "Organisation mise à jour" : "Organisation créée");
      onOpenChange(false);
    } catch (error) { toast.error(errorMessage(error)); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
    <DialogHeader><DialogTitle>{initial ? "Modifier l’organisation" : "Nouvelle organisation"}</DialogTitle><DialogDescription>Renseignez l’établissement et sa provenance commerciale.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom de l’établissement" className="sm:col-span-2"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={fieldClass} /></Field>
        <Field label="Type"><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={selectClass}>{ORG_TYPES.map(value => <option key={value} value={value}>{labelFor(value)}</option>)}</select></Field>
        <Field label="Statut"><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={selectClass}>{ORG_STATUSES.map(value => <option key={value} value={value}>{labelFor(value)}</option>)}</select></Field>
        <Field label="Source d’acquisition"><select value={form.leadSource} onChange={e => setForm({ ...form, leadSource: e.target.value })} className={selectClass}>{SOURCES.map(value => <option key={value} value={value}>{labelFor(value)}</option>)}</select></Field>
        <Field label="Valeur annuelle estimée"><Input type="number" min="0" value={form.annualContractValue} onChange={e => setForm({ ...form, annualContractValue: e.target.value })} className={fieldClass} /></Field>
        <Field label="Ville"><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className={fieldClass} /></Field>
        <Field label="Code postal"><Input value={form.postalCode} onChange={e => setForm({ ...form, postalCode: e.target.value })} className={fieldClass} /></Field>
        <Field label="Adresse" className="sm:col-span-2"><Textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="min-h-20" /></Field>
      </div>
      <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{initial ? "Enregistrer" : "Créer l’organisation"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}

export function ContactDialog({ open, onOpenChange, initial, defaultOrganizationId }: { open: boolean; onOpenChange: (open: boolean) => void; initial?: any; defaultOrganizationId?: number }) {
  const utils = trpc.useUtils();
  const organizations = trpc.crm.organizations.list.useQuery();
  const [form, setForm] = useState({
    organizationId: String(initial?.organizationId || defaultOrganizationId || "none"), fullName: initial?.fullName || "", email: initial?.email || "", phone: initial?.phone || "", specialty: initial?.specialty || "", jobTitle: initial?.jobTitle || "",
  });
  const create = trpc.crm.contacts.create.useMutation();
  const update = trpc.crm.contacts.update.useMutation();
  const pending = create.isPending || update.isPending;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = { ...form, organizationId: form.organizationId === "none" ? null : Number(form.organizationId) };
      if (initial?.id) await update.mutateAsync({ id: initial.id, ...payload }); else await create.mutateAsync(payload);
      await Promise.all([utils.crm.contacts.invalidate(), utils.crm.organizations.invalidate()]);
      toast.success(initial ? "Contact mis à jour" : "Contact créé"); onOpenChange(false);
    } catch (error) { toast.error(errorMessage(error)); }
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-xl">
    <DialogHeader><DialogTitle>{initial ? "Modifier le contact" : "Nouveau contact"}</DialogTitle><DialogDescription>Ajoutez un décideur, un référent ou un praticien.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">
      <Field label="Établissement" className="sm:col-span-2"><select value={form.organizationId} onChange={e => setForm({ ...form, organizationId: e.target.value })} className={selectClass}><option value="none">Sans établissement</option>{organizations.data?.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></Field>
      <Field label="Nom complet" className="sm:col-span-2"><Input required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className={fieldClass} /></Field>
      <Field label="Email"><Input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={fieldClass} /></Field>
      <Field label="Téléphone"><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={fieldClass} /></Field>
      <Field label="Fonction"><Input value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} className={fieldClass} /></Field>
      <Field label="Spécialité / service"><Input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} className={fieldClass} /></Field>
    </div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{initial ? "Enregistrer" : "Créer le contact"}</Button></DialogFooter></form>
  </DialogContent></Dialog>;
}

export function DealDialog({ open, onOpenChange, initial, defaultOrganizationId }: { open: boolean; onOpenChange: (open: boolean) => void; initial?: any; defaultOrganizationId?: number }) {
  const utils = trpc.useUtils();
  const orgs = trpc.crm.organizations.list.useQuery();
  const users = trpc.crm.users.useQuery();
  const [form, setForm] = useState({
    organizationId: String(initial?.organizationId || defaultOrganizationId || ""), assignedTo: String(initial?.assignedTo || "none"), title: initial?.title || "", amount: String(initial?.amount || 0), stage: initial?.stage || "Prospection", expectedCloseDate: initial?.expectedCloseDate || "", notes: initial?.notes || "", lossReason: initial?.lossReason || "",
  });
  const create = trpc.crm.deals.create.useMutation(); const update = trpc.crm.deals.update.useMutation(); const pending = create.isPending || update.isPending;
  const submit = async (event: FormEvent) => { event.preventDefault(); try {
    const payload = { organizationId: Number(form.organizationId), assignedTo: form.assignedTo === "none" ? null : Number(form.assignedTo), title: form.title, amount: Number(form.amount), stage: form.stage as typeof STAGES[number], expectedCloseDate: form.expectedCloseDate || null, notes: form.notes || null, lossReason: form.lossReason || null };
    if (initial?.id) await update.mutateAsync({ id: initial.id, ...payload }); else await create.mutateAsync(payload);
    await Promise.all([utils.crm.deals.invalidate(), utils.crm.dashboard.invalidate(), utils.crm.organizations.invalidate()]); toast.success(initial ? "Opportunité mise à jour" : "Opportunité créée"); onOpenChange(false);
  } catch (error) { toast.error(errorMessage(error)); }};
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{initial ? "Modifier l’opportunité" : "Nouvelle opportunité"}</DialogTitle><DialogDescription>Positionnez le deal dans le pipeline et estimez sa valeur.</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-5"><div className="grid gap-4 sm:grid-cols-2">
      <Field label="Intitulé" className="sm:col-span-2"><Input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={fieldClass} /></Field>
      <Field label="Organisation"><select required value={form.organizationId} onChange={e => setForm({ ...form, organizationId: e.target.value })} className={selectClass}><option value="" disabled>Sélectionner</option>{orgs.data?.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></Field>
      <Field label="Commercial"><select value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })} className={selectClass}><option value="none">Non assigné</option>{users.data?.filter(user => ["commercial", "admin"].includes(user.role)).map(user => <option key={user.id} value={user.id}>{user.fullName}</option>)}</select></Field>
      <Field label="Montant estimé"><Input type="number" min="0" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className={fieldClass} /></Field>
      <Field label="Étape"><select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} className={selectClass}>{STAGES.map(value => <option key={value} value={value}>{labelFor(value)}</option>)}</select></Field>
      <Field label="Clôture estimée"><Input type="date" value={form.expectedCloseDate} onChange={e => setForm({ ...form, expectedCloseDate: e.target.value })} className={fieldClass} /></Field>
      {form.stage === "Perdu" ? <Field label="Motif de perte"><Input value={form.lossReason} onChange={e => setForm({ ...form, lossReason: e.target.value })} className={fieldClass} /></Field> : <div />}
      <Field label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="min-h-24" /></Field>
    </div><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{initial ? "Enregistrer" : "Créer l’opportunité"}</Button></DialogFooter></form>
  </DialogContent></Dialog>;
}

export function InteractionDialog({ open, onOpenChange, dealId, contacts }: { open: boolean; onOpenChange: (open: boolean) => void; dealId: number; contacts: any[] }) {
  const utils = trpc.useUtils(); const mutation = trpc.crm.interactions.create.useMutation();
  const [form, setForm] = useState({ type: "Note", contactId: "none", content: "" });
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await mutation.mutateAsync({ dealId, type: form.type as "Appel" | "Email" | "Reunion" | "Note", contactId: form.contactId === "none" ? null : Number(form.contactId), content: form.content }); await utils.crm.deals.get.invalidate({ id: dealId }); toast.success("Interaction ajoutée"); onOpenChange(false); } catch (error) { toast.error(errorMessage(error)); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Journaliser une interaction</DialogTitle><DialogDescription>Conservez la trace d’un appel, d’un email, d’un rendez-vous ou d’une note.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4">
    <Field label="Type"><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={selectClass}>{["Appel", "Email", "Reunion", "Note"].map(value => <option key={value} value={value}>{labelFor(value)}</option>)}</select></Field>
    <Field label="Contact associé"><select value={form.contactId} onChange={e => setForm({ ...form, contactId: e.target.value })} className={selectClass}><option value="none">Aucun contact</option>{contacts.map(contact => <option key={contact.id} value={contact.id}>{contact.fullName}</option>)}</select></Field>
    <Field label="Compte rendu"><Textarea required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="min-h-28" placeholder="Résumé, décisions et prochaines étapes…" /></Field>
    <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ajouter</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}

export function QuoteDialog({ open, onOpenChange, dealId, defaultAmount }: { open: boolean; onOpenChange: (open: boolean) => void; dealId: number; defaultAmount: string | number }) {
  const utils = trpc.useUtils(); const mutation = trpc.crm.quotes.create.useMutation(); const [amount, setAmount] = useState(String(defaultAmount)); const [validUntil, setValidUntil] = useState("");
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await mutation.mutateAsync({ dealId, amount: Number(amount), validUntil: validUntil || null }); await utils.crm.deals.get.invalidate({ id: dealId }); toast.success("Devis créé en brouillon"); onOpenChange(false); } catch (error) { toast.error(errorMessage(error)); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Générer un devis</DialogTitle><DialogDescription>Le devis est créé en brouillon. La signature électronique sera activée lors du branchement Yousign ou DocuSign.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><Field label="Montant"><Input required type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} className={fieldClass} /></Field><Field label="Valable jusqu’au"><Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className={fieldClass} /></Field><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" disabled={mutation.isPending}>Créer le devis</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function FollowUpDialog({ open, onOpenChange, dealId }: { open: boolean; onOpenChange: (open: boolean) => void; dealId: number }) {
  const utils = trpc.useUtils(); const mutation = trpc.crm.followUps.create.useMutation(); const [form, setForm] = useState({ type: "Relance commerciale", dueAt: "", note: "" });
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await mutation.mutateAsync({ dealId, type: form.type as "Devis sans reponse" | "RDV a confirmer" | "Relance commerciale" | "Autre", dueAt: new Date(form.dueAt), note: form.note || null }); await Promise.all([utils.crm.deals.get.invalidate({ id: dealId }), utils.crm.dashboard.invalidate()]); toast.success("Relance programmée"); onOpenChange(false); } catch (error) { toast.error(errorMessage(error)); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Programmer une relance</DialogTitle><DialogDescription>Ajoutez une échéance au tableau de bord commercial.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><Field label="Type"><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={selectClass}>{["Devis sans reponse", "RDV a confirmer", "Relance commerciale", "Autre"].map(value => <option key={value} value={value}>{labelFor(value)}</option>)}</select></Field><Field label="Date et heure"><Input required type="datetime-local" value={form.dueAt} onChange={e => setForm({ ...form, dueAt: e.target.value })} className={fieldClass} /></Field><Field label="Note"><Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></Field><DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button type="submit" disabled={mutation.isPending}>Programmer</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function DeleteDialog({ open, onOpenChange, title, description, onConfirm, pending }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; onConfirm: () => void | Promise<void>; pending?: boolean }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button><Button variant="destructive" disabled={pending} onClick={onConfirm}><Trash2 className="mr-2 h-4 w-4" />Supprimer</Button></DialogFooter></DialogContent></Dialog>;
}
