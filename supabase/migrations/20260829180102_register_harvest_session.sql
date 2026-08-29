create or replace function public.register_harvest_session(
  p_harvest_date timestamp with time zone,
  p_harvests jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
  v_harvest_id text;
  v_product_id text;
  v_free numeric;
  v_pending record;
  v_piece numeric;
  v_allocations jsonb;
  v_link_result jsonb;
begin
  if p_harvest_date is null or p_harvest_date > statement_timestamp() then
    raise exception 'La fecha real de cosecha no es válida';
  end if;
  if jsonb_typeof(coalesce(p_harvests, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_harvests, '[]'::jsonb)) = 0 then
    raise exception 'Añade al menos un producto cosechado';
  end if;

  for v_item in select value from jsonb_array_elements(p_harvests)
  loop
    v_product_id := nullif(v_item->>'productId', '');
    v_result := public.register_harvest(
      v_product_id,
      nullif(v_item->>'batchNumber', ''),
      p_harvest_date,
      coalesce(v_item->'selectedCropUsages', '{}'::jsonb),
      coalesce(v_item->'packagingBreakdown', '[]'::jsonb)
    );
    v_harvest_id := v_result->>'harvestId';

    if btrim(coalesce(v_item->>'registrationNotes', '')) <> '' then
      update public.harvests
      set "registrationNotes" = btrim(v_item->>'registrationNotes')
      where id = v_harvest_id;
    end if;

    v_free := coalesce((v_result->>'tuppersCount')::numeric, 0);
    v_allocations := '[]'::jsonb;
    for v_pending in
      select pm.id, abs(pm.quantity) as quantity
      from public.product_movements pm
      where pm."productId" = v_product_id
        and pm.type = 'ORDER'
        and pm.quantity < 0
        and pm."referenceId" like '%|PENDING-TRACEABILITY'
      order by pm."createdAt", pm.id
      for update
    loop
      exit when v_free <= 0;
      v_piece := least(v_free, v_pending.quantity);
      v_allocations := v_allocations || jsonb_build_array(
        jsonb_build_object('movementId', v_pending.id, 'quantity', v_piece)
      );
      v_free := v_free - v_piece;
    end loop;

    if jsonb_array_length(v_allocations) > 0 then
      v_link_result := public.link_harvest_to_delivered_orders(v_harvest_id, v_allocations);
      v_result := v_result || jsonb_build_object(
        'linkedUnits', coalesce((v_link_result->>'linkedUnits')::numeric, 0)
      );
    else
      v_result := v_result || jsonb_build_object('linkedUnits', 0);
    end if;
    v_results := v_results || jsonb_build_array(v_result);
  end loop;

  return jsonb_build_object('harvests', v_results);
end;
$$;

revoke all on function public.register_harvest_session(timestamp with time zone, jsonb) from public;
revoke all on function public.register_harvest_session(timestamp with time zone, jsonb) from anon;
grant execute on function public.register_harvest_session(timestamp with time zone, jsonb) to authenticated;
