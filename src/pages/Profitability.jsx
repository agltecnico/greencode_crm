import { useCallback, useMemo, useState } from 'react';
import { BarChart3, BrainCircuit, CircleDollarSign, Download, LayoutList, PackageCheck, Percent, ReceiptText, Sprout, TrendingUp, TriangleAlert, Users, WalletCards, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { useData } from '../context/DataContext';

const money = value => new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR'
}).format(Number(value || 0));

const monthBounds = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const localDate = date => {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  };
  return { start: localDate(start), end: localDate(end) };
};

const boundsForMonth = month => {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return {
    start: `${month}-01`,
    end: `${month}-${String(lastDay).padStart(2, '0')}`
  };
};

const StatCard = ({ icon, label, value, detail, tone = 'green' }) => (
  <article className={`profit-stat profit-stat-${tone}`}>
    <div className="profit-stat-icon">{icon}</div>
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  </article>
);

export default function Profitability({
  modal = false,
  onClose,
  initialView = 'products',
  initialStart,
  initialEnd,
  title = 'Centro financiero GreenCode',
  description = 'Producción, ventas, existencias, gastos, beneficio y tesorería conectados por trazabilidad.'
}) {
  const {
    orders, deliveryNotes, clients, products, productMovements, harvests,
    cropTypes, seedVarieties, articles, stockEntries, companyProfile,
    expenses, purchaseDeliveryNotes, providers, crops, stockLots, addExpense,
    invoices, salesForecasts, saveSalesForecasts
  } = useData();
  const [initialBounds] = useState(() => monthBounds());
  const [filterMode, setFilterMode] = useState(initialStart && initialEnd ? 'range' : 'month');
  const [selectedMonth, setSelectedMonth] = useState((initialStart || initialBounds.start).slice(0, 7));
  const [startDate, setStartDate] = useState(initialStart || initialBounds.start);
  const [endDate, setEndDate] = useState(initialEnd || initialBounds.end);
  const [view, setView] = useState(initialView);
  const [displayMode, setDisplayMode] = useState('visual');
  const [query, setQuery] = useState('');
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [intelligenceProductId, setIntelligenceProductId] = useState('__ALL__');
  const [intelligenceClientId, setIntelligenceClientId] = useState('');
  const [forecastSaveState, setForecastSaveState] = useState('');
  const [expenseForm, setExpenseForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: 'SUMINISTROS',
    concept: '',
    total: '',
    ivaPercentage: 21,
    paymentMethod: 'Transferencia',
    isPaid: true
  });
  const selectedBounds = filterMode === 'month'
    ? boundsForMonth(selectedMonth)
    : { start: startDate, end: endDate };
  const section = view === 'summary'
    ? 'summary'
    : view === 'intelligence'
      ? 'intelligence'
    : ['profit-products', 'profit-clients'].includes(view)
      ? 'profitability'
    : ['orders', 'products', 'clients'].includes(view)
      ? 'sales'
      : ['harvests', 'cultivations', 'varietycosts', 'production', 'packaging'].includes(view)
        ? 'production'
      : view === 'expenses'
        ? 'expenses'
        : 'treasury';
  const openSection = nextSection => {
    const defaultViews = { summary: 'summary', sales: 'orders', production: 'harvests', expenses: 'expenses', profitability: 'profit-products', treasury: 'receivables', intelligence: 'intelligence' };
    setView(defaultViews[nextSection]);
    setDisplayMode(['sales', 'profitability'].includes(nextSection) ? 'visual' : 'detail');
    setQuery('');
  };
  const saveExpense = async event => {
    event.preventDefault();
    const total = Number(expenseForm.total || 0);
    if (!expenseForm.concept.trim() || total <= 0) return;
    const ivaPercentage = Number(expenseForm.ivaPercentage || 0);
    await addExpense({
      ...expenseForm,
      total,
      baseAmount: total / (1 + ivaPercentage / 100)
    });
    setExpenseForm(previous => ({ ...previous, concept: '', total: '' }));
    setShowExpenseForm(false);
  };

  const latestArticleUnitCost = useCallback(articleId => {
    if (!articleId) return 0;
    const latestEntry = (stockEntries || [])
      .filter(entry => entry.articleId === articleId && entry.purchaseDeliveryNoteId && Number(entry.quantity) > 0)
      .sort((a, b) => new Date(b.purchaseDate || b.createdAt || 0) - new Date(a.purchaseDate || a.createdAt || 0))[0];
    if (latestEntry) {
      const stored = Number(latestEntry.unitCost);
      if (Number.isFinite(stored) && stored >= 0) return stored;
      return Number(latestEntry.price || 0) / Number(latestEntry.quantity || 1);
    }
    const article = (articles || []).find(item => item.id === articleId);
    return Number(article?.lastPurchaseUnitCost || article?.currentUnitCost || 0);
  }, [articles, stockEntries]);

  const latestVarietySeedCost = varietyId => {
    const seedIds = new Set((articles || []).filter(item => item.type === 'SEMILLA' && item.varietyId === varietyId).map(item => item.id));
    const latestEntry = (stockEntries || [])
      .filter(entry => seedIds.has(entry.articleId) && entry.purchaseDeliveryNoteId && Number(entry.quantity) > 0)
      .sort((a, b) => new Date(b.purchaseDate || b.createdAt || 0) - new Date(a.purchaseDate || a.createdAt || 0))[0];
    if (latestEntry) return Number(latestEntry.unitCost ?? (Number(latestEntry.price || 0) / Number(latestEntry.quantity || 1)));
    return Number((articles || []).find(item => item.type === 'SEMILLA' && item.varietyId === varietyId)?.lastPurchaseUnitCost || 0);
  };

  const report = useMemo(() => {
    const noteByOrder = new Map((deliveryNotes || []).map(note => [note.orderId, note]));
    const harvestByBatch = new Map((harvests || []).map(harvest => [harvest.batchNumber, harvest]));
    const productById = new Map((products || []).map(product => [product.id, product]));
    const clientById = new Map((clients || []).map(client => [client.id, client]));
    const movementsByOrderProduct = new Map();

    (productMovements || [])
      .filter(movement => movement.type === 'ORDER' && movement.referenceId?.includes('|'))
      .forEach(movement => {
        const [orderId, batchNumber] = movement.referenceId.split('|');
        const key = `${orderId}::${movement.productId}`;
        const harvest = harvestByBatch.get(batchNumber);
        const quantity = Math.abs(Number(movement.quantity || 0));
        const unitCost = Number(harvest?.costPerTupper || 0);
        const current = movementsByOrderProduct.get(key) || { quantity: 0, cost: 0, costedQuantity: 0 };
        current.quantity += quantity;
        if (unitCost > 0) {
          current.cost += quantity * unitCost;
          current.costedQuantity += quantity;
        }
        movementsByOrderProduct.set(key, current);
      });

    const productRows = new Map();
    const clientRows = new Map();
    let revenue = 0;
    let cost = 0;
    let units = 0;
    let costedUnits = 0;
    const orderRows = [];

    (orders || [])
      .filter(order => order.status === 'DELIVERED')
      .forEach(order => {
        const note = noteByOrder.get(order.id);
        const saleDate = String(note?.date || order.date || order.createdAt || '').slice(0, 10);
        if (
          (selectedBounds.start && saleDate < selectedBounds.start)
          || (selectedBounds.end && saleDate > selectedBounds.end)
        ) return;

        const groupedItems = new Map();
        (order.items || []).forEach(item => {
          if (!item.productId || Number(item.quantity || 0) <= 0) return;
          const current = groupedItems.get(item.productId) || { quantity: 0, revenue: 0, name: item.name };
          const itemRevenue = Number(item.price || 0)
            * Number(item.quantity || 0)
            * (1 - Number(item.discount || 0) / 100);
          current.quantity += Number(item.quantity || 0);
          current.revenue += itemRevenue;
          groupedItems.set(item.productId, current);
        });

        let orderRevenue = 0;
        let orderCost = 0;
        let orderUnits = 0;
        let orderCostedUnits = 0;
        let resolvedClientName = 'Cliente sin identificar';
        groupedItems.forEach((item, productId) => {
          const movement = movementsByOrderProduct.get(`${order.id}::${productId}`)
            || { quantity: 0, cost: 0, costedQuantity: 0 };
          const product = productById.get(productId);
          const client = clientById.get(order.clientId);
          const productName = product?.name || item.name || 'Producto histórico sin ficha';
          const clientName = client?.commercialName || client?.name
            || order.clientCommercialName || order.clientName || 'Cliente sin identificar';
          resolvedClientName = clientName;

          const productRow = productRows.get(productId) || {
            id: productId, name: productName, units: 0, revenue: 0, cost: 0, costedUnits: 0
          };
          productRow.units += item.quantity;
          productRow.revenue += item.revenue;
          productRow.cost += movement.cost;
          productRow.costedUnits += Math.min(item.quantity, movement.costedQuantity);
          productRows.set(productId, productRow);

          const clientKey = order.clientId || clientName;
          const clientRow = clientRows.get(clientKey) || {
            id: clientKey, name: clientName, units: 0, revenue: 0, cost: 0, costedUnits: 0
          };
          clientRow.units += item.quantity;
          clientRow.revenue += item.revenue;
          clientRow.cost += movement.cost;
          clientRow.costedUnits += Math.min(item.quantity, movement.costedQuantity);
          clientRows.set(clientKey, clientRow);

          revenue += item.revenue;
          cost += movement.cost;
          units += item.quantity;
          costedUnits += Math.min(item.quantity, movement.costedQuantity);
          orderRevenue += item.revenue;
          orderCost += movement.cost;
          orderUnits += item.quantity;
          orderCostedUnits += Math.min(item.quantity, movement.costedQuantity);
        });
        orderRows.push({
          id: order.id,
          date: saleDate,
          number: note?.deliveryNoteNumber || note?.albaranNumber || order.orderNumber || order.id,
          name: `${resolvedClientName} ${note?.deliveryNoteNumber || note?.albaranNumber || order.orderNumber || ''}`.trim(),
          clientName: resolvedClientName,
          units: orderUnits,
          revenue: orderRevenue,
          cost: orderCost,
          margin: orderRevenue - orderCost,
          pendingUnits: Math.max(orderUnits - orderCostedUnits, 0)
        });
      });

    const finishRows = rows => [...rows.values()]
      .map(row => {
        const tracedRevenue = row.units > 0 ? row.revenue * (row.costedUnits / row.units) : 0;
        return {
          ...row,
          tracedRevenue,
          pendingUnits: Math.max(row.units - row.costedUnits, 0),
          margin: tracedRevenue - row.cost,
          marginPercent: tracedRevenue > 0 ? ((tracedRevenue - row.cost) / tracedRevenue) * 100 : 0
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    const finishedProducts = finishRows(productRows);
    const finishedClients = finishRows(clientRows);
    const tracedRevenue = finishedProducts.reduce((sum, row) => sum + row.tracedRevenue, 0);
    const tracedMargin = finishedProducts.reduce((sum, row) => sum + row.margin, 0);

    return {
      revenue,
      cost,
      units,
      costedUnits,
      pendingUnits: Math.max(units - costedUnits, 0),
      tracedRevenue,
      margin: tracedMargin,
      marginPercent: tracedRevenue > 0 ? (tracedMargin / tracedRevenue) * 100 : 0,
      coverage: units > 0 ? (costedUnits / units) * 100 : 0,
      orderRows: orderRows.sort((a, b) => b.date.localeCompare(a.date)),
      productRows: finishedProducts,
      clientRows: finishedClients
    };
  }, [clients, deliveryNotes, harvests, orders, productMovements, products, selectedBounds.end, selectedBounds.start]);

  const financialControl = useMemo(() => {
    const inPeriod = date => {
      const value = String(date || '').slice(0, 10);
      return value && value >= selectedBounds.start && value <= selectedBounds.end;
    };
    const productById = new Map((products || []).map(product => [String(product.id), product]));
    const providerById = new Map((providers || []).map(provider => [String(provider.id), provider]));
    const clientById = new Map((clients || []).map(client => [String(client.id), client]));
    const soldByBatch = new Map();
    (productMovements || [])
      .filter(movement => movement.type === 'ORDER' && movement.referenceId?.includes('|'))
      .forEach(movement => {
        const [, batchNumber] = movement.referenceId.split('|');
        soldByBatch.set(String(batchNumber), (soldByBatch.get(String(batchNumber)) || 0) + Math.abs(Number(movement.quantity || 0)));
      });

    const harvestRows = (harvests || [])
      .filter(harvest => inPeriod(harvest.harvestDate || harvest.recordedAt))
      .map(harvest => {
        const units = Number(harvest.tuppersCount || 0);
        const soldUnits = Math.min(soldByBatch.get(String(harvest.batchNumber)) || 0, units);
        const remainingUnits = Math.max(units - soldUnits, 0);
        const total = Number(harvest.totalCost ?? (
          Number(harvest.seedCost || 0)
          + Number(harvest.substrateCost || 0)
          + Number(harvest.packagingCost || 0)
          + Number(harvest.labelCost || 0)
        ));
        const unitCost = Number(harvest.costPerTupper || (units > 0 ? total / units : 0));
        const trays = Object.values(harvest.selectedCropUsages || {}).reduce((sum, value) => sum + Number(value || 0), 0);
        return {
          id: harvest.id,
          date: String(harvest.harvestDate || harvest.recordedAt || '').slice(0, 10),
          name: productById.get(String(harvest.productId))?.name || 'Producto sin ficha',
          batchNumber: harvest.batchNumber || '-',
          trays,
          units,
          soldUnits,
          remainingUnits,
          seedCost: Number(harvest.seedCost || 0),
          substrateCost: Number(harvest.substrateCost || 0),
          packagingCost: Number(harvest.packagingCost || 0),
          labelCost: Number(harvest.labelCost || 0),
          total,
          unitCost,
          unsoldCost: remainingUnits * unitCost
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const generalExpenseRows = (expenses || [])
      .filter(expense => inPeriod(expense.date))
      .map(expense => ({
        id: expense.id,
        date: String(expense.date || '').slice(0, 10),
        name: expense.concept || 'Gasto sin concepto',
        category: expense.category || 'OTROS',
        paymentMethod: expense.paymentMethod || '-',
        isPaid: expense.isPaid === true,
        total: Number(expense.total ?? expense.amount ?? 0)
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const purchaseRows = (purchaseDeliveryNotes || [])
      .filter(note => inPeriod(note.date || note.createdAt))
      .map(note => ({
        id: note.id,
        date: String(note.date || note.createdAt || '').slice(0, 10),
        number: note.number || '-',
        provider: providerById.get(String(note.providerId))?.name || 'Proveedor sin identificar',
        name: `${providerById.get(String(note.providerId))?.name || 'Proveedor sin identificar'} ${note.number || ''}`.trim(),
        total: Number(note.totalCost || 0)
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    const periodNotes = (deliveryNotes || []).filter(note => inPeriod(note.date || note.createdAt));
    const periodInvoices = (invoices || []).filter(invoice => inPeriod(invoice.date || invoice.createdAt));
    const invoicedNoteIds = new Set((invoices || []).flatMap(invoice => invoice.deliveryNoteIds || []).map(String));
    const unbilledNotes = periodNotes.filter(note => !invoicedNoteIds.has(String(note.id)));
    const collected = periodInvoices.filter(invoice => invoice.isPaid === true).reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const pendingCollection = periodInvoices.filter(invoice => invoice.isPaid !== true).reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const unbilledSales = unbilledNotes.reduce((sum, note) => sum + Number(note.total || 0), 0);
    const billingClientMap = new Map();
    const ensureBillingClient = (clientId, fallbackName) => {
      const client = clientById.get(String(clientId));
      const name = client?.commercialName || client?.name || fallbackName || 'Cliente sin identificar';
      const key = clientId || name;
      if (!billingClientMap.has(key)) billingClientMap.set(key, { id: key, name, invoiced: 0, paid: 0, pending: 0, unbilled: 0, documents: 0 });
      return billingClientMap.get(key);
    };
    periodInvoices.forEach(invoice => {
      const row = ensureBillingClient(invoice.clientId);
      const total = Number(invoice.total || 0);
      row.invoiced += total; row.documents += 1;
      if (invoice.isPaid === true) row.paid += total;
      else row.pending += total;
    });
    unbilledNotes.forEach(note => {
      const row = ensureBillingClient(note.clientId, note.clientCommercialName || note.clientName);
      row.unbilled += Number(note.total || 0);
    });
    const generalExpensesTotal = generalExpenseRows.reduce((sum, row) => sum + row.total, 0);
    const paidGeneralExpenses = generalExpenseRows.filter(row => row.isPaid).reduce((sum, row) => sum + row.total, 0);
    const pendingGeneralExpenses = generalExpensesTotal - paidGeneralExpenses;
    const productionCost = harvestRows.reduce((sum, row) => sum + row.total, 0);
    const producedUnits = harvestRows.reduce((sum, row) => sum + row.units, 0);
    const unsoldUnits = harvestRows.reduce((sum, row) => sum + row.remainingUnits, 0);
    const unsoldCost = harvestRows.reduce((sum, row) => sum + row.unsoldCost, 0);
    const purchases = purchaseRows.reduce((sum, row) => sum + row.total, 0);
    const stockValueRows = (articles || []).map(article => {
      const lots = (stockLots || []).filter(lot => String(lot.articleId) === String(article.id) && Number(lot.remainingQuantity || 0) > 0);
      const quantity = lots.reduce((sum, lot) => sum + Number(lot.remainingQuantity || 0), 0);
      const total = lots.reduce((sum, lot) => sum + Number(lot.remainingQuantity || 0) * Number(lot.unitCost || 0), 0);
      const unitCost = quantity > 0 ? total / quantity : latestArticleUnitCost(article.id);
      return { id: article.id, name: article.name, type: article.type, quantity, unitCost, total };
    }).filter(row => row.quantity > 0).sort((a, b) => b.total - a.total);
    const materialStockValue = stockValueRows.reduce((sum, row) => sum + row.total, 0);
    const operatingProfit = report.tracedRevenue - report.cost - generalExpensesTotal;
    const cashOut = purchases + paidGeneralExpenses;

    return {
      harvestRows,
      generalExpenseRows,
      purchaseRows,
      productionCost,
      producedUnits,
      unsoldUnits,
      unsoldCost,
      generalExpensesTotal,
      paidGeneralExpenses,
      pendingGeneralExpenses,
      collected,
      pendingCollection,
      unbilledSales,
      billingClientRows: [...billingClientMap.values()].sort((a, b) => (b.pending + b.unbilled) - (a.pending + a.unbilled)),
      stockValueRows,
      purchases,
      materialStockValue,
      totalStockValue: materialStockValue + unsoldCost,
      totalPeriodCosts: productionCost + generalExpensesTotal,
      operatingProfit,
      cashOut,
      cashBalance: collected - cashOut
    };
  }, [articles, clients, deliveryNotes, expenses, harvests, invoices, latestArticleUnitCost, productMovements, products, providers, purchaseDeliveryNotes, report.cost, report.tracedRevenue, selectedBounds.end, selectedBounds.start, stockLots]);

  const intelligence = useMemo(() => {
    const isAllProducts = intelligenceProductId === '__ALL__';
    const effectiveProductId = isAllProducts ? '' : (intelligenceProductId || report.productRows[0]?.id || products?.[0]?.id || '');
    const product = (products || []).find(item => String(item.id) === String(effectiveProductId));
    const noteByOrder = new Map((deliveryNotes || []).map(note => [String(note.orderId), note]));
    const harvestByBatch = new Map((harvests || []).map(harvest => [String(harvest.batchNumber), harvest]));
    const costByOrderProduct = new Map();
    (productMovements || [])
      .filter(movement => movement.type === 'ORDER' && movement.referenceId?.includes('|'))
      .forEach(movement => {
        const [orderId, batch] = movement.referenceId.split('|');
        const harvest = harvestByBatch.get(String(batch));
        const quantity = Math.abs(Number(movement.quantity || 0));
        const key = `${orderId}::${movement.productId}`;
        const current = costByOrderProduct.get(key) || { cost: 0, units: 0 };
        if (Number(harvest?.costPerTupper || 0) > 0) {
          current.cost += quantity * Number(harvest.costPerTupper);
          current.units += quantity;
        }
        costByOrderProduct.set(key, current);
      });

    const sales = [];
    (orders || []).filter(order => order.status === 'DELIVERED').forEach(order => {
      if (intelligenceClientId && String(order.clientId) !== String(intelligenceClientId)) return;
      const items = (order.items || []).filter(item => isAllProducts || String(item.productId) === String(effectiveProductId));
      if (!items.length) return;
      const date = String(noteByOrder.get(String(order.id))?.date || order.date || order.createdAt || '').slice(0, 10);
      const quantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const revenue = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0) * (1 - Number(item.discount || 0) / 100), 0);
      const client = (clients || []).find(item => String(item.id) === String(order.clientId));
      const costRecord = items.reduce((result, item) => {
        const itemCost = costByOrderProduct.get(`${order.id}::${item.productId}`) || { cost: 0, units: 0 };
        result.cost += itemCost.cost;
        result.units += itemCost.units;
        return result;
      }, { cost: 0, units: 0 });
      sales.push({
        orderId: order.id,
        date,
        clientId: order.clientId,
        clientName: client?.commercialName || client?.name || order.clientCommercialName || order.clientName || 'Cliente sin identificar',
        quantity,
        revenue,
        cost: costRecord.cost,
        costedUnits: costRecord.units
      });
    });

    const dates = sales.map(sale => sale.date).filter(Boolean).sort();
    const anchor = dates.length ? new Date(`${dates[dates.length - 1]}T12:00:00`) : new Date();
    const monday = date => {
      const result = new Date(date);
      const day = result.getDay() || 7;
      result.setDate(result.getDate() - day + 1);
      result.setHours(12, 0, 0, 0);
      return result;
    };
    const localKey = date => {
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 10);
    };
    const anchorMonday = monday(anchor);
    const weeks = Array.from({ length: 12 }, (_, index) => {
      const start = new Date(anchorMonday);
      start.setDate(start.getDate() - (11 - index) * 7);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return {
        key: localKey(start),
        name: new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(start).replace('.', ''),
        start: localKey(start),
        end: localKey(end),
        units: 0,
        revenue: 0,
        orders: 0
      };
    });
    sales.forEach(sale => {
      const bucket = weeks.find(week => sale.date >= week.start && sale.date <= week.end);
      if (bucket) {
        bucket.units += sale.quantity;
        bucket.revenue += sale.revenue;
        bucket.orders += 1;
      }
    });
    const recent = weeks.slice(-8);
    const weightTotal = recent.reduce((sum, _week, index) => sum + index + 1, 0);
    const weightedUnits = recent.reduce((sum, week, index) => sum + week.units * (index + 1), 0) / weightTotal;
    const lastFour = recent.slice(-4).reduce((sum, week) => sum + week.units, 0) / 4;
    const previousFour = recent.slice(0, 4).reduce((sum, week) => sum + week.units, 0) / 4;
    const trend = previousFour > 0 ? (lastFour - previousFour) / previousFour : 0;
    const forecastUnits = Math.max(Math.round(weightedUnits * (1 + Math.max(-0.25, Math.min(trend * 0.35, 0.35)))), 0);
    const totalUnits = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.revenue, 0);
    const totalCost = sales.reduce((sum, sale) => sum + sale.cost, 0);
    const costedUnits = sales.reduce((sum, sale) => sum + sale.costedUnits, 0);
    const averageOrder = sales.length ? totalUnits / sales.length : 0;
    const averagePrice = totalUnits ? totalRevenue / totalUnits : 0;
    const averageUnitCost = costedUnits ? totalCost / costedUnits : 0;
    const profitPerUnit = costedUnits > 0 ? averagePrice - averageUnitCost : 0;
    const relevantHarvests = (harvests || []).filter(harvest => isAllProducts || String(harvest.productId) === String(effectiveProductId));
    const producedUnits = relevantHarvests.reduce((sum, harvest) => sum + Number(harvest.tuppersCount || 0), 0);
    const usedTrays = relevantHarvests.reduce((sum, harvest) => sum + Object.values(harvest.selectedCropUsages || {}).reduce((traySum, value) => traySum + Number(value || 0), 0), 0);
    const unitsPerTray = usedTrays > 0 ? producedUnits / usedTrays : 0;
    const recommendedTrays = unitsPerTray > 0 ? Math.ceil(forecastUnits / unitsPerTray) : 0;
    const weeksWithSales = recent.filter(week => week.units > 0).length;
    const confidence = weeksWithSales >= 7 ? 'Alta' : weeksWithSales >= 4 ? 'Media' : 'Inicial';
    const clientMap = new Map();
    sales.forEach(sale => {
      const key = sale.clientId || sale.clientName;
      const row = clientMap.get(key) || { id: key, name: sale.clientName, units: 0, revenue: 0, cost: 0, orders: 0 };
      row.units += sale.quantity; row.revenue += sale.revenue; row.cost += sale.cost; row.orders += 1;
      clientMap.set(key, row);
    });
    const clientRows = [...clientMap.values()].map(row => ({
      ...row,
      averagePrice: row.units ? row.revenue / row.units : 0,
      profit: row.revenue - row.cost,
      averageOrder: row.orders ? row.units / row.orders : 0
    })).sort((a, b) => b.revenue - a.revenue);

    const forecastMatrix = new Map();
    (orders || []).filter(order => order.status === 'DELIVERED').forEach(order => {
      const date = String(noteByOrder.get(String(order.id))?.date || order.date || order.createdAt || '').slice(0, 10);
      const client = (clients || []).find(item => String(item.id) === String(order.clientId));
      (order.items || []).forEach(item => {
        if (!item.productId || Number(item.quantity || 0) <= 0) return;
        if (!isAllProducts && String(item.productId) !== String(effectiveProductId)) return;
        if (intelligenceClientId && String(order.clientId) !== String(intelligenceClientId)) return;
        const key = `${item.productId}|${order.clientId || 'UNKNOWN'}`;
        const row = forecastMatrix.get(key) || {
          productId: item.productId,
          productName: (products || []).find(productItem => String(productItem.id) === String(item.productId))?.name || item.name || 'Producto',
          clientId: order.clientId || null,
          clientKey: order.clientId || 'UNKNOWN',
          clientName: client?.commercialName || client?.name || order.clientCommercialName || order.clientName || 'Cliente sin identificar',
          weekUnits: new Map(),
          orders: 0,
          totalUnits: 0
        };
        const saleWeek = localKey(monday(new Date(`${date}T12:00:00`)));
        row.weekUnits.set(saleWeek, (row.weekUnits.get(saleWeek) || 0) + Number(item.quantity || 0));
        row.orders += 1;
        row.totalUnits += Number(item.quantity || 0);
        forecastMatrix.set(key, row);
      });
    });
    const forecastRows = [...forecastMatrix.values()].map(row => {
      const recentValues = recent.map(week => Number(row.weekUnits.get(week.key) || 0));
      const weighted = recentValues.reduce((sum, value, index) => sum + value * (index + 1), 0) / weightTotal;
      const productHarvests = (harvests || []).filter(harvest => String(harvest.productId) === String(row.productId));
      const productUnits = productHarvests.reduce((sum, harvest) => sum + Number(harvest.tuppersCount || 0), 0);
      const productTrays = productHarvests.reduce((sum, harvest) => sum + Object.values(harvest.selectedCropUsages || {}).reduce((traySum, value) => traySum + Number(value || 0), 0), 0);
      const productUnitsPerTray = productTrays ? productUnits / productTrays : 0;
      const forecast = Math.max(Math.round(weighted), 0);
      const activeWeeks = recentValues.filter(Boolean).length;
      return {
        ...row,
        forecastUnits: forecast,
        forecastOrders: row.totalUnits > 0 ? Math.max(Math.ceil(forecast / (row.totalUnits / row.orders)), forecast > 0 ? 1 : 0) : 0,
        recommendedTrays: productUnitsPerTray ? Math.ceil(forecast / productUnitsPerTray) : 0,
        confidence: activeWeeks >= 7 ? 'Alta' : activeWeeks >= 4 ? 'Media' : 'Inicial',
        activeWeeks
      };
    }).filter(row => row.forecastUnits > 0).sort((a, b) => b.forecastUnits - a.forecastUnits);

    return {
      isAllProducts,
      effectiveProductId,
      product,
      sales,
      weeks,
      totalUnits,
      totalRevenue,
      totalCost,
      averageOrder,
      averagePrice,
      averageUnitCost,
      profitPerUnit,
      costedUnits,
      forecastUnits,
      forecastOrders: averageOrder > 0 ? Math.ceil(forecastUnits / averageOrder) : 0,
      unitsPerTray,
      recommendedTrays,
      confidence,
      weeksWithSales,
      trend,
      clientRows,
      forecastRows
    };
  }, [clients, deliveryNotes, harvests, intelligenceClientId, intelligenceProductId, orders, productMovements, products, report.productRows]);

  const forecastHistory = useMemo(() => {
    const noteByOrder = new Map((deliveryNotes || []).map(note => [String(note.orderId), note]));
    return (salesForecasts || []).slice(0, 40).map(forecast => {
      const start = new Date(`${forecast.weekStart}T12:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const endKey = end.toISOString().slice(0, 10);
      let actualUnits = 0;
      let actualOrders = 0;
      (orders || []).filter(order => order.status === 'DELIVERED').forEach(order => {
        if (String(order.clientId || 'UNKNOWN') !== String(forecast.clientKey)) return;
        const date = String(noteByOrder.get(String(order.id))?.date || order.date || order.createdAt || '').slice(0, 10);
        if (date < forecast.weekStart || date > endKey) return;
        const units = (order.items || []).filter(item => String(item.productId) === String(forecast.productId)).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
        if (units > 0) { actualUnits += units; actualOrders += 1; }
      });
      const error = Number(forecast.forecastUnits || 0) > 0
        ? Math.abs(actualUnits - Number(forecast.forecastUnits)) / Number(forecast.forecastUnits) * 100
        : 0;
      return { ...forecast, actualUnits, actualOrders, error };
    });
  }, [deliveryNotes, orders, salesForecasts]);

  const saveWeeklyForecast = async () => {
    const today = new Date();
    const day = today.getDay() || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (8 - day));
    const offset = nextMonday.getTimezoneOffset() * 60000;
    const weekStart = new Date(nextMonday.getTime() - offset).toISOString().slice(0, 10);
    const payload = intelligence.forecastRows.map(row => ({
      weekStart,
      productId: String(row.productId),
      clientKey: String(row.clientKey),
      clientId: row.clientId || null,
      forecastUnits: row.forecastUnits,
      forecastOrders: row.forecastOrders,
      recommendedTrays: row.recommendedTrays,
      confidence: row.confidence,
      updatedAt: new Date().toISOString()
    }));
    const saved = await saveSalesForecasts(payload);
    setForecastSaveState(saved ? `Previsión guardada para la semana del ${new Date(`${weekStart}T12:00:00`).toLocaleDateString('es-ES')}` : 'No se pudo guardar la previsión');
  };

  const productionRows = (cropTypes || []).map(cropType => {
    const seedCost = latestVarietySeedCost(cropType.varietyId) * Number(cropType.seedGrams || 0);
    const substrateCost = latestArticleUnitCost(cropType.substrateId) * Number(cropType.substrateLiters || 0);
    const trayCost = latestArticleUnitCost(cropType.containerId);
    const total = seedCost + substrateCost + trayCost;
    const expectedKg = Number(cropType.expectedYieldGrams || 0) / 1000;
    return {
      id: cropType.id,
      name: cropType.name || seedVarieties?.find(item => item.id === cropType.varietyId)?.name || 'Ficha sin nombre',
      seedCost,
      substrateCost,
      trayCost,
      total,
      costPerKg: expectedKg > 0 ? total / expectedKg : 0
    };
  }).sort((a, b) => b.total - a.total);
  const cultivationRows = (crops || [])
    .filter(crop => {
      const date = String(crop.datePlanted || crop.createdAt || '').slice(0, 10);
      return date && date >= selectedBounds.start && date <= selectedBounds.end;
    })
    .map(crop => {
      const cropType = (cropTypes || []).find(item => String(item.id) === String(crop.cropTypeId));
      const harvestedTrays = (harvests || []).reduce((sum, harvest) => (
        sum + Number(harvest.selectedCropUsages?.[crop.id] || 0)
      ), 0);
      const remainingTrays = Number(crop.traysCount || 0);
      const discardedTrays = Number(crop.discardedTrays || 0);
      const totalTrays = Math.max(remainingTrays + harvestedTrays + discardedTrays, remainingTrays, 1);
      const seedLot = (stockLots || []).find(lot => String(lot.id) === String(crop.seedStockLotId));
      const seedUnitCost = Number(seedLot?.unitCost || latestVarietySeedCost(cropType?.varietyId) || 0);
      const seedCost = seedUnitCost * Number(crop.gramsPerTray || cropType?.seedGrams || 0);
      const substrateCost = latestArticleUnitCost(cropType?.substrateId) * Number(cropType?.substrateLiters || 0);
      const trayCost = latestArticleUnitCost(cropType?.containerId);
      const costPerTray = seedCost + substrateCost + trayCost;
      return {
        id: crop.id,
        date: String(crop.datePlanted || crop.createdAt || '').slice(0, 10),
        name: cropType?.name || seedVarieties?.find(item => item.id === cropType?.varietyId)?.name || 'Cultivo sin ficha',
        batchNumber: crop.cultivationBatchNumber || crop.batchNumber || '-',
        status: crop.status || '-',
        totalTrays,
        harvestedTrays,
        remainingTrays,
        discardedTrays,
        seedCost,
        substrateCost,
        trayCost,
        costPerTray,
        total: costPerTray * totalTrays
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
  const currentWeekStart = new Date(`${selectedBounds.start}T00:00:00`);
  const currentWeekEnd = new Date(`${selectedBounds.end}T23:59:59`);
  const activeHarvestCostRows = (crops || []).map(crop => {
    if (['HARVESTED', 'DISCARDED'].includes(String(crop.status || '').toUpperCase()) || Number(crop.traysCount || 0) <= 0) return null;
    const cropType = (cropTypes || []).find(item => String(item.id) === String(crop.cropTypeId || crop.seedId));
    if (!cropType) return null;
    const harvestDate = new Date(crop.datePlanted || crop.plantedAt);
    if (Number.isNaN(harvestDate.getTime())) return null;
    const cycleDays = (Number(cropType.soakingHours || 0) > 0 ? Math.max(1, Math.ceil(Number(cropType.soakingHours) / 24)) : 0)
      + Number(cropType.germinationDays || 0) + Number(cropType.darknessDays || 0) + Number(cropType.lightDays || 0)
      - Number(crop.cycleDayAdjustment || 0);
    harvestDate.setDate(harvestDate.getDate() + cycleDays);
    if (harvestDate < currentWeekStart || harvestDate > currentWeekEnd) return null;
    const seedLot = (stockLots || []).find(lot => String(lot.id) === String(crop.seedStockLotId));
    const seedUnitCost = Number(seedLot?.unitCost || latestVarietySeedCost(cropType.varietyId) || 0);
    const seedCost = seedUnitCost * Number(crop.gramsPerTray || cropType.seedGrams || 0);
    const substrateCost = latestArticleUnitCost(cropType.substrateId) * Number(cropType.substrateLiters || 0);
    const trayCost = latestArticleUnitCost(cropType.containerId);
    const trays = Number(crop.traysCount || 0);
    return {
      id: crop.id,
      name: cropType.name || seedVarieties?.find(item => item.id === cropType.varietyId)?.name || 'Cultivo sin ficha',
      batchNumber: crop.cultivationBatchNumber || crop.batchNumber || '-',
      harvestDate,
      trays,
      status: crop.status,
      seedCost: seedCost * trays,
      substrateCost: substrateCost * trays,
      trayCost: trayCost * trays,
      costPerTray: seedCost + substrateCost + trayCost,
      total: (seedCost + substrateCost + trayCost) * trays
    };
  }).filter(Boolean).sort((a, b) => a.harvestDate - b.harvestDate);
  const activeHarvestCostTotal = activeHarvestCostRows.reduce((sum, row) => sum + row.total, 0);
  const harvestedPackagingTotal = financialControl.harvestRows.reduce((sum, row) => sum + row.packagingCost, 0);
  const harvestedLabelTotal = financialControl.harvestRows.reduce((sum, row) => sum + row.labelCost, 0);
  const varietyCostRows = [...cultivationRows.reduce((map, row) => {
    const current = map.get(row.name) || { id: row.name, name: row.name, crops: 0, trays: 0, harvestedTrays: 0, discardedTrays: 0, total: 0 };
    current.crops += 1;
    current.trays += row.totalTrays;
    current.harvestedTrays += row.harvestedTrays;
    current.discardedTrays += row.discardedTrays;
    current.total += row.total;
    map.set(row.name, current);
    return map;
  }, new Map()).values()].map(row => ({ ...row, costPerTray: row.trays ? row.total / row.trays : 0 })).sort((a, b) => b.total - a.total);
  const packagingRows = (articles || [])
    .filter(article => ['ENVASE', 'BANDEJA'].includes(article.type))
    .map(article => ({
      id: article.id,
      name: article.name,
      unitCost: latestArticleUnitCost(article.id),
      stock: (stockLots || []).filter(lot => lot.articleId === article.id).reduce((sum, lot) => sum + Number(lot.remainingQuantity || 0), 0)
    }))
    .sort((a, b) => b.unitCost - a.unitCost);
  const baseRows = view === 'orders'
    ? report.orderRows
    : ['products', 'profit-products'].includes(view)
      ? report.productRows
    : ['clients', 'profit-clients'].includes(view)
      ? report.clientRows
      : view === 'production'
        ? productionRows
        : view === 'packaging'
          ? packagingRows
          : view === 'cultivations'
            ? cultivationRows
          : view === 'varietycosts'
            ? varietyCostRows
          : view === 'clientcosts'
            ? report.clientRows.map(row => ({ ...row, total: row.cost }))
          : view === 'receivables'
            ? financialControl.billingClientRows.map(row => ({ ...row, total: row.pending + row.unbilled }))
          : view === 'stockvalue'
            ? financialControl.stockValueRows
          : view === 'harvests'
            ? financialControl.harvestRows
            : view === 'expenses'
              ? financialControl.generalExpenseRows
              : financialControl.purchaseRows;
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  const rows = baseRows.filter(row => row.name.toLocaleLowerCase('es').includes(normalizedQuery));
  const chartRows = rows.slice(0, 8).map(row => ({
    name: row.name.length > 22 ? `${row.name.slice(0, 20)}…` : row.name,
    Ventas: Number(Number(row.revenue || 0).toFixed(2)),
    Costes: Number(Number(row.cost || 0).toFixed(2))
  }));
  const distributionRows = report.productRows.slice(0, 6).map(row => ({
    name: row.name,
    value: Number(row.revenue.toFixed(2))
  }));
  const chartColors = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899', '#64748b'];

  const exportPdf = async () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFillColor(16, 42, 34);
    doc.rect(0, 0, 297, 32, 'F');
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(10, 6, 46, 21, 3, 3, 'F');
    try {
      const logo = new Image();
      logo.src = '/logo.png';
      await new Promise((resolve, reject) => {
        logo.onload = resolve;
        logo.onerror = reject;
      });
      doc.addImage(logo, 'PNG', 14, 9, 38, 15, undefined, 'FAST');
    } catch {
      // El informe sigue siendo válido si el navegador no puede cargar el logotipo.
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('INFORME DE RENTABILIDAD', 62, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`${companyProfile?.commercialName || companyProfile?.fiscalName || 'GreenCode'}  |  ${selectedBounds.start} a ${selectedBounds.end}`, 62, 23);
    doc.setTextColor(16, 42, 34);
    doc.setFontSize(9);
    doc.text(`Generado: ${new Date().toLocaleString('es-ES')}  |  Ventas: ${money(report.revenue)}  |  Costes trazados: ${money(report.cost)}  |  Margen trazado: ${money(report.margin)}  |  Cobertura: ${report.coverage.toFixed(1)} %`, 14, 40);

    const configurations = {
      summary: {
        title: 'Resumen económico del periodo',
        head: [['Indicador', 'Importe']],
        body: [
          ['Ventas netas', money(report.revenue)],
          ['Coste de lo vendido', money(report.cost)],
          ['Gastos generales', money(financialControl.generalExpensesTotal)],
          ['Beneficio operativo', money(financialControl.operatingProfit)],
          ['Producción realizada', money(financialControl.productionCost)],
          ['Stock total a coste', money(financialControl.totalStockValue)],
          ['Tesorería estimada', money(financialControl.cashBalance)]
        ]
      },
      intelligence: {
        title: `Previsión semanal - ${intelligence.product?.name || 'Todos los productos'}`,
        head: [['Indicador', 'Resultado']],
        body: [
          ['Unidades vendidas históricas', intelligence.totalUnits],
          ['Previsión próxima semana', `${intelligence.forecastUnits} unidades`],
          ['Pedidos aproximados', intelligence.forecastOrders],
          ['Bandejas recomendadas', intelligence.recommendedTrays || 'Sin rendimiento disponible'],
          ['Tendencia semanal', `${intelligence.trend > 0 ? '+' : ''}${(intelligence.trend * 100).toFixed(0)} %`],
          ['Confianza', intelligence.confidence]
        ]
      },
      products: {
        title: 'Ventas por producto',
        head: [['Producto', 'Uds.', 'Ventas', 'Precio medio', 'Peso']],
        body: rows.map(row => [row.name, row.units, money(row.revenue), money(row.units ? row.revenue / row.units : 0), `${report.revenue ? (row.revenue / report.revenue * 100).toFixed(1) : '0.0'} %`])
      },
      orders: {
        title: 'Ventas entregadas del periodo',
        head: [['Fecha', 'Albarán / pedido', 'Cliente', 'Uds.', 'Venta', 'Coste', 'Margen', 'Sin coste']],
        body: rows.map(row => [row.date, row.number, row.clientName, row.units, money(row.revenue), money(row.cost), money(row.margin), row.pendingUnits])
      },
      clients: {
        title: 'Ventas por cliente',
        head: [['Cliente', 'Uds.', 'Ventas', 'Precio medio', 'Peso']],
        body: rows.map(row => [row.name, row.units, money(row.revenue), money(row.units ? row.revenue / row.units : 0), `${report.revenue ? (row.revenue / report.revenue * 100).toFixed(1) : '0.0'} %`])
      },
      'profit-products': {
        title: 'Rentabilidad completa por producto',
        head: [['Producto', 'Uds.', 'Ventas', 'Venta trazada', 'Coste', 'Margen', '%', 'Sin coste']],
        body: rows.map(row => [row.name, row.units, money(row.revenue), money(row.tracedRevenue), money(row.cost), money(row.margin), `${row.marginPercent.toFixed(1)} %`, row.pendingUnits])
      },
      'profit-clients': {
        title: 'Rentabilidad completa por cliente',
        head: [['Cliente', 'Uds.', 'Ventas', 'Venta trazada', 'Coste', 'Margen', '%', 'Sin coste']],
        body: rows.map(row => [row.name, row.units, money(row.revenue), money(row.tracedRevenue), money(row.cost), money(row.margin), `${row.marginPercent.toFixed(1)} %`, row.pendingUnits])
      },
      production: {
        title: 'Costes de producción por variedad',
        head: [['Variedad / ficha', 'Semilla', 'Sustrato', 'Bandeja', 'Coste/bandeja', 'Coste/kg']],
        body: rows.map(row => [row.name, money(row.seedCost), money(row.substrateCost), money(row.trayCost), money(row.total), money(row.costPerKg)])
      },
      cultivations: {
        title: 'Coste de cada cultivo y bandeja',
        head: [['Fecha', 'Cultivo', 'Lote', 'Bandejas', 'Cosechadas', 'Activas', 'Perdidas', 'Coste/bandeja', 'Coste total']],
        body: rows.map(row => [row.date, row.name, row.batchNumber, row.totalTrays, row.harvestedTrays, row.remainingTrays, row.discardedTrays, money(row.costPerTray), money(row.total)])
      },
      varietycosts: {
        title: 'Costes totales por variedad',
        head: [['Variedad', 'Cultivos', 'Bandejas', 'Cosechadas', 'Perdidas', 'Coste/bandeja', 'Coste total']],
        body: rows.map(row => [row.name, row.crops, row.trays, row.harvestedTrays, row.discardedTrays, money(row.costPerTray), money(row.total)])
      },
      clientcosts: {
        title: 'Costes y beneficio por cliente',
        head: [['Cliente', 'Uds.', 'Ventas', 'Coste', 'Beneficio', 'Sin coste']],
        body: rows.map(row => [row.name, row.units, money(row.revenue), money(row.cost), money(row.margin), row.pendingUnits])
      },
      packaging: {
        title: 'Costes y existencias de formatos de venta',
        head: [['Formato', 'Último coste unitario', 'Stock actual']],
        body: rows.map(row => [row.name, money(row.unitCost), row.stock])
      },
      harvests: {
        title: 'Producción real y existencias terminadas',
        head: [['Fecha', 'Producto', 'Lote', 'Bandejas', 'Producido', 'Vendido', 'Sin vender', 'Coste total', 'Coste/unidad']],
        body: rows.map(row => [row.date, row.name, row.batchNumber, row.trays, row.units, row.soldUnits, row.remainingUnits, money(row.total), money(row.unitCost)])
      },
      expenses: {
        title: 'Gastos generales del periodo',
        head: [['Fecha', 'Categoría', 'Concepto', 'Importe', 'Estado', 'Pago']],
        body: rows.map(row => [row.date, row.category, row.name, money(row.total), row.isPaid ? 'Pagado' : 'Pendiente', row.paymentMethod])
      },
      treasury: {
        title: 'Compras de stock y tesorería',
        head: [['Fecha', 'Proveedor', 'Documento', 'Importe']],
        body: rows.map(row => [row.date, row.provider, row.number, money(row.total)])
      },
      receivables: {
        title: 'Cobros y facturación por cliente',
        head: [['Cliente', 'Facturado', 'Pagado', 'Pendiente', 'Sin facturar', 'Documentos']],
        body: rows.map(row => [row.name, money(row.invoiced), money(row.paid), money(row.pending), money(row.unbilled), row.documents])
      },
      stockvalue: {
        title: 'Valor económico del inventario',
        head: [['Tipo', 'Artículo', 'Stock', 'Coste unitario', 'Valor']],
        body: rows.map(row => [row.type, row.name, row.quantity, money(row.unitCost), money(row.total)])
      }
    };
    const selected = configurations[view];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(selected.title, 14, 50);
    autoTable(doc, {
      startY: 55,
      head: selected.head,
      body: selected.body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.6, textColor: [51, 65, 85] },
      headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 250, 247] },
      didDrawPage: data => {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`GreenCode - Informe financiero`, 14, 202);
        doc.text(`Página ${data.pageNumber}`, 280, 202, { align: 'right' });
      }
    });
    doc.save(`greencode-rentabilidad-${view}-${selectedBounds.start}-${selectedBounds.end}.pdf`);
  };

  const content = (
    <div className={`admin-container profitability-page ${modal ? 'profitability-modal' : ''}`}>
      <header className="profit-header">
        <div>
          <p className="profit-eyebrow">CONTROL ECONÓMICO</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="profit-header-right">
          <div className="profit-filters">
            <div className="profit-filter-mode">
              <button className={filterMode === 'month' ? 'active' : ''} onClick={() => setFilterMode('month')}>Mes</button>
              <button className={filterMode === 'range' ? 'active' : ''} onClick={() => setFilterMode('range')}>Fechas</button>
            </div>
            {filterMode === 'month' ? (
              <label>Periodo<input type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} /></label>
            ) : (
              <>
                <label>Desde<input type="date" value={startDate} max={endDate} onChange={event => setStartDate(event.target.value)} /></label>
                <label>Hasta<input type="date" value={endDate} min={startDate} onChange={event => setEndDate(event.target.value)} /></label>
              </>
            )}
          </div>
          <button className="profit-pdf-button" onClick={exportPdf}><Download size={16} /> Descargar PDF</button>
          {modal && <button className="profit-close-button" onClick={onClose} aria-label="Cerrar análisis"><X size={20} /></button>}
        </div>
      </header>

      <div className="profitability-scroll-body">
      <nav className="profit-section-nav" aria-label="Apartados financieros">
        <button className={section === 'summary' ? 'active' : ''} onClick={() => openSection('summary')}><span>01</span><strong>Resumen</strong><small>Visión general</small></button>
        <button className={section === 'sales' ? 'active' : ''} onClick={() => openSection('sales')}><span>02</span><strong>Ventas</strong><small>Productos y clientes</small></button>
        <button className={section === 'production' ? 'active' : ''} onClick={() => openSection('production')}><span>03</span><strong>Producción</strong><small>Cultivos y cosechas</small></button>
        <button className={section === 'expenses' ? 'active' : ''} onClick={() => openSection('expenses')}><span>04</span><strong>Gastos</strong><small>Generales y operativos</small></button>
        <button className={section === 'profitability' ? 'active' : ''} onClick={() => openSection('profitability')}><span>05</span><strong>Rentabilidad</strong><small>Margen y beneficio</small></button>
        <button className={section === 'treasury' ? 'active' : ''} onClick={() => openSection('treasury')}><span>06</span><strong>Tesorería</strong><small>Cobros y existencias</small></button>
        <button className={section === 'intelligence' ? 'active intelligence' : 'intelligence'} onClick={() => openSection('intelligence')}><BrainCircuit size={16} /><strong>Previsión</strong><small>Demanda semanal</small></button>
      </nav>

      <section className="profit-stats profit-section-stats">
        {section === 'summary' && <>
          <StatCard icon={<CircleDollarSign size={22} />} label="Ventas" value={money(report.revenue)} detail={`${report.units} unidades entregadas`} />
          <StatCard icon={<PackageCheck size={22} />} label="Costes totales" value={money(report.cost + financialControl.generalExpensesTotal)} detail="Coste vendido + gastos generales" tone="blue" />
          <StatCard icon={<BarChart3 size={22} />} label="Beneficio operativo" value={money(financialControl.operatingProfit)} detail="Resultado real del periodo" tone="purple" />
          <StatCard icon={<WalletCards size={22} />} label="Tesorería estimada" value={money(financialControl.cashBalance)} detail={`${money(financialControl.pendingCollection)} por cobrar`} tone="green" />
        </>}
        {section === 'sales' && <>
          <StatCard icon={<CircleDollarSign size={22} />} label="Ventas netas" value={money(report.revenue)} detail={`${report.units} unidades entregadas`} />
          <StatCard icon={<PackageCheck size={22} />} label="Unidades vendidas" value={report.units} detail={`${report.orderRows.length} entregas realizadas`} tone="blue" />
          <StatCard icon={<ReceiptText size={22} />} label="Venta media" value={money(report.orderRows.length ? report.revenue / report.orderRows.length : 0)} detail="Importe medio por entrega" tone="purple" />
          <StatCard icon={<Users size={22} />} label="Clientes con ventas" value={report.clientRows.length} detail="Clientes servidos en el periodo" tone="amber" />
        </>}
        {section === 'production' && <>
          <StatCard icon={<Sprout size={22} />} label="Producción realizada" value={money(financialControl.productionCost)} detail={`${financialControl.producedUnits} unidades producidas`} tone="blue" />
          <StatCard icon={<PackageCheck size={22} />} label="Producto sin vender" value={money(financialControl.unsoldCost)} detail={`${financialControl.unsoldUnits} unidades terminadas`} tone="purple" />
          <StatCard icon={<Sprout size={22} />} label="Cultivos registrados" value={cultivationRows.length} detail="Lotes dentro del periodo" tone="amber" />
          <StatCard icon={<PackageCheck size={22} />} label="Cosechas registradas" value={financialControl.harvestRows.length} detail="Producciones terminadas" tone="green" />
        </>}
        {section === 'expenses' && <>
          <StatCard icon={<ReceiptText size={22} />} label="Gastos generales" value={money(financialControl.generalExpensesTotal)} detail={`${financialControl.generalExpenseRows.length} registros`} tone="amber" />
          <StatCard icon={<CircleDollarSign size={22} />} label="Pagados" value={money(financialControl.paidGeneralExpenses)} detail="Salidas ya realizadas" />
          <StatCard icon={<WalletCards size={22} />} label="Pendientes" value={money(financialControl.pendingGeneralExpenses)} detail="Pagos aún pendientes" tone="purple" />
          <StatCard icon={<Percent size={22} />} label="Peso sobre ventas" value={`${report.revenue ? (financialControl.generalExpensesTotal / report.revenue * 100).toFixed(1) : '0.0'} %`} detail="Gastos generales / ventas" tone="blue" />
        </>}
        {section === 'profitability' && <>
          <StatCard icon={<CircleDollarSign size={22} />} label="Ventas trazadas" value={money(report.tracedRevenue)} detail={`${report.costedUnits} unidades con coste`} />
          <StatCard icon={<PackageCheck size={22} />} label="Coste vendido" value={money(report.cost)} detail="Coste directo trazado" tone="blue" />
          <StatCard icon={<BarChart3 size={22} />} label="Beneficio trazado" value={money(report.margin)} detail="Ventas trazadas − coste directo" tone="purple" />
          <StatCard icon={<Percent size={22} />} label="Margen" value={`${report.marginPercent.toFixed(1)} %`} detail={`${report.coverage.toFixed(1)} % con coste conocido`} tone="amber" />
        </>}
        {section === 'treasury' && <>
          <StatCard icon={<CircleDollarSign size={22} />} label="Facturas cobradas" value={money(financialControl.collected)} detail="Marcadas como pagadas" />
          <StatCard icon={<ReceiptText size={22} />} label="Facturas pendientes" value={money(financialControl.pendingCollection)} detail={`${money(financialControl.unbilledSales)} entregado sin facturar`} tone="amber" />
          <StatCard icon={<WalletCards size={22} />} label="Saldo estimado" value={money(financialControl.cashBalance)} detail={`Salidas registradas ${money(financialControl.cashOut)}`} tone="purple" />
          <StatCard icon={<PackageCheck size={22} />} label="Valor total del stock" value={money(financialControl.totalStockValue)} detail={`Materiales ${money(financialControl.materialStockValue)}`} tone="blue" />
        </>}
        {section === 'intelligence' && <>
          <StatCard icon={<TrendingUp size={22} />} label="Previsión próxima semana" value={`${intelligence.forecastUnits} uds.`} detail={`${intelligence.forecastOrders} pedidos aproximados`} tone="purple" />
          <StatCard icon={<Sprout size={22} />} label="Cultivo recomendado" value={`${intelligence.recommendedTrays || '—'} bandejas`} detail={intelligence.unitsPerTray ? `${intelligence.unitsPerTray.toFixed(1)} uds. históricas/bandeja` : 'Falta rendimiento de cosechas'} tone="blue" />
          <StatCard icon={<BrainCircuit size={22} />} label="Confianza de previsión" value={intelligence.confidence} detail={`${intelligence.weeksWithSales}/8 semanas con ventas`} tone="amber" />
          <StatCard icon={<TrendingUp size={22} />} label="Tendencia semanal" value={`${intelligence.trend > 0 ? '+' : ''}${(intelligence.trend * 100).toFixed(0)} %`} detail="Variación frente a semanas anteriores" />
        </>}
      </section>

      {section === 'profitability' && report.pendingUnits > 0 && (
        <div className="profit-warning">
          <TriangleAlert size={20} />
          <div>
            <strong>{report.pendingUnits} unidades vendidas todavía no tienen coste trazable.</strong>
            <span>El producto, cliente, unidades y precio sí están vinculados. Estas ventas históricas se registraron antes de enlazar cosecha y lote, por eso no se inventa su coste ni se incluyen todavía en el margen.</span>
          </div>
        </div>
      )}

      {section === 'summary' && <section className="profit-control-strip profit-summary-strip">
        <button type="button" onClick={() => { setView('harvests'); setDisplayMode('detail'); }}>
          <span>Producción frente a ventas</span><strong>{money(financialControl.productionCost)} / {money(report.revenue)}</strong><small>{financialControl.unsoldUnits} unidades sin vender</small>
        </button>
        <button type="button" onClick={() => { setView('treasury'); setDisplayMode('detail'); }}>
          <span>Cobrado frente a pendiente</span><strong>{money(financialControl.collected)} / {money(financialControl.pendingCollection)}</strong><small>Situación de cobros</small>
        </button>
        <button type="button" onClick={() => { setView('treasury'); setDisplayMode('detail'); }}>
          <span>Stock materiales + terminado</span><strong>{money(financialControl.totalStockValue)}</strong><small>Valor actual a coste</small>
        </button>
        <button type="button" onClick={() => { setView('expenses'); setDisplayMode('detail'); }}>
          <span>Beneficio antes de generales</span><strong>{money(report.margin)}</strong><small>Beneficio final {money(financialControl.operatingProfit)}</small>
        </button>
      </section>}

      {section === 'intelligence' && <section className="profit-intelligence">
        <header className="profit-intelligence-query">
          <div><span>CONSULTA CONCRETA</span><h2>¿Qué quieres analizar y prever?</h2><p>Selecciona un producto y, si quieres, limita el cálculo a un cliente.</p></div>
          <label>Producto<select value={intelligenceProductId} onChange={event => setIntelligenceProductId(event.target.value)}><option value="__ALL__">Todas las variedades / productos</option>{(products || []).map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label>Cliente<select value={intelligenceClientId} onChange={event => setIntelligenceClientId(event.target.value)}><option value="">Todos los clientes</option>{(clients || []).map(client => <option key={client.id} value={client.id}>{client.commercialName || client.name}</option>)}</select></label>
        </header>
        <div className="profit-intelligence-grid">
          <article className="profit-forecast-chart">
            <div><h3>Ventas semanales de {intelligence.isAllProducts ? 'todos los productos' : intelligence.product?.name || 'producto'}</h3><p>Las ocho semanas más recientes pesan más en la previsión.</p></div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={intelligence.weeks} margin={{ top: 15, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip formatter={(value, name) => [name === 'units' ? `${value} uds.` : money(value), name === 'units' ? 'Unidades' : 'Ventas']} />
                <Bar dataKey="units" name="Unidades" fill="#10b981" radius={[5, 5, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </article>
          <article className="profit-decision-card">
            <span>RECOMENDACIÓN PRÓXIMA SEMANA</span>
            <strong>{intelligence.forecastUnits} unidades</strong>
            <p>Preparar aproximadamente <b>{intelligence.recommendedTrays || '—'} bandejas</b> para atender unos <b>{intelligence.forecastOrders} pedidos</b>.</p>
            <div><span>Tendencia</span><strong>{intelligence.trend > 0 ? '+' : ''}{(intelligence.trend * 100).toFixed(0)} %</strong></div>
            <div><span>Pedido medio</span><strong>{intelligence.averageOrder.toFixed(1)} uds.</strong></div>
            <div><span>Semanas con ventas</span><strong>{intelligence.weeksWithSales} de 8</strong></div>
            <small>Estimación estadística, no compromiso de venta. Mejorará al acumular semanas de datos trazados.</small>
          </article>
        </div>
        <article className="profit-client-profitability">
          <header><div><h3>Previsión detallada por producto y cliente</h3><p>Propuesta concreta de tuppers, pedidos y bandejas para la próxima semana.</p></div><button className="profit-save-forecast" onClick={saveWeeklyForecast}>Guardar previsión semanal</button></header>
          {forecastSaveState && <p className="profit-forecast-saved">{forecastSaveState}</p>}
          <div className="table-container"><table><thead><tr><th>Producto</th><th>Cliente</th><th>Previsión</th><th>Pedidos aprox.</th><th>Bandejas</th><th>Confianza</th></tr></thead><tbody>
            {intelligence.forecastRows.map(row => <tr key={`${row.productId}-${row.clientKey}`}><td><strong>{row.productName}</strong></td><td>{row.clientName}</td><td><strong>{row.forecastUnits} uds.</strong></td><td>{row.forecastOrders}</td><td>{row.recommendedTrays || '—'}</td><td><span className={`forecast-confidence ${row.confidence.toLowerCase()}`}>{row.confidence}</span></td></tr>)}
            {!intelligence.forecastRows.length && <tr><td colSpan="6" className="profit-empty">Faltan ventas históricas para generar una previsión.</td></tr>}
          </tbody></table></div>
        </article>
        {forecastHistory.length > 0 && <article className="profit-client-profitability">
          <header><div><h3>¿Está acertando el sistema?</h3><p>Comparación de previsiones guardadas frente a las ventas reales de cada semana.</p></div><strong>{forecastHistory.length} comprobaciones</strong></header>
          <div className="table-container"><table><thead><tr><th>Semana</th><th>Producto</th><th>Cliente</th><th>Previsto</th><th>Real</th><th>Error</th></tr></thead><tbody>
            {forecastHistory.map(row => <tr key={row.id}><td>{new Date(`${row.weekStart}T12:00:00`).toLocaleDateString('es-ES')}</td><td>{(products || []).find(product => String(product.id) === String(row.productId))?.name || row.productId}</td><td>{(clients || []).find(client => String(client.id) === String(row.clientId))?.commercialName || (clients || []).find(client => String(client.id) === String(row.clientId))?.name || 'Cliente'}</td><td>{row.forecastUnits}</td><td>{row.actualUnits}</td><td>{row.error.toFixed(0)} %</td></tr>)}
          </tbody></table></div>
        </article>}
      </section>}

      {!['summary', 'intelligence'].includes(section) && <section className="premium-card profit-table-card">
        <div className="profit-table-heading">
          <div>
            <h2>{section === 'sales' ? 'Consultas de ventas' : section === 'production' ? 'Control de producción' : section === 'expenses' ? 'Control de gastos' : section === 'profitability' ? 'Análisis de rentabilidad' : 'Consultas de tesorería y existencias'}</h2>
            <p>Elige qué dato quieres consultar. Cada apartado mantiene el mismo periodo seleccionado.</p>
          </div>
          <div className={`profit-subsection-nav ${section}`}>
              {section === 'sales' && <>
                <button className={view === 'orders' ? 'active' : ''} onClick={() => { setView('orders'); setDisplayMode('detail'); }}><strong>Todas las ventas</strong><small>Pedidos entregados y sus importes</small></button>
                <button className={view === 'products' ? 'active' : ''} onClick={() => setView('products')}><strong>Por producto</strong><small>Unidades, facturación y margen</small></button>
                <button className={view === 'clients' ? 'active' : ''} onClick={() => setView('clients')}><strong>Por cliente</strong><small>Consumo, precios y rentabilidad</small></button>
              </>}
              {section === 'production' && <>
                <button className={view === 'harvests' ? 'active' : ''} onClick={() => { setView('harvests'); setDisplayMode('detail'); }}><strong>Producción terminada</strong><small>Cosechado, vendido y sin vender</small></button>
                <button className={view === 'varietycosts' ? 'active' : ''} onClick={() => { setView('varietycosts'); setDisplayMode('detail'); }}><strong>Por variedad</strong><small>Coste total y por bandeja</small></button>
                <button className={view === 'cultivations' ? 'active' : ''} onClick={() => { setView('cultivations'); setDisplayMode('detail'); }}><strong>Cada cultivo</strong><small>Consumo y coste de cada lote</small></button>
                <button className={view === 'production' ? 'active' : ''} onClick={() => { setView('production'); setDisplayMode('detail'); }}><strong>Receta por bandeja</strong><small>Semilla, sustrato y soporte</small></button>
                <button className={view === 'packaging' ? 'active' : ''} onClick={() => { setView('packaging'); setDisplayMode('detail'); }}><strong>Envases y vivo</strong><small>Coste y existencias de formatos</small></button>
              </>}
              {section === 'expenses' && <button className="active"><strong>Gastos registrados</strong><small>Personal, suministros, transporte y otros</small></button>}
              {section === 'profitability' && <>
                <button className={view === 'profit-products' ? 'active' : ''} onClick={() => setView('profit-products')}><strong>Por producto</strong><small>Ventas, coste, beneficio y margen</small></button>
                <button className={view === 'profit-clients' ? 'active' : ''} onClick={() => setView('profit-clients')}><strong>Por cliente</strong><small>Rentabilidad real de cada cliente</small></button>
              </>}
              {section === 'treasury' && <>
                <button className={view === 'receivables' ? 'active' : ''} onClick={() => setView('receivables')}><strong>Cobros por cliente</strong><small>Pagado, pendiente y sin facturar</small></button>
                <button className={view === 'stockvalue' ? 'active' : ''} onClick={() => setView('stockvalue')}><strong>Valor del almacén</strong><small>Existencias actuales valoradas</small></button>
                <button className={view === 'treasury' ? 'active' : ''} onClick={() => setView('treasury')}><strong>Compras de stock</strong><small>Entradas y pagos a proveedores</small></button>
              </>}
          </div>
          <div className="profit-table-tools">
            {(['products', 'clients', 'profit-products', 'profit-clients'].includes(view)) && <div className="profit-tabs">
              <button className={displayMode === 'visual' ? 'active' : ''} onClick={() => setDisplayMode('visual')}><BarChart3 size={15} /> Gráficas</button>
              <button className={displayMode === 'detail' ? 'active' : ''} onClick={() => setDisplayMode('detail')}><LayoutList size={15} /> Detalle</button>
            </div>}
            <input className="profit-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar…" />
            {view === 'expenses' && <button className="profit-add-expense" type="button" onClick={() => setShowExpenseForm(value => !value)}>{showExpenseForm ? 'Cancelar' : '+ Registrar gasto'}</button>}
          </div>
        </div>

        {section === 'production' && (
          <section style={{ margin: '0 1rem 1rem', display: 'grid', gap: '0.8rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.65rem' }}>
              <article style={{ padding: '0.8rem', border: '1px solid #fde68a', borderRadius: '0.8rem', background: '#fffbeb' }}><span style={{ display: 'block', color: '#a16207', fontSize: '0.68rem', fontWeight: 850 }}>EN MARCHA · PERIODO</span><strong style={{ display: 'block', color: '#92400e', fontSize: '1.15rem' }}>{money(activeHarvestCostTotal)}</strong><small style={{ color: '#a16207' }}>{activeHarvestCostRows.length} cultivos con cosecha prevista</small></article>
              <article style={{ padding: '0.8rem', border: '1px solid #bbf7d0', borderRadius: '0.8rem', background: '#f0fdf4' }}><span style={{ display: 'block', color: '#15803d', fontSize: '0.68rem', fontWeight: 850 }}>COSECHADO · PERIODO</span><strong style={{ display: 'block', color: '#166534', fontSize: '1.15rem' }}>{money(financialControl.productionCost)}</strong><small style={{ color: '#15803d' }}>{financialControl.producedUnits} unidades producidas</small></article>
              <article style={{ padding: '0.8rem', border: '1px solid #bae6fd', borderRadius: '0.8rem', background: '#f0f9ff' }}><span style={{ display: 'block', color: '#0369a1', fontSize: '0.68rem', fontWeight: 850 }}>TÁPERES Y ETIQUETAS</span><strong style={{ display: 'block', color: '#075985', fontSize: '1.15rem' }}>{money(harvestedPackagingTotal + harvestedLabelTotal)}</strong><small style={{ color: '#0369a1' }}>Táperes {money(harvestedPackagingTotal)} · Etiquetas {money(harvestedLabelTotal)}</small></article>
              <article style={{ padding: '0.8rem', border: '1px solid #ddd6fe', borderRadius: '0.8rem', background: '#f5f3ff' }}><span style={{ display: 'block', color: '#6d28d9', fontSize: '0.68rem', fontWeight: 850 }}>CONTROL DE PRODUCCIÓN</span><strong style={{ display: 'block', color: '#5b21b6', fontSize: '1.15rem' }}>{money(activeHarvestCostTotal + financialControl.productionCost)}</strong><small style={{ color: '#6d28d9' }}>En marcha + cosechado y envasado</small></article>
            </div>
            {activeHarvestCostRows.length > 0 && (
              <div className="table-container" style={{ border: '1px solid #fde68a', borderRadius: '0.8rem', background: 'white' }}>
                <table><thead><tr><th>Fecha prevista</th><th>Cultivo / lote</th><th>Fase</th><th>Bandejas</th><th>Semilla</th><th>Sustrato</th><th>Bandeja</th><th>Coste/bandeja</th><th>Total en marcha</th></tr></thead>
                  <tbody>{activeHarvestCostRows.map(row => <tr key={row.id}><td>{row.harvestDate.toLocaleDateString('es-ES')}</td><td><strong>{row.name}</strong><small className="profit-cell-note">{row.batchNumber}</small></td><td>{row.status}</td><td>{row.trays}</td><td>{money(row.seedCost)}</td><td>{money(row.substrateCost)}</td><td>{money(row.trayCost)}</td><td>{money(row.costPerTray)}</td><td><strong>{money(row.total)}</strong></td></tr>)}</tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {view === 'expenses' && showExpenseForm && (
          <form className="profit-expense-form" onSubmit={saveExpense}>
            <label>Fecha<input type="date" required value={expenseForm.date} onChange={event => setExpenseForm({ ...expenseForm, date: event.target.value })} /></label>
            <label>Categoría<select value={expenseForm.category} onChange={event => setExpenseForm({ ...expenseForm, category: event.target.value })}>
              <option value="NOMINAS">Personal y nóminas</option><option value="SUMINISTROS">Luz, agua y suministros</option>
              <option value="TRANSPORTE">Gasoil y desplazamientos</option><option value="MANTENIMIENTO">Mantenimiento</option>
              <option value="ALQUILER">Alquiler</option><option value="MARKETING">Marketing y software</option><option value="OTROS">Otros</option>
            </select></label>
            <label className="profit-expense-concept">Concepto<input required value={expenseForm.concept} onChange={event => setExpenseForm({ ...expenseForm, concept: event.target.value })} placeholder="Ej. Factura de electricidad julio" /></label>
            <label>Total (€)<input type="number" min="0.01" step="0.01" required value={expenseForm.total} onChange={event => setExpenseForm({ ...expenseForm, total: event.target.value })} /></label>
            <label>IVA (%)<input type="number" min="0" step="1" value={expenseForm.ivaPercentage} onChange={event => setExpenseForm({ ...expenseForm, ivaPercentage: event.target.value })} /></label>
            <label>Forma de pago<select value={expenseForm.paymentMethod} onChange={event => setExpenseForm({ ...expenseForm, paymentMethod: event.target.value })}><option>Transferencia</option><option>Tarjeta</option><option>Efectivo</option><option>Domiciliación</option></select></label>
            <label className="profit-expense-paid"><input type="checkbox" checked={expenseForm.isPaid} onChange={event => setExpenseForm({ ...expenseForm, isPaid: event.target.checked })} /> Pagado</label>
            <button type="submit">Guardar gasto</button>
          </form>
        )}

        {displayMode === 'visual' && ['products', 'clients', 'profit-products', 'profit-clients'].includes(view) ? (
          <div className="profit-charts">
            <article className="profit-chart-main">
              <div><h3>{section === 'profitability' ? 'Ventas frente a costes' : 'Volumen de ventas'}</h3><p>Principales {view.includes('product') ? 'productos' : 'clientes'} del periodo</p></div>
              <div className="profit-chart-canvas">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartRows} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={value => `${value} €`} />
                    <Tooltip formatter={value => money(value)} contentStyle={{ border: 0, borderRadius: 12, boxShadow: '0 12px 35px rgba(15,23,42,.12)' }} />
                    <Bar dataKey="Ventas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={34} />
                    {section === 'profitability' && <Bar dataKey="Costes" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={34} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
            <article className="profit-chart-side">
              <div><h3>Distribución de ventas</h3><p>Peso de los productos principales</p></div>
              <div className="profit-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distributionRows} dataKey="value" nameKey="name" innerRadius={58} outerRadius={88} paddingAngle={3}>
                      {distributionRows.map((row, index) => <Cell key={row.name} fill={chartColors[index % chartColors.length]} />)}
                    </Pie>
                    <Tooltip formatter={value => money(value)} />
                  </PieChart>
                </ResponsiveContainer>
                <div><strong>{money(report.revenue)}</strong><span>Total</span></div>
              </div>
              <div className="profit-legend">
                {distributionRows.map((row, index) => (
                  <span key={row.name}><i style={{ background: chartColors[index % chartColors.length] }} />{row.name}</span>
                ))}
              </div>
            </article>
          </div>
        ) : <div className="table-container">
          <table>
            <thead>
              {(view === 'profit-products' || view === 'profit-clients') && <tr>
                <th>{view === 'profit-products' ? 'Producto' : 'Cliente'}</th>
                <th>Unidades</th>
                <th>Ventas</th>
                <th>Coste directo</th>
                <th>Margen trazado</th>
                <th>Margen</th>
                <th>Cobertura</th>
              </tr>}
              {(view === 'products' || view === 'clients') && <tr>
                <th>{view === 'products' ? 'Producto' : 'Cliente'}</th><th>Unidades</th><th>Ventas</th><th>Precio medio</th><th>Peso sobre ventas</th>
              </tr>}
              {view === 'orders' && <tr><th>Fecha</th><th>Albarán / pedido</th><th>Cliente</th><th>Unidades</th><th>Venta</th><th>Coste</th><th>Beneficio</th><th>Cobertura</th></tr>}
              {view === 'production' && <tr><th>Variedad / ficha</th><th>Semilla</th><th>Sustrato</th><th>Bandeja</th><th>Coste/bandeja</th><th>Coste/kg</th></tr>}
              {view === 'cultivations' && <tr><th>Fecha</th><th>Cultivo / lote</th><th>Estado</th><th>Bandejas totales</th><th>Cosechadas</th><th>Activas</th><th>Perdidas</th><th>Semilla/bdj.</th><th>Sustrato/bdj.</th><th>Bandeja</th><th>Coste/bdj.</th><th>Coste total</th></tr>}
              {view === 'varietycosts' && <tr><th>Variedad</th><th>Cultivos</th><th>Bandejas</th><th>Cosechadas</th><th>Perdidas</th><th>Coste/bandeja</th><th>Coste total</th></tr>}
              {view === 'clientcosts' && <tr><th>Cliente</th><th>Uds.</th><th>Ventas</th><th>Coste trazado</th><th>Beneficio</th><th>Cobertura</th></tr>}
              {view === 'harvests' && <tr><th>Fecha</th><th>Producto / lote</th><th>Bandejas</th><th>Producido</th><th>Vendido</th><th>Sin vender</th><th>Semilla</th><th>Sustrato</th><th>Envases</th><th>Etiquetas</th><th>Coste total</th><th>Coste/ud.</th></tr>}
              {view === 'expenses' && <tr><th>Fecha</th><th>Categoría</th><th>Concepto</th><th>Importe</th><th>Estado</th><th>Forma de pago</th></tr>}
              {view === 'treasury' && <tr><th>Fecha</th><th>Proveedor</th><th>Documento</th><th>Compra de stock</th></tr>}
              {view === 'receivables' && <tr><th>Cliente</th><th>Facturado</th><th>Pagado</th><th>Pendiente</th><th>Entregado sin facturar</th><th>Documentos</th></tr>}
              {view === 'stockvalue' && <tr><th>Tipo</th><th>Artículo</th><th>Stock actual</th><th>Coste unitario</th><th>Valor total</th></tr>}
              {view === 'packaging' && <tr><th>Formato de venta</th><th>Último coste unitario</th><th>Stock actual</th></tr>}
            </thead>
            <tbody>
              {(view === 'profit-products' || view === 'profit-clients') && rows.map(row => (
                <tr key={row.id}>
                  <td><strong>{row.name}</strong></td>
                  <td>{row.units}</td>
                  <td>{money(row.revenue)}</td>
                  <td>{money(row.cost)}</td>
                  <td><strong className="profit-positive">{money(row.margin)}</strong></td>
                  <td>{row.marginPercent.toFixed(1)} %</td>
                  <td>
                    {row.pendingUnits > 0
                      ? <span className="badge badge-warning">{row.pendingUnits} sin coste</span>
                      : <span className="badge badge-success">Completa</span>}
                  </td>
                </tr>
              ))}
              {(view === 'products' || view === 'clients') && rows.map(row => (
                <tr key={row.id}>
                  <td><strong>{row.name}</strong></td><td>{row.units}</td><td><strong>{money(row.revenue)}</strong></td>
                  <td>{money(row.units ? row.revenue / row.units : 0)}</td><td>{report.revenue ? (row.revenue / report.revenue * 100).toFixed(1) : '0.0'} %</td>
                </tr>
              ))}
              {view === 'orders' && rows.map(row => (
                <tr key={row.id}><td>{row.date}</td><td><strong>{row.number}</strong></td><td>{row.clientName}</td><td>{row.units}</td><td>{money(row.revenue)}</td><td>{money(row.cost)}</td><td><strong className={row.margin >= 0 ? 'profit-positive' : 'profit-negative'}>{money(row.margin)}</strong></td><td>{row.pendingUnits ? <span className="badge badge-warning">{row.pendingUnits} sin coste</span> : <span className="badge badge-success">Completa</span>}</td></tr>
              ))}
              {view === 'production' && rows.map(row => (
                <tr key={row.id}><td><strong>{row.name}</strong></td><td>{money(row.seedCost)}</td><td>{money(row.substrateCost)}</td><td>{money(row.trayCost)}</td><td><strong>{money(row.total)}</strong></td><td>{money(row.costPerKg)}</td></tr>
              ))}
              {view === 'cultivations' && rows.map(row => (
                <tr key={row.id}>
                  <td>{row.date}</td><td><strong>{row.name}</strong><small className="profit-cell-note">{row.batchNumber}</small></td><td>{row.status}</td>
                  <td>{row.totalTrays}</td><td>{row.harvestedTrays}</td><td>{row.remainingTrays}</td><td>{row.discardedTrays}</td>
                  <td>{money(row.seedCost)}</td><td>{money(row.substrateCost)}</td><td>{money(row.trayCost)}</td>
                  <td><strong>{money(row.costPerTray)}</strong></td><td><strong>{money(row.total)}</strong></td>
                </tr>
              ))}
              {view === 'varietycosts' && rows.map(row => (
                <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.crops}</td><td>{row.trays}</td><td>{row.harvestedTrays}</td><td>{row.discardedTrays}</td><td>{money(row.costPerTray)}</td><td><strong>{money(row.total)}</strong></td></tr>
              ))}
              {view === 'clientcosts' && rows.map(row => (
                <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.units}</td><td>{money(row.revenue)}</td><td>{money(row.cost)}</td><td className={row.margin >= 0 ? 'profit-positive' : 'profit-negative'}><strong>{money(row.margin)}</strong></td><td>{row.pendingUnits ? `${row.pendingUnits} uds. sin coste` : 'Completa'}</td></tr>
              ))}
              {view === 'harvests' && rows.map(row => (
                <tr key={row.id}>
                  <td>{row.date}</td><td><strong>{row.name}</strong><small className="profit-cell-note">{row.batchNumber}</small></td>
                  <td>{row.trays}</td><td>{row.units}</td><td>{row.soldUnits}</td><td>{row.remainingUnits}</td>
                  <td>{money(row.seedCost)}</td><td>{money(row.substrateCost)}</td><td>{money(row.packagingCost)}</td><td>{money(row.labelCost)}</td>
                  <td><strong>{money(row.total)}</strong></td><td>{money(row.unitCost)}</td>
                </tr>
              ))}
              {view === 'expenses' && rows.map(row => (
                <tr key={row.id}><td>{row.date}</td><td>{row.category}</td><td><strong>{row.name}</strong></td><td>{money(row.total)}</td><td><span className={`badge ${row.isPaid ? 'badge-success' : 'badge-warning'}`}>{row.isPaid ? 'Pagado' : 'Pendiente'}</span></td><td>{row.paymentMethod}</td></tr>
              ))}
              {view === 'treasury' && rows.map(row => (
                <tr key={row.id}><td>{row.date}</td><td><strong>{row.provider}</strong></td><td>{row.number}</td><td>{money(row.total)}</td></tr>
              ))}
              {view === 'receivables' && rows.map(row => (
                <tr key={row.id}><td><strong>{row.name}</strong></td><td>{money(row.invoiced)}</td><td className="profit-positive">{money(row.paid)}</td><td className={row.pending > 0 ? 'profit-negative' : ''}>{money(row.pending)}</td><td>{money(row.unbilled)}</td><td>{row.documents}</td></tr>
              ))}
              {view === 'stockvalue' && rows.map(row => (
                <tr key={row.id}><td><span className="expense-category">{row.type}</span></td><td><strong>{row.name}</strong></td><td>{row.quantity}</td><td>{money(row.unitCost)}</td><td><strong>{money(row.total)}</strong></td></tr>
              ))}
              {view === 'packaging' && rows.map(row => (
                <tr key={row.id}><td><strong>{row.name}</strong></td><td>{money(row.unitCost)}</td><td>{row.stock}</td></tr>
              ))}
              {!rows.length && (
                <tr><td colSpan="8" className="profit-empty">No hay datos para esta consulta.</td></tr>
              )}
            </tbody>
          </table>
        </div>}
      </section>}
      </div>
    </div>
  );
  return modal
    ? <div className="profit-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>{content}</div>
    : content;
}
