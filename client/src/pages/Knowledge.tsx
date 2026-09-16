import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, PageHeader, formatDate, labelFor } from "@/components/crm/Common";
import { ArticleDialog } from "@/components/crm/GovernanceForms";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, BookOpen, Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const categories = ["Toutes", "Commercial", "Support", "Marketing", "General"] as const;

const categoryTone: Record<string, string> = {
  Commercial: "bg-teal-50 text-teal-700",
  Support: "bg-sky-50 text-sky-700",
  Marketing: "bg-violet-50 text-violet-700",
  General: "bg-slate-100 text-slate-600",
};

export default function Knowledge() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("Toutes");
  const [openId, setOpenId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; item?: any }>({ open: false });
  const [deleting, setDeleting] = useState<any | null>(null);

  const utils = trpc.useUtils();
  const profile = trpc.governance.profile.useQuery();
  const articles = trpc.governance.knowledge.list.useQuery({ search: search || undefined, category });
  const article = trpc.governance.knowledge.get.useQuery({ id: openId ?? 0 }, { enabled: openId !== null });
  const remove = trpc.governance.knowledge.delete.useMutation();

  const canEdit = (item?: { authorId: number | null } | null) =>
    Boolean(item && profile.data && (item.authorId === profile.data.id || ["admin", "direction"].includes(profile.data.role)));

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync({ id: deleting.id });
      await utils.governance.knowledge.list.invalidate();
      toast.success("Article supprimé.");
      setOpenId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible.");
    } finally {
      setDeleting(null);
    }
  };

  /* ---------- Fiche article ---------- */
  if (openId !== null) {
    return (
      <>
        <button onClick={() => setOpenId(null)} className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour à la base
        </button>

        {article.isLoading ? (
          <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : article.data ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 sm:p-8">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${categoryTone[article.data.category]}`}>{labelFor(article.data.category)}</span>
                  <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{article.data.title}</h1>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {article.data.authorName || "Auteur inconnu"} · mis à jour le {formatDate(article.data.updatedAt, true)}
                  </p>
                </div>
                {canEdit(article.data) ? (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" className="bg-white" onClick={() => setDialog({ open: true, item: article.data })}><Pencil className="mr-2 h-4 w-4" />Modifier</Button>
                    <Button size="sm" variant="outline" className="bg-white text-rose-600" onClick={() => setDeleting(article.data)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ) : null}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{article.data.content}</div>
            </CardContent>
          </Card>
        ) : (
          <EmptyState icon={BookOpen} title="Article introuvable" description="Il a peut-être été supprimé entre-temps." />
        )}

        {dialog.open ? <ArticleDialog key={dialog.item?.id} open={dialog.open} onOpenChange={open => setDialog({ open })} initial={dialog.item} /> : null}
        <AlertDialog open={Boolean(deleting)} onOpenChange={open => !open && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cet article ?</AlertDialogTitle>
              <AlertDialogDescription>{deleting ? `« ${deleting.title} » sera définitivement retiré de la base de connaissances.` : null}</AlertDialogDescription>
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

  /* ---------- Liste ---------- */
  return (
    <>
      <PageHeader
        eyebrow="Base de connaissances"
        title="Procédures et argumentaires"
        description="Le discours et les pratiques partagés de l’équipe : argumentaires commerciaux, procédures support, réponses types."
        actionLabel="Nouvel article"
        onAction={() => setDialog({ open: true })}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher dans le titre et le contenu" className="h-10 rounded-lg border-slate-200 bg-white pl-9" />
        </div>
        <select value={category} onChange={e => setCategory(e.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-teal-600">
          {categories.map(item => <option key={item} value={item}>{item === "Toutes" ? "Toutes les catégories" : labelFor(item)}</option>)}
        </select>
      </div>

      {articles.isLoading ? (
        <div className="flex min-h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : articles.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {articles.data.map(item => (
            <Card key={item.id} className="group cursor-pointer border-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" onClick={() => setOpenId(item.id)}>
              <CardContent className="p-5">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${categoryTone[item.category]}`}>{labelFor(item.category)}</span>
                <h2 className="mt-3 line-clamp-2 min-h-12 font-semibold leading-6 text-slate-950">{item.title}</h2>
                <p className="mt-2 line-clamp-3 min-h-15 text-sm leading-5 text-muted-foreground">{item.excerpt}</p>
                <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-muted-foreground">
                  {item.authorName || "Auteur inconnu"} · {formatDate(item.updatedAt)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title={search ? "Aucun résultat" : "Base vide"}
          description={search ? "Aucun article ne contient tous les mots recherchés." : "Consignez les argumentaires, procédures et réponses types de l’équipe."}
          actionLabel={search ? undefined : "Nouvel article"}
          onAction={search ? undefined : () => setDialog({ open: true })}
        />
      )}

      {dialog.open ? <ArticleDialog key={dialog.item?.id ?? "new"} open={dialog.open} onOpenChange={open => setDialog({ open })} initial={dialog.item} /> : null}
    </>
  );
}
