import React, { useMemo, useState } from 'react';
import {
  ArrowDown, Building2, CalendarDays, CheckCircle2, ClipboardList,
  Factory, Leaf, PackageCheck, Search, Sprout, ShoppingBag,
  Thermometer, Truck, UserRound, Waves, XCircle
} from 'lucide-react';
import { useData } from '../context/DataContext';
import './TraceabilityExplorer.css';

const normalize = value => String(value ?? '').trim().toLocaleLowerCase('es');
const formatDate = value => {
  if (!value) return 'Sin fecha';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    return new Date(`${value}T12:00:00`).toLocaleDateString('es-ES', { dateStyle: 'medium' });
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Sin fecha'
    : date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
};
const Stage = ({ icon, eyebrow, title, tone, children, empty }) => (
  <section className={`trace-stage trace-stage--${tone}`}>
    <div className="trace-stage__heading">
      <span className="trace-stage__icon">{React.createElement(icon, { size: 24 })}</span>
      <div>
        <span>{eyebrow}</span>
        <h3>{title}</h3>
      </div>
    </div>
    {empty ? <div className="trace-empty"><XCircle size={20} /> {empty}</div> : children}
  </section>
);

const FlowArrow = ({ label }) => (
  <div className="trace-arrow" aria-hidden="true">
    <span>{label}</span>
    <ArrowDown size={30} strokeWidth={2.5} />
  </div>
);

const InfoCard = ({ icon, title, badge, children, accent = 'green' }) => (
  <article className={`trace-info trace-info--${accent}`}>
    <div className="trace-info__top">
      <span className="trace-info__icon">{React.createElement(icon, { size: 20 })}</span>
      {badge && <span className="trace-chip">{badge}</span>}
    </div>
    <h4>{title}</h4>
    <div className="trace-info__body">{children}</div>
  </article>
);

export default function TraceabilityExplorer() {
  const {
    providers, seedVarieties, articles, stockLots, purchaseDeliveryNotes,
    purchaseDeliveryNoteLines, cropTypes, crops, harvests, productMovements,
    products, orders, clients, deliveryNotes, dailyLogs
  } = useData();
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState(null);

  const indexes = useMemo(() => ({
    providers: new Map((providers || []).map(item => [String(item.id), item])),
    articles: new Map((articles || []).map(item => [String(item.id), item])),
    varieties: new Map((seedVarieties || []).map(item => [String(item.id), item])),
    cropTypes: new Map((cropTypes || []).map(item => [String(item.id), item])),
    products: new Map((products || []).map(item => [String(item.id), item])),
    clients: new Map((clients || []).map(item => [String(item.id), item])),
    orders: new Map((orders || []).map(item => [String(item.id), item])),
    noteLines: new Map((purchaseDeliveryNoteLines || []).map(item => [String(item.id), item])),
    purchaseNotes: new Map((purchaseDeliveryNotes || []).map(item => [String(item.id), item]))
  }), [providers, articles, seedVarieties, cropTypes, products, clients, orders, purchaseDeliveryNoteLines, purchaseDeliveryNotes]);

  const candidates = useMemo(() => {
    const items = [];
    (stockLots || []).forEach(lot => {
      const article = indexes.articles.get(String(lot.articleId));
      const provider = indexes.providers.get(String(lot.providerId));
      items.push({
        key: `supplier:${lot.id}`, type: 'supplier', id: lot.id,
        title: lot.supplierBatch || lot.id,
        subtitle: `${article?.name || 'Semilla'} · ${provider?.name || 'Proveedor sin identificar'}`,
        search: [lot.id, lot.supplierBatch, article?.name, provider?.name].join(' ')
      });
    });
    (crops || []).forEach(crop => {
      const cropType = indexes.cropTypes.get(String(crop.cropTypeId));
      items.push({
        key: `crop:${crop.id}`, type: 'crop', id: crop.id,
        title: crop.cultivationBatchNumber || crop.batchNumber || crop.id,
        subtitle: `${cropType?.name || 'Cultivo'} · ${formatDate(crop.datePlanted)}`,
        search: [crop.id, crop.batchNumber, crop.cultivationBatchNumber, crop.seedSupplierBatch, cropType?.name].join(' ')
      });
    });
    (harvests || []).forEach(harvest => {
      const product = indexes.products.get(String(harvest.productId));
      items.push({
        key: `harvest:${harvest.id}`, type: 'harvest', id: harvest.id,
        title: harvest.batchNumber || harvest.id,
        subtitle: `${product?.name || 'Producto'} · ${formatDate(harvest.harvestDate)}`,
        search: [harvest.id, harvest.batchNumber, product?.name].join(' ')
      });
    });
    (orders || []).forEach(order => {
      const client = indexes.clients.get(String(order.clientId));
      items.push({
        key: `order:${order.id}`, type: 'order', id: order.id,
        title: order.orderNumber || order.id,
        subtitle: `Pedido · ${client?.commercialName || client?.name || order.clientName || 'Cliente'}`,
        search: [order.id, order.orderNumber, client?.name, client?.commercialName, order.clientName].join(' ')
      });
    });
    return items;
  }, [stockLots, crops, harvests, orders, indexes]);

  const visibleCandidates = useMemo(() => {
    const term = normalize(query);
    if (!term) return candidates.slice().reverse().slice(0, 8);
    return candidates.filter(item => normalize(item.search).includes(term)).slice(0, 30);
  }, [candidates, query]);

  const trace = useMemo(() => {
    if (!selection) return null;
    let relatedCrops = [];
    let relatedHarvests = [];
    let relatedOrders = [];

    if (selection.type === 'supplier') {
      relatedCrops = (crops || []).filter(crop =>
        String(crop.seedStockLotId) === String(selection.id)
      );
    }
    if (selection.type === 'crop') {
      relatedCrops = (crops || []).filter(crop => String(crop.id) === String(selection.id));
    }
    if (selection.type === 'harvest') {
      relatedHarvests = (harvests || []).filter(harvest => String(harvest.id) === String(selection.id));
      const cropIds = new Set(relatedHarvests.flatMap(harvest => harvest.selectedCropIds || []).map(String));
      relatedCrops = (crops || []).filter(crop => cropIds.has(String(crop.id)));
    }
    if (selection.type === 'order') {
      relatedOrders = (orders || []).filter(order => String(order.id) === String(selection.id));
      const batchNumbers = new Set(
        (productMovements || [])
          .filter(movement => movement.type === 'ORDER' && String(movement.referenceId || '').split('|')[0] === String(selection.id))
          .map(movement => String(movement.referenceId || '').split('|')[1])
          .filter(Boolean)
      );
      relatedHarvests = (harvests || []).filter(harvest => batchNumbers.has(String(harvest.batchNumber)));
      const cropIds = new Set(relatedHarvests.flatMap(harvest => harvest.selectedCropIds || []).map(String));
      relatedCrops = (crops || []).filter(crop => cropIds.has(String(crop.id)));
    }

    if (!relatedHarvests.length && relatedCrops.length) {
      const cropIds = new Set(relatedCrops.map(crop => String(crop.id)));
      relatedHarvests = (harvests || []).filter(harvest =>
        (harvest.selectedCropIds || []).some(id => cropIds.has(String(id)))
      );
    }
    if (!relatedCrops.length && relatedHarvests.length) {
      const cropIds = new Set(relatedHarvests.flatMap(harvest => harvest.selectedCropIds || []).map(String));
      relatedCrops = (crops || []).filter(crop => cropIds.has(String(crop.id)));
    }
    if (!relatedOrders.length && relatedHarvests.length) {
      const batches = new Set(relatedHarvests.map(harvest => String(harvest.batchNumber)));
      const orderIds = new Set(
        (productMovements || [])
          .filter(movement => movement.type === 'ORDER' && batches.has(String(movement.referenceId || '').split('|')[1]))
          .map(movement => String(movement.referenceId || '').split('|')[0])
      );
      relatedOrders = (orders || []).filter(order => orderIds.has(String(order.id)));
    }

    const lotIds = new Set(relatedCrops.map(crop => String(crop.seedStockLotId || '')).filter(Boolean));
    const relatedLots = (stockLots || []).filter(lot => lotIds.has(String(lot.id)));
    const noteLineIds = new Set(relatedLots.map(lot => String(lot.deliveryNoteLineId || '')).filter(Boolean));
    const relatedLines = (purchaseDeliveryNoteLines || []).filter(line => noteLineIds.has(String(line.id)));
    const purchaseNoteIds = new Set(relatedLines.map(line => String(line.deliveryNoteId || '')).filter(Boolean));
    const relatedPurchaseNotes = (purchaseDeliveryNotes || []).filter(note => purchaseNoteIds.has(String(note.id)));

    const startDates = relatedCrops.map(crop => new Date(crop.datePlanted)).filter(date => !Number.isNaN(date.getTime()));
    const endDates = relatedHarvests.map(harvest => new Date(harvest.harvestDate)).filter(date => !Number.isNaN(date.getTime()));
    const start = startDates.length ? new Date(Math.min(...startDates)) : null;
    const end = endDates.length ? new Date(Math.max(...endDates)) : new Date();
    const environmental = (dailyLogs || []).filter(log => {
      const date = new Date(log.date);
      return start && !Number.isNaN(date.getTime()) && date >= start && date <= end;
    });

    return { relatedCrops, relatedHarvests, relatedOrders, relatedLots, relatedLines, relatedPurchaseNotes, environmental };
  }, [selection, crops, harvests, orders, productMovements, stockLots, purchaseDeliveryNoteLines, purchaseDeliveryNotes, dailyLogs]);

  const environmentalStats = useMemo(() => {
    const logs = trace?.environmental || [];
    const temperatures = logs.map(log => Number(log.temperature)).filter(Number.isFinite);
    const humidities = logs.map(log => Number(log.humidity)).filter(Number.isFinite);
    const stats = values => values.length ? {
      min: Math.min(...values), max: Math.max(...values),
      avg: values.reduce((sum, value) => sum + value, 0) / values.length
    } : null;
    return { temperature: stats(temperatures), humidity: stats(humidities) };
  }, [trace]);

  const traceCompleteness = useMemo(() => {
    if (!trace) return 0;
    const checks = [
      trace.relatedLots.length > 0,
      trace.relatedCrops.every(crop => Boolean(crop.seedStockLotId)),
      trace.relatedCrops.length > 0,
      trace.relatedHarvests.length > 0,
      trace.relatedOrders.length > 0
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }, [trace]);

  return (
    <div className="trace-page">
      <header className="trace-hero">
        <div>
          <span className="trace-kicker">CONTROL SANITARIO · TRAZABILIDAD 360º</span>
          <h1>Del proveedor al cliente. Y del cliente hasta la semilla.</h1>
          <p>Busca cualquier lote, cultivo, cosecha, pedido o cliente y reconstruye todo su recorrido.</p>
        </div>
        <div className="trace-seal">
          <CheckCircle2 size={34} />
          <strong>Cadena verificable</strong>
          <span>Datos conectados en tiempo real</span>
        </div>
      </header>

      <section className="trace-search-panel">
        <Search size={25} />
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Ej.: lote proveedor, CULT-..., L-..., pedido o cliente"
          aria-label="Buscar trazabilidad"
        />
        {query && <button type="button" onClick={() => { setQuery(''); setSelection(null); }}><XCircle size={20} /> Limpiar</button>}
      </section>

      <div className="trace-results">
        <div className="trace-results__title">
          <span>{query ? `${visibleCandidates.length} coincidencias` : 'Registros recientes'}</span>
          <small>Selecciona un registro para desplegar su recorrido completo</small>
        </div>
        <div className="trace-result-grid">
          {visibleCandidates.map(candidate => (
            <button
              type="button"
              key={candidate.key}
              className={selection?.key === candidate.key ? 'is-selected' : ''}
              onClick={() => setSelection(candidate)}
            >
              <span className={`trace-result-type trace-result-type--${candidate.type}`}>
                {candidate.type === 'supplier' ? 'LOTE PROVEEDOR' : candidate.type === 'crop' ? 'CULTIVO' : candidate.type === 'harvest' ? 'LOTE VENTA' : 'PEDIDO'}
              </span>
              <strong>{candidate.title}</strong>
              <small>{candidate.subtitle}</small>
            </button>
          ))}
          {!visibleCandidates.length && <div className="trace-no-results">No se han encontrado lotes relacionados con esa búsqueda.</div>}
        </div>
      </div>

      {trace && (
        <div className="trace-journey">
          <div className="trace-journey__summary">
            <div>
              <span>EXPEDIENTE DE TRAZABILIDAD</span>
              <h2>{selection.title}</h2>
              <p>{selection.subtitle}</p>
            </div>
            <div className="trace-score">
              <strong>{traceCompleteness}%</strong>
              <span>cadena reconstruida</span>
            </div>
          </div>

          <Stage icon={Truck} eyebrow="PASO 1" title="Origen, proveedor y entrada" tone="origin" empty={!trace.relatedLots.length ? 'No existe un lote de proveedor vinculado a este recorrido.' : null}>
            <div className="trace-card-grid">
              {trace.relatedLots.map(lot => {
                const article = indexes.articles.get(String(lot.articleId));
                const provider = indexes.providers.get(String(lot.providerId));
                const line = indexes.noteLines.get(String(lot.deliveryNoteLineId));
                const note = line ? indexes.purchaseNotes.get(String(line.deliveryNoteId)) : null;
                const variety = article ? indexes.varieties.get(String(article.varietyId)) : null;
                return (
                  <InfoCard key={lot.id} icon={Sprout} title={article?.name || 'Semilla'} badge={lot.supplierBatch || 'SIN LOTE'} accent="amber">
                    <p><Building2 size={15} /> <strong>{provider?.name || 'Proveedor no identificado'}</strong></p>
                    <p><Leaf size={15} /> Variedad: {variety?.name || 'Sin variedad'}</p>
                    <p><ClipboardList size={15} /> Albarán: {note?.number || 'Sin albarán enlazado'}</p>
                    <p><CalendarDays size={15} /> Entrada: {formatDate(lot.receivedAt || note?.date)}</p>
                    <p>Recibido: <strong>{lot.initialQuantity} g</strong> · Disponible: <strong>{lot.remainingQuantity} g</strong></p>
                  </InfoCard>
                );
              })}
            </div>
          </Stage>

          <FlowArrow label="Semilla consumida y asignada a un lote de cultivo" />

          <Stage icon={Leaf} eyebrow="PASO 2" title="Siembra y cultivo" tone="crop" empty={!trace.relatedCrops.length ? 'No se encontraron cultivos relacionados.' : null}>
            <div className="trace-card-grid">
              {trace.relatedCrops.map(crop => {
                const cropType = indexes.cropTypes.get(String(crop.cropTypeId));
                const usedTrays = trace.relatedHarvests.reduce((sum, harvest) => sum + Number(harvest.selectedCropUsages?.[crop.id] || 0), 0);
                return (
                  <InfoCard key={crop.id} icon={Leaf} title={cropType?.name || 'Cultivo'} badge={crop.cultivationBatchNumber || crop.id} accent="green">
                    <p><CalendarDays size={15} /> Plantado: <strong>{formatDate(crop.datePlanted)}</strong></p>
                    <p><Sprout size={15} /> Lote semilla: <strong>{crop.seedSupplierBatch || crop.batchNumber || 'SIN LOTE'}</strong></p>
                    <p>Semilla empleada: <strong>{crop.seedQuantityUsed ?? (Number(crop.gramsPerTray || 0) * Number(crop.traysCount || 0))} g</strong></p>
                    <p>Bandejas empleadas en cosechas: <strong>{usedTrays}</strong></p>
                    <p>Estado actual: <strong>{crop.status}</strong></p>
                  </InfoCard>
                );
              })}
            </div>
          </Stage>

          <FlowArrow label="Bandejas cortadas, agrupadas y envasadas" />

          <Stage icon={Factory} eyebrow="PASO 3" title="Cosecha y lote de venta" tone="harvest" empty={!trace.relatedHarvests.length ? 'Este cultivo todavía no ha generado un lote de cosecha.' : null}>
            <div className="trace-card-grid">
              {trace.relatedHarvests.map(harvest => {
                const product = indexes.products.get(String(harvest.productId));
                return (
                  <InfoCard key={harvest.id} icon={PackageCheck} title={product?.name || 'Producto terminado'} badge={harvest.batchNumber} accent="blue">
                    <p><CalendarDays size={15} /> Cosechado: <strong>{formatDate(harvest.harvestDate)}</strong></p>
                    <p>Producción: <strong>{harvest.tuppersCount} unidades</strong></p>
                    <p>Composición: <strong>{(harvest.selectedCropIds || []).length} {(harvest.selectedCropIds || []).length === 1 ? 'lote' : 'lotes'} de cultivo</strong></p>
                    {(harvest.packagingBreakdown || []).filter(item => Number(item.quantity) > 0).map(item => {
                      const packaging = indexes.articles.get(String(item.articleId));
                      return <p key={item.articleId}>Envase: <strong>{packaging?.name || item.articleId} · {item.quantity} uds.</strong></p>;
                    })}
                  </InfoCard>
                );
              })}
            </div>
          </Stage>

          <FlowArrow label="Salida FIFO del lote y entrega documentada" />

          <Stage icon={ShoppingBag} eyebrow="PASO 4" title="Pedidos, albaranes y clientes" tone="customer" empty={!trace.relatedOrders.length ? 'Este lote todavía no ha sido entregado a ningún cliente.' : null}>
            <div className="trace-card-grid">
              {trace.relatedOrders.map(order => {
                const client = indexes.clients.get(String(order.clientId));
                const note = (deliveryNotes || []).find(item => String(item.orderId) === String(order.id));
                const lotMovements = (productMovements || []).filter(movement =>
                  movement.type === 'ORDER' && String(movement.referenceId || '').split('|')[0] === String(order.id)
                );
                return (
                  <InfoCard key={order.id} icon={UserRound} title={client?.commercialName || client?.name || order.clientName || 'Cliente'} badge={order.orderNumber || order.id} accent="violet">
                    <p><ShoppingBag size={15} /> Pedido: <strong>{order.orderNumber || order.id}</strong></p>
                    <p><ClipboardList size={15} /> Albarán: <strong>{note?.deliveryNoteNumber || note?.albaranNumber || 'Sin albarán'}</strong></p>
                    <p><CalendarDays size={15} /> Entrega: <strong>{formatDate(note?.date || order.date)}</strong></p>
                    <p>Estado: <strong>{order.status}</strong></p>
                    <p>Lotes expedidos: <strong>{lotMovements.map(m => String(m.referenceId).split('|')[1]).filter(Boolean).join(', ') || 'Sin lote asignado'}</strong></p>
                  </InfoCard>
                );
              })}
            </div>
          </Stage>

          <section className="trace-environment">
            <div className="trace-environment__heading">
              <div>
                <span>CONTROL AMBIENTAL DEL PERIODO</span>
                <h3>Temperatura y humedad registradas</h3>
              </div>
              <span className="trace-chip">{trace.environmental.length} lecturas</span>
            </div>
            {trace.environmental.length ? (
              <>
                <div className="trace-metrics">
                  <div><Thermometer /><span>Temperatura media</span><strong>{environmentalStats.temperature?.avg.toFixed(1) ?? '--'} ºC</strong><small>{environmentalStats.temperature ? `${environmentalStats.temperature.min}–${environmentalStats.temperature.max} ºC` : 'Sin temperatura'}</small></div>
                  <div><Waves /><span>Humedad media</span><strong>{environmentalStats.humidity?.avg.toFixed(1) ?? '--'} %</strong><small>{environmentalStats.humidity ? `${environmentalStats.humidity.min}–${environmentalStats.humidity.max} %` : 'Sin humedad'}</small></div>
                </div>
                <div className="trace-log-strip">
                  {trace.environmental.slice(-12).map(log => (
                    <div key={log.id}>
                      <span>{new Date(log.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                      <strong>{log.temperature ?? '--'} ºC</strong>
                      <small>{log.humidity ?? '--'} % HR</small>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="trace-empty"><Thermometer size={20} /> No hay lecturas ambientales registradas entre la siembra y la cosecha.</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
