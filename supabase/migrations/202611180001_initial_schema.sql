-- Amar Hisab v1: private multi-user finance ledger.
-- Apply with Supabase CLI: supabase db push

create extension if not exists pgcrypto;

do $$ begin
  create type public.account_type as enum ('cash', 'bank', 'mobile_wallet', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.category_type as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_kind as enum (
    'income', 'expense', 'transfer', 'loan_received', 'loan_given',
    'debt_repayment', 'receivable_collection'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.debt_direction as enum ('i_owe', 'they_owe');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.debt_status as enum ('open', 'partial', 'settled');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  account_type public.account_type not null,
  currency_code text not null default 'BDT' check (currency_code = 'BDT'),
  opening_balance_paisa bigint not null default 0 check (opening_balance_paisa >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  type public.category_type not null,
  icon text,
  color text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, type, name)
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  phone text,
  email text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.transaction_kind not null,
  amount_paisa bigint not null check (amount_paisa > 0),
  currency_code text not null default 'BDT' check (currency_code = 'BDT'),
  account_id uuid,
  from_account_id uuid,
  to_account_id uuid,
  category_id uuid,
  contact_id uuid,
  occurred_at timestamptz not null default now(),
  description text not null default '',
  notes text,
  idempotency_key uuid,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, idempotency_key),
  foreign key (account_id, user_id) references public.accounts(id, user_id),
  foreign key (from_account_id, user_id) references public.accounts(id, user_id),
  foreign key (to_account_id, user_id) references public.accounts(id, user_id),
  foreign key (category_id, user_id) references public.categories(id, user_id),
  foreign key (contact_id, user_id) references public.contacts(id, user_id),
  check (
    (kind = 'transfer' and account_id is null and from_account_id is not null and to_account_id is not null and from_account_id <> to_account_id)
    or (kind <> 'transfer' and account_id is not null and from_account_id is null and to_account_id is null)
  )
);

create table if not exists public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null,
  account_id uuid not null,
  amount_paisa bigint not null check (amount_paisa <> 0),
  effective_at timestamptz not null,
  reversal_of uuid references public.ledger_entries(id),
  created_at timestamptz not null default now(),
  foreign key (transaction_id, user_id) references public.transactions(id, user_id),
  foreign key (account_id, user_id) references public.accounts(id, user_id)
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null,
  direction public.debt_direction not null,
  principal_paisa bigint not null check (principal_paisa > 0),
  currency_code text not null default 'BDT' check (currency_code = 'BDT'),
  initial_account_id uuid not null,
  original_transaction_id uuid not null,
  opened_at timestamptz not null default now(),
  due_date date,
  status public.debt_status not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (contact_id, user_id) references public.contacts(id, user_id),
  foreign key (initial_account_id, user_id) references public.accounts(id, user_id),
  foreign key (original_transaction_id, user_id) references public.transactions(id, user_id)
);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid not null,
  transaction_id uuid not null unique,
  account_id uuid not null,
  amount_paisa bigint not null check (amount_paisa > 0),
  paid_at timestamptz not null,
  note text,
  idempotency_key uuid,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  foreign key (debt_id, user_id) references public.debts(id, user_id),
  foreign key (transaction_id, user_id) references public.transactions(id, user_id),
  foreign key (account_id, user_id) references public.accounts(id, user_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  related_record_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists accounts_user_idx on public.accounts(user_id, created_at);
create index if not exists categories_user_type_idx on public.categories(user_id, type, is_active);
create index if not exists contacts_user_idx on public.contacts(user_id, name);
create index if not exists transactions_user_date_idx on public.transactions(user_id, occurred_at desc) where voided_at is null;
create index if not exists ledger_user_account_idx on public.ledger_entries(user_id, account_id, effective_at desc);
create index if not exists debts_user_due_idx on public.debts(user_id, due_date) where status <> 'settled';
create index if not exists debt_payments_user_debt_idx on public.debt_payments(user_id, debt_id, paid_at desc) where voided_at is null;
create index if not exists notifications_user_date_idx on public.notifications(user_id, created_at desc);

-- A secure aggregate view keeps account balances correct even when the client
-- only loads a recent transaction window. Requires PostgreSQL 15+ (Supabase).
create or replace view public.account_balances
with (security_invoker = true) as
select a.id, a.user_id, a.name, a.account_type, a.currency_code,
       a.opening_balance_paisa, a.archived_at, a.created_at,
       a.opening_balance_paisa + coalesce(sum(le.amount_paisa), 0)::bigint as balance_paisa
from public.accounts a
left join public.ledger_entries le
  on le.account_id = a.id and le.user_id = a.user_id
  and not exists (select 1 from public.ledger_entries reversal where reversal.reversal_of = le.id)
group by a.id;

revoke all on public.account_balances from anon;
grant select on public.account_balances to authenticated;

create or replace view public.debt_balances
with (security_invoker = true) as
select d.*,
       coalesce(sum(dp.amount_paisa) filter (where dp.voided_at is null), 0)::bigint as paid_paisa,
       greatest(d.principal_paisa - coalesce(sum(dp.amount_paisa) filter (where dp.voided_at is null), 0), 0)::bigint as remaining_paisa,
       case
         when coalesce(sum(dp.amount_paisa) filter (where dp.voided_at is null), 0) >= d.principal_paisa then 'settled'
         when coalesce(sum(dp.amount_paisa) filter (where dp.voided_at is null), 0) > 0 then 'partial'
         else 'open'
       end as computed_status
from public.debts d
left join public.debt_payments dp on dp.debt_id = d.id and dp.user_id = d.user_id
group by d.id;

revoke all on public.debt_balances from anon;
grant select on public.debt_balances to authenticated;

-- New users get a profile and a sensible starter category set.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;

  insert into public.categories (user_id, name, type, icon, color, is_system)
  values
    (new.id, 'Salary', 'income', 'briefcase', '#16a879', true),
    (new.id, 'Business income', 'income', 'store', '#4f7cff', true),
    (new.id, 'Freelancing', 'income', 'laptop', '#8b78e6', true),
    (new.id, 'Other income', 'income', 'sparkles', '#26b99a', true),
    (new.id, 'Food & dining', 'expense', 'utensils', '#f59e0b', true),
    (new.id, 'Shopping', 'expense', 'shopping-bag', '#a78bfa', true),
    (new.id, 'Transport', 'expense', 'car', '#4f7cff', true),
    (new.id, 'Rent', 'expense', 'house', '#ec6b84', true),
    (new.id, 'Bills', 'expense', 'receipt', '#e17a8b', true),
    (new.id, 'Health', 'expense', 'heart-pulse', '#16a879', true),
    (new.id, 'Education', 'expense', 'graduation-cap', '#5688dd', true),
    (new.id, 'Other expense', 'expense', 'circle-help', '#8992a8', true)
  on conflict (user_id, type, name) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Backfill users that existed before this migration was applied.
insert into public.profiles (id, full_name, avatar_url)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), u.raw_user_meta_data->>'avatar_url'
from auth.users u
on conflict (id) do nothing;

insert into public.categories (user_id, name, type, icon, color, is_system)
select u.id, seed.name, seed.type::public.category_type, seed.icon, seed.color, true
from auth.users u
cross join (values
  ('Salary', 'income', 'briefcase', '#16a879'),
  ('Business income', 'income', 'store', '#4f7cff'),
  ('Freelancing', 'income', 'laptop', '#8b78e6'),
  ('Other income', 'income', 'sparkles', '#26b99a'),
  ('Food & dining', 'expense', 'utensils', '#f59e0b'),
  ('Shopping', 'expense', 'shopping-bag', '#a78bfa'),
  ('Transport', 'expense', 'car', '#4f7cff'),
  ('Rent', 'expense', 'house', '#ec6b84'),
  ('Bills', 'expense', 'receipt', '#e17a8b'),
  ('Health', 'expense', 'heart-pulse', '#16a879'),
  ('Education', 'expense', 'graduation-cap', '#5688dd'),
  ('Other expense', 'expense', 'circle-help', '#8992a8')
) as seed(name, type, icon, color)
on conflict (user_id, type, name) do nothing;

-- All normal reads are scoped to the signed-in owner.
alter table public.profiles enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.contacts enable row level security;
alter table public.transactions enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists accounts_select_own on public.accounts;
create policy accounts_select_own on public.accounts for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists accounts_insert_own on public.accounts;
create policy accounts_insert_own on public.accounts for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists accounts_update_own on public.accounts;
create policy accounts_update_own on public.accounts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists accounts_delete_own on public.accounts;
create policy accounts_delete_own on public.accounts for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists categories_select_own on public.categories;
create policy categories_select_own on public.categories for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists categories_insert_own on public.categories;
create policy categories_insert_own on public.categories for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists categories_update_own on public.categories;
create policy categories_update_own on public.categories for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists categories_delete_own on public.categories;
create policy categories_delete_own on public.categories for delete to authenticated using (user_id = (select auth.uid()) and is_system = false);

drop policy if exists contacts_select_own on public.contacts;
create policy contacts_select_own on public.contacts for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists contacts_insert_own on public.contacts;
create policy contacts_insert_own on public.contacts for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists contacts_update_own on public.contacts;
create policy contacts_update_own on public.contacts for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists contacts_delete_own on public.contacts;
create policy contacts_delete_own on public.contacts for delete to authenticated using (user_id = (select auth.uid()));

drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own on public.transactions for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists ledger_select_own on public.ledger_entries;
create policy ledger_select_own on public.ledger_entries for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists debts_select_own on public.debts;
create policy debts_select_own on public.debts for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists debt_payments_select_own on public.debt_payments;
create policy debt_payments_select_own on public.debt_payments for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists audit_logs_select_own on public.audit_logs;
create policy audit_logs_select_own on public.audit_logs for select to authenticated using (user_id = (select auth.uid()));

-- Do not grant direct financial writes. Financial movements must use atomic RPCs.
revoke insert, update, delete on public.transactions from anon, authenticated;
revoke insert, update, delete on public.ledger_entries from anon, authenticated;
revoke insert, update, delete on public.debts from anon, authenticated;
revoke insert, update, delete on public.debt_payments from anon, authenticated;
revoke insert, update, delete on public.audit_logs from anon, authenticated;

create or replace function public.create_money_transaction(
  p_kind text,
  p_amount_paisa bigint,
  p_account_id uuid,
  p_category_id uuid default null,
  p_occurred_at timestamptz default now(),
  p_description text default '',
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
  v_id uuid;
  v_category_type public.category_type;
  v_entry bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_idempotency_key is not null then
    select id into v_id from public.transactions where user_id = v_user and idempotency_key = p_idempotency_key;
    if found then return v_id; end if;
  end if;
  if p_kind not in ('income', 'expense') then raise exception 'Unsupported transaction type'; end if;
  if p_amount_paisa is null or p_amount_paisa <= 0 then raise exception 'Amount must be positive'; end if;
  perform 1 from public.accounts where id = p_account_id and user_id = v_user and archived_at is null for update;
  if not found then raise exception 'Invalid account'; end if;
  if p_category_id is not null then
    select type into v_category_type from public.categories where id = p_category_id and user_id = v_user and is_active = true;
    if not found then raise exception 'Invalid category'; end if;
    if (p_kind = 'income' and v_category_type <> 'income') or (p_kind = 'expense' and v_category_type <> 'expense') then raise exception 'Category type does not match transaction'; end if;
  end if;
  v_entry := case when p_kind = 'income' then p_amount_paisa else -p_amount_paisa end;
  insert into public.transactions(user_id, kind, amount_paisa, account_id, category_id, occurred_at, description, notes, idempotency_key)
  values (v_user, p_kind::public.transaction_kind, p_amount_paisa, p_account_id, p_category_id, coalesce(p_occurred_at, now()), coalesce(p_description, ''), p_notes, p_idempotency_key)
  returning id into v_id;
  insert into public.ledger_entries(user_id, transaction_id, account_id, amount_paisa, effective_at)
  values (v_user, v_id, p_account_id, v_entry, coalesce(p_occurred_at, now()));
  insert into public.audit_logs(user_id, action, entity_type, entity_id, new_values)
  values (v_user, 'create', 'transaction', v_id, jsonb_build_object('kind', p_kind, 'amount_paisa', p_amount_paisa));
  return v_id;
end;
$$;

create or replace function public.create_debt_record(
  p_contact_id uuid,
  p_direction text,
  p_principal_paisa bigint,
  p_account_id uuid,
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
  v_tx uuid;
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
  insert into public.debts(user_id, contact_id, direction, principal_paisa, initial_account_id, original_transaction_id, opened_at, due_date, notes)
  values (v_user, p_contact_id, p_direction::public.debt_direction, p_principal_paisa, p_account_id, v_tx, coalesce(p_opened_at, now()), p_due_date, p_notes)
  returning id into v_debt;
  insert into public.audit_logs(user_id, action, entity_type, entity_id, new_values)
  values (v_user, 'create', 'debt', v_debt, jsonb_build_object('direction', p_direction, 'principal_paisa', p_principal_paisa));
  return v_debt;
end;
$$;

create or replace function public.record_debt_payment(
  p_debt_id uuid,
  p_account_id uuid,
  p_amount_paisa bigint,
  p_paid_at timestamptz default now(),
  p_note text default null,
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_debt public.debts%rowtype;
  v_paid bigint;
  v_remaining bigint;
  v_tx uuid;
  v_payment uuid;
  v_kind public.transaction_kind;
  v_entry bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_idempotency_key is not null then
    select id into v_payment from public.debt_payments where user_id = v_user and idempotency_key = p_idempotency_key;
    if found then return v_payment; end if;
  end if;
  if p_amount_paisa is null or p_amount_paisa <= 0 then raise exception 'Payment must be positive'; end if;
  select * into v_debt from public.debts where id = p_debt_id and user_id = v_user for update;
  if not found then raise exception 'Debt record not found'; end if;
  perform 1 from public.accounts where id = p_account_id and user_id = v_user and archived_at is null for update;
  if not found then raise exception 'Invalid account'; end if;
  select coalesce(sum(amount_paisa), 0) into v_paid from public.debt_payments where debt_id = p_debt_id and user_id = v_user and voided_at is null;
  v_remaining := v_debt.principal_paisa - v_paid;
  if p_amount_paisa > v_remaining then raise exception 'Payment exceeds outstanding balance'; end if;
  v_kind := case when v_debt.direction = 'i_owe' then 'debt_repayment'::public.transaction_kind else 'receivable_collection'::public.transaction_kind end;
  v_entry := case when v_debt.direction = 'i_owe' then -p_amount_paisa else p_amount_paisa end;
  insert into public.transactions(user_id, kind, amount_paisa, account_id, contact_id, occurred_at, description, idempotency_key)
  values (v_user, v_kind, p_amount_paisa, p_account_id, v_debt.contact_id, coalesce(p_paid_at, now()),
    case when v_debt.direction = 'i_owe' then 'Debt repayment' else 'Receivable collected' end, p_idempotency_key)
  returning id into v_tx;
  insert into public.ledger_entries(user_id, transaction_id, account_id, amount_paisa, effective_at)
  values (v_user, v_tx, p_account_id, v_entry, coalesce(p_paid_at, now()));
  insert into public.debt_payments(user_id, debt_id, transaction_id, account_id, amount_paisa, paid_at, note, idempotency_key)
  values (v_user, p_debt_id, v_tx, p_account_id, p_amount_paisa, coalesce(p_paid_at, now()), p_note, p_idempotency_key)
  returning id into v_payment;
  if v_paid + p_amount_paisa = v_debt.principal_paisa then
    update public.debts set status = 'settled' where id = p_debt_id and user_id = v_user;
    insert into public.notifications(user_id, type, title, message, related_record_id)
    values (v_user, 'debt_settled', 'Payment fully settled', 'A debt record has been fully settled. Review its payment history.', p_debt_id);
  else
    update public.debts set status = 'partial' where id = p_debt_id and user_id = v_user;
  end if;
  insert into public.audit_logs(user_id, action, entity_type, entity_id, new_values)
  values (v_user, 'payment', 'debt_payment', v_payment, jsonb_build_object('debt_id', p_debt_id, 'amount_paisa', p_amount_paisa));
  return v_payment;
end;
$$;

create or replace function public.create_internal_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount_paisa bigint,
  p_occurred_at timestamptz default now(),
  p_description text default 'Account transfer',
  p_idempotency_key uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_tx uuid;
  v_available bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_idempotency_key is not null then
    select id into v_tx from public.transactions where user_id = v_user and idempotency_key = p_idempotency_key;
    if found then return v_tx; end if;
  end if;
  if p_amount_paisa is null or p_amount_paisa <= 0 then raise exception 'Amount must be positive'; end if;
  if p_from_account_id = p_to_account_id then raise exception 'Source and destination must differ'; end if;
  perform 1 from public.accounts where user_id = v_user and id in (p_from_account_id, p_to_account_id) and archived_at is null order by id for update;
  if (select count(*) from public.accounts where user_id = v_user and id in (p_from_account_id, p_to_account_id) and archived_at is null) <> 2 then raise exception 'Invalid account'; end if;
  select balance_paisa into v_available from public.account_balances where id = p_from_account_id and user_id = v_user;
  if coalesce(v_available, 0) < p_amount_paisa then raise exception 'Insufficient account balance'; end if;
  insert into public.transactions(user_id, kind, amount_paisa, account_id, from_account_id, to_account_id, occurred_at, description, idempotency_key)
  values (v_user, 'transfer', p_amount_paisa, null, p_from_account_id, p_to_account_id, coalesce(p_occurred_at, now()), coalesce(p_description, 'Account transfer'), p_idempotency_key)
  returning id into v_tx;
  insert into public.ledger_entries(user_id, transaction_id, account_id, amount_paisa, effective_at)
  values
    (v_user, v_tx, p_from_account_id, -p_amount_paisa, coalesce(p_occurred_at, now())),
    (v_user, v_tx, p_to_account_id, p_amount_paisa, coalesce(p_occurred_at, now()));
  insert into public.audit_logs(user_id, action, entity_type, entity_id, new_values)
  values (v_user, 'transfer', 'transaction', v_tx, jsonb_build_object('amount_paisa', p_amount_paisa, 'from', p_from_account_id, 'to', p_to_account_id));
  return v_tx;
end;
$$;

grant execute on function public.create_money_transaction(text,bigint,uuid,uuid,timestamptz,text,text,uuid) to authenticated;
grant execute on function public.create_debt_record(uuid,text,bigint,uuid,timestamptz,date,text,uuid) to authenticated;
grant execute on function public.record_debt_payment(uuid,uuid,bigint,timestamptz,text,uuid) to authenticated;
grant execute on function public.create_internal_transfer(uuid,uuid,bigint,timestamptz,text,uuid) to authenticated;

revoke all on function public.create_money_transaction(text,bigint,uuid,uuid,timestamptz,text,text,uuid) from public, anon;
revoke all on function public.create_debt_record(uuid,text,bigint,uuid,timestamptz,date,text,uuid) from public, anon;
revoke all on function public.record_debt_payment(uuid,uuid,bigint,timestamptz,text,uuid) from public, anon;
revoke all on function public.create_internal_transfer(uuid,uuid,bigint,timestamptz,text,uuid) from public, anon;

-- Keep profile ownership and prevent unauthenticated table access.
revoke all on public.profiles, public.accounts, public.categories, public.contacts,
  public.transactions, public.ledger_entries, public.debts, public.debt_payments,
  public.notifications, public.audit_logs from anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.accounts to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, update, delete on public.contacts to authenticated;
grant select on public.transactions, public.ledger_entries, public.debts, public.debt_payments, public.audit_logs to authenticated;
grant select, update on public.notifications to authenticated;
