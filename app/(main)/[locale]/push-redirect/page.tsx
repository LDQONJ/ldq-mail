"use client";

import { useEffect, Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useAccountStore } from "@/stores/account-store";

function PushRedirectLogic() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const processed = useRef(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  // Subscribe to stores to ensure we get hydrated state
  const authStore = useAuthStore();
  const accounts = useAccountStore((s) => s.accounts);

  useEffect(() => {
    if (processed.current) return;
    if (accounts.length === 0) return; // Wait for Zustand hydration
    
    processed.current = true;

    const accountLabel = searchParams.get("accountLabel");
    const serverUrl = searchParams.get("serverUrl");
    const to = searchParams.get("to") || "/";

    if (!accountLabel && !serverUrl) {
      router.replace(to as any);
      return;
    }

    let targetAccountId: string | null = null;

    // Robust matching logic to find the local account ID
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
        } catch {}

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

    const switchAndNavigate = async () => {
      if (targetAccountId && targetAccountId !== authStore.activeAccountId) {
        try {
          await authStore.switchAccount(targetAccountId);
        } catch (err) {
          console.error("Failed to switch account for push notification:", err);
        }
      }
      router.replace(to as any);
    };

    switchAndNavigate();
  }, [router, searchParams, accounts, authStore]);

  return null;
}

export default function PushRedirectPage() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
      <p className="text-muted-foreground text-sm">Switching account...</p>
      <Suspense fallback={null}>
        <PushRedirectLogic />
      </Suspense>
    </div>
  );
}
