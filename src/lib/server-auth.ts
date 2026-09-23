import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { useAppSession } from "../server/session";
import { getLicenseById } from "../server/license-store";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(200),
});

type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function clientKey() {
  const forwarded = getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || getRequestHeader("cf-connecting-ip") || "unknown";
}

function allowedToAttempt(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || now > current.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= MAX_ATTEMPTS) return false;
  current.count += 1;
  return true;
}

function constantTimeEqual(a: string, b: string) {
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

export const ownerLoginFn = createServerFn({ method: "POST" })
  .validator((data) => loginSchema.parse(data))
  .handler(async ({ data }) => {
    const key = clientKey();
    if (!allowedToAttempt(key)) {
      return { ok: false as const, message: "Too many login attempts. Try again later." };
    }

    const configuredEmail = process.env.PRACHAR_OWNER_EMAIL?.trim().toLowerCase();
    const configuredPassword = process.env.PRACHAR_OWNER_PASSWORD;

    if (!configuredEmail || !configuredPassword) {
      throw new Error("Owner credentials are not configured on the server.");
    }

    const valid =
      constantTimeEqual(data.email.toLowerCase(), configuredEmail) &&
      constantTimeEqual(data.password, configuredPassword);

    if (!valid) {
      return { ok: false as const, message: "Invalid owner credentials." };
    }

    attempts.delete(key);
    const session = await useAppSession();
    await session.update({ role: "owner", email: configuredEmail });

    return { ok: true as const };
  });

export const logoutFn = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useAppSession();
  await session.clear();
  return { ok: true as const };
});

export const getAuthFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useAppSession();
  const data = session.data;

  if (data.role === "owner") {
    return { role: "owner" as const, email: data.email };
  }

  if (data.role === "license") {
    const license = await getLicenseById(data.licenseId);
    if (!license || license.status === "revoked") {
      await session.clear();
      return null;
    }

    const expired =
      license.expires_at !== null && new Date(license.expires_at).getTime() <= Date.now();

    if (license.status === "expired" || expired) {
      await session.clear();
      return null;
    }

    return {
      role: "license" as const,
      licenseId: license.id,
      licenseType: license.type,
      expiresAt: license.expires_at,
    };
  }

  return null;
});
