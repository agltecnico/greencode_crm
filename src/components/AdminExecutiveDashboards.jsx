import { CircleDollarSign, PackageCheck, ShoppingBag, Sprout, TrendingDown, TrendingUp, Wheat } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const money = value => new Intl.NumberFormat('es-ES', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 2
}).format(Number(value || 0));

const short = value => String(value || '').length > 20 ? `${String(value).slice(0, 19)}…` : String(value || '');
const percent = value => `${Number(value || 0).toFixed(1)} %`;
const Empty = ({ children }) => <p className="executive-empty">{children}</p>;

export default function AdminExecutiveDashboards({ data, view, onViewChange, openOrders }) {
  const products = data.productSales.slice(0, 8).map(row => ({ ...row, shortName: short(row.name) }));
  const clients = data.allClients.slice(0, 8).map(row => ({ ...row, shortName: short(row.name) }));
  const varieties = data.profitabilityByVariety.slice(0, 8).map(row => ({ ...row, shortName: short(row.name) }));

  return <>
    <nav className="executive-dashboard-tabs" aria-label="Apartados del panel de administración">
      <button className={view === 'sales' ? 'active' : ''} onClick={() => onViewChange('sales')}><i><ShoppingBag /></i><span><small>01 · ACTIVIDAD COMERCIAL</small><strong>Ventas</strong><em>Pedidos, clientes y productos</em></span></button>
      <button className={view === 'production' ? 'active' : ''} onClick={() => onViewChange('production')}><i><Sprout /></i><span><small>02 · OPERACIONES</small><strong>Producción</strong><em>Próxima configuración</em></span></button>
      <button className={view === 'profitability' ? 'active' : ''} onClick={() => onViewChange('profitability')}><i><TrendingUp /></i><span><small>03 · RESULTADO</small><strong>Rentabilidad</strong><em>Próxima configuración</em></span></button>
    </nav>

    {view === 'sales' && <section className="executive-dashboard-view sales-dashboard-clean">
      <header><div><span>VENTAS</span><h2>Resumen comercial</h2><p>Todos los datos corresponden al periodo seleccionado.</p></div><button onClick={openOrders}>Abrir pedidos</button></header>

      <div className="sales-summary-grid">
        <article><span>Venta entregada</span><strong>{money(data.monthSales)}</strong><small>{data.orderCount} pedidos entregados</small></article>
        <article><span>Unidades vendidas</span><strong>{data.units}</strong><small>Mixes y variedades entregados</small></article>
        <article><span>Total de pedidos</span><strong>{money(data.requestedOrderValue)}</strong><small>{data.requestedOrderCount} pedidos · {data.requestedUnits} unidades</small></article>
      </div>

      <article className="executive-chart chart-green sales-evolution-chart">
        <header><div><h3>Ventas del periodo</h3><p>{data.periodLabel}</p></div><strong>{money(data.monthSales)}</strong></header>
        <div>{data.chart.some(row => row.Ventas > 0) ? <ResponsiveContainer><BarChart data={data.chart} margin={{ top: 8, right: 14, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis tickFormatter={value => `${value} €`}/><Tooltip formatter={money}/><Bar dataKey="Ventas" fill="#10b981" radius={[7,7,0,0]} maxBarSize={44}/>
        </BarChart></ResponsiveContainer> : <Empty>No hay ventas entregadas en estas fechas.</Empty>}</div>
      </article>

      <div className="sales-breakdown-grid">
        <article className="executive-chart chart-blue"><header><div><h3>Cantidad por producto</h3><p>Unidades vendidas de cada mix o variedad</p></div></header><div>{products.length ? <ResponsiveContainer><BarChart data={products} layout="vertical" margin={{ left: 4, right: 16 }}><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="shortName" width={110}/><Tooltip formatter={value => [`${value} uds.`, 'Cantidad']}/><Bar dataKey="units" name="Unidades" fill="#0ea5e9" radius={[0,6,6,0]}/></BarChart></ResponsiveContainer> : <Empty>Sin productos vendidos en estas fechas.</Empty>}</div></article>
        <article className="executive-chart chart-purple"><header><div><h3>Cantidad por cliente</h3><p>Importe y unidades entregadas a cada cliente</p></div></header><div>{clients.length ? <ResponsiveContainer><BarChart data={clients} layout="vertical" margin={{ left: 4, right: 16 }}><XAxis xAxisId="amount" type="number" hide/><XAxis xAxisId="units" type="number" hide/><YAxis type="category" dataKey="shortName" width={110}/><Tooltip formatter={(value, name) => name === 'Unidades' ? [`${value} uds.`, name] : [money(value), name]}/><Legend iconType="circle" iconSize={8}/><Bar xAxisId="amount" dataKey="total" name="Importe" fill="#8b5cf6" radius={[0,6,6,0]}/><Bar xAxisId="units" dataKey="units" name="Unidades" fill="#c4b5fd" radius={[0,6,6,0]}/></BarChart></ResponsiveContainer> : <Empty>Sin clientes con ventas en estas fechas.</Empty>}</div></article>
      </div>

      <article className="executive-variety-forecast period-orders-panel">
        <header><div><h3>Pedidos del periodo</h3><p>Importe total y cantidad solicitada de cada mix o variedad.</p></div><div className="period-orders-total"><span>{data.requestedOrderCount} pedidos</span><strong>{money(data.requestedOrderValue)}</strong><small>{data.requestedUnits} unidades</small></div></header>
        <div className="table-container"><table><thead><tr><th>Mix o variedad</th><th>Entregado</th><th>Pendiente</th><th>Total solicitado</th></tr></thead><tbody>
          {data.productDemand.map(row => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.deliveredUnits} uds.</td><td>{row.pendingUnits} uds.</td><td><strong>{row.totalUnits} uds.</strong></td></tr>)}
          {!data.productDemand.length && <tr><td colSpan="4" className="executive-variety-empty">No hay pedidos en estas fechas.</td></tr>}
        </tbody></table></div>
      </article>
    </section>}

    {view === 'production' && <section className="executive-dashboard-view production-dashboard-clean">
      <header><div><span>PRODUCCIÓN</span><h2>Cosechas del periodo</h2><p>Cultivos que se cosechan en estas fechas, aunque se hayan sembrado semanas antes.</p></div></header>
      <div className="production-summary-grid">
        <article><i><Sprout/></i><span>Bandejas para cosechar</span><strong>{data.plantedTotals.trays}</strong><small>{data.plantedByVariety.length} variedades</small></article>
        <article><i><Wheat/></i><span>Semillas utilizadas</span><strong>{data.plantedTotals.seedGrams.toFixed(1)} g</strong><small>{money(data.plantedTotals.seedCost)}</small></article>
        <article><i><PackageCheck/></i><span>Sustrato utilizado</span><strong>{data.plantedTotals.substrateLiters.toFixed(1)} L</strong><small>{money(data.plantedTotals.substrateCost)}</small></article>
        <article><i><CircleDollarSign/></i><span>Coste de producción</span><strong>{money(data.plantedTotals.totalCost)}</strong><small>Semillas, sustrato y bandejas</small></article>
        <article className="production-waste-card"><i><TrendingDown/></i><span>Bandejas descartadas</span><strong>{data.plantedTotals.discardedTrays}</strong><small>Merma de los cultivos cosechables</small></article>
      </div>
      <div className="production-content-grid">
        <article className="executive-chart chart-green"><header><div><h3>Bandejas por variedad</h3><p>Distribución de la cosecha prevista</p></div></header><div>{data.plantedByVariety.length ? <ResponsiveContainer><BarChart data={data.plantedByVariety.map(row => ({ ...row, shortName: short(row.name) }))} layout="vertical" margin={{ left: 5, right: 18 }}><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="shortName" width={115}/><Tooltip formatter={value => [`${value} bandejas`, 'Cosechables']}/><Bar dataKey="trays" name="Bandejas" fill="#10b981" radius={[0,7,7,0]}/></BarChart></ResponsiveContainer> : <Empty>No hay cosechas previstas en estas fechas.</Empty>}</div></article>
        <article className="executive-variety-forecast production-detail-table"><header><div><h3>Detalle por variedad</h3><p>Consumo y coste imputados a la semana de cosecha.</p></div><strong>{money(data.plantedTotals.totalCost)}</strong></header><div className="table-container"><table><thead><tr><th>Variedad</th><th>Bandejas</th><th>Semilla</th><th>Sustrato</th><th>Coste</th><th>Merma</th></tr></thead><tbody>
          {data.plantedByVariety.map(row => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{row.trays}</td><td>{row.seedGrams.toFixed(1)} g<small>{money(row.seedCost)}</small></td><td>{row.substrateLiters.toFixed(1)} L<small>{money(row.substrateCost)}</small></td><td><strong>{money(row.totalCost)}</strong></td><td>{row.discardedTrays} bdj.</td></tr>)}
          {!data.plantedByVariety.length && <tr><td colSpan="6" className="executive-variety-empty">No hay cosechas previstas en estas fechas.</td></tr>}
        </tbody></table></div></article>
      </div>
    </section>}

    {view === 'profitability' && <section className="executive-dashboard-view profitability-dashboard-clean">
      <header><div><span>RENTABILIDAD</span><h2>Resultado de las ventas del periodo</h2><p>Los costes proceden de los lotes vendidos; no de las siembras realizadas en las mismas fechas.</p></div></header>
      <div className="profitability-summary-grid">
        <article><span>Ventas entregadas</span><strong>{money(data.monthSales)}</strong><small>{data.units} unidades</small></article>
        <article><span>Coste de lo vendido</span><strong>{money(data.totalCost)}</strong><small>Producción, táperes y etiquetas</small></article>
        <article className={data.margin >= 0 ? 'is-positive' : 'is-negative'}><span>Beneficio bruto trazado</span><strong>{money(data.margin)}</strong><small>{data.marginPercent.toFixed(1)} % de margen</small></article>
        <article><span>Cobertura del cálculo</span><strong>{data.costCoverage.toFixed(1)} %</strong><small>{data.exactCostedUnits} uds. exactas · {data.estimatedCostUnits} estimadas</small></article>
      </div>
      <div className="profitability-percent-grid">
        <article><span>Coste total / ventas</span><strong>{percent(data.costPercent)}</strong><small>Parte de la venta consumida por el coste completo</small></article>
        <article><span>Cultivo / ventas</span><strong>{percent(data.cultivationPercent)}</strong><small>Semilla, sustrato y bandejas cosechadas</small></article>
        <article><span>Envases y etiquetas / ventas</span><strong>{percent(data.packingPercent)}</strong><small>Coste de preparación de las unidades vendidas</small></article>
        <article className={data.operatingResult >= 0 ? 'is-positive' : 'is-negative'}><span>Margen después de gastos</span><strong>{percent(data.operatingMarginPercent)}</strong><small>{money(data.operatingResult)} tras gastos generales</small></article>
      </div>
      <div className="profitability-balance-grid">
        <article><span>Producción cosechada</span><strong>{data.harvestBalance.producedUnits} uds.</strong></article>
        <article><span>Vinculado a pedidos</span><strong>{data.harvestBalance.linkedUnits} uds.</strong></article>
        <article className="is-warning"><span>Sobrante de cosechas</span><strong>{data.harvestBalance.leftoverUnits} uds.</strong></article>
        <article className="is-warning"><span>Merma de bandejas</span><strong>{data.plantedTotals.discardedTrays} bdj.</strong></article>
      </div>
      <div className="sales-breakdown-grid">
        <article className="executive-chart chart-green"><header><div><h3>Rentabilidad por producto</h3><p>Ventas, coste completo y beneficio trazado</p></div></header><div>{products.length ? <ResponsiveContainer><BarChart data={products} layout="vertical" margin={{ left: 4, right: 16 }}><XAxis type="number" hide/><YAxis type="category" dataKey="shortName" width={110}/><Tooltip formatter={money}/><Legend iconType="circle" iconSize={8}/><Bar dataKey="total" name="Ventas" fill="#10b981" radius={[0,6,6,0]}/><Bar dataKey="cost" name="Coste" fill="#f59e0b" radius={[0,6,6,0]}/><Bar dataKey="margin" name="Beneficio" fill="#8b5cf6" radius={[0,6,6,0]}/></BarChart></ResponsiveContainer> : <Empty>Sin ventas en estas fechas.</Empty>}</div></article>
        <article className="executive-chart chart-blue"><header><div><h3>Rentabilidad por cliente</h3><p>Margen generado por las compras de cada cliente</p></div></header><div>{clients.length ? <ResponsiveContainer><BarChart data={clients} layout="vertical" margin={{ left: 4, right: 16 }}><XAxis type="number" hide/><YAxis type="category" dataKey="shortName" width={110}/><Tooltip formatter={money}/><Bar dataKey="margin" name="Beneficio" fill="#0ea5e9" radius={[0,6,6,0]}/></BarChart></ResponsiveContainer> : <Empty>Sin ventas trazables en estas fechas.</Empty>}</div></article>
      </div>
      <div className="profitability-detail-grid">
        <article className="executive-variety-forecast"><header><div><h3>Por variedad</h3><p>Participación proporcional en productos y mixes vendidos.</p></div></header><div className="table-container"><table><thead><tr><th>Variedad</th><th>Ventas</th><th>Coste</th><th>Beneficio</th><th>Margen</th></tr></thead><tbody>
          {varieties.map(row => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{money(row.total)}</td><td>{money(row.cost)}</td><td className={row.margin >= 0 ? 'profit-value-positive' : 'profit-value-negative'}>{money(row.margin)}</td><td><strong>{percent(row.marginPercent)}</strong></td></tr>)}
          {!varieties.length && <tr><td colSpan="5" className="executive-variety-empty">Sin variedades vendidas en estas fechas.</td></tr>}
        </tbody></table></div></article>
        <article className="executive-variety-forecast"><header><div><h3>Por producto</h3><p>Rentabilidad de cada formato o mix.</p></div></header><div className="table-container"><table><thead><tr><th>Producto</th><th>Ventas</th><th>Coste</th><th>Beneficio</th><th>Margen</th></tr></thead><tbody>
          {products.map(row => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{money(row.total)}</td><td>{money(row.cost)}</td><td className={row.margin >= 0 ? 'profit-value-positive' : 'profit-value-negative'}>{money(row.margin)}</td><td><strong>{percent(row.marginPercent)}</strong></td></tr>)}
          {!products.length && <tr><td colSpan="5" className="executive-variety-empty">Sin productos vendidos en estas fechas.</td></tr>}
        </tbody></table></div></article>
        <article className="executive-variety-forecast profitability-client-detail"><header><div><h3>Por cliente</h3><p>Qué margen deja la facturación de cada cliente.</p></div></header><div className="table-container"><table><thead><tr><th>Cliente</th><th>Ventas</th><th>Coste</th><th>Beneficio</th><th>Margen</th></tr></thead><tbody>
          {clients.map(row => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{money(row.total)}</td><td>{money(row.cost)}</td><td className={row.margin >= 0 ? 'profit-value-positive' : 'profit-value-negative'}>{money(row.margin)}</td><td><strong>{percent(row.marginPercent)}</strong></td></tr>)}
          {!clients.length && <tr><td colSpan="5" className="executive-variety-empty">Sin clientes con ventas en estas fechas.</td></tr>}
        </tbody></table></div></article>
      </div>
    </section>}
  </>;
}
