-- Permite consumos provisionales por encima de las existencias del lote.
-- La cantidad inicial y el coste unitario siguen protegidos; solo el saldo
-- restante puede ser negativo hasta registrar la siguiente entrada.
alter table public.stock_lots
  drop constraint if exists "stock_lots_remainingQuantity_check";
