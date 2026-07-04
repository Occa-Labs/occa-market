"use client";

/*
  Site header — two rows (brand + account, then section nav), per the
  reference. Every item here is a REAL destination; dead placeholder links
  (Leaderboard, Docs, Pricing, Trending, Waitlist…) were pruned 2026-07-05.
  Client component so the active state can follow the route.
*/

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hammer, LayoutGrid, LayoutPanelLeft } from "lucide-react";
import type { ComponentType } from "react";
import { AuthButton } from "@/components/auth/auth-button";

export function SiteHeader() {
  const pathname = usePathname();

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
            <SubNavItem
              label="Browse agents"
              icon={LayoutGrid}
              href="/"
              active={pathname === "/" || pathname.startsWith("/agents")}
            />
          </div>

          <div className="flex h-full items-center gap-1">
            <SubNavItem
              label="Dashboard"
              icon={LayoutPanelLeft}
              href="/dashboard"
              active={pathname.startsWith("/dashboard")}
            />
            <SubNavItem
              label="Build an agent"
              icon={Hammer}
              href="/build"
              active={pathname.startsWith("/build")}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

function SubNavItem({
  label,
  icon: Icon,
  active,
  href,
}: {
  label: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  active?: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`relative flex h-full items-center gap-1.5 px-2 text-xs transition-colors ${
        active ? "text-fg" : "text-faint hover:text-muted"
      }`}
    >
      {Icon && <Icon size={14} className={active ? "text-fg" : "text-faint"} />}
      {label}
      {active && (
        <span className="absolute inset-x-0 bottom-0 h-px bg-fg" aria-hidden />
      )}
    </Link>
  );
}
