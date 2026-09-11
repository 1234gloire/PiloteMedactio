import { canWriteCrm, EmptyState, formatDate, labelFor, PageHeader } from "@/components/crm/Common";
import { ContactDialog, DeleteDialog } from "@/components/crm/Forms";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { Building2, Mail, MessageSquareText, Pencil, Phone, Stethoscope, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const interactionIcons: Record<string, string> = { Appel: "A", Email: "E", Reunion: "R", Note: "N" };

export default function ContactDetail({ id }: { id: number }) {
  const [, setLocation] = useLocation(); const utils = trpc.useUtils(); const query = trpc.crm.contacts.get.useQuery({ id }); const profile = trpc.crm.profile.useQuery(); const remove = trpc.crm.contacts.delete.useMutation(); const canWrite = canWriteCrm(profile.data?.role); const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  if (query.isLoading) return <div className="mx-auto max-w-[1200px] space-y-5"><Skeleton className="h-24" /><Skeleton className="h-80" /></div>;
  if (!query.data) return <EmptyState icon={UserRound} title="Contact introuvable" description="Ce contact n’existe plus ou n’est pas accessible." />;
  const { contact, interactions } = query.data;
  const confirmDelete = async () => { try { await remove.mutateAsync({ id }); await utils.crm.contacts.invalidate(); toast.success("Contact supprimé"); setLocation("/contacts"); } catch (error) { toast.error(error instanceof Error ? error.message : "Suppression impossible"); } };
  return <div className="reveal mx-auto max-w-[1200px]"><PageHeader backTo="/contacts" eyebrow="Fiche contact" title={contact.fullName} description={[contact.jobTitle, contact.organizationName].filter(Boolean).join(" · ")} />
    <div className="mb-5 flex flex-wrap items-center gap-2">{contact.isLicenseActive ? <Badge className="rounded-full border-0 bg-emerald-50 text-emerald-700">Licence active</Badge> : <Badge variant="outline" className="rounded-full">Sans licence active</Badge>}{canWrite ? <><Button variant="outline" size="sm" className="bg-white" onClick={() => setDialog("edit")}><Pencil className="mr-2 h-4 w-4" />Modifier</Button><Button variant="ghost" size="sm" className="text-rose-600" onClick={() => setDialog("delete")}><Trash2 className="mr-2 h-4 w-4" />Supprimer</Button></> : null}</div>
    <div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]">
      <Card className="soft-card h-fit"><CardContent className="p-6"><div className="mb-7 flex items-center gap-4"><Avatar className="h-16 w-16"><AvatarFallback className="bg-teal-50 text-lg font-bold text-teal-700">{contact.fullName.split(" ").map(part => part[0]).slice(-2).join("")}</AvatarFallback></Avatar><div><p className="font-semibold text-slate-950">{contact.fullName}</p><p className="text-sm text-muted-foreground">{contact.jobTitle || "Fonction non renseignée"}</p></div></div><div className="space-y-5"><Info icon={Mail} label="Email" value={contact.email} /><Info icon={Phone} label="Téléphone" value={contact.phone || "Non renseigné"} /><Info icon={Stethoscope} label="Spécialité / service" value={contact.specialty || "Non renseigné"} /><button onClick={() => contact.organizationId && setLocation(`/organisations/${contact.organizationId}`)} className="flex w-full gap-3 text-left"><div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Building2 className="h-4 w-4" /></div><div><p className="text-xs font-medium text-muted-foreground">Établissement</p><p className="mt-0.5 text-sm font-semibold text-teal-700">{contact.organizationName || "Sans établissement"}</p></div></button></div></CardContent></Card>
      <Card className="soft-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquareText className="h-4 w-4 text-teal-700" /> Historique des interactions</CardTitle><p className="text-xs text-muted-foreground">Journal chronologique lié aux opportunités</p></CardHeader><CardContent>{interactions.length ? <div className="relative space-y-5 before:absolute before:bottom-3 before:left-4 before:top-3 before:w-px before:bg-slate-200">{interactions.map(item => <button key={item.id} onClick={() => item.dealId && setLocation(`/deals/${item.dealId}`)} className="relative flex w-full gap-4 text-left"><div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#123653] text-[10px] font-bold text-white">{interactionIcons[item.type]}</div><div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-slate-50/60 p-4"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold uppercase tracking-wide text-teal-700">{labelFor(item.type)}</p><span className="text-xs text-muted-foreground">{formatDate(item.occurredAt, true)}</span></div><p className="text-sm leading-6 text-slate-700">{item.content}</p><p className="mt-2 text-xs text-muted-foreground">{item.dealTitle || "Sans opportunité"} · {item.authorName || "Équipe Medactio"}</p></div></button>)}</div> : <EmptyState icon={MessageSquareText} title="Aucune interaction" description="Les appels, emails, rendez-vous et notes liés à ce contact apparaîtront ici." />}</CardContent></Card>
    </div>
    {dialog === "edit" ? <ContactDialog open onOpenChange={() => setDialog(null)} initial={contact} /> : null}{dialog === "delete" ? <DeleteDialog open onOpenChange={() => setDialog(null)} title="Supprimer ce contact ?" description="Cette action est irréversible." onConfirm={confirmDelete} pending={remove.isPending} /> : null}
  </div>;
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value: string }) { return <div className="flex gap-3"><div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500"><Icon className="h-4 w-4" /></div><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p></div></div>; }
