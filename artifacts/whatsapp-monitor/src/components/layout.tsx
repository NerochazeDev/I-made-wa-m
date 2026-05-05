import { Link, useLocation, useRoute } from "wouter";
import { Activity, MessageSquare, LayoutDashboard, Plus, Trash2, Loader2, ChevronDown, ArrowLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useListAccounts, useCreateAccount, useDeleteAccount, useGetAccountChats, getListAccountsQueryKey, getGetAccountChatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* ─── Account Sheet ─────────────────────────────────── */
function AccountSheet({
  open,
  onClose,
  activeAccountId,
}: {
  open: boolean;
  onClose: () => void;
  activeAccountId: string | null;
}) {
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useListAccounts();
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");

  const handleCreate = () => {
    if (!label.trim()) return;
    createAccount.mutate(
      { data: { label: label.trim() } },
      {
        onSuccess: (account) => {
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          setAdding(false);
          setLabel("");
          onClose();
          window.location.href = `/accounts/${account.id}`;
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteAccount.mutate(
      { accountId: id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          if (activeAccountId === id) {
            onClose();
            window.location.href = "/";
          }
        },
      },
    );
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] bg-card rounded-t-2xl border-t border-border shadow-2xl animate-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="font-semibold text-base">Accounts</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="px-4 pb-2 space-y-1 max-h-56 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : !accounts || accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No accounts yet</p>
          ) : (
            accounts.map((acc) => {
              const isActive = activeAccountId === acc.id;
              return (
                <div
                  key={acc.id}
                  className={cn(
                    "flex items-center justify-between px-3 py-3 rounded-xl transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "hover:bg-muted",
                  )}
                >
                  <Link href={`/accounts/${acc.id}`} onClick={onClose}>
                    <div className="flex items-center gap-3 cursor-pointer">
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold",
                        isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                      )}>
                        {acc.label.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-sm">{acc.label}</span>
                    </div>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(acc.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {adding ? (
          <div className="px-4 pt-2 pb-4 space-y-3">
            <Input
              placeholder="Label (e.g. Personal, Work)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
              className="h-11"
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => { setAdding(false); setLabel(""); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreate}
                disabled={!label.trim() || createAccount.isPending}
              >
                {createAccount.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Add
              </Button>
            </div>
          </div>
        ) : (
          <div className="px-4 pb-6 pt-2">
            <Button
              variant="outline"
              className="w-full h-11 gap-2"
              onClick={() => setAdding(true)}
            >
              <Plus className="w-4 h-4" />
              Add Account
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Layout ─────────────────────────────────────────── */
export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sheetOpen, setSheetOpen] = useState(false);

  const [, params0] = useRoute("/accounts/:accountId");
  const [, params1] = useRoute("/accounts/:accountId/chats");
  const [, params2] = useRoute("/accounts/:accountId/stats");
  const [, params3] = useRoute("/accounts/:accountId/chats/:chatId");

  const activeAccountId =
    params0?.accountId ??
    params1?.accountId ??
    params2?.accountId ??
    params3?.accountId ??
    null;

  const isChatDetail = !!params3;
  const chatId = params3?.chatId ? decodeURIComponent(params3.chatId) : null;

  const { data: accounts } = useListAccounts();
  const activeAccount = accounts?.find((a) => a.id === activeAccountId);

  // Look up the chat name from the already-cached chats list (no extra fetch)
  const { data: cachedChats } = useGetAccountChats(
    activeAccountId ?? "",
    {
      query: {
        enabled: isChatDetail && !!activeAccountId,
        queryKey: getGetAccountChatsQueryKey(activeAccountId ?? ""),
        staleTime: 2 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchInterval: false,
      },
    },
  );
  const chatName = chatId
    ? (cachedChats?.find((c) => c.id === chatId)?.name ?? chatId.split("@")[0])
    : null;

  const bottomTabs = activeAccountId && !isChatDetail
    ? [
        { href: `/accounts/${activeAccountId}`, label: "Status", icon: Activity },
        { href: `/accounts/${activeAccountId}/chats`, label: "Chats", icon: MessageSquare },
        { href: `/accounts/${activeAccountId}/stats`, label: "Overview", icon: LayoutDashboard },
      ]
    : [];

  return (
    /* Outer phone shell */
    <div className="flex items-center justify-center min-h-screen bg-[#111] dark">
      <div className="relative flex flex-col w-full max-w-[430px] h-[100dvh] bg-background text-foreground overflow-hidden shadow-2xl">

        {/* ── Top bar ── */}
        <header className="shrink-0 flex items-center gap-3 px-4 h-[56px] bg-card/80 backdrop-blur-md border-b border-border/60 z-10">
          {isChatDetail ? (
            <>
              <Link href={`/accounts/${activeAccountId}/chats`}>
                <Button variant="ghost" size="icon" className="h-9 w-9 -ml-1">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate leading-tight">{chatName}</p>
                <p className="text-[10px] text-muted-foreground">conversation</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-tight">WA Monitor</p>
                {activeAccount && (
                  <p className="text-[10px] text-muted-foreground truncate">{activeAccount.label}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 gap-1.5 text-xs font-medium"
                onClick={() => setSheetOpen(true)}
              >
                {activeAccount ? (
                  <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                    {activeAccount.label.charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </Button>
            </>
          )}
        </header>

        {/* ── Content ── */}
        <main className={cn(
          "flex-1 overflow-hidden flex flex-col",
          bottomTabs.length > 0 && "pb-0",
        )}>
          {children}
        </main>

        {/* ── Bottom Tab Bar ── */}
        {bottomTabs.length > 0 && (
          <nav className="shrink-0 flex items-center border-t border-border/60 bg-card/80 backdrop-blur-md h-[60px] safe-area-bottom">
            {bottomTabs.map((tab) => {
              const isActive =
                location === tab.href ||
                (location.startsWith(tab.href + "/") && tab.href !== `/accounts/${activeAccountId}`);
              return (
                <Link key={tab.href} href={tab.href} className="flex-1">
                  <div className={cn(
                    "flex flex-col items-center justify-center gap-1 h-full cursor-pointer transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}>
                    <tab.icon className={cn("w-5 h-5 transition-transform", isActive && "scale-110")} />
                    <span className="text-[10px] font-medium">{tab.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        )}

        {/* ── Account Sheet ── */}
        <AccountSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          activeAccountId={activeAccountId}
        />
      </div>
    </div>
  );
}
