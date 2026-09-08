const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');
const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const { Server } = require('socket.io');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

const PORT = Number(process.env.PORT || 3001);
const API_KEY = process.env.API_KEY || '';
const AUTH_DIR = path.resolve(process.env.AUTH_DIR || './storage/auth');
const sessions = new Map();
fs.mkdirSync(AUTH_DIR, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

function auth(req, res, next) {
  if (!API_KEY) return next();
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (token !== API_KEY) return res.status(401).json({ success: false, error: 'Unauthorized' });
  next();
}
app.use('/api', auth);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  transports: ['websocket', 'polling'],
});

io.use((socket, next) => {
  if (!API_KEY) return next();
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (token !== API_KEY) return next(new Error('Unauthorized'));
  next();
});

io.on('connection', socket => {
  socket.on('join', sessionId => {
    if (typeof sessionId === 'string' && sessionId) socket.join(`session:${sessionId}`);
  });
  socket.on('leave', sessionId => socket.leave(`session:${sessionId}`));
});

function sessionDir(id) { return path.join(AUTH_DIR, id.replace(/[^a-zA-Z0-9_-]/g, '_')); }
function publicSession(id, entry) {
  return {
    sessionId: id,
    status: entry?.status || 'not_started',
    qr: entry?.qr || null,
    me: entry?.sock?.user || null,
    lastConnectedAt: entry?.lastConnectedAt || null,
  };
}
function emit(id, event, payload) { io.to(`session:${id}`).emit(event, { sessionId: id, ...payload }); }

async function startSession(id) {
  const existing = sessions.get(id);
  if (existing?.sock && existing.status !== 'close') return existing.sock;

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir(id));
  const sock = makeWASocket({
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: true,
  });

  const entry = { sock, status: 'connecting', qr: null, lastConnectedAt: null };
  sessions.set(id, entry);
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async update => {
    const current = sessions.get(id);
    if (!current) return;
    if (update.qr) {
      current.status = 'qr';
      current.qr = await QRCode.toDataURL(update.qr);
      emit(id, 'qr', { qr: current.qr });
      emit(id, 'connection.update', { status: 'qr' });
    }
    if (update.connection === 'open') {
      current.status = 'open';
      current.qr = null;
      current.lastConnectedAt = new Date().toISOString();
      emit(id, 'connection.update', { status: 'open', me: sock.user });
    }
    if (update.connection === 'close') {
      const code = update.lastDisconnect?.error instanceof Boom
        ? update.lastDisconnect.error.output?.statusCode
        : undefined;
      const loggedOut = code === DisconnectReason.loggedOut;
      current.status = loggedOut ? 'logged_out' : 'close';
      emit(id, 'connection.update', { status: current.status });
      if (loggedOut) sessions.delete(id);
      else setTimeout(() => startSession(id).catch(err => console.error(err)), 2000);
    }
  });

  for (const event of ['messages.upsert', 'messages.update', 'chats.upsert', 'chats.update', 'presence.update', 'groups.upsert', 'group-participants.update', 'call']) {
    sock.ev.on(event, payload => emit(id, event, { payload }));
  }
  return sock;
}

function requireSocket(id) {
  const sock = sessions.get(id)?.sock;
  if (!sock) {
    const e = new Error(`Session "${id}" is not connected`);
    e.statusCode = 409;
    throw e;
  }
  return sock;
}

// Session API: /api/sessions
app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok', sessions: sessions.size } }));
app.get('/api/sessions', (req, res) => {
  res.json({ success: true, data: [...sessions.keys()].map(id => publicSession(id, sessions.get(id))) });
});
app.post('/api/sessions/:sessionId/start', async (req, res, next) => {
  try { await startSession(req.params.sessionId); res.status(202).json({ success: true, message: 'Session starting' }); }
  catch (e) { next(e); }
});
app.get('/api/sessions/:sessionId/status', (req, res) => {
  const id = req.params.sessionId;
  res.json({ success: true, data: publicSession(id, sessions.get(id)) });
});
app.post('/api/sessions/:sessionId/logout', async (req, res, next) => {
  try {
    const entry = sessions.get(req.params.sessionId);
    if (entry?.sock) await entry.sock.logout().catch(() => {});
    sessions.delete(req.params.sessionId);
    res.json({ success: true, message: 'Logged out' });
  } catch (e) { next(e); }
});
app.delete('/api/sessions/:sessionId', async (req, res, next) => {
  try {
    const id = req.params.sessionId;
    const entry = sessions.get(id);
    try { entry?.sock?.end?.(undefined); } catch (_) {}
    sessions.delete(id);
    fs.rmSync(sessionDir(id), { recursive: true, force: true });
    res.json({ success: true, message: 'Session deleted' });
  } catch (e) { next(e); }
});
app.post('/api/sessions/:sessionId/check-numbers', async (req, res, next) => {
  try {
    const sock = requireSocket(req.params.sessionId);
    const numbers = Array.isArray(req.body.numbers) ? req.body.numbers : [];
    res.json({ success: true, data: await sock.onWhatsApp(...numbers) });
  } catch (e) { next(e); }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Internal server error' });
});

// Automatically restore any persisted auth directories after restart.
for (const name of fs.readdirSync(AUTH_DIR, { withFileTypes: true })) {
  if (name.isDirectory()) startSession(name.name).catch(err => console.error(`Failed to resume ${name.name}`, err));
}

server.listen(PORT, () => console.log(`Baileys backend listening on :${PORT}`));
