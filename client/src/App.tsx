import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ContactDetail from "./pages/ContactDetail";
import Contacts from "./pages/Contacts";
import CustomerDetail from "./pages/CustomerDetail";
import Customers from "./pages/Customers";
import CustomerSuccessDashboard from "./pages/CustomerSuccessDashboard";
import DealDetail from "./pages/DealDetail";
import Home from "./pages/Home";
import OrganizationDetail from "./pages/OrganizationDetail";
import Organizations from "./pages/Organizations";
import PipelinePage from "./pages/Pipeline";
import AdminTasks from "./pages/AdminTasks";
import Contracts from "./pages/Contracts";
import Invoices from "./pages/Invoices";
import SupportCalendar from "./pages/SupportCalendar";
import SupportDashboard from "./pages/SupportDashboard";
import SupportTicketDetail from "./pages/SupportTicketDetail";
import SupportTickets from "./pages/SupportTickets";
import DirectionDashboard from "./pages/DirectionDashboard";
import DirectionExports from "./pages/DirectionExports";
import DirectionReport from "./pages/DirectionReport";
import MarketingDashboard from "./pages/MarketingDashboard";
import MarketingCampaigns from "./pages/MarketingCampaigns";
import MarketingCampaignDetail from "./pages/MarketingCampaignDetail";
import MarketingCalendar from "./pages/MarketingCalendar";
import MarketingLeads from "./pages/MarketingLeads";
import MarketingLibrary from "./pages/MarketingLibrary";

function Router() {
  return <DashboardLayout><Switch>
    <Route path="/" component={Home} />
    <Route path="/pipeline" component={PipelinePage} />
    <Route path="/deals/:id">{params => <DealDetail id={Number(params.id)} />}</Route>
    <Route path="/organisations" component={Organizations} />
    <Route path="/organisations/:id">{params => <OrganizationDetail id={Number(params.id)} />}</Route>
    <Route path="/contacts" component={Contacts} />
    <Route path="/contacts/:id">{params => <ContactDetail id={Number(params.id)} />}</Route>
    <Route path="/clients" component={CustomerSuccessDashboard} />
    <Route path="/clients/liste" component={Customers} />
    <Route path="/clients/:id">{params => <CustomerDetail id={Number(params.id)} />}</Route>
    <Route path="/support" component={SupportDashboard} />
    <Route path="/support/tickets" component={SupportTickets} />
    <Route path="/support/tickets/:id">{params => <SupportTicketDetail id={Number(params.id)} />}</Route>
    <Route path="/support/taches" component={AdminTasks} />
    <Route path="/support/factures" component={Invoices} />
    <Route path="/support/contrats" component={Contracts} />
    <Route path="/support/agenda" component={SupportCalendar} />
    <Route path="/marketing" component={MarketingDashboard} />
    <Route path="/marketing/campagnes" component={MarketingCampaigns} />
    <Route path="/marketing/campagnes/:id">{params => <MarketingCampaignDetail id={Number(params.id)} />}</Route>
    <Route path="/marketing/calendrier" component={MarketingCalendar} />
    <Route path="/marketing/leads" component={MarketingLeads} />
    <Route path="/marketing/bibliotheque" component={MarketingLibrary} />
    <Route path="/direction" component={DirectionDashboard} />
    <Route path="/direction/commercial"><DirectionReport pole="commercial" /></Route>
    <Route path="/direction/clients"><DirectionReport pole="clients" /></Route>
    <Route path="/direction/support"><DirectionReport pole="support" /></Route>
    <Route path="/direction/marketing"><DirectionReport pole="marketing" /></Route>
    <Route path="/direction/exports" component={DirectionExports} />
    <Route component={NotFound} />
  </Switch></DashboardLayout>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
