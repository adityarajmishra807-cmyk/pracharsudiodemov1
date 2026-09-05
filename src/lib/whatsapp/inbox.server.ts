import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const baseUrl = () => (process.env.WHATSAPP_GATEWAY_URL || "").replace(/\/$/, "");
const secret = () => process.env.WHATSAPP_GATEWAY_SECRET || "";
const IdSchema = z.object({ id: z.string().min(1).max(200) });
const AccountSchema = z.object({ accountId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/).optional() });
const SendSchema = z.object({ id: z.string().min(1).max(200), text: z.string().trim().min(1).max(4096) });

type GatewayMessage = {
  id: string;
  accountId: string;
  chatId: string;
  from: string;
  to: string;
  direction: "in" | "out";
  text: string;
  at: string;
  status: "received" | "sent" | "failed";
};

type GatewayChat = {
  id: string;
  accountId: string;
  phoneNumber: string;
  name: string;
  unread: number;
  lastMessage: string;
  lastMessageAt: string;
  messages: GatewayMessage[];
};

async function gatewayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const root = baseUrl();
  if (!root) throw new Error("WhatsApp gateway is not configured.");
  let response: Response;
  try {
    response = await fetch(`${root}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(secret() ? { authorization: `Bearer ${secret()}` } : {}),
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    throw new Error(`Could not reach WhatsApp gateway: ${error instanceof Error ? error.message : String(error)}`);
  }
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(data?.error || `WhatsApp gateway HTTP ${response.status}`);
  return data as T;
}

export const listWhatsAppChats = createServerFn({ method: "POST" })
  .validator((value: unknown) => AccountSchema.parse(value ?? {}))
  .handler(({ data }) => gatewayFetch<{ chats: GatewayChat[] }>(data.accountId ? `/api/chats?accountId=${encodeURIComponent(data.accountId)}` : "/api/chats"));

export const getWhatsAppChat = createServerFn({ method: "POST" })
  .validator((value: unknown) => IdSchema.parse(value))
  .handler(({ data }) => gatewayFetch<GatewayChat>(`/api/chats/${encodeURIComponent(data.id)}`));

export const markWhatsAppChatRead = createServerFn({ method: "POST" })
  .validator((value: unknown) => IdSchema.parse(value))
  .handler(({ data }) => gatewayFetch<GatewayChat>(`/api/chats/${encodeURIComponent(data.id)}/read`, { method: "POST" }));

export const sendWhatsAppMessage = createServerFn({ method: "POST" })
  .validator((value: unknown) => SendSchema.parse(value))
  .handler(({ data }) => gatewayFetch<{ message: GatewayMessage; chat: GatewayChat }>(`/api/chats/${encodeURIComponent(data.id)}/messages`, { method: "POST", body: JSON.stringify({ text: data.text }) }));

export type { GatewayChat, GatewayMessage };
