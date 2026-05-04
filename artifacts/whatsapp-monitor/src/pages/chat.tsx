import { useRoute } from "wouter";
import { useGetAccountChatMessages, getGetAccountChatMessagesQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Image, FileText, Mic, Video, ArrowRightLeft } from "lucide-react";
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
    },
  );

  const formatTime = (ts: number) => {
    try { return format(new Date(ts * 1000), "HH:mm"); } catch { return ""; }
  };

  const getMediaIcon = (type: string) => {
    if (type === "image") return <Image className="w-3.5 h-3.5" />;
    if (type === "video") return <Video className="w-3.5 h-3.5" />;
    if (type === "audio" || type === "ptt") return <Mic className="w-3.5 h-3.5" />;
    if (type === "document") return <FileText className="w-3.5 h-3.5" />;
    return null;
  };

  return (
    <ScrollArea className="flex-1 bg-[url('https://i.imgur.com/wgRHT.png')] bg-repeat">
      <div className="p-3 space-y-1.5 pb-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={cn("flex", i % 3 === 0 ? "justify-end" : "justify-start")}>
              <Skeleton className={cn("h-12 rounded-2xl", i % 3 === 0 ? "w-44" : "w-52")} />
            </div>
          ))
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <p className="text-sm">No messages to show</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.fromMe ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[78%] px-3 py-2 rounded-2xl shadow-sm relative",
                msg.fromMe
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-card border border-border/60 text-foreground rounded-bl-sm",
              )}>
                {msg.author && !msg.fromMe && (
                  <p className="text-[10px] font-semibold text-primary mb-1">{msg.author}</p>
                )}

                {msg.hasMedia && (
                  <div className={cn(
                    "flex items-center gap-1.5 text-[11px] mb-1 opacity-75",
                    msg.fromMe ? "text-primary-foreground" : "text-muted-foreground",
                  )}>
                    {getMediaIcon(msg.type)}
                    <span className="uppercase font-mono">{msg.type}</span>
                  </div>
                )}

                {msg.body
                  ? <p className="text-sm leading-relaxed break-words">{msg.body}</p>
                  : <p className="text-xs italic opacity-60">[{msg.type}]</p>}

                <div className={cn(
                  "flex items-center gap-1.5 mt-1 justify-end",
                )}>
                  {msg.isForwarded && (
                    <ArrowRightLeft className="w-2.5 h-2.5 opacity-50" />
                  )}
                  <span className={cn(
                    "text-[10px] opacity-60",
                    msg.fromMe ? "text-primary-foreground" : "text-muted-foreground",
                  )}>
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
