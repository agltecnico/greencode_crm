alter table public.clients
  add column if not exists "billingMode" text not null default 'INVOICE';

alter table public.clients
  drop constraint if exists clients_billing_mode_check;

alter table public.clients
  add constraint clients_billing_mode_check
  check ("billingMode" in ('INVOICE', 'SUMMARY'));

-- Conserva el criterio usado hasta ahora por cada cliente. Si tiene historial,
-- se toma el tipo de su documento más reciente.
update public.clients c
set "billingMode" = case when (
  select i.type
  from public.invoices i
  where i."clientId" = c.id
  order by i.date desc nulls last, i."createdAt" desc nulls last
  limit 1
) = 'SUMMARY' then 'SUMMARY' else 'INVOICE' end
where exists (select 1 from public.invoices i where i."clientId" = c.id);

create table if not exists public.billing_drafts (
  id text primary key default gen_random_uuid()::text,
  "clientId" text not null references public.clients(id) on delete cascade,
  "billingMode" text not null check ("billingMode" in ('INVOICE', 'SUMMARY')),
  "periodStart" date not null,
  "periodEnd" date not null,
  "deliveryNoteIds" jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  "noteCount" integer not null default 0,
  status text not null default 'PENDING' check (status in ('PENDING', 'DISMISSED')),
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now(),
  constraint billing_drafts_note_ids_array check (jsonb_typeof("deliveryNoteIds") = 'array'),
  constraint billing_drafts_period_check check ("periodEnd" >= "periodStart"),
  unique ("clientId", "periodStart")
);

alter table public.billing_drafts enable row level security;

drop policy if exists billing_drafts_authenticated_all on public.billing_drafts;
create policy billing_drafts_authenticated_all
on public.billing_drafts
for all
to authenticated
using (true)
with check (true);

create or replace function public.generate_monthly_billing_drafts(target_month date default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  month_start date := coalesce(date_trunc('month', target_month)::date, (date_trunc('month', current_date) - interval '1 month')::date);
  month_end date;
  affected integer := 0;
begin
  month_end := (month_start + interval '1 month - 1 day')::date;

  insert into public.billing_drafts (
    "clientId", "billingMode", "periodStart", "periodEnd",
    "deliveryNoteIds", subtotal, "noteCount", status, "updatedAt"
  )
  select
    c.id,
    c."billingMode",
    month_start,
    month_end,
    jsonb_agg(to_jsonb(dn.id) order by dn.date, dn."createdAt"),
    coalesce(sum(dn.total), 0),
    count(*)::integer,
    'PENDING',
    now()
  from public.clients c
  join public.delivery_notes dn
    on dn."clientId" = c.id
   and dn.status = 'UNBILLED'
   and dn.date::date between month_start and month_end
  group by c.id, c."billingMode"
  on conflict ("clientId", "periodStart") do update
  set "billingMode" = excluded."billingMode",
      "periodEnd" = excluded."periodEnd",
      "deliveryNoteIds" = excluded."deliveryNoteIds",
      subtotal = excluded.subtotal,
      "noteCount" = excluded."noteCount",
      status = 'PENDING',
      "updatedAt" = now();

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke execute on function public.generate_monthly_billing_drafts(date) from public, anon, authenticated;
grant execute on function public.generate_monthly_billing_drafts(date) to postgres, service_role;

create extension if not exists pg_cron with schema pg_catalog;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'generate-monthly-billing-drafts';
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;

  perform cron.schedule(
    'generate-monthly-billing-drafts',
    '0 5 1 * *',
    $job$select public.generate_monthly_billing_drafts();$job$
  );
end $$;

-- Prepara también el mes anterior al activar la funcionalidad.
select public.generate_monthly_billing_drafts();
