import { z } from "zod";

const licenseRowSchema = z.object({
  id: z.string(),
  key: z.string(),
  type: z.enum(["permanent", "trial"]),
  status: z.enum(["unused", "active", "expired", "revoked"]),
  created_at: z.string(),
  activated_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  customer_name: z.string(),
  customer_email: z.string(),
});

export type LicenseRow = z.infer<typeof licenseRowSchema>;

function supabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY must be configured on the server.",
    );
  }

  return { url, key };
}

async function supabaseRequest<T>(path: string, init: RequestInit = {}) {
  const { url, key } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase request failed (${response.status}): ${detail.slice(0, 500)}`);
  }

  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

function parseRows(value: unknown) {
  return z.array(licenseRowSchema).parse(value);
}

export function createSecureLicenseKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (const byte of bytes) raw += alphabet[byte % alphabet.length];
  return `PRA-${raw.slice(0, 5)}-${raw.slice(5, 10)}-${raw.slice(10, 15)}-${raw.slice(15, 20)}`;
}

export async function listLicenses() {
  const rows = await supabaseRequest<unknown>(
    "/prachar_licenses?select=id,key,type,status,created_at,activated_at,expires_at,customer_name,customer_email&order=created_at.desc",
  );
  return parseRows(rows);
}

export async function getLicenseById(id: string) {
  const rows = await supabaseRequest<unknown>(
    `/prachar_licenses?select=id,key,type,status,created_at,activated_at,expires_at,customer_name,customer_email&id=eq.${encodeURIComponent(id)}&limit=1`,
  );
  return parseRows(rows)[0] ?? null;
}

export async function insertLicense(type: "permanent" | "trial") {
  const key = createSecureLicenseKey();
  const rows = await supabaseRequest<unknown>("/prachar_licenses", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ key, type, status: "unused" }),
  });
  return parseRows(rows)[0];
}

export async function revokeLicense(id: string) {
  const rows = await supabaseRequest<unknown>(
    `/prachar_licenses?id=eq.${encodeURIComponent(id)}&status=neq.revoked`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: "revoked" }),
    },
  );
  return parseRows(rows)[0] ?? null;
}

export async function activateLicense(
  key: string,
  customerName: string,
  customerEmail: string,
) {
  const { url, key: secret } = supabaseConfig();
  const response = await fetch(`${url}/rest/v1/rpc/activate_prachar_license`, {
    method: "POST",
    headers: {
      apikey: secret,
      Authorization: `Bearer ${secret}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input_key: key,
      input_name: customerName,
      input_email: customerEmail,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).toLowerCase();
    if (detail.includes("invalid_license")) throw new Error("That license key was not found.");
    if (detail.includes("revoked_license")) throw new Error("That license has been revoked.");
    if (detail.includes("active_license")) throw new Error("That license has already been activated.");
    if (detail.includes("expired_license")) throw new Error("That license has expired.");
    throw new Error("The license could not be activated.");
  }

  const value = await response.json();
  const rows = parseRows(Array.isArray(value) ? value : [value]);
  return rows[0];
}

export function normalizeLicenseKey(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}
