import { useRoute, Link } from "wouter";
import { useGetAccountChatMessages, getGetAccountChatMessagesQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Image, FileText, Mic, Video, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function ChatView() {
  const [, params] = useRoute("/accounts/:accountId/chats/:chatId");
  const accountId = params?.accountId ?? "";
  const chatId = params?.chatId ? decodeURIComponent(params.chatId) : "";

  const { data: messages, isLoading } = useGetAccountChatMessages(
    accountId,
    chatId,
    { limit: 50 },
    {
      query: {
        enabled: !!accountId && !!chatId,
        queryKey: getGetAccountChatMessagesQueryKey(accountId, chatId, { limit: 50 }),
      },
    }
  );

  const formatTime = (ts: number) => {
    try {
      return format(new Date(ts * 1000), "HH:mm");
    } catch {
      return "";
    }
  };

  const getMediaIcon = (type: string) => {
    if (type === "image") return <Image className="w-3 h-3" />;
    if (type === "video") return <Video className="w-3 h-3" />;
    if (type === "audio" || type === "ptt") return <Mic className="w-3 h-3" />;
    if (type === "document") return <FileText className="w-3 h-3" />;
    return null;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-border shrink-0 flex items-center gap-3">
        <Link href={`/accounts/${accountId}/chats`}>
          <Button variant="ghost" size="sm" className="gap-2 font-mono">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </Link>
        <div className="h-5 w-px bg-border" />
        <div>
          <p className="text-xs text-muted-foreground font-mono">CHAT_ID</p>
          <p className="text-sm font-mono truncate max-w-xs">{chatId}</p>
        </div>
        {messages && (
          <Badge variant="secondary" className="ml-auto font-mono text-xs">
            {messages.length} messages
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1 px-6 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={cn("flex", i % 3 === 0 ? "justify-end" : "justify-start")}>
                <Skeleton className="h-12 w-48 rounded-2xl" />
              </div>
            ))}
          </div>
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <p className="font-mono text-sm">NO_MESSAGES</p>
          </div>
        ) : (
          <div className="space-y-2 pb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn("flex", msg.fromMe ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[70%] px-4 py-2.5 rounded-2xl text-sm relative group",
                    msg.fromMe
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border text-foreground rounded-bl-sm"
                  )}
                >
                  {msg.author && !msg.fromMe && (
                    <p className="text-[10px] font-mono text-primary mb-1 opacity-80">{msg.author}</p>
                  )}

                  {msg.hasMedia && (
                    <div className="flex items-center gap-1.5 text-xs opacity-70 mb-1">
                      {getMediaIcon(msg.type)}
                      <span className="font-mono uppercase">{msg.type}</span>
                    </div>
                  )}

                  {msg.body ? (
                    <p className="leading-relaxed break-words">{msg.body}</p>
                  ) : (
                    <p className="italic opacity-60 text-xs font-mono">[{msg.type}]</p>
                  )}

                  <div className="flex items-center gap-1.5 mt-1 justify-end">
                    {msg.isForwarded && (
                      <ArrowRightLeft className="w-2.5 h-2.5 opacity-50" />
                    )}
                    <span className={cn(
                      "text-[10px] font-mono opacity-60",
                      msg.fromMe ? "text-primary-foreground" : "text-muted-foreground"
                    )}>
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
