-- El inventario negativo de envases es una alerta operativa, no un bloqueo:
-- puede existir consumo físico antes de registrar el albarán de entrada.
do $migration$
declare
  v_definition text;
  v_stock_guard text := E'    select coalesce(sum(quantity), 0)\n    into v_packaging_stock\n    from public.stock_entries\n    where "articleId" = v_packaging.article_id;\n\n    if v_packaging_stock < v_packaging.quantity then\n      raise exception ''Stock insuficiente del envase seleccionado. Disponible: %'', v_packaging_stock;\n    end if;\n\n';
begin
  select pg_get_functiondef(p.oid)
  into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'register_harvest';

  if v_definition is null then
    raise exception 'No se encontró public.register_harvest';
  end if;

  if strpos(v_definition, v_stock_guard) = 0 then
    raise exception 'No se encontró el bloqueo de stock esperado; no se modificó la función';
  end if;

  execute replace(v_definition, v_stock_guard, '');
end
$migration$;
