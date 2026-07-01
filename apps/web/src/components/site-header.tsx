import {
  ChevronDown,
  Clock,
  LayoutGrid,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import type { ComponentType } from "react";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 px-4 pt-3">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl border border-line shadow-[inset_0_1px_0_var(--color-highlight),0_10px_30px_rgba(0,0,0,0.4)] backdrop-blur-md">
        {/* Row 1 — brand + primary nav (dark section) */}
        <div className="flex h-14 items-center justify-between bg-[#0d0d10]/85 px-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/occa-mark.svg" alt="OCCA" width={22} height={22} />
              <span className="text-sm font-semibold tracking-tight text-fg">
                Open Market
              </span>
            </div>

            <span className="hidden h-5 w-px bg-line-strong md:block" aria-hidden />

            <nav className="hidden items-center gap-6 md:flex">
              <NavItem label="Agents" hasMenu />
              <NavItem label="Leaderboard" />
              <NavItem label="Providers" hasMenu />
              <NavItem label="Docs" />
              <NavItem label="Pricing" />
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <LiquidMetalButton label="Sign in" />
          </div>
        </div>

        {/* hairline divider spanning the full bar */}
        <div className="h-px w-full bg-line" />

        {/* Row 2 — sub-nav with icons + active state (#212126 section) */}
        <div className="flex h-11 items-center justify-between bg-surface px-4">
          <div className="flex h-full items-center gap-1">
            <SubNavItem label="Browse agents" icon={LayoutGrid} active />
            <SubNavItem label="Trending" icon={TrendingUp} />
            <SubNavItem label="New" icon={Clock} />
          </div>

          <div className="hidden h-full items-center gap-1 sm:flex">
            <SubNavItem label="Build an agent" href="/build" small />
            <span className="mx-2 h-4 w-px bg-line-strong" aria-hidden />
            <SubNavItem label="Waitlist" icon={Sparkles} small />
          </div>
        </div>
      </div>
    </header>
  );
}

function NavItem({ label, hasMenu }: { label: string; hasMenu?: boolean }) {
  return (
    <a
      href="#"
      className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-fg"
    >
      {label}
      {hasMenu && <ChevronDown size={14} className="text-faint" />}
    </a>
  );
}

function SubNavItem({
  label,
  icon: Icon,
  hasMenu,
  active,
  href = "#",
}: {
  label: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  hasMenu?: boolean;
  active?: boolean;
  href?: string;
  small?: boolean;
}) {
  return (
    <a
      href={href}
      className={`relative flex h-full items-center gap-1.5 px-2 text-xs transition-colors ${
        active ? "text-fg" : "text-faint hover:text-muted"
      }`}
    >
      {Icon && <Icon size={14} className={active ? "text-fg" : "text-faint"} />}
      {label}
      {hasMenu && <ChevronDown size={13} className="text-faint" />}
      {active && (
        <span
          className="absolute inset-x-0 bottom-0 h-px bg-fg"
          aria-hidden
        />
      )}
    </a>
  );
}
