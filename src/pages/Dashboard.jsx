import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Building2, CircleDollarSign, FileText, Package,
  Receipt, Settings, ShieldCheck, ShoppingBag, TrendingUp, TriangleAlert, Users
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts';
import { useData } from '../context/DataContext';

const money = value => new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 2
}).format(Number(value || 0));

const monthKey = date => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? ''
    : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
};

const localDate = date => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const monthBounds = month => {
  const [year, monthNumber] = month.split('-').map(Number);
  return { start: `${month}-01`, end: localDate(new Date(year, monthNumber, 0)) };
};

const weekBounds = week => {
  const [year, weekNumber] = week.split('-W').map(Number);
  const fourthJanuary = new Date(year, 0, 4);
  const monday = new Date(fourthJanuary);
  monday.setDate(fourthJanuary.getDate() - ((fourthJanuary.getDay() + 6) % 7) + (weekNumber - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: localDate(monday), end: localDate(sunday) };
};

const yearBounds = year => ({ start: `${year}-01-01`, end: `${year}-12-31` });

const Metric = ({ icon, label, value, detail, tone }) => (
  <article className={`admin-metric admin-metric-${tone}`}>
    <div className="admin-metric-icon">{icon}</div>
    <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
  </article>
);

export default function Dashboard() {
  const {
    companyProfile, updateCompanyProfile, clients, orders, deliveryNotes,
    expenses, products, articles, stockEntries, harvests, productMovements
  } = useData();
  const navigate = useNavigate();
  const [today] = useState(() => new Date());
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [filterMode, setFilterMode] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
  const [selectedWeek, setSelectedWeek] = useState(`${today.getFullYear()}-W${String(Math.ceil((((today - new Date(today.getFullYear(), 0, 1)) / 86400000) + new Date(today.getFullYear(), 0, 1).getDay() + 1) / 7)).padStart(2, '0')}`);
  const [rangeStart, setRangeStart] = useState(localDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [rangeEnd, setRangeEnd] = useState(localDate(today));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reportView, setReportView] = useState('products');
  const [reportQuery, setReportQuery] = useState('');
  const [companyForm, setCompanyForm] = useState(companyProfile || {});
  const [editingCompany, setEditingCompany] = useState(false);
  const selectedBounds = filterMode === 'month'
    ? monthBounds(selectedMonth)
    : filterMode === 'year'
      ? yearBounds(selectedYear)
    : filterMode === 'week'
      ? weekBounds(selectedWeek)
      : { start: rangeStart, end: rangeEnd };

  const data = useMemo(() => {
    const inPeriod = date => {
      const value = String(date || '').slice(0, 10);
      return value && value >= selectedBounds.start && value <= selectedBounds.end;
    };
    const noteByOrder = new Map((deliveryNotes || []).map(note => [note.orderId, note]));
    const harvestByBatch = new Map((harvests || []).map(harvest => [String(harvest.batchNumber), harvest]));
    const movementCostByOrderProduct = new Map();
    (productMovements || [])
      .filter(movement => movement.type === 'ORDER' && movement.referenceId?.includes('|'))
      .forEach(movement => {
        const [orderId, batch] = movement.referenceId.split('|');
        const harvest = harvestByBatch.get(String(batch));
        const key = `${orderId}::${movement.productId}`;
        const quantity = Math.abs(Number(movement.quantity || 0));
        const unitCost = Number(harvest?.costPerTupper || 0);
        const current = movementCostByOrderProduct.get(key) || { cost: 0, costedUnits: 0 };
        current.cost += quantity * unitCost;
        if (unitCost > 0) current.costedUnits += quantity;
        movementCostByOrderProduct.set(key, current);
      });
    const currentNotes = (deliveryNotes || []).filter(note => inPeriod(note.date));
    const periodOrders = (orders || []).filter(order => {
      if (order.status !== 'DELIVERED') return false;
      return inPeriod(noteByOrder.get(order.id)?.date || order.date);
    });
    const monthSales = periodOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const pendingOrders = (orders || []).filter(order => order.status !== 'DELIVERED');
    const pendingOrderValue = pendingOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const pendingCollection = currentNotes
      .filter(note => note.isPaid !== true)
      .reduce((sum, note) => sum + Number(note.total || 0), 0);
    const monthExpenses = (expenses || [])
      .filter(expense => inPeriod(expense.date))
      .reduce((sum, expense) => sum + Number(expense.total ?? expense.amount ?? 0), 0);

    const boundsStart = new Date(`${selectedBounds.start}T12:00:00`);
    const boundsEnd = new Date(`${selectedBounds.end}T12:00:00`);
    const periodDays = Math.max(Math.round((boundsEnd - boundsStart) / 86400000) + 1, 1);
    const chart = [];
    if (periodDays <= 62) {
      for (let cursor = new Date(boundsStart); cursor <= boundsEnd; cursor.setDate(cursor.getDate() + 1)) {
        const key = localDate(cursor);
        chart.push({
          key,
          start: key,
          end: key,
          name: new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short' }).format(cursor).replace('.', ''),
          Ventas: 0
        });
      }
    } else {
      const cursor = new Date(boundsStart.getFullYear(), boundsStart.getMonth(), 1);
      while (cursor <= boundsEnd) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
        chart.push({
          key,
          start: `${key}-01`,
          end: monthBounds(key).end,
          name: new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' }).format(cursor).replace('.', ''),
          Ventas: 0
        });
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
    const chartMap = new Map(chart.map(item => [periodDays <= 62 ? item.key : item.key, item]));
    periodOrders.forEach(order => {
      const orderDate = noteByOrder.get(order.id)?.date || order.date;
      const key = periodDays <= 62 ? String(orderDate || '').slice(0, 10) : monthKey(orderDate);
      const item = chartMap.get(key);
      if (item) item.Ventas += Number(order.total || 0);
    });

    const productTotals = new Map();
    const clientTotals = new Map();
    periodOrders.forEach(order => {
      const note = noteByOrder.get(order.id);
      const clientName = note?.clientCommercialName || note?.clientName
        || order.clientCommercialName || order.clientName || 'Cliente sin nombre';
      const clientCurrent = clientTotals.get(order.clientId || clientName)
        || { name: clientName, total: 0, cost: 0, units: 0, costedUnits: 0 };
      const costAppliedProducts = new Set();
      (order.items || []).forEach(item => {
        const name = products.find(product => product.id === item.productId)?.name
          || item.name || 'Producto histórico';
        const quantity = Number(item.quantity || 0);
        const revenue = Number(item.price || 0) * quantity
          * (1 - Number(item.discount || 0) / 100);
        const movementCost = costAppliedProducts.has(item.productId)
          ? { cost: 0, costedUnits: 0 }
          : (movementCostByOrderProduct.get(`${order.id}::${item.productId}`) || { cost: 0, costedUnits: 0 });
        costAppliedProducts.add(item.productId);
        const current = productTotals.get(item.productId || name)
          || { id: item.productId || name, name, units: 0, total: 0, cost: 0, costedUnits: 0 };
        current.units += quantity;
        current.total += revenue;
        current.cost += movementCost.cost;
        current.costedUnits += Math.min(quantity, movementCost.costedUnits);
        productTotals.set(item.productId || name, current);
        clientCurrent.total += revenue;
        clientCurrent.cost += movementCost.cost;
        clientCurrent.units += quantity;
        clientCurrent.costedUnits += Math.min(quantity, movementCost.costedUnits);
      });
      clientTotals.set(order.clientId || clientName, clientCurrent);
    });

    const finishEconomicRow = row => ({
      ...row,
      margin: row.total - row.cost,
      marginPercent: row.total > 0 ? ((row.total - row.cost) / row.total) * 100 : 0,
      pendingCostUnits: Math.max(row.units - row.costedUnits, 0)
    });
    const productSales = [...productTotals.values()].map(finishEconomicRow).sort((a, b) => b.total - a.total);
    const allClients = [...clientTotals.values()].map(finishEconomicRow).sort((a, b) => b.total - a.total);
    const tracedProducts = productSales.filter(item => item.costedUnits > 0);
    const mostProfitable = tracedProducts.slice().sort((a, b) => b.margin - a.margin)[0] || null;
    const totalCost = productSales.reduce((sum, item) => sum + item.cost, 0);
    const costedUnits = productSales.reduce((sum, item) => sum + item.costedUnits, 0);

    const lowStock = (articles || [])
      .map(article => ({
        ...article,
        currentStock: (stockEntries || [])
          .filter(entry => entry.articleId === article.id)
          .reduce((sum, entry) => sum + Number(entry.quantity || 0), 0)
      }))
      .filter(article => Number(article.minStock || 0) > 0 && article.currentStock <= Number(article.minStock))
      .sort((a, b) => a.currentStock - b.currentStock);

    return {
      periodLabel: `${new Intl.DateTimeFormat('es-ES').format(new Date(`${selectedBounds.start}T12:00:00`))} – ${new Intl.DateTimeFormat('es-ES').format(new Date(`${selectedBounds.end}T12:00:00`))}`,
      monthSales,
      totalCost,
      margin: monthSales - totalCost,
      marginPercent: monthSales > 0 ? ((monthSales - totalCost) / monthSales) * 100 : 0,
      costedUnits,
      mostProfitable,
      orderCount: periodOrders.length,
      units: [...productTotals.values()].reduce((sum, item) => sum + item.units, 0),
      averageTicket: periodOrders.length ? monthSales / periodOrders.length : 0,
      pendingOrders: pendingOrders.length,
      pendingOrderValue,
      pendingCollection,
      monthExpenses,
      chart,
      allClients,
      productSales,
      lowStock
    };
  }, [articles, deliveryNotes, expenses, harvests, orders, productMovements, products, selectedBounds.end, selectedBounds.start, stockEntries]);

  const saveCompany = async event => {
    event.preventDefault();
    await updateCompanyProfile(companyForm);
    setEditingCompany(false);
  };

  const openChartPeriod = chartState => {
    const point = chartState?.activePayload?.[0]?.payload;
    if (!point?.start) return;
    setRangeStart(point.start);
    setRangeEnd(point.end);
    setFilterMode('range');
    setDetailsOpen(true);
  };

  const shortcuts = [
    { label: 'Nuevo pedido', detail: 'Registrar una venta', icon: <ShoppingBag />, path: '/admin/orders' },
    { label: 'Clientes', detail: `${clients.length} fichas`, icon: <Users />, path: '/admin/clients' },
    { label: 'Productos', detail: `${products.length} productos`, icon: <Package />, path: '/admin/products' },
    { label: 'Rentabilidad', detail: 'Informes económicos', icon: <TrendingUp />, path: '/admin/profitability' },
    { label: 'Trazabilidad', detail: 'Lotes y cadena sanitaria', icon: <ShieldCheck />, path: '/crops?tab=trazabilidad' }
  ];
  const normalizedReportQuery = reportQuery.trim().toLocaleLowerCase('es');
  const filteredReportProducts = data.productSales.filter(item => item.name.toLocaleLowerCase('es').includes(normalizedReportQuery));
  const filteredReportClients = data.allClients.filter(item => item.name.toLocaleLowerCase('es').includes(normalizedReportQuery));

  return (
    <div className="admin-dashboard">
      <header className="admin-welcome">
        <div>
          <span className="admin-overline">RESUMEN DE NEGOCIO</span>
          <h1>Buenos días, {companyProfile?.commercialName || companyProfile?.fiscalName || 'GreenCode'}</h1>
          <p>Una vista clara del periodo {data.periodLabel}.</p>
        </div>
        <div className="admin-header-actions">
          <button className="admin-secondary-action" onClick={() => setDetailsOpen(true)}>Ver informe completo</button>
          <button className="admin-primary-action" onClick={() => navigate('/admin/profitability')}>Ver rentabilidad <ArrowRight size={17} /></button>
        </div>
      </header>

      <section className="admin-period-filter">
        <div className="admin-period-tabs">
          <button className={filterMode === 'month' ? 'active' : ''} onClick={() => setFilterMode('month')}>Mes</button>
          <button className={filterMode === 'year' ? 'active' : ''} onClick={() => setFilterMode('year')}>Año</button>
          <button className={filterMode === 'week' ? 'active' : ''} onClick={() => setFilterMode('week')}>Semana</button>
          <button className={filterMode === 'range' ? 'active' : ''} onClick={() => setFilterMode('range')}>Rango de fechas</button>
        </div>
        {filterMode === 'month' && <input aria-label="Mes del dashboard" type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} />}
        {filterMode === 'year' && <select aria-label="Año del dashboard" value={selectedYear} onChange={event => setSelectedYear(event.target.value)}>{Array.from({ length: 6 }, (_, index) => String(today.getFullYear() - index)).map(year => <option key={year}>{year}</option>)}</select>}
        {filterMode === 'week' && <input aria-label="Semana del dashboard" type="week" value={selectedWeek} onChange={event => setSelectedWeek(event.target.value)} />}
        {filterMode === 'range' && <div className="admin-date-range"><input aria-label="Fecha inicial" type="date" value={rangeStart} max={rangeEnd} onChange={event => setRangeStart(event.target.value)} /><span>hasta</span><input aria-label="Fecha final" type="date" value={rangeEnd} min={rangeStart} onChange={event => setRangeEnd(event.target.value)} /></div>}
        <span className="admin-period-label">{data.periodLabel}</span>
      </section>

      {data.lowStock.length > 0 && (
        <div className="admin-alert">
          <TriangleAlert size={20} />
          <div><strong>{data.lowStock.length} artículos necesitan atención</strong><span>{data.lowStock.slice(0, 3).map(item => item.name).join(' · ')}</span></div>
          <button onClick={() => navigate('/crops')}>Revisar stock</button>
        </div>
      )}

      <section className="admin-metrics">
        <Metric icon={<CircleDollarSign />} label="Ventas del periodo" value={money(data.monthSales)} detail={`${data.orderCount} entregas · ${data.units} unidades`} tone="green" />
        <Metric icon={<FileText />} label="Ticket medio" value={money(data.averageTicket)} detail={`${data.orderCount} ventas realizadas`} tone="blue" />
        <Metric icon={<ShoppingBag />} label="Pedidos abiertos" value={data.pendingOrders} detail={money(data.pendingOrderValue)} tone="purple" />
        <Metric icon={<Receipt />} label="Gastos del periodo" value={money(data.monthExpenses)} detail={`${money(data.pendingCollection)} pendiente de cobro`} tone="amber" />
        <Metric icon={<TrendingUp />} label="Margen trazado" value={money(data.margin)} detail={`${data.marginPercent.toFixed(1)} % · ${data.costedUnits}/${data.units} uds. con coste`} tone="green" />
      </section>

      <section className="admin-dashboard-grid">
        <article className="admin-panel admin-sales-panel">
          <div className="admin-panel-title"><div><h2>Evolución de ventas</h2><p>Haz clic en un mes para abrir su informe</p></div><span>12 meses</span></div>
          <div className="admin-sales-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.chart} margin={{ top: 12, right: 12, left: 0, bottom: 0 }} onClick={openChartPeriod} style={{ cursor: 'pointer' }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eef3" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={value => `${value} €`} />
                <Tooltip formatter={value => money(value)} contentStyle={{ border: 0, borderRadius: 12, boxShadow: '0 12px 30px rgba(15,23,42,.12)' }} />
                <Area type="monotone" dataKey="Ventas" stroke="#10b981" strokeWidth={3} fill="url(#salesGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="admin-panel">
          <div className="admin-panel-title"><div><h2>Mejores clientes</h2><p>Periodo seleccionado</p></div><button className="admin-panel-link" onClick={() => setDetailsOpen(true)}>Ver todos</button></div>
          <div className="admin-client-list">
            {data.allClients.slice(0, 5).map((client, index) => (
              <div key={client.name}><i>{index + 1}</i><span>{client.name}</span><strong>{money(client.total)}</strong></div>
            ))}
            {!data.allClients.length && <p className="admin-empty-state">Todavía no hay ventas en este periodo.</p>}
          </div>
        </article>
      </section>

      <section className="admin-analytics-grid">
        <article className="admin-panel">
          <div className="admin-panel-title"><div><h2>Ventas por producto</h2><p>Productos principales del periodo</p></div><button className="admin-panel-link" onClick={() => { setReportView('products'); setDetailsOpen(true); }}>Ver todos</button></div>
          <div className="admin-product-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.productSales.slice(0, 10).map(item => ({ ...item, shortName: item.name.length > 18 ? `${item.name.slice(0, 17)}…` : item.name }))} layout="vertical" margin={{ top: 4, right: 18, left: 10, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e8eef3" />
                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={value => `${value} €`} />
                <YAxis type="category" dataKey="shortName" width={115} axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 10 }} />
                <Tooltip formatter={value => money(value)} contentStyle={{ border: 0, borderRadius: 12, boxShadow: '0 12px 30px rgba(15,23,42,.12)' }} />
                <Bar dataKey="total" name="Ventas" fill="#10b981" radius={[0, 6, 6, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="admin-panel admin-profit-highlight">
          <div className="admin-panel-title"><div><h2>Producto más rentable</h2><p>Solo costes con trazabilidad completa</p></div></div>
          {data.mostProfitable ? (
            <div className="admin-profit-product">
              <span>MEJOR MARGEN</span>
              <h3>{data.mostProfitable.name}</h3>
              <strong>{money(data.mostProfitable.margin)}</strong>
              <p>{data.mostProfitable.marginPercent.toFixed(1)} % de margen · {data.mostProfitable.units} unidades</p>
              <div><small>Ventas {money(data.mostProfitable.total)}</small><small>Coste {money(data.mostProfitable.cost)}</small></div>
              <button onClick={() => navigate('/admin/profitability')}>Abrir análisis económico <ArrowRight size={15} /></button>
            </div>
          ) : <p className="admin-empty-state">La rentabilidad aparecerá con las nuevas cosechas y ventas trazadas.</p>}
        </article>
      </section>

      <section className="admin-shortcuts">
        {shortcuts.map(item => (
          <button key={item.label} onClick={() => navigate(item.path)}>
            <i>{item.icon}</i><span><strong>{item.label}</strong><small>{item.detail}</small></span><ArrowRight size={17} />
          </button>
        ))}
      </section>

      <details className="admin-panel admin-settings">
        <summary><span><Settings size={18} /> Configuración de empresa</span><small>Datos fiscales y generales</small></summary>
        {editingCompany ? (
          <form onSubmit={saveCompany} className="admin-company-form">
            <label>Nombre fiscal<input value={companyForm.fiscalName || ''} onChange={event => setCompanyForm({ ...companyForm, fiscalName: event.target.value })} /></label>
            <label>Titular<input value={companyForm.ownerName || ''} onChange={event => setCompanyForm({ ...companyForm, ownerName: event.target.value })} /></label>
            <label>NIF/CIF<input value={companyForm.nif || ''} onChange={event => setCompanyForm({ ...companyForm, nif: event.target.value })} /></label>
            <label>Dirección<input value={companyForm.address || ''} onChange={event => setCompanyForm({ ...companyForm, address: event.target.value })} /></label>
            <label>Localidad<input value={companyForm.city || ''} onChange={event => setCompanyForm({ ...companyForm, city: event.target.value })} /></label>
            <label>Provincia<input value={companyForm.province || ''} onChange={event => setCompanyForm({ ...companyForm, province: event.target.value })} /></label>
            <label className="admin-company-bank">IBAN / CCC para facturas<input value={companyForm.bankAccount || ''} onChange={event => setCompanyForm({ ...companyForm, bankAccount: event.target.value })} placeholder="ES00 0000 0000 0000 0000 0000" /></label>
            <div className="admin-company-actions"><button type="button" onClick={() => setEditingCompany(false)}>Cancelar</button><button type="submit">Guardar cambios</button></div>
          </form>
        ) : (
          <div className="admin-company-summary">
            <Building2 size={28} />
            <div><strong>{companyProfile?.fiscalName || 'Sin configurar'}</strong><span>{companyProfile?.ownerName} · {companyProfile?.nif}</span><small>{companyProfile?.address}, {companyProfile?.city}</small>{companyProfile?.bankAccount && <small className="admin-company-iban">IBAN / CCC: {companyProfile.bankAccount}</small>}</div>
            <button onClick={() => { setCompanyForm(companyProfile || {}); setEditingCompany(true); }}>Editar</button>
          </div>
        )}
      </details>

      {detailsOpen && (
        <div className="admin-report-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDetailsOpen(false); }}>
          <section className="admin-report-modal" role="dialog" aria-modal="true" aria-label="Informe detallado de ventas">
            <header>
              <div><span className="admin-overline">INFORME DE VENTAS</span><h2>{data.periodLabel}</h2><p>{data.orderCount} ventas · {data.units} unidades · Ticket medio {money(data.averageTicket)}</p></div>
              <button aria-label="Cerrar informe" onClick={() => setDetailsOpen(false)}>×</button>
            </header>
            <div className="admin-report-summary">
              <div><span>Ventas</span><strong>{money(data.monthSales)}</strong></div>
              <div><span>Coste trazado</span><strong>{money(data.totalCost)}</strong></div>
              <div><span>Margen trazado</span><strong>{money(data.margin)}</strong></div>
              <div><span>Ticket medio</span><strong>{money(data.averageTicket)}</strong></div>
            </div>
            <div className="admin-report-controls">
              <div className="admin-report-tabs">
                <button className={reportView === 'products' ? 'active' : ''} onClick={() => setReportView('products')}>Productos</button>
                <button className={reportView === 'clients' ? 'active' : ''} onClick={() => setReportView('clients')}>Clientes</button>
              </div>
              <input value={reportQuery} onChange={event => setReportQuery(event.target.value)} placeholder={`Buscar ${reportView === 'products' ? 'producto' : 'cliente'}…`} />
              <button className="admin-report-profitability" onClick={() => navigate('/admin/profitability')}>Rentabilidad avanzada <ArrowRight size={15} /></button>
            </div>
            <div className="admin-report-content">
              {reportView === 'products' ? (
                <article>
                <h3>Ventas y rentabilidad por producto <span>{filteredReportProducts.length}</span></h3>
                <div className="admin-report-table">
                  <table>
                    <thead><tr><th>Producto</th><th>Uds.</th><th>Ventas</th><th>Coste</th><th>Margen</th><th>Cobertura</th></tr></thead>
                    <tbody>{filteredReportProducts.map(product => (
                      <tr key={product.id}>
                        <td><strong>{product.name}</strong></td><td>{product.units}</td><td>{money(product.total)}</td>
                        <td>{money(product.cost)}</td><td className={product.margin >= 0 ? 'positive' : 'negative'}>{money(product.margin)}</td>
                        <td><span className={product.pendingCostUnits ? 'admin-cost-pending' : 'admin-cost-complete'}>{product.pendingCostUnits ? `${product.pendingCostUnits} uds. pendientes` : 'Completa'}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                  {!filteredReportProducts.length && <p>No hay productos que coincidan en este periodo.</p>}
                </div>
              </article>
              ) : (
                <article>
                <h3>Ventas y rentabilidad por cliente <span>{filteredReportClients.length}</span></h3>
                <div className="admin-report-table">
                  <table>
                    <thead><tr><th>Cliente</th><th>Uds.</th><th>Ventas</th><th>Coste</th><th>Margen</th><th>Cobertura</th></tr></thead>
                    <tbody>{filteredReportClients.map(client => (
                      <tr key={client.name}>
                        <td><strong>{client.name}</strong></td><td>{client.units}</td><td>{money(client.total)}</td>
                        <td>{money(client.cost)}</td><td className={client.margin >= 0 ? 'positive' : 'negative'}>{money(client.margin)}</td>
                        <td><span className={client.pendingCostUnits ? 'admin-cost-pending' : 'admin-cost-complete'}>{client.pendingCostUnits ? `${client.pendingCostUnits} uds. pendientes` : 'Completa'}</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
                  {!filteredReportClients.length && <p>No hay clientes que coincidan en este periodo.</p>}
                </div>
              </article>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
