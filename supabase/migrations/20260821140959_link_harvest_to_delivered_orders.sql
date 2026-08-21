-- Vinculación retroactiva entre producto entregado y cosecha real.
-- La operación conserva la cantidad total de movimientos: sustituye una salida
-- PENDING-TRACEABILITY por una o varias salidas ligadas al lote de cosecha.

alter table public.product_movements
  add column if not exists "harvestId" text,
  add column if not exists "traceabilityLinkedAt" timestamp with time zone,
  add column if not exists "traceabilityLinkedBy" uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'product_movements_harvestId_fkey'
      and conrelid = 'public.product_movements'::regclass
  ) then
    alter table public.product_movements
      add constraint "product_movements_harvestId_fkey"
      foreign key ("harvestId") references public.harvests(id) on delete set null;
  end if;
end $$;

create index if not exists product_movements_harvest_idx
  on public.product_movements ("harvestId", type, "createdAt");

create index if not exists product_movements_pending_traceability_idx
  on public.product_movements ("productId", "createdAt")
  where type = 'ORDER'
    and quantity < 0
    and "referenceId" like '%|PENDING-TRACEABILITY';

-- La clave anterior no permitía que un pedido usara dos formatos del mismo lote.
drop index if exists public.product_movements_order_batch_idx;
create unique index product_movements_order_batch_idx
  on public.product_movements (
    "productId",
    "referenceId",
    coalesce("packagingArticleId", ''),
    coalesce("packagingFormatId", '')
  )
  where type = 'ORDER'
    and "productId" is not null
    and "referenceId" is not null;

-- Recupera vínculos históricos inequívocos a partir del producto y lote.
update public.product_movements pm
set "harvestId" = (
  select h.id
  from public.harvests h
  where h."productId" = pm."productId"
    and h."batchNumber" = case
      when pm.type = 'HARVEST' then pm."referenceId"
      else split_part(pm."referenceId", '|', 2)
    end
  order by h."harvestDate" desc nulls last, h."recordedAt" desc
  limit 1
)
where pm."harvestId" is null
  and (
    pm.type = 'HARVEST'
    or (
      pm.type = 'ORDER'
      and pm."referenceId" like '%|%'
      and pm."referenceId" not like '%|PENDING-TRACEABILITY'
    )
  );

create or replace function public.assign_product_movement_harvest()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.type = 'HARVEST' and new."harvestId" is null then
    select h.id into new."harvestId"
    from public.harvests h
    where h."productId" = new."productId"
      and h."batchNumber" = new."referenceId"
    order by h."harvestDate" desc nulls last, h."recordedAt" desc
    limit 1;
  end if;
  return new;
end;
$$;

revoke all on function public.assign_product_movement_harvest() from public;

drop trigger if exists assign_product_movement_harvest
  on public.product_movements;
create trigger assign_product_movement_harvest
before insert or update of type, "productId", "referenceId", "harvestId"
on public.product_movements
for each row execute function public.assign_product_movement_harvest();

create or replace function public.link_harvest_to_delivered_orders(
  p_harvest_id text,
  p_allocations jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_harvest public.harvests%rowtype;
  v_allocation jsonb;
  v_pending public.product_movements%rowtype;
  v_requested numeric;
  v_total_requested numeric := 0;
  v_already_linked numeric;
  v_remaining numeric;
  v_piece numeric;
  v_format jsonb;
  v_format_quantity numeric;
  v_format_used numeric;
  v_article_id text;
  v_format_id text;
  v_order_id text;
  v_existing_id text;
  v_pending_units numeric;
begin
  if jsonb_typeof(coalesce(p_allocations, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_allocations, '[]'::jsonb)) = 0 then
    raise exception 'Selecciona al menos una entrega para vincular';
  end if;

  select * into v_harvest
  from public.harvests
  where id = p_harvest_id
  for update;

  if not found then
    raise exception 'La cosecha indicada no existe';
  end if;

  select coalesce(sum(abs(pm.quantity)), 0)
  into v_already_linked
  from public.product_movements pm
  where pm."harvestId" = v_harvest.id
    and pm.type = 'ORDER'
    and pm.quantity < 0;

  for v_allocation in
    select value from jsonb_array_elements(p_allocations)
  loop
    v_requested := coalesce((v_allocation->>'quantity')::numeric, 0);
    if v_requested <= 0 then
      raise exception 'Todas las cantidades deben ser mayores que cero';
    end if;
    v_total_requested := v_total_requested + v_requested;
  end loop;

  if v_total_requested > greatest(0, v_harvest."tuppersCount" - v_already_linked) then
    raise exception 'La cantidad seleccionada supera las unidades libres de esta cosecha';
  end if;

  for v_allocation in
    select value from jsonb_array_elements(p_allocations)
  loop
    v_requested := (v_allocation->>'quantity')::numeric;

    select * into v_pending
    from public.product_movements
    where id = v_allocation->>'movementId'
    for update;

    if not found
       or v_pending.type <> 'ORDER'
       or v_pending.quantity >= 0
       or v_pending."referenceId" not like '%|PENDING-TRACEABILITY' then
      raise exception 'La entrega seleccionada ya no está pendiente de trazabilidad';
    end if;
    if v_pending."productId" is distinct from v_harvest."productId" then
      raise exception 'La entrega y la cosecha no corresponden al mismo producto';
    end if;
    if v_requested > abs(v_pending.quantity) then
      raise exception 'La cantidad supera las unidades pendientes del pedido';
    end if;

    v_order_id := split_part(v_pending."referenceId", '|', 1);
    v_remaining := v_requested;

    for v_format in
      select value
      from jsonb_array_elements(coalesce(v_harvest."packagingBreakdown", '[]'::jsonb))
    loop
      exit when v_remaining <= 0;
      v_article_id := nullif(v_format->>'articleId', '');
      v_format_id := nullif(v_format->>'formatId', '');
      v_format_quantity := coalesce((v_format->>'quantity')::numeric, 0);

      select coalesce(sum(abs(pm.quantity)), 0)
      into v_format_used
      from public.product_movements pm
      where pm."harvestId" = v_harvest.id
        and pm.type = 'ORDER'
        and pm.quantity < 0
        and pm."packagingArticleId" is not distinct from v_article_id
        and pm."packagingFormatId" is not distinct from v_format_id;

      v_piece := least(v_remaining, greatest(0, v_format_quantity - v_format_used));
      if v_piece <= 0 then
        continue;
      end if;

      select pm.id into v_existing_id
      from public.product_movements pm
      where pm."productId" = v_harvest."productId"
        and pm.type = 'ORDER'
        and pm."referenceId" = v_order_id || '|' || v_harvest."batchNumber"
        and pm."packagingArticleId" is not distinct from v_article_id
        and pm."packagingFormatId" is not distinct from v_format_id
      limit 1
      for update;

      if v_existing_id is null then
        insert into public.product_movements (
          id, "productId", quantity, type, "referenceId", "createdAt",
          "packagingArticleId", "packagingFormatId", "harvestId",
          "traceabilityLinkedAt", "traceabilityLinkedBy"
        ) values (
          gen_random_uuid()::text, v_harvest."productId", -v_piece, 'ORDER',
          v_order_id || '|' || v_harvest."batchNumber", v_pending."createdAt",
          v_article_id, v_format_id, v_harvest.id,
          statement_timestamp(), auth.uid()
        );
      else
        update public.product_movements
        set quantity = quantity - v_piece,
            "harvestId" = v_harvest.id,
            "traceabilityLinkedAt" = statement_timestamp(),
            "traceabilityLinkedBy" = auth.uid()
        where id = v_existing_id;
      end if;

      v_existing_id := null;
      v_remaining := v_remaining - v_piece;
    end loop;

    if v_remaining > 0 then
      raise exception 'No hay suficientes unidades del formato cosechado para completar la vinculación';
    end if;

    if v_requested = abs(v_pending.quantity) then
      delete from public.product_movements where id = v_pending.id;
    else
      update public.product_movements
      set quantity = quantity + v_requested
      where id = v_pending.id;
    end if;
  end loop;

  select coalesce(sum(abs(pm.quantity)), 0)
  into v_already_linked
  from public.product_movements pm
  where pm."harvestId" = v_harvest.id
    and pm.type = 'ORDER'
    and pm.quantity < 0;

  select coalesce(sum(abs(pm.quantity)), 0)
  into v_pending_units
  from public.product_movements pm
  where pm."productId" = v_harvest."productId"
    and pm.type = 'ORDER'
    and pm.quantity < 0
    and pm."referenceId" like '%|PENDING-TRACEABILITY';

  return jsonb_build_object(
    'harvestId', v_harvest.id,
    'batchNumber', v_harvest."batchNumber",
    'linkedUnits', v_total_requested,
    'remainingHarvestUnits', greatest(0, v_harvest."tuppersCount" - v_already_linked),
    'remainingPendingUnits', v_pending_units
  );
end;
$$;

revoke all on function public.link_harvest_to_delivered_orders(text, jsonb) from public;
revoke all on function public.link_harvest_to_delivered_orders(text, jsonb) from anon;
grant execute on function public.link_harvest_to_delivered_orders(text, jsonb) to authenticated;
