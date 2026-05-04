import { useWhatsapp } from "@/hooks/use-whatsapp";
import { useLogoutWhatsapp, useGetWhatsappQr, getGetWhatsappQrQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, QrCode, Smartphone, CheckCircle2, ShieldAlert } from "lucide-react";

export default function Home() {
  const { status, qrDataUrl } = useWhatsapp();
  const logout = useLogoutWhatsapp();
  const { data: initialQr } = useGetWhatsappQr({
    query: {
      enabled: status?.state === "QR_READY" && !qrDataUrl,
      queryKey: getGetWhatsappQrQueryKey(),
    }
  });

  const currentQr = qrDataUrl || initialQr?.qrDataUrl;

  const handleDisconnect = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        // Will trigger a state change via polling/websocket
      }
    });
  };

  if (!status) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <div className="animate-pulse w-12 h-12 rounded-full bg-muted"></div>
          <p className="font-mono text-sm">INITIALIZING_CONNECTION...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full p-8 flex-col max-w-3xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-mono font-bold mb-2">Connection Status</h1>
        <p className="text-muted-foreground">Manage your WhatsApp session lifecycle.</p>
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="border-b border-border/50 pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-mono flex items-center gap-2 text-xl">
                {status.state === "READY" && <CheckCircle2 className="w-5 h-5 text-primary" />}
                {status.state === "QR_READY" && <QrCode className="w-5 h-5 text-yellow-500" />}
                {status.state === "DISCONNECTED" && <ShieldAlert className="w-5 h-5 text-destructive" />}
                {status.state}
              </CardTitle>
              <CardDescription className="mt-2">
                {status.state === "READY" && "Your surveillance layer is active and authenticated."}
                {status.state === "QR_READY" && "Scan the QR code below with your WhatsApp app to authenticate."}
                {status.state === "DISCONNECTED" && "No active session found. Waiting for initialization."}
                {status.state === "INITIALIZING" && "Starting up the headless client..."}
              </CardDescription>
            </div>
            {status.state === "READY" && (
              <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={logout.isPending}>
                <LogOut className="w-4 h-4 mr-2" />
                Disconnect
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {status.state === "QR_READY" && (
            <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-lg border-border bg-muted/20">
              {currentQr ? (
                <div className="p-4 bg-white rounded-xl shadow-sm">
                  <img src={currentQr} alt="QR Code" className="w-64 h-64 object-contain" />
                </div>
              ) : (
                <Skeleton className="w-64 h-64 rounded-xl" />
              )}
              <p className="mt-6 text-sm text-muted-foreground font-mono text-center max-w-md">
                1. Open WhatsApp on your phone<br/>
                2. Tap Menu or Settings and select Linked Devices<br/>
                3. Point your phone to this screen to capture the code
              </p>
            </div>
          )}

          {status.state === "READY" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1 p-4 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-mono uppercase">Connected As</span>
                <div className="flex items-center gap-2 mt-1">
                  {status.profilePicUrl ? (
                    <img src={status.profilePicUrl} className="w-8 h-8 rounded-full" alt="Profile" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <span className="font-medium text-lg">{status.displayName || "Unknown User"}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1 p-4 rounded-lg bg-muted/30 border border-border/50">
                <span className="text-xs text-muted-foreground font-mono uppercase">Phone Number</span>
                <span className="font-mono text-lg mt-1">{status.phoneNumber || "Unknown"}</span>
              </div>
            </div>
          )}

          {(status.state === "INITIALIZING" || status.state === "DISCONNECTED") && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="w-12 h-12 rounded-full border-4 border-muted border-t-primary animate-spin mb-4" />
              <p className="font-mono text-sm">Awaiting session readiness...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
