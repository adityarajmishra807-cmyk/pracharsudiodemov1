import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileText, Lock, MessageSquare, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatTime, useStore, type Conversation } from "@/lib/store";

const searchSchema = z.object({ c: z.string().optional() });

export const Route = createFileRoute("/_app/inbox")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "WhatsApp inbox — Prachar Studio CRM" },
      {
        name: "description",
        content:
          "Two-pane WhatsApp-style inbox: reply to leads, insert approved templates and assign conversations to your team.",
      },
      { property: "og:title", content: "WhatsApp inbox — Prachar Studio CRM" },
      {
        property: "og:description",
        content: "Reply, assign and manage WhatsApp conversations with your leads.",
      },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  const {
    state,
    can,
    addMessage,
    updateConversation,
    memberName,
    startConversation,
  } = useStore();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const canReply = can("inboxReply");
  const canAssign = can("inboxAssign");
  const conversations = state.conversations;
  const active: Conversation | null =
    conversations.find((c) => c.id === search.c) ?? null;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [active?.messages.length, active?.id]);

  const leadOf = (convo: Conversation) =>
    state.leads.find((l) => l.id === convo.leadId) ?? null;

  if (!canReply && !canAssign) {
    return (
      <div className="space-y-5">
        <PageHeader title="WhatsApp inbox" />
        <EmptyState
          icon={Lock}
          title="No inbox access"
          description="Ask the workspace owner to enable inbox replies or assignment for your account."
        />
      </div>
    );
  }

  if (state.leads.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="WhatsApp inbox"
          description="Conversations are created from your leads."
        />
        <EmptyState
          icon={MessageSquare}
          title="No conversations yet"
          description="Add a lead first, then start a chat from the lead profile. Real conversations only — nothing is pre-filled."
          action={
            <Button asChild>
              <Link to="/leads">Go to leads</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const send = () => {
    if (!active || !draft.trim()) return;
    addMessage(active.id, "out", draft.trim());
    setDraft("");
  };

  const templates = state.templates.filter((t) => t.status !== "paused");

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp inbox"
        description="Replies are stored locally so you can demo real conversations."
      />

      <div className="grid overflow-hidden rounded-lg border border-border bg-card lg:h-[calc(100svh-13rem)] lg:grid-cols-[320px_1fr]">
        {/* List */}
        <aside
          className={`border-border lg:border-r ${active ? "hidden lg:block" : "block"} lg:overflow-y-auto`}
        >
          {conversations.length === 0 ? (
            <div className="p-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                No chats started. Pick a lead below to open its first conversation.
              </p>
              <ul className="mt-3 space-y-2">
                {state.leads.map((lead) => (
                  <li key={lead.id}>
                    <button
                      type="button"
                      className="min-h-11 w-full rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40"
                      onClick={() => {
                        const convo = startConversation(lead.id);
                        void navigate({ search: { c: convo.id } });
                      }}
                    >
                      <span className="block truncate font-medium">{lead.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {lead.phone || "No number saved"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {conversations.map((convo) => {
                const lead = leadOf(convo);
                const last = convo.messages[convo.messages.length - 1];
                return (
                  <li key={convo.id}>
                    <button
                      type="button"
                      onClick={() => void navigate({ search: { c: convo.id } })}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        active?.id === convo.id ? "bg-primary/10" : "hover:bg-surface"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-navy">
                          {lead?.name ?? "Unknown lead"}
                        </span>
                        <StatusBadge value={convo.status} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {last
                          ? `${last.direction === "out" ? "You: " : ""}${last.text}`
                          : "No messages yet"}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Thread */}
        <section className={`flex min-h-[60svh] flex-col ${active ? "flex" : "hidden lg:flex"}`}>
          {!active ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center">
              <p className="max-w-xs text-sm text-muted-foreground">
                Select a conversation to see the thread.
              </p>
            </div>
          ) : (
            <>
              <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Back to conversations"
                  onClick={() => void navigate({ search: {} })}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">
                    {leadOf(active)?.name ?? "Unknown lead"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {memberName(active.assignedTo)} · {active.status}
                  </p>
                </div>
                {canAssign ? (
                  <Select
                    value={active.assignedTo ?? "unassigned"}
                    onValueChange={(v) =>
                      updateConversation(active.id, {
                        assignedTo: v === "unassigned" ? null : v,
                      })
                    }
                  >
                    <SelectTrigger className="h-9 w-36" aria-label="Assign conversation">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      <SelectItem value="owner">Owner</SelectItem>
                      {state.members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {canAssign ? (
                  <Select
                    value={active.status}
                    onValueChange={(v) =>
                      updateConversation(active.id, {
                        status: v as Conversation["status"],
                      })
                    }
                  >
                    <SelectTrigger className="h-9 w-28" aria-label="Conversation status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : null}
              </header>

              <div className="flex-1 space-y-2 overflow-y-auto bg-surface p-3">
                {active.messages.length === 0 ? (
                  <p className="mx-auto max-w-xs pt-10 text-center text-sm text-muted-foreground">
                    No messages in this chat yet. Send the first one below.
                  </p>
                ) : (
                  active.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-lg px-3 py-2 text-sm break-words ${
                          m.direction === "out"
                            ? "bg-navy text-white"
                            : "border border-border bg-card text-foreground"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{m.text}</p>
                        <p
                          className={`mt-1 text-[11px] ${m.direction === "out" ? "text-white/60" : "text-muted-foreground"}`}
                        >
                          {formatTime(m.at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={endRef} />
              </div>

              {canReply ? (
                <div className="flex items-end gap-2 border-t border-border p-2.5">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" aria-label="Insert template">
                        <FileText className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      <DropdownMenuLabel>Insert template</DropdownMenuLabel>
                      {templates.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">
                          No templates created yet.
                        </p>
                      ) : (
                        templates.map((t) => (
                          <DropdownMenuItem
                            key={t.id}
                            onSelect={() => {
                              const lead = leadOf(active);
                              setDraft(
                                t.body.replace(/\{\{name\}\}/g, lead?.name ?? "there"),
                              );
                            }}
                          >
                            <span className="truncate">{t.name}</span>
                          </DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Input
                    className="h-11"
                    placeholder="Type a message"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    aria-label="Message"
                  />
                  <Button
                    size="icon"
                    className="size-11 shrink-0"
                    onClick={send}
                    aria-label="Send message"
                  >
                    <Send className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="hidden h-11 sm:inline-flex"
                    onClick={() => {
                      if (!draft.trim()) {
                        toast.error("Type the customer reply first");
                        return;
                      }
                      addMessage(active.id, "in", draft.trim());
                      setDraft("");
                    }}
                  >
                    Log incoming
                  </Button>
                </div>
              ) : (
                <p className="border-t border-border p-3 text-center text-xs text-muted-foreground">
                  You can view and assign this chat, but replying is disabled for your
                  account.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
