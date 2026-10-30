create table if not exists public.monthly_billing_runs (
  "periodStart" date primary key,
  "invoiceDate" date not null,
  source text not null check (source in ('MANUAL', 'AUTOMATIC')),
  "documentCount" integer not null default 0,
  "noteCount" integer not null default 0,
  "createdAt" timestamptz not null default now(),
  "createdBy" uuid default auth.uid()
);

alter table public.monthly_billing_runs enable row level security;

drop policy if exists monthly_billing_runs_authenticated_read on public.monthly_billing_runs;
create policy monthly_billing_runs_authenticated_read
on public.monthly_billing_runs for select to authenticated using (true);

drop policy if exists monthly_billing_runs_authenticated_insert on public.monthly_billing_runs;
create policy monthly_billing_runs_authenticated_insert
on public.monthly_billing_runs for insert to authenticated with check (true);

drop policy if exists monthly_billing_runs_authenticated_update on public.monthly_billing_runs;
create policy monthly_billing_runs_authenticated_update
on public.monthly_billing_runs for update to authenticated using (true) with check (true);

grant select, insert, update on public.monthly_billing_runs to authenticated;

alter table public.invoices
  add column if not exists "editHistory" jsonb not null default '[]'::jsonb;

alter table public.invoices
  drop constraint if exists invoices_edit_history_array_check;

alter table public.invoices
  add constraint invoices_edit_history_array_check
  check (jsonb_typeof("editHistory") = 'array');

create unique index if not exists invoices_invoice_number_unique
  on public.invoices ("invoiceNumber")
  where "invoiceNumber" is not null;

create or replace function public.finalize_monthly_billing(
  target_month date,
  run_source text default 'MANUAL'
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  month_start date := date_trunc('month', coalesce(target_month, current_date))::date;
  month_end date := (date_trunc('month', coalesce(target_month, current_date)) + interval '1 month - 1 day')::date;
  invoice_date date := (date_trunc('month', coalesce(target_month, current_date)) + interval '1 month')::date;
  client_record record;
  note_ids jsonb;
  note_count integer;
  document_subtotal numeric;
  document_vat numeric;
  document_total numeric;
  sequence_number integer;
  document_number text;
  document_id text;
  documents_created integer := 0;
  notes_billed integer := 0;
begin
  if run_source not in ('MANUAL', 'AUTOMATIC') then
    raise exception 'Origen de facturación no válido';
  end if;

  perform pg_advisory_xact_lock(hashtext('monthly-billing-' || month_start::text));

  if exists (select 1 from public.monthly_billing_runs where "periodStart" = month_start) then
    return jsonb_build_object('alreadyProcessed', true, 'periodStart', month_start, 'invoiceDate', invoice_date);
  end if;

  if not exists (
    select 1 from public.delivery_notes dn
    where dn.status = 'UNBILLED' and dn.date::date between month_start and month_end
  ) then
    return jsonb_build_object(
      'alreadyProcessed', false, 'empty', true, 'periodStart', month_start,
      'invoiceDate', invoice_date, 'documentCount', 0, 'noteCount', 0
    );
  end if;

  insert into public.monthly_billing_runs ("periodStart", "invoiceDate", source)
  values (month_start, invoice_date, run_source);

  for client_record in
    select c.*
    from public.clients c
    where exists (
      select 1 from public.delivery_notes dn
      where dn."clientId" = c.id
        and dn.status = 'UNBILLED'
        and dn.date::date between month_start and month_end
    )
    order by c.id
  loop
    select
      jsonb_agg(to_jsonb(dn.id) order by dn.date, dn."createdAt"),
      count(*)::integer,
      coalesce(sum(dn.total), 0)
    into note_ids, note_count, document_subtotal
    from public.delivery_notes dn
    where dn."clientId" = client_record.id
      and dn.status = 'UNBILLED'
      and dn.date::date between month_start and month_end;

    if note_count = 0 then continue; end if;

    document_vat := case when client_record."billingMode" = 'SUMMARY' then 0 else 4 end;
    document_total := document_subtotal * (1 + document_vat / 100);

    select coalesce(max(case
      when regexp_replace(i."invoiceNumber", '^.*-', '') ~ '^[0-9]+$'
      then regexp_replace(i."invoiceNumber", '^.*-', '')::integer
      else 0 end), 0) + 1
    into sequence_number
    from public.invoices i
    where extract(year from i.date) = extract(year from invoice_date)
      and case when client_record."billingMode" = 'SUMMARY' then i.type = 'SUMMARY' else i.type <> 'SUMMARY' end;

    document_number := case when client_record."billingMode" = 'SUMMARY' then 'ALB' else 'F' end
      || extract(year from invoice_date)::integer::text || '-' || lpad(sequence_number::text, 4, '0');
    document_id := gen_random_uuid()::text;

    insert into public.invoices (
      id, "invoiceNumber", type, "clientId", "clientName", "clientCommercialName",
      "clientNif", "clientAddress", "clientCity", "clientPostalCode", "clientProvince",
      date, "dueDate", subtotal, "ivaPercentage", "taxTotal", total, "paymentMethod",
      "paymentTermsDays", "deliveryNoteIds", "isPaid"
    ) values (
      document_id, document_number, client_record."billingMode", client_record.id,
      client_record.name, client_record."commercialName", client_record.nif, client_record.address,
      client_record.city, client_record."postalCode", client_record.province,
      invoice_date::timestamptz,
      case when client_record."billingMode" = 'SUMMARY' then null
        else (invoice_date + client_record."paymentTermsDays")::timestamptz end,
      document_subtotal, document_vat, document_total - document_subtotal, document_total,
      case when client_record."billingMode" = 'SUMMARY' then 'Contado'
        else coalesce(client_record."paymentMethod", 'Transferencia') end,
      case when client_record."billingMode" = 'SUMMARY' then 0 else client_record."paymentTermsDays" end,
      note_ids, false
    );

    update public.delivery_notes set status = 'BILLED'
    where id in (select jsonb_array_elements_text(note_ids));

    documents_created := documents_created + 1;
    notes_billed := notes_billed + note_count;
  end loop;

  update public.monthly_billing_runs
  set "documentCount" = documents_created, "noteCount" = notes_billed
  where "periodStart" = month_start;

  delete from public.billing_drafts where "periodStart" = month_start;

  return jsonb_build_object(
    'alreadyProcessed', false, 'periodStart', month_start, 'invoiceDate', invoice_date,
    'documentCount', documents_created, 'noteCount', notes_billed
  );
end;
$$;

revoke execute on function public.finalize_monthly_billing(date, text) from public, anon;
grant execute on function public.finalize_monthly_billing(date, text) to authenticated, postgres, service_role;

create or replace function public.update_invoice_document(
  target_invoice_id text,
  target_note_ids jsonb,
  target_invoice_date date,
  target_vat numeric,
  target_payment_method text,
  target_payment_terms integer
)
returns public.invoices
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_invoice public.invoices;
  current_note_ids jsonb;
  new_subtotal numeric;
  final_vat numeric;
  updated_invoice public.invoices;
begin
  if jsonb_typeof(target_note_ids) <> 'array' or jsonb_array_length(target_note_ids) = 0 then
    raise exception 'La factura debe incluir al menos un albarán';
  end if;

  select * into current_invoice from public.invoices where id = target_invoice_id for update;
  if not found then raise exception 'Factura no encontrada'; end if;

  if exists (
    select 1 from jsonb_array_elements_text(target_note_ids) requested(id)
    left join public.delivery_notes dn on dn.id = requested.id
    where dn.id is null
      or dn."clientId" is distinct from current_invoice."clientId"
      or (dn.status <> 'UNBILLED' and not (coalesce(current_invoice."deliveryNoteIds", '[]'::jsonb) ? dn.id))
  ) then
    raise exception 'Hay albaranes que no pertenecen al cliente o ya están facturados';
  end if;

  current_note_ids := coalesce(current_invoice."deliveryNoteIds", '[]'::jsonb);

  update public.delivery_notes set status = 'UNBILLED'
  where id in (select jsonb_array_elements_text(current_note_ids))
    and not (target_note_ids ? id);

  update public.delivery_notes set status = 'BILLED'
  where id in (select jsonb_array_elements_text(target_note_ids));

  select coalesce(sum(total), 0) into new_subtotal
  from public.delivery_notes where id in (select jsonb_array_elements_text(target_note_ids));

  final_vat := case when current_invoice.type = 'SUMMARY' then 0 else target_vat end;

  update public.invoices
  set "deliveryNoteIds" = target_note_ids,
      date = target_invoice_date::timestamptz,
      subtotal = new_subtotal,
      "ivaPercentage" = final_vat,
      "taxTotal" = new_subtotal * final_vat / 100,
      total = new_subtotal * (1 + final_vat / 100),
      "paymentMethod" = case when current_invoice.type = 'SUMMARY' then 'Contado' else target_payment_method end,
      "paymentTermsDays" = case when current_invoice.type = 'SUMMARY' then 0 else target_payment_terms end,
      "dueDate" = case when current_invoice.type = 'SUMMARY' then null
        else (target_invoice_date + target_payment_terms)::timestamptz end,
      "editHistory" = coalesce("editHistory", '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'editedAt', now(), 'editedBy', auth.uid(), 'previousDate', current_invoice.date,
        'previousDeliveryNoteIds', current_note_ids, 'previousSubtotal', current_invoice.subtotal,
        'previousIvaPercentage', current_invoice."ivaPercentage",
        'previousPaymentMethod', current_invoice."paymentMethod",
        'previousPaymentTermsDays', current_invoice."paymentTermsDays"
      ))
  where id = target_invoice_id
  returning * into updated_invoice;

  return updated_invoice;
end;
$$;

revoke execute on function public.update_invoice_document(text, jsonb, date, numeric, text, integer) from public, anon;
grant execute on function public.update_invoice_document(text, jsonb, date, numeric, text, integer) to authenticated;

create or replace function public.generate_monthly_billing_drafts(target_month date default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.finalize_monthly_billing(
    coalesce(target_month, (date_trunc('month', current_date) - interval '1 month')::date),
    'AUTOMATIC'
  );
  return 0;
end;
$$;

comment on function public.generate_monthly_billing_drafts(date) is
  'Compatibilidad con el cron existente: crea documentos definitivos y evita duplicados por periodo.';
