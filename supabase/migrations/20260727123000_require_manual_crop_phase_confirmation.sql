alter table public.crops
  add column if not exists "phaseConfirmedAt" timestamptz;

create or replace function public.require_crop_phase_confirmation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('SOAKING', 'GERMINATING', 'DARKNESS', 'LIGHT', 'READY')
     and new."phaseConfirmedAt" is not distinct from old."phaseConfirmedAt" then
    raise exception 'El cambio de fase requiere confirmación manual';
  end if;
  return new;
end;
$$;

drop trigger if exists crops_require_phase_confirmation on public.crops;
create trigger crops_require_phase_confirmation
before update of status on public.crops
for each row
execute function public.require_crop_phase_confirmation();
