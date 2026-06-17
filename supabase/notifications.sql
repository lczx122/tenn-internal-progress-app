-- ============================================================================
--  Reminder push notifications
--  Per-user prefs (on/off + how long before), the browser push subscriptions,
--  a dedupe table, and a slot for the VAPID public key the browser subscribes
--  with. A scheduled Edge Function (supabase/functions/send-reminders) reads
--  these and sends the pushes. Safe to re-run.
-- ============================================================================

-- 1) Per-user reminder preferences
create table if not exists public.notification_prefs (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  enabled      boolean not null default false,
  lead_minutes int     not null default 30,
  updated_at   timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
drop policy if exists "own prefs" on public.notification_prefs;
create policy "own prefs" on public.notification_prefs
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2) Browser push subscriptions (one row per device/browser)
create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "own subs" on public.push_subscriptions;
create policy "own subs" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create index if not exists push_subs_user_idx on public.push_subscriptions (user_id);

-- 3) Dedupe: at most one reminder per appointment per user.
--    Only the Edge Function (service role) touches this — RLS on, no policies.
create table if not exists public.sent_reminders (
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  user_id        uuid not null,
  sent_at        timestamptz not null default now(),
  primary key (appointment_id, user_id)
);
alter table public.sent_reminders enable row level security;

-- 4) VAPID public key the browser subscribes with (safe to expose to clients).
--    Set it after you generate your keys:
--    update public.app_settings set value = jsonb_build_object('key','<VAPID_PUBLIC_KEY>')
--      where key = 'vapid_public';
insert into public.app_settings (key, value)
values ('vapid_public', jsonb_build_object('key',''))
on conflict (key) do nothing;

-- 5) Schedule the sender to run every minute (after deploying the Edge Function).
--    Enable the extensions once, then fill in your project ref + CRON_SECRET and
--    run the cron.schedule call. (Dashboard → Database → Extensions also works.)
--
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule('send-reminders', '* * * * *', $$
--   select net.http_post(
--     url     := 'https://<PROJECT_REF>.functions.supabase.co/send-reminders',
--     headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','<CRON_SECRET>'),
--     body    := '{}'::jsonb
--   );
-- $$);
--
-- To stop it later:  select cron.unschedule('send-reminders');
