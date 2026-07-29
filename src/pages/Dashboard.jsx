import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Building2, CircleDollarSign, FileText, Package,
  Receipt, Settings, ShoppingBag, TrendingUp, TriangleAlert, Users
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer,
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

const Metric = ({ icon, label, value, detail, tone }) => (
  <article className={`admin-metric admin-metric-${tone}`}>
    <div className="admin-metric-icon">{icon}</div>
    <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
  </article>
);

export default function Dashboard() {
  const {
    companyProfile, updateCompanyProfile, clients, orders, deliveryNotes,
    expenses, products, articles, stockEntries
  } = useData();
  const navigate = useNavigate();
  const [today] = useState(() => new Date());
  const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [filterMode, setFilterMode] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [selectedWeek, setSelectedWeek] = useState(`${today.getFullYear()}-W${String(Math.ceil((((today - new Date(today.getFullYear(), 0, 1)) / 86400000) + new Date(today.getFullYear(), 0, 1).getDay() + 1) / 7)).padStart(2, '0')}`);
  const [rangeStart, setRangeStart] = useState(localDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [rangeEnd, setRangeEnd] = useState(localDate(today));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState(companyProfile || {});
  const [editingCompany, setEditingCompany] = useState(false);
  const selectedBounds = filterMode === 'month'
    ? monthBounds(selectedMonth)
    : filterMode === 'week'
      ? weekBounds(selectedWeek)
      : { start: rangeStart, end: rangeEnd };

  const data = useMemo(() => {
    const inPeriod = date => {
      const value = String(date || '').slice(0, 10);
      return value && value >= selectedBounds.start && value <= selectedBounds.end;
    };
    const noteByOrder = new Map((deliveryNotes || []).map(note => [note.orderId, note]));
    const currentNotes = (deliveryNotes || []).filter(note => inPeriod(note.date));
    const periodOrders = (orders || []).filter(order => {
      if (order.status !== 'DELIVERED') return false;
      return inPeriod(noteByOrder.get(order.id)?.date || order.date);
    });
    const monthSales = currentNotes.reduce((sum, note) => sum + Number(note.total || 0), 0);
    const pendingOrders = (orders || []).filter(order => order.status !== 'DELIVERED');
    const pendingOrderValue = pendingOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const pendingCollection = currentNotes
      .filter(note => note.isPaid !== true)
      .reduce((sum, note) => sum + Number(note.total || 0), 0);
    const monthExpenses = (expenses || [])
      .filter(expense => inPeriod(expense.date))
      .reduce((sum, expense) => sum + Number(expense.total ?? expense.amount ?? 0), 0);

    const months = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() - (11 - index), 1);
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        name: new Intl.DateTimeFormat('es-ES', { month: 'short', year: '2-digit' }).format(date).replace('.', ''),
        Ventas: 0
      };
    });
    const monthMap = new Map(months.map(month => [month.key, month]));
    (deliveryNotes || []).forEach(note => {
      const item = monthMap.get(monthKey(note.date));
      if (item) item.Ventas += Number(note.total || 0);
    });

    const clientTotals = new Map();
    currentNotes.forEach(note => {
      const name = note.clientCommercialName || note.clientName || 'Cliente sin nombre';
      clientTotals.set(name, (clientTotals.get(name) || 0) + Number(note.total || 0));
    });

    const productTotals = new Map();
    periodOrders.forEach(order => {
      (order.items || []).forEach(item => {
        const name = products.find(product => product.id === item.productId)?.name
          || item.name || 'Producto histórico';
        const current = productTotals.get(item.productId || name) || { name, units: 0, total: 0 };
        current.units += Number(item.quantity || 0);
        current.total += Number(item.price || 0) * Number(item.quantity || 0)
          * (1 - Number(item.discount || 0) / 100);
        productTotals.set(item.productId || name, current);
      });
    });

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
      orderCount: periodOrders.length,
      units: [...productTotals.values()].reduce((sum, item) => sum + item.units, 0),
      averageTicket: periodOrders.length ? monthSales / periodOrders.length : 0,
      pendingOrders: pendingOrders.length,
      pendingOrderValue,
      pendingCollection,
      monthExpenses,
      chart: months,
      allClients: [...clientTotals.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
      productSales: [...productTotals.values()].sort((a, b) => b.total - a.total),
      lowStock
    };
  }, [articles, deliveryNotes, expenses, orders, products, selectedBounds.end, selectedBounds.start, stockEntries, today]);

  const saveCompany = async event => {
    event.preventDefault();
    await updateCompanyProfile(companyForm);
    setEditingCompany(false);
  };

  const openChartPeriod = chartState => {
    const point = chartState?.activePayload?.[0]?.payload;
    if (!point?.key) return;
    setSelectedMonth(point.key);
    setFilterMode('month');
    setDetailsOpen(true);
  };

  const shortcuts = [
    { label: 'Nuevo pedido', detail: 'Registrar una venta', icon: <ShoppingBag />, path: '/admin/orders' },
    { label: 'Clientes', detail: `${clients.length} fichas`, icon: <Users />, path: '/admin/clients' },
    { label: 'Productos', detail: `${products.length} productos`, icon: <Package />, path: '/admin/products' },
    { label: 'Rentabilidad', detail: 'Ver análisis', icon: <TrendingUp />, path: '/admin/profitability' }
  ];

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
          <button className={filterMode === 'week' ? 'active' : ''} onClick={() => setFilterMode('week')}>Semana</button>
          <button className={filterMode === 'range' ? 'active' : ''} onClick={() => setFilterMode('range')}>Rango de fechas</button>
        </div>
        {filterMode === 'month' && <input aria-label="Mes del dashboard" type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} />}
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
              <div><span>Unidades</span><strong>{data.units}</strong></div>
              <div><span>Clientes</span><strong>{data.allClients.length}</strong></div>
              <div><span>Productos</span><strong>{data.productSales.length}</strong></div>
            </div>
            <div className="admin-report-columns">
              <article>
                <h3>Ventas por producto <span>{data.productSales.length}</span></h3>
                <div className="admin-report-table">
                  <table>
                    <thead><tr><th>Producto</th><th>Unidades</th><th>Ventas</th></tr></thead>
                    <tbody>{data.productSales.map(product => <tr key={product.name}><td>{product.name}</td><td>{product.units}</td><td>{money(product.total)}</td></tr>)}</tbody>
                  </table>
                  {!data.productSales.length && <p>No hay productos vendidos en este periodo.</p>}
                </div>
              </article>
              <article>
                <h3>Ventas por cliente <span>{data.allClients.length}</span></h3>
                <div className="admin-report-table">
                  <table>
                    <thead><tr><th>Cliente</th><th>Ventas</th></tr></thead>
                    <tbody>{data.allClients.map(client => <tr key={client.name}><td>{client.name}</td><td>{money(client.total)}</td></tr>)}</tbody>
                  </table>
                  {!data.allClients.length && <p>No hay clientes con ventas en este periodo.</p>}
                </div>
              </article>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
