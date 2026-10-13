alter table public.clients
  add column if not exists "paymentTermsDays" integer not null default 15;

alter table public.clients
  drop constraint if exists clients_payment_terms_days_check;

alter table public.clients
  add constraint clients_payment_terms_days_check
  check ("paymentTermsDays" between 0 and 365);

alter table public.invoices
  add column if not exists "paymentTermsDays" integer not null default 15,
  add column if not exists "dueDate" date,
  add column if not exists "emailSendHistory" jsonb not null default '[]'::jsonb;

update public.invoices
set "dueDate" = ("date"::date + "paymentTermsDays")
where "dueDate" is null
  and coalesce("type", 'INVOICE') <> 'SUMMARY';

update public.invoices
set "emailSendHistory" = jsonb_build_array(jsonb_build_object(
  'sentAt', "emailSentAt",
  'recipient', "emailRecipient",
  'legacy', true
))
where "emailSentAt" is not null
  and "emailSendHistory" = '[]'::jsonb;

alter table public.invoices
  drop constraint if exists invoices_payment_terms_days_check;

alter table public.invoices
  add constraint invoices_payment_terms_days_check
  check ("paymentTermsDays" between 0 and 365);

alter table public.invoices
  drop constraint if exists invoices_email_send_history_array_check;

alter table public.invoices
  add constraint invoices_email_send_history_array_check
  check (jsonb_typeof("emailSendHistory") = 'array');
