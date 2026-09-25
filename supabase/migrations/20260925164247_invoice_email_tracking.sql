alter table public.invoices
  add column if not exists "emailStatus" text not null default 'NOT_SENT',
  add column if not exists "emailSentAt" timestamptz,
  add column if not exists "emailRecipient" text,
  add column if not exists "emailError" text,
  add column if not exists "emailAttempts" integer not null default 0;

alter table public.invoices
  drop constraint if exists invoices_email_status_check;

alter table public.invoices
  add constraint invoices_email_status_check
  check ("emailStatus" in ('NOT_SENT', 'SENDING', 'SENT', 'ERROR'));
