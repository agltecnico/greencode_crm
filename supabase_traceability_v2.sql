-- GreenCode operational traceability v2.
-- Additive migration: sales tables are intentionally untouched.

CREATE TABLE IF NOT EXISTS public.purchase_delivery_notes (
    id TEXT PRIMARY KEY,
    "providerId" TEXT NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
    number TEXT NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    "totalCost" NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK ("totalCost" >= 0),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("providerId", number)
);

CREATE TABLE IF NOT EXISTS public.purchase_delivery_note_lines (
    id TEXT PRIMARY KEY,
    "deliveryNoteId" TEXT NOT NULL REFERENCES public.purchase_delivery_notes(id) ON DELETE CASCADE,
    "articleId" TEXT NOT NULL REFERENCES public.articles(id) ON DELETE RESTRICT,
    "supplierBatch" TEXT NOT NULL,
    quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
    "totalCost" NUMERIC(12,2) NOT NULL CHECK ("totalCost" >= 0),
    "unitCost" NUMERIC(14,6) NOT NULL CHECK ("unitCost" >= 0),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_lots (
    id TEXT PRIMARY KEY,
    "articleId" TEXT NOT NULL REFERENCES public.articles(id) ON DELETE RESTRICT,
    "providerId" TEXT NOT NULL REFERENCES public.providers(id) ON DELETE RESTRICT,
    "deliveryNoteLineId" TEXT REFERENCES public.purchase_delivery_note_lines(id) ON DELETE RESTRICT,
    "supplierBatch" TEXT NOT NULL,
    "receivedAt" DATE NOT NULL,
    "initialQuantity" NUMERIC(14,3) NOT NULL CHECK ("initialQuantity" > 0),
    "remainingQuantity" NUMERIC(14,3) NOT NULL CHECK ("remainingQuantity" >= 0),
    "unitCost" NUMERIC(14,6) NOT NULL CHECK ("unitCost" >= 0),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS "providerId" TEXT REFERENCES public.providers(id) ON DELETE RESTRICT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS "supplierReference" TEXT;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS "lastPurchaseUnitCost" NUMERIC(14,6) NOT NULL DEFAULT 0;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS "currentUnitCost" NUMERIC(14,6) NOT NULL DEFAULT 0;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.stock_entries ADD COLUMN IF NOT EXISTS "stockLotId" TEXT REFERENCES public.stock_lots(id) ON DELETE RESTRICT;
ALTER TABLE public.stock_entries ADD COLUMN IF NOT EXISTS "purchaseDeliveryNoteId" TEXT REFERENCES public.purchase_delivery_notes(id) ON DELETE RESTRICT;
ALTER TABLE public.stock_entries ADD COLUMN IF NOT EXISTS "unitCost" NUMERIC(14,6) NOT NULL DEFAULT 0;

ALTER TABLE public.crops ADD COLUMN IF NOT EXISTS "cultivationBatchNumber" TEXT;
ALTER TABLE public.crops ADD COLUMN IF NOT EXISTS "seedStockLotId" TEXT REFERENCES public.stock_lots(id) ON DELETE RESTRICT;
ALTER TABLE public.crops ADD COLUMN IF NOT EXISTS "seedQuantityUsed" NUMERIC(14,3);
ALTER TABLE public.crops ADD COLUMN IF NOT EXISTS "seedSupplierBatch" TEXT;
ALTER TABLE public.crops ADD COLUMN IF NOT EXISTS "seedProviderId" TEXT REFERENCES public.providers(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS purchase_delivery_notes_provider_idx ON public.purchase_delivery_notes ("providerId");
CREATE INDEX IF NOT EXISTS purchase_delivery_note_lines_note_idx ON public.purchase_delivery_note_lines ("deliveryNoteId");
CREATE INDEX IF NOT EXISTS purchase_delivery_note_lines_article_idx ON public.purchase_delivery_note_lines ("articleId");
CREATE INDEX IF NOT EXISTS stock_lots_article_fifo_idx ON public.stock_lots ("articleId", "receivedAt", "createdAt") WHERE "remainingQuantity" > 0;
CREATE INDEX IF NOT EXISTS stock_lots_provider_idx ON public.stock_lots ("providerId");
CREATE INDEX IF NOT EXISTS stock_entries_stock_lot_idx ON public.stock_entries ("stockLotId");
CREATE INDEX IF NOT EXISTS stock_entries_purchase_note_idx ON public.stock_entries ("purchaseDeliveryNoteId");
CREATE INDEX IF NOT EXISTS articles_provider_idx ON public.articles ("providerId");
CREATE INDEX IF NOT EXISTS crops_seed_stock_lot_idx ON public.crops ("seedStockLotId");

CREATE UNIQUE INDEX IF NOT EXISTS articles_provider_type_name_idx
    ON public.articles ("providerId", type, LOWER(name))
    WHERE "providerId" IS NOT NULL AND active;

ALTER TABLE public.purchase_delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_delivery_note_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_lots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read purchase_delivery_notes" ON public.purchase_delivery_notes;
CREATE POLICY "public read purchase_delivery_notes" ON public.purchase_delivery_notes FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "public write purchase_delivery_notes" ON public.purchase_delivery_notes;
CREATE POLICY "public write purchase_delivery_notes" ON public.purchase_delivery_notes FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "public read purchase_delivery_note_lines" ON public.purchase_delivery_note_lines;
CREATE POLICY "public read purchase_delivery_note_lines" ON public.purchase_delivery_note_lines FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "public write purchase_delivery_note_lines" ON public.purchase_delivery_note_lines;
CREATE POLICY "public write purchase_delivery_note_lines" ON public.purchase_delivery_note_lines FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "public read stock_lots" ON public.stock_lots;
CREATE POLICY "public read stock_lots" ON public.stock_lots FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "public write stock_lots" ON public.stock_lots;
CREATE POLICY "public write stock_lots" ON public.stock_lots FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_delivery_notes TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_delivery_note_lines TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_lots TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.receive_purchase_delivery_note(
    p_provider_id TEXT,
    p_number TEXT,
    p_date DATE,
    p_notes TEXT,
    p_lines JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_note_id TEXT := gen_random_uuid()::TEXT;
    v_line JSONB;
    v_line_id TEXT;
    v_lot_id TEXT;
    v_article_id TEXT;
    v_quantity NUMERIC;
    v_total_cost NUMERIC;
    v_unit_cost NUMERIC;
    v_batch TEXT;
    v_total NUMERIC := 0;
    v_article_provider TEXT;
BEGIN
    IF p_provider_id IS NULL OR p_number IS NULL OR BTRIM(p_number) = '' OR jsonb_array_length(COALESCE(p_lines, '[]'::JSONB)) = 0 THEN
        RAISE EXCEPTION 'Proveedor, número y líneas son obligatorios';
    END IF;

    INSERT INTO public.purchase_delivery_notes (id, "providerId", number, date, notes)
    VALUES (v_note_id, p_provider_id, BTRIM(p_number), p_date, NULLIF(BTRIM(p_notes), ''));

    FOR v_line IN SELECT value FROM jsonb_array_elements(p_lines)
    LOOP
        v_line_id := gen_random_uuid()::TEXT;
        v_lot_id := gen_random_uuid()::TEXT;
        v_article_id := v_line->>'articleId';
        v_quantity := (v_line->>'quantity')::NUMERIC;
        v_total_cost := (v_line->>'totalCost')::NUMERIC;
        v_batch := BTRIM(COALESCE(v_line->>'supplierBatch', ''));

        IF v_quantity <= 0 OR v_total_cost < 0 OR v_batch = '' THEN
            RAISE EXCEPTION 'Cada línea necesita cantidad positiva, coste válido y lote';
        END IF;

        SELECT "providerId" INTO v_article_provider FROM public.articles WHERE id = v_article_id AND active FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Referencia de compra no encontrada'; END IF;
        IF v_article_provider IS DISTINCT FROM p_provider_id THEN
            RAISE EXCEPTION 'La referencia no pertenece al proveedor del albarán';
        END IF;

        v_unit_cost := v_total_cost / v_quantity;
        v_total := v_total + v_total_cost;

        INSERT INTO public.purchase_delivery_note_lines
            (id, "deliveryNoteId", "articleId", "supplierBatch", quantity, "totalCost", "unitCost")
        VALUES
            (v_line_id, v_note_id, v_article_id, v_batch, v_quantity, v_total_cost, v_unit_cost);

        INSERT INTO public.stock_lots
            (id, "articleId", "providerId", "deliveryNoteLineId", "supplierBatch", "receivedAt", "initialQuantity", "remainingQuantity", "unitCost")
        VALUES
            (v_lot_id, v_article_id, p_provider_id, v_line_id, v_batch, p_date, v_quantity, v_quantity, v_unit_cost);

        INSERT INTO public.stock_entries
            (id, "articleId", "providerId", "purchaseDate", "deliveryNote", "batchNumber", quantity, price, "unitCost", "stockLotId", "purchaseDeliveryNoteId")
        VALUES
            (gen_random_uuid()::TEXT, v_article_id, p_provider_id, p_date, BTRIM(p_number), v_batch, v_quantity, v_total_cost, v_unit_cost, v_lot_id, v_note_id);

        UPDATE public.articles a
        SET "lastPurchaseUnitCost" = v_unit_cost,
            "currentUnitCost" = (
                SELECT COALESCE(SUM(sl."remainingQuantity" * sl."unitCost") / NULLIF(SUM(sl."remainingQuantity"), 0), v_unit_cost)
                FROM public.stock_lots sl
                WHERE sl."articleId" = a.id AND sl."remainingQuantity" > 0
            )
        WHERE a.id = v_article_id;
    END LOOP;

    UPDATE public.purchase_delivery_notes SET "totalCost" = v_total WHERE id = v_note_id;
    RETURN jsonb_build_object('id', v_note_id, 'totalCost', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_purchase_delivery_note(TEXT, TEXT, DATE, TEXT, JSONB) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_unused_purchase_delivery_note(p_note_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.stock_lots sl
        JOIN public.purchase_delivery_note_lines line ON line.id = sl."deliveryNoteLineId"
        WHERE line."deliveryNoteId" = p_note_id
          AND sl."remainingQuantity" IS DISTINCT FROM sl."initialQuantity"
    ) THEN
        RAISE EXCEPTION 'No se puede borrar un albarán con lotes ya utilizados';
    END IF;

    DELETE FROM public.stock_entries WHERE "purchaseDeliveryNoteId" = p_note_id;
    DELETE FROM public.stock_lots
    WHERE "deliveryNoteLineId" IN (
        SELECT id FROM public.purchase_delivery_note_lines WHERE "deliveryNoteId" = p_note_id
    );
    DELETE FROM public.purchase_delivery_notes WHERE id = p_note_id;
    RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_unused_purchase_delivery_note(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.sow_crop_from_lot(
    p_crop_type_id TEXT,
    p_trays NUMERIC,
    p_stock_lot_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_type public.crop_types%ROWTYPE;
    v_lot public.stock_lots%ROWTYPE;
    v_required NUMERIC;
    v_crop_id TEXT := gen_random_uuid()::TEXT;
    v_cultivation_batch TEXT := 'CULT-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD((FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT % 1000000)::TEXT, 6, '0');
BEGIN
    IF p_trays <= 0 THEN RAISE EXCEPTION 'El número de bandejas debe ser positivo'; END IF;

    SELECT * INTO v_type FROM public.crop_types WHERE id = p_crop_type_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ficha de cultivo no encontrada'; END IF;

    SELECT * INTO v_lot FROM public.stock_lots WHERE id = p_stock_lot_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lote de semilla no encontrado'; END IF;
    IF v_lot."articleId" IS DISTINCT FROM v_type."seedId" THEN RAISE EXCEPTION 'El lote no corresponde a la semilla de la ficha'; END IF;

    v_required := COALESCE(v_type."seedGrams", 0) * p_trays;
    IF v_required <= 0 THEN RAISE EXCEPTION 'La ficha no tiene gramos por bandeja válidos'; END IF;
    IF v_lot."remainingQuantity" < v_required THEN RAISE EXCEPTION 'Stock insuficiente en el lote seleccionado'; END IF;

    UPDATE public.stock_lots SET "remainingQuantity" = "remainingQuantity" - v_required WHERE id = v_lot.id;

    INSERT INTO public.crops
        (id, "cropTypeId", "traysCount", "gramsPerTray", "substrateCostPerTray", status, "datePlanted", "batchNumber",
         "cultivationBatchNumber", "seedStockLotId", "seedQuantityUsed", "seedSupplierBatch", "seedProviderId")
    VALUES
        (v_crop_id, v_type.id, p_trays, v_type."seedGrams", 0,
         CASE WHEN COALESCE(v_type."soakingHours", 0) > 0 THEN 'SOAKING' ELSE 'GERMINATING' END,
         NOW(), v_lot."supplierBatch", v_cultivation_batch, v_lot.id, v_required, v_lot."supplierBatch", v_lot."providerId");

    INSERT INTO public.stock_entries
        (id, "articleId", "providerId", "purchaseDate", "deliveryNote", "batchNumber", quantity, price, "unitCost", "stockLotId")
    VALUES
        (gen_random_uuid()::TEXT, v_type."seedId", v_lot."providerId", CURRENT_DATE,
         'Consumo siembra ' || v_cultivation_batch, v_lot."supplierBatch", -v_required, 0, v_lot."unitCost", v_lot.id);

    RETURN jsonb_build_object('cropId', v_crop_id, 'cultivationBatchNumber', v_cultivation_batch, 'quantityUsed', v_required);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sow_crop_from_lot(TEXT, NUMERIC, TEXT) TO anon, authenticated;

DO $$
DECLARE
    v_table TEXT;
BEGIN
    FOREACH v_table IN ARRAY ARRAY['purchase_delivery_notes', 'purchase_delivery_note_lines', 'stock_lots']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = v_table
        ) THEN
            EXECUTE FORMAT('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', v_table);
        END IF;
    END LOOP;
END;
$$;
