import { useRoute } from "wouter";
import { useGetAccountChats, getGetAccountChatsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, User, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export default function Chats() {
  const [, params] = useRoute("/accounts/:accountId/chats");
  const accountId = params?.accountId ?? "";

  const { data: chats, isLoading } = useGetAccountChats(accountId, {
    query: {
      enabled: !!accountId,
      queryKey: getGetAccountChatsQueryKey(accountId),
      // Keep cached data for 2 min — navigating back to this page is instant
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchInterval: 30000,
      refetchOnWindowFocus: false,
    },
  });

  const formatTime = (ts: number | null | undefined) => {
    if (!ts) return "";
    try {
      return formatDistanceToNow(new Date(ts * 1000), { addSuffix: false })
        .replace("about ", "")
        .replace(" minutes", "m")
        .replace(" minute", "m")
        .replace(" hours", "h")
        .replace(" hour", "h")
        .replace(" days", "d")
        .replace(" day", "d");
    } catch {
      return "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
            <Skeleton className="w-12 h-12 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-44" />
            </div>
            <Skeleton className="h-3 w-8" />
          </div>
        ))}
      </div>
    );
  }

  if (!chats || chats.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <MessageSquare className="w-14 h-14 opacity-20" />
        <p className="text-sm font-medium">No chats yet</p>
        <p className="text-xs">Connect your account to see conversations.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {chats.map((chat) => (
        <Link key={chat.id} href={`/accounts/${accountId}/chats/${encodeURIComponent(chat.id)}`}>
          <div className={cn(
            "flex items-center gap-3 px-4 py-3.5 border-b border-border/30 active:bg-muted/60 cursor-pointer transition-colors",
            chat.unreadCount > 0 && "bg-primary/[0.03]",
          )}>
            {/* Avatar */}
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
              "bg-muted text-muted-foreground relative",
            )}>
              {chat.isGroup
                ? <Users className="w-6 h-6" />
                : <User className="w-6 h-6" />}
              {chat.unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1">
                  {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                </span>
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className={cn(
                  "text-sm truncate mr-2",
                  chat.unreadCount > 0 ? "font-semibold" : "font-medium",
                )}>
                  {chat.name}
                </span>
                <span className={cn(
                  "text-[11px] shrink-0",
                  chat.unreadCount > 0 ? "text-primary font-semibold" : "text-muted-foreground",
                )}>
                  {formatTime(chat.lastMessageTimestamp)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {chat.isGroup && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-3.5 font-mono shrink-0">
                    GROUP
                  </Badge>
                )}
                {chat.lastMessage ? (
                  <p className="text-xs text-muted-foreground truncate">{chat.lastMessage}</p>
                ) : (
                  <p className="text-xs text-muted-foreground/50 italic">No messages</p>
                )}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
