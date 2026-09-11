import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import ContactDetail from "./pages/ContactDetail";
import Contacts from "./pages/Contacts";
import DealDetail from "./pages/DealDetail";
import Home from "./pages/Home";
import OrganizationDetail from "./pages/OrganizationDetail";
import Organizations from "./pages/Organizations";
import PipelinePage from "./pages/Pipeline";

function Router() {
  return <DashboardLayout><Switch>
    <Route path="/" component={Home} />
    <Route path="/pipeline" component={PipelinePage} />
    <Route path="/deals/:id">{params => <DealDetail id={Number(params.id)} />}</Route>
    <Route path="/organisations" component={Organizations} />
    <Route path="/organisations/:id">{params => <OrganizationDetail id={Number(params.id)} />}</Route>
    <Route path="/contacts" component={Contacts} />
    <Route path="/contacts/:id">{params => <ContactDetail id={Number(params.id)} />}</Route>
    <Route component={NotFound} />
  </Switch></DashboardLayout>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
