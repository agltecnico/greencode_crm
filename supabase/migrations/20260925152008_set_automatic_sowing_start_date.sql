create table if not exists public.production_automation_settings (
  id text primary key,
  "automaticSowingFrom" date not null
);

insert into public.production_automation_settings (id, "automaticSowingFrom")
values ('weekly-calendar', date '2026-09-12')
on conflict (id) do update set "automaticSowingFrom" = excluded."automaticSowingFrom";

alter table public.production_automation_settings enable row level security;
create policy "production_automation_settings_read"
on public.production_automation_settings for select to authenticated using (true);
grant select on public.production_automation_settings to authenticated;

create or replace function public.auto_complete_sowing_tasks()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payload jsonb;
  v_start_date date;
begin
  select "automaticSowingFrom" into v_start_date
  from public.production_automation_settings where id = 'weekly-calendar';

  with chosen_lots as (
    select task.id as task_id, (
      select lot.id
      from public.crop_types crop_type
      join public.articles article on article."varietyId" = crop_type."varietyId"
        and article.type = 'SEMILLA' and article.active is not false
      join public.stock_lots lot on lot."articleId" = article.id
      where crop_type.id = task."cropTypeId"
      order by (lot."remainingQuantity" > 0) desc, lot."receivedAt" desc, lot."createdAt" desc
      limit 1
    ) as lot_id
    from public.sowing_tasks task
    where task.status = 'PENDING' and task."plannedDate" between v_start_date and current_date
      and task."stockLotId" is null
  )
  update public.sowing_tasks task
  set "stockLotId" = chosen.lot_id, "updatedAt" = now()
  from chosen_lots chosen
  where task.id = chosen.task_id and chosen.lot_id is not null;

  select jsonb_agg(jsonb_build_object(
    'taskId', task.id, 'trays', task.trays,
    'stockLotId', task."stockLotId", 'actualPlantedAt', task."actualPlantedAt"
  ) order by task."plannedDate", task."createdAt")
  into v_payload
  from public.sowing_tasks task
  where task.status = 'PENDING' and task."plannedDate" between v_start_date and current_date
    and task."stockLotId" is not null;

  if v_payload is null then return jsonb_build_object('completed', 0, 'crops', '[]'::jsonb); end if;
  return public.complete_sowing_tasks(v_payload);
end;
$$;

revoke all on function public.auto_complete_sowing_tasks() from public;
grant execute on function public.auto_complete_sowing_tasks() to authenticated;
