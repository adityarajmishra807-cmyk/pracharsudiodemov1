import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
  ApiEnvelope,
  WhatsAppChat,
  WhatsAppHealth,
  WhatsAppMessage,
  WhatsAppMessageInput,
  WhatsAppSession,
} from "./types";

const backendUrl = () =>
  (process.env.WHATSAPP_BACKEND_URL || process.env.WHATSAPP_GATEWAY_URL || "").replace(/\/$/, "");
const backendKey = () =>
  process.env.WHATSAPP_BACKEND_API_KEY || process.env.WHATSAPP_GATEWAY_SECRET || "";

const SessionId = z.string().regex(/^[A-Za-z0-9_-]{1,120}$/);
const Jid = z.string().min(1).max(200);
const Pagination = z.object({ before: z.string().optional(), limit: z.number().int().min(1).max(200).optional() });
const SendText = z.object({ sessionId: SessionId, jid: Jid, text: z.string().trim().min(1).max(4096), quotedMessageId: z.string().optional() });
const ChatAction = z.object({ sessionId: SessionId, jid: Jid, action: z.enum(["archive", "pin", "mute", "markRead", "markUnread"]), value: z.union([z.boolean(), z.number(), z.null()]).optional() });
const ReadInput = z.object({ sessionId: SessionId, jid: Jid, messageIds: z.array(z.string().min(1)).min(1).max(100) });
const MessageAction = z.object({ sessionId: SessionId, jid: Jid, messageId: z.string().min(1).max(200) });
const MessageReaction = MessageAction.extend({ emoji: z.string().min(1).max(16) });

class WhatsAppApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "WhatsAppApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const root = backendUrl();
  if (!root) {
    throw new WhatsAppApiError(
      "WhatsApp backend is not configured. Set WHATSAPP_BACKEND_URL (or WHATSAPP_GATEWAY_URL) in Vercel.",
      500,
    );
  }

  try {
    const response = await fetch(`${root}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(backendKey() ? { authorization: `Bearer ${backendKey()}` } : {}),
        ...(init?.headers || {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    const body = await response.json().catch(() => null) as (T & { error?: string; message?: string }) | null;
    if (!response.ok) {
      throw new WhatsAppApiError(
        body?.error || body?.message || `WhatsApp backend returned HTTP ${response.status}`,
        response.status,
        body,
      );
    }
    return body as T;
  } catch (error) {
    if (error instanceof WhatsAppApiError) throw error;
    throw new WhatsAppApiError(
      `Could not reach WhatsApp backend at ${root}: ${error instanceof Error ? error.message : String(error)}`,
      503,
    );
  }
}

export const checkWhatsAppBackend = createServerFn({ method: "POST" }).handler(() =>
  request<WhatsAppHealth>("/health"),
);

export const listWhatsAppSessions = createServerFn({ method: "POST" }).handler(async () => {
  const response = await request<ApiEnvelope<WhatsAppSession[]>>("/api/sessions");
  return response.data;
});

export const startWhatsAppSession = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ sessionId: SessionId }).parse(value))
  .handler(({ data }) =>
    request<{ success: boolean; message?: string }>(`/api/sessions/${encodeURIComponent(data.sessionId)}/start`, { method: "POST" }),
  );

export const getWhatsAppSessionStatus = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ sessionId: SessionId }).parse(value))
  .handler(async ({ data }) => {
    const response = await request<ApiEnvelope<WhatsAppSession>>( 
      `/api/sessions/${encodeURIComponent(data.sessionId)}/status`,
    );
    return response.data;
  });

export const logoutWhatsAppSession = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ sessionId: SessionId }).parse(value))
  .handler(({ data }) =>
    request<{ success: boolean; message?: string }>(`/api/sessions/${encodeURIComponent(data.sessionId)}/logout`, { method: "POST" }),
  );

export const deleteWhatsAppSession = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ sessionId: SessionId }).parse(value))
  .handler(({ data }) =>
    request<{ success: boolean; message?: string }>(`/api/sessions/${encodeURIComponent(data.sessionId)}`, { method: "DELETE" }),
  );

export const listWhatsAppChats = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ sessionId: SessionId }).parse(value))
  .handler(async ({ data }) => {
    const response = await request<ApiEnvelope<WhatsAppChat[]>>(`/api/chats/${encodeURIComponent(data.sessionId)}`);
    return response.data;
  });

export const getWhatsAppChat = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ sessionId: SessionId, jid: Jid }).parse(value))
  .handler(async ({ data }) => {
    const response = await request<ApiEnvelope<WhatsAppChat>>(
      `/api/chats/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}`,
    );
    return response.data;
  });

export const updateWhatsAppChat = createServerFn({ method: "POST" })
  .validator((value: unknown) => ChatAction.parse(value))
  .handler(({ data }) =>
    request<{ success: boolean }>(
      `/api/chats/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}`,
      { method: "PATCH", body: JSON.stringify({ action: data.action, value: data.value }) },
    ),
  );

export const getWhatsAppHistory = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ sessionId: SessionId, jid: Jid, ...Pagination.shape }).parse(value))
  .handler(async ({ data }) => {
    const params = new URLSearchParams();
    if (data.before) params.set("before", data.before);
    if (data.limit) params.set("limit", String(data.limit));
    const suffix = params.toString() ? `?${params}` : "";
    const response = await request<ApiEnvelope<WhatsAppMessage[]>>(
      `/api/messages/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}/history${suffix}`,
    );
    return response.data;
  });

export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .validator((value: unknown) => SendText.parse(value))
  .handler(async ({ data }) => {
    const payload: WhatsAppMessageInput = {
      type: "text",
      text: data.text,
      ...(data.quotedMessageId ? { quotedMessageId: data.quotedMessageId } : {}),
    };
    return request<ApiEnvelope<WhatsAppMessage>>(
      `/api/messages/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}/send`,
      { method: "POST", body: JSON.stringify(payload) },
    );
  });

export const markWhatsAppMessagesRead = createServerFn({ method: "POST" })
  .validator((value: unknown) => ReadInput.parse(value))
  .handler(({ data }) =>
    request<{ success: boolean }>(
      `/api/messages/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}/read`,
      { method: "POST", body: JSON.stringify({ messageIds: data.messageIds }) },
    ),
  );

export const editWhatsAppMessage = createServerFn({ method: "POST" })
  .validator((value: unknown) => MessageAction.extend({ text: z.string().trim().min(1).max(4096) }).parse(value))
  .handler(({ data }) =>
    request<ApiEnvelope<WhatsAppMessage>>(
      `/api/messages/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}/${encodeURIComponent(data.messageId)}`,
      { method: "PATCH", body: JSON.stringify({ text: data.text }) },
    ),
  );

export const deleteWhatsAppMessage = createServerFn({ method: "POST" })
  .validator((value: unknown) => MessageAction.parse(value))
  .handler(({ data }) =>
    request<ApiEnvelope<WhatsAppMessage>>(
      `/api/messages/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}/${encodeURIComponent(data.messageId)}`,
      { method: "DELETE" },
    ),
  );

export const reactToWhatsAppMessage = createServerFn({ method: "POST" })
  .validator((value: unknown) => MessageReaction.parse(value))
  .handler(({ data }) =>
    request<ApiEnvelope<WhatsAppMessage>>(
      `/api/messages/${encodeURIComponent(data.sessionId)}/${encodeURIComponent(data.jid)}/${encodeURIComponent(data.messageId)}/react`,
      { method: "POST", body: JSON.stringify({ emoji: data.emoji }) },
    ),
  );

export type { WhatsAppApiError };
