alter table public.harvests
  add column if not exists "recordedAt" timestamp with time zone not null default now();

alter table public.harvests
  add column if not exists "registrationNotes" text;

comment on column public.harvests."recordedAt"
  is 'Momento técnico en que la cosecha fue introducida en el sistema';

comment on column public.harvests."registrationNotes"
  is 'Motivo o comentario del registro, especialmente para cosechas retroactivas';
