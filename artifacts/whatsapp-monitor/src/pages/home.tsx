import { useRoute, Redirect } from "wouter";
import {
  useGetAccountStatus,
  useGetAccountQr,
  useLogoutAccount,
  useListAccounts,
  useRequestPairingCode,
  getGetAccountStatusQueryKey,
  getGetAccountQrQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  LogOut,
  QrCode,
  Smartphone,
  CheckCircle2,
  ShieldAlert,
  Plus,
  Loader2,
  Phone,
  Hash,
  RefreshCw,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
      <span className={cn("w-2 h-2 rounded-full animate-pulse", color)} />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

function PhonePairingPanel({ accountId }: { accountId: string }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const requestCode = useRequestPairingCode();

  const handleRequest = () => {
    const digits = phone.replace(/\D/g, "");
    if (!digits) return;
    requestCode.mutate(
      { accountId, data: { phoneNumber: digits } },
      { onSuccess: (d) => setCode(d.code) },
    );
  };

  if (code) {
    // Format the 8-char code as XXXX-XXXX for readability
    const formatted = code.length === 8
      ? `${code.slice(0, 4)}-${code.slice(4)}`
      : code;
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-green-500">
          <Hash className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Pairing Code</span>
        </div>
        <div className="bg-muted/60 rounded-2xl px-6 py-4 text-center">
          <p className="text-3xl font-mono font-bold tracking-widest text-foreground">{formatted}</p>
        </div>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Open WhatsApp on your phone</li>
          <li>Go to Settings → Linked Devices</li>
          <li>Tap "Link a Device" → "Link with phone number"</li>
          <li>Enter the code above</li>
        </ol>
        <button
          className="text-xs text-muted-foreground underline mt-1 self-start"
          onClick={() => setCode(null)}
        >
          Request a new code
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-primary">
        <Phone className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">Link by Phone Number</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Enter your phone number with country code (e.g. 12125551234) to get a pairing code instead of scanning.
      </p>
      <div className="flex gap-2">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="12125551234"
          className="flex-1 rounded-xl px-4 py-2.5 text-sm bg-muted/60 border border-border/50 outline-none focus:border-primary/50"
        />
        <Button
          size="sm"
          onClick={handleRequest}
          disabled={requestCode.isPending || !phone.replace(/\D/g, "")}
          className="rounded-xl shrink-0"
        >
          {requestCode.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Get Code"}
        </Button>
      </div>
      {requestCode.isError && (
        <p className="text-xs text-destructive">
          {(requestCode.error as Error)?.message ?? "Failed to get code. Make sure the account is ready."}
        </p>
      )}
    </div>
  );
}

function AccountHome({ accountId }: { accountId: string }) {
  const [linkMethod, setLinkMethod] = useState<"qr" | "phone">("qr");

  const { data: status } = useGetAccountStatus(accountId, {
    query: {
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
      enabled: status?.state === "QR_READY" && linkMethod === "qr",
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

  // If a pairing code is already active from a previous request, show it
  const activePairingCode = status?.pairingCode;

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      {/* Status banner */}
      <div className="mx-4 mt-5 rounded-2xl bg-card border border-border/60 p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</span>
          <StatusPill state={state} />
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {isInitializing && "Starting headless browser — this takes ~20 seconds…"}
          {isQr && !activePairingCode && "Choose how to link your WhatsApp below."}
          {isQr && activePairingCode && "Enter the pairing code in WhatsApp on your phone."}
          {isAuth && "Session authenticated, loading chats…"}
          {isReady && `Monitoring ${status?.displayName ?? ""}${status?.phoneNumber ? ` (+${status.phoneNumber})` : ""}`}
          {state === "DISCONNECTED" && "Session lost. Tap Reconnect to re-link."}
        </p>
      </div>

      {/* Spinner while initialising / authenticating */}
      {(isInitializing || isAuth) && (
        <div className="flex flex-col items-center justify-center gap-3 mt-10">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">
            {isAuth ? "Finalising session…" : "Launching WhatsApp Web…"}
          </p>
        </div>
      )}

      {/* Linking section — shown when QR_READY */}
      {isQr && (
        <div className="mx-4 mt-4 rounded-2xl bg-card border border-border/60 p-5 flex flex-col gap-4">
          {/* Tab switcher */}
          <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
            <button
              onClick={() => setLinkMethod("qr")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
                linkMethod === "qr"
                  ? "bg-card shadow text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <QrCode className="w-3.5 h-3.5" />
              QR Code
            </button>
            <button
              onClick={() => setLinkMethod("phone")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all",
                linkMethod === "phone"
                  ? "bg-card shadow text-foreground"
                  : "text-muted-foreground",
              )}
            >
              <Phone className="w-3.5 h-3.5" />
              Phone Number
            </button>
          </div>

          {/* QR panel */}
          {linkMethod === "qr" && (
            <div className="flex flex-col items-center gap-4">
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
                <li>Tap "Link a Device" and scan above</li>
              </ol>
            </div>
          )}

          {/* Phone pairing panel */}
          {linkMethod === "phone" && (
            <PhonePairingPanel accountId={accountId} />
          )}
        </div>
      )}

      {/* Show active pairing code from status if available */}
      {isQr && activePairingCode && linkMethod === "qr" && (
        <div className="mx-4 mt-3 rounded-2xl bg-primary/10 border border-primary/20 p-4">
          <p className="text-xs text-primary font-semibold mb-1">Active Pairing Code</p>
          <p className="text-2xl font-mono font-bold tracking-widest text-foreground">
            {activePairingCode.length === 8
              ? `${activePairingCode.slice(0, 4)}-${activePairingCode.slice(4)}`
              : activePairingCode}
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

      {/* Disconnected — reconnect */}
      {state === "DISCONNECTED" && (
        <div className="mx-4 mt-4 space-y-3">
          <div className="flex items-center gap-3 px-4 py-4 rounded-2xl bg-destructive/10 border border-destructive/20">
            <ShieldAlert className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">Session lost</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Auto-reconnect is active. You can also reconnect manually below.
              </p>
            </div>
          </div>
          <button
            className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl bg-card border border-border/60 text-sm font-medium active:bg-muted transition-colors"
            onClick={() => logout.mutate({ accountId })}
            disabled={logout.isPending}
          >
            {logout.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <RefreshCw className="w-4 h-4" />}
            Reconnect (re-scan QR or use phone number)
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
