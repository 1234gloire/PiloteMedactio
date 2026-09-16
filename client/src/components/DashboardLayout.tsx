import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/useMobile";
import { Activity, Banknote, BarChart3, BookOpen, Building2, CalendarDays, ClipboardCheck, Columns3, Download, FileCheck2, FileSpreadsheet, Headphones, HeartPulse, Handshake, Landmark, LayoutDashboard, Lightbulb, LogOut, Megaphone, PanelLeft, ReceiptText, Scale, ShieldCheck, Target, UserRound, UserRoundPlus, Users } from "lucide-react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import LoginScreen from "./LoginScreen";
import NotificationCenter from "./NotificationCenter";

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

const marketingItems = [
  { icon: Megaphone, label: "Vue Marketing", path: "/marketing" },
  { icon: Target, label: "Campagnes", path: "/marketing/campagnes" },
  { icon: CalendarDays, label: "Calendrier éditorial", path: "/marketing/calendrier" },
  { icon: UserRoundPlus, label: "Leads", path: "/marketing/leads" },
  { icon: BookOpen, label: "Bibliothèque", path: "/marketing/bibliotheque" },
];

const financeItems = [
  { icon: Landmark, label: "Trésorerie", path: "/finance" },
  { icon: Banknote, label: "Dépenses", path: "/finance/depenses" },
  { icon: Scale, label: "Rapprochement", path: "/finance/rapprochement" },
  { icon: FileSpreadsheet, label: "Export comptable", path: "/finance/export" },
];

const governanceItems = [
  { icon: Scale, label: "Juridique", path: "/juridique" },
  { icon: Handshake, label: "Fournisseurs", path: "/fournisseurs" },
];

const teamItems = [
  { icon: Users, label: "Équipe & congés", path: "/rh" },
  { icon: Lightbulb, label: "Roadmap produit", path: "/produit" },
  { icon: BookOpen, label: "Base de connaissances", path: "/base-de-connaissances" },
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
  if (!user) return <LoginScreen />;

  return <SidebarProvider><DashboardContent>{children}</DashboardContent></SidebarProvider>;
}

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  // Le pôle Finance porte les données les plus sensibles : il n'apparaît dans
  // la navigation que pour les rôles autorisés à le consulter.
  const financeAccess = trpc.finance.access.useQuery();
  const showFinance = financeAccess.data?.allowed === true;
  // Juridique et Fournisseurs sont réservés à la direction et à l'administration
  // (la finance accède aux fournisseurs, qui portent ses dépenses).
  const governanceAccess = trpc.governance.access.useQuery();
  const showGovernance = governanceAccess.data?.legal === true || governanceAccess.data?.suppliers === true;
  const allItems = [...primaryItems, ...customerItems, ...supportItems, ...marketingItems, ...financeItems, ...governanceItems, ...teamItems, ...directionItems];
  const active = allItems.find(item => item.path === location) || allItems.slice().sort((a, b) => b.path.length - a.path.length).find(item => item.path !== "/" && location.startsWith(item.path));
  const activePole = location.startsWith("/juridique") || location.startsWith("/fournisseurs") ? "Gouvernance & Conformité" : location.startsWith("/rh") || location.startsWith("/produit") || location.startsWith("/base-de-connaissances") ? "Équipe & Produit" : location.startsWith("/finance") ? "Pôle Finance & Comptabilité" : location.startsWith("/direction") ? "Pôle Direction & Analytics" : location.startsWith("/marketing") ? "Pôle Marketing & Contenu" : location.startsWith("/support") ? "Pôle Secrétariat & Support" : location.startsWith("/clients") ? "Pôle Clients & Licences" : "Pôle Commercial & B2B";
  return <>
    <Sidebar collapsible="icon" className="border-r border-[#163f5d] bg-[#0f3049] text-white">
      <SidebarHeader className="h-20 justify-center border-b border-white/10 px-4">
        <div className="flex w-full items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-500 font-bold text-white shadow-sm">M</div><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate font-semibold tracking-tight">MEDACTIO</p><p className="text-[10px] font-bold uppercase tracking-[.2em] text-teal-300">Pilotage</p></div></div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-4 [&>p]:shrink-0 [&>ul]:shrink-0">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 group-data-[collapsible=icon]:hidden">Commercial & B2B</p>
        <SidebarMenu>{primaryItems.map(item => { const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path); return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-9 text-slate-200 hover:bg-white/8 hover:text-white data-[active=true]:bg-teal-500 data-[active=true]:text-white"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu>
        <p className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 group-data-[collapsible=icon]:hidden">Clients & Licences</p>
        <SidebarMenu>{customerItems.map(item => { const isActive = item.path === "/clients" ? location === "/clients" : location.startsWith(item.path); return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-9 text-slate-200 hover:bg-white/8 hover:text-white data-[active=true]:bg-teal-500 data-[active=true]:text-white"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu>
        <p className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 group-data-[collapsible=icon]:hidden">Secrétariat & Support</p>
        <SidebarMenu>{supportItems.map(item => { const isActive = item.path === "/support" ? location === "/support" : location.startsWith(item.path); return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-9 text-slate-200 hover:bg-white/8 hover:text-white data-[active=true]:bg-teal-500 data-[active=true]:text-white"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu>
        <p className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 group-data-[collapsible=icon]:hidden">Marketing & Contenu</p>
        <SidebarMenu>{marketingItems.map(item => { const isActive = item.path === "/marketing" ? location === "/marketing" : location.startsWith(item.path); return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-9 text-slate-200 hover:bg-white/8 hover:text-white data-[active=true]:bg-teal-500 data-[active=true]:text-white"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu>
        {showFinance ? <>
          <p className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 group-data-[collapsible=icon]:hidden">Finance & Comptabilité</p>
          <SidebarMenu>{financeItems.map(item => { const isActive = item.path === "/finance" ? location === "/finance" : location.startsWith(item.path); return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-9 text-slate-200 hover:bg-white/8 hover:text-white data-[active=true]:bg-teal-500 data-[active=true]:text-white"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu>
        </> : null}
        {showGovernance ? <>
          <p className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 group-data-[collapsible=icon]:hidden">Gouvernance & Conformité</p>
          <SidebarMenu>{governanceItems.map(item => { const isActive = location.startsWith(item.path); return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-9 text-slate-200 hover:bg-white/8 hover:text-white data-[active=true]:bg-teal-500 data-[active=true]:text-white"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu>
        </> : null}
        <p className="mb-1 mt-4 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400 group-data-[collapsible=icon]:hidden">Équipe & Produit</p>
        <SidebarMenu>{teamItems.map(item => { const isActive = location.startsWith(item.path); return <SidebarMenuItem key={item.path}><SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-9 text-slate-200 hover:bg-white/8 hover:text-white data-[active=true]:bg-teal-500 data-[active=true]:text-white"><item.icon className="h-4 w-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu>
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
        <NotificationCenter />
      </header>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </SidebarInset>
  </>;
}
