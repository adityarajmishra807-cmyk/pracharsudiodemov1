-- Authentication is intentionally disabled for Prachar Studio.
-- Keep workspace/member data, but remove credential and login-session storage.
drop table if exists public.auth_sessions cascade;
drop table if exists public.app_users cascade;
