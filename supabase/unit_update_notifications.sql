-- ============================================================================
--  Unit-update push notifications
--  When someone posts an update on a unit, everyone else with push enabled
--  gets a notification (sent by the notify-update Edge Function). This adds a
--  per-user opt-out flag to the existing notification_prefs. Safe to re-run.
--
--  Also deploy the function:   supabase functions deploy notify-update
--  (uses the same VAPID secrets as send-reminders — nothing new to set)
-- ============================================================================

alter table public.notification_prefs
  add column if not exists unit_updates boolean not null default true;

-- Verification: column exists.
select column_name, data_type, column_default
  from information_schema.columns
 where table_name = 'notification_prefs' and column_name = 'unit_updates';
