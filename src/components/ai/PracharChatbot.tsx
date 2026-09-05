import { useServerFn } from "@tanstack/react-start";
import { Bot, ChevronRight, Loader2, MessageCircle, RotateCcw, Send, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { buildPracharContext } from "@/lib/ai/context";
import { chatWithGeminiServer } from "@/lib/ai/chat.server";
import type { ChatMessage } from "@/lib/ai/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/lib/store";
import { useRouterState } from "@tanstack/react-router";

type UiMessage = ChatMessage & { id: string };

const starterPrompts = [
  "Give me a quick workspace summary.",
  "How many leads are qualified?",
  "What campaigns are currently running?",
  "What can you help me with in Prachar Studio?",
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

export function PracharChatbot() {
  const { state } = useStore();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const callGemini = useServerFn(chatWithGeminiServer);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: "welcome",
      role: "model",
      content:
        "Hi — I’m Prachar AI. I can help you understand your workspace, leads, conversations, campaigns, templates, automations and analytics. I’m read-only right now.",
    },
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, sending, open]);

  const resetChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "model",
        content:
          "Hi — I’m Prachar AI. I can help you understand your workspace, leads, conversations, campaigns, templates, automations and analytics. I’m read-only right now.",
      },
    ]);
    setDraft("");
    setError(null);
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || sending) return;

    const history = messages.map(({ role, content: message }) => ({
      role,
      content: message,
    }));
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

      setMessages((current) => [
        ...current,
        { id: makeId(), role: "model", content: result.text },
      ]);
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
                    Read-only
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
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "rounded-br-md bg-navy text-white"
                        : "rounded-bl-md border border-border bg-card text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {message.role === "model" ? renderAssistantText(message.content) : message.content}
                    </p>
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
                <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Try asking
                </p>
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
              <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
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
              <Button
                size="icon"
                className="size-10 shrink-0 rounded-lg"
                onClick={() => void send()}
                disabled={!draft.trim() || sending}
                aria-label="Send message"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>
            <div className="mt-1.5 flex items-center justify-end px-1 text-[10px] text-muted-foreground">
              <span>Enter to send · Shift+Enter for a new line</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
