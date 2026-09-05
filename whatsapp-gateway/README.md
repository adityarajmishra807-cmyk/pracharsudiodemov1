# Prachar WhatsApp QR Gateway

This service provides real, scannable QR codes for user-authorized WhatsApp linked-device sessions. It runs separately from the Vercel web app because WhatsApp Web sessions are long-lived and stateful.

## Run on the VPS

```bash
cd whatsapp-gateway
npm install
cp .env.example .env
npm start
```

Example `.env`:

```env
PORT=8787
HOST=0.0.0.0
WHATSAPP_SESSION_DIR=./data/sessions
WHATSAPP_GATEWAY_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=https://your-prachar-domain.vercel.app
LOG_LEVEL=info
```

The gateway saves each linked-device auth state under `data/sessions/<account-id>` and restores those sessions after a process restart.

Put the gateway behind HTTPS with Caddy/Nginx and firewall port 8787 so it is not directly exposed. Keep `WHATSAPP_GATEWAY_SECRET` private.

The web app needs these **server-only** Vercel variables:

```env
WHATSAPP_GATEWAY_URL=https://whatsapp-gateway.yourdomain.com
WHATSAPP_GATEWAY_SECRET=the-same-random-secret
```

This QR route uses the community Baileys WhatsApp Web connection layer, not Meta's official WhatsApp Business Platform. Baileys documents QR-based multi-device authentication and its current stable line is 6.7.x; the 7.0 release candidates have had QR connection regressions, so this gateway pins 6.7.24 for the initial implementation.

Use only with accounts and data you are authorized to operate. WhatsApp's current terms and acceptable-use rules still apply.
