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
const API_SECRET = process.env.WHATSAPP_GATEWAY_SECRET || "";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const logger = pino({ level: process.env.LOG_LEVEL || "info" });
const sessions = new Map();
let cachedWaWebVersion = null;
let cachedWaWebVersionAt = 0;

const app = express();
app.use(cors({ origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((v) => v.trim()) }));
app.use(express.json({ limit: "1mb" }));

// Request diagnostics: never log Authorization headers, message bodies, or QR payloads.
app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestId = req.get("x-request-id") || Math.random().toString(36).slice(2, 10);
  res.setHeader("x-request-id", requestId);
  res.on("finish", () => {
    logger.info(
      {
        requestId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
        userAgent: req.get("user-agent") || undefined,
      },
      "HTTP request completed",
    );
  });
  next();
});

function auth(req, res, next) {
  if (!API_SECRET) {
    logger.warn({ path: req.path }, "Gateway API secret is not configured");
    return next();
  }
  const provided = req.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== API_SECRET) {
    logger.warn({ method: req.method, path: req.path }, "Rejected API request: invalid gateway secret");
    return res.status(401).json({ error: "Unauthorized" });
  }
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

async function getWaWebVersion() {
  const now = Date.now();
  if (cachedWaWebVersion && now - cachedWaWebVersionAt < 6 * 60 * 60 * 1000) {
    logger.debug({ version: cachedWaWebVersion.join(".") }, "Using cached WhatsApp Web version");
    return cachedWaWebVersion;
  }

  logger.info("Fetching current WhatsApp Web version");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const result = await fetchLatestWaWebVersion({ signal: controller.signal });
    if (result?.version) {
      cachedWaWebVersion = result.version;
      cachedWaWebVersionAt = now;
      logger.info(
        { version: result.version.join("."), isLatest: result.isLatest },
        "Using current WhatsApp Web version",
      );
      return cachedWaWebVersion;
    }
    logger.warn("WhatsApp Web version lookup returned no version; using Baileys default");
  } catch (error) {
    logger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Could not fetch current WhatsApp Web version; using Baileys default",
    );
  } finally {
    clearTimeout(timeout);
  }

  return null;
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
    logger.info({ sessionId }, "Created WhatsApp session record");
  }

  if (autoStart && session.status !== "READY" && !session.connecting) {
    logger.info({ sessionId, status: session.status }, "Scheduling WhatsApp session start");
    void connectSession(session).catch((error) => {
      session.status = "ERROR";
      session.error = error instanceof Error ? error.message : "Unable to start WhatsApp session";
      logger.error({ sessionId, error }, "Asynchronous WhatsApp session start failed");
    });
  }

  return session;
}

async function connectSession(session) {
  if (session.connecting) {
    logger.debug({ sessionId: session.id }, "WhatsApp session connection already in progress");
    return;
  }

  session.connecting = true;
  session.error = null;
  session.status = "WAITING_FOR_LINK";
  logger.info({ sessionId: session.id }, "Starting WhatsApp session connection");

  try {
    const authPath = path.join(SESSION_DIR, session.id);
    logger.info({ sessionId: session.id, authPath }, "Preparing WhatsApp auth directory");
    await fs.mkdir(authPath, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    logger.info({ sessionId: session.id, hasExistingCredentials: Boolean(state?.creds?.registered) }, "Loaded WhatsApp auth state");

    const version = await getWaWebVersion();
    logger.info({ sessionId: session.id, webVersion: version?.join(".") || "baileys-default" }, "Creating WhatsApp socket");

    const socket = makeWASocket({
      auth: state,
      ...(version ? { version } : {}),
      browser: Browsers.ubuntu("Chrome"),
      logger: pino({ level: process.env.BAILEYS_LOG_LEVEL || "warn" }),
      printQRInTerminal: false,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      qrTimeout: 60_000,
      connectTimeoutMs: 60_000,
    });

    session.socket = socket;
    logger.info({ sessionId: session.id }, "WhatsApp socket created; waiting for connection events");
    socket.ev.on("creds.update", async (creds) => {
      try {
        await saveCreds(creds);
        logger.debug({ sessionId: session.id }, "WhatsApp credentials updated");
      } catch (error) {
        logger.error({ sessionId: session.id, error }, "Failed to save WhatsApp credentials");
      }
    });

    socket.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        logger.info({ sessionId: session.id }, "WhatsApp QR event received");
        session.status = "WAITING_FOR_LINK";
        try {
          session.qr = await QRCode.toDataURL(qr, {
            margin: 1,
            width: 320,
            errorCorrectionLevel: "M",
          });
          session.error = null;
          logger.info({ sessionId: session.id }, "WhatsApp QR generated successfully");
        } catch (error) {
          session.status = "ERROR";
          session.error = error instanceof Error ? error.message : "QR generation failed";
          logger.error({ sessionId: session.id, error }, "Failed to encode WhatsApp QR");
        }
      }

      if (connection) {
        logger.info({ sessionId: session.id, connection }, "WhatsApp connection state changed");
      }

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

        if (loggedOut) {
          session.status = "NEEDS_RELINK";
          session.error = "WhatsApp logged out this linked device. Scan a new QR to relink.";
          return;
        }

        session.status = "RECONNECTING";
        clearTimeout(session.reconnectTimer);
        logger.info({ sessionId: session.id }, "Scheduling WhatsApp session reconnect");
        session.reconnectTimer = setTimeout(() => {
          connectSession(session).catch((error) => {
            session.status = "ERROR";
            session.error = error instanceof Error ? error.message : "Reconnect failed";
            logger.error({ sessionId: session.id, error }, "Reconnect failed");
          });
        }, 2_000);
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
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "prachar-whatsapp-gateway",
    sessions: sessions.size,
    configuration: {
      apiSecretConfigured: Boolean(API_SECRET),
      sessionDir: SESSION_DIR,
      corsConfigured: CORS_ORIGIN !== "*",
    },
  });
});

app.post("/api/sessions", async (req, res) => {
  const requestId = res.getHeader("x-request-id");
  try {
    const id = safeId(req.body?.id);
    logger.info({ requestId, sessionId: id }, "API create/start session requested");
    const session = await ensureSession(id, true);
    return res.json(publicSession(session));
  } catch (error) {
    logger.error({ requestId, error }, "API create/start session failed");
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to create session" });
  }
});

app.get("/api/sessions/:id", async (req, res) => {
  const requestId = res.getHeader("x-request-id");
  try {
    const sessionId = safeId(req.params.id);
    const session = await ensureSession(sessionId, false);
    logger.debug({ requestId, sessionId, status: session.status, hasQr: Boolean(session.qr), error: session.error }, "API session status requested");
    return res.json(publicSession(session));
  } catch (error) {
    logger.error({ requestId, error }, "API session status failed");
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to read session" });
  }
});

app.post("/api/sessions/:id/reconnect", async (req, res) => {
  const requestId = res.getHeader("x-request-id");
  try {
    const sessionId = safeId(req.params.id);
    const session = await ensureSession(sessionId, false);
    logger.info({ requestId, sessionId, status: session.status }, "API session reconnect requested");
    void connectSession(session).catch((error) => {
      session.status = "ERROR";
      session.error = error instanceof Error ? error.message : "Unable to reconnect";
      logger.error({ requestId, sessionId, error }, "Async reconnect failed");
    });
    return res.json(publicSession(session));
  } catch (error) {
    logger.error({ requestId, error }, "API session reconnect failed");
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to reconnect" });
  }
});

app.delete("/api/sessions/:id", async (req, res) => {
  const requestId = res.getHeader("x-request-id");
  try {
    const sessionId = safeId(req.params.id);
    const session = await ensureSession(sessionId, false);
    logger.info({ requestId, sessionId }, "API session removal requested");
    clearTimeout(session.reconnectTimer);
    try {
      await session.socket?.logout();
    } catch (error) {
      logger.warn({ requestId, sessionId, error }, "WhatsApp logout returned an error during removal");
    }
    session.socket = null;
    sessions.delete(session.id);
    await fs.rm(path.join(SESSION_DIR, session.id), { recursive: true, force: true });
    logger.info({ requestId, sessionId }, "WhatsApp session removed");
    return res.json({ ok: true });
  } catch (error) {
    logger.error({ requestId, error }, "API session removal failed");
    return res.status(400).json({ error: error instanceof Error ? error.message : "Unable to remove session" });
  }
});

async function restoreSessions() {
  try {
    await fs.mkdir(SESSION_DIR, { recursive: true });
    const entries = await fs.readdir(SESSION_DIR, { withFileTypes: true });
    logger.info({ sessionCount: entries.filter((entry) => entry.isDirectory()).length }, "Inspecting persisted WhatsApp sessions");
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        await ensureSession(entry.name, true);
      } catch (error) {
        logger.error({ sessionId: entry.name, error }, "Failed to restore WhatsApp session");
      }
    }
  } catch (error) {
    logger.error({ error }, "Failed to inspect WhatsApp session directory");
  }
}

app.listen(PORT, HOST, () => {
  logger.info(
    {
      host: HOST,
      port: PORT,
      sessionDir: SESSION_DIR,
      apiSecretConfigured: Boolean(API_SECRET),
      corsConfigured: CORS_ORIGIN !== "*",
      nodeVersion: process.version,
    },
    "Prachar WhatsApp gateway listening",
  );
  void restoreSessions();
});
