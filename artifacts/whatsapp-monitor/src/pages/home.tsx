import { useRoute, Redirect } from "wouter";
import {
  useGetAccountStatus,
  useGetAccountQr,
  useLogoutAccount,
  useListAccounts,
  getGetAccountStatusQueryKey,
  getGetAccountQrQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { LogOut, QrCode, Smartphone, CheckCircle2, ShieldAlert, Plus, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

function StatusPill({ state }: { state: string }) {
  const map: Record<string, { color: string; label: string }> = {
    READY: { color: "bg-green-500", label: "Connected" },
    QR_READY: { color: "bg-yellow-500", label: "Scan QR" },
    AUTHENTICATED: { color: "bg-blue-500", label: "Authenticating" },
    INITIALIZING: { color: "bg-muted-foreground", label: "Starting" },
    DISCONNECTED: { color: "bg-destructive", label: "Disconnected" },
  };
  const { color, label } = map[state] ?? { color: "bg-muted-foreground", label: state };
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("w-2 h-2 rounded-full", color)} />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

function AccountHome({ accountId }: { accountId: string }) {
  const { data: status } = useGetAccountStatus(accountId, {
    query: {
      // Poll fast while booting/authenticating, slower once stable
      refetchInterval: (q) => {
        const s = q.state.data?.state;
        if (s === "READY" || s === "DISCONNECTED") return 8000;
        return 2000;
      },
      queryKey: getGetAccountStatusQueryKey(accountId),
    },
  });

  const { data: qrData } = useGetAccountQr(accountId, {
    query: {
      enabled: status?.state === "QR_READY",
      queryKey: getGetAccountQrQueryKey(accountId),
      refetchInterval: 20000,
    },
  });

  const logout = useLogoutAccount();

  const state = status?.state ?? "INITIALIZING";
  const isReady = state === "READY";
  const isQr = state === "QR_READY";
  const isAuth = state === "AUTHENTICATED";
  const isInitializing = state === "INITIALIZING";

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      {/* Status banner */}
      <div className="mx-4 mt-5 rounded-2xl bg-card border border-border/60 p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</span>
          <StatusPill state={state} />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {isInitializing && "Starting headless browser…"}
          {isQr && "Open WhatsApp → Linked Devices → scan the code below."}
          {isAuth && "Session authenticated, loading chats…"}
          {isReady && `Monitoring ${status?.displayName ?? ""}${status?.phoneNumber ? ` (+${status.phoneNumber})` : ""}`}
          {state === "DISCONNECTED" && "Session ended. Tap Reconnect to restart."}
        </p>
      </div>

      {/* QR block */}
      {isQr && (
        <div className="flex flex-col items-center mx-4 mt-4 rounded-2xl bg-card border border-border/60 p-6 gap-4">
          <div className="flex items-center gap-2 text-yellow-500 self-start">
            <QrCode className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">QR Code</span>
          </div>
          {qrData?.qrDataUrl ? (
            <img
              src={qrData.qrDataUrl}
              alt="WhatsApp QR"
              className="w-52 h-52 rounded-xl bg-white p-2"
            />
          ) : (
            <div className="w-52 h-52 rounded-xl bg-muted flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          )}
          <ol className="text-xs text-muted-foreground space-y-1 self-start list-decimal list-inside">
            <li>Open WhatsApp on your phone</li>
            <li>Go to Settings → Linked Devices</li>
            <li>Tap "Link a Device" and scan</li>
          </ol>
        </div>
      )}

      {/* Spinner for init / auth */}
      {(isInitializing || isAuth) && (
        <div className="flex flex-col items-center justify-center gap-3 mt-10">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">
            {isAuth ? "Finalising session…" : "Launching WhatsApp…"}
          </p>
        </div>
      )}

      {/* Ready actions */}
      {isReady && (
        <div className="mx-4 mt-4 space-y-3">
          <Link href={`/accounts/${accountId}/chats`}>
            <div className="flex items-center justify-between px-4 py-4 rounded-2xl bg-primary/10 border border-primary/20 cursor-pointer active:scale-[0.98] transition-transform">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                <span className="font-medium text-sm text-primary">View Chats</span>
              </div>
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
          </Link>

          <button
            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl bg-card border border-border/60 text-sm text-muted-foreground active:bg-muted transition-colors"
            onClick={() => logout.mutate({ accountId })}
            disabled={logout.isPending}
          >
            {logout.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <LogOut className="w-4 h-4" />}
            Disconnect account
          </button>
        </div>
      )}

      {state === "DISCONNECTED" && (
        <div className="mx-4 mt-4 space-y-3">
          <div className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-destructive/10 border border-destructive/20">
            <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Session lost</p>
              <p className="text-xs text-muted-foreground mt-0.5">Tap Reconnect to re-link this account.</p>
            </div>
          </div>
          <button
            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl bg-card border border-border/60 text-sm font-medium active:bg-muted transition-colors"
            onClick={() => logout.mutate({ accountId })}
            disabled={logout.isPending}
          >
            {logout.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <QrCode className="w-4 h-4" />}
            Reconnect (re-scan QR)
          </button>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [, accountParams] = useRoute("/accounts/:accountId");
  const accountId = accountParams?.accountId;
  const { data: accounts, isLoading } = useListAccounts();

  if (accountId) return <AccountHome accountId={accountId} />;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (accounts && accounts.length > 0) {
    return <Redirect to={`/accounts/${accounts[0].id}`} />;
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center">
        <Smartphone className="w-10 h-10 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-bold">No accounts linked</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tap the button above to add a WhatsApp account and start monitoring.
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
        <Plus className="w-3 h-3" />
        <span>Use the account switcher at the top right</span>
      </div>
    </div>
  );
}
