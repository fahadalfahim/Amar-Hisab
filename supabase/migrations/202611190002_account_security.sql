-- Run after 202611180001_initial_schema.sql.
-- Safeguard opening balance and preserve historical account records.
revoke update, delete on public.accounts from authenticated;
grant update(name, archived_at) on public.accounts to authenticated;
