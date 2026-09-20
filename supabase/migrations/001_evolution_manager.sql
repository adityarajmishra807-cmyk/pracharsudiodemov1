-- Prachar Studio / Evolution Manager Supabase migration
-- Run in Supabase SQL Editor. This is the persistent schema used by server/src/services/db.js.

create table if not exists public.members (
 id text primary key,name text not null,email text not null default '',job_title text not null default '',
 status text not null default 'active',permissions jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.app_users (
 id text primary key,member_id text references public.members(id) on delete cascade,email text not null unique,
 password_hash text not null,role text not null default 'member',status text not null default 'active',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.auth_sessions (
 id text primary key,user_id text not null references public.app_users(id) on delete cascade,
 token_hash text not null unique,expires_at timestamptz not null,created_at timestamptz not null default now()
);
create index if not exists auth_sessions_expiry_idx on public.auth_sessions(expires_at);
create table if not exists public.workspace_settings(key text primary key,value text not null default '');

create table if not exists public.leads (
 id text primary key,name text not null,phone text not null default '',email text not null default '',
 company text not null default '',source text not null default 'Other',status text not null default 'new',
 tags jsonb not null default '[]'::jsonb,assigned_to text,notes text not null default '',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_phone_idx on public.leads(phone);
create table if not exists public.lead_activity (
 id text primary key,lead_id text not null references public.leads(id) on delete cascade,
 text text not null,created_at timestamptz not null default now()
);

create table if not exists public.templates (
 id text primary key,name text not null,type text not null,data jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists templates_updated_at_idx on public.templates(updated_at desc);

create table if not exists public.audiences (
 id text primary key,name text not null,description text not null default '',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.audience_recipients (
 audience_id text not null references public.audiences(id) on delete cascade,
 recipient_index integer not null,phone text not null default '',
 recipient jsonb not null default '{}'::jsonb,primary key(audience_id,recipient_index)
);

create table if not exists public.campaigns (
 id text primary key,name text not null,type text not null,instance text not null,status text not null,
 delay_ms integer not null,payload jsonb not null default '{}'::jsonb,total integer not null default 0,
 sent integer not null default 0,failed integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 started_at timestamptz,completed_at timestamptz,error text
);
create table if not exists public.campaign_recipients (
 campaign_id text not null references public.campaigns(id) on delete cascade,
 recipient_index integer not null,phone text not null default '',
 recipient jsonb not null default '{}'::jsonb,primary key(campaign_id,recipient_index)
);
create table if not exists public.campaign_results (
 campaign_id text not null references public.campaigns(id) on delete cascade,
 recipient_index integer not null,phone text not null default '',ok boolean not null,
 message text,timestamp timestamptz not null default now(),primary key(campaign_id,recipient_index)
);
create table if not exists public.campaign_messages (
 campaign_id text not null references public.campaigns(id) on delete cascade,
 recipient_index integer not null,message_id text not null,message_type text not null,
 status text not null default 'PENDING',status_updated_at timestamptz not null default now(),
 primary key(campaign_id,message_id)
);
create index if not exists campaign_results_status_idx on public.campaign_results(campaign_id,ok);
create index if not exists campaign_messages_lookup_idx on public.campaign_messages(message_id);

create table if not exists public.automations (
 id text primary key,name text not null,status text not null default 'draft',
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.automation_nodes (
 id text primary key,automation_id text not null references public.automations(id) on delete cascade,
 node_index integer not null,type text not null,label text not null,config jsonb not null default '{}'::jsonb,
 unique(automation_id,node_index)
);

create index if not exists campaign_recipients_phone_idx on public.campaign_recipients(phone);
create index if not exists audience_recipients_phone_idx on public.audience_recipients(audience_id,phone);
create index if not exists automation_nodes_order_idx on public.automation_nodes(automation_id,node_index);

-- RLS: the server uses the Supabase service-role key, while direct client access is denied.
alter table public.members enable row level security;
alter table public.app_users enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.leads enable row level security;
alter table public.lead_activity enable row level security;
alter table public.templates enable row level security;
alter table public.audiences enable row level security;
alter table public.audience_recipients enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.campaign_results enable row level security;
alter table public.campaign_messages enable row level security;
alter table public.automations enable row level security;
alter table public.automation_nodes enable row level security;
