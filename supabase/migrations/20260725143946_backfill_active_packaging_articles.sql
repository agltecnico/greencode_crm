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
