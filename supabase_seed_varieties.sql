begin;

create table if not exists public.seed_varieties (
  id text primary key,
  name text not null,
  description text,
  active boolean not null default true,
  "createdAt" timestamptz not null default now()
);

create unique index if not exists seed_varieties_name_unique
  on public.seed_varieties (lower(name));

alter table public.seed_varieties enable row level security;

drop policy if exists "seed_varieties_select" on public.seed_varieties;
drop policy if exists "seed_varieties_write" on public.seed_varieties;
create policy "seed_varieties_select" on public.seed_varieties
  for select to anon, authenticated using (true);
create policy "seed_varieties_write" on public.seed_varieties
  for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.seed_varieties to anon, authenticated, service_role;

alter table public.articles
  add column if not exists "varietyId" text references public.seed_varieties(id);
alter table public.crop_types
  add column if not exists "varietyId" text references public.seed_varieties(id);
alter table public.products
  add column if not exists "recipeVarieties" jsonb not null default '[]'::jsonb;

create index if not exists articles_variety_id_idx on public.articles ("varietyId");
create index if not exists crop_types_variety_id_idx on public.crop_types ("varietyId");

insert into public.seed_varieties (id, name, description)
values ('variety-rabano-rambo', 'RÁBANO RAMBO', 'Variedad agronómica conservada en la puesta en marcha')
on conflict (id) do update set name = excluded.name;

update public.articles
set "varietyId" = 'variety-rabano-rambo'
where id = '1784356637510';

update public.crop_types
set "varietyId" = 'variety-rabano-rambo'
where id = '1784356731561';

update public.products
set "recipeVarieties" = jsonb_build_array(jsonb_build_object('varietyId', 'variety-rabano-rambo'))
where coalesce("recipeSeeds", '[]'::jsonb) @> '[{"seedId":"1784356637510"}]'::jsonb
  and coalesce(jsonb_array_length("recipeVarieties"), 0) = 0;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'seed_varieties'
  ) then
    alter publication supabase_realtime add table public.seed_varieties;
  end if;
end $$;

commit;
