import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { FileUp, Loader2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { labelFor } from "./Common";

const fieldClass = "h-10 rounded-lg border-slate-200 bg-white focus:border-teal-600";
const areaClass = "min-h-24 rounded-lg border-slate-200 bg-white focus:border-teal-600";
const selectClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15";

const legalTypes = ["CGU", "CGV", "DPA RGPD", "Contrat Fournisseur", "Certificat HDS", "Statuts", "Autre"] as const;
const supplierCategories = ["Hebergement", "Outil SaaS Interne", "Partenaire Commercial", "Autre"] as const;
const leaveTypes = ["Conges Payes", "RTT", "Maladie", "Autre"] as const;
const goalStatuses = ["En Cours", "Atteint", "Non Atteint"] as const;
const requestTypes = ["Bug", "Evolution"] as const;
const requestPriorities = ["Basse", "Moyenne", "Haute"] as const;
const requestStatuses = ["Idee", "Backlog", "En Developpement", "Livre"] as const;
const changelogTypes = ["Nouvelle Fonctionnalite", "Amelioration", "Correction"] as const;
const articleCategories = ["Commercial", "Support", "Marketing", "General"] as const;

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-2 block text-xs font-semibold text-slate-600">{label}</Label>{children}</div>;
}
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Une erreur est survenue."; }
function dateValue(value?: Date | string | null) { return value ? new Date(value).toISOString().slice(0, 10) : ""; }
const today = () => new Date().toISOString().slice(0, 10);
async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------------- Juridique ---------------- */

export function LegalDocumentDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (open: boolean) => void; initial?: any }) {
  const utils = trpc.useUtils();
  const organizations = trpc.crm.organizations.list.useQuery(undefined, { enabled: open });
  const [form, setForm] = useState({
    organizationId: String(initial?.organizationId || "none"),
    title: initial?.title || "",
    type: initial?.type || "DPA RGPD",
    version: initial?.version || "",
    effectiveDate: dateValue(initial?.effectiveDate),
    expiryDate: dateValue(initial?.expiryDate),
    notes: initial?.notes || "",
  });
  const [file, setFile] = useState<File | null>(null);

  const create = trpc.governance.legal.create.useMutation();
  const update = trpc.governance.legal.update.useMutation();
  const upload = trpc.governance.legal.upload.useMutation();
  const pending = create.isPending || update.isPending || upload.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        organizationId: form.organizationId === "none" ? null : Number(form.organizationId),
        title: form.title,
        type: form.type as (typeof legalTypes)[number],
        version: form.version || null,
        effectiveDate: form.effectiveDate || null,
        expiryDate: form.expiryDate || null,
        notes: form.notes || null,
      };
      const documentId = initial?.id ?? (await create.mutateAsync(payload)).id;
      if (initial?.id) await update.mutateAsync({ id: documentId, ...payload });
      if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error("Le document dépasse la limite de 10 Mo.");
        await upload.mutateAsync({
          id: documentId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64: await fileToBase64(file),
        });
      }
      await Promise.all([utils.governance.legal.list.invalidate(), utils.governance.legal.schedule.invalidate()]);
      toast.success(initial?.id ? "Document mis à jour." : "Document enregistré.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Modifier le document" : "Nouveau document juridique"}</DialogTitle>
          <DialogDescription>Les documents assortis d’une date d’expiration alimentent l’échéancier de conformité.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Intitulé"><Input required minLength={2} maxLength={240} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={fieldClass} placeholder="Certificat d’hébergement de données de santé" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={selectClass}>
                {legalTypes.map(type => <option key={type} value={type}>{labelFor(type)}</option>)}
              </select>
            </Field>
            <Field label="Version"><Input maxLength={60} value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} className={fieldClass} placeholder="v1.2" /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Entrée en vigueur"><Input type="date" value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} className={fieldClass} /></Field>
            <Field label="Expiration"><Input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} className={fieldClass} /></Field>
          </div>
          <Field label="Établissement concerné">
            <select value={form.organizationId} onChange={e => setForm({ ...form, organizationId: e.target.value })} className={selectClass}>
              <option value="none">Document interne</option>
              {organizations.data?.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </Field>
          <Field label="Notes"><Textarea maxLength={5000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={areaClass} /></Field>
          <Field label="Document (10 Mo maximum)">
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm transition hover:border-teal-500">
              <FileUp className="h-4 w-4 text-slate-500" />
              <span className="truncate text-slate-600">{file ? file.name : initial?.documentName || "Choisir un fichier"}</span>
              <input type="file" className="hidden" accept=".pdf,.doc,.docx,image/*" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={pending} className="bg-[#123653]">{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Fournisseurs ---------------- */

export function SupplierDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (open: boolean) => void; initial?: any }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    name: initial?.name || "",
    category: initial?.category || "Outil SaaS Interne",
    contactName: initial?.contactName || "",
    contactEmail: initial?.contactEmail || "",
    annualCost: initial?.annualCost ? String(initial.annualCost) : "0",
    contractRenewalDate: dateValue(initial?.contractRenewalDate),
    notes: initial?.notes || "",
  });
  const create = trpc.governance.suppliers.create.useMutation();
  const update = trpc.governance.suppliers.update.useMutation();
  const pending = create.isPending || update.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        name: form.name,
        category: form.category as (typeof supplierCategories)[number],
        contactName: form.contactName || null,
        contactEmail: form.contactEmail || "",
        annualCost: Number(form.annualCost) || 0,
        contractRenewalDate: form.contractRenewalDate || null,
        notes: form.notes || null,
      };
      if (initial?.id) await update.mutateAsync({ id: initial.id, ...payload });
      else await create.mutateAsync(payload);
      await utils.governance.suppliers.list.invalidate();
      toast.success(initial?.id ? "Fournisseur mis à jour." : "Fournisseur enregistré.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle>
          <DialogDescription>La date de renouvellement déclenche une alerte trente jours avant l’échéance.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nom"><Input required minLength={2} maxLength={240} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={fieldClass} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Catégorie">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={selectClass}>
                {supplierCategories.map(category => <option key={category} value={category}>{labelFor(category)}</option>)}
              </select>
            </Field>
            <Field label="Coût annuel (€)"><Input type="number" min="0" step="0.01" value={form.annualCost} onChange={e => setForm({ ...form, annualCost: e.target.value })} className={fieldClass} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact"><Input maxLength={200} value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} className={fieldClass} /></Field>
            <Field label="Email du contact"><Input type="email" maxLength={320} value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} className={fieldClass} /></Field>
          </div>
          <Field label="Renouvellement du contrat"><Input type="date" value={form.contractRenewalDate} onChange={e => setForm({ ...form, contractRenewalDate: e.target.value })} className={fieldClass} /></Field>
          <Field label="Notes"><Textarea maxLength={5000} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={areaClass} /></Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={pending} className="bg-[#123653]">{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- RH ---------------- */

export function LeaveDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ type: "Conges Payes", startDate: today(), endDate: today() });
  const request = trpc.governance.hr.requestLeave.useMutation();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await request.mutateAsync({ type: form.type as (typeof leaveTypes)[number], startDate: form.startDate, endDate: form.endDate });
      await Promise.all([utils.governance.hr.leaves.invalidate(), utils.governance.hr.team.invalidate()]);
      toast.success("Demande transmise.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Demander un congé</DialogTitle>
          <DialogDescription>Seuls les jours ouvrés sont décomptés. La demande doit être validée par un responsable.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Type">
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={selectClass}>
              {leaveTypes.map(type => <option key={type} value={type}>{labelFor(type)}</option>)}
            </select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Du"><Input required type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className={fieldClass} /></Field>
            <Field label="Au"><Input required type="date" min={form.startDate} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className={fieldClass} /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={request.isPending} className="bg-[#123653]">{request.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Envoyer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function GoalDialog({ open, onOpenChange, initial, userId }: { open: boolean; onOpenChange: (open: boolean) => void; initial?: any; userId?: number }) {
  const utils = trpc.useUtils();
  const team = trpc.governance.hr.team.useQuery(undefined, { enabled: open && !userId });
  const [form, setForm] = useState({
    userId: String(initial?.userId || userId || ""),
    title: initial?.title || "",
    targetDate: dateValue(initial?.targetDate),
    status: initial?.status || "En Cours",
  });
  const create = trpc.governance.hr.createGoal.useMutation();
  const update = trpc.governance.hr.updateGoal.useMutation();
  const pending = create.isPending || update.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (initial?.id) {
        await update.mutateAsync({ id: initial.id, title: form.title, targetDate: form.targetDate || null, status: form.status as (typeof goalStatuses)[number] });
      } else {
        await create.mutateAsync({ userId: Number(form.userId), title: form.title, targetDate: form.targetDate || null, status: form.status as (typeof goalStatuses)[number] });
      }
      await Promise.all([utils.governance.hr.team.invalidate(), utils.governance.hr.member.invalidate()]);
      toast.success("Objectif enregistré.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Modifier l’objectif" : "Nouvel objectif"}</DialogTitle>
          <DialogDescription>Un objectif individuel, daté et suivi jusqu’à son atteinte.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {!initial?.id && !userId ? (
            <Field label="Collaborateur">
              <select required value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className={selectClass}>
                <option value="">Sélectionner…</option>
                {team.data?.map(member => <option key={member.id} value={member.id}>{member.fullName}</option>)}
              </select>
            </Field>
          ) : null}
          <Field label="Objectif"><Input required minLength={2} maxLength={240} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={fieldClass} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Échéance"><Input type="date" value={form.targetDate} onChange={e => setForm({ ...form, targetDate: e.target.value })} className={fieldClass} /></Field>
            <Field label="Statut">
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={selectClass}>
                {goalStatuses.map(status => <option key={status} value={status}>{labelFor(status)}</option>)}
              </select>
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={pending} className="bg-[#123653]">{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Roadmap ---------------- */

export function ProductRequestDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (open: boolean) => void; initial?: any }) {
  const utils = trpc.useUtils();
  const organizations = trpc.crm.organizations.list.useQuery(undefined, { enabled: open });
  const [form, setForm] = useState({
    organizationId: String(initial?.organizationId || "none"),
    title: initial?.title || "",
    description: initial?.description || "",
    type: initial?.type || "Evolution",
    priority: initial?.priority || "Moyenne",
    status: initial?.status || "Idee",
  });
  const create = trpc.governance.product.create.useMutation();
  const update = trpc.governance.product.update.useMutation();
  const pending = create.isPending || update.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = {
        organizationId: form.organizationId === "none" ? null : Number(form.organizationId),
        title: form.title,
        description: form.description || null,
        type: form.type as (typeof requestTypes)[number],
        priority: form.priority as (typeof requestPriorities)[number],
        status: form.status as (typeof requestStatuses)[number],
      };
      if (initial?.id) await update.mutateAsync({ id: initial.id, ...payload });
      else await create.mutateAsync(payload);
      await Promise.all([utils.governance.product.list.invalidate(), utils.governance.product.summary.invalidate()]);
      toast.success("Demande enregistrée.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Modifier la demande" : "Nouvelle demande produit"}</DialogTitle>
          <DialogDescription>Rattachez la demande à l’établissement qui l’a exprimée : cela pèse dans la priorisation.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Titre"><Input required minLength={3} maxLength={240} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={fieldClass} /></Field>
          <Field label="Description"><Textarea maxLength={5000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={areaClass} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Type">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={selectClass}>
                {requestTypes.map(type => <option key={type} value={type}>{labelFor(type)}</option>)}
              </select>
            </Field>
            <Field label="Priorité">
              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className={selectClass}>
                {requestPriorities.map(priority => <option key={priority} value={priority}>{labelFor(priority)}</option>)}
              </select>
            </Field>
            <Field label="Statut">
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className={selectClass}>
                {requestStatuses.map(status => <option key={status} value={status}>{labelFor(status)}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Établissement demandeur">
            <select value={form.organizationId} onChange={e => setForm({ ...form, organizationId: e.target.value })} className={selectClass}>
              <option value="none">Non rattachée</option>
              {organizations.data?.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
            </select>
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={pending} className="bg-[#123653]">{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ChangelogDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ title: "", description: "", releaseDate: today(), type: "Amelioration" });
  const create = trpc.governance.product.createChangelog.useMutation();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await create.mutateAsync({
        title: form.title,
        description: form.description || null,
        releaseDate: form.releaseDate || null,
        type: form.type as (typeof changelogTypes)[number],
      });
      await utils.governance.product.changelog.invalidate();
      toast.success("Entrée ajoutée au changelog.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle entrée de changelog</DialogTitle>
          <DialogDescription>Ce qui est publié ici peut être communiqué aux établissements clients.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Titre"><Input required minLength={3} maxLength={240} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={fieldClass} /></Field>
          <Field label="Description"><Textarea maxLength={5000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={areaClass} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type">
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className={selectClass}>
                {changelogTypes.map(type => <option key={type} value={type}>{labelFor(type)}</option>)}
              </select>
            </Field>
            <Field label="Date de livraison"><Input type="date" value={form.releaseDate} onChange={e => setForm({ ...form, releaseDate: e.target.value })} className={fieldClass} /></Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={create.isPending} className="bg-[#123653]">{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Publier</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Base de connaissances ---------------- */

export function ArticleDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (open: boolean) => void; initial?: any }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    title: initial?.title || "",
    category: initial?.category || "General",
    content: initial?.content || "",
  });
  const create = trpc.governance.knowledge.create.useMutation();
  const update = trpc.governance.knowledge.update.useMutation();
  const pending = create.isPending || update.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (initial?.id) await update.mutateAsync({ id: initial.id, ...form, category: form.category as (typeof articleCategories)[number] });
      else await create.mutateAsync({ ...form, category: form.category as (typeof articleCategories)[number] });
      await Promise.all([utils.governance.knowledge.list.invalidate(), utils.governance.knowledge.get.invalidate()]);
      toast.success("Article enregistré.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Modifier l’article" : "Nouvel article"}</DialogTitle>
          <DialogDescription>Rédigez en texte simple. Les sauts de ligne sont conservés à l’affichage.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Titre"><Input required minLength={3} maxLength={240} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={fieldClass} /></Field>
          <Field label="Catégorie">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={selectClass}>
              {articleCategories.map(category => <option key={category} value={category}>{labelFor(category)}</option>)}
            </select>
          </Field>
          <Field label="Contenu">
            <Textarea required minLength={10} maxLength={100000} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="min-h-64 rounded-lg border-slate-200 bg-white font-mono text-sm focus:border-teal-600" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={pending} className="bg-[#123653]">{pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const collaboratorRoles = ["admin", "direction", "commercial", "marketing", "secretariat", "finance"] as const;

/**
 * Enregistrement d'un collaborateur : c'est le seul moyen d'ouvrir un accès à
 * l'outil. Le mot de passe provisoire n'est affiché qu'une fois.
 */
export function CollaboratorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ fullName: "", email: "", role: "secretariat", jobTitle: "" });
  const [result, setResult] = useState<{ temporaryPassword: string | null; accountCreated: boolean } | null>(null);
  const register = trpc.governance.hr.registerCollaborator.useMutation();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const created = await register.mutateAsync({
        fullName: form.fullName,
        email: form.email,
        role: form.role as (typeof collaboratorRoles)[number],
        jobTitle: form.jobTitle || null,
      });
      await utils.governance.hr.team.invalidate();
      setResult(created);
      toast.success("Collaborateur enregistré.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const close = () => { setResult(null); setForm({ fullName: "", email: "", role: "secretariat", jobTitle: "" }); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={value => (value ? onOpenChange(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{result ? "Accès créé" : "Enregistrer un collaborateur"}</DialogTitle>
          <DialogDescription>
            {result
              ? "Transmettez ces informations à la personne concernée."
              : "Seules les adresses enregistrées ici peuvent se connecter à la plateforme."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            {result.accountCreated && result.temporaryPassword ? (
              <>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-muted-foreground">Adresse de connexion</p>
                  <p className="mt-1 font-medium text-slate-900">{form.email.trim().toLowerCase()}</p>
                  <p className="mt-3 text-xs text-muted-foreground">Mot de passe provisoire</p>
                  <p className="mt-1 select-all font-mono text-sm font-semibold text-slate-900">{result.temporaryPassword}</p>
                </div>
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  Ce mot de passe ne sera plus affiché. Transmettez-le par un canal sûr et demandez à la personne de le
                  changer à sa première connexion, depuis « Mot de passe oublié ».
                </p>
              </>
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                Le profil est enregistré, mais le compte de connexion n’a pas pu être créé automatiquement. Créez-le
                depuis le tableau de bord Supabase avec la même adresse.
              </p>
            )}
            <DialogFooter><Button onClick={close} className="bg-[#123653]">Terminé</Button></DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field label="Nom complet">
              <Input required minLength={2} maxLength={200} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className={fieldClass} />
            </Field>
            <Field label="Adresse professionnelle">
              <Input required type="email" maxLength={320} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={fieldClass} placeholder="prenom.nom@medactio.fr" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rôle">
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={selectClass}>
                  {collaboratorRoles.map(role => <option key={role} value={role}>{labelFor(role)}</option>)}
                </select>
              </Field>
              <Field label="Intitulé de poste">
                <Input maxLength={160} value={form.jobTitle} onChange={e => setForm({ ...form, jobTitle: e.target.value })} className={fieldClass} />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>Annuler</Button>
              <Button type="submit" disabled={register.isPending} className="bg-[#123653]">
                {register.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enregistrer
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
