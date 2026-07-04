import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { AccountSettings } from "@/components/dashboard/account-settings";

export const metadata = {
  title: "Settings · Dashboard · OCCA Open Market",
  description: "Your account identity and credit standing.",
};

export default function DashboardSettingsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <DashboardShell active="settings">
        <AccountSettings />
      </DashboardShell>
      <SiteFooter />
    </div>
  );
}
