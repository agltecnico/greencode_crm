create or replace function public.increase_active_crop_trays(
  p_crop_id text,
  p_new_trays numeric,
  p_consume_stock boolean default false
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_crop public.crops%rowtype;
  v_type public.crop_types%rowtype;
  v_seed_lot public.stock_lots%rowtype;
  v_substrate public.articles%rowtype;
  v_delta numeric;
  v_seed_quantity numeric;
  v_substrate_quantity numeric;
  v_seed_cost numeric := 0;
  v_substrate_cost numeric := 0;
begin
  select * into v_crop from public.crops where id = p_crop_id for update;
  if not found then raise exception 'Cultivo no encontrado'; end if;
  if upper(coalesce(v_crop.status, '')) in ('HARVESTED', 'DISCARDED') then
    raise exception 'Solo se pueden ampliar cultivos activos';
  end if;
  if p_new_trays <= v_crop."traysCount" then
    raise exception 'La nueva cantidad debe ser mayor que las bandejas actuales';
  end if;

  select * into v_type from public.crop_types where id = v_crop."cropTypeId";
  if not found then raise exception 'Ficha de cultivo no encontrada'; end if;

  v_delta := p_new_trays - v_crop."traysCount";
  v_seed_quantity := greatest(coalesce(v_type."seedGrams", v_crop."gramsPerTray", 0), 0) * v_delta;
  v_substrate_quantity := greatest(coalesce(v_type."substrateLiters", 0), 0) * v_delta;

  if p_consume_stock then
    if v_seed_quantity > 0 then
      if v_crop."seedStockLotId" is null then
        raise exception 'El cultivo no tiene un lote de semilla asociado';
      end if;
      select * into v_seed_lot from public.stock_lots where id = v_crop."seedStockLotId" for update;
      if not found or v_seed_lot."remainingQuantity" < v_seed_quantity then
        raise exception 'Stock insuficiente en el lote de semilla asociado';
      end if;
      update public.stock_lots
      set "remainingQuantity" = "remainingQuantity" - v_seed_quantity
      where id = v_seed_lot.id;
      v_seed_cost := v_seed_quantity * coalesce(v_seed_lot."unitCost", 0);

      insert into public.stock_entries (
        id, "articleId", "providerId", "purchaseDate", "deliveryNote", "batchNumber",
        quantity, price, "unitCost", "stockLotId", "createdAt"
      ) values (
        gen_random_uuid()::text, v_seed_lot."articleId", v_seed_lot."providerId", current_date,
        'Ampliación cultivo ' || coalesce(v_crop."cultivationBatchNumber", v_crop."batchNumber", v_crop.id),
        v_seed_lot."supplierBatch", -v_seed_quantity, 0, v_seed_lot."unitCost", v_seed_lot.id, now()
      );
    end if;

    if v_substrate_quantity > 0 and v_type."substrateId" is not null then
      select * into v_substrate from public.articles where id = v_type."substrateId";
      v_substrate_cost := v_substrate_quantity * coalesce(v_substrate."currentUnitCost", v_substrate."lastPurchaseUnitCost", 0);
      insert into public.stock_entries (
        id, "articleId", "providerId", "purchaseDate", "deliveryNote", "batchNumber",
        quantity, price, "unitCost", "createdAt"
      ) values (
        gen_random_uuid()::text, v_type."substrateId", v_substrate."providerId", current_date,
        'Ampliación cultivo ' || coalesce(v_crop."cultivationBatchNumber", v_crop."batchNumber", v_crop.id),
        'SIN_LOTE', -v_substrate_quantity, 0,
        coalesce(v_substrate."currentUnitCost", v_substrate."lastPurchaseUnitCost", 0), now()
      );
    end if;
  end if;

  update public.crops
  set "traysCount" = p_new_trays,
      "seedQuantityUsed" = coalesce("seedQuantityUsed", "gramsPerTray" * "traysCount", 0) + v_seed_quantity,
      "exactCost" = coalesce("exactCost", 0) + v_seed_cost + v_substrate_cost
  where id = p_crop_id;

  return jsonb_build_object(
    'cropId', p_crop_id,
    'previousTrays', v_crop."traysCount",
    'newTrays', p_new_trays,
    'addedTrays', v_delta,
    'seedQuantityAdded', v_seed_quantity,
    'substrateQuantityAdded', v_substrate_quantity,
    'stockConsumed', p_consume_stock
  );
end;
$function$;

revoke all on function public.increase_active_crop_trays(text, numeric, boolean) from public;
grant execute on function public.increase_active_crop_trays(text, numeric, boolean) to authenticated;
