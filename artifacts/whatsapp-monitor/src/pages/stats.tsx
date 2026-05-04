import { useRoute } from "wouter";
import {
  useGetAccountStats,
  useGetAccountChats,
  getGetAccountStatsQueryKey,
  getGetAccountChatsQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Users, User, Mail, AlertCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  accent?: boolean;
  loading: boolean;
}

function StatTile({ label, value, icon, accent, loading }: StatTileProps) {
  return (
    <div className={cn(
      "flex flex-col gap-2 p-4 rounded-2xl border",
      accent
        ? "bg-primary/10 border-primary/20"
        : "bg-card border-border/50",
    )}>
      <div className={cn(
        "w-8 h-8 rounded-xl flex items-center justify-center",
        accent ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
      )}>
        {icon}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <p className={cn(
          "text-2xl font-bold tabular-nums",
          accent && "text-primary",
        )}>
          {value ?? "—"}
        </p>
      )}
      <p className="text-xs text-muted-foreground font-medium leading-tight">{label}</p>
    </div>
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
    ? [...chats].filter((c) => c.unreadCount > 0).sort((a, b) => b.unreadCount - a.unreadCount).slice(0, 5)
    : [];

  return (
    <div className="flex-1 overflow-auto px-4 py-5 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <StatTile label="Total Chats" value={stats?.totalChats} icon={<MessageSquare className="w-4 h-4" />} loading={isLoading} />
        <StatTile label="Group Chats" value={stats?.totalGroups} icon={<Users className="w-4 h-4" />} loading={isLoading} />
        <StatTile label="Private Chats" value={stats?.totalPrivateChats} icon={<User className="w-4 h-4" />} loading={isLoading} />
        <StatTile label="Unread Chats" value={stats?.unreadChats} icon={<AlertCircle className="w-4 h-4" />} accent={!!stats?.unreadChats && stats.unreadChats > 0} loading={isLoading} />
        <StatTile label="Unread Messages" value={stats?.totalUnreadMessages} icon={<Mail className="w-4 h-4" />} accent={!!stats?.totalUnreadMessages && stats.totalUnreadMessages > 0} loading={isLoading} />
      </div>

      {topUnread.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Most Unread</h2>
          </div>
          <div className="space-y-2">
            {topUnread.map((chat, i) => (
              <div
                key={chat.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border/50"
              >
                <span className="text-xs text-muted-foreground font-mono w-4">{i + 1}</span>
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <span className="text-sm font-medium flex-1 truncate">{chat.name}</span>
                <span className="text-sm font-bold text-primary tabular-nums">{chat.unreadCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isLoading && stats?.totalChats === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
          <MessageSquare className="w-12 h-12 opacity-20" />
          <p className="text-sm">No data yet</p>
          <p className="text-xs">Connect your account from the Status tab.</p>
        </div>
      )}
    </div>
  );
}
