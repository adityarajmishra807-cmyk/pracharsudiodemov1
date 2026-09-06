import { ArrowLeft, CheckCheck, MoreVertical, Send, Smile, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { WhatsAppChat, WhatsAppMessage } from "@/lib/whatsapp";
import { messageService } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toInboxMessage, sortMessages } from "@/lib/whatsapp";

function titleFor(chat: WhatsAppChat) {
  return chat.name || (chat.isGroup ? "Group" : chat.jid.split("@")[0]);
}

function timeFor(message: WhatsAppMessage) {
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(Number(message.messageTimestamp) > 10_000_000_000 ? Number(message.messageTimestamp) : Number(message.messageTimestamp) * 1000),
  );
}

export function WhatsAppChatThread({
  sessionId,
  chat,
  messages,
  loading,
  onBack,
  onRefresh,
}: {
  sessionId: string;
  chat: WhatsAppChat | null;
  messages: WhatsAppMessage[];
  loading: boolean;
  onBack: () => void;
  onRefresh: () => Promise<void> | void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [emoji, setEmoji] = useState("👍");

  const ordered = useMemo(() => sortMessages(messages), [messages]);

  useEffect(() => {
    if (!chat || ordered.length === 0) return;
    const ids = ordered.map((message) => message.messageId).slice(-50);
    void messageService.markRead({ data: { sessionId, jid: chat.jid, messageIds: ids } }).catch(() => undefined);
  }, [chat, ordered, sessionId]);

  if (!chat) {
    return <div className="flex flex-1 items-center justify-center p-8 text-center"><p className="text-sm text-muted-foreground">Select a conversation.</p></div>;
  }

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await messageService.sendText({ data: { sessionId, jid: chat.jid, text } });
      setDraft("");
      await onRefresh();
    } catch (value) {
      toast.error(value instanceof Error ? value.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  const react = async (messageId: string) => {
    try {
      await messageService.react({ data: { sessionId, jid: chat.jid, messageId, emoji } });
      await onRefresh();
    } catch (value) {
      toast.error(value instanceof Error ? value.message : "Could not react to message.");
    }
  };

  const removeMessage = async (messageId: string) => {
    try {
      await messageService.remove({ data: { sessionId, jid: chat.jid, messageId } });
      await onRefresh();
    } catch (value) {
      toast.error(value instanceof Error ? value.message : "Could not delete message.");
    }
  };

  return (
    <section className="flex min-h-[70svh] flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label="Back to chats"><ArrowLeft className="size-4" /></Button>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">{titleFor(chat).slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1"><p className="truncate font-semibold text-navy">{titleFor(chat)}</p><p className="truncate text-xs text-muted-foreground">{chat.isGroup ? "Group" : chat.jid.split("@")[0]}</p></div>
      </header>

      <div className="flex-1 overflow-y-auto bg-surface p-4 space-y-2">
        {loading && ordered.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">Loading messages…</div> : null}
        {!loading && ordered.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No messages yet.</div> : null}
        {ordered.map((message) => {
          const normalized = toInboxMessage(message);
          return (
            <div key={message.messageId} className={`group flex ${message.fromMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm ${message.fromMe ? "rounded-br-md bg-navy text-white" : "rounded-bl-md border border-border bg-card text-foreground"}`}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1"><p className="whitespace-pre-wrap break-words">{normalized.text}</p><div className={`mt-1 flex items-center gap-1 text-[10px] ${message.fromMe ? "text-white/60" : "text-muted-foreground"}`}><span>{timeFor(message)}</span>{message.fromMe ? <CheckCheck className="size-3" /> : null}</div></div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" aria-label="Message actions"><MoreVertical className="size-3.5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align={message.fromMe ? "end" : "start"}>
                      <DropdownMenuItem onSelect={() => void react(message.messageId)}><Smile className="mr-2 size-4" />React {emoji}</DropdownMenuItem>
                      {message.fromMe ? <DropdownMenuItem className="text-destructive" onSelect={() => void removeMessage(message.messageId)}><Trash2 className="mr-2 size-4" />Delete</DropdownMenuItem> : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border bg-card p-3">
        <div className="mb-2 flex justify-end gap-1">
          {["👍", "❤️", "😂", "😮", "😢"].map((item) => <button key={item} type="button" onClick={() => setEmoji(item)} className={`rounded-md px-2 py-1 text-sm hover:bg-surface ${emoji === item ? "bg-surface" : ""}`}>{item}</button>)}
        </div>
        <div className="flex items-center gap-2"><Input value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} placeholder="Type a WhatsApp message…" className="h-11" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} /><Button className="h-11 shrink-0 px-4" onClick={() => void send()} disabled={sending || !draft.trim()}><Send className="mr-2 size-4" />{sending ? "Sending…" : "Send"}</Button></div>
      </div>
    </section>
  );
}
