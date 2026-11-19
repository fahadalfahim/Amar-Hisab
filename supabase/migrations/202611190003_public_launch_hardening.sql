-- Amar Hisab v1.4 public launch hardening.
-- Requires the previous 001 and 002 migrations. Does not delete or reset user data.

-- Public clients may not delete financial account history or modify the opening balance.
revoke all on public.accounts from anon;
revoke update, delete on public.accounts from authenticated;
grant select, insert on public.accounts to authenticated;
grant update(name, archived_at) on public.accounts to authenticated;

-- Clients should only mark their own notifications read; not rewrite the message itself.
revoke update on public.notifications from authenticated;
grant update(is_read) on public.notifications to authenticated;

-- Protect archival at the database layer, not just in the React UI.
create or replace function public.guard_financial_account_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance bigint;
begin
  if new.id is distinct from old.id
     or new.user_id is distinct from old.user_id
     or new.currency_code is distinct from old.currency_code
     or new.account_type is distinct from old.account_type
     or new.opening_balance_paisa is distinct from old.opening_balance_paisa
     or new.created_at is distinct from old.created_at then
    raise exception 'Account identity and opening balance are immutable';
  end if;
  if old.archived_at is null and new.archived_at is not null then
    select balance_paisa into v_balance
    from public.account_balances where id = old.id and user_id = old.user_id;
    if v_balance is distinct from 0 then
      raise exception 'Transfer remaining money before archiving an account';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_financial_account_update() from public, anon, authenticated;
drop trigger if exists account_guard_updates on public.accounts;
create trigger account_guard_updates
before update on public.accounts
for each row execute function public.guard_financial_account_update();

-- Monetary entries must fit safely into JavaScript's integer precision as stored in Poisha.
-- Reject unusually large individual postings instead of rounding a BIGINT on the client.
do $$ begin
  alter table public.accounts
    add constraint accounts_opening_js_safe check (opening_balance_paisa between 0 and 9000000000000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.transactions
    add constraint transactions_amount_js_safe check (amount_paisa between 1 and 9000000000000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.debts
    add constraint debts_principal_js_safe check (principal_paisa between 1 and 9000000000000);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.debt_payments
    add constraint debt_payments_amount_js_safe check (amount_paisa between 1 and 9000000000000);
exception when duplicate_object then null; end $$;

-- Prevent a client from appending unauthorized ledger entries via the REST API.
revoke insert, update, delete on public.transactions, public.ledger_entries,
  public.debts, public.debt_payments, public.audit_logs from authenticated, anon;

-- Security for user-owned rows is enforced by RLS defined in migration 001.
-- Reminder: test permissions as authenticated users A and B before public launch.
