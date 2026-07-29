import { useMemo, useState } from 'react';
import { BarChart3, CircleDollarSign, Download, LayoutList, PackageCheck, Percent, TriangleAlert, X } from 'lucide-react';
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

export default function Profitability({ modal = false, onClose }) {
  const {
    orders, deliveryNotes, clients, products, productMovements, harvests,
    cropTypes, seedVarieties, articles, stockEntries, companyProfile
  } = useData();
  const [initialBounds] = useState(() => monthBounds());
  const [filterMode, setFilterMode] = useState('month');
  const [selectedMonth, setSelectedMonth] = useState(initialBounds.start.slice(0, 7));
  const [startDate, setStartDate] = useState(initialBounds.start);
  const [endDate, setEndDate] = useState(initialBounds.end);
  const [view, setView] = useState('products');
  const [displayMode, setDisplayMode] = useState('visual');
  const [query, setQuery] = useState('');
  const selectedBounds = filterMode === 'month'
    ? boundsForMonth(selectedMonth)
    : { start: startDate, end: endDate };

  const latestArticleUnitCost = articleId => {
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
  };

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
      productRows: finishedProducts,
      clientRows: finishedClients
    };
  }, [clients, deliveryNotes, harvests, orders, productMovements, products, selectedBounds.end, selectedBounds.start]);

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
  const packagingRows = (articles || [])
    .filter(article => article.type === 'ENVASE')
    .map(article => ({
      id: article.id,
      name: article.name,
      unitCost: latestArticleUnitCost(article.id),
      stock: (stockEntries || []).filter(entry => entry.articleId === article.id).reduce((sum, entry) => sum + Number(entry.quantity || 0), 0)
    }))
    .sort((a, b) => b.unitCost - a.unitCost);
  const baseRows = view === 'products'
    ? report.productRows
    : view === 'clients'
      ? report.clientRows
      : view === 'production'
        ? productionRows
        : packagingRows;
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  const rows = baseRows.filter(row => row.name.toLocaleLowerCase('es').includes(normalizedQuery));
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
      products: {
        title: 'Rentabilidad completa por producto',
        head: [['Producto', 'Uds.', 'Ventas', 'Venta trazada', 'Coste', 'Margen', '%', 'Sin coste']],
        body: rows.map(row => [row.name, row.units, money(row.revenue), money(row.tracedRevenue), money(row.cost), money(row.margin), `${row.marginPercent.toFixed(1)} %`, row.pendingUnits])
      },
      clients: {
        title: 'Ventas y rentabilidad por cliente',
        head: [['Cliente', 'Uds.', 'Ventas', 'Venta trazada', 'Coste', 'Margen', '%', 'Sin coste']],
        body: rows.map(row => [row.name, row.units, money(row.revenue), money(row.tracedRevenue), money(row.cost), money(row.margin), `${row.marginPercent.toFixed(1)} %`, row.pendingUnits])
      },
      production: {
        title: 'Costes de producción por variedad',
        head: [['Variedad / ficha', 'Semilla', 'Sustrato', 'Bandeja', 'Coste/bandeja', 'Coste/kg']],
        body: rows.map(row => [row.name, money(row.seedCost), money(row.substrateCost), money(row.trayCost), money(row.total), money(row.costPerKg)])
      },
      packaging: {
        title: 'Costes y existencias de envases',
        head: [['Envase', 'Último coste unitario', 'Stock actual']],
        body: rows.map(row => [row.name, money(row.unitCost), row.stock])
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
          <h1>Ventas y rentabilidad</h1>
          <p>Ingresos netos sin IVA y costes directos trazados de semilla, sustrato y envases.</p>
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

      <section className="profit-stats">
        <StatCard icon={<CircleDollarSign size={22} />} label="Ventas netas" value={money(report.revenue)} detail={`${report.units} unidades entregadas`} />
        <StatCard icon={<PackageCheck size={22} />} label="Costes directos" value={money(report.cost)} detail={`${report.costedUnits} unidades con coste`} tone="blue" />
        <StatCard icon={<BarChart3 size={22} />} label="Margen trazado" value={money(report.margin)} detail="Solo ventas con coste conocido" tone="purple" />
        <StatCard icon={<Percent size={22} />} label="Margen" value={`${report.marginPercent.toFixed(1)} %`} detail={`${report.coverage.toFixed(1)} % con coste trazado`} tone="amber" />
      </section>

      {report.pendingUnits > 0 && (
        <div className="profit-warning">
          <TriangleAlert size={20} />
          <div>
            <strong>{report.pendingUnits} unidades vendidas todavía no tienen coste trazable.</strong>
            <span>Se incluyen en ventas, pero quedan fuera del margen hasta conocer su coste real.</span>
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
              <button className={view === 'production' ? 'active' : ''} onClick={() => { setView('production'); setDisplayMode('detail'); }}>Coste variedades</button>
              <button className={view === 'packaging' ? 'active' : ''} onClick={() => { setView('packaging'); setDisplayMode('detail'); }}>Envases</button>
            </div>
            {(view === 'products' || view === 'clients') && <div className="profit-tabs">
              <button className={displayMode === 'visual' ? 'active' : ''} onClick={() => setDisplayMode('visual')}><BarChart3 size={15} /> Gráficas</button>
              <button className={displayMode === 'detail' ? 'active' : ''} onClick={() => setDisplayMode('detail')}><LayoutList size={15} /> Detalle</button>
            </div>}
            <input className="profit-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar…" />
          </div>
        </div>

        {displayMode === 'visual' && (view === 'products' || view === 'clients') ? (
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
              {(view === 'products' || view === 'clients') && <tr>
                <th>{view === 'products' ? 'Producto' : 'Cliente'}</th>
                <th>Unidades</th>
                <th>Ventas</th>
                <th>Coste directo</th>
                <th>Margen trazado</th>
                <th>Margen</th>
                <th>Cobertura</th>
              </tr>}
              {view === 'production' && <tr><th>Variedad / ficha</th><th>Semilla</th><th>Sustrato</th><th>Bandeja</th><th>Coste/bandeja</th><th>Coste/kg</th></tr>}
              {view === 'packaging' && <tr><th>Envase</th><th>Último coste unitario</th><th>Stock actual</th></tr>}
            </thead>
            <tbody>
              {(view === 'products' || view === 'clients') && rows.map(row => (
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
              {view === 'production' && rows.map(row => (
                <tr key={row.id}><td><strong>{row.name}</strong></td><td>{money(row.seedCost)}</td><td>{money(row.substrateCost)}</td><td>{money(row.trayCost)}</td><td><strong>{money(row.total)}</strong></td><td>{money(row.costPerKg)}</td></tr>
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
      </section>
    </div>
  );
  return modal
    ? <div className="profit-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>{content}</div>
    : content;
}
