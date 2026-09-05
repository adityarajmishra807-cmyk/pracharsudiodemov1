import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import pino from "pino";
import QRCode from "qrcode";
import makeWASocket, { Browsers, DisconnectReason, fetchLatestWaWebVersion, useMultiFileAuthState } from "@whiskeysockets/baileys";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const SESSION_DIR = path.resolve(process.env.WHATSAPP_SESSION_DIR || "./data/sessions");
const INBOX_FILE = path.join(SESSION_DIR, "inbox.json");
const API_SECRET = process.env.WHATSAPP_GATEWAY_SECRET || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const sessions = new Map();
let chats = new Map();
let inboxWrite = Promise.resolve();
let cachedWaWebVersion = null;
let cachedWaWebVersionAt = 0;

const app = express();
app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((v) => v.trim()) }));
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestId = req.get("x-request-id") || Math.random().toString(36).slice(2, 10);
  res.setHeader("x-request-id", requestId);
  res.on("finish", () => {
    logger.info({ requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - startedAt }, "HTTP request completed");
  });
  next();
});

function auth(req, res, next) {
  if (!API_SECRET) return next();
  const provided = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== API_SECRET) return res.status(401).json({ error: "Unauthorized" });
  next();
}

app.use("/api", auth);

function safeId(value) {
  const id = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error("Invalid session id");
  return id;
}

function cleanJid(jid) {
  return String(jid || "").replace(/:.*@/, "@");
}

function phoneFromJid(jid) {
  return cleanJid(jid).split("@")[0] || "";
}

function messageText(message) {
  if (!message) return "";
  return message.conversation || message.extendedTextMessage?.text || message.imageMessage?.caption || message.videoMessage?.caption || message.documentMessage?.caption || message.buttonsResponseMessage?.selectedDisplayText || message.listResponseMessage?.title || message.templateButtonReplyMessage?.selectedDisplayText || "";
}

function publicSession(session) {
  return { id: session.id, status: session.status, qr: session.qr, phoneNumber: session.phoneNumber, lastConnectedAt: session.lastConnectedAt, lastDisconnectedAt: session.lastDisconnectedAt, error: session.error };
}

function publicChat(chat) {
  return { ...chat, messages: [...chat.messages].sort((a, b) => a.at.localeCompare(b.at)) };
}

async function persistInbox() {
  const payload = JSON.stringify([...chats.values()], null, 2);
  inboxWrite = inboxWrite.then(async () => {
    await fs.mkdir(SESSION_DIR, { recursive: true });
    await fs.writeFile(INBOX_FILE, payload, "utf8");
  }).catch((error) => logger.error({ error }, "Failed to persist WhatsApp inbox"));
  return inboxWrite;
}

async function loadInbox() {
  try {
    const raw = await fs.readFile(INBOX_FILE, "utf8");
    const saved = JSON.parse(raw);
    if (Array.isArray(saved)) {
      chats = new Map(saved.filter((chat) => chat?.id && chat?.accountId).map((chat) => [chat.id, chat]));
    }
  } catch (error) {
    if (error?.code !== "ENOENT") logger.warn({ error: error instanceof Error ? error.message : String(error) }, "Could not load persisted WhatsApp inbox");
  }
}

async function getWaWebVersion() {
  const now = Date.now();
  if (cachedWaWebVersion && now - cachedWaWebVersionAt < 6 * 60 * 60 * 1000) return cachedWaWebVersion;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const result = await fetchLatestWaWebVersion({ signal: controller.signal });
    if (result?.version) {
      cachedWaWebVersion = result.version;
      cachedWaWebVersionAt = now;
      logger.info({ version: result.version.join("."), isLatest: result.isLatest }, "Using current WhatsApp Web version");
      return cachedWaWebVersion;
    }
  } catch (error) {
    logger.warn({ error: error instanceof Error ? error.message : String(error) }, "Could not fetch current WhatsApp Web version; using Baileys default");
  } finally {
    clearTimeout(timeout);
  }
  return null;
}

async function ensureSession(id, autoStart = false) {
  const sessionId = safeId(id);
  let session = sessions.get(sessionId);
  if (!session) {
    session = { id: sessionId, status: "CREATED", qr: null, phoneNumber: null, lastConnectedAt: null, lastDisconnectedAt: null, error: null, socket: null, connecting: false, reconnectTimer: null };
    sessions.set(sessionId, session);
    logger.info({ sessionId }, "Created WhatsApp session record");
  }
  if (autoStart && session.status !== "READY" && !session.connecting) {
    void connectSession(session).catch((error) => {
      session.status = "ERROR";
      session.error = error instanceof Error ? error.message : "Unable to start WhatsApp session";
      logger.error({ sessionId, error }, "Async WhatsApp session start failed");
    });
  }
  return session;
}

function chatId(accountId, jid) {
  return `${accountId}:${cleanJid(jid)}`;
}

function upsertIncomingMessage(accountId, msg) {
  const jid = cleanJid(msg.key?.remoteJid);
  if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") return null;
  const text = messageText(msg.message);
  if (!text) return null;
  const id = msg.key?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const direction = msg.key?.fromMe ? "out" : "in";
  const key = chatId(accountId, jid);
  const existing = chats.get(key) || { id: key, accountId, phoneNumber: phoneFromJid(jid), name: phoneFromJid(jid), unread: 0, lastMessage: "", lastMessageAt: new Date().toISOString(), messages: [] };
  if (existing.messages.some((m) => m.id === id)) return existing;
  const item = { id, accountId, chatId: key, from: msg.key?.participant || (direction === "in" ? jid : "me"), to: jid, direction, text, at: new Date(Number(msg.messageTimestamp || Math.floor(Date.now() / 1000)) * 1000).toISOString(), status: direction === "out" ? "sent" : "received" };
  existing.messages.push(item);
  existing.messages = existing.messages.slice(-500);
  existing.lastMessage = text;
  existing.lastMessageAt = item.at;
  if (direction === "in") existing.unread += 1;
  chats.set(key, existing);
  void persistInbox();
  logger.info({ accountId, chatId: key, direction }, "WhatsApp message stored");
  return existing;
}

async function connectSession(session) {
  if (session.connecting) return;
  session.connecting = true;
  session.error = null;
  session.status = "WAITING_FOR_LINK";
  try {
    const authPath = path.join(SESSION_DIR, session.id);
    await fs.mkdir(authPath, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const version = await getWaWebVersion();
    const socket = makeWASocket({ auth: state, ...(version ? { version } : {}), browser: Browsers.ubuntu("Chrome"), logger: pino({ level: process.env.BAILEYS_LOG_LEVEL || "warn" }), printQRInTerminal: false, syncFullHistory: false, markOnlineOnConnect: false, qrTimeout: 60_000, connectTimeoutMs: 60_000 });
    session.socket = socket;
    socket.ev.on("creds.update", saveCreds);
    socket.ev.on("messages.upsert", ({ messages }) => {
      for (const message of messages || []) upsertIncomingMessage(session.id, message);
    });
    socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        session.status = "WAITING_FOR_LINK";
        try {
          session.qr = await QRCode.toDataURL(qr, { margin: 1, width: 320, errorCorrectionLevel: "M" });
          session.error = null;
          logger.info({ sessionId: session.id }, "WhatsApp QR generated successfully");
        } catch (error) {
          session.status = "ERROR";
          session.error = error instanceof Error ? error.message : "QR generation failed";
          logger.error({ sessionId: session.id, error }, "Failed to encode WhatsApp QR");
        }
      }
      if (connection) logger.info({ sessionId: session.id, connection }, "WhatsApp connection state changed");
      if (connection === "open") {
        session.connecting = false;
        session.status = "READY";
        session.qr = null;
        session.lastConnectedAt = new Date().toISOString();
        session.error = null;
        session.phoneNumber = socket.user?.id?.split(":")[0] || null;
        logger.info({ sessionId: session.id, phoneNumber: session.phoneNumber }, "WhatsApp session READY");
      }
      if (connection === "close") {
        session.connecting = false;
        session.socket = null;
        session.lastDisconnectedAt = new Date().toISOString();
        const code = lastDisconnect?.error?.output?.statusCode;
        const message = lastDisconnect?.error?.message || "WhatsApp connection closed";
        const loggedOut = code === DisconnectReason.loggedOut;
        session.qr = null;
        session.error = `${message}${code ? ` (code ${code})` : ""}`;
        logger.warn({ sessionId: session.id, code, message, loggedOut }, "WhatsApp session closed");
        if (loggedOut) { session.status = "NEEDS_RELINK"; return; }
        session.status = "RECONNECTING";
        clearTimeout(session.reconnectTimer);
        session.reconnectTimer = setTimeout(() => void connectSession(session), 2_000);
      }
    });
  } catch (error) {
    session.connecting = false;
    session.socket = null;
    session.status = "ERROR";
    session.error = error instanceof Error ? error.message : "Unable to start WhatsApp session";
    logger.error({ sessionId: session.id, error }, "Failed to start WhatsApp session");
    throw error;
  }
}

app.get("/", (_req, res) => res.json({ ok: true, service: "prachar-whatsapp-gateway" }));
app.get("/health", (_req, res) => res.json({ ok: true, service: "prachar-whatsapp-gateway", sessions: sessions.size, chats: chats.size, configuration: { apiSecretConfigured: Boolean(API_SECRET), sessionDir: SESSION_DIR, corsConfigured: CORS_ORIGIN !== "*" } }));

app.post("/api/sessions", async (req, res) => {
  try { const session = await ensureSession(req.body?.id, true); return res.json(publicSession(session)); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to create session" }); }
});

app.get("/api/sessions/:id", async (req, res) => {
  try { return res.json(publicSession(await ensureSession(req.params.id, false))); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to read session" }); }
});

app.post("/api/sessions/:id/reconnect", async (req, res) => {
  try { const session = await ensureSession(req.params.id, false); void connectSession(session); return res.json(publicSession(session)); }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to reconnect" }); }
});

app.delete("/api/sessions/:id", async (req, res) => {
  try {
    const session = await ensureSession(req.params.id, false);
    clearTimeout(session.reconnectTimer);
    try { await session.socket?.logout(); } catch {}
    session.socket = null;
    sessions.delete(session.id);
    await fs.rm(path.join(SESSION_DIR, session.id), { recursive: true, force: true });
    for (const [key, chat] of chats) if (chat.accountId === session.id) chats.delete(key);
    await persistInbox();
    return res.json({ ok: true });
  } catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to remove session" }); }
});

app.get("/api/chats", async (req, res) => {
  const accountId = req.query.accountId ? safeId(req.query.accountId) : null;
  const result = [...chats.values()].filter((chat) => !accountId || chat.accountId === accountId).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt)).map(publicChat);
  return res.json({ chats: result });
});

app.get("/api/chats/:id", async (req, res) => {
  const chat = chats.get(String(req.params.id));
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  return res.json(publicChat(chat));
});

app.post("/api/chats/:id/read", async (req, res) => {
  const chat = chats.get(String(req.params.id));
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  chat.unread = 0;
  chats.set(chat.id, chat);
  await persistInbox();
  return res.json(publicChat(chat));
});

app.post("/api/chats/:id/messages", async (req, res) => {
  const chat = chats.get(String(req.params.id));
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  const text = String(req.body?.text || "").trim();
  if (!text || text.length > 4096) return res.status(400).json({ error: "Message text is required and must be 4096 characters or fewer" });
  const session = sessions.get(chat.accountId);
  if (!session || session.status !== "READY" || !session.socket) return res.status(409).json({ error: "WhatsApp account is not ready" });
  try {
    const jid = chat.phoneNumber.includes("@") ? cleanJid(chat.phoneNumber) : `${chat.phoneNumber}@s.whatsapp.net`;
    const result = await session.socket.sendMessage(jid, { text });
    const id = result?.key?.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const at = new Date().toISOString();
    const message = { id, accountId: session.id, chatId: chat.id, from: "me", to: jid, direction: "out", text, at, status: "sent" };
    chat.messages.push(message);
    chat.messages = chat.messages.slice(-500);
    chat.lastMessage = text;
    chat.lastMessageAt = at;
    chats.set(chat.id, chat);
    await persistInbox();
    logger.info({ accountId: session.id, chatId: chat.id }, "WhatsApp outbound message sent");
    return res.json({ message, chat: publicChat(chat) });
  } catch (error) {
    logger.error({ accountId: session.id, chatId: chat.id, error }, "WhatsApp outbound message failed");
    return res.status(502).json({ error: error instanceof Error ? error.message : "Failed to send WhatsApp message" });
  }
});

async function restoreSessions() {
  try {
    await fs.mkdir(SESSION_DIR, { recursive: true });
    const entries = await fs.readdir(SESSION_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try { await ensureSession(entry.name, true); }
      catch (error) { logger.error({ sessionId: entry.name, error }, "Failed to restore WhatsApp session"); }
    }
  } catch (error) { logger.error({ error }, "Failed to inspect WhatsApp session directory"); }
}

await loadInbox();
app.listen(PORT, HOST, () => {
  logger.info({ host: HOST, port: PORT, sessionDir: SESSION_DIR, apiSecretConfigured: Boolean(API_SECRET), corsConfigured: CORS_ORIGIN !== "*", nodeVersion: process.version }, "Prachar WhatsApp gateway listening");
  void restoreSessions();
});
