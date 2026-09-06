import { ArrowLeft, CheckCheck, Contact, FileImage, Loader2, MoreVertical, Paperclip, Send, Smile, Trash2, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { WhatsAppChat, WhatsAppMessage } from "@/lib/whatsapp";
import { messageService } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toInboxMessage, sortMessages, extractMessageText } from "@/lib/whatsapp";

function titleFor(chat: WhatsAppChat) {
  return chat.name || (chat.isGroup ? "Group" : chat.jid.split("@")[0]);
}

function timeFor(message: WhatsAppMessage) {
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(Number(message.messageTimestamp) > 10_000_000_000 ? Number(message.messageTimestamp) : Number(message.messageTimestamp) * 1000),
  );
}

function mediaKind(message: WhatsAppMessage) {
  const type = String(message.messageType || "").toLowerCase();
  if (type.includes("image")) return "image";
  if (type.includes("video")) return "video";
  if (type.includes("sticker")) return "sticker";
  if (type.includes("contact")) return "contact";
  const mime = message.mediaMimetype || "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return null;
}

function vcardFor(name: string, phone: string) {
  const cleanName = name.trim() || phone.trim();
  return `BEGIN:VCARD\nVERSION:3.0\nFN:${cleanName.replaceAll("\\", "\\\\").replaceAll(";", "\\;")}\nTEL;TYPE=CELL:${phone.trim()}\nEND:VCARD`;
}

export function WhatsAppChatThread({
  sessionId,
  chat,
  messages,
  loading,
  loadingOlder,
  hasMore,
  refreshing,
  onBack,
  onRefresh,
  onLoadOlder,
}: {
  sessionId: string;
  chat: WhatsAppChat | null;
  messages: WhatsAppMessage[];
  loading: boolean;
  loadingOlder: boolean;
  hasMore: boolean;
  refreshing: boolean;
  onBack: () => void;
  onRefresh: () => Promise<WhatsAppMessage[] | void> | void;
  onLoadOlder: () => Promise<WhatsAppMessage[] | void> | void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [emoji, setEmoji] = useState("👍");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentType, setAttachmentType] = useState<"image" | "video" | "sticker" | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const markedReadRef = useRef(new Set<string>());
  const previousMessageIdsRef = useRef<string[]>([]);
  const loadingOlderRef = useRef(false);

  const ordered = useMemo(() => sortMessages(messages), [messages]);

  useEffect(() => { loadingOlderRef.current = loadingOlder; }, [loadingOlder]);
  useEffect(() => {
    markedReadRef.current.clear();
    previousMessageIdsRef.current = [];
  }, [chat?.jid, sessionId]);

  useEffect(() => {
    if (!chat || ordered.length === 0) return;
    const unreadIds = ordered
      .filter((message) => !message.fromMe && !message.deleted && !markedReadRef.current.has(message.messageId))
      .map((message) => message.messageId)
      .slice(-50);
    if (unreadIds.length === 0) return;
    for (const id of unreadIds) markedReadRef.current.add(id);
    void messageService.markRead({ data: { sessionId, jid: chat.jid, messageIds: unreadIds } }).catch(() => {
      for (const id of unreadIds) markedReadRef.current.delete(id);
    });
  }, [chat?.jid, ordered, sessionId]);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element || ordered.length === 0) return;
    const nextIds = ordered.map((message) => message.messageId);
    const previousIds = previousMessageIdsRef.current;
    if (previousIds.length === 0) {
      element.scrollTop = element.scrollHeight;
      previousMessageIdsRef.current = nextIds;
      return;
    }
    const sameOldTail = nextIds[nextIds.length - 1] === previousIds[previousIds.length - 1];
    const prepended = nextIds.length > previousIds.length && sameOldTail;
    const nearBottom = element.scrollHeight - element.clientHeight - element.scrollTop < 160;
    const appended = nextIds.length > previousIds.length && !prepended;
    if (prepended) {
      const previousHeight = Number(element.dataset.scrollHeight || 0);
      if (previousHeight > 0) element.scrollTop += element.scrollHeight - previousHeight;
    } else if (appended && nearBottom) {
      element.scrollTop = element.scrollHeight;
    }
    previousMessageIdsRef.current = nextIds;
    element.dataset.scrollHeight = String(element.scrollHeight);
  }, [ordered]);

  const loadOlder = async () => {
    const element = messagesRef.current;
    if (!element || loadingOlderRef.current || !hasMore || ordered.length === 0) return;
    loadingOlderRef.current = true;
    element.dataset.scrollHeight = String(element.scrollHeight);
    try { await onLoadOlder(); } finally { loadingOlderRef.current = false; }
  };

  const handleScroll = () => {
    const element = messagesRef.current;
    if (!element) return;
    if (loadingOlderRef.current || !hasMore) return;
    if (element.scrollTop <= 120) void loadOlder();
  };

  const sendText = async () => {
    const text = draft.trim();
    if (!text || sending || !chat) return;
    setSending(true);
    try {
      await messageService.sendText({ data: { sessionId, jid: chat.jid, text } });
      setDraft("");
      await onRefresh();
    } catch (value) {
      toast.error(value instanceof Error ? value.message : "Could not send message.");
    } finally { setSending(false); }
  };

  const handleFile = (file: File | undefined, type: "image" | "video" | "sticker") => {
    if (!file) return;
    if (type === "image" && !file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (type === "video" && !file.type.startsWith("video/")) return toast.error("Please choose a video file.");
    if (type === "sticker" && !["image/webp", "image/png", "image/jpeg"].includes(file.type)) return toast.error("Please choose a sticker image (WebP, PNG, or JPEG).");
    setAttachment(file);
    setAttachmentType(type);
  };

  const sendAttachment = async () => {
    if (!chat || !attachment || !attachmentType || sending) return;
    setSending(true);
    try {
      const form = new FormData();
      form.set("sessionId", sessionId);
      form.set("jid", chat.jid);
      form.set("type", attachmentType);
      form.set("file", attachment);
      if (draft.trim() && attachmentType !== "sticker") form.set("caption", draft.trim());
      await messageService.sendMedia({ data: form });
      setAttachment(null);
      setAttachmentType(null);
      setDraft("");
      await onRefresh();
    } catch (value) {
      toast.error(value instanceof Error ? value.message : "Could not send attachment.");
    } finally { setSending(false); }
  };

  const sendContact = async () => {
    if (!chat || !contactPhone.trim() || sending) return;
    setSending(true);
    try {
      await messageService.sendContact({ data: { sessionId, jid: chat.jid, displayName: contactName.trim() || contactPhone.trim(), vcard: vcardFor(contactName, contactPhone) } });
      setContactOpen(false);
      setContactName("");
      setContactPhone("");
      await onRefresh();
    } catch (value) {
      toast.error(value instanceof Error ? value.message : "Could not send contact.");
    } finally { setSending(false); }
  };

  const react = async (messageId: string) => {
    try { await messageService.react({ data: { sessionId, jid: chat!.jid, messageId, emoji } }); await onRefresh(); }
    catch (value) { toast.error(value instanceof Error ? value.message : "Could not react to message."); }
  };

  const removeMessage = async (messageId: string) => {
    try { await messageService.remove({ data: { sessionId, jid: chat!.jid, messageId } }); await onRefresh(); }
    catch (value) { toast.error(value instanceof Error ? value.message : "Could not delete message."); }
  };

  if (!chat) return <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center"><p className="text-sm text-muted-foreground">Select a conversation.</p></div>;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label="Back to chats"><ArrowLeft className="size-4" /></Button>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">{titleFor(chat).slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1"><p className="truncate font-semibold text-navy">{titleFor(chat)}</p><p className="truncate text-xs text-muted-foreground">{chat.isGroup ? "Group" : chat.jid.split("@")[0]}</p></div>
        {refreshing ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Refreshing messages" /> : null}
      </header>

      <div ref={messagesRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface p-4 space-y-2">
        {loadingOlder ? <div className="sticky top-0 z-10 mx-auto w-fit rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm"><Loader2 className="mr-1.5 inline size-3 animate-spin" />Loading older messages…</div> : null}
        {!hasMore && ordered.length > 0 ? <div className="mx-auto mb-3 w-fit rounded-full px-3 py-1 text-[11px] text-muted-foreground">Beginning of conversation</div> : null}
        {loading && ordered.length === 0 ? <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />Loading messages…</div> : null}
        {!loading && ordered.length === 0 ? <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">No messages yet.</div> : null}
        {ordered.map((message) => {
          const normalized = toInboxMessage(message);
          const kind = mediaKind(message);
          const text = extractMessageText(message.content) || normalized.text;
          return (
            <div key={message.messageId} className={`group flex w-full ${message.fromMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[min(82%,42rem)] rounded-2xl px-3 py-2 text-sm shadow-sm ${message.fromMe ? "rounded-br-md bg-navy text-white" : "rounded-bl-md border border-border bg-card text-foreground"}`}>
                {kind ? (
                  <div className={`mb-1 rounded-lg p-3 ${message.fromMe ? "bg-white/10" : "bg-surface"}`}>
                    {kind === "image" ? <div className="flex items-center gap-2"><FileImage className="size-5" /><span>Photo</span></div> : null}
                    {kind === "video" ? <div className="flex items-center gap-2"><Video className="size-5" /><span>Video</span></div> : null}
                    {kind === "sticker" ? <div className="text-center text-2xl">🖼️<div className="mt-1 text-xs">Sticker</div></div> : null}
                    {kind === "contact" ? <div className="flex items-center gap-2"><Contact className="size-5" /><span>Contact card</span></div> : null}
                  </div>
                ) : null}
                {text ? <p className="whitespace-pre-wrap break-words">{text}</p> : null}
                <div className={`mt-1 flex items-center gap-1 text-[10px] ${message.fromMe ? "text-white/60" : "text-muted-foreground"}`}><span>{timeFor(message)}</span>{message.fromMe ? <CheckCheck className="size-3" /> : null}</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="absolute right-1 top-1 size-7 opacity-0 transition-opacity group-hover:opacity-100" aria-label="Message actions"><MoreVertical className="size-3.5" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align={message.fromMe ? "end" : "start"}>
                    <DropdownMenuItem onSelect={() => void react(message.messageId)}><Smile className="mr-2 size-4" />React {emoji}</DropdownMenuItem>
                    {message.fromMe ? <DropdownMenuItem className="text-destructive" onSelect={() => void removeMessage(message.messageId)}><Trash2 className="mr-2 size-4" />Delete</DropdownMenuItem> : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-border bg-card p-3">
        {attachment ? (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <div className="min-w-0"><p className="truncate font-medium">{attachment.name}</p><p className="text-xs text-muted-foreground">{attachmentType === "sticker" ? "Sticker" : attachmentType === "video" ? "Video" : "Photo"}</p></div>
            <Button variant="ghost" size="sm" onClick={() => { setAttachment(null); setAttachmentType(null); }} disabled={sending}>Remove</Button>
          </div>
        ) : null}
        <div className="mb-2 flex justify-end gap-1">
          {["👍", "❤️", "😂", "😮", "😢"].map((item) => <button key={item} type="button" onClick={() => setEmoji(item)} className={`rounded-md px-2 py-1 text-sm hover:bg-surface ${emoji === item ? "bg-surface" : ""}`}>{item}</button>)}
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFile(file, file.type.startsWith("video/") ? "video" : "image"); event.currentTarget.value = ""; }} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" disabled={sending} aria-label="Attach"><Paperclip className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}><FileImage className="mr-2 size-4" />Photo</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}><Video className="mr-2 size-4" />Photo / video</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { const input = fileInputRef.current; if (!input) return; input.accept = "image/webp,image/png,image/jpeg"; input.onchange = (event) => { const target = event.target as HTMLInputElement; handleFile(target.files?.[0], "sticker"); target.value = ""; }; input.click(); }}>Sticker</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setContactOpen(true)}><Contact className="mr-2 size-4" />Contact card</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} placeholder={attachment ? "Add a caption…" : "Type a WhatsApp message…"} className="h-11 min-w-0" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (attachment) void sendAttachment(); else void sendText(); } }} />
          <Button className="h-11 shrink-0 px-4" onClick={() => void (attachment ? sendAttachment() : sendText())} disabled={sending || (!draft.trim() && !attachment)}>{sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}{sending ? "Sending…" : "Send"}</Button>
        </div>
      </div>

      <Dialog open={contactOpen} onOpenChange={(open) => !sending && setContactOpen(open)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send contact</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2"><Input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Contact name" /><Input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="Phone number, e.g. +919876543210" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setContactOpen(false)} disabled={sending}>Cancel</Button><Button onClick={() => void sendContact()} disabled={sending || !contactPhone.trim()}>{sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Contact className="mr-2 size-4" />}Send contact</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
