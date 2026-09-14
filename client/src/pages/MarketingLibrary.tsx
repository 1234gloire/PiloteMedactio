import { AssetDialog } from "@/components/crm/MarketingForms";
import { canWriteMarketing, EmptyState, formatDate, labelFor, PageHeader } from "@/components/crm/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Download, FileText, FolderOpen, Search, Trash2, UploadCloud } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function MarketingLibrary() {
  const [search, setSearch] = useState(""); const [type, setType] = useState("Tous"); const [campaignId, setCampaignId] = useState("all"); const [open, setOpen] = useState(false);
  const campaigns = trpc.marketing.campaigns.list.useQuery(); const assets = trpc.marketing.assets.list.useQuery({ search, type, campaignId: campaignId === "all" ? undefined : Number(campaignId) }); const profile = trpc.marketing.profile.useQuery(); const canWrite = canWriteMarketing(profile.data?.role); const utils = trpc.useUtils(); const remove = trpc.marketing.assets.delete.useMutation();
  const deleteAsset = async (id: number) => { if (!confirm("Retirer ce support de la bibliothèque ?")) return; try { await remove.mutateAsync({ id }); await utils.marketing.invalidate(); toast.success("Support retiré"); } catch (error) { toast.error(error instanceof Error ? error.message : "Suppression impossible"); } };
  return <div className="space-y-6"><PageHeader eyebrow="Marketing & Contenu" title="Bibliothèque de supports" description="Partagez plaquettes, argumentaires, présentations et études de cas avec toutes les équipes." actionLabel={canWrite ? "Importer un support" : undefined} onAction={canWrite ? () => setOpen(true) : undefined} />
    <Card className="border-0 shadow-sm"><CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_220px_260px]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un support…" className="pl-9" /></div><select value={type} onChange={e => setType(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="Tous">Tous les types</option>{["Plaquette", "Argumentaire", "Etude de Cas", "Presentation", "Visuel", "Autre"].map(value => <option key={value} value={value}>{labelFor(value)}</option>)}</select><select value={campaignId} onChange={e => setCampaignId(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">Toutes les campagnes</option>{campaigns.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></CardContent></Card>
    {assets.data?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{assets.data.map(asset => <Card key={asset.id} className="group border-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-teal-50 p-3 text-teal-700"><FileText className="h-5 w-5" /></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{labelFor(asset.assetType)}</span></div><h2 className="mt-5 text-lg font-semibold text-slate-950">{asset.title}</h2><p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{asset.description || "Support partagé avec l’équipe Medactio."}</p><div className="mt-5 border-t border-slate-100 pt-4 text-xs text-muted-foreground"><p className="truncate">{asset.campaignName || "Bibliothèque générale"}</p><p className="mt-1">{asset.fileName} · {formatFileSize(asset.sizeBytes)} · {formatDate(asset.createdAt)}</p></div><div className="mt-4 flex gap-2"><Button asChild className="flex-1 bg-[#123653]"><a href={asset.fileUrl} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />Télécharger</a></Button>{canWrite && <Button size="icon" variant="outline" className="text-rose-600" onClick={() => deleteAsset(asset.id)}><Trash2 className="h-4 w-4" /></Button>}</div></CardContent></Card>)}</div> : <EmptyState icon={FolderOpen} title="Bibliothèque vide" description="Importez les supports utiles aux équipes Marketing et Commerciale." actionLabel={canWrite ? "Importer un support" : undefined} onAction={canWrite ? () => setOpen(true) : undefined} />}
    {open && <AssetDialog open={open} onOpenChange={setOpen} campaigns={campaigns.data || []} />}
  </div>;
}

function formatFileSize(bytes: number) {
  return bytes < 1024 ? `${bytes} o` : `${(bytes / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Ko`;
}
