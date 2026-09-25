-- El calendario semanal pasa a ser la orden de producción. Las tareas vencidas
-- se convierten en cultivos al sincronizar y pueden dejar el lote de semilla en
-- negativo para regularizarlo posteriormente con una entrada de compra.

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
  v_substrate public.articles%rowtype;
  v_trays numeric;
  v_required numeric;
  v_substrate_required numeric;
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
    select * into v_task from public.sowing_tasks
    where id = v_input->>'taskId' for update;
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

    select * into v_lot from public.stock_lots
    where id = coalesce(v_input->>'stockLotId', v_task."stockLotId") for update;
    if not found then raise exception 'Selecciona un lote de semilla válido'; end if;
    select * into v_article from public.articles where id = v_lot."articleId";
    if not found or v_article.type <> 'SEMILLA'
       or v_article."varietyId" is distinct from v_type."varietyId" then
      raise exception 'El lote no corresponde a la variedad de la tarea';
    end if;

    v_required := coalesce(v_type."seedGrams", 0) * v_trays;
    if v_required <= 0 then raise exception 'La ficha no tiene gramos por bandeja válidos'; end if;
    v_crop_id := gen_random_uuid()::text;
    v_cultivation_batch := 'CULT-' || to_char(v_planted_at at time zone 'Europe/Madrid', 'YYYY') || '-' || upper(substr(replace(v_crop_id, '-', ''), 1, 8));

    update public.stock_lots set "remainingQuantity" = "remainingQuantity" - v_required where id = v_lot.id;

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

    v_substrate_required := greatest(coalesce(v_type."substrateLiters", 0), 0) * v_trays;
    if v_substrate_required > 0 and v_type."substrateId" is not null then
      select * into v_substrate from public.articles where id = v_type."substrateId";
      insert into public.stock_entries (
        id, "articleId", "providerId", "purchaseDate", "deliveryNote", "batchNumber",
        quantity, price, "unitCost", "createdAt"
      ) values (
        gen_random_uuid()::text, v_type."substrateId", v_substrate."providerId",
        (v_planted_at at time zone 'Europe/Madrid')::date,
        'Consumo siembra ' || v_cultivation_batch, 'SIN_LOTE',
        -v_substrate_required, 0,
        coalesce(v_substrate."currentUnitCost", v_substrate."lastPurchaseUnitCost", 0), v_planted_at
      );
    end if;

    update public.sowing_tasks set trays = v_trays, "stockLotId" = v_lot.id,
      "actualPlantedAt" = v_planted_at, status = 'COMPLETED',
      "completedCropId" = v_crop_id, "completedAt" = now(), "updatedAt" = now()
    where id = v_task.id;

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'taskId', v_task.id, 'cropId', v_crop_id,
      'cultivationBatchNumber', v_cultivation_batch, 'quantityUsed', v_required
    ));
  end loop;
  return jsonb_build_object('completed', jsonb_array_length(v_results), 'crops', v_results);
end;
$$;

revoke all on function public.complete_sowing_tasks(jsonb) from public;
grant execute on function public.complete_sowing_tasks(jsonb) to authenticated;

create or replace function public.auto_complete_sowing_tasks()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payload jsonb;
begin
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
    where task.status = 'PENDING' and task."plannedDate" <= current_date
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
  where task.status = 'PENDING' and task."plannedDate" <= current_date
    and task."stockLotId" is not null;

  if v_payload is null then return jsonb_build_object('completed', 0, 'crops', '[]'::jsonb); end if;
  return public.complete_sowing_tasks(v_payload);
end;
$$;

revoke all on function public.auto_complete_sowing_tasks() from public;
grant execute on function public.auto_complete_sowing_tasks() to authenticated;
