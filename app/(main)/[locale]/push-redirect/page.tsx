"use client";

import { useEffect, Suspense, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useAccountStore } from "@/stores/account-store";
import { toRouterPath } from "@/lib/browser-navigation";

function PushRedirectLogic() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const processed = useRef(false);

  // Subscribe to stores to ensure we get hydrated state
  const authStore = useAuthStore();
  const accounts = useAccountStore((s) => s.accounts);

  useEffect(() => {
    if (processed.current) return;

    // Helper to safely clean destination URL and strip any slot/owner params
    const cleanDestination = (targetUrl: string | null) => {
      const raw = targetUrl || "/";
      try {
        const parsed = new URL(raw, "http://localhost");
        parsed.searchParams.delete("slot");
        parsed.searchParams.delete("owner");
        const path = parsed.pathname + (parsed.search ? parsed.search : "") + parsed.hash;
        return toRouterPath(path);
      } catch {
        return toRouterPath(raw.replace(/[?&](slot|owner)=[^&#]*/g, ""));
      }
    };

    const accountLabel = searchParams.get("accountLabel");
    const serverUrl = searchParams.get("serverUrl");
    const slotParam = searchParams.get("slot");
    const accountIdParam = searchParams.get("accountId");
    const toParam = searchParams.get("to");
    const cleanTo = cleanDestination(toParam);

    // Wait for hydration if accounts is empty and hydration hasn't completed
    const hasHydrated = useAccountStore.persist?.hasHydrated?.() ?? true;
    if (accounts.length === 0 && !hasHydrated) {
      // Fallback timeout to prevent permanent hanging
      const timer = setTimeout(() => {
        if (!processed.current) {
          processed.current = true;
          router.replace(cleanTo as any);
        }
      }, 2500);
      return () => clearTimeout(timer);
    }

    processed.current = true;

    // If no account criteria were provided, redirect immediately
    if (!accountLabel && !serverUrl && !slotParam && !accountIdParam) {
      router.replace(cleanTo as any);
      return;
    }

    let targetAccountId: string | null = null;

    // 1. Try matching by serverUrl and accountLabel
    if (serverUrl || accountLabel) {
      for (const account of accounts) {
        let serverMatch = true;
        if (serverUrl) {
          const normalizedTargetServer = serverUrl.replace(/\/+$/, '').toLowerCase();
          const normalizedAccServer = account.serverUrl.replace(/\/+$/, '').toLowerCase();
          try {
            const targetHost = new URL(normalizedTargetServer).hostname;
            const accHost = new URL(normalizedAccServer).hostname;
            if (targetHost !== accHost) serverMatch = false;
          } catch {
            if (normalizedTargetServer !== normalizedAccServer) serverMatch = false;
          }
        }

        let labelMatch = true;
        if (accountLabel && serverMatch) {
          const normalizedLabel = accountLabel.toLowerCase().trim();
          const labelUser = normalizedLabel.split('@')[0];
          const labelDomain = normalizedLabel.split('@')[1];

          const ctxUsername = account.username.toLowerCase().trim();
          const ctxUser = ctxUsername.split('@')[0];
          const ctxDomain = ctxUsername.split('@')[1];

          let ctxServerHostname = "";
          try {
            ctxServerHostname = new URL(account.serverUrl).hostname.toLowerCase();
          } catch {
            // ignore invalid URL
          }

          if (labelDomain) {
            const domainMatches = (ctxDomain && ctxDomain === labelDomain) || ctxServerHostname.includes(labelDomain);
            if (!domainMatches) labelMatch = false;
          }
          if (labelUser && labelUser !== ctxUser && ctxUsername !== normalizedLabel) {
            labelMatch = false;
          }
        }

        if (serverMatch && labelMatch) {
          targetAccountId = account.id;
          break;
        }
      }
    }

    // 2. Fallback: match by cookieSlot if provided
    if (!targetAccountId && slotParam !== null && slotParam !== "") {
      const slotNum = Number(slotParam);
      if (Number.isInteger(slotNum)) {
        const matched = accounts.find((a) => a.cookieSlot === slotNum);
        if (matched) {
          targetAccountId = matched.id;
        }
      }
    }

    // 3. Fallback: match by accountIdParam or serverIdentifiers
    if (!targetAccountId && accountIdParam) {
      const matched = accounts.find((a) =>
        a.id === accountIdParam ||
        a.serverIdentifiers?.includes(accountIdParam)
      );
      if (matched) {
        targetAccountId = matched.id;
      }
    }

    const switchAndNavigate = async () => {
      if (targetAccountId && targetAccountId !== authStore.activeAccountId) {
        try {
          await authStore.switchAccount(targetAccountId);
        } catch (err) {
          console.error("Failed to switch account for push notification:", err);
        }
      }
      router.replace(cleanTo as any);
    };

    switchAndNavigate();
  }, [router, searchParams, accounts, authStore]);

  return null;
}

export default function PushRedirectPage() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
      <p className="text-muted-foreground text-sm">正在切换账户...</p>
      <Suspense fallback={null}>
        <PushRedirectLogic />
      </Suspense>
    </div>
  );
}
