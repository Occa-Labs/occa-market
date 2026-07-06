"use client";

/*
  Site header — two rows (brand + account, then section nav), per the
  reference. Every item here is a REAL destination; dead placeholder links
  (Leaderboard, Docs, Pricing, Trending, Waitlist…) were pruned 2026-07-05.
  Client component so the active state can follow the route.

  On mobile the section nav keeps only Browse agents inline; the rest live
  in a hamburger-opened side drawer (the row wrapped to two lines otherwise).
*/

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hammer, History, LayoutGrid, LayoutPanelLeft, Menu, X } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { AuthButton } from "@/components/auth/auth-button";

type NavIcon = ComponentType<{ size?: number; className?: string }>;

type NavItem = {
  label: string;
  icon: NavIcon;
  href: string;
  isActive: (pathname: string) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Browse agents",
    icon: LayoutGrid,
    href: "/",
    isActive: (p) => p === "/" || p.startsWith("/agents"),
  },
  {
    label: "History",
    icon: History,
    href: "/history",
    isActive: (p) => p.startsWith("/history"),
  },
  {
    label: "Dashboard",
    icon: LayoutPanelLeft,
    href: "/dashboard",
    isActive: (p) => p.startsWith("/dashboard"),
  },
  {
    label: "Build an agent",
    icon: Hammer,
    href: "/build",
    isActive: (p) => p.startsWith("/build"),
  },
];

const [browseItem, ...drawerItems] = NAV_ITEMS;

export function SiteHeader() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The drawer never outlives a navigation or an Escape press.
  useEffect(() => setDrawerOpen(false), [pathname]);
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <header className="sticky top-0 z-30 px-4 pt-3">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-line shadow-[inset_0_1px_0_var(--color-highlight),0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-md">
        {/* Row 1 — brand + account (dark section) */}
        <div className="flex h-14 items-center justify-between bg-[#0d0d10]/85 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/occa-mark.svg" alt="OCCA" width={22} height={22} />
            <span className="text-sm font-semibold tracking-tight text-fg">
              Open Market
            </span>
            <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-muted">
              beta
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <AuthButton />
          </div>
        </div>

        {/* hairline divider spanning the full bar */}
        <div className="h-px w-full bg-line" />

        {/* Row 2 — section nav with icons + active state (#212126 section) */}
        <div className="flex h-11 items-center justify-between bg-surface px-4">
          <div className="flex h-full items-center gap-1">
            <SubNavItem item={browseItem} active={browseItem.isActive(pathname)} />
            <span className="hidden h-full sm:flex">
              <SubNavItem
                item={NAV_ITEMS[1]}
                active={NAV_ITEMS[1].isActive(pathname)}
              />
            </span>
          </div>

          <div className="hidden h-full items-center gap-1 sm:flex">
            {NAV_ITEMS.slice(2).map((item) => (
              <SubNavItem key={item.href} item={item} active={item.isActive(pathname)} />
            ))}
          </div>

          {/* Mobile: everything except Browse lives in the drawer */}
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            className="flex h-full items-center px-2 text-faint transition-colors hover:text-muted sm:hidden"
          >
            <Menu size={16} />
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 right-0 flex w-64 flex-col border-l border-line bg-[#0d0d10]/95 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between pb-4">
              <span className="eyebrow">Menu</span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setDrawerOpen(false)}
                className="text-faint transition-colors hover:text-fg"
              >
                <X size={16} />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {drawerItems.map((item) => {
                const active = item.isActive(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-white/[0.04] text-fg"
                        : "text-muted hover:bg-white/[0.03] hover:text-fg"
                    }`}
                  >
                    <item.icon size={15} className={active ? "text-fg" : "text-faint"} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}
    </header>
  );
}

function SubNavItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`relative flex h-full items-center gap-1.5 whitespace-nowrap px-2 text-xs transition-colors ${
        active ? "text-fg" : "text-faint hover:text-muted"
      }`}
    >
      <Icon size={14} className={active ? "text-fg" : "text-faint"} />
      {item.label}
      {active && (
        <span className="absolute inset-x-0 bottom-0 h-px bg-fg" aria-hidden />
      )}
    </Link>
  );
}
