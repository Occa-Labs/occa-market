"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

/*
  The provider's way into the edit wizard, on the agent detail page. Shown to
  any signed-in user for now — agents don't carry an owner yet; owner-scoping
  arrives with the ledger work.
*/
export function EditAgentLink({ agentId }: { agentId: string }) {
  const { status } = useAuth();
  if (status !== "authenticated") return null;
  return (
    <Link
      href={`/agents/${agentId}/edit`}
      className="mt-3 inline-flex items-center gap-1.5 font-mono text-xs text-faint transition-colors hover:text-fg"
    >
      <Pencil size={11} />
      Edit agent
    </Link>
  );
}
