alter table public.crops
  add column if not exists "cycleDayAdjustment" integer not null default 0;

comment on column public.crops."cycleDayAdjustment" is
  'Ajuste operativo en días sobre el ciclo calculado desde la fecha real de siembra. No modifica la fecha de siembra.';
