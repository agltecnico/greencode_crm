-- One-time operational reset requested before GreenCode goes live.
-- Sales records (clients, products, orders, delivery_notes and invoices) are not modified.

CREATE SCHEMA IF NOT EXISTS greencode_backup_20260725;

CREATE TABLE IF NOT EXISTS greencode_backup_20260725.providers AS TABLE public.providers;
CREATE TABLE IF NOT EXISTS greencode_backup_20260725.articles AS TABLE public.articles;
CREATE TABLE IF NOT EXISTS greencode_backup_20260725.stock_entries AS TABLE public.stock_entries;
CREATE TABLE IF NOT EXISTS greencode_backup_20260725.crop_types AS TABLE public.crop_types;
CREATE TABLE IF NOT EXISTS greencode_backup_20260725.crops AS TABLE public.crops;
CREATE TABLE IF NOT EXISTS greencode_backup_20260725.harvest_targets AS TABLE public.harvest_targets;
CREATE TABLE IF NOT EXISTS greencode_backup_20260725.harvests AS TABLE public.harvests;
CREATE TABLE IF NOT EXISTS greencode_backup_20260725.daily_logs AS TABLE public.daily_logs;
CREATE TABLE IF NOT EXISTS greencode_backup_20260725.product_movements AS TABLE public.product_movements;

DO $$
DECLARE
    v_note_id TEXT := gen_random_uuid()::TEXT;
    v_line_id TEXT := gen_random_uuid()::TEXT;
    v_lot_id TEXT := gen_random_uuid()::TEXT;
    v_provider_id CONSTANT TEXT := '1784920787404';
    v_seed_id CONSTANT TEXT := '1784356637510';
    v_crop_type_id CONSTANT TEXT := '1784356731561';
    v_crop_id CONSTANT TEXT := '1784921145557';
    v_entry_id CONSTANT TEXT := '1784921081673';
    v_consumption_id CONSTANT TEXT := '1784921145798';
    v_initial_qty CONSTANT NUMERIC := 1850;
    v_used_qty CONSTANT NUMERIC := 280;
    v_total_cost CONSTANT NUMERIC := 53.65;
    v_unit_cost NUMERIC := v_total_cost / v_initial_qty;
BEGIN
    -- Remove test activity while retaining the confirmed live Rábano Rambo sowing.
    DELETE FROM public.product_movements;
    DELETE FROM public.harvests;
    DELETE FROM public.harvest_targets;
    DELETE FROM public.daily_logs;
    DELETE FROM public.crops WHERE id <> v_crop_id;
    DELETE FROM public.stock_entries WHERE id NOT IN (v_entry_id, v_consumption_id);
    DELETE FROM public.crop_types WHERE id <> v_crop_type_id;

    -- Keep the seed, substrate and tray required by the retained crop type.
    DELETE FROM public.articles
    WHERE id <> v_seed_id
      AND id IS DISTINCT FROM (SELECT "substrateId" FROM public.crop_types WHERE id = v_crop_type_id)
      AND id IS DISTINCT FROM (SELECT "containerId" FROM public.crop_types WHERE id = v_crop_type_id);

    -- Keep providers still referenced by retained master data.
    DELETE FROM public.providers p
    WHERE p.id <> v_provider_id
      AND NOT EXISTS (SELECT 1 FROM public.articles a WHERE a."providerId" = p.id);

    UPDATE public.articles
    SET "providerId" = v_provider_id,
        unit = 'g',
        "lastPurchaseUnitCost" = v_unit_cost,
        "currentUnitCost" = v_unit_cost,
        active = TRUE
    WHERE id = v_seed_id;

    INSERT INTO public.purchase_delivery_notes (id, "providerId", number, date, notes, "totalCost")
    VALUES (v_note_id, v_provider_id, 'INICIAL-MG-00483', DATE '2026-07-24',
            'Entrada inicial reconstruida para conservar la siembra válida de Rábano Rambo.', v_total_cost);

    INSERT INTO public.purchase_delivery_note_lines
        (id, "deliveryNoteId", "articleId", "supplierBatch", quantity, "totalCost", "unitCost")
    VALUES
        (v_line_id, v_note_id, v_seed_id, 'MG-00483', v_initial_qty, v_total_cost, v_unit_cost);

    INSERT INTO public.stock_lots
        (id, "articleId", "providerId", "deliveryNoteLineId", "supplierBatch", "receivedAt",
         "initialQuantity", "remainingQuantity", "unitCost")
    VALUES
        (v_lot_id, v_seed_id, v_provider_id, v_line_id, 'MG-00483', DATE '2026-07-24',
         v_initial_qty, v_initial_qty - v_used_qty, v_unit_cost);

    UPDATE public.stock_entries
    SET "providerId" = v_provider_id,
        "purchaseDeliveryNoteId" = v_note_id,
        "stockLotId" = v_lot_id,
        "unitCost" = v_unit_cost,
        "deliveryNote" = 'INICIAL-MG-00483'
    WHERE id = v_entry_id;

    UPDATE public.stock_entries
    SET "providerId" = v_provider_id,
        "stockLotId" = v_lot_id,
        "unitCost" = v_unit_cost
    WHERE id = v_consumption_id;

    UPDATE public.crops
    SET "cultivationBatchNumber" = 'CULT-2026-RAMBO-001',
        "seedStockLotId" = v_lot_id,
        "seedQuantityUsed" = v_used_qty,
        "seedSupplierBatch" = 'MG-00483',
        "seedProviderId" = v_provider_id,
        "batchNumber" = 'MG-00483'
    WHERE id = v_crop_id;
END;
$$;
