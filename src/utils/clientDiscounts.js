export function getClientProductDiscount(client, productId) {
  const defaultDiscount = Number(client?.defaultDiscount || 0);
  const productDiscount = client?.productDiscounts?.[productId];

  if (productDiscount === undefined || productDiscount === null || productDiscount === '') {
    return defaultDiscount;
  }

  const parsedDiscount = Number(productDiscount);
  return Number.isFinite(parsedDiscount) ? parsedDiscount : defaultDiscount;
}

export function sanitizeProductDiscounts(productDiscounts = {}) {
  return Object.fromEntries(
    Object.entries(productDiscounts)
      .filter(([, discount]) => discount !== undefined && discount !== null && discount !== '')
      .map(([productId, discount]) => [productId, Math.min(100, Math.max(0, Number(discount) || 0))])
  );
}
