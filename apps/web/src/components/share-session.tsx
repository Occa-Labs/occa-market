"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatSession, MarketAgent } from "@occa-market/shared";
import { shareChatSession, unshareChatSession } from "@/lib/api";

/*
  Share popover for the active chat session. Minting a link makes the session
  publicly readable at /share/<shareId>; the X button opens a prefilled post
  with that link. Turning it off discards the handle, so old links die.
*/
export function ShareSession({
  agent,
  session,
  onChange,
}: {
  agent: MarketAgent;
  session: ChatSession;
  onChange: (shareId: string | undefined) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = session.shareId
    ? `${window.location.origin}/share/${session.shareId}`
    : null;

  const postText = `A conversation with ${agent.name} on OCCA Open Market.`;
  const intentUrl = shareUrl
    ? `https://x.com/intent/post?text=${encodeURIComponent(postText)}&url=${encodeURIComponent(shareUrl)}`
    : null;

  async function create() {
    setBusy(true);
    const shareId = await shareChatSession(agent.id, session.id);
    setBusy(false);
    if (shareId) onChange(shareId);
  }

  async function revoke() {
    setBusy(true);
    const ok = await unshareChatSession(agent.id, session.id);
    setBusy(false);
    if (ok) onChange(undefined);
  }

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — selecting the link still works */
    }
  }

  return (
    <Popover.Root>
      <Popover.Trigger className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 font-mono text-xs text-muted transition-colors hover:border-line-strong hover:text-fg data-[popup-open]:border-line-strong data-[popup-open]:text-fg">
        <Share2 size={12} />
        Share
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          {/* surface-card on the Popup (inner), not the Positioner — its
              position:relative must not clobber the positioner. */}
          <Popover.Popup className="surface-card w-80 rounded-xl p-4 outline-none">
            <p className="eyebrow mb-2">Share session</p>
            <p className="font-body text-[13px] leading-relaxed text-muted">
              Anyone with the link can read this conversation. It stays
              read-only and shows no account details.
            </p>

            {shareUrl ? (
              <>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2">
                  <p className="min-w-0 flex-1 select-all truncate font-mono text-xs text-fg">
                    {shareUrl}
                  </p>
                  <button
                    type="button"
                    aria-label="Copy link"
                    onClick={() => void copy()}
                    className="cursor-pointer text-faint transition-colors hover:text-fg"
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  {intentUrl && (
                    <Button size="sm" href={intentUrl} target="_blank" rel="noopener">
                      Post on X
                    </Button>
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void revoke()}
                    className="cursor-pointer font-body text-xs text-faint transition-colors hover:text-bad disabled:opacity-50"
                  >
                    Make private
                  </button>
                </div>
              </>
            ) : (
              <Button
                size="sm"
                className="mt-3"
                disabled={busy}
                onClick={() => void create()}
              >
                {busy ? "…" : "Create share link"}
              </Button>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
