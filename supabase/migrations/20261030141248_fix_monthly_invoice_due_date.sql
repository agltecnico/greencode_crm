update public.invoices
set "paymentTermsDays" = 15,
    "dueDate" = (date::date + 15)::timestamptz
where "billingPeriodStart" is not null
  and type <> 'SUMMARY';

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
    if new.type <> 'SUMMARY' then
      new."paymentTermsDays" := 15;
      new."dueDate" := (new.date::date + 15)::timestamptz;
    end if;
  end if;

  return new;
end;
$$;
