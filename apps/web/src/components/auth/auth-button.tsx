"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Bot, Check, Copy, LogOut } from "lucide-react";
import { LiquidMetalButton } from "@/components/ui/liquid-metal-button";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";

function shorten(address: string): string {
  return address.length > 10
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address;
}

/** iro*****er@gmail.com — enough to recognize yourself, not enough to leak. */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 2) return email;
  const local = email.slice(0, at);
  const tail = local.length > 5 ? local.slice(-2) : "";
  return `${local.slice(0, 2)}*****${tail}${email.slice(at)}`;
}

/*
  The signed-in wallet pill. Clicking it opens the account popover: the full
  address (selectable), a copy action, and the signed-in email when present.
  Sign-out stays outside as its own button.
*/
function AccountPill({
  walletAddress,
  email,
}: {
  walletAddress: string;
  email: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — selecting the address still works */
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger className="cursor-pointer rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-fg transition-colors hover:border-line-strong data-[popup-open]:border-line-strong">
        {shorten(walletAddress)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          {/* surface-card on the Popup (inner), not the Positioner — its
              position:relative must not clobber the positioner (see memory). */}
          <Popover.Popup className="surface-card w-72 rounded-xl p-4 outline-none">
            <p className="eyebrow mb-2">Solana wallet</p>
            <p className="select-all break-all font-mono text-xs leading-relaxed text-fg">
              {walletAddress}
            </p>
            {email && (
              <p className="mt-2 font-mono text-xs text-faint">
                Signed in as <span className="text-muted">{maskEmail(email)}</span>
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={copy}>
                {copied ? (
                  <>
                    <Check size={13} className="mr-1.5 text-accent" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={13} className="mr-1.5" />
                    Copy address
                  </>
                )}
              </Button>
              <Button variant="secondary" size="sm" href="/my-agents">
                <Bot size={13} className="mr-1.5" />
                My agents
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function AuthButton() {
  const { user, status, signIn, signOut } = useAuth();

  if (status === "authenticated" && user) {
    return (
      <div className="flex items-center gap-2">
        {user.walletAddress ? (
          <AccountPill
            walletAddress={user.walletAddress}
            email={user.email ?? null}
          />
        ) : (
          <span className="rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-fg">
            {user.email ?? "Account"}
          </span>
        )}
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-faint transition-colors hover:border-line-strong hover:text-fg"
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  return <LiquidMetalButton label="Sign in" onClick={signIn} />;
}
