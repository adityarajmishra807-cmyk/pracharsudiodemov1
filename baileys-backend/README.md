# Baileys WhatsApp Backend

Production-oriented Express + Baileys backend for multi-session WhatsApp integration. The intended implementation provides persistent Supabase-backed auth state, QR login with automatic session resume, REST APIs for messages/chats/groups/contacts/media/privacy/presence, and Socket.IO realtime events.

The backend is designed so a WhatsApp account normally scans the QR code once. Persisted authentication state is restored after application restarts; an explicit logout or WhatsApp unlink requires a new login.

See the backend source implementation and `supabase/schema.sql` for the complete deployment setup.
