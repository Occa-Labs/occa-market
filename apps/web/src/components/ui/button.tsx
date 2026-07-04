import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
  Button — the default action style, analysed from Clerk's dark-mode button.
  default: dark gray (#42434d) with a top sheen, a 0.5px ring, an inset top
  highlight, and a soft drop shadow. `withArrow` adds the looping chevron
  (one slides out right, a fresh one slides in from the left) on hover.
  See CLAUDE.md → Components.
*/

type Variant = "default" | "secondary" | "light";
type Size = "sm" | "md" | "lg";

const base =
  "group relative isolate inline-flex cursor-pointer items-center justify-center overflow-hidden rounded-md font-medium transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] disabled:cursor-not-allowed disabled:opacity-50";

const variants: Record<Variant, string> = {
  default:
    "text-fg [background:linear-gradient(180deg,rgba(255,255,255,0.04)_45%,rgba(255,255,255,0)_55%),#42434d] shadow-[0_2px_3px_-1px_rgba(0,0,0,0.08),0_0_0_0.5px_rgba(247,247,248,0.10),0_1px_0_0_rgba(255,255,255,0.10)_inset] hover:[background:linear-gradient(180deg,rgba(255,255,255,0.06)_45%,rgba(255,255,255,0)_55%),#4a4b56]",
  secondary:
    "border border-white/25 bg-transparent text-fg hover:border-white/40 hover:bg-white/[0.04]",
  light:
    "bg-[#e4e4e7] text-bg shadow-[0_1px_2px_rgba(0,0,0,0.4)] hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

function ArrowCycle() {
  const path = "m7.25 5-3.5-2.25v4.5L7.25 5Z";
  return (
    <>
      <svg
        viewBox="0 0 10 10"
        aria-hidden="true"
        className="ml-2 h-2.5 w-2.5 flex-none opacity-60 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] group-hover:translate-x-6 group-hover:opacity-0"
      >
        <path
          fill="currentColor"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d={path}
        />
      </svg>
      <svg
        viewBox="0 0 10 10"
        aria-hidden="true"
        className="-ml-2.5 h-2.5 w-2.5 flex-none -translate-x-2 opacity-0 transition duration-300 ease-[cubic-bezier(0.4,0.36,0,1)] group-hover:translate-x-0 group-hover:opacity-100"
      >
        <path
          fill="currentColor"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d={path}
        />
      </svg>
    </>
  );
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  variant?: Variant;
  size?: Size;
  withArrow?: boolean;
  href?: string;
  target?: string;
  rel?: string;
  children: ReactNode;
};

export function Button({
  variant = "default",
  size = "md",
  withArrow = false,
  href,
  target,
  rel,
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);
  const content = (
    <>
      {children}
      {withArrow && <ArrowCycle />}
    </>
  );

  if (href) {
    return (
      <a href={href} target={target} rel={rel} className={classes}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" className={classes} {...rest}>
      {content}
    </button>
  );
}
