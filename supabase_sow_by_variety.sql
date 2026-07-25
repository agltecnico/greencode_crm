create or replace function public.sow_crop_from_lot(
  p_crop_type_id text,
  p_trays numeric,
  p_stock_lot_id text
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
  v_type public.crop_types%rowtype;
  v_lot public.stock_lots%rowtype;
  v_article public.articles%rowtype;
  v_required numeric;
  v_crop_id text := gen_random_uuid()::text;
  v_cultivation_batch text := 'CULT-' || to_char(current_date, 'YYYY') || '-' ||
    lpad((floor(extract(epoch from clock_timestamp()))::bigint % 1000000)::text, 6, '0');
begin
  if p_trays <= 0 then raise exception 'El número de bandejas debe ser positivo'; end if;

  select * into v_type from public.crop_types where id = p_crop_type_id;
  if not found then raise exception 'Ficha de cultivo no encontrada'; end if;
  if v_type."varietyId" is null then raise exception 'La ficha no tiene una variedad asignada'; end if;

  select * into v_lot from public.stock_lots where id = p_stock_lot_id for update;
  if not found then raise exception 'Lote de semilla no encontrado'; end if;

  select * into v_article from public.articles where id = v_lot."articleId";
  if not found or v_article.type <> 'SEMILLA' then raise exception 'El lote seleccionado no es de semilla'; end if;
  if v_article."varietyId" is distinct from v_type."varietyId" then
    raise exception 'El lote no corresponde a la variedad de la ficha';
  end if;

  v_required := coalesce(v_type."seedGrams", 0) * p_trays;
  if v_required <= 0 then raise exception 'La ficha no tiene gramos por bandeja válidos'; end if;
  if v_lot."remainingQuantity" < v_required then raise exception 'Stock insuficiente en el lote seleccionado'; end if;

  update public.stock_lots
  set "remainingQuantity" = "remainingQuantity" - v_required
  where id = v_lot.id;

  insert into public.crops
    (id, "cropTypeId", "traysCount", "gramsPerTray", "substrateCostPerTray", status, "datePlanted",
     "batchNumber", "cultivationBatchNumber", "seedStockLotId", "seedQuantityUsed",
     "seedSupplierBatch", "seedProviderId")
  values
    (v_crop_id, v_type.id, p_trays, v_type."seedGrams", 0,
     case when coalesce(v_type."soakingHours", 0) > 0 then 'SOAKING' else 'GERMINATING' end,
     now(), v_lot."supplierBatch", v_cultivation_batch, v_lot.id, v_required,
     v_lot."supplierBatch", v_lot."providerId");

  insert into public.stock_entries
    (id, "articleId", "providerId", "purchaseDate", "deliveryNote", "batchNumber",
     quantity, price, "unitCost", "stockLotId")
  values
    (gen_random_uuid()::text, v_lot."articleId", v_lot."providerId", current_date,
     'Consumo siembra ' || v_cultivation_batch, v_lot."supplierBatch",
     -v_required, 0, v_lot."unitCost", v_lot.id);

  return jsonb_build_object(
    'cropId', v_crop_id,
    'cultivationBatchNumber', v_cultivation_batch,
    'quantityUsed', v_required,
    'articleId', v_lot."articleId",
    'providerId', v_lot."providerId"
  );
end;
$function$;

update public.crop_types
set "seedId" = null,
    "providerId" = null
where "varietyId" is not null;
