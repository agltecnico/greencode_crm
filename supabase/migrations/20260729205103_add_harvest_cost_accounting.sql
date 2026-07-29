alter table public.harvests
  add column if not exists "seedCost" numeric not null default 0,
  add column if not exists "substrateCost" numeric not null default 0,
  add column if not exists "packagingCost" numeric not null default 0,
  add column if not exists "totalCost" numeric not null default 0;

create or replace function public.register_harvest(
  p_product_id text,
  p_batch_number text,
  p_harvest_date timestamp with time zone,
  p_selected_crop_usages jsonb,
  p_packaging_breakdown jsonb
)
returns jsonb
language plpgsql
set search_path = public
as $function$
declare
  v_product_recipe jsonb;
  v_allowed_packaging jsonb;
  v_crop_usage record;
  v_crop record;
  v_packaging record;
  v_selected_varieties text[] := array[]::text[];
  v_total_tuppers numeric := 0;
  v_harvest_id text := gen_random_uuid()::text;
  v_selected_crop_ids jsonb;
  v_minimum_varieties integer;
  v_packaging_stock numeric;
  v_seed_cost numeric := 0;
  v_substrate_cost numeric := 0;
  v_packaging_cost numeric := 0;
  v_crop_seed_quantity numeric;
  v_crop_seed_cost numeric;
  v_crop_substrate_cost numeric;
  v_total_cost numeric;
begin
  if p_product_id is null or btrim(coalesce(p_batch_number, '')) = '' then
    raise exception 'El producto y el lote de cosecha son obligatorios';
  end if;

  select "recipeVarieties", "packagingArticleIds"
  into v_product_recipe, v_allowed_packaging
  from public.products
  where id = p_product_id;

  if not found then raise exception 'Producto de venta no encontrado'; end if;
  if jsonb_array_length(coalesce(v_product_recipe, '[]'::jsonb)) = 0 then
    raise exception 'El producto no tiene variedades configuradas';
  end if;
  if jsonb_array_length(coalesce(v_allowed_packaging, '[]'::jsonb)) = 0 then
    raise exception 'El producto no tiene envases asignados';
  end if;

  v_minimum_varieties := least(4, jsonb_array_length(v_product_recipe));
  if coalesce(p_selected_crop_usages, '{}'::jsonb) = '{}'::jsonb then
    raise exception 'Debes seleccionar al menos un cultivo';
  end if;

  for v_crop_usage in
    select key as crop_id, value::text::numeric as trays
    from jsonb_each(coalesce(p_selected_crop_usages, '{}'::jsonb))
  loop
    if v_crop_usage.trays <= 0 then continue; end if;

    select
      c.*,
      ct."varietyId" as variety_id,
      coalesce(sl."unitCost", 0) as seed_unit_cost,
      coalesce(ct."substrateLiters", 0) as substrate_liters,
      coalesce(substrate."currentUnitCost", substrate."lastPurchaseUnitCost", 0) as substrate_unit_cost
    into v_crop
    from public.crops c
    left join public.crop_types ct on ct.id = c."cropTypeId"
    left join public.stock_lots sl on sl.id = c."seedStockLotId"
    left join public.articles substrate on substrate.id = ct."substrateId"
    where c.id = v_crop_usage.crop_id
    for update of c;

    if not found or v_crop.status <> 'READY' then
      raise exception 'El cultivo % no está listo para cosechar', v_crop_usage.crop_id;
    end if;
    if v_crop_usage.trays > v_crop."traysCount" then
      raise exception 'No hay suficientes bandejas disponibles en el cultivo %', v_crop_usage.crop_id;
    end if;
    if v_crop.variety_id is null or not exists (
      select 1
      from jsonb_array_elements(v_product_recipe) recipe
      where recipe->>'varietyId' = v_crop.variety_id
    ) then
      raise exception 'El cultivo % no pertenece a la receta del producto', v_crop_usage.crop_id;
    end if;

    v_selected_varieties := array_append(v_selected_varieties, v_crop.variety_id);
    v_crop_seed_quantity :=
      coalesce(v_crop."seedQuantityUsed", v_crop."gramsPerTray" * v_crop."traysCount", 0)
      * v_crop_usage.trays / nullif(v_crop."traysCount", 0);
    v_crop_seed_cost := v_crop_seed_quantity * v_crop.seed_unit_cost;
    v_crop_substrate_cost :=
      v_crop.substrate_liters * v_crop_usage.trays * v_crop.substrate_unit_cost;
    v_seed_cost := v_seed_cost + v_crop_seed_cost;
    v_substrate_cost := v_substrate_cost + v_crop_substrate_cost;

    update public.crops
    set
      "traysCount" = "traysCount" - v_crop_usage.trays,
      "seedQuantityUsed" = greatest(coalesce("seedQuantityUsed", 0) - v_crop_seed_quantity, 0),
      "exactCost" = greatest(
        coalesce("exactCost", 0) - v_crop_seed_cost - v_crop_substrate_cost,
        0
      ),
      status = case
        when "traysCount" - v_crop_usage.trays <= 0 then 'HARVESTED'
        else status
      end,
      "harvestDate" = case
        when "traysCount" - v_crop_usage.trays <= 0 then p_harvest_date
        else "harvestDate"
      end
    where id = v_crop_usage.crop_id;
  end loop;

  if (
    select count(distinct selected_variety)
    from unnest(v_selected_varieties) selected_variety
  ) < v_minimum_varieties then
    raise exception 'Debes seleccionar al menos % variedades distintas para este producto', v_minimum_varieties;
  end if;

  for v_packaging in
    select
      item->>'articleId' as article_id,
      (item->>'quantity')::numeric as quantity
    from jsonb_array_elements(coalesce(p_packaging_breakdown, '[]'::jsonb)) item
  loop
    if v_packaging.quantity <= 0 then continue; end if;

    if not exists (
      select 1
      from public.articles a
      where a.id = v_packaging.article_id
        and a.type = 'ENVASE'
        and a.active is not false
        and exists (
          select 1
          from jsonb_array_elements_text(v_allowed_packaging) allowed_id
          where allowed_id = a.id
        )
    ) then
      raise exception 'El envase seleccionado no está permitido para este producto';
    end if;

    select coalesce(sum(quantity), 0)
    into v_packaging_stock
    from public.stock_entries
    where "articleId" = v_packaging.article_id;

    if v_packaging_stock < v_packaging.quantity then
      raise exception 'Stock insuficiente del envase seleccionado. Disponible: %', v_packaging_stock;
    end if;

    v_total_tuppers := v_total_tuppers + v_packaging.quantity;
    select
      v_packaging_cost
      + v_packaging.quantity * coalesce("currentUnitCost", "lastPurchaseUnitCost", 0)
    into v_packaging_cost
    from public.articles
    where id = v_packaging.article_id;
  end loop;

  if v_total_tuppers <= 0 then
    raise exception 'Debes indicar al menos un envase producido';
  end if;

  select coalesce(jsonb_agg(key), '[]'::jsonb)
  into v_selected_crop_ids
  from jsonb_each(coalesce(p_selected_crop_usages, '{}'::jsonb))
  where value::text::numeric > 0;

  v_total_cost := v_seed_cost + v_substrate_cost + v_packaging_cost;

  insert into public.harvests (
    id, "batchNumber", "productId", "tuppersCount", "costPerTupper",
    "harvestDate", "selectedCropIds", "selectedCropUsages", "packagingBreakdown",
    "seedCost", "substrateCost", "packagingCost", "totalCost"
  ) values (
    v_harvest_id, btrim(p_batch_number), p_product_id, v_total_tuppers,
    v_total_cost / v_total_tuppers, p_harvest_date, v_selected_crop_ids,
    p_selected_crop_usages, p_packaging_breakdown,
    v_seed_cost, v_substrate_cost, v_packaging_cost, v_total_cost
  );

  for v_packaging in
    select
      item->>'articleId' as article_id,
      (item->>'quantity')::numeric as quantity
    from jsonb_array_elements(p_packaging_breakdown) item
  loop
    if v_packaging.quantity > 0 then
      insert into public.product_movements (
        id, "productId", quantity, type, "referenceId", "createdAt", "packagingArticleId"
      ) values (
        gen_random_uuid()::text, p_product_id, v_packaging.quantity, 'HARVEST',
        btrim(p_batch_number), p_harvest_date, v_packaging.article_id
      );

      insert into public.stock_entries (
        id, "articleId", "purchaseDate", "deliveryNote", "batchNumber",
        quantity, price, "unitCost", "createdAt"
      )
      select
        gen_random_uuid()::text, v_packaging.article_id, p_harvest_date::date,
        'Consumo envases cosecha ' || btrim(p_batch_number), btrim(p_batch_number),
        -v_packaging.quantity, 0,
        coalesce(a."currentUnitCost", a."lastPurchaseUnitCost", 0), p_harvest_date
      from public.articles a
      where a.id = v_packaging.article_id;
    end if;
  end loop;

  return jsonb_build_object(
    'harvestId', v_harvest_id,
    'batchNumber', btrim(p_batch_number),
    'tuppersCount', v_total_tuppers,
    'costPerTupper', v_total_cost / v_total_tuppers,
    'totalCost', v_total_cost
  );
end;
$function$;
