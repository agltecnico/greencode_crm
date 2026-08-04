-- Las etiquetas son consumibles inventariables. Se compran por unidades mediante
-- albaranes de entrada y se consumen automáticamente al registrar/corregir cosechas.

alter table public.products
  add column if not exists "labelArticleId" text references public.articles(id),
  add column if not exists "labelsPerUnit" numeric not null default 1;

alter table public.products
  drop constraint if exists products_labels_per_unit_positive;

alter table public.products
  add constraint products_labels_per_unit_positive
  check ("labelsPerUnit" > 0);

alter table public.harvests
  add column if not exists "labelArticleId" text references public.articles(id),
  add column if not exists "labelsPerUnit" numeric not null default 0,
  add column if not exists "labelsCount" numeric not null default 0,
  add column if not exists "labelUnitCost" numeric not null default 0,
  add column if not exists "labelCost" numeric not null default 0;

create index if not exists products_label_article_idx
  on public.products ("labelArticleId");

create index if not exists harvests_label_article_idx
  on public.harvests ("labelArticleId");

create or replace function public.prepare_harvest_label_cost()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_label public.articles%rowtype;
begin
  if tg_op = 'INSERT' then
    select p."labelArticleId", coalesce(p."labelsPerUnit", 1)
    into new."labelArticleId", new."labelsPerUnit"
    from public.products p
    where p.id = new."productId";

    if new."labelArticleId" is not null then
      select * into v_label
      from public.articles
      where id = new."labelArticleId";

      if not found or v_label.type <> 'ETIQUETA' or v_label.active is false then
        raise exception 'La etiqueta configurada para el producto no es válida o está inactiva';
      end if;

      new."labelUnitCost" := coalesce(v_label."currentUnitCost", v_label."lastPurchaseUnitCost", 0);
    else
      raise exception 'El producto no tiene una etiqueta de inventario configurada';
    end if;
  else
    -- Una corrección de envasado conserva el artículo y el precio histórico.
    new."labelArticleId" := old."labelArticleId";
    new."labelsPerUnit" := old."labelsPerUnit";
    new."labelUnitCost" := old."labelUnitCost";
  end if;

  new."labelsCount" := case
    when new."labelArticleId" is null then 0
    else greatest(coalesce(new."tuppersCount", 0), 0) * greatest(coalesce(new."labelsPerUnit", 0), 0)
  end;
  new."labelCost" := new."labelsCount" * greatest(coalesce(new."labelUnitCost", 0), 0);
  new."totalCost" :=
    greatest(coalesce(new."seedCost", 0), 0)
    + greatest(coalesce(new."substrateCost", 0), 0)
    + greatest(coalesce(new."packagingCost", 0), 0)
    + new."labelCost";
  new."costPerTupper" := case
    when coalesce(new."tuppersCount", 0) > 0 then new."totalCost" / new."tuppersCount"
    else 0
  end;

  return new;
end;
$function$;

drop trigger if exists harvest_label_cost_before_write on public.harvests;
create trigger harvest_label_cost_before_write
before insert or update of "tuppersCount", "packagingCost" on public.harvests
for each row execute function public.prepare_harvest_label_cost();

create or replace function public.record_harvest_label_stock()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_delta numeric;
  v_reference text;
begin
  v_reference := 'Consumo etiquetas cosecha ' || coalesce(new."batchNumber", new.id);

  if tg_op = 'INSERT' then
    if new."labelArticleId" is not null and new."labelsCount" > 0 then
      insert into public.stock_entries (
        id, "articleId", "purchaseDate", "deliveryNote", "batchNumber",
        quantity, price, "unitCost", "createdAt"
      ) values (
        gen_random_uuid()::text, new."labelArticleId", new."harvestDate"::date,
        v_reference, new."batchNumber", -new."labelsCount", 0,
        new."labelUnitCost", new."harvestDate"
      );
    end if;
    return new;
  end if;

  if new."labelArticleId" is distinct from old."labelArticleId" then
    if old."labelArticleId" is not null and old."labelsCount" > 0 then
      insert into public.stock_entries (
        id, "articleId", "purchaseDate", "deliveryNote", "batchNumber",
        quantity, price, "unitCost", "createdAt"
      ) values (
        gen_random_uuid()::text, old."labelArticleId", new."harvestDate"::date,
        'Devolución etiquetas corrección cosecha ' || coalesce(new."batchNumber", new.id),
        new."batchNumber", old."labelsCount", 0, old."labelUnitCost", now()
      );
    end if;
    if new."labelArticleId" is not null and new."labelsCount" > 0 then
      insert into public.stock_entries (
        id, "articleId", "purchaseDate", "deliveryNote", "batchNumber",
        quantity, price, "unitCost", "createdAt"
      ) values (
        gen_random_uuid()::text, new."labelArticleId", new."harvestDate"::date,
        v_reference, new."batchNumber", -new."labelsCount", 0,
        new."labelUnitCost", now()
      );
    end if;
    return new;
  end if;

  v_delta := new."labelsCount" - old."labelsCount";
  if new."labelArticleId" is not null and v_delta <> 0 then
    insert into public.stock_entries (
      id, "articleId", "purchaseDate", "deliveryNote", "batchNumber",
      quantity, price, "unitCost", "createdAt"
    ) values (
      gen_random_uuid()::text, new."labelArticleId", new."harvestDate"::date,
      case when v_delta > 0 then v_reference
        else 'Devolución etiquetas corrección cosecha ' || coalesce(new."batchNumber", new.id)
      end,
      new."batchNumber", -v_delta, 0, new."labelUnitCost", now()
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists harvest_label_stock_after_write on public.harvests;
create trigger harvest_label_stock_after_write
after insert or update of "tuppersCount" on public.harvests
for each row execute function public.record_harvest_label_stock();

-- Los históricos previos quedan expresamente a cero: no se descuenta inventario
-- que todavía no existía en el sistema ni se reescriben márgenes cerrados.

revoke all on function public.prepare_harvest_label_cost() from public;
revoke all on function public.record_harvest_label_stock() from public;
