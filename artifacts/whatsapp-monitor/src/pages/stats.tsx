import { useRoute } from "wouter";
import { useGetAccountStats, useGetAccountChats, getGetAccountStatsQueryKey, getGetAccountChatsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Users, User, Mail, AlertCircle } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  accent?: boolean;
  loading: boolean;
}

function StatCard({ label, value, icon, accent, loading }: StatCardProps) {
  return (
    <Card className={`border-border/60 ${accent ? "border-primary/40 bg-primary/5" : "bg-card"}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
          {label}
        </CardTitle>
        <div className={`${accent ? "text-primary" : "text-muted-foreground"}`}>
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-9 w-20" />
        ) : (
          <p className="text-3xl font-mono font-bold">{value ?? "—"}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Stats() {
  const [, params] = useRoute("/accounts/:accountId/stats");
  const accountId = params?.accountId ?? "";

  const { data: stats, isLoading } = useGetAccountStats(accountId, {
    query: {
      enabled: !!accountId,
      queryKey: getGetAccountStatsQueryKey(accountId),
      refetchInterval: 15000,
    },
  });

  const { data: chats } = useGetAccountChats(accountId, {
    query: {
      enabled: !!accountId,
      queryKey: getGetAccountChatsQueryKey(accountId),
    },
  });

  const topUnread = chats
    ? [...chats]
        .filter((c) => c.unreadCount > 0)
        .sort((a, b) => b.unreadCount - a.unreadCount)
        .slice(0, 5)
    : [];

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="px-8 py-6 border-b border-border shrink-0">
        <h1 className="text-2xl font-mono font-bold">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Account activity at a glance
        </p>
      </div>

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="Total Chats"
            value={stats?.totalChats}
            icon={<MessageSquare className="w-4 h-4" />}
            loading={isLoading}
          />
          <StatCard
            label="Groups"
            value={stats?.totalGroups}
            icon={<Users className="w-4 h-4" />}
            loading={isLoading}
          />
          <StatCard
            label="Private Chats"
            value={stats?.totalPrivateChats}
            icon={<User className="w-4 h-4" />}
            loading={isLoading}
          />
          <StatCard
            label="Unread Chats"
            value={stats?.unreadChats}
            icon={<AlertCircle className="w-4 h-4" />}
            accent={!!stats?.unreadChats && stats.unreadChats > 0}
            loading={isLoading}
          />
          <StatCard
            label="Unread Messages"
            value={stats?.totalUnreadMessages}
            icon={<Mail className="w-4 h-4" />}
            accent={!!stats?.totalUnreadMessages && stats.totalUnreadMessages > 0}
            loading={isLoading}
          />
        </div>

        {topUnread.length > 0 && (
          <div>
            <h2 className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-3">
              Unread Chats
            </h2>
            <div className="space-y-2">
              {topUnread.map((chat) => (
                <div
                  key={chat.id}
                  className="flex items-center justify-between px-4 py-3 rounded-lg bg-card border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-sm font-medium">{chat.name}</span>
                  </div>
                  <span className="text-sm font-mono text-primary font-bold">
                    {chat.unreadCount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && stats?.totalChats === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-mono text-sm">NO_DATA_AVAILABLE</p>
            <p className="text-xs mt-1">Connect your WhatsApp account to see statistics</p>
          </div>
        )}
      </div>
    </div>
  );
}
