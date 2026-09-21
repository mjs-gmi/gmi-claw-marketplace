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
import Plans from "./pages/Plans";
import UsageBilling from "./pages/UsageBilling";
// Task-first pages (RunTask / Tasks / TaskDetail) are parked — the product follows
// the existing Console structure (Browse Agents / My Agents / Register Template).

function Router() {
  return (
    <Switch>
      <Route path={"/"}>
        <Redirect to="/marketplace" />
      </Route>
      <Route path={"/marketplace"} component={Marketplace} />
      <Route path={"/marketplace/:id"} component={ClawDetail} />
      <Route path={"/dashboard"} component={Dashboard} />
      {/* A sandbox detail is its own place — linkable, bookmarkable, and the
          back button works. Mirrors /sandboxes/[id]/<tab> elsewhere. */}
      <Route path={"/dashboard/sandbox/:sandboxId/:tab?"} component={Dashboard} />
      <Route path={"/plans"} component={Plans} />
      <Route path={"/deploy"} component={DeployWizard} />
      <Route path={"/list-claw"} component={ListClaw} />
      {/* Settings › Usage & Billing. The agent drill-down is its own URL so a
          cost someone is questioning can be linked to directly. */}
      <Route path={"/settings/usage"} component={UsageBilling} />
      <Route path={"/settings/usage/agentbox/:agentId"} component={UsageBilling} />
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
