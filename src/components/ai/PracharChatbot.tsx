import { useServerFn } from "@tanstack/react-start";
import {
  Bot,
  Check,
  ChevronRight,
  Loader2,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { buildPracharContext } from "@/lib/ai/context";
import { chatWithGeminiServer } from "@/lib/ai/chat.server";
import type { ChatMessage, PracharAction } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { useRouterState } from "@tanstack/react-router";

type UiMessage = ChatMessage & { id: string };

type PendingAction = {
  action: PracharAction;
  sourceMessageId: string;
};

const starterPrompts = [
  "Give me a quick workspace summary.",
  "How many leads are qualified?",
  "Create a follow-up template for new leads.",
  "Create a draft campaign for qualified leads.",
];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function renderAssistantText(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${index}-${part}`}>{part}</span>;
  });
}

function actionTitle(action: PracharAction) {
  switch (action.name) {
    case "create_template":
      return "Create message template";
    case "create_lead":
      return "Create CRM lead";
    case "update_lead_status":
      return "Update lead status";
    case "create_campaign":
      return "Create draft campaign";
    case "create_automation":
      return "Create draft automation";
  }
}

function actionPermission(action: PracharAction) {
  switch (action.name) {
    case "create_template":
      return "templatesManage" as const;
    case "create_lead":
    case "update_lead_status":
      return "leadsEdit" as const;
    case "create_campaign":
      return "campaigns" as const;
    case "create_automation":
      return "automations" as const;
  }
}

function ActionCard({
  pending,
  onApply,
  onCancel,
}: {
  pending: PendingAction;
  onApply: () => void;
  onCancel: () => void;
}) {
  const { action } = pending;
  const { can, isOwner } = useStore();
  const permission = actionPermission(action);
  const allowed = isOwner || can(permission);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.04]">
      <div className="border-b border-primary/10 px-3.5 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">{actionTitle(action)}</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Review the changes before they are applied to Prachar.</p>
      </div>

      <div className="space-y-2 px-3.5 py-3 text-sm">
        {action.name === "create_template" ? (
          <>
            <div><span className="font-medium">Name:</span> {action.args.name}</div>
            <div><span className="font-medium">Category:</span> {action.args.category}</div>
            <div>
              <span className="font-medium">Message:</span>
              <div className="mt-1 rounded-lg border border-border bg-card p-2.5 whitespace-pre-wrap break-words text-xs leading-relaxed">
                {action.args.body}
              </div>
            </div>
          </>
        ) : null}

        {action.name === "create_lead" ? (
          <>
            <div><span className="font-medium">Name:</span> {action.args.name}</div>
            {action.args.phone ? <div><span className="font-medium">Phone:</span> {action.args.phone}</div> : null}
            {action.args.email ? <div><span className="font-medium">Email:</span> {action.args.email}</div> : null}
            {action.args.company ? <div><span className="font-medium">Company:</span> {action.args.company}</div> : null}
            <div><span className="font-medium">Status:</span> {action.args.status}</div>
          </>
        ) : null}

        {action.name === "update_lead_status" ? (
          <>
            <div><span className="font-medium">Lead:</span> {action.args.leadId}</div>
            <div><span className="font-medium">New status:</span> {action.args.status}</div>
          </>
        ) : null}

        {action.name === "create_campaign" ? (
          <>
            <div><span className="font-medium">Name:</span> {action.args.name}</div>
            <div><span className="font-medium">Status:</span> {action.args.status}</div>
            <div><span className="font-medium">Audience:</span> {action.args.audienceStatus}{action.args.audienceTag ? ` · #${action.args.audienceTag}` : ""}</div>
          </>
        ) : null}

        {action.name === "create_automation" ? (
          <div><span className="font-medium">Name:</span> {action.args.name}</div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-primary/10 px-3.5 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="mr-1.5 size-4" aria-hidden="true" />
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={onApply} disabled={!allowed}>
          <Check className="mr-1.5 size-4" aria-hidden="true" />
          {allowed ? "Apply" : "Permission required"}
        </Button>
      </div>
    </div>
  );
}

export function PracharChatbot() {
  const { state, isOwner, can, addTemplate, addLead, updateLead, addCampaign, addAutomation } = useStore();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const callGemini = useServerFn(chatWithGeminiServer);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: "welcome",
      role: "model",
      content:
        "Hi — I’m Prachar AI. I can understand your workspace and help create and manage CRM content. Actions are always shown for your review before anything is changed.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, sending, pendingAction, open]);

  const resetChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "model",
        content:
          "Hi — I’m Prachar AI. I can understand your workspace and help create and manage CRM content. Actions are always shown for your review before anything is changed.",
      },
    ]);
    setDraft("");
    setError(null);
    setPendingAction(null);
  };

  const applyAction = () => {
    if (!pendingAction) return;
    const { action } = pendingAction;
    const permission = actionPermission(action);
    if (!isOwner && !can(permission)) {
      setError("You don't have permission to apply this action.");
      return;
    }

    try {
      switch (action.name) {
        case "create_template":
          addTemplate({ name: action.args.name, category: action.args.category, status: "draft", body: action.args.body });
          break;
        case "create_lead":
          addLead({
            name: action.args.name,
            phone: action.args.phone,
            email: action.args.email,
            company: action.args.company,
            source: action.args.source,
            status: action.args.status,
            tags: action.args.tags,
            assignedTo: null,
            notes: action.args.notes,
          });
          break;
        case "update_lead_status":
          if (!state.leads.some((lead) => lead.id === action.args.leadId)) {
            throw new Error("That lead could not be found in the current workspace.");
          }
          updateLead(action.args.leadId, { status: action.args.status }, `Status updated by Prachar AI to ${action.args.status}`);
          break;
        case "create_campaign":
          addCampaign({
            name: action.args.name,
            audience: { status: action.args.audienceStatus, tag: action.args.audienceTag, leadIds: [] },
            templateId: action.args.templateId,
            status: "draft",
          });
          break;
        case "create_automation":
          addAutomation(action.args.name);
          break;
      }

      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: "model",
          content: `${actionTitle(action)} applied successfully.`,
        },
      ]);
      setPendingAction(null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to apply the action.");
    }
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;

    const history = messages.map(({ role, content: message }) => ({ role, content: message }));
    const userMessage: UiMessage = { id: makeId(), role: "user", content };

    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const result = await callGemini({
        data: {
          message: content,
          history,
          context: buildPracharContext(state, pathname),
        },
      });

      if (result.action) {
        setPendingAction({ action: result.action, sourceMessageId: userMessage.id });
        setMessages((current) => [
          ...current,
          {
            id: makeId(),
            role: "model",
            content: "I prepared this change for your review.",
          },
        ]);
      } else {
        setMessages((current) => [
          ...current,
          { id: makeId(), role: "model", content: result.text },
        ]);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to contact Prachar AI";
      setError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Open Prachar AI"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-20 z-40 flex size-14 items-center justify-center rounded-full bg-navy text-white shadow-lg ring-1 ring-black/10 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:right-5 lg:right-7 lg:bottom-7"
      >
        <MessageCircle className="size-6" aria-hidden="true" />
        <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
          AI
        </span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[30rem]">
          <SheetHeader className="border-b border-border px-5 py-4 text-left">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-navy text-white">
                <Bot className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <SheetTitle className="flex items-center gap-2 text-navy">
                  Prachar AI
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <Sparkles className="size-3" aria-hidden="true" />
                    Actions enabled
                  </span>
                </SheetTitle>
                <SheetDescription>
                  Workspace-aware assistant · {pathname.replace("/", "") || "home"}
                </SheetDescription>
              </div>
              <Button variant="ghost" size="icon" aria-label="Reset chat" onClick={resetChat}>
                <RotateCcw className="size-4" />
              </Button>
            </div>
          </SheetHeader>

          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-surface px-4 py-4">
            <div className="space-y-3">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      message.role === "user" ? "rounded-br-md bg-navy text-white" : "rounded-bl-md border border-border bg-card text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {message.role === "model" ? renderAssistantText(message.content) : message.content}
                    </p>
                    {pendingAction?.sourceMessageId === message.id ? (
                      <ActionCard pending={pendingAction} onApply={applyAction} onCancel={() => setPendingAction(null)} />
                    ) : null}
                  </div>
                </div>
              ))}

              {sending ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Thinking…
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {messages.length === 1 ? (
              <div className="mt-5 space-y-2">
                <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Try asking</p>
                <div className="grid gap-2">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setDraft(prompt)}
                      className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:border-primary/40"
                    >
                      <ChevronRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span>{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">{error}</div>
            ) : null}
          </div>

          <div className="border-t border-border bg-card p-3">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-background p-1.5 focus-within:border-primary/60">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask Prachar AI…"
                className="min-h-11 resize-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0"
                aria-label="Message Prachar AI"
                rows={1}
                disabled={sending}
              />
              <Button size="icon" className="size-10 shrink-0 rounded-lg" onClick={() => void send()} disabled={!draft.trim() || sending} aria-label="Send message">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
            <div className="mt-1.5 flex items-center justify-end px-1 text-[10px] text-muted-foreground">
              <span>Review is required before CRM changes</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
