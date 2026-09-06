import { ArrowLeft, CheckCheck, Contact, FileVideo, Image as ImageIcon, Loader2, MoreVertical, Paperclip, Send, Smile, Trash2, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  extractMessageText,
  getWhatsAppMediaToken,
  messageService,
  type WhatsAppChat,
  type WhatsAppMessage,
  sortMessages,
  toInboxMessage,
} from "@/lib/whatsapp";

function titleFor(chat: WhatsAppChat) {
  return chat.name || (chat.isGroup ? "Group" : chat.jid.split("@")[0]);
}

function timeFor(message: WhatsAppMessage) {
  const raw = Number(message.messageTimestamp);
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(raw > 10_000_000_000 ? raw : raw * 1000),
  );
}

function mediaKind(message: WhatsAppMessage) {
  const type = String(message.messageType || "").toLowerCase();
  if (type.includes("image")) return "image" as const;
  if (type.includes("video")) return "video" as const;
  if (type.includes("sticker")) return "sticker" as const;
  if (type.includes("contact")) return "contact" as const;
  const mime = message.mediaMimetype || "";
  if (mime.startsWith("image/")) return "image" as const;
  if (mime.startsWith("video/")) return "video" as const;
  return null;
}

function contactPreview(message: WhatsAppMessage) {
  const content = message.content;
  if (!content || typeof content !== "object") return { name: "Contact", phone: "" };
  const root = content as Record<string, unknown>;
  const nested = root.message && typeof root.message === "object" ? root.message as Record<string, unknown> : root;
  const contacts = nested.contacts;
  if (!contacts || typeof contacts !== "object") return { name: "Contact", phone: "" };
  const first = Array.isArray((contacts as Record<string, unknown>).contacts) ? (contacts as Record<string, unknown>).contacts?.[0] : null;
  if (!first || typeof first !== "object") return { name: String((contacts as Record<string, unknown>).displayName || "Contact"), phone: "" };
  const vcard = String((first as Record<string, unknown>).vcard || "");
  const name = String((contacts as Record<string, unknown>).displayName || "Contact");
  const tel = vcard.match(/TEL[^:]*:([^\\n\\r]+)/i)?.[1] || "";
  return { name, phone: tel };
}

export function WhatsAppChatThreadRich({
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
  const [mediaToken, setMediaToken] = useState<string | null>(null);
  const [mediaBaseUrl, setMediaBaseUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const markedReadRef = useRef(new Set<string>());
  const previousMessageIdsRef = useRef<string[]>([]);
  const loadingOlderRef = useRef(false);
  const scrollHeightBeforeLoadRef = useRef(0);

  const ordered = useMemo(() => sortMessages(messages), [messages]);
  const hasMedia = useMemo(() => ordered.some((message) => Boolean(message.mediaPath && mediaKind(message))), [ordered]);

  useEffect(() => { loadingOlderRef.current = loadingOlder; }, [loadingOlder]);

  useEffect(() => {
    markedReadRef.current.clear();
    previousMessageIdsRef.current = [];
    setMediaToken(null);
    setMediaBaseUrl(null);
  }, [chat?.jid, sessionId]);

  useEffect(() => {
    if (!hasMedia || !sessionId || mediaToken) return;
    let cancelled = false;
    void getWhatsAppMediaToken({ data: { sessionIds: [sessionId] } })
      .then(({ token, url }) => {
        if (cancelled) return;
        setMediaToken(token);
        setMediaBaseUrl(url);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not authorize media.");
      });
    return () => { cancelled = true; };
  }, [hasMedia, mediaToken, sessionId]);

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
    const ids = ordered.map((message) => message.messageId);
    const previousIds = previousMessageIdsRef.current;
    if (previousIds.length === 0) {
      element.scrollTop = element.scrollHeight;
      element.dataset.lastHeight = String(element.scrollHeight);
      previousMessageIdsRef.current = ids;
      return;
    }
    const prepended = ids.length > previousIds.length && ids[ids.length - 1] === previousIds[previousIds.length - 1];
    const appended = ids.length > previousIds.length && !prepended;
    if (prepended) {
      element.scrollTop += element.scrollHeight - scrollHeightBeforeLoadRef.current;
    } else if (appended) {
      const nearBottom = element.scrollHeight - element.clientHeight - element.scrollTop < 160;
      if (nearBottom) element.scrollTop = element.scrollHeight;
    }
    previousMessageIdsRef.current = ids;
    element.dataset.lastHeight = String(element.scrollHeight);
  }, [ordered]);

  const loadOlder = async () => {
    const element = messagesRef.current;
    if (!element || loadingOlderRef.current || !hasMore || !ordered.length) return;
    loadingOlderRef.current = true;
    scrollHeightBeforeLoadRef.current = element.scrollHeight;
    try { await onLoadOlder(); } catch { /* hook owns error state */ }
  };

  const handleScroll = () => {
    const element = messagesRef.current;
    if (!element || loadingOlderRef.current || !hasMore) return;
    if (element.scrollTop <= 120) void loadOlder();
  };

  const sendText = async () => {
    const text = draft.trim();
    if (!chat || !text || sending) return;
    setSending(true);
    try {
      await messageService.sendText({ data: { sessionId, jid: chat.jid, text } });
      setDraft("");
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send message.");
    } finally { setSending(false); }
  };

  const handleFile = (file: File | undefined, type: "image" | "video" | "sticker") => {
    if (!file) return;
    if (type === "image" && !file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (type === "video" && !file.type.startsWith("video/")) return toast.error("Please choose a video file.");
    if (type === "sticker" && !["image/webp", "image/png", "image/jpeg"].includes(file.type)) return toast.error("Please choose a WebP, PNG, or JPEG sticker image.");
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
      setAttachment(null); setAttachmentType(null); setDraft("");
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send attachment.");
    } finally { setSending(false); }
  };

  const sendContact = async () => {
    const phone = contactPhone.trim();
    if (!chat || !phone || sending) return;
    const name = contactName.trim() || phone;
    const vcard = `BEGIN:VCARD\\nVERSION:3.0\\nFN:${name}\\nTEL;TYPE=CELL:${phone}\\nEND:VCARD`;
    setSending(true);
    try {
      await messageService.sendContact({ data: { sessionId, jid: chat.jid, displayName: name, vcard } });
      setContactOpen(false); setContactName(""); setContactPhone("");
      await onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send contact.");
    } finally { setSending(false); }
  };

  const mediaUrl = (message: WhatsAppMessage) => {
    if (!message.mediaPath || !mediaToken || !mediaBaseUrl) return null;
    return `${mediaBaseUrl}/api/media/${encodeURIComponent(sessionId)}/${encodeURIComponent(message.jid)}/${encodeURIComponent(message.messageId)}?realtimeToken=${encodeURIComponent(mediaToken)}`;
  };

  const react = async (messageId: string) => {
    try { await messageService.react({ data: { sessionId, jid: chat!.jid, messageId, emoji } }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not react to message."); }
  };

  const removeMessage = async (messageId: string) => {
    try { await messageService.remove({ data: { sessionId, jid: chat!.jid, messageId } }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete message."); }
  };

  if (!chat) return <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center"><p className="text-sm text-muted-foreground">Select a conversation.</p></div>;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onBack} aria-label="Back"><ArrowLeft className="size-4" /></Button>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">{titleFor(chat).slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1"><p className="truncate font-semibold text-navy">{titleFor(chat)}</p><p className="truncate text-xs text-muted-foreground">{chat.isGroup ? "Group" : chat.jid.split("@")[0]}</p></div>
        {refreshing ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
      </header>

      <div ref={messagesRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface p-4 space-y-2">
        {loadingOlder ? <div className="sticky top-0 z-10 mx-auto w-fit rounded-full border border-border bg-card px-3 py-1.5 text-xs shadow-sm"><Loader2 className="mr-1.5 inline size-3 animate-spin" />Loading older messages…</div> : null}
        {!hasMore && ordered.length > 0 ? <div className="mx-auto mb-3 w-fit px-3 py-1 text-[11px] text-muted-foreground">Beginning of conversation</div> : null}
        {loading && ordered.length === 0 ? <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" />Loading messages…</div> : null}
        {!loading && ordered.length === 0 ? <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">No messages yet.</div> : null}

        {ordered.map((message) => {
          const kind = mediaKind(message);
          const normalized = toInboxMessage(message);
          const text = extractMessageText(message.content) || normalized.text;
          const url = mediaUrl(message);
          const contact = kind === "contact" ? contactPreview(message) : null;
          return (
            <div key={message.messageId} className={`group flex w-full ${message.fromMe ? "justify-end" : "justify-start"}`}>
              <div className={`relative max-w-[min(82%,42rem)] rounded-2xl px-3 py-2 text-sm shadow-sm ${message.fromMe ? "rounded-br-md bg-navy text-white" : "rounded-bl-md border border-border bg-card text-foreground"}`}>
                {kind === "image" ? (
                  url ? <img src={url} alt="WhatsApp photo" loading="lazy" className="mb-2 max-h-[28rem] max-w-full rounded-lg object-contain" /> : <div className="mb-2 flex items-center gap-2 rounded-lg bg-surface p-4 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading photo…</div>
                ) : null}
                {kind === "video" ? (
                  url ? <video src={url} controls preload="metadata" className="mb-2 max-h-[28rem] max-w-full rounded-lg" /> : <div className="mb-2 flex items-center gap-2 rounded-lg bg-surface p-4 text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading video…</div>
                ) : null}
                {kind === "sticker" ? (
                  url ? <img src={url} alt="WhatsApp sticker" loading="lazy" className="mb-1 max-h-64 max-w-64 object-contain" /> : <div className="mb-2 flex items-center justify-center rounded-lg bg-surface p-8 text-muted-foreground"><Loader2 className="size-4 animate-spin" /></div>
                ) : null}
                {kind === "contact" ? (
                  <div className="mb-2 rounded-xl border border-border/70 bg-surface p-3"><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-full bg-navy text-white"><Contact className="size-5" /></div><div className="min-w-0"><p className="font-medium">{contact?.name || "Contact"}</p><p className="truncate text-xs text-muted-foreground">{contact?.phone || "Contact card"}</p></div></div></div>
                ) : null}
                {text && (!kind || kind === "image" || kind === "video") ? <p className="whitespace-pre-wrap break-words">{text}</p> : null}
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
        {attachment ? <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2 text-sm"><div className="min-w-0"><p className="truncate font-medium">{attachment.name}</p><p className="text-xs text-muted-foreground">{attachmentType}</p></div><Button variant="ghost" size="sm" onClick={() => { setAttachment(null); setAttachmentType(null); }} disabled={sending}>Remove</Button></div> : null}
        <div className="mb-2 flex justify-end gap-1">{["👍", "❤️", "😂", "😮", "😢"].map((item) => <button key={item} type="button" onClick={() => setEmoji(item)} className={`rounded-md px-2 py-1 text-sm hover:bg-surface ${emoji === item ? "bg-surface" : ""}`}>{item}</button>)}</div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFile(file, file.type.startsWith("video/") ? "video" : "image"); event.currentTarget.value = ""; }} />
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" disabled={sending} aria-label="Attach"><Paperclip className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onSelect={() => fileInputRef.current?.click()}><ImageIcon className="mr-2 size-4" />Photo</DropdownMenuItem><DropdownMenuItem onSelect={() => fileInputRef.current?.click()}><FileVideo className="mr-2 size-4" />Video</DropdownMenuItem><DropdownMenuItem onSelect={() => fileInputRef.current?.click()}><ImageIcon className="mr-2 size-4" />Sticker</DropdownMenuItem><DropdownMenuItem onSelect={() => setContactOpen(true)}><Contact className="mr-2 size-4" />Contact</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          <Input value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} placeholder={attachment ? "Add a caption…" : "Type a WhatsApp message…"} className="h-11 min-w-0" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); attachment ? void sendAttachment() : void sendText(); } }} />
          <Button className="h-11 shrink-0 px-4" onClick={() => void (attachment ? sendAttachment() : sendText())} disabled={sending || (!draft.trim() && !attachment)}><Send className="mr-2 size-4" />{sending ? "Sending…" : attachment ? "Send file" : "Send"}</Button>
        </div>
      </div>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}><DialogContent><DialogHeader><DialogTitle>Send contact</DialogTitle></DialogHeader><div className="space-y-4 py-2"><div><label className="text-sm font-medium">Name</label><Input value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="John Doe" className="mt-1" /></div><div><label className="text-sm font-medium">Phone number</label><Input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="+91 98765 43210" className="mt-1" /></div></div><DialogFooter><Button variant="outline" onClick={() => setContactOpen(false)} disabled={sending}>Cancel</Button><Button onClick={() => void sendContact()} disabled={sending || !contactPhone.trim()}>{sending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Contact className="mr-2 size-4" />}{sending ? "Sending…" : "Send contact"}</Button></DialogFooter></DialogContent></Dialog>
    </section>
  );
}
