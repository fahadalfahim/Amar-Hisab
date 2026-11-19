-- Amar Hisab v1.4.1 - Make initial_account_id and original_transaction_id optional on debts.
-- Allows users to record loans and borrowings without immediately binding them to a cash/bank account.

alter table public.debts alter column initial_account_id drop not null;
alter table public.debts alter column original_transaction_id drop not null;

create or replace function public.create_debt_record(
  p_contact_id uuid,
  p_direction text,
  p_principal_paisa bigint,
  p_account_id uuid default null,
  p_opened_at timestamptz default now(),
  p_due_date date default null,
  p_notes text default null,
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_tx uuid := null;
  v_debt uuid;
  v_kind public.transaction_kind;
  v_entry bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_idempotency_key is not null then
    select id into v_tx from public.transactions where user_id = v_user and idempotency_key = p_idempotency_key;
    if found then
      select id into v_debt from public.debts where user_id = v_user and original_transaction_id = v_tx;
      if found then return v_debt; end if;
    end if;
  end if;
  if p_direction not in ('i_owe', 'they_owe') then raise exception 'Invalid debt direction'; end if;
  if p_principal_paisa is null or p_principal_paisa <= 0 then raise exception 'Amount must be positive'; end if;
  if not exists (select 1 from public.contacts where id = p_contact_id and user_id = v_user and archived_at is null) then raise exception 'Invalid contact'; end if;

  if p_account_id is not null then
    perform 1 from public.accounts where id = p_account_id and user_id = v_user and archived_at is null for update;
    if not found then raise exception 'Invalid account'; end if;

    v_kind := case when p_direction = 'i_owe' then 'loan_received'::public.transaction_kind else 'loan_given'::public.transaction_kind end;
    v_entry := case when p_direction = 'i_owe' then p_principal_paisa else -p_principal_paisa end;

    insert into public.transactions(user_id, kind, amount_paisa, account_id, contact_id, occurred_at, description, idempotency_key)
    select v_user, v_kind, p_principal_paisa, p_account_id, p_contact_id, coalesce(p_opened_at, now()),
      case when p_direction = 'i_owe' then 'Borrowed money' else 'Lent money' end, p_idempotency_key
    returning id into v_tx;

    insert into public.ledger_entries(user_id, transaction_id, account_id, amount_paisa, effective_at)
    values (v_user, v_tx, p_account_id, v_entry, coalesce(p_opened_at, now()));
  end if;

  insert into public.debts(user_id, contact_id, direction, principal_paisa, initial_account_id, original_transaction_id, opened_at, due_date, notes)
  values (v_user, p_contact_id, p_direction::public.debt_direction, p_principal_paisa, p_account_id, v_tx, coalesce(p_opened_at, now()), p_due_date, p_notes)
  returning id into v_debt;

  insert into public.audit_logs(user_id, action, entity_type, entity_id, new_values)
  values (v_user, 'create', 'debt', v_debt, jsonb_build_object('direction', p_direction, 'principal_paisa', p_principal_paisa, 'account_id', p_account_id));
  return v_debt;
end;
$$;

grant execute on function public.create_debt_record(uuid,text,bigint,uuid,timestamptz,date,text,uuid) to authenticated;
revoke all on function public.create_debt_record(uuid,text,bigint,uuid,timestamptz,date,text,uuid) from public, anon;
