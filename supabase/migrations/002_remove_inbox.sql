-- Remove the legacy Inbox/CRM conversation persistence after the Inbox feature was removed.
drop table if exists public.messages cascade;
drop table if exists public.conversations cascade;
