import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, PageHeader, formatDate, labelFor } from "@/components/crm/Common";
import { trpc } from "@/lib/trpc";
import { Loader2, Mail, MailPlus, Pencil, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

const categories = ["ACH", "ACT", "COM", "CONF", "CSM", "DIR", "INT", "MKT", "PROD", "SUP"] as const;
const fieldClass = "h-10 rounded-lg border-slate-200 bg-white focus:border-teal-600";
const selectClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15";

// Mêmes teintes que la base de connaissances, pour que l'œil retrouve ses
// repères d'un écran à l'autre.
const tone: Record<string, string> = {
  COM: "bg-teal-50 text-teal-700",
  CSM: "bg-teal-50 text-teal-700",
  SUP: "bg-sky-50 text-sky-700",
  ACT: "bg-sky-50 text-sky-700",
  MKT: "bg-violet-50 text-violet-700",
  PROD: "bg-violet-50 text-violet-700",
  CONF: "bg-amber-50 text-amber-800",
  ACH: "bg-amber-50 text-amber-800",
  DIR: "bg-[#123653]/8 text-[#123653]",
  INT: "bg-slate-100 text-slate-600",
};

function TemplateDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (v: boolean) => void; initial?: any }) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState({
    name: initial?.name || "",
    category: initial?.category || "INT",
    subject: initial?.subject || "",
    body: initial?.body || "",
  });
  const create = trpc.email.templates.create.useMutation();
  const update = trpc.email.templates.update.useMutation();
  const pending = create.isPending || update.isPending;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const payload = { ...form, category: form.category as (typeof categories)[number] };
      if (initial?.id) await update.mutateAsync({ id: initial.id, ...payload });
      else await create.mutateAsync(payload);
      await utils.email.templates.list.invalidate();
      toast.success("Modèle enregistré.");
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Modifier le modèle" : "Nouveau modèle"}</DialogTitle>
          <DialogDescription>
            Un modèle sert de point de départ : il reste modifiable au moment de l’envoi.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block text-xs font-semibold text-slate-600">Nom</Label>
              <Input required minLength={2} maxLength={160} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={fieldClass} placeholder="Relance après démonstration" />
            </div>
            <div>
              <Label className="mb-2 block text-xs font-semibold text-slate-600">Catégorie</Label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={selectClass}>
                {categories.map(c => <option key={c} value={c}>{labelFor(c)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label className="mb-2 block text-xs font-semibold text-slate-600">Objet</Label>
            <Input required minLength={2} maxLength={240} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className={fieldClass} />
          </div>
          <div>
            <Label className="mb-2 block text-xs font-semibold text-slate-600">Message</Label>
            <Textarea required minLength={10} maxLength={20000} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
              className="min-h-56 rounded-lg border-slate-200 bg-white leading-6 focus:border-teal-600" />
            <p className="mt-2 text-xs text-muted-foreground">
              Variables disponibles : <code>{"{{contact}}"}</code>, <code>{"{{etablissement}}"}</code>, <code>{"{{expediteur}}"}</code>, <code>{"{{poste}}"}</code>.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={pending} className="bg-[#123653]">
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function EmailTemplates() {
  const [dialog, setDialog] = useState<{ open: boolean; item?: any }>({ open: false });
  const [deleting, setDeleting] = useState<any | null>(null);

  const utils = trpc.useUtils();
  const status = trpc.email.status.useQuery();
  const templates = trpc.email.templates.list.useQuery();
  const recent = trpc.email.recent.useQuery();
  const remove = trpc.email.templates.delete.useMutation();

  const canWrite = status.data?.canWrite === true;

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync({ id: deleting.id });
      await utils.email.templates.list.invalidate();
      toast.success("Modèle supprimé.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Messages"
        title="Modèles d’email"
        description="Les textes que votre équipe réutilise, adaptables à chaque envoi."
        actionLabel={canWrite ? "Nouveau modèle" : undefined}
        onAction={canWrite ? () => setDialog({ open: true }) : undefined}
      />

      {status.data && !status.data.configured ? (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          L’envoi d’emails n’est pas configuré sur cet environnement : les modèles sont enregistrés, mais aucun message
          ne peut partir.
        </div>
      ) : null}

      {templates.isLoading ? (
        <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : templates.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.data.map(template => (
            <Card key={template.id} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tone[template.category]}`}>{labelFor(template.category)}</span>
                    <p className="mt-2 font-semibold text-slate-950">{template.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Objet : {template.subject}</p>
                  </div>
                  {canWrite ? (
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setDialog({ open: true, item: template })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-rose-600" onClick={() => setDeleting(template)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ) : null}
                </div>
                <p className="mt-3 line-clamp-4 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{template.body}</p>
                <p className="mt-3 text-xs text-muted-foreground">{template.authorName || "Auteur inconnu"} · {formatDate(template.updatedAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={MailPlus}
          title="Aucun modèle"
          description="Créez vos textes récurrents : relance après démonstration, proposition de rendez-vous, envoi de devis."
          actionLabel={canWrite ? "Nouveau modèle" : undefined}
          onAction={canWrite ? () => setDialog({ open: true }) : undefined}
        />
      )}

      {recent.data?.length ? (
        <Card className="mt-6 border-0 shadow-sm">
          <CardContent className="p-5">
            <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900"><Mail className="h-4 w-4 text-slate-500" />Derniers messages envoyés</h2>
            <div className="divide-y divide-slate-100">
              {recent.data.map(item => (
                <div key={item.id} className="py-3">
                  <p className="text-sm font-medium text-slate-900">{item.content.split("\n")[0].replace(/^Objet : /, "")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.contactName || "Destinataire inconnu"} · {item.authorName || "Auteur inconnu"} · {formatDate(item.occurredAt, true)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {dialog.open ? <TemplateDialog key={dialog.item?.id ?? "new"} open={dialog.open} onOpenChange={open => setDialog({ open })} initial={dialog.item} /> : null}

      <AlertDialog open={Boolean(deleting)} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce modèle ?</AlertDialogTitle>
            <AlertDialogDescription>{deleting ? `« ${deleting.name} » ne sera plus proposé à la rédaction. Les messages déjà envoyés sont conservés.` : null}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
