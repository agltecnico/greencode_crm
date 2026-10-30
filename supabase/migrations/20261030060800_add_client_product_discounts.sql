alter table public.clients
  add column if not exists "productDiscounts" jsonb not null default '{}'::jsonb;

alter table public.clients
  drop constraint if exists clients_product_discounts_object_check;

alter table public.clients
  add constraint clients_product_discounts_object_check
  check (
    jsonb_typeof("productDiscounts") = 'object'
    and not jsonb_path_exists(
      "productDiscounts",
      '$.* ? (@.type() != "number" || @ < 0 || @ > 100)'
    )
  );

comment on column public.clients."productDiscounts" is
  'Descuentos porcentuales por producto. Las claves son IDs de producto; si no existe una clave se usa defaultDiscount.';
