-- Idempotent consistency and synchronization patch applied to GreenCode CRM.
-- This file assumes the complete operational schema already exists.

ALTER TABLE public.company_profile
    ADD COLUMN IF NOT EXISTS "fiscalName" TEXT,
    ADD COLUMN IF NOT EXISTS "ownerName" TEXT,
    ADD COLUMN IF NOT EXISTS "bankAccount" TEXT;

ALTER TABLE public.harvests
    ADD COLUMN IF NOT EXISTS "selectedCropIds" JSONB NOT NULL DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS "selectedCropUsages" JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS delivery_notes_one_per_order_idx
    ON public.delivery_notes ("orderId")
    WHERE "orderId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_movements_order_batch_idx
    ON public.product_movements ("productId", "referenceId")
    WHERE type = 'ORDER' AND "productId" IS NOT NULL AND "referenceId" IS NOT NULL;

ALTER TABLE public.product_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public all product_movements" ON public.product_movements;
CREATE POLICY "public all product_movements"
    ON public.product_movements
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE INDEX IF NOT EXISTS crop_types_container_id_idx ON public.crop_types ("containerId");
CREATE INDEX IF NOT EXISTS crop_types_provider_id_idx ON public.crop_types ("providerId");
CREATE INDEX IF NOT EXISTS crop_types_seed_id_idx ON public.crop_types ("seedId");
CREATE INDEX IF NOT EXISTS crop_types_substrate_id_idx ON public.crop_types ("substrateId");
CREATE INDEX IF NOT EXISTS crops_crop_type_id_idx ON public.crops ("cropTypeId");
CREATE INDEX IF NOT EXISTS crops_seed_inventory_id_idx ON public.crops ("seedInventoryId");
CREATE INDEX IF NOT EXISTS harvest_targets_product_id_idx ON public.harvest_targets ("productId");
CREATE INDEX IF NOT EXISTS seed_inventory_seed_id_idx ON public.seed_inventory ("seedId");
CREATE INDEX IF NOT EXISTS seeds_provider_id_idx ON public.seeds ("providerId");
CREATE INDEX IF NOT EXISTS stock_entries_article_id_idx ON public.stock_entries ("articleId");
CREATE INDEX IF NOT EXISTS stock_entries_provider_id_idx ON public.stock_entries ("providerId");

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'clients', 'products', 'orders', 'delivery_notes', 'invoices', 'expenses',
        'company_profile', 'providers', 'articles', 'stock_entries', 'crop_types',
        'crops', 'harvest_targets', 'harvests', 'daily_logs', 'product_movements'
    ]
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = table_name
        ) THEN
            EXECUTE format(
                'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
                table_name
            );
        END IF;
    END LOOP;
END $$;
