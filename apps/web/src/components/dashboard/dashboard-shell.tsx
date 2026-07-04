/*
  Provider dashboard chrome — page heading plus the tab row (reference: the
  Clerk dashboard's Applications / Settings tabs). Each dashboard page renders
  inside this shell and names the active tab.
*/

import Link from "next/link";
import type { ReactNode } from "react";

const TABS = [
  { key: "agents", label: "Agents", href: "/dashboard" },
  { key: "settings", label: "Settings", href: "/dashboard/settings" },
] as const;

export type DashboardTab = (typeof TABS)[number]["key"];

export function DashboardShell({
  active,
  children,
}: {
  active: DashboardTab;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
      <p className="eyebrow mb-2">Provider</p>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Dashboard</h1>

      {/* tab row — hairline base, solid underline on the active tab */}
      <nav className="mt-6 flex gap-6 border-b border-line">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`relative pb-3 text-sm transition-colors ${
              tab.key === active ? "text-fg" : "text-muted hover:text-fg"
            }`}
          >
            {tab.label}
            {tab.key === active && (
              <span className="absolute inset-x-0 bottom-0 h-px bg-fg" aria-hidden />
            )}
          </Link>
        ))}
      </nav>

      <div className="mt-8">{children}</div>
    </main>
  );
}
