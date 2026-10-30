alter table public.invoices
  add column if not exists "billingPeriodStart" date;

drop policy if exists monthly_billing_runs_authenticated_delete on public.monthly_billing_runs;
create policy monthly_billing_runs_authenticated_delete
on public.monthly_billing_runs for delete to authenticated using (true);

grant delete on public.monthly_billing_runs to authenticated;

create index if not exists invoices_billing_period_start_idx
  on public.invoices ("billingPeriodStart")
  where "billingPeriodStart" is not null;

create or replace function public.assign_invoice_billing_period()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  candidate_period date;
begin
  if new."billingPeriodStart" is not null or new.date is null then
    return new;
  end if;

  candidate_period := (date_trunc('month', new.date) - interval '1 month')::date;

  if exists (
    select 1 from public.monthly_billing_runs run
    where run."periodStart" = candidate_period
  ) and not exists (
    select 1
    from jsonb_array_elements_text(coalesce(new."deliveryNoteIds", '[]'::jsonb)) requested(id)
    left join public.delivery_notes note on note.id = requested.id
    where note.id is null
      or note.date::date < candidate_period
      or note.date::date >= (candidate_period + interval '1 month')::date
  ) then
    new."billingPeriodStart" := candidate_period;
  end if;

  return new;
end;
$$;

drop trigger if exists assign_invoice_billing_period_trigger on public.invoices;
create trigger assign_invoice_billing_period_trigger
before insert on public.invoices
for each row execute function public.assign_invoice_billing_period();

create or replace function public.reopen_monthly_billing_after_invoice_delete()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old."billingPeriodStart" is not null then
    delete from public.monthly_billing_runs
    where "periodStart" = old."billingPeriodStart";
  end if;
  return old;
end;
$$;

drop trigger if exists reopen_monthly_billing_after_invoice_delete_trigger on public.invoices;
create trigger reopen_monthly_billing_after_invoice_delete_trigger
after delete on public.invoices
for each row execute function public.reopen_monthly_billing_after_invoice_delete();

revoke execute on function public.assign_invoice_billing_period() from public, anon, authenticated;
revoke execute on function public.reopen_monthly_billing_after_invoice_delete() from public, anon, authenticated;
