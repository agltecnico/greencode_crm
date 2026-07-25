alter table public.products
  add column if not exists "packagingArticleIds" jsonb not null default '[]'::jsonb;

alter table public.product_movements
  add column if not exists "packagingArticleId" text references public.articles(id);

create index if not exists product_movements_packaging_article_idx
  on public.product_movements ("packagingArticleId");

update public.products
set "packagingArticleIds" = (
  select coalesce(jsonb_agg(a.id order by a.name), '[]'::jsonb)
  from public.articles a
  where a.type = 'ENVASE'
    and a.active is not false
)
where lower(coalesce(name, '')) not like '%acedera%'
  and lower(coalesce(name, '')) not like '%capuchina%';

update public.products
set "packagingArticleIds" = '[]'::jsonb
where lower(coalesce(name, '')) like '%acedera%'
   or lower(coalesce(name, '')) like '%capuchina%';

create or replace function public.register_harvest(
  p_product_id text,
  p_batch_number text,
  p_harvest_date timestamptz,
  p_selected_crop_usages jsonb,
  p_packaging_breakdown jsonb
)
returns jsonb
language plpgsql
set search_path to 'public'
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

    select c.id, c.status, c."traysCount", ct."varietyId"
    into v_crop
    from public.crops c
    left join public.crop_types ct on ct.id = c."cropTypeId"
    where c.id = v_crop_usage.crop_id
    for update of c;

    if not found or v_crop.status <> 'READY' then
      raise exception 'El cultivo % no está listo para cosechar', v_crop_usage.crop_id;
    end if;
    if v_crop_usage.trays > v_crop."traysCount" then
      raise exception 'No hay suficientes bandejas disponibles en el cultivo %', v_crop_usage.crop_id;
    end if;
    if v_crop."varietyId" is null or not exists (
      select 1 from jsonb_array_elements(v_product_recipe) recipe
      where recipe->>'varietyId' = v_crop."varietyId"
    ) then
      raise exception 'El cultivo % no pertenece a la receta del producto', v_crop_usage.crop_id;
    end if;

    v_selected_varieties := array_append(v_selected_varieties, v_crop."varietyId");
    update public.crops
    set "traysCount" = "traysCount" - v_crop_usage.trays,
        status = case when "traysCount" - v_crop_usage.trays <= 0 then 'HARVESTED' else status end,
        "harvestDate" = case when "traysCount" - v_crop_usage.trays <= 0 then p_harvest_date else "harvestDate" end
    where id = v_crop_usage.crop_id;
  end loop;

  if (
    select count(distinct selected_variety)
    from unnest(v_selected_varieties) selected_variety
  ) < v_minimum_varieties then
    raise exception 'Debes seleccionar al menos % variedades distintas para este producto', v_minimum_varieties;
  end if;

  for v_packaging in
    select item->>'articleId' as article_id, (item->>'quantity')::numeric as quantity
    from jsonb_array_elements(coalesce(p_packaging_breakdown, '[]'::jsonb)) item
  loop
    if v_packaging.quantity <= 0 then continue; end if;
    if not exists (
      select 1 from public.articles a
      where a.id = v_packaging.article_id
        and a.type = 'ENVASE'
        and a.active is not false
        and exists (
          select 1 from jsonb_array_elements_text(v_allowed_packaging) allowed_id
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
  end loop;

  if v_total_tuppers <= 0 then raise exception 'Debes indicar al menos un envase producido'; end if;

  select coalesce(jsonb_agg(key), '[]'::jsonb)
  into v_selected_crop_ids
  from jsonb_each(coalesce(p_selected_crop_usages, '{}'::jsonb))
  where value::text::numeric > 0;

  insert into public.harvests (
    id, "batchNumber", "productId", "tuppersCount", "costPerTupper",
    "harvestDate", "selectedCropIds", "selectedCropUsages", "packagingBreakdown"
  ) values (
    v_harvest_id, btrim(p_batch_number), p_product_id, v_total_tuppers, 0,
    p_harvest_date, v_selected_crop_ids, p_selected_crop_usages, p_packaging_breakdown
  );

  for v_packaging in
    select item->>'articleId' as article_id, (item->>'quantity')::numeric as quantity
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
      ) values (
        gen_random_uuid()::text, v_packaging.article_id, p_harvest_date::date,
        'Consumo envases cosecha ' || btrim(p_batch_number), btrim(p_batch_number),
        -v_packaging.quantity, 0, 0, p_harvest_date
      );
    end if;
  end loop;

  return jsonb_build_object(
    'harvestId', v_harvest_id,
    'batchNumber', btrim(p_batch_number),
    'tuppersCount', v_total_tuppers
  );
end;
$function$;

grant execute on function public.register_harvest(text, text, timestamptz, jsonb, jsonb)
to anon, authenticated;
