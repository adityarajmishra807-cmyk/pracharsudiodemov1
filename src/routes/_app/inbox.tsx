import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, CheckCheck, MessageSquare, RefreshCw, Send, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listWhatsAppChats, markWhatsAppChatRead, sendWhatsAppMessage, type GatewayChat } from "@/lib/whatsapp/inbox.server";

type WhatsAppAccount = { id: string; displayName: string; phoneNumber: string; status: string };
const ACCOUNT_KEY = "prachar-whatsapp-accounts-v2";
const searchSchema = z.object({ c: z.string().optional() });

export const Route = createFileRoute("/_app/inbox")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "WhatsApp Inbox — Prachar Studio" },
      { name: "description", content: "Receive and send WhatsApp messages from connected accounts." },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [chats, setChats] = useState<GatewayChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeChat = useMemo(() => chats.find((chat) => chat.id === search.c) ?? chats[0] ?? null, [chats, search.c]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACCOUNT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as WhatsAppAccount[];
      const ready = parsed.filter((account) => account.status === "READY");
      setAccounts(ready);
      if (ready[0]) setAccountId(ready[0].id);
    } catch {
      setAccounts([]);
    }
  }, []);

  const loadChats = async () => {
    if (!accountId) {
      setChats([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await listWhatsAppChats({ data: { accountId } });
      setChats(result.chats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load WhatsApp chats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChats();
    const timer = window.setInterval(() => void loadChats(), 3000);
    return () => window.clearInterval(timer);
  }, [accountId]);

  useEffect(() => {
    if (!activeChat) return;
    void markWhatsAppChatRead({ data: { id: activeChat.id } });
    setChats((current) => current.map((chat) => chat.id === activeChat.id ? { ...chat, unread: 0 } : chat));
  }, [activeChat?.id]);

  const send = async () => {
    if (!activeChat || !draft.trim() || sending) return;
    setSending(true);
    const text = draft.trim();
    try {
      const result = await sendWhatsAppMessage({ data: { id: activeChat.id, text } });
      setChats((current) => current.map((chat) => chat.id === activeChat.id ? result.chat : chat));
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send WhatsApp message");
    } finally {
      setSending(false);
    }
  };

  if (accounts.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="WhatsApp Inbox" description="Receive and send messages from connected WhatsApp accounts." />
        <EmptyState icon={Smartphone} title="No connected WhatsApp accounts" description="Connect a WhatsApp account in WhatsApp Manager, then return here to use the live inbox." />
      </div>
    );
  }

  const selectedAccount = accounts.find((account) => account.id === accountId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp Inbox"
        description="Live conversations from your connected WhatsApp account."
        actions={
          <div className="flex items-center gap-2">
            <Select value={accountId} onValueChange={(value) => { setAccountId(value); void navigate({ search: {} }); }}>
              <SelectTrigger className="w-56" aria-label="WhatsApp account"><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.displayName}{account.phoneNumber ? ` · ${account.phoneNumber}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => void loadChats()} disabled={loading} aria-label="Refresh chats"><RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} /></Button>
          </div>
        }
      />

      {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

      <div className="grid overflow-hidden rounded-xl border border-border bg-card lg:h-[calc(100svh-12.5rem)] lg:grid-cols-[340px_1fr]">
        <aside className={`border-border lg:border-r ${activeChat ? "hidden lg:block" : "block"} overflow-y-auto`}>
          <div className="border-b border-border px-4 py-3"><p className="text-xs font-medium uppercase text-muted-foreground">Account</p><p className="mt-1 font-semibold text-navy">{selectedAccount?.displayName}</p></div>
          {loading && chats.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground"><RefreshCw className="mx-auto size-5 animate-spin" /><p className="mt-2">Loading conversations…</p></div> : chats.length === 0 ? <div className="p-8 text-center"><MessageSquare className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 font-medium text-navy">No conversations yet</p><p className="mt-1 text-sm text-muted-foreground">Send a WhatsApp message to this account and incoming chats will appear here.</p></div> : <ul className="divide-y divide-border">{chats.map((chat) => <li key={chat.id}><button type="button" className={`w-full px-4 py-3 text-left hover:bg-surface ${activeChat?.id === chat.id ? "bg-primary/10" : ""}`} onClick={() => void navigate({ search: { c: chat.id } })}><div className="flex items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">{chat.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="truncate font-semibold text-navy">{chat.name}</span>{chat.unread > 0 ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">{chat.unread}</span> : null}</div><p className="mt-0.5 truncate text-xs text-muted-foreground">{chat.lastMessage}</p></div></div></button></li>)}</ul>}
        </aside>

        <section className={`flex min-h-[65svh] flex-col ${activeChat ? "flex" : "hidden lg:flex"}`}>
          {!activeChat ? <div className="flex flex-1 items-center justify-center p-8 text-center"><div><MessageSquare className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 font-medium text-navy">Select a conversation</p></div></div> : <>
            <header className="flex items-center gap-3 border-b border-border px-4 py-3"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => void navigate({ search: {} })} aria-label="Back to conversations"><ArrowLeft className="size-4" /></Button><div className="flex size-10 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">{activeChat.name.slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate font-semibold text-navy">{activeChat.name}</p><p className="text-xs text-muted-foreground">{activeChat.phoneNumber}</p></div></header>
            <div className="flex-1 overflow-y-auto bg-surface p-4 space-y-2">{activeChat.messages.map((message) => <div key={message.id} className={`flex ${message.direction === "out" ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${message.direction === "out" ? "rounded-br-md bg-navy text-white" : "rounded-bl-md border border-border bg-card text-foreground"}`}><p className="whitespace-pre-wrap break-words">{message.text}</p><div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-60"><span>{new Date(message.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>{message.direction === "out" ? <CheckCheck className="size-3" /> : null}</div></div></div>)}</div>
            <div className="flex items-center gap-2 border-t border-border p-3"><Input className="h-11" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Type a WhatsApp message…" disabled={sending} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} /><Button className="h-11 px-4" onClick={() => void send()} disabled={!draft.trim() || sending}><Send className="mr-2 size-4" />{sending ? "Sending…" : "Send"}</Button></div>
          </>}
        </section>
      </div>
    </div>
  );
}
