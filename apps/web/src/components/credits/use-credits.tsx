"use client";

/*
  Credit balance hook — one fetch per mount once the session is live. Credits
  are null while loading or signed out; callers treat null as "don't render
  the balance, don't offer the paid path".
*/

import { useEffect, useState } from "react";
import type { CreditsSummary } from "@occa-market/shared";
import { getCredits } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";

export function useCredits() {
  const { status } = useAuth();
  const [credits, setCredits] = useState<CreditsSummary | null>(null);

  useEffect(() => {
    if (status !== "authenticated") {
      setCredits(null);
      return;
    }
    let active = true;
    void getCredits().then((c) => {
      if (active && c) setCredits(c);
    });
    return () => {
      active = false;
    };
  }, [status]);

  return { credits, setCredits };
}
