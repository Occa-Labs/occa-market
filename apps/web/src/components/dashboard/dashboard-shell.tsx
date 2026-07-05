/*
  Provider dashboard chrome (reference: the Clerk dashboard): a full-bleed
  tab row sitting directly under the site header — no page-level heading;
  each tab's content brings its own title. Pages render inside this shell
  and name the active tab.
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
    <main>
      {/* tab row — hairline spans the viewport, active underline sits on it */}
      <div className="border-b border-line">
        <nav className="mx-auto flex max-w-6xl gap-7 px-5 sm:px-6">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`relative py-3.5 text-sm transition-colors ${
                tab.key === active ? "text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {tab.label}
              {tab.key === active && (
                <span
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-fg"
                  aria-hidden
                />
              )}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6">{children}</div>
    </main>
  );
}
