import { Link, useLocation, useRoute } from "wouter";
import { Activity, MessageSquare, LayoutDashboard, Plus, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useListAccounts, useCreateAccount, useDeleteAccount } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getListAccountsQueryKey } from "@workspace/api-client-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { data: accounts, isLoading: loadingAccounts } = useListAccounts();
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [label, setLabel] = useState("");

  const [, accountParams] = useRoute("/accounts/:accountId");
  const [, accountChatsParams] = useRoute("/accounts/:accountId/chats");
  const [, accountStatsParams] = useRoute("/accounts/:accountId/stats");
  const [, accountChatParams] = useRoute("/accounts/:accountId/chats/:chatId");

  const activeAccountId =
    accountParams?.accountId ??
    accountChatsParams?.accountId ??
    accountStatsParams?.accountId ??
    accountChatParams?.accountId ??
    null;

  const navItems = activeAccountId
    ? [
        { href: `/accounts/${activeAccountId}`, label: "Status", icon: Activity },
        { href: `/accounts/${activeAccountId}/chats`, label: "Chats", icon: MessageSquare },
        { href: `/accounts/${activeAccountId}/stats`, label: "Overview", icon: LayoutDashboard },
      ]
    : [];

  const handleCreate = () => {
    if (!label.trim()) return;
    createAccount.mutate(
      { data: { label: label.trim() } },
      {
        onSuccess: (account) => {
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          setDialogOpen(false);
          setLabel("");
          window.location.href = `/accounts/${account.id}`;
        },
      },
    );
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteAccount.mutate(
      { accountId: id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
          if (activeAccountId === id) {
            window.location.href = "/";
          }
        },
      },
    );
  };

  return (
    <div className="flex h-screen w-full bg-background dark text-foreground">
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="font-mono font-bold tracking-tight text-lg">WA_MONITOR</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Accounts section */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Accounts
              </span>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-5 h-5">
                    <Plus className="w-3 h-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="dark">
                  <DialogHeader>
                    <DialogTitle className="font-mono">Add Account</DialogTitle>
                    <DialogDescription>
                      Give this account a label so you can tell it apart.
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    className="font-mono"
                    placeholder="e.g. Personal, Work, Business"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    autoFocus
                  />
                  <DialogFooter>
                    <Button
                      variant="ghost"
                      onClick={() => setDialogOpen(false)}
                      className="font-mono"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreate}
                      disabled={!label.trim() || createAccount.isPending}
                      className="font-mono"
                    >
                      {createAccount.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      Add Account
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {loadingAccounts ? (
              <div className="px-2 py-1">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : !accounts || accounts.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1 font-mono">No accounts yet</p>
            ) : (
              <div className="space-y-0.5">
                {accounts.map((acc) => {
                  const isActive = activeAccountId === acc.id;
                  return (
                    <Link key={acc.id} href={`/accounts/${acc.id}`}>
                      <div
                        className={cn(
                          "flex items-center justify-between px-2 py-2 rounded-md cursor-pointer transition-colors group",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                          <span className="text-sm font-medium truncate">{acc.label}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-5 h-5 opacity-0 group-hover:opacity-100 shrink-0"
                          onClick={(e) => handleDelete(acc.id, e)}
                        >
                          <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Per-account nav */}
          {navItems.length > 0 && (
            <nav className="p-3 space-y-0.5">
              <div className="px-2 mb-2">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                  Navigation
                </span>
              </div>
              {navItems.map((item) => {
                const isActive =
                  location === item.href ||
                  (location.startsWith(item.href + "/") && item.href !== `/accounts/${activeAccountId}`);
                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors text-sm font-medium",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </nav>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-overlay z-50 bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
        {children}
      </main>
    </div>
  );
}
