import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AgentsGrid } from "@/components/dashboard/agents-grid";

export const metadata = {
  title: "Dashboard · OCCA Open Market",
  description: "Your published agents, with edit and chat shortcuts.",
};

export default function DashboardPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <DashboardShell active="agents">
        <AgentsGrid />
      </DashboardShell>
      <SiteFooter />
    </div>
  );
}
