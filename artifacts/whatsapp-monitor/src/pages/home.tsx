import { useRoute, Redirect } from "wouter";
import { useGetAccountStatus, useGetAccountQr, useLogoutAccount, getGetAccountStatusQueryKey, getGetAccountQrQueryKey, useListAccounts } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, QrCode, Smartphone, CheckCircle2, ShieldAlert, Plus } from "lucide-react";
import { Link } from "wouter";

function AccountHome({ accountId }: { accountId: string }) {
  const { data: status, isLoading } = useGetAccountStatus(accountId, {
    query: {
      refetchInterval: 5000,
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

  const handleDisconnect = () => {
    logout.mutate({ accountId });
  };

  const isReady = status?.state === "READY";
  const isQr = status?.state === "QR_READY";
  const isAuth = status?.state === "AUTHENTICATED";
  const isDisconnected = status?.state === "DISCONNECTED";
  const isInitializing = !status || status.state === "INITIALIZING";

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-8 py-6 border-b border-border shrink-0">
        <h1 className="text-2xl font-mono font-bold">Connection Status</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your WhatsApp session lifecycle.
        </p>
      </div>

      <div className="p-8 max-w-2xl">
        <Card className="border-border/60 bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              {isLoading ? (
                <Skeleton className="w-5 h-5 rounded-full" />
              ) : isReady ? (
                <CheckCircle2 className="w-5 h-5 text-primary" />
              ) : isQr || isAuth ? (
                <QrCode className="w-5 h-5 text-yellow-500" />
              ) : isDisconnected ? (
                <ShieldAlert className="w-5 h-5 text-destructive" />
              ) : (
                <Smartphone className="w-5 h-5 text-muted-foreground" />
              )}
              {isLoading ? (
                <Skeleton className="h-5 w-32" />
              ) : (
                <CardTitle className="font-mono text-base">
                  {status?.state ?? "INITIALIZING"}
                </CardTitle>
              )}
            </div>
            <CardDescription className="mt-1">
              {isInitializing && "Starting up the headless client..."}
              {isQr && "Scan the QR code below with your WhatsApp app to authenticate."}
              {isAuth && "Authentication confirmed. Setting up your session..."}
              {isReady && `Connected${status?.displayName ? ` as ${status.displayName}` : ""}${status?.phoneNumber ? ` (+${status.phoneNumber})` : ""}.`}
              {isDisconnected && "Your session was disconnected. Refresh to reconnect."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {isQr && qrData?.qrDataUrl && (
              <div className="flex flex-col items-center gap-4 p-6 rounded-lg bg-background/50 border border-border/50">
                <img
                  src={qrData.qrDataUrl}
                  alt="WhatsApp QR Code"
                  className="w-56 h-56 rounded-lg"
                />
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground font-mono">1. Open WhatsApp on your phone</p>
                  <p className="text-xs text-muted-foreground font-mono">2. Tap Menu or Settings and select Linked Devices</p>
                  <p className="text-xs text-muted-foreground font-mono">3. Point your phone to this screen to capture the code</p>
                </div>
              </div>
            )}

            {(isInitializing || isAuth) && (
              <div className="flex flex-col items-center gap-3 py-8">
                <div className="w-10 h-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground font-mono">
                  {isAuth ? "Finalizing session..." : "Awaiting session readiness..."}
                </p>
              </div>
            )}

            {isReady && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link href={`/accounts/${accountId}/chats`}>
                    <Button variant="secondary" className="font-mono gap-2">
                      <Smartphone className="w-4 h-4" />
                      View Chats
                    </Button>
                  </Link>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground hover:text-destructive font-mono"
                  onClick={handleDisconnect}
                  disabled={logout.isPending}
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Home() {
  const [, accountParams] = useRoute("/accounts/:accountId");
  const accountId = accountParams?.accountId;
  const { data: accounts, isLoading } = useListAccounts();

  if (accountId) {
    return <AccountHome accountId={accountId} />;
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 text-muted-foreground">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="font-mono text-sm">Loading accounts...</p>
      </div>
    );
  }

  if (accounts && accounts.length > 0) {
    return <Redirect to={`/accounts/${accounts[0].id}`} />;
  }

  return (
    <div className="flex flex-col h-full items-center justify-center gap-6 text-muted-foreground p-8">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Smartphone className="w-8 h-8 text-primary" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-mono font-bold text-foreground">No accounts yet</h2>
        <p className="text-sm">Add a WhatsApp account using the + button in the sidebar.</p>
      </div>
      <div className="flex items-center gap-2 text-xs font-mono opacity-60">
        <Plus className="w-3 h-3" />
        <span>Click the plus in the sidebar to get started</span>
      </div>
    </div>
  );
}
