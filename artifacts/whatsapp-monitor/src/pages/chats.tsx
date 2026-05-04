import { useGetChats } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, User, MessageSquare, Archive } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export default function Chats() {
  const { data: chats, isLoading } = useGetChats();

  const formatTime = (ts: number | null | undefined) => {
    if (!ts) return "";
    try {
      return formatDistanceToNow(new Date(ts * 1000), { addSuffix: true });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 py-6 border-b border-border shrink-0">
        <h1 className="text-2xl font-mono font-bold">Conversations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {chats ? `${chats.length} chats monitored` : "Loading..."}
        </p>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border/50">
                <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : !chats || chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-mono text-sm">NO_CHATS_AVAILABLE</p>
            <p className="text-xs mt-1">Connect your WhatsApp account first</p>
          </div>
        ) : (
          <div className="p-4 space-y-1">
            {chats.map((chat) => (
              <Link key={chat.id} href={`/chats/${encodeURIComponent(chat.id)}`}>
                <div
                  data-testid={`chat-item-${chat.id}`}
                  className={cn(
                    "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all",
                    "border-border/50 hover:border-border hover:bg-card bg-transparent",
                    chat.unreadCount > 0 && "border-primary/30 bg-primary/5"
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0 relative">
                    {chat.isGroup ? (
                      <Users className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <User className="w-5 h-5 text-muted-foreground" />
                    )}
                    {chat.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {chat.unreadCount > 9 ? "9+" : chat.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{chat.name}</span>
                      {chat.isGroup && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono shrink-0">
                          GROUP
                        </Badge>
                      )}
                      {chat.isArchived && (
                        <Archive className="w-3 h-3 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    {chat.lastMessage && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5 font-mono">
                        {chat.lastMessage}
                      </p>
                    )}
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    {chat.lastMessageTimestamp && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {formatTime(chat.lastMessageTimestamp)}
                      </p>
                    )}
                    {chat.unreadCount > 0 && (
                      <Badge className="text-[10px] h-4 px-1.5 font-mono">
                        {chat.unreadCount} new
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
