import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Mail, Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { labelFor } from "./Common";

const fieldClass = "h-10 rounded-lg border-slate-200 bg-white focus:border-teal-600";
const selectClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15";

export type EmailTarget =
  | { kind: "contact"; id: number }
  | { kind: "lead"; id: number }
  | { kind: "organization"; id: number };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

/**
 * Rédaction et envoi d'un message depuis la plateforme.
 *
 * Un modèle sert de point de départ : il est recopié dans les champs, où il
 * reste librement modifiable. Les variables ({{contact}}, {{etablissement}},
 * {{expediteur}}, {{poste}}) sont remplacées à l'envoi par le serveur, qui
 * seul connaît les valeurs à jour.
 */
export function EmailComposer({
  target,
  recipientLabel,
  dealId,
  open,
  onOpenChange,
  onSent,
}: {
  target: EmailTarget | null;
  recipientLabel?: string | null;
  dealId?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [templateId, setTemplateId] = useState("none");

  const status = trpc.email.status.useQuery(undefined, { enabled: open });
  const templates = trpc.email.templates.list.useQuery(undefined, { enabled: open });
  const send = trpc.email.send.useMutation();

  const applyTemplate = (value: string) => {
    setTemplateId(value);
    const template = templates.data?.find(item => String(item.id) === value);
    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!target) return;
    try {
      const result = await send.mutateAsync({ recipient: target, subject, body, dealId: dealId ?? null });
      toast.success(`Message envoyé à ${result.to}.`);
      setSubject(""); setBody(""); setTemplateId("none");
      onSent?.();
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const unavailable = status.data && !status.data.configured;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Écrire un message</DialogTitle>
          <DialogDescription>
            {recipientLabel ? `Destinataire : ${recipientLabel}. ` : ""}
            La réponse vous parviendra directement{status.data?.from ? ` sur ${status.data.from}` : ""}.
          </DialogDescription>
        </DialogHeader>

        {unavailable ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            L’envoi d’emails n’est pas configuré sur cet environnement. Renseignez les clés Mailjet pour activer la
            rédaction.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="mb-2 block text-xs font-semibold text-slate-600">Partir d’un modèle</Label>
              <select value={templateId} onChange={e => applyTemplate(e.target.value)} className={selectClass}>
                <option value="none">Rédaction libre</option>
                {templates.data?.map(template => (
                  <option key={template.id} value={template.id}>
                    {labelFor(template.category)} — {template.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="sujet" className="mb-2 block text-xs font-semibold text-slate-600">Objet</Label>
              <Input id="sujet" required minLength={2} maxLength={240} value={subject}
                onChange={e => setSubject(e.target.value)} className={fieldClass}
                placeholder="Suite à notre échange" />
            </div>

            <div>
              <Label htmlFor="corps" className="mb-2 block text-xs font-semibold text-slate-600">Message</Label>
              <Textarea id="corps" required minLength={5} maxLength={20000} value={body}
                onChange={e => setBody(e.target.value)}
                className="min-h-56 rounded-lg border-slate-200 bg-white leading-6 focus:border-teal-600"
                placeholder={"Bonjour {{contact}},\n\n…\n\nBien cordialement,\n{{expediteur}}"} />
              <p className="mt-2 text-xs text-muted-foreground">
                Variables remplacées à l’envoi : <code>{"{{contact}}"}</code>, <code>{"{{etablissement}}"}</code>,{" "}
                <code>{"{{expediteur}}"}</code>, <code>{"{{poste}}"}</code>.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit" disabled={send.isPending || !target} className="bg-[#123653]">
                {send.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Envoyer
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Bouton d'appel, masqué pour les rôles qui n'écrivent pas aux établissements. */
export function EmailButton({
  target,
  recipientLabel,
  dealId,
  onSent,
  size = "sm",
  variant = "outline",
  label = "Écrire",
}: {
  target: EmailTarget | null;
  recipientLabel?: string | null;
  dealId?: number | null;
  onSent?: () => void;
  size?: "sm" | "icon";
  variant?: "outline" | "ghost";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const status = trpc.email.status.useQuery();

  if (!status.data?.canWrite || !target) return null;

  return (
    <>
      <Button size={size} variant={variant} className={variant === "outline" ? "bg-white" : ""} onClick={() => setOpen(true)}>
        <Mail className={size === "icon" ? "h-4 w-4" : "mr-2 h-4 w-4"} />
        {size === "icon" ? null : label}
      </Button>
      {open ? (
        <EmailComposer target={target} recipientLabel={recipientLabel} dealId={dealId} open={open} onOpenChange={setOpen} onSent={onSent} />
      ) : null}
    </>
  );
}
