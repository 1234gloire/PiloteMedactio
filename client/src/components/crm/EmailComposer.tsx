import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AtSign, CalendarClock, Loader2, Mail, Paperclip, Send, X } from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { toast } from "sonner";
import { labelFor } from "./Common";

const fieldClass = "h-10 rounded-lg border-slate-200 bg-white focus:border-teal-600";
const selectClass = "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15";

export type EmailTarget =
  | { kind: "contact"; id: number }
  | { kind: "lead"; id: number }
  | { kind: "organization"; id: number };

/** Valeur par défaut d'un champ datetime-local : demain à 9 h, heure locale. */
function tomorrowAtNine() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T09:00`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Poids d'un fichier, dans l'unité qui se lit le mieux. */
function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

type Attached = { id: number; fileName: string; sizeBytes: number };

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
  const [later, setLater] = useState(false);
  const [sendAt, setSendAt] = useState(tomorrowAtNine);
  const [senderKey, setSenderKey] = useState<string>("");
  const [attached, setAttached] = useState<Attached[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const status = trpc.email.status.useQuery(undefined, { enabled: open });
  const templates = trpc.email.templates.list.useQuery(undefined, { enabled: open });
  const senders = trpc.email.senders.useQuery(undefined, { enabled: open });
  const limits = trpc.email.attachments.limits.useQuery(undefined, { enabled: open });
  const upload = trpc.email.attachments.upload.useMutation();
  const discard = trpc.email.attachments.discard.useMutation();
  const send = trpc.email.send.useMutation();
  const schedule = trpc.email.schedule.useMutation();
  const utils = trpc.useUtils();
  const pending = send.isPending || schedule.isPending;

  // La boîte de son équipe est proposée d'office : on ne la choisit que pour
  // en changer.
  const activeSender = senderKey || senders.data?.defaultKey || "";

  const totalBytes = attached.reduce((sum, file) => sum + file.sizeBytes, 0);

  /**
   * Le fichier est monté dès qu'il est choisi : l'attente a lieu pendant la
   * rédaction, et non au moment d'envoyer. Chaque fichier est traité à son
   * tour, afin que le nom affiché soit celui qui monte réellement.
   */
  const pickFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const maxCount = limits.data?.maxCount ?? 10;
    const totalMax = limits.data?.totalMaxBytes ?? 12 * 1024 * 1024;

    for (const file of Array.from(files)) {
      if (attached.length >= maxCount) {
        toast.error(`Pas plus de ${maxCount} pièces jointes par message.`);
        break;
      }
      setUploading(file.name);
      try {
        const base64 = await fileToBase64(file);
        const result = await upload.mutateAsync({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          base64,
        });
        setAttached(current => {
          const next = [...current, result];
          if (next.reduce((sum, item) => sum + item.sizeBytes, 0) > totalMax) {
            toast.error(`Les pièces jointes dépassent ${Math.round(totalMax / 1024 / 1024)} Mo au total.`);
            void discard.mutateAsync({ id: result.id }).catch(() => undefined);
            return current;
          }
          return next;
        });
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setUploading(null);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const removeFile = async (id: number) => {
    setAttached(current => current.filter(file => file.id !== id));
    // Le fichier est effacé du stockage ; un échec ici est sans conséquence,
    // le ménage quotidien s'en chargera.
    await discard.mutateAsync({ id }).catch(() => undefined);
  };

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
      if (later) {
        // datetime-local est en heure locale : new Date() la convertit avant l'envoi au serveur.
        const result = await schedule.mutateAsync({ recipient: target, subject, body, dealId: dealId ?? null, sendAt: new Date(sendAt), attachmentIds: attached.map(file => file.id), senderKey: activeSender || null });
        await utils.email.scheduled.list.invalidate();
        toast.success(`Envoi programmé pour ${result.to} le ${new Date(result.sendAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}.`);
      } else {
        const result = await send.mutateAsync({ recipient: target, subject, body, dealId: dealId ?? null, attachmentIds: attached.map(file => file.id), senderKey: activeSender || null });
        toast.success(`Message envoyé à ${result.to} depuis ${result.from}${result.attachments ? ` avec ${result.attachments} pièce${result.attachments > 1 ? "s" : ""} jointe${result.attachments > 1 ? "s" : ""}` : ""}.`);
      }
      setSubject(""); setBody(""); setTemplateId("none"); setLater(false); setAttached([]); setSenderKey("");
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
            {recipientLabel ? `Destinataire : ${recipientLabel}.` : "Choisissez la boîte d’expédition, puis rédigez."}
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
              <Label htmlFor="expediteur" className="mb-2 block text-xs font-semibold text-slate-600">
                <AtSign className="mr-1 inline h-3.5 w-3.5 text-teal-700" />Expédier depuis
              </Label>
              <select id="expediteur" value={activeSender} onChange={e => setSenderKey(e.target.value)} className={selectClass}>
                {senders.data?.available.map(item => (
                  <option key={item.key} value={item.key}>{item.label} — {item.email}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">
                C’est l’adresse que verra le destinataire. Votre réponse vous revient quoi qu’il arrive
                {status.data?.from ? ` sur ${status.data.from}` : ""}.
              </p>
            </div>

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

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <Paperclip className="h-4 w-4 text-teal-700" />
                  Pièces jointes
                  {attached.length ? (
                    <span className="text-xs font-normal text-muted-foreground">
                      {attached.length} fichier{attached.length > 1 ? "s" : ""} · {formatSize(totalBytes)}
                    </span>
                  ) : null}
                </div>
                <Button type="button" size="sm" variant="outline" className="bg-white"
                  disabled={Boolean(uploading)} onClick={() => fileInput.current?.click()}>
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
                  Joindre un document
                </Button>
              </div>

              <input ref={fileInput} type="file" multiple className="hidden"
                onChange={e => void pickFiles(e.target.files)} />

              {attached.length ? (
                <ul className="mt-3 space-y-2">
                  {attached.map(file => (
                    <li key={file.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{file.fileName}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatSize(file.sizeBytes)}</span>
                      <button type="button" onClick={() => void removeFile(file.id)}
                        aria-label={`Retirer ${file.fileName}`}
                        className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {uploading ? (
                <p className="mt-2 text-xs text-muted-foreground">Téléversement de « {uploading} »…</p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  {limits.data
                    ? `Jusqu’à ${limits.data.maxCount} fichiers, ${Math.round(limits.data.maxBytes / 1024 / 1024)} Mo chacun et ${Math.round(limits.data.totalMaxBytes / 1024 / 1024)} Mo au total. Formats : ${limits.data.allowed}.`
                    : "Documents, tableurs, présentations et images."}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                <input type="checkbox" checked={later} onChange={e => setLater(e.target.checked)} className="h-4 w-4 accent-[#123653]" />
                <CalendarClock className="h-4 w-4 text-sky-700" />Programmer l’envoi
              </label>
              {later ? (
                <div className="mt-3">
                  <Input type="datetime-local" required value={sendAt} onChange={e => setSendAt(e.target.value)} className={fieldClass} />
                  <p className="mt-2 text-xs text-muted-foreground">Le message partira automatiquement à cette date ; vous pourrez l’annuler d’ici là.</p>
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit" disabled={pending || !target} className="bg-[#123653]">
                {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : later ? <CalendarClock className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
                {later ? "Programmer" : "Envoyer"}
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
