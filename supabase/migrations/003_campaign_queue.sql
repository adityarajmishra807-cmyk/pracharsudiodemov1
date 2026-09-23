-- Persistent campaign queue for crash/restart recovery.
create table if not exists public.campaign_queue (
  campaign_id text primary key references public.campaigns(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','running','paused','completed','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaign_queue_ready_idx on public.campaign_queue(status,available_at,created_at);
create index if not exists campaign_queue_locked_idx on public.campaign_queue(status,locked_at);
alter table public.campaign_queue enable row level security;
