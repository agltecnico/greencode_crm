create table public.sowing_tasks (
  id text primary key default gen_random_uuid()::text,
  "originKey" text not null unique,
  "harvestTargetId" text references public.harvest_targets(id) on delete set null,
  "cropTypeId" text not null references public.crop_types(id) on delete restrict,
  "plannedDate" date not null,
  "plannedTrays" numeric not null check ("plannedTrays" > 0),
  trays numeric not null check (trays > 0),
  "stockLotId" text references public.stock_lots(id) on delete restrict,
  "actualPlantedAt" timestamptz,
  status text not null default 'PENDING' check (status in ('PENDING', 'COMPLETED', 'CANCELLED')),
  "completedCropId" text references public.crops(id) on delete restrict,
  "completedAt" timestamptz,
  "cancelledAt" timestamptz,
  "createdAt" timestamptz not null default now(),
  "updatedAt" timestamptz not null default now()
);

create index sowing_tasks_pending_date_idx
  on public.sowing_tasks ("plannedDate", "createdAt")
  where status = 'PENDING';
create index sowing_tasks_crop_type_idx on public.sowing_tasks ("cropTypeId");

alter table public.sowing_tasks enable row level security;

create policy "sowing_tasks_read"
on public.sowing_tasks for select to authenticated using (true);
create policy "sowing_tasks_insert"
on public.sowing_tasks for insert to authenticated with check (true);
create policy "sowing_tasks_update"
on public.sowing_tasks for update to authenticated using (true) with check (true);

grant select, insert, update on public.sowing_tasks to authenticated;

create table public.sowing_task_sync_state (
  id text primary key,
  "lastGeneratedDate" date not null
);

insert into public.sowing_task_sync_state (id, "lastGeneratedDate")
values ('weekly-planner', current_date - 1)
on conflict (id) do nothing;

alter table public.sowing_task_sync_state enable row level security;
create policy "sowing_task_sync_state_read"
on public.sowing_task_sync_state for select to authenticated using (true);
create policy "sowing_task_sync_state_update"
on public.sowing_task_sync_state for update to authenticated using (true) with check (true);
grant select, update on public.sowing_task_sync_state to authenticated;

create or replace function public.sync_sowing_tasks()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_from date;
  v_created integer := 0;
begin
  select least("lastGeneratedDate" + 1, current_date)
    into v_from
  from public.sowing_task_sync_state
  where id = 'weekly-planner'
  for update;

  if v_from is null then
    raise exception 'No existe el estado del planificador de siembras';
  end if;

  if v_from <= current_date then
    insert into public.sowing_tasks (
      "originKey", "harvestTargetId", "cropTypeId", "plannedDate",
      "plannedTrays", trays, "stockLotId", "actualPlantedAt"
    )
    select
      target.id || ':' || day_value::date,
      target.id,
      crop_type.id,
      day_value::date,
      target."tuppersCount",
      target."tuppersCount",
      default_lot.id,
      (day_value::date + time '09:00') at time zone 'Europe/Madrid'
    from generate_series(v_from, current_date, interval '1 day') as generated(day_value)
    join public.harvest_targets target on true
    join public.crop_types crop_type on crop_type.id = target."productId"
    left join lateral (
      select lot.id
      from public.stock_lots lot
      join public.articles article on article.id = lot."articleId"
      left join lateral (
        select max(entry."createdAt") as "lastUsedAt"
        from public.stock_entries entry
        where entry."stockLotId" = lot.id and entry.quantity < 0
      ) usage on true
      where article.type = 'SEMILLA'
        and article."varietyId" = crop_type."varietyId"
        and article.active is not false
        and lot."remainingQuantity" > 0
      order by usage."lastUsedAt" desc nulls last, lot."receivedAt" asc, lot."createdAt" asc
      limit 1
    ) default_lot on true
    where extract(dow from day_value)::integer = mod(
      mod(target."targetDayOfWeek"::integer - (
        case when coalesce(crop_type."soakingHours", 0) > 0
          then greatest(1, ceil(crop_type."soakingHours"::numeric / 24)::integer)
          else 0
        end
        + coalesce(crop_type."germinationDays", 0)::integer
        + coalesce(crop_type."darknessDays", 0)::integer
        + coalesce(crop_type."lightDays", 0)::integer
      ), 7) + 7, 7
    )
    on conflict ("originKey") do nothing;

    get diagnostics v_created = row_count;

    update public.sowing_task_sync_state
      set "lastGeneratedDate" = current_date
    where id = 'weekly-planner';
  end if;

  return v_created;
end;
$$;

revoke all on function public.sync_sowing_tasks() from public;
grant execute on function public.sync_sowing_tasks() to authenticated;

create or replace function public.complete_sowing_tasks(p_tasks jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_input jsonb;
  v_task public.sowing_tasks%rowtype;
  v_type public.crop_types%rowtype;
  v_lot public.stock_lots%rowtype;
  v_article public.articles%rowtype;
  v_trays numeric;
  v_required numeric;
  v_planted_at timestamptz;
  v_crop_id text;
  v_cultivation_batch text;
  v_results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(coalesce(p_tasks, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_tasks, '[]'::jsonb)) = 0 then
    raise exception 'Selecciona al menos una siembra';
  end if;

  for v_input in select value from jsonb_array_elements(p_tasks)
  loop
    select * into v_task
    from public.sowing_tasks
    where id = v_input->>'taskId'
    for update;

    if not found or v_task.status <> 'PENDING' then
      raise exception 'La tarea de siembra ya no está pendiente';
    end if;

    select * into v_type from public.crop_types where id = v_task."cropTypeId";
    if not found or v_type."varietyId" is null then
      raise exception 'La ficha de cultivo de una tarea no es válida';
    end if;

    v_trays := coalesce((v_input->>'trays')::numeric, v_task.trays);
    v_planted_at := coalesce((v_input->>'actualPlantedAt')::timestamptz, v_task."actualPlantedAt");
    if v_trays <= 0 then raise exception 'El número de bandejas debe ser positivo'; end if;
    if v_planted_at is null then raise exception 'Indica la fecha real de cada siembra'; end if;

    select * into v_lot
    from public.stock_lots
    where id = coalesce(v_input->>'stockLotId', v_task."stockLotId")
    for update;
    if not found then raise exception 'Selecciona un lote de semilla válido'; end if;

    select * into v_article from public.articles where id = v_lot."articleId";
    if not found or v_article.type <> 'SEMILLA'
       or v_article."varietyId" is distinct from v_type."varietyId" then
      raise exception 'El lote no corresponde a la variedad de la tarea';
    end if;

    v_required := coalesce(v_type."seedGrams", 0) * v_trays;
    if v_required <= 0 then raise exception 'La ficha no tiene gramos por bandeja válidos'; end if;
    if v_lot."remainingQuantity" < v_required then
      raise exception 'Stock insuficiente en el lote %', v_lot."supplierBatch";
    end if;

    v_crop_id := gen_random_uuid()::text;
    v_cultivation_batch := 'CULT-' || to_char(v_planted_at at time zone 'Europe/Madrid', 'YYYY') || '-' || upper(substr(replace(v_crop_id, '-', ''), 1, 8));

    update public.stock_lots
      set "remainingQuantity" = "remainingQuantity" - v_required
    where id = v_lot.id;

    insert into public.crops (
      id, "cropTypeId", "traysCount", "gramsPerTray", "substrateCostPerTray",
      status, "datePlanted", "batchNumber", "cultivationBatchNumber",
      "seedStockLotId", "seedQuantityUsed", "seedSupplierBatch", "seedProviderId"
    ) values (
      v_crop_id, v_type.id, v_trays, v_type."seedGrams", 0,
      case when coalesce(v_type."soakingHours", 0) > 0 then 'SOAKING' else 'GERMINATING' end,
      v_planted_at, v_lot."supplierBatch", v_cultivation_batch,
      v_lot.id, v_required, v_lot."supplierBatch", v_lot."providerId"
    );

    insert into public.stock_entries (
      id, "articleId", "providerId", "purchaseDate", "deliveryNote", "batchNumber",
      quantity, price, "unitCost", "stockLotId", "createdAt"
    ) values (
      gen_random_uuid()::text, v_lot."articleId", v_lot."providerId",
      (v_planted_at at time zone 'Europe/Madrid')::date,
      'Consumo siembra ' || v_cultivation_batch, v_lot."supplierBatch",
      -v_required, 0, v_lot."unitCost", v_lot.id, v_planted_at
    );

    update public.sowing_tasks set
      trays = v_trays,
      "stockLotId" = v_lot.id,
      "actualPlantedAt" = v_planted_at,
      status = 'COMPLETED',
      "completedCropId" = v_crop_id,
      "completedAt" = now(),
      "updatedAt" = now()
    where id = v_task.id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'taskId', v_task.id,
      'cropId', v_crop_id,
      'cultivationBatchNumber', v_cultivation_batch,
      'quantityUsed', v_required
    ));
  end loop;

  return jsonb_build_object('completed', jsonb_array_length(v_results), 'crops', v_results);
end;
$$;

revoke all on function public.complete_sowing_tasks(jsonb) from public;
grant execute on function public.complete_sowing_tasks(jsonb) to authenticated;
