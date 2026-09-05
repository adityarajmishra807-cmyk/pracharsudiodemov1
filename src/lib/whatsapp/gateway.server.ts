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

type GatewayHealth = {
  ok: boolean;
  service: string;
};

async function gatewayFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const root = baseUrl();
  if (!root) {
    throw new Error(
      "WhatsApp gateway is not configured. Add WHATSAPP_GATEWAY_URL in Vercel server environment variables.",
    );
  }

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
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    throw new Error(
      `Could not reach WhatsApp gateway at ${root}. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;

  if (!response.ok) {
    const detail = data?.error ? `: ${data.error}` : "";
    throw new Error(`WhatsApp gateway HTTP ${response.status}${detail}`);
  }

  return data as T;
}

export const checkWhatsAppGateway = createServerFn({ method: "POST" }).handler(() =>
  gatewayFetch<GatewayHealth>("/health"),
);

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
