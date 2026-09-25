do $$
declare t text;
begin
  foreach t in array array['providers','crops','daily_logs','harvests','articles','stock_entries','crop_types','seed_inventory','seeds']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', 'authenticated_all_' || t, t);
    execute format('create policy %I on public.%I for all to authenticated using (true) with check (true)', 'authenticated_all_' || t, t);
  end loop;
end $$;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;
