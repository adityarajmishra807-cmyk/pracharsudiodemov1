import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import pino from "pino";
import QRCode from "qrcode";
import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "0.0.0.0";
const SESSION_DIR = path.resolve(process.env.WHATSAPP_SESSION_DIR || "./data/sessions");
const API_SECRET = process.env.WHATSAPP_GATEWAY_SECRET || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const sessions = new Map();

const app = express();
app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((v) => v.trim()) }));
app.use(express.json({ limit: "1mb" }));

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

function publicSession(session) {
  return {
    id: session.id,
    status: session.status,
    qr: session.qr,
    phoneNumber: session.phoneNumber,
    lastConnectedAt: session.lastConnectedAt,
    lastDisconnectedAt: session.lastDisconnectedAt,
    error: session.error,
  };
}

async function ensureSession(id, autoStart = false) {
  const sessionId = safeId(id);
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      id: sessionId,
      status: "CREATED",
      qr: null,
      phoneNumber: null,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      error: null,
      socket: null,
      connecting: false,
      reconnectTimer: null,
    };
    sessions.set(sessionId, session);
  }
  if (autoStart && session.status !== "READY" && !session.connecting) {
    await connectSession(session);
  }
  return session;
}

async function connectSession(session) {
  if (session.connecting) return;
  session.connecting = true;
  session.error = null;
  session.status = "WAITING_FOR_LINK";

  const authPath = path.join(SESSION_DIR, session.id);
  await fs.mkdir(authPath, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authPath);

  const socket = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  session.socket = socket;
  socket.ev.on("creds.update", saveCreds);
  socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      session.status = "WAITING_FOR_LINK";
      session.qr = await QRCode.toDataURL(qr, { margin: 1, width: 320 });
      session.error = null;
    }

    if (connection === "open") {
      session.connecting = false;
      session.status = "READY";
      session.qr = null;
      session.lastConnectedAt = new Date().toISOString();
      session.error = null;
      session.phoneNumber = socket.user?.id?.split(":")[0] || null;
      logger.info({ sessionId: session.id }, "WhatsApp session ready");
    }

    if (connection === "close") {
      session.connecting = false;
      session.socket = null;
      session.lastDisconnectedAt = new Date().toISOString();
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      session.qr = null;

      if (loggedOut) {
        session.status = "NEEDS_RELINK";
        session.error = "WhatsApp logged out this linked device. Scan a new QR to relink.";
        return;
      }

      session.status = "RECONNECTING";
      clearTimeout(session.reconnectTimer);
      session.reconnectTimer = setTimeout(() => {
        connectSession(session).catch((error) => {
          session.status = "ERROR";
          session.error = error instanceof Error ? error.message : "Reconnect failed";
        });
      }, 2000);
    }
  });
}

app.get("/health", (_req, res) => res.json({ ok: true, service: "prachar-whatsapp-gateway" }));

app.post("/api/sessions", async (req, res) => {
  try {
    const id = safeId(req.body?.id);
    const session = await ensureSession(id, true);
    return res.json(publicSession(session));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to create session" });
  }
});

app.get("/api/sessions/:id", async (req, res) => {
  try {
    const session = await ensureSession(req.params.id, false);
    return res.json(publicSession(session));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to read session" });
  }
});

app.post("/api/sessions/:id/reconnect", async (req, res) => {
  try {
    const session = await ensureSession(req.params.id, false);
    await connectSession(session);
    return res.json(publicSession(session));
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to reconnect" });
  }
});

app.delete("/api/sessions/:id", async (req, res) => {
  try {
    const session = await ensureSession(req.params.id, false);
    clearTimeout(session.reconnectTimer);
    try {
      await session.socket?.logout();
    } catch {
      // best effort
    }
    session.socket = null;
    sessions.delete(session.id);
    await fs.rm(path.join(SESSION_DIR, session.id), { recursive: true, force: true });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to remove session" });
  }
});

async function restoreSessions() {
  await fs.mkdir(SESSION_DIR, { recursive: true });
  const entries = await fs.readdir(SESSION_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await ensureSession(entry.name, true);
    } catch (error) {
      logger.error({ sessionId: entry.name, error }, "Failed to restore WhatsApp session");
    }
  }
}

await restoreSessions();
app.listen(PORT, HOST, () => logger.info({ host: HOST, port: PORT }, "Prachar WhatsApp gateway listening"));
