import { AssetDialog } from "@/components/crm/MarketingForms";
import { canWriteMarketing, EmptyState, formatDate, labelFor, PageHeader } from "@/components/crm/Common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Download, ExternalLink, FileText, FolderOpen, Search, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function MarketingLibrary() {
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [search, setSearch] = useState(""); const [type, setType] = useState("Tous"); const [campaignId, setCampaignId] = useState("all"); const [open, setOpen] = useState(false);
  const campaigns = trpc.marketing.campaigns.list.useQuery(); const assets = trpc.marketing.assets.list.useQuery({ search, type, campaignId: campaignId === "all" ? undefined : Number(campaignId) }); const profile = trpc.marketing.profile.useQuery(); const canWrite = canWriteMarketing(profile.data?.role); const utils = trpc.useUtils(); const remove = trpc.marketing.assets.delete.useMutation();
  useEffect(() => {
    const findAsset = (card: Element) => {
      const link = card.querySelector<HTMLAnchorElement>("a[href]");
      return link && assets.data?.find(item => new URL(item.fileUrl, window.location.href).href === link.href);
    };
    const handleCardClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || event.target.closest("button, a")) return;
      const card = event.target.closest(".group");
      const asset = card && findAsset(card);
      if (asset) setSelectedAsset(asset);
    };
    const cards = Array.from(document.querySelectorAll(".group")).filter(card => findAsset(card));
    cards.forEach(card => card.classList.add("cursor-pointer"));
    document.addEventListener("click", handleCardClick);
    return () => {
      cards.forEach(card => card.classList.remove("cursor-pointer"));
      document.removeEventListener("click", handleCardClick);
    };
  }, [assets.data]);
  const deleteAsset = async (id: number) => { if (!confirm("Retirer ce support de la bibliothèque ?")) return; try { await remove.mutateAsync({ id }); await utils.marketing.invalidate(); toast.success("Support retiré"); } catch (error) { toast.error(error instanceof Error ? error.message : "Suppression impossible"); } };
  return <div className="space-y-6"><PageHeader eyebrow="Marketing & Contenu" title="Bibliothèque de supports" description="Partagez plaquettes, argumentaires, présentations et études de cas avec toutes les équipes." actionLabel={canWrite ? "Importer un support" : undefined} onAction={canWrite ? () => setOpen(true) : undefined} />
    <Card className="border-0 shadow-sm"><CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_220px_260px]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un support…" className="pl-9" /></div><select value={type} onChange={e => setType(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="Tous">Tous les types</option>{["Plaquette", "Argumentaire", "Etude de Cas", "Presentation", "Visuel", "Autre"].map(value => <option key={value} value={value}>{labelFor(value)}</option>)}</select><select value={campaignId} onChange={e => setCampaignId(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="all">Toutes les campagnes</option>{campaigns.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></CardContent></Card>
    {assets.data?.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{assets.data.map(asset => <Card key={asset.id} className="group border-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div className="rounded-xl bg-teal-50 p-3 text-teal-700"><FileText className="h-5 w-5" /></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{labelFor(asset.assetType)}</span></div><h2 className="mt-5 text-lg font-semibold text-slate-950">{asset.title}</h2><p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{asset.description || "Support partagé avec l’équipe Medactio."}</p><div className="mt-5 border-t border-slate-100 pt-4 text-xs text-muted-foreground"><p className="truncate">{asset.campaignName || "Bibliothèque générale"}</p><p className="mt-1">{asset.fileName} · {formatFileSize(asset.sizeBytes)} · {formatDate(asset.createdAt)}</p></div><div className="mt-4 flex gap-2"><Button asChild className="flex-1 bg-[#123653]"><a href={asset.fileUrl} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />Télécharger</a></Button>{canWrite && <Button size="icon" variant="outline" className="text-rose-600" onClick={() => deleteAsset(asset.id)}><Trash2 className="h-4 w-4" /></Button>}</div></CardContent></Card>)}</div> : <EmptyState icon={FolderOpen} title="Bibliothèque vide" description="Importez les supports utiles aux équipes Marketing et Commerciale." actionLabel={canWrite ? "Importer un support" : undefined} onAction={canWrite ? () => setOpen(true) : undefined} />}
    {open && <AssetDialog open={open} onOpenChange={setOpen} campaigns={campaigns.data || []} />}
    <Dialog open={Boolean(selectedAsset)} onOpenChange={isOpen => !isOpen && setSelectedAsset(null)}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b p-5 pr-12">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">{selectedAsset?.title}</DialogTitle>
              <DialogDescription className="mt-1">{selectedAsset?.fileName}</DialogDescription>
            </div>
            {selectedAsset && <Button asChild size="sm" variant="outline" className="bg-white">
              <a href={selectedAsset.fileUrl} target="_blank" rel="noreferrer"><Download className="mr-2 h-4 w-4" />Télécharger</a>
            </Button>}
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 bg-slate-100">
          {selectedAsset?.mimeType === "application/pdf" || selectedAsset?.mimeType?.startsWith("text/") ? (
            <iframe title={selectedAsset.title} src={selectedAsset.fileUrl} className="h-[72vh] w-full bg-white" />
          ) : selectedAsset?.mimeType?.startsWith("image/") ? (
            <div className="flex h-[72vh] items-center justify-center p-4"><img src={selectedAsset.fileUrl} alt={selectedAsset.title} className="max-h-full max-w-full object-contain" /></div>
          ) : selectedAsset?.mimeType?.startsWith("video/") ? (
            <div className="flex h-[72vh] items-center justify-center p-4"><video src={selectedAsset.fileUrl} controls className="max-h-full max-w-full" /></div>
          ) : selectedAsset?.mimeType?.startsWith("audio/") ? (
            <div className="flex h-[40vh] items-center justify-center p-6"><audio src={selectedAsset.fileUrl} controls className="w-full max-w-xl" /></div>
          ) : (
            <div className="flex h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center">
              <FileText className="h-10 w-10 text-slate-400" />
              <p className="text-sm text-muted-foreground">L’aperçu intégré n’est pas disponible pour ce format.</p>
              {selectedAsset && <Button asChild variant="outline" className="bg-white">
                <a href={selectedAsset.fileUrl} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Ouvrir le fichier</a>
              </Button>}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

function formatFileSize(bytes: number) {
  return bytes < 1024 ? `${bytes} o` : `${(bytes / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Ko`;
}
