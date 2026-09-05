import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const baseUrl = () => (process.env.WHATSAPP_GATEWAY_URL || "").replace(/\/$/, "");
const secret = () => process.env.WHATSAPP_GATEWAY_SECRET || "";
const SessionSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/) });

type GatewayResponse = {
  id: string;
  status: string;
  qr: string | null;
  phoneNumber: string | null;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  error: string | null;
};

async function gatewayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const root = baseUrl();
  if (!root) {
    throw new Error(
      "WhatsApp gateway is not configured. Add WHATSAPP_GATEWAY_URL in Vercel server environment variables.",
    );
  }

  const response = await fetch(`${root}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(secret() ? { authorization: `Bearer ${secret()}` } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(data?.error || `WhatsApp gateway returned ${response.status}`);
  }

  return data as T;
}

export const startWhatsAppSession = createServerFn({ method: "POST" })
  .validator((value: unknown) => SessionSchema.parse(value))
  .handler(({ data }) =>
    gatewayFetch<GatewayResponse>("/api/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  );

export const getWhatsAppSession = createServerFn({ method: "POST" })
  .validator((value: unknown) => SessionSchema.parse(value))
  .handler(({ data }) =>
    gatewayFetch<GatewayResponse>(
      `/api/sessions/${encodeURIComponent(data.id)}`,
    ),
  );

export const reconnectWhatsAppSession = createServerFn({ method: "POST" })
  .validator((value: unknown) => SessionSchema.parse(value))
  .handler(({ data }) =>
    gatewayFetch<GatewayResponse>(
      `/api/sessions/${encodeURIComponent(data.id)}/reconnect`,
      { method: "POST" },
    ),
  );

export const removeWhatsAppSession = createServerFn({ method: "POST" })
  .validator((value: unknown) => SessionSchema.parse(value))
  .handler(({ data }) =>
    gatewayFetch<{ ok: true }>(
      `/api/sessions/${encodeURIComponent(data.id)}`,
      { method: "DELETE" },
    ),
  );
