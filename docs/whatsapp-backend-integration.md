# Prachar WhatsApp backend integration

Prachar now uses the separate Baileys + Supabase backend as the source of truth for WhatsApp sessions, chats, and messages.

## Vercel environment variables

Set these server-side variables in Vercel:

```text
WHATSAPP_BACKEND_URL=https://<your-whatsapp-backend-domain>
WHATSAPP_BACKEND_API_KEY=<the backend API_KEY>
```

Do not expose the API key with a `VITE_` variable. The frontend talks to the backend through TanStack server functions in `src/lib/whatsapp/core/api.server.ts`.

## Frontend structure

```text
src/lib/whatsapp/
  core/
    api.server.ts       REST transport + validation + errors
    normalizers.ts      UI normalization helpers
    types.ts            backend-facing domain types
  services/
    session.service.ts  session operations
    chat.service.ts     chat operations
    message.service.ts  message operations
  hooks/
    useWhatsAppSessions.ts
    useWhatsAppSession.ts
    useWhatsAppChats.ts
    useWhatsAppMessages.ts
  index.ts              public module surface

src/components/whatsapp/
  WhatsAppAccountSelect.tsx
  WhatsAppChatList.tsx
  WhatsAppChatThread.tsx

src/routes/_app/
  whatsapp.tsx          manager UI
  inbox.tsx             live inbox UI
```

## Backend API used

Sessions:
- `GET /api/sessions`
- `POST /api/sessions/:sessionId/start`
- `GET /api/sessions/:sessionId/status`
- `POST /api/sessions/:sessionId/logout`
- `DELETE /api/sessions/:sessionId`

Chats:
- `GET /api/chats/:sessionId`
- `GET /api/chats/:sessionId/:jid`
- `PATCH /api/chats/:sessionId/:jid`

Messages:
- `GET /api/messages/:sessionId/:jid/history`
- `POST /api/messages/:sessionId/:jid/send`
- `POST /api/messages/:sessionId/:jid/read`
- `PATCH /api/messages/:sessionId/:jid/:messageId`
- `DELETE /api/messages/:sessionId/:jid/:messageId`
- `POST /api/messages/:sessionId/:jid/:messageId/react`

The backend API contract is based on the supplied Baileys + Supabase backend package.
