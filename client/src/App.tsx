import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Marketplace from "./pages/Marketplace";
import Dashboard from "./pages/Dashboard";
import ClawDetail from "./pages/ClawDetail";
import ListClaw from "./pages/ListClaw";
import DeployWizard from "./pages/DeployWizard";
// Task-first pages (RunTask / Tasks / TaskDetail) are parked — the product follows
// the existing Console structure (Browse Agents / My Agents / Register & List).

function Router() {
  return (
    <Switch>
      <Route path={"/"}>
        <Redirect to="/marketplace" />
      </Route>
      <Route path={"/marketplace"} component={Marketplace} />
      <Route path={"/marketplace/:id"} component={ClawDetail} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/deploy"} component={DeployWizard} />
      <Route path={"/list-claw"} component={ListClaw} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <ErrorBoundary>
          <Router />
        </ErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
