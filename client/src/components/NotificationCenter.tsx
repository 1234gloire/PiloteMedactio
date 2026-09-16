import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { labelFor } from "@/components/crm/Common";
import { trpc } from "@/lib/trpc";
import { Bell, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const categories = ["Toutes", "Commercial", "Marketing", "Succes Client", "Support", "Finance", "Juridique", "RH", "Produit", "Fournisseurs"] as const;

const categoryTone: Record<string, string> = {
  Juridique: "bg-teal-50 text-teal-700",
  Fournisseurs: "bg-violet-50 text-violet-700",
  RH: "bg-sky-50 text-sky-700",
  Produit: "bg-amber-50 text-amber-800",
  Finance: "bg-emerald-50 text-emerald-700",
};

function relativeTime(value: Date | string) {
  const date = new Date(value);
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "à l’instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "hier" : `il y a ${days} j`;
}

/**
 * Centre de notifications accessible depuis n'importe quel écran.
 *
 * Les alertes proviennent des pôles transverses (échéances juridiques,
 * renouvellements fournisseurs, congés à valider, demandes produit) et sont
 * recalculées à la demande par un responsable.
 */
export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>("Toutes");
  const [, setLocation] = useLocation();

  const utils = trpc.useUtils();
  const unread = trpc.governance.notifications.unreadCount.useQuery(undefined, { refetchInterval: 120_000 });
  const list = trpc.governance.notifications.list.useQuery({ category }, { enabled: open });
  const access = trpc.governance.access.useQuery();
  const markRead = trpc.governance.notifications.markRead.useMutation();
  const markAll = trpc.governance.notifications.markAllRead.useMutation();
  const refresh = trpc.governance.notifications.refresh.useMutation();

  const canRefresh = access.data?.role === "admin" || access.data?.role === "direction";
  const count = unread.data?.unread ?? 0;

  const reload = async () => {
    await Promise.all([utils.governance.notifications.list.invalidate(), utils.governance.notifications.unreadCount.invalidate()]);
  };

  const openNotification = async (notification: { id: number; link: string | null; isRead: boolean }) => {
    if (!notification.isRead) {
      await markRead.mutateAsync({ id: notification.id });
      await reload();
    }
    if (notification.link) {
      setOpen(false);
      setLocation(notification.link);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full text-slate-500" aria-label={`Notifications${count ? ` — ${count} non lues` : ""}`}>
          <Bell className="h-4.5 w-4.5" />
          {count > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-teal-500 px-1 text-[10px] font-bold text-white">
              {count > 9 ? "9+" : count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-slate-100 p-3">
          <p className="text-sm font-semibold text-slate-900">Notifications</p>
          <div className="flex items-center gap-1">
            {canRefresh ? (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                title="Recalculer les alertes"
                disabled={refresh.isPending}
                onClick={async () => {
                  try {
                    const result = await refresh.mutateAsync();
                    await reload();
                    toast.success(result.created ? `${result.created} nouvelle(s) alerte(s).` : "Aucune nouvelle alerte.");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Recalcul impossible.");
                  }
                }}
              >
                {refresh.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
            ) : null}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="Tout marquer comme lu"
              disabled={markAll.isPending || count === 0}
              onClick={async () => {
                await markAll.mutateAsync();
                await reload();
              }}
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="border-b border-slate-100 px-3 py-2">
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-teal-600"
          >
            {categories.map(item => <option key={item} value={item}>{item === "Toutes" ? "Tous les pôles" : labelFor(item)}</option>)}
          </select>
        </div>

        <div className="max-h-[380px] overflow-y-auto">
          {list.isLoading ? (
            <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : list.data?.length ? (
            <div className="divide-y divide-slate-100">
              {list.data.map(notification => (
                <button
                  key={notification.id}
                  onClick={() => openNotification(notification)}
                  className={`flex w-full gap-3 p-3 text-left transition hover:bg-slate-50 ${notification.isRead ? "" : "bg-teal-50/40"}`}
                >
                  <span className={`mt-0.5 h-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryTone[notification.category ?? ""] ?? "bg-slate-100 text-slate-600"}`}>
                    {labelFor(notification.category)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs leading-5 ${notification.isRead ? "text-slate-600" : "font-medium text-slate-900"}`}>
                      {notification.message}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">{relativeTime(notification.createdAt)}</span>
                  </span>
                  {!notification.isRead ? <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" /> : null}
                </button>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">Aucune notification</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {category === "Toutes" ? "Les échéances et demandes à traiter apparaîtront ici." : "Aucune alerte pour ce pôle."}
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
