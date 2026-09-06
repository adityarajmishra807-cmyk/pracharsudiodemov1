import { Loader2, MessageSquare, RefreshCw, Smartphone } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { WhatsAppAccountSelect } from "@/components/whatsapp/WhatsAppAccountSelect";
import { WhatsAppChatList } from "@/components/whatsapp/WhatsAppChatList";
import { WhatsAppChatThreadRich } from "@/components/whatsapp/WhatsAppChatThreadRich";
import { useWhatsAppChats, useWhatsAppMessages, useWhatsAppSessions } from "@/lib/whatsapp";

const searchSchema = z.object({ account: z.string().optional(), chat: z.string().optional() });

export const Route = createFileRoute("/_app/inbox")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "WhatsApp Inbox — Prachar Studio" }, { name: "description", content: "Live conversations from connected WhatsApp accounts." }] }),
  component: InboxPage,
});

function InboxPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { sessions, loading: sessionsLoading, refreshing: sessionsRefreshing, error: sessionsError, refresh: refreshSessions } = useWhatsAppSessions({ pollMs: 8000 });
  const readySessions = useMemo(() => sessions.filter((session) => session.status === "open"), [sessions]);
  const accountId = readySessions.some((session) => session.sessionId === search.account) ? search.account! : readySessions[0]?.sessionId || "";
  const activeSession = readySessions.find((session) => session.sessionId === accountId) || null;
  const { chats, loading: chatsLoading, refreshing: chatsRefreshing, error: chatsError, refresh: refreshChats } = useWhatsAppChats(activeSession?.sessionId || null, { pollMs: 7000 });
  const activeJid = chats.some((chat) => chat.jid === search.chat) ? search.chat! : chats[0]?.jid || null;
  const activeChat = chats.find((chat) => chat.jid === activeJid) || null;
  const { messages, loading: messagesLoading, loadingOlder: messagesLoadingOlder, refreshing: messagesRefreshing, hasMore: messagesHasMore, error: messagesError, refresh: refreshMessages, loadOlder: loadOlderMessages } = useWhatsAppMessages(activeSession?.sessionId || null, activeJid, { pollMs: 6000, limit: 100 });
  const [pageError, setPageError] = useState<string | null>(null);

  useEffect(() => {
    if (!accountId || search.account === accountId) return;
    void navigate({ search: { account: accountId, chat: undefined } });
  }, [accountId, navigate, search.account]);

  useEffect(() => {
    if (!activeJid || search.chat === activeJid) return;
    void navigate({ search: { account: accountId || undefined, chat: activeJid } });
  }, [accountId, activeJid, navigate, search.chat]);

  const refreshAll = useCallback(async () => {
    if (sessionsRefreshing || chatsRefreshing || messagesRefreshing) return;
    setPageError(null);
    try {
      await refreshSessions();
      await refreshChats();
      await refreshMessages();
    } catch (value) {
      setPageError(value instanceof Error ? value.message : "Could not refresh WhatsApp inbox.");
    }
  }, [chatsRefreshing, messagesRefreshing, refreshChats, refreshMessages, refreshSessions, sessionsRefreshing]);

  const error = pageError || sessionsError || chatsError || messagesError;
  const inboxRefreshing = sessionsRefreshing || chatsRefreshing || messagesRefreshing;

  if (sessionsLoading && sessions.length === 0) {
    return <div className="space-y-5"><PageHeader title="WhatsApp Inbox" /><EmptyState icon={Loader2} title="Loading WhatsApp accounts" description="Connecting to the WhatsApp backend…" /></div>;
  }

  if (sessions.length === 0) {
    return <div className="space-y-5"><PageHeader title="WhatsApp Inbox" description="Live conversations from the Baileys backend." /><EmptyState icon={Smartphone} title="No WhatsApp sessions" description="Connect a WhatsApp number in WhatsApp Manager first." /></div>;
  }

  if (readySessions.length === 0) {
    return <div className="space-y-5"><PageHeader title="WhatsApp Inbox" description="Live conversations from the Baileys backend." /><EmptyState icon={MessageSquare} title="No connected WhatsApp numbers" description="Open WhatsApp Manager and scan a QR code. Once the account is Ready, it will appear here." /></div>;
  }

  return (
    <div className="space-y-4" aria-busy={inboxRefreshing || sessionsLoading || chatsLoading || messagesLoading}>
      <PageHeader
        title="WhatsApp Inbox"
        description="Live conversations from your connected WhatsApp accounts."
        actions={<div className="flex w-full items-center gap-2 sm:w-auto"><WhatsAppAccountSelect sessions={readySessions} value={accountId} loading={sessionsLoading || sessionsRefreshing} onChange={(value) => void navigate({ search: { account: value, chat: undefined } })} /><Button variant="outline" size="icon" onClick={() => void refreshAll()} disabled={inboxRefreshing} aria-label="Refresh inbox">{inboxRefreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}</Button></div>}
      />

      {error ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive break-words">{error}</div> : null}

      <div className="grid min-h-0 overflow-hidden rounded-xl border border-border bg-card lg:h-[calc(100svh-12.5rem)] lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className={`min-h-0 overflow-y-auto border-border lg:border-r ${activeChat ? "hidden lg:block" : "block"}`}>
          <WhatsAppChatList chats={chats} selectedJid={activeJid} loading={chatsLoading} refreshing={chatsRefreshing} onSelect={(jid) => void navigate({ search: { account: accountId, chat: jid } })} />
        </aside>
        <section className={`flex min-h-0 min-w-0 ${activeChat ? "flex" : "hidden lg:flex"}`}>
          <WhatsAppChatThreadRich
            sessionId={activeSession!.sessionId}
            chat={activeChat}
            messages={messages}
            loading={messagesLoading}
            loadingOlder={messagesLoadingOlder}
            hasMore={messagesHasMore}
            refreshing={messagesRefreshing}
            onBack={() => void navigate({ search: { account: accountId, chat: undefined } })}
            onRefresh={refreshMessages}
            onLoadOlder={loadOlderMessages}
          />
        </section>
      </div>
    </div>
  );
}
