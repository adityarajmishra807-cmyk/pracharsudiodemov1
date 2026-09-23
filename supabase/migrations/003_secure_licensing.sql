-- Central license store. No license data is readable from the browser.
create table if not exists public.prachar_licenses (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  type text not null check (type in ('permanent', 'trial')),
  status text not null default 'unused' check (status in ('unused', 'active', 'expired', 'revoked')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  expires_at timestamptz,
  customer_name text not null default '',
  customer_email text not null default '',
  constraint valid_license_dates check (
    (type = 'permanent' and expires_at is null)
    or (type = 'trial' and expires_at is null)
    or (type = 'trial' and expires_at is not null)
  )
);

create index if not exists prachar_licenses_status_idx
  on public.prachar_licenses(status);

create index if not exists prachar_licenses_created_at_idx
  on public.prachar_licenses(created_at desc);

alter table public.prachar_licenses enable row level security;

revoke all on table public.prachar_licenses from anon, authenticated;
grant select, insert, update, delete on table public.prachar_licenses to service_role;

create or replace function public.activate_prachar_license(
  input_key text,
  input_name text default '',
  input_email text default ''
)
returns table (
  id uuid,
  key text,
  type text,
  status text,
  created_at timestamptz,
  activated_at timestamptz,
  expires_at timestamptz,
  customer_name text,
  customer_email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  license_row public.prachar_licenses%rowtype;
  activation_time timestamptz := now();
begin
  select *
    into license_row
    from public.prachar_licenses
   where upper(key) = upper(trim(input_key))
   for update;

  if not found then
    raise exception using message = 'INVALID_LICENSE';
  end if;

  if license_row.status = 'revoked' then
    raise exception using message = 'REVOKED_LICENSE';
  end if;

  if license_row.status = 'active' then
    raise exception using message = 'ACTIVE_LICENSE';
  end if;

  if license_row.status = 'expired'
     or (license_row.expires_at is not null and license_row.expires_at <= activation_time) then
    raise exception using message = 'EXPIRED_LICENSE';
  end if;

  license_row.status := 'active';
  license_row.activated_at := coalesce(license_row.activated_at, activation_time);
  license_row.expires_at :=
    case
      when license_row.type = 'trial' then activation_time + interval '7 days'
      else null
    end;
  license_row.customer_name := left(coalesce(input_name, ''), 120);
  license_row.customer_email := left(coalesce(input_email, ''), 254);

  update public.prachar_licenses
     set status = license_row.status,
         activated_at = license_row.activated_at,
         expires_at = license_row.expires_at,
         customer_name = license_row.customer_name,
         customer_email = license_row.customer_email
   where public.prachar_licenses.id = license_row.id;

  return query
  select
    license_row.id,
    license_row.key,
    license_row.type,
    license_row.status,
    license_row.created_at,
    license_row.activated_at,
    license_row.expires_at,
    license_row.customer_name,
    license_row.customer_email;
end;
$$;

revoke all on function public.activate_prachar_license(text, text, text) from public, anon, authenticated;
grant execute on function public.activate_prachar_license(text, text, text) to service_role;
