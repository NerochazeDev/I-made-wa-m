import { useRoute } from "wouter";
import {
  useGetAccountChatMessages,
  getGetAccountChatMessagesQueryKey,
  useSendMessage,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Image,
  FileText,
  Mic,
  Video,
  ArrowRightLeft,
  Send,
  Sticker,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

const BASE = "/api";

function mediaUrl(accountId: string, messageId: string) {
  return `${BASE}/whatsapp/accounts/${accountId}/messages/${encodeURIComponent(messageId)}/media`;
}

/* ─── Media bubble components ──────────────────────────────────────────── */

function ImageBubble({ src, fromMe }: { src: string; fromMe: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <img
        src={src}
        alt="image"
        onClick={() => setExpanded(true)}
        className="max-w-full rounded-xl cursor-pointer object-cover"
        style={{ maxHeight: 220 }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        >
          <img src={src} alt="full" className="max-w-[92vw] max-h-[88vh] rounded-2xl shadow-2xl" />
        </div>
      )}
      {/* caption placeholder */}
      {fromMe !== undefined && null}
    </>
  );
}

function AudioBubble({ src, fromMe }: { src: string; fromMe: boolean }) {
  return (
    <audio
      controls
      preload="none"
      className={cn(
        "w-full max-w-[240px] rounded-xl h-10",
        fromMe ? "accent-white" : "accent-primary",
      )}
    >
      <source src={src} />
    </audio>
  );
}

function VideoBubble({ src }: { src: string }) {
  return (
    <video
      controls
      preload="none"
      className="max-w-full rounded-xl"
      style={{ maxHeight: 220 }}
    >
      <source src={src} />
    </video>
  );
}

function StickerBubble({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt="sticker"
      className="w-28 h-28 object-contain"
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

type MessageType = {
  id: string;
  body: string;
  timestamp: number;
  fromMe: boolean;
  author?: string | null;
  type: string;
  hasMedia: boolean;
  isForwarded: boolean;
  isStarred: boolean;
};

function MediaContent({
  msg,
  accountId,
}: {
  msg: MessageType;
  accountId: string;
}) {
  const url = mediaUrl(accountId, msg.id);
  const t = msg.type;

  if (!msg.hasMedia) return null;

  if (t === "image") return <ImageBubble src={url} fromMe={msg.fromMe} />;
  if (t === "sticker") return <StickerBubble src={url} />;
  if (t === "ptt" || t === "audio")
    return <AudioBubble src={url} fromMe={msg.fromMe} />;
  if (t === "video")
    return <VideoBubble src={url} />;

  // Generic document / unknown media
  return (
    <div className="flex items-center gap-2 text-xs opacity-70">
      <FileText className="w-4 h-4 shrink-0" />
      <span className="font-mono uppercase">{t}</span>
    </div>
  );
}

function MediaIcon({ type }: { type: string }) {
  const cls = "w-3.5 h-3.5";
  if (type === "image") return <Image className={cls} />;
  if (type === "video") return <Video className={cls} />;
  if (type === "audio" || type === "ptt") return <Mic className={cls} />;
  if (type === "document") return <FileText className={cls} />;
  if (type === "sticker") return <Sticker className={cls} />;
  return <Play className={cls} />;
}

/* ─── Main chat view ────────────────────────────────────────────────────── */

export default function ChatView() {
  const [, params] = useRoute("/accounts/:accountId/chats/:chatId");
  const accountId = params?.accountId ?? "";
  const chatId = params?.chatId ? decodeURIComponent(params.chatId) : "";

  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const qk = getGetAccountChatMessagesQueryKey(accountId, chatId, { limit: 50 });

  const { data: messages, isLoading } = useGetAccountChatMessages(
    accountId,
    chatId,
    { limit: 50 },
    {
      query: {
        enabled: !!accountId && !!chatId,
        queryKey: qk,
        staleTime: 15000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 5000,
        refetchOnWindowFocus: false,
      },
    },
  );

  const send = useSendMessage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: qk });
        setText("");
        textareaRef.current?.focus();
      },
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || send.isPending) return;
    send.mutate({ accountId, chatId, data: { body: trimmed } });
  }, [text, send, accountId, chatId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (ts: number) => {
    try {
      return format(new Date(ts * 1000), "HH:mm");
    } catch {
      return "";
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={cn("flex", i % 3 === 0 ? "justify-end" : "justify-start")}
            >
              <Skeleton
                className={cn(
                  "h-12 rounded-2xl",
                  i % 3 === 0 ? "w-44" : "w-52",
                )}
              />
            </div>
          ))
        ) : !messages || messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-16">
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Send the first message below.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSticker = msg.type === "sticker";
            return (
              <div
                key={msg.id}
                className={cn("flex", msg.fromMe ? "justify-end" : "justify-start")}
              >
                {/* Stickers have no bubble background */}
                {isSticker ? (
                  <div className="max-w-[50%]">
                    <MediaContent msg={msg} accountId={accountId} />
                    <p
                      className={cn(
                        "text-[10px] opacity-60 mt-0.5",
                        msg.fromMe ? "text-right text-muted-foreground" : "text-left text-muted-foreground",
                      )}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "max-w-[78%] px-3 py-2 rounded-2xl shadow-sm",
                      msg.fromMe
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border border-border/60 text-foreground rounded-bl-sm",
                    )}
                  >
                    {msg.author && !msg.fromMe && (
                      <p className="text-[10px] font-semibold text-primary mb-1">
                        {msg.author}
                      </p>
                    )}

                    {/* Media content */}
                    {msg.hasMedia && (
                      <div className="mb-1">
                        <MediaContent msg={msg} accountId={accountId} />
                      </div>
                    )}

                    {/* Fallback type label for media without rendered content */}
                    {msg.hasMedia && !["image", "sticker", "ptt", "audio", "video"].includes(msg.type) && (
                      <div
                        className={cn(
                          "flex items-center gap-1.5 text-[11px] mb-1 opacity-75",
                          msg.fromMe ? "text-primary-foreground" : "text-muted-foreground",
                        )}
                      >
                        <MediaIcon type={msg.type} />
                        <span className="uppercase font-mono">{msg.type}</span>
                      </div>
                    )}

                    {/* Text body */}
                    {msg.body ? (
                      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                        {msg.body}
                      </p>
                    ) : !msg.hasMedia ? (
                      <p className="text-xs italic opacity-60">[{msg.type}]</p>
                    ) : null}

                    <div className="flex items-center gap-1.5 mt-1 justify-end">
                      {msg.isForwarded && (
                        <ArrowRightLeft className="w-2.5 h-2.5 opacity-50" />
                      )}
                      <span
                        className={cn(
                          "text-[10px] opacity-60",
                          msg.fromMe
                            ? "text-primary-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply bar */}
      <div className="shrink-0 border-t border-border/50 bg-card/80 backdrop-blur-md px-3 py-2.5 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          className={cn(
            "flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm bg-muted/60 border border-border/50",
            "placeholder:text-muted-foreground/50 outline-none focus:border-primary/50",
            "leading-5 max-h-[120px] overflow-y-auto transition-colors",
          )}
          style={{ height: "40px" }}
          disabled={send.isPending}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || send.isPending}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all",
            text.trim() && !send.isPending
              ? "bg-primary text-primary-foreground scale-100 shadow-md active:scale-95"
              : "bg-muted text-muted-foreground scale-90 opacity-50",
          )}
        >
          {send.isPending ? (
            <div className="w-4 h-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
          ) : (
            <Send className="w-4 h-4 translate-x-[1px]" />
          )}
        </button>
      </div>
    </div>
  );
}
