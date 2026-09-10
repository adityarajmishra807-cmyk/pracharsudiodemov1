type EvolutionInstance = {
  instance?: { instanceName?: string; connectionStatus?: string; status?: string; owner?: string; profileName?: string };
  instanceName?: string; connectionStatus?: string; status?: string; owner?: string; profileName?: string;
};

type EvolutionResponse = Record<string, unknown>;
const qrCache = new Map<string, { qr: string; expiresAt: number }>();

function evolutionUrl() { return String(process.env.EVOLUTION_API_URL || "").trim().replace(/\/$/, ""); }
function evolutionKey() { return String(process.env.EVOLUTION_API_KEY || "").trim(); }
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } }); }

async function evolutionRequest<T = EvolutionResponse>(path: string, init: RequestInit = {}) {
  const root = evolutionUrl();
  if (!root) throw new Error("Evolution API is not configured. Set EVOLUTION_API_URL.");
  const response = await fetch(`${root}${path}`, { ...init, headers: { Accept: "application/json", "Content-Type": "application/json", apikey: evolutionKey(), ...(init.headers || {}) }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(typeof body?.message === "string" ? body.message : typeof body?.error === "string" ? body.error : `Evolution API returned HTTP ${response.status}`) as Error & { status?: number }; error.status = response.status; throw error; }
  return body as T;
}

function normalizeState(value: unknown) {
  const s = String(value || "").toLowerCase();
  if (["open", "connected", "online"].includes(s)) return "open";
  if (["connecting", "pending"].includes(s)) return "connecting";
  if (["qr", "qrcode"].includes(s)) return "qr";
  if (["close", "closed", "disconnected"].includes(s)) return "close";
  if (["logged_out", "loggedout", "logout"].includes(s)) return "logged_out";
  return "not_started";
}

function normalize(raw: EvolutionInstance) {
  const instance = raw.instance || raw;
  const instanceName = String(instance.instanceName || raw.instanceName || "");
  const ownerJid = instance.owner || raw.owner;
  const state = normalizeState(instance.connectionStatus || instance.status || raw.connectionStatus || raw.status);
  const cached = qrCache.get(instanceName);
  return { instanceName, status: state, state, ownerJid, profileName: instance.profileName || raw.profileName, number: ownerJid ? String(ownerJid).split("@")[0].split(":")[0] : undefined, tokenKnown: true, ...(cached && cached.expiresAt > Date.now() ? { qr: cached.qr } : {}) };
}

async function list() {
  const data = await evolutionRequest<EvolutionInstance[]>("/instance/fetchInstances");
  return Array.isArray(data) ? data.map(normalize).filter((s) => s.instanceName) : [];
}

async function connect(instanceName: string) {
  const data = await evolutionRequest<Record<string, unknown>>(`/instance/connect/${encodeURIComponent(instanceName)}`);
  const raw = data.base64 || data.base64Url || data.qrcode || data.qr || data.code;
  if (typeof raw === "string" && raw.trim()) qrCache.set(instanceName, { qr: raw.startsWith("data:image") ? raw : `data:image/png;base64,${raw}`, expiresAt: Date.now() + 20_000 });
  return data;
}

function routeInstance(pathname: string, suffix: string) {
  const prefix = "/api/sessions/";
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null;
  const value = pathname.slice(prefix.length, pathname.length - suffix.length);
  return value ? decodeURIComponent(value) : null;
}

export async function handleEvolutionSessionsApi(request: Request): Promise<Response | null> {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  try {
    if (pathname === "/api/sessions" && request.method === "GET") return json(await list());

    if (pathname === "/api/sessions" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const instanceName = String(body?.instanceName || "").trim();
      if (!/^[A-Za-z0-9_-]{1,120}$/.test(instanceName)) return json({ message: "Invalid instanceName." }, 400);
      const existing = (await list()).find((s) => s.instanceName === instanceName);
      if (!existing) await evolutionRequest("/instance/create", { method: "POST", body: JSON.stringify({ instanceName, integration: "WHATSAPP-BAILEYS", qrcode: true }) });
      await connect(instanceName);
      return json({ success: true, instanceName });
    }

    const connectInstance = routeInstance(pathname, "/connect");
    if (connectInstance && request.method === "GET") return json(await connect(connectInstance));

    const restartInstance = routeInstance(pathname, "/restart");
    if (restartInstance && request.method === "POST") { qrCache.delete(restartInstance); return json(await evolutionRequest(`/instance/restart/${encodeURIComponent(restartInstance)}`, { method: "POST" })); }

    const disconnectInstance = routeInstance(pathname, "/disconnect");
    if (disconnectInstance && request.method === "POST") { qrCache.delete(disconnectInstance); return json(await evolutionRequest(`/instance/logout/${encodeURIComponent(disconnectInstance)}`, { method: "POST" })); }

    const sendInstance = routeInstance(pathname, "/send-text");
    if (sendInstance && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const number = String(body?.number || "").replace(/\D/g, "");
      const text = String(body?.text || "").trim();
      if (!number || !text) return json({ message: "number and text are required." }, 400);
      return json(await evolutionRequest(`/message/sendText/${encodeURIComponent(sendInstance)}`, { method: "POST", body: JSON.stringify({ number, text }) }));
    }

    if (pathname.startsWith("/api/sessions/") && request.method === "DELETE") {
      const instanceName = decodeURIComponent(pathname.slice("/api/sessions/".length));
      if (!instanceName || instanceName.includes("/")) return json({ message: "Invalid session." }, 400);
      qrCache.delete(instanceName);
      return json(await evolutionRequest(`/instance/delete/${encodeURIComponent(instanceName)}`, { method: "DELETE" }));
    }
  } catch (error) {
    const status = Number((error as { status?: number })?.status) || 503;
    return json({ message: error instanceof Error ? error.message : "Evolution API request failed." }, status);
  }
  return null;
}
