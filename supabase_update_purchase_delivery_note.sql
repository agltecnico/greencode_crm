create or replace function public.update_purchase_delivery_note(
    p_note_id text,
    p_number text,
    p_date date,
    p_lines jsonb
)
returns jsonb
language plpgsql
set search_path to 'public'
as $function$
declare
    v_line jsonb;
    v_line_id text;
    v_article_id text;
    v_lot_id text;
    v_quantity numeric;
    v_total_cost numeric;
    v_unit_cost numeric;
    v_batch text;
    v_initial_quantity numeric;
    v_remaining_quantity numeric;
    v_consumed_quantity numeric;
    v_total numeric := 0;
    v_existing_line_count integer;
    v_affected_articles text[] := array[]::text[];
begin
    if p_note_id is null or p_number is null or btrim(p_number) = '' then
        raise exception 'El albarán y su número son obligatorios';
    end if;

    perform 1
    from public.purchase_delivery_notes
    where id = p_note_id
    for update;
    if not found then
        raise exception 'Albarán de entrada no encontrado';
    end if;

    select count(*) into v_existing_line_count
    from public.purchase_delivery_note_lines
    where "deliveryNoteId" = p_note_id;

    if jsonb_array_length(coalesce(p_lines, '[]'::jsonb)) <> v_existing_line_count then
        raise exception 'La edición debe conservar todas las líneas del albarán';
    end if;

    for v_line in select value from jsonb_array_elements(p_lines)
    loop
        v_line_id := v_line->>'id';
        v_quantity := (v_line->>'quantity')::numeric;
        v_total_cost := (v_line->>'totalCost')::numeric;
        v_batch := btrim(coalesce(v_line->>'supplierBatch', ''));

        select
            line."articleId",
            lot.id,
            lot."initialQuantity",
            lot."remainingQuantity"
        into
            v_article_id,
            v_lot_id,
            v_initial_quantity,
            v_remaining_quantity
        from public.purchase_delivery_note_lines line
        join public.stock_lots lot on lot."deliveryNoteLineId" = line.id
        where line.id = v_line_id
          and line."deliveryNoteId" = p_note_id
        for update of line, lot;

        if not found then
            raise exception 'Línea o lote de stock no encontrado';
        end if;
        if v_quantity <= 0 or v_total_cost < 0 or v_batch = '' then
            raise exception 'Cada línea necesita cantidad positiva, precio válido y lote';
        end if;

        v_consumed_quantity := v_initial_quantity - v_remaining_quantity;
        if v_quantity < v_consumed_quantity then
            raise exception 'La nueva cantidad no puede ser inferior a la cantidad ya consumida (%)', v_consumed_quantity;
        end if;

        v_unit_cost := v_total_cost / v_quantity;
        v_total := v_total + v_total_cost;
        v_affected_articles := array_append(v_affected_articles, v_article_id);

        update public.purchase_delivery_note_lines
        set "supplierBatch" = v_batch,
            quantity = v_quantity,
            "totalCost" = v_total_cost,
            "unitCost" = v_unit_cost
        where id = v_line_id;

        update public.stock_lots
        set "supplierBatch" = v_batch,
            "receivedAt" = p_date,
            "initialQuantity" = v_quantity,
            "remainingQuantity" = v_quantity - v_consumed_quantity,
            "unitCost" = v_unit_cost
        where id = v_lot_id;

        update public.stock_entries
        set "purchaseDate" = p_date,
            "deliveryNote" = btrim(p_number),
            "batchNumber" = v_batch,
            quantity = v_quantity,
            price = v_total_cost,
            "unitCost" = v_unit_cost,
            "remainingQuantity" = v_quantity - v_consumed_quantity
        where "stockLotId" = v_lot_id;
    end loop;

    update public.purchase_delivery_notes
    set number = btrim(p_number),
        date = p_date,
        "totalCost" = v_total
    where id = p_note_id;

    update public.articles article
    set "currentUnitCost" = coalesce((
            select sum(lot."remainingQuantity" * lot."unitCost")
                   / nullif(sum(lot."remainingQuantity"), 0)
            from public.stock_lots lot
            where lot."articleId" = article.id
              and lot."remainingQuantity" > 0
        ), 0),
        "lastPurchaseUnitCost" = coalesce((
            select lot."unitCost"
            from public.stock_lots lot
            where lot."articleId" = article.id
            order by lot."receivedAt" desc, lot."createdAt" desc
            limit 1
        ), 0)
    where article.id = any(v_affected_articles);

    return jsonb_build_object('id', p_note_id, 'totalCost', v_total);
end;
$function$;
