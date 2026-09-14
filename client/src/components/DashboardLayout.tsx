import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { Activity, BarChart3, Bell, Building2, CalendarDays, ClipboardCheck, Columns3, Download, FileCheck2, Headphones, HeartPulse, LayoutDashboard, LogOut, Megaphone, PanelLeft, ReceiptText, ShieldCheck, Target, UserRound, Users } from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";

const primaryItems = [
  { icon: LayoutDashboard, label: "Vue d’ensemble", path: "/" },
  { icon: Columns3, label: "Pipeline", path: "/pipeline" },
  { icon: Building2, label: "Organisations", path: "/organisations" },
  { icon: UserRound, label: "Contacts", path: "/contacts" },
];

const customerItems = [
  { icon: Activity, label: "Vue Succès Client", path: "/clients" },
  { icon: Users, label: "Comptes clients", path: "/clients/liste" },
];

const supportItems = [
  { icon: Headphones, label: "Vue Support", path: "/support" },
  { icon: Headphones, label: "Tickets", path: "/support/tickets" },
  { icon: ClipboardCheck, label: "Tâches", path: "/support/taches" },
  { icon: ReceiptText, label: "Facturation", path: "/support/factures" },
  { icon: FileCheck2, label: "Contrats", path: "/support/contrats" },
  { icon: CalendarDays, label: "Agenda", path: "/support/agenda" },
];

const directionItems = [
  { icon: BarChart3, label: "Vue Direction", path: "/direction" },
  { icon: Target, label: "Performance commerciale", path: "/direction/commercial" },
  { icon: HeartPulse, label: "Clients & SaaS", path: "/direction/clients" },
  { icon: Headphones, label: "Performance Support", path: "/direction/support" },
  { icon: Megaphone, label: "Performance Marketing", path: "/direction/marketing" },
  { icon: Download, label: "Exports", path: "/direction/exports" },
];

const directionNavItems = directionItems.filter(item => ["/direction", "/direction/commercial", "/direction/exports"].includes(item.path));

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();
  if (loading) return <DashboardLayoutSkeleton />;
  if (!user) {
    return <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f8f8] p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(18,111,105,.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(18,54,83,.10),transparent_42%)]" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/80 bg-white/90 p-8 shadow-[0_24px_80px_rgba(18,54,83,.12)] backdrop-blur">
        <div className="mb-8 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#123653] text-lg font-bold text-white">M</div><div><p className="text-lg font-semibold tracking-tight text-[#123653]">MEDACTIO</p><p className="text-xs font-medium uppercase tracking-[.18em] text-teal-700">Pilotage</p></div></div>
        <div className="mb-8"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800"><ShieldCheck className="h-3.5 w-3.5" /> Espace interne sécurisé</div><h1 className="text-3xl font-semibold tracking-tight text-slate-950">Bienvenue dans votre cockpit de pilotage.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Coordonnez l’activité commerciale, les clients, le support et les indicateurs stratégiques de Medactio.</p></div>
        <Button onClick={() => startLogin()} size="lg" className="h-12 w-full bg-[#123653] text-white hover:bg-[#0b2941]">Se connecter</Button>
        <p className="mt-5 text-center text-xs text-muted-foreground">Accès réservé à l’équipe Medactio</p>
      </div>
    </div>;
  }
  return <SidebarProvider><DashboardContent>{children}</DashboardContent></SidebarProvider>;
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const allItems = [...primaryItems, ...customerItems, ...supportItems, ...directionItems];
  const active = allItems.find(item => item.path === location) || allItems.slice().sort((a, b) => b.path.length - a.path.length).find(item => item.path !== "/" && location.startsWith(item.path));
  const activePole = location.startsWith("/direction") ? "Pôle Direction & Analytics" : location.startsWith("/support") ? "Pôle Secrétariat & Support" : location.startsWith("/clients") ? "Pôle Clients & Licences" : "Pôle Commercial & B2B";
  return <>
    <Sidebar collapsible="icon" className="border-r border-[#163f5d] bg-[#0f3049] text-white">
      <SidebarHeader className="h-20 justify-center border-b border-white/10 px-4">
        <div className="flex w-full items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500 font-bold text-white shadow-sm">M</div><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate font-semibold tracking-tight">MEDACTIO</p><p className="text-[10px] font-bold uppercase tracking-[.2em] text-teal-300">Pilotage</p></div></div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-4">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 group-data-[collapsible=icon]:hidden">Commercial & B2B</p>
        <SidebarMenu>{primaryItems.map(item => { const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path); return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-9 text-slate-200 hover:bg-white/8 hover:text-white data-[active=true]:bg-teal-500 data-[active=true]:text-white"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu>
        <p className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 group-data-[collapsible=icon]:hidden">Clients & Licences</p>
        <SidebarMenu>{customerItems.map(item => { const isActive = item.path === "/clients" ? location === "/clients" : location.startsWith(item.path); return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-9 text-slate-200 hover:bg-white/8 hover:text-white data-[active=true]:bg-teal-500 data-[active=true]:text-white"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu>
        <p className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 group-data-[collapsible=icon]:hidden">Secrétariat & Support</p>
        <SidebarMenu>{supportItems.map(item => { const isActive = item.path === "/support" ? location === "/support" : location.startsWith(item.path); return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-9 text-slate-200 hover:bg-white/8 hover:text-white data-[active=true]:bg-teal-500 data-[active=true]:text-white"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu>
        <p className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 group-data-[collapsible=icon]:hidden">Direction & Analytics</p>
        <SidebarMenu>{directionNavItems.map(item => { const isActive = item.path === "/direction" ? location === "/direction" : item.path === "/direction/commercial" ? location.startsWith("/direction/") && location !== "/direction/exports" : location.startsWith(item.path); return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.path === "/direction/commercial" ? "Rapports par pôle" : item.label} className="h-9 text-slate-200 hover:bg-white/8 hover:text-white data-[active=true]:bg-teal-500 data-[active=true]:text-white"><item.icon className="h-4 w-4" /><span>{item.path === "/direction/commercial" ? "Rapports par pôle" : item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t border-white/10 p-3">
        <DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/8"><Avatar className="h-9 w-9 shrink-0 border border-white/10"><AvatarFallback className="bg-white/10 text-xs text-white">{user?.name?.charAt(0).toUpperCase() || "M"}</AvatarFallback></Avatar><div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-medium text-white">{user?.name || "Équipe Medactio"}</p><p className="truncate text-xs text-slate-400">{user?.email || "Compte interne"}</p></div></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuItem onClick={logout} className="text-destructive"><LogOut className="mr-2 h-4 w-4" />Se déconnecter</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
      </SidebarFooter>
    </Sidebar>
    <SidebarInset className="min-h-screen bg-[#f6f8fa]">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur sm:px-7">
        <div className="flex items-center gap-3">{isMobile ? <SidebarTrigger className="h-9 w-9" /> : <PanelLeft className="h-4 w-4 text-slate-400" />}<div><p className="text-sm font-semibold text-slate-800">{active?.label || "Medactio Pilotage"}</p><p className="hidden text-xs text-muted-foreground sm:block">{activePole}</p></div></div>
        <Button variant="ghost" size="icon" className="relative rounded-full text-slate-500"><Bell className="h-4.5 w-4.5" /><span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-teal-500" /></Button>
      </header>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </SidebarInset>
  </>;
}
