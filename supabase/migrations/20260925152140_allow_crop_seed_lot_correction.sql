create or replace function public.change_crop_seed_lot(p_crop_id text, p_new_lot_id text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_crop public.crops%rowtype;
  v_type public.crop_types%rowtype;
  v_old_lot public.stock_lots%rowtype;
  v_new_lot public.stock_lots%rowtype;
  v_new_article public.articles%rowtype;
  v_quantity numeric;
begin
  select * into v_crop from public.crops where id = p_crop_id for update;
  if not found then raise exception 'Cultivo no encontrado'; end if;
  if v_crop.status = 'HARVESTED' then raise exception 'No se puede cambiar el lote de un cultivo ya cosechado'; end if;
  if v_crop."seedStockLotId" = p_new_lot_id then
    return jsonb_build_object('cropId', v_crop.id, 'stockLotId', p_new_lot_id);
  end if;

  select * into v_type from public.crop_types where id = v_crop."cropTypeId";
  select * into v_new_lot from public.stock_lots where id = p_new_lot_id for update;
  if not found then raise exception 'Lote de semilla no encontrado'; end if;
  select * into v_new_article from public.articles where id = v_new_lot."articleId";
  if v_new_article.type <> 'SEMILLA' or v_new_article."varietyId" is distinct from v_type."varietyId" then
    raise exception 'El lote no corresponde a la variedad del cultivo';
  end if;

  v_quantity := coalesce(v_crop."seedQuantityUsed", v_crop."gramsPerTray" * v_crop."traysCount", 0);
  if v_crop."seedStockLotId" is not null then
    select * into v_old_lot from public.stock_lots where id = v_crop."seedStockLotId" for update;
    if found then update public.stock_lots set "remainingQuantity" = "remainingQuantity" + v_quantity where id = v_old_lot.id; end if;
  end if;
  update public.stock_lots set "remainingQuantity" = "remainingQuantity" - v_quantity where id = v_new_lot.id;

  update public.stock_entries set
    "articleId" = v_new_lot."articleId", "providerId" = v_new_lot."providerId",
    "batchNumber" = v_new_lot."supplierBatch", "unitCost" = v_new_lot."unitCost",
    "stockLotId" = v_new_lot.id
  where "deliveryNote" = 'Consumo siembra ' || v_crop."cultivationBatchNumber"
    and "stockLotId" is not null;

  update public.crops set
    "seedStockLotId" = v_new_lot.id, "batchNumber" = v_new_lot."supplierBatch",
    "seedSupplierBatch" = v_new_lot."supplierBatch", "seedProviderId" = v_new_lot."providerId"
  where id = v_crop.id;

  return jsonb_build_object('cropId', v_crop.id, 'stockLotId', v_new_lot.id, 'batchNumber', v_new_lot."supplierBatch");
end;
$$;

revoke all on function public.change_crop_seed_lot(text, text) from public;
grant execute on function public.change_crop_seed_lot(text, text) to authenticated;
