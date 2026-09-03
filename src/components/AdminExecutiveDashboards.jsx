import { BarChart3, CircleDollarSign, Clock3, PackageCheck, ShoppingBag, Sprout, TrendingUp, Users, WalletCards } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

const money = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(value || 0));
const colors = ['#10b981', '#0ea5e9', '#8b5cf6', '#f59e0b', '#f43f5e', '#64748b'];
const short = value => String(value || '').length > 20 ? `${String(value).slice(0, 19)}…` : String(value || '');

const Kpi = ({ icon, label, value, detail, tone = 'green', onClick }) => (
  <button type="button" className={`executive-kpi executive-kpi-${tone}`} onClick={onClick}>
    <i>{icon}</i><span>{label}</span><strong>{value}</strong><small>{detail}</small>
  </button>
);

const Empty = ({ children }) => <p className="executive-empty">{children}</p>;

const OrderStat = ({ icon, label, value, detail, tone, onClick }) => (
  <button type="button" className={`executive-order-stat order-stat-${tone}`} onClick={onClick}>
    <i>{icon}</i><span>{label}</span><strong>{value}</strong><small>{detail}</small>
  </button>
);

export default function AdminExecutiveDashboards({ data, view, onViewChange, openFinancial, openOrders }) {
  const topProducts = data.productSales.slice(0, 6).map(row => ({ ...row, shortName: short(row.name) }));
  const topClients = data.allClients.slice(0, 6).map(row => ({ ...row, shortName: short(row.name) }));
  const profitableProducts = data.productSales.filter(row => row.costedUnits > 0).sort((a, b) => b.margin - a.margin).slice(0, 6).map(row => ({ ...row, shortName: short(row.name) }));
  const profitableClients = data.allClients.filter(row => row.costedUnits > 0).sort((a, b) => b.margin - a.margin).slice(0, 6).map(row => ({ ...row, shortName: short(row.name) }));
  const productionVarieties = data.productionByVariety.slice(0, 7).map(row => ({ ...row, shortName: short(row.name) }));
  const harvestedProducts = data.harvestCostByProduct.slice(0, 7).map(row => ({ ...row, shortName: short(row.name) }));
  const productionTotal = data.productionExpenses + data.activeHarvestCostInPeriod;

  return <>
    <nav className="executive-dashboard-tabs" aria-label="Dashboards de administración">
      <button className={view === 'sales' ? 'active' : ''} onClick={() => onViewChange('sales')}><i><ShoppingBag /></i><span><small>01 · ACTIVIDAD COMERCIAL</small><strong>Ventas</strong><em>Pedidos, clientes y productos</em></span></button>
      <button className={view === 'production' ? 'active' : ''} onClick={() => onViewChange('production')}><i><Sprout /></i><span><small>02 · OPERACIONES</small><strong>Producción</strong><em>Cultivos, cosechas y costes</em></span></button>
      <button className={view === 'profitability' ? 'active' : ''} onClick={() => onViewChange('profitability')}><i><TrendingUp /></i><span><small>03 · RESULTADO</small><strong>Rentabilidad</strong><em>Margen y resultado de la empresa</em></span></button>
    </nav>

    {view === 'sales' && <section className="executive-dashboard-view">
      <header><div><span>CONTROL DE PEDIDOS</span><h2>Ventas y previsión del periodo</h2><p>{data.periodLabel} · Entregado, pendiente y necesidad total de producto.</p></div><button onClick={openOrders}>Abrir pedidos</button></header>
      <div className="executive-order-control">
        <OrderStat icon={<PackageCheck />} label="Venta entregada" value={money(data.requestedDeliveredValue)} detail={`${data.requestedDeliveredCount} pedidos · ${data.requestedDeliveredUnits} unidades`} tone="green" onClick={openOrders} />
        <OrderStat icon={<Clock3 />} label="Pendiente de entregar" value={money(data.pendingOrderValue)} detail={`${data.pendingOrders} pedidos · ${data.pendingOrderUnits} unidades`} tone="red" onClick={openOrders} />
        <OrderStat icon={<ShoppingBag />} label="Previsión total" value={money(data.requestedOrderValue)} detail={`${data.requestedOrderCount} pedidos · ${data.requestedUnits} unidades`} tone="purple" onClick={openOrders} />
        <OrderStat icon={<TrendingUp />} label="Periodo completado" value={`${data.requestedOrderCount ? Math.round((data.requestedDeliveredCount / data.requestedOrderCount) * 100) : 0} %`} detail="Pedidos entregados sobre el total" tone="blue" onClick={openOrders} />
      </div>
      <div className="executive-kpis">
        <Kpi icon={<CircleDollarSign />} label="Ventas entregadas" value={money(data.monthSales)} detail={`${data.orderCount} pedidos entregados en el periodo`} onClick={() => openFinancial('orders')} />
        <Kpi icon={<ShoppingBag />} label="Venta solicitada" value={money(data.requestedOrderValue)} detail={`${data.requestedOrderCount} pedidos · ${data.requestedUnits} unidades`} tone="purple" onClick={openOrders} />
        <Kpi icon={<Sprout />} label="Coste de cultivo" value={money(data.cultivationExpenses)} detail={`Semillas ${money(data.seedExpenses)} · sustrato ${money(data.substrateExpenses)} · cultivos en marcha ${money(data.activeHarvestCostInPeriod)}`} tone="amber" onClick={() => openFinancial('cultivations')} />
        <Kpi icon={<PackageCheck />} label="Coste de envasado" value={money(data.packingExpenses)} detail={`Táperes ${money(data.packagingExpenses)} · etiquetas ${money(data.labelExpenses)}`} tone="blue" onClick={() => openFinancial('packaging')} />
        <Kpi icon={<TrendingUp />} label="Margen bruto" value={money(data.margin)} detail={`${data.marginPercent.toFixed(1)} % sobre venta trazada`} onClick={() => openFinancial('profit-products')} />
        <Kpi icon={<BarChart3 />} label="Producto principal" value={topProducts[0]?.name || '—'} detail={topProducts[0] ? `${topProducts[0].units} túperes · ${money(topProducts[0].total)}` : 'Sin ventas'} tone="amber" onClick={() => openFinancial('products')} />
        <Kpi icon={<Users />} label="Cliente principal" value={topClients[0]?.name || '—'} detail={topClients[0] ? `${topClients[0].units} túperes · ${money(topClients[0].total)}` : 'Sin ventas'} tone="blue" onClick={() => openFinancial('clients')} />
      </div>
      <div className="executive-charts executive-sales-charts">
        <article className="executive-chart chart-green"><header><div><h3>Ventas y costes de producción</h3><p>Cultivo en fecha prevista · envase y etiqueta al cosechar</p></div><strong>{money(data.monthSales)}</strong></header><div>{data.chart.some(row => row.Ventas > 0 || row['Coste cultivo'] > 0 || row.Envases > 0 || row.Etiquetas > 0) ? <ResponsiveContainer><BarChart data={data.chart}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis tickFormatter={value => `${value} €`}/><Tooltip formatter={money}/><Legend iconType="circle" iconSize={8}/><Bar dataKey="Ventas" fill="#10b981" radius={[5,5,0,0]}/><Bar dataKey="Coste cultivo" stackId="production" fill="#f59e0b"/><Bar dataKey="Envases" stackId="production" fill="#0ea5e9"/><Bar dataKey="Etiquetas" stackId="production" fill="#8b5cf6" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <Empty>Sin ventas ni costes de producción en este periodo.</Empty>}</div></article>
        <article className="executive-chart chart-blue"><header><div><h3>Variedades más vendidas</h3><p>Facturación exterior · túperes interior</p></div></header><div>{topProducts.length ? <ResponsiveContainer><PieChart><Pie data={topProducts} dataKey="total" nameKey="shortName" name="Facturación" innerRadius={57} outerRadius={84} paddingAngle={3}>{topProducts.map((row,index)=><Cell key={`sales-${row.name}`} fill={colors[index%colors.length]}/>)}</Pie><Pie data={topProducts} dataKey="units" nameKey="shortName" name="Túperes" innerRadius={34} outerRadius={50} paddingAngle={3}>{topProducts.map((row,index)=><Cell key={`units-${row.name}`} fill={colors[index%colors.length]} opacity={.65}/>)}</Pie><Tooltip formatter={(value, name, entry) => [entry?.dataKey === 'units' ? `${value} túperes` : money(value), name]}/><Legend iconType="circle" iconSize={8}/></PieChart></ResponsiveContainer> : <Empty>Sin productos vendidos.</Empty>}</div></article>
        <article className="executive-chart chart-purple"><header><div><h3>Clientes principales</h3><p>Importe y túperes por cliente</p></div></header><div>{topClients.length ? <ResponsiveContainer><BarChart data={topClients} layout="vertical"><XAxis xAxisId="sales" type="number" hide/><XAxis xAxisId="units" type="number" hide/><YAxis type="category" dataKey="shortName" width={98}/><Tooltip formatter={(value, name) => name === 'Túperes' ? [`${value} túperes`, name] : [money(value), name]}/><Legend iconType="circle" iconSize={8}/><Bar xAxisId="sales" dataKey="total" name="Facturación" fill="#8b5cf6" radius={[0,6,6,0]}/><Bar xAxisId="units" dataKey="units" name="Túperes" fill="#0ea5e9" radius={[0,6,6,0]}/></BarChart></ResponsiveContainer> : <Empty>Sin clientes con ventas.</Empty>}</div></article>
      </div>
      <article className="executive-variety-forecast">
        <header><div><h3>Pedidos por producto</h3><p>Cantidad de cada producto entregada y pendiente dentro del periodo seleccionado.</p></div><strong>{data.requestedUnits} uds. previstas</strong></header>
        <div className="table-container">
          <table>
            <thead><tr><th>Producto</th><th>Entregado</th><th>Pendiente</th><th>Total previsto</th></tr></thead>
            <tbody>
              {data.productDemand.map(row => <tr key={row.id}><td><strong>{row.name}</strong></td><td>{row.deliveredUnits} uds.</td><td>{row.pendingUnits} uds.</td><td><strong>{row.totalUnits} uds.</strong></td></tr>)}
              {!data.productDemand.length && <tr><td colSpan="4" className="executive-variety-empty">No hay pedidos en este periodo.</td></tr>}
            </tbody>
          </table>
        </div>
      </article>
    </section>}

    {view === 'production' && <section className="executive-dashboard-view">
      <header><div><span>PRODUCCIÓN</span><h2>Coste y rendimiento de los cultivos</h2><p>Inversión en marcha, cosechas terminadas y materiales consumidos.</p></div><button onClick={() => openFinancial('harvests')}>Abrir control de producción</button></header>
      <div className="executive-kpis">
        <Kpi icon={<Sprout />} label="Coste productivo total" value={money(productionTotal)} detail="En marcha + cosechado y envasado" tone="amber" onClick={() => openFinancial('harvests')} />
        <Kpi icon={<Sprout />} label="Cultivos en marcha" value={money(data.activeHarvestCostInPeriod)} detail={`${data.activeHarvestCountInPeriod} cultivos con cosecha en el periodo`} tone="purple" onClick={() => openFinancial('cultivations')} />
        <Kpi icon={<PackageCheck />} label="Producción terminada" value={money(data.productionExpenses)} detail={`${data.seedExpenses + data.substrateExpenses > 0 ? 'Cultivo trazado' : 'Sin cosechas registradas'}`} tone="blue" onClick={() => openFinancial('harvests')} />
        <Kpi icon={<PackageCheck />} label="Envasado" value={money(data.packagingExpenses + data.labelExpenses)} detail={`Táperes ${money(data.packagingExpenses)} · etiquetas ${money(data.labelExpenses)}`} onClick={() => openFinancial('harvests')} />
        <Kpi icon={<BarChart3 />} label="Cultivo con mayor coste" value={productionVarieties[0]?.name || '—'} detail={productionVarieties[0] ? `${productionVarieties[0].trays} bandejas · ${money(productionVarieties[0].cost)}` : 'Sin cultivos previstos'} tone="amber" onClick={() => openFinancial('varietycosts')} />
        <Kpi icon={<PackageCheck />} label="Producto cosechado principal" value={harvestedProducts[0]?.name || '—'} detail={harvestedProducts[0] ? `${harvestedProducts[0].units} uds. · ${money(harvestedProducts[0].cost)}` : 'Sin cosechas'} tone="blue" onClick={() => openFinancial('harvests')} />
      </div>
      <div className="executive-charts">
        <article className="executive-chart chart-amber"><header><div><h3>Distribución del coste</h3><p>Materiales y envasado</p></div></header><div>{data.productionBreakdown.some(row => row.value > 0) ? <ResponsiveContainer><PieChart><Pie data={data.productionBreakdown.filter(row => row.value > 0)} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={4}>{data.productionBreakdown.filter(row => row.value > 0).map((row,index)=><Cell key={row.name} fill={colors[index%colors.length]}/>)}</Pie><Tooltip formatter={money}/><Legend iconType="circle" iconSize={8}/></PieChart></ResponsiveContainer> : <Empty>Sin costes productivos en el periodo.</Empty>}</div></article>
        <article className="executive-chart chart-purple"><header><div><h3>Cultivos en marcha</h3><p>Coste previsto por variedad</p></div></header><div>{productionVarieties.length ? <ResponsiveContainer><BarChart data={productionVarieties} layout="vertical"><XAxis type="number" hide/><YAxis type="category" dataKey="shortName" width={105}/><Tooltip formatter={money}/><Bar dataKey="cost" name="Coste" radius={[0,7,7,0]}>{productionVarieties.map((row,index)=><Cell key={row.name} fill={colors[index%colors.length]}/>)}</Bar></BarChart></ResponsiveContainer> : <Empty>No hay cosechas previstas en el periodo.</Empty>}</div></article>
        <article className="executive-chart chart-green"><header><div><h3>Producción terminada</h3><p>Coste real por producto cosechado</p></div></header><div>{harvestedProducts.length ? <ResponsiveContainer><BarChart data={harvestedProducts} layout="vertical"><XAxis type="number" hide/><YAxis type="category" dataKey="shortName" width={105}/><Tooltip formatter={money}/><Bar dataKey="cost" name="Coste" radius={[0,7,7,0]}>{harvestedProducts.map((row,index)=><Cell key={row.name} fill={colors[(index+1)%colors.length]}/>)}</Bar></BarChart></ResponsiveContainer> : <Empty>Sin cosechas terminadas en el periodo.</Empty>}</div></article>
      </div>
    </section>}

    {view === 'profitability' && <section className="executive-dashboard-view">
      <header><div><span>RENTABILIDAD GENERAL</span><h2>Resultado económico del periodo</h2><p>Margen comercial, gastos generales, cobros y resultado operativo trazado.</p></div><button onClick={() => openFinancial('summary')}>Abrir centro financiero</button></header>
      <div className="executive-kpis">
        <Kpi icon={<CircleDollarSign />} label="Ventas trazadas" value={money(data.tracedRevenue)} detail={`${data.costCoverage.toFixed(1)} % de cobertura`} onClick={() => openFinancial('profit-products')} />
        <Kpi icon={<PackageCheck />} label="Coste vendido" value={money(data.totalCost)} detail="Coste asociado a unidades vendidas" tone="blue" onClick={() => openFinancial('profit-products')} />
        <Kpi icon={<TrendingUp />} label="Margen bruto" value={money(data.margin)} detail={`${data.marginPercent.toFixed(1)} %`} onClick={() => openFinancial('profit-products')} />
        <Kpi icon={<WalletCards />} label="Gastos generales" value={money(data.generalExpensesTotal)} detail={`${money(data.paidExpenses)} pagado · ${money(data.pendingExpenses)} pendiente`} tone="amber" onClick={() => openFinancial('expenses')} />
        <Kpi icon={<BarChart3 />} label="Resultado operativo" value={money(data.operatingResult)} detail="Margen bruto menos gastos generales" tone={data.operatingResult >= 0 ? 'green' : 'red'} onClick={() => openFinancial('summary')} />
        <Kpi icon={<CircleDollarSign />} label="Pendiente de cobro" value={money(data.pendingCollection)} detail={`${data.pendingInvoiceCount} facturas · ${money(data.unbilledSales)} sin facturar`} tone="purple" onClick={() => openFinancial('receivables')} />
      </div>
      <div className="executive-charts executive-profit-charts">
        <article className="executive-chart chart-green"><header><div><h3>Ventas, coste y gastos</h3><p>Evolución económica del periodo</p></div><strong>{money(data.operatingResult)}</strong></header><div>{data.chart.some(row => row.Ventas || row['Coste vendido'] || row['Gastos generales']) ? <ResponsiveContainer><BarChart data={data.chart}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name"/><YAxis tickFormatter={value => `${value} €`}/><Tooltip formatter={money}/><Legend/><Bar dataKey="Ventas" fill="#10b981" radius={[5,5,0,0]}/><Bar dataKey="Coste vendido" fill="#0ea5e9" radius={[5,5,0,0]}/><Bar dataKey="Gastos generales" fill="#f59e0b" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <Empty>Sin movimientos económicos en el periodo.</Empty>}</div></article>
        <article className="executive-chart"><header><div><h3>Productos más rentables</h3><p>Margen bruto trazado</p></div></header><div>{profitableProducts.length ? <ResponsiveContainer><BarChart data={profitableProducts} layout="vertical"><XAxis type="number" hide/><YAxis type="category" dataKey="shortName" width={115}/><Tooltip formatter={money}/><Bar dataKey="margin" name="Margen" fill="#8b5cf6" radius={[0,7,7,0]}/></BarChart></ResponsiveContainer> : <Empty>Falta trazabilidad de costes.</Empty>}</div></article>
        <article className="executive-chart"><header><div><h3>Clientes más rentables</h3><p>Margen bruto por cliente</p></div></header><div>{profitableClients.length ? <ResponsiveContainer><BarChart data={profitableClients} layout="vertical"><XAxis type="number" hide/><YAxis type="category" dataKey="shortName" width={115}/><Tooltip formatter={money}/><Bar dataKey="margin" name="Margen" fill="#0ea5e9" radius={[0,7,7,0]}/></BarChart></ResponsiveContainer> : <Empty>Falta trazabilidad de costes.</Empty>}</div></article>
      </div>
    </section>}
  </>;
}
