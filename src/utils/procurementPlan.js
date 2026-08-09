const MANAGED_TYPES = new Set(['SEMILLA', 'SUSTRATO', 'ENVASE', 'ETIQUETA', 'OTRO']);
const FORECAST_WEEKS = 8;

const actionFor = article => {
  if (article.type === 'ETIQUETA') return 'PRINT';
  if (article.providerId) return 'ORDER';
  return 'BUY';
};

export const procurementActionLabel = action => ({
  PRINT: 'Imprimir',
  ORDER: 'Pedir',
  BUY: 'Comprar'
}[action] || 'Reponer');

export function buildProcurementPlan({ articles = [], stockLots = [], products = [], orders = [], providers = [] }) {
  const stocks = new Map();
  stockLots.forEach(lot => {
    stocks.set(String(lot.articleId), (stocks.get(String(lot.articleId)) || 0) + Number(lot.remainingQuantity || 0));
  });

  const productsById = new Map(products.map(product => [String(product.id), product]));
  const labelForecasts = new Map();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FORECAST_WEEKS * 7);

  orders.filter(order => String(order.status || '').toUpperCase() === 'DELIVERED').forEach(order => {
    const orderDate = new Date(order.date || order.createdAt || 0);
    if (Number.isNaN(orderDate.getTime()) || orderDate < cutoff) return;
    (order.items || []).forEach(item => {
      const product = productsById.get(String(item.productId));
      if (!product?.labelArticleId) return;
      const labels = Number(item.quantity || 0) * Math.max(1, Number(product.labelsPerUnit || 1));
      const key = String(product.labelArticleId);
      labelForecasts.set(key, (labelForecasts.get(key) || 0) + labels);
    });
  });

  const providersById = new Map(providers.map(provider => [String(provider.id), provider]));
  return articles
    .filter(article => article.active !== false && MANAGED_TYPES.has(article.type))
    .map(article => {
      const stock = Math.max(0, stocks.get(String(article.id)) || 0);
      const minimum = Math.max(0, Number(article.minStock || 0));
      const forecast = article.type === 'ETIQUETA'
        ? Math.ceil((labelForecasts.get(String(article.id)) || 0) / FORECAST_WEEKS)
        : 0;
      const target = Math.max(minimum, forecast);
      const required = Math.max(0, Math.ceil(target - stock));
      const urgency = stock < minimum ? 'URGENT' : required > 0 ? 'RECOMMENDED' : 'CONTROLLED';
      return {
        id: article.id,
        name: article.name,
        type: article.type,
        unit: article.unit || (article.type === 'SEMILLA' ? 'g' : article.type === 'SUSTRATO' ? 'l' : 'ud'),
        stock,
        minimum,
        forecast,
        target,
        required,
        urgency,
        action: actionFor(article),
        providerName: providersById.get(String(article.providerId))?.name || 'Sin proveedor',
        unitCost: Number(article.currentUnitCost || article.lastPurchaseUnitCost || 0),
        reason: stock < minimum
          ? `Por debajo del mínimo (${minimum})`
          : forecast > minimum
            ? `Previsión semanal: ${forecast}`
            : 'Stock cubierto'
      };
    })
    .sort((a, b) => {
      const priority = { URGENT: 0, RECOMMENDED: 1, CONTROLLED: 2 };
      return priority[a.urgency] - priority[b.urgency] || b.required - a.required || a.name.localeCompare(b.name, 'es');
    });
}

export const procurementCounts = plan => plan.reduce((counts, item) => {
  if (item.required <= 0) return counts;
  counts.total += 1;
  counts[item.action] += 1;
  if (item.urgency === 'URGENT') counts.urgent += 1;
  else counts.recommended += 1;
  return counts;
}, { total: 0, PRINT: 0, ORDER: 0, BUY: 0, urgent: 0, recommended: 0 });
