"use client";

/*
  Holder standing hook — one fetch per mount once the session is live, plus a
  force-refresh for the "I just bought" button. Standing is null while loading
  or signed out; callers treat null as "don't gate, don't render the meter".
*/

import { useCallback, useEffect, useState } from "react";
import type { TokenStanding } from "@occa-market/shared";
import { getTokenStanding, refreshTokenStanding } from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";

export function useTokenStanding() {
  const { status } = useAuth();
  const [standing, setStanding] = useState<TokenStanding | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      setStanding(null);
      return;
    }
    let active = true;
    void getTokenStanding().then((s) => {
      if (active && s) setStanding(s);
    });
    return () => {
      active = false;
    };
  }, [status]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const s = await refreshTokenStanding();
      if (s) setStanding(s);
    } finally {
      setRefreshing(false);
    }
  }, []);

  return { standing, setStanding, refresh, refreshing };
}
