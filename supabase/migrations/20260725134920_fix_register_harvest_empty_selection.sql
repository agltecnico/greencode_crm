do $migration$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.register_harvest(text,text,timestamp with time zone,jsonb,jsonb)'::regprocedure
  )
  into v_definition;

  execute replace(
    v_definition,
    'if jsonb_object_length(coalesce(p_selected_crop_usages, ''{}''::jsonb)) = 0 then',
    'if coalesce(p_selected_crop_usages, ''{}''::jsonb) = ''{}''::jsonb then'
  );
end;
$migration$;
