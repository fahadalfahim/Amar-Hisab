-- Migration 005: Allow authenticated users to delete a debt and its payments cleanly
create or replace function public.delete_debt_record(p_debt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  delete from public.debt_payments where debt_id = p_debt_id and user_id = v_user;
  delete from public.debts where id = p_debt_id and user_id = v_user;
  return true;
end;
$$;

grant execute on function public.delete_debt_record(uuid) to authenticated;
revoke all on function public.delete_debt_record(uuid) from public, anon;
