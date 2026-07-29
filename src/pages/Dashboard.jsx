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
  const [companyForm, setCompanyForm] = useState(companyProfile || {});
  const [editingCompany, setEditingCompany] = useState(false);

  const data = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentNotes = (deliveryNotes || []).filter(note => monthKey(note.date) === currentMonth);
    const monthSales = currentNotes.reduce((sum, note) => sum + Number(note.total || 0), 0);
    const pendingOrders = (orders || []).filter(order => order.status !== 'DELIVERED');
    const pendingOrderValue = pendingOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const pendingCollection = currentNotes
      .filter(note => note.isPaid !== true)
      .reduce((sum, note) => sum + Number(note.total || 0), 0);
    const monthExpenses = (expenses || [])
      .filter(expense => monthKey(expense.date) === currentMonth)
      .reduce((sum, expense) => sum + Number(expense.total ?? expense.amount ?? 0), 0);

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        name: new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(date).replace('.', ''),
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
      monthName: new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(now),
      monthSales,
      pendingOrders: pendingOrders.length,
      pendingOrderValue,
      pendingCollection,
      monthExpenses,
      chart: months,
      topClients: [...clientTotals.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 5),
      lowStock
    };
  }, [articles, deliveryNotes, expenses, orders, stockEntries]);

  const saveCompany = async event => {
    event.preventDefault();
    await updateCompanyProfile(companyForm);
    setEditingCompany(false);
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
          <p>Una vista clara de lo importante en {data.monthName}.</p>
        </div>
        <button className="admin-primary-action" onClick={() => navigate('/admin/profitability')}>
          Ver rentabilidad <ArrowRight size={17} />
        </button>
      </header>

      {data.lowStock.length > 0 && (
        <div className="admin-alert">
          <TriangleAlert size={20} />
          <div><strong>{data.lowStock.length} artículos necesitan atención</strong><span>{data.lowStock.slice(0, 3).map(item => item.name).join(' · ')}</span></div>
          <button onClick={() => navigate('/crops')}>Revisar stock</button>
        </div>
      )}

      <section className="admin-metrics">
        <Metric icon={<CircleDollarSign />} label="Ventas del mes" value={money(data.monthSales)} detail="Albaranes entregados" tone="green" />
        <Metric icon={<FileText />} label="Pendiente de cobro" value={money(data.pendingCollection)} detail="Del mes seleccionado" tone="blue" />
        <Metric icon={<ShoppingBag />} label="Pedidos abiertos" value={data.pendingOrders} detail={money(data.pendingOrderValue)} tone="purple" />
        <Metric icon={<Receipt />} label="Gastos del mes" value={money(data.monthExpenses)} detail="Gastos administrativos" tone="amber" />
      </section>

      <section className="admin-dashboard-grid">
        <article className="admin-panel admin-sales-panel">
          <div className="admin-panel-title"><div><h2>Evolución de ventas</h2><p>Últimos seis meses</p></div><span>Ventas</span></div>
          <div className="admin-sales-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.chart} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
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
          <div className="admin-panel-title"><div><h2>Mejores clientes</h2><p>Ventas de este mes</p></div></div>
          <div className="admin-client-list">
            {data.topClients.map((client, index) => (
              <div key={client.name}><i>{index + 1}</i><span>{client.name}</span><strong>{money(client.total)}</strong></div>
            ))}
            {!data.topClients.length && <p className="admin-empty-state">Todavía no hay ventas este mes.</p>}
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
            <div className="admin-company-actions"><button type="button" onClick={() => setEditingCompany(false)}>Cancelar</button><button type="submit">Guardar cambios</button></div>
          </form>
        ) : (
          <div className="admin-company-summary">
            <Building2 size={28} />
            <div><strong>{companyProfile?.fiscalName || 'Sin configurar'}</strong><span>{companyProfile?.ownerName} · {companyProfile?.nif}</span><small>{companyProfile?.address}, {companyProfile?.city}</small></div>
            <button onClick={() => { setCompanyForm(companyProfile || {}); setEditingCompany(true); }}>Editar</button>
          </div>
        )}
      </details>
    </div>
  );
}
