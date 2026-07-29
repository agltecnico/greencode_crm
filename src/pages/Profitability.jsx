import { useMemo, useState } from 'react';
import { BarChart3, CircleDollarSign, LayoutList, PackageCheck, Percent, TriangleAlert } from 'lucide-react';
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

export default function Profitability() {
  const { orders, deliveryNotes, clients, products, productMovements, harvests } = useData();
  const [initialBounds] = useState(() => monthBounds());
  const [filterMode, setFilterMode] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(initialBounds.start.slice(0, 7));
  const [startDate, setStartDate] = useState(initialBounds.start);
  const [endDate, setEndDate] = useState(initialBounds.end);
  const [view, setView] = useState('products');
  const [displayMode, setDisplayMode] = useState('visual');
  const selectedBounds = filterMode === 'month'
    ? boundsForMonth(selectedMonth)
    : { start: startDate, end: endDate };

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

        groupedItems.forEach((item, productId) => {
          const movement = movementsByOrderProduct.get(`${order.id}::${productId}`)
            || { quantity: 0, cost: 0, costedQuantity: 0 };
          const product = productById.get(productId);
          const client = clientById.get(order.clientId);
          const productName = product?.name || item.name || 'Producto histórico sin ficha';
          const clientName = client?.commercialName || client?.name
            || order.clientCommercialName || order.clientName || 'Cliente sin identificar';

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
        });
      });

    const finishRows = rows => [...rows.values()]
      .map(row => ({
        ...row,
        pendingUnits: Math.max(row.units - row.costedUnits, 0),
        margin: row.revenue - row.cost,
        marginPercent: row.revenue > 0 ? ((row.revenue - row.cost) / row.revenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      revenue,
      cost,
      units,
      costedUnits,
      pendingUnits: Math.max(units - costedUnits, 0),
      margin: revenue - cost,
      marginPercent: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
      coverage: units > 0 ? (costedUnits / units) * 100 : 0,
      productRows: finishRows(productRows),
      clientRows: finishRows(clientRows)
    };
  }, [clients, deliveryNotes, harvests, orders, productMovements, products, selectedBounds.end, selectedBounds.start]);

  const rows = view === 'products' ? report.productRows : report.clientRows;
  const chartRows = rows.slice(0, 8).map(row => ({
    name: row.name.length > 22 ? `${row.name.slice(0, 20)}…` : row.name,
    Ventas: Number(row.revenue.toFixed(2)),
    Costes: Number(row.cost.toFixed(2))
  }));
  const distributionRows = report.productRows.slice(0, 6).map(row => ({
    name: row.name,
    value: Number(row.revenue.toFixed(2))
  }));
  const chartColors = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899', '#64748b'];

  return (
    <div className="admin-container profitability-page">
      <header className="profit-header">
        <div>
          <p className="profit-eyebrow">CONTROL ECONÓMICO</p>
          <h1>Ventas y rentabilidad</h1>
          <p>Ingresos netos sin IVA y costes directos trazados de semilla, sustrato y envases.</p>
        </div>
        <div className="profit-filters">
          <div className="profit-filter-mode">
            <button className={filterMode === 'month' ? 'active' : ''} onClick={() => setFilterMode('month')}>Mes</button>
            <button className={filterMode === 'range' ? 'active' : ''} onClick={() => setFilterMode('range')}>Tramo de fechas</button>
          </div>
          {filterMode === 'month' ? (
            <label>Seleccionar mes<input type="month" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} /></label>
          ) : (
            <>
              <label>Desde<input type="date" value={startDate} max={endDate} onChange={event => setStartDate(event.target.value)} /></label>
              <label>Hasta<input type="date" value={endDate} min={startDate} onChange={event => setEndDate(event.target.value)} /></label>
            </>
          )}
        </div>
      </header>

      <section className="profit-stats">
        <StatCard icon={<CircleDollarSign size={22} />} label="Ventas netas" value={money(report.revenue)} detail={`${report.units} unidades entregadas`} />
        <StatCard icon={<PackageCheck size={22} />} label="Costes directos" value={money(report.cost)} detail={`${report.costedUnits} unidades con coste`} tone="blue" />
        <StatCard icon={<BarChart3 size={22} />} label="Margen bruto" value={money(report.margin)} detail="Antes de costes indirectos" tone="purple" />
        <StatCard icon={<Percent size={22} />} label="Margen" value={`${report.marginPercent.toFixed(1)} %`} detail={`${report.coverage.toFixed(1)} % con coste trazado`} tone="amber" />
      </section>

      {report.pendingUnits > 0 && (
        <div className="profit-warning">
          <TriangleAlert size={20} />
          <div>
            <strong>{report.pendingUnits} unidades vendidas todavía no tienen coste trazable.</strong>
            <span>Son ventas anteriores al nuevo registro económico de cosechas. Se incluyen en ingresos, pero su margen es provisional.</span>
          </div>
        </div>
      )}

      <section className="premium-card profit-table-card">
        <div className="profit-table-heading">
          <div>
            <h2>Desglose de resultados</h2>
            <p>Solo se contabilizan pedidos entregados dentro del periodo.</p>
          </div>
          <div className="profit-heading-actions">
            <div className="profit-tabs">
              <button className={view === 'products' ? 'active' : ''} onClick={() => setView('products')}>Por producto</button>
              <button className={view === 'clients' ? 'active' : ''} onClick={() => setView('clients')}>Por cliente</button>
            </div>
            <div className="profit-tabs">
              <button className={displayMode === 'visual' ? 'active' : ''} onClick={() => setDisplayMode('visual')}><BarChart3 size={15} /> Gráficas</button>
              <button className={displayMode === 'detail' ? 'active' : ''} onClick={() => setDisplayMode('detail')}><LayoutList size={15} /> Detalle</button>
            </div>
          </div>
        </div>

        {displayMode === 'visual' ? (
          <div className="profit-charts">
            <article className="profit-chart-main">
              <div><h3>Ventas frente a costes</h3><p>Principales {view === 'products' ? 'productos' : 'clientes'} del periodo</p></div>
              <div className="profit-chart-canvas">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartRows} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={value => `${value} €`} />
                    <Tooltip formatter={value => money(value)} contentStyle={{ border: 0, borderRadius: 12, boxShadow: '0 12px 35px rgba(15,23,42,.12)' }} />
                    <Bar dataKey="Ventas" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={34} />
                    <Bar dataKey="Costes" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={34} />
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
              <tr>
                <th>{view === 'products' ? 'Producto' : 'Cliente'}</th>
                <th>Unidades</th>
                <th>Ventas</th>
                <th>Coste directo</th>
                <th>Margen provisional</th>
                <th>Margen</th>
                <th>Cobertura</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
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
              {!rows.length && (
                <tr><td colSpan="7" className="profit-empty">No hay ventas entregadas en este periodo.</td></tr>
              )}
            </tbody>
          </table>
        </div>}
      </section>
    </div>
  );
}
