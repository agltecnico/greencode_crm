import React, { useMemo, useState } from 'react';
import {
  ArrowRight, CalendarDays, CheckCircle2, Download, Factory,
  Leaf, PackageCheck, Search, Sprout, Thermometer, Truck, UserRound,
  Waves, XCircle
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { downloadTraceabilityPdf } from '../utils/traceabilityPdf';
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

const TYPE_LABELS = {
  supplier: 'LOTE DE SEMILLA',
  purchaseNote: 'ALBARÁN PROVEEDOR',
  crop: 'LOTE DE CULTIVO',
  harvest: 'LOTE DE VENTA',
  deliveryNote: 'ALBARÁN DE VENTA',
  client: 'CLIENTE',
  seed: 'SEMILLA',
  product: 'PRODUCTO DE VENTA'
};

const Stage = ({ icon, step, title, tone, children, empty }) => (
  <section className={`trace-stage trace-stage--${tone}`}>
    <header>
      <span className="trace-stage__icon">{React.createElement(icon, { size: 21 })}</span>
      <div><small>{step}</small><h3>{title}</h3></div>
    </header>
    <div className="trace-stage__records">
      {empty ? <div className="trace-empty"><XCircle size={17} /> {empty}</div> : children}
    </div>
  </section>
);

const FlowArrow = () => <div className="trace-arrow" aria-hidden="true"><ArrowRight size={27} /></div>;

const CompactRecord = ({ title, badge, accent, children, focused }) => (
  <article className={`trace-record trace-record--${accent} ${focused ? 'is-focused' : ''}`}>
    <div className="trace-record__title">
      <strong>{title}</strong>
      {badge && <span>{badge}</span>}
    </div>
    <div className="trace-record__body">{children}</div>
  </article>
);

const Field = ({ label, value, focused = false }) => (
  <p className={focused ? 'trace-field--focused' : ''}>
    <span>{label}</span>
    <strong>{value || 'Sin dato'}</strong>
  </p>
);

export default function TraceabilityExplorer() {
  const {
    providers, articles, stockLots, purchaseDeliveryNotes, purchaseDeliveryNoteLines,
    cropTypes, crops, harvests, productMovements, products, orders, clients,
    deliveryNotes, dailyLogs
  } = useData();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [selection, setSelection] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const indexes = useMemo(() => ({
    providers: new Map((providers || []).map(item => [String(item.id), item])),
    articles: new Map((articles || []).map(item => [String(item.id), item])),
    cropTypes: new Map((cropTypes || []).map(item => [String(item.id), item])),
    products: new Map((products || []).map(item => [String(item.id), item])),
    clients: new Map((clients || []).map(item => [String(item.id), item])),
    noteLines: new Map((purchaseDeliveryNoteLines || []).map(item => [String(item.id), item])),
    purchaseNotes: new Map((purchaseDeliveryNotes || []).map(item => [String(item.id), item]))
  }), [providers, articles, cropTypes, products, clients, purchaseDeliveryNoteLines, purchaseDeliveryNotes]);

  const candidates = useMemo(() => {
    const items = [];
    const add = (type, id, title, subtitle, search, date) => items.push({
      key: `${type}:${id}`, type, id, title, subtitle,
      search: [title, subtitle, ...(search || [])].join(' '),
      date: date ? String(date).slice(0, 10) : ''
    });

    (stockLots || []).forEach(lot => {
      const article = indexes.articles.get(String(lot.articleId));
      const provider = indexes.providers.get(String(lot.providerId));
      const line = indexes.noteLines.get(String(lot.deliveryNoteLineId));
      const note = line && indexes.purchaseNotes.get(String(line.deliveryNoteId));
      add('supplier', lot.id, lot.supplierBatch || lot.id, `${article?.name || 'Semilla'} · ${provider?.name || 'Proveedor'}`, [note?.number], lot.receivedAt || note?.date);
    });
    (purchaseDeliveryNotes || []).forEach(note => {
      const provider = indexes.providers.get(String(note.providerId));
      add('purchaseNote', note.id, note.number || note.id, provider?.name || 'Proveedor', [note.date], note.date);
    });
    (crops || []).forEach(crop => {
      const cropType = indexes.cropTypes.get(String(crop.cropTypeId));
      add('crop', crop.id, crop.cultivationBatchNumber || crop.batchNumber || crop.id, `${cropType?.name || 'Cultivo'} · ${formatDate(crop.datePlanted)}`, [crop.seedSupplierBatch], crop.datePlanted);
    });
    (harvests || []).forEach(harvest => {
      const product = indexes.products.get(String(harvest.productId));
      add('harvest', harvest.id, harvest.batchNumber || harvest.id, `${product?.name || 'Producto'} · ${formatDate(harvest.harvestDate)}`, [], harvest.harvestDate);
    });
    (deliveryNotes || []).forEach(note => {
      const number = note.deliveryNoteNumber || note.albaranNumber;
      const concluded = ['DELIVERED', 'DELIVERED_SIGNED', 'COMPLETED'].includes(String(note.status || '').toUpperCase());
      if (number && concluded) add('deliveryNote', note.id, number, note.clientCommercialName || note.clientName || 'Cliente', [note.date], note.date);
    });
    (clients || []).forEach(client => add('client', client.id, client.commercialName || client.name || client.id, 'Cliente', [client.name, client.clientNumber]));
    (articles || []).filter(article => article.type === 'SEMILLA').forEach(article => {
      const provider = indexes.providers.get(String(article.providerId));
      add('seed', article.id, article.name, provider?.name || 'Semilla', [article.supplierReference]);
    });
    (products || []).forEach(product => add('product', product.id, product.name || product.id, 'Producto de venta', [product.productNumber]));
    return items;
  }, [stockLots, purchaseDeliveryNotes, crops, harvests, deliveryNotes, clients, articles, products, indexes]);

  const visibleCandidates = useMemo(() => {
    const term = normalize(query);
    const groups = {
      origin: ['supplier', 'purchaseNote', 'seed'],
      production: ['crop'],
      harvest: ['harvest', 'product'],
      sales: ['deliveryNote', 'client']
    };
    const filtered = candidates.filter(item => {
      if (term && !normalize(item.search).includes(term)) return false;
      if (typeFilter !== 'all' && !groups[typeFilter]?.includes(item.type)) return false;
      if (dateStart && (!item.date || item.date < dateStart)) return false;
      if (dateEnd && (!item.date || item.date > dateEnd)) return false;
      return true;
    });
    if (!term && typeFilter === 'all' && !dateStart && !dateEnd) {
      return filtered.filter(item => ['supplier', 'harvest', 'deliveryNote'].includes(item.type)).slice().reverse().slice(0, 6);
    }
    return filtered.slice().reverse().slice(0, 30);
  }, [candidates, dateEnd, dateStart, query, typeFilter]);

  const trace = useMemo(() => {
    if (!selection) return null;
    let relatedLots = [];
    let relatedCrops = [];
    let relatedHarvests = [];
    let relatedOrders = [];
    const completedOrderIds = new Set((deliveryNotes || [])
      .filter(note => ['DELIVERED', 'DELIVERED_SIGNED', 'COMPLETED'].includes(String(note.status || '').toUpperCase()))
      .map(note => String(note.orderId)));

    if (selection.type === 'supplier') relatedLots = (stockLots || []).filter(lot => String(lot.id) === String(selection.id));
    if (selection.type === 'purchaseNote') {
      const lineIds = new Set((purchaseDeliveryNoteLines || []).filter(line => String(line.deliveryNoteId) === String(selection.id)).map(line => String(line.id)));
      relatedLots = (stockLots || []).filter(lot => lineIds.has(String(lot.deliveryNoteLineId)));
    }
    if (selection.type === 'seed') relatedLots = (stockLots || []).filter(lot => String(lot.articleId) === String(selection.id));
    if (selection.type === 'crop') relatedCrops = (crops || []).filter(crop => String(crop.id) === String(selection.id));
    if (selection.type === 'harvest') relatedHarvests = (harvests || []).filter(harvest => String(harvest.id) === String(selection.id));
    if (selection.type === 'product') relatedHarvests = (harvests || []).filter(harvest => String(harvest.productId) === String(selection.id));
    if (selection.type === 'deliveryNote') {
      const note = (deliveryNotes || []).find(item => String(item.id) === String(selection.id));
      relatedOrders = (orders || []).filter(order => String(order.id) === String(note?.orderId));
    }
    if (selection.type === 'client') relatedOrders = (orders || [])
      .filter(order => String(order.clientId) === String(selection.id) && completedOrderIds.has(String(order.id)));

    if (!relatedCrops.length && relatedLots.length) {
      const lotIds = new Set(relatedLots.map(lot => String(lot.id)));
      relatedCrops = (crops || []).filter(crop => lotIds.has(String(crop.seedStockLotId)));
    }
    if (!relatedHarvests.length && relatedCrops.length) {
      const cropIds = new Set(relatedCrops.map(crop => String(crop.id)));
      relatedHarvests = (harvests || []).filter(harvest => (harvest.selectedCropIds || []).some(id => cropIds.has(String(id))));
    }
    if (!relatedHarvests.length && relatedOrders.length) {
      const orderIds = new Set(relatedOrders.map(order => String(order.id)));
      const batches = new Set((productMovements || [])
        .filter(movement => movement.type === 'ORDER' && orderIds.has(String(movement.referenceId || '').split('|')[0]))
        .map(movement => String(movement.referenceId || '').split('|')[1]).filter(Boolean));
      relatedHarvests = (harvests || []).filter(harvest => batches.has(String(harvest.batchNumber)));
    }
    if (!relatedCrops.length && relatedHarvests.length) {
      const cropIds = new Set(relatedHarvests.flatMap(harvest => harvest.selectedCropIds || []).map(String));
      relatedCrops = (crops || []).filter(crop => cropIds.has(String(crop.id)));
    }
    if (!relatedLots.length && relatedCrops.length) {
      const lotIds = new Set(relatedCrops.map(crop => String(crop.seedStockLotId || '')).filter(Boolean));
      relatedLots = (stockLots || []).filter(lot => lotIds.has(String(lot.id)));
    }
    if (!relatedOrders.length && relatedHarvests.length) {
      const batches = new Set(relatedHarvests.map(harvest => String(harvest.batchNumber)));
      const orderIds = new Set((productMovements || [])
        .filter(movement => movement.type === 'ORDER' && batches.has(String(movement.referenceId || '').split('|')[1]))
        .map(movement => String(movement.referenceId || '').split('|')[0]));
      relatedOrders = (orders || []).filter(order => orderIds.has(String(order.id)) && completedOrderIds.has(String(order.id)));
    }

    const startDates = relatedCrops.map(crop => new Date(crop.datePlanted)).filter(date => !Number.isNaN(date.getTime()));
    const endDates = relatedHarvests.map(harvest => new Date(harvest.harvestDate)).filter(date => !Number.isNaN(date.getTime()));
    const start = startDates.length ? new Date(Math.min(...startDates)) : null;
    const end = endDates.length ? new Date(Math.max(...endDates)) : new Date();
    const environmental = (dailyLogs || []).filter(log => {
      const date = new Date(log.date);
      return start && !Number.isNaN(date.getTime()) && date >= start && date <= end;
    });
    return { relatedLots, relatedCrops, relatedHarvests, relatedOrders, environmental };
  }, [selection, stockLots, purchaseDeliveryNoteLines, crops, harvests, orders, deliveryNotes, productMovements, dailyLogs]);

  const environmentalStats = useMemo(() => {
    const logs = trace?.environmental || [];
    const summarize = key => {
      const values = logs.map(log => Number(log[key])).filter(Number.isFinite);
      return values.length ? {
        min: Math.min(...values), max: Math.max(...values),
        avg: values.reduce((sum, value) => sum + value, 0) / values.length
      } : null;
    };
    return { temperature: summarize('temperature'), humidity: summarize('humidity') };
  }, [trace]);

  const selectedType = selection?.type;
  const isFocused = (...types) => types.includes(selectedType);
  const traceCompleteness = trace
    ? Math.round(([
      trace.relatedLots.length > 0,
      trace.relatedCrops.length > 0,
      trace.relatedHarvests.length > 0,
      trace.relatedOrders.length > 0
    ].filter(Boolean).length / 4) * 100)
    : 0;

  const handleDownloadPdf = async () => {
    if (!trace || !selection || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      await downloadTraceabilityPdf({
        selection: { ...selection, label: TYPE_LABELS[selection.type] },
        trace, indexes, deliveryNotes, environmentalStats
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="trace-page">
      <header className="trace-hero">
        <div>
          <span className="trace-kicker">TRAZABILIDAD SANITARIA 360º</span>
          <h1>Del proveedor al cliente. Y viceversa.</h1>
        </div>
        <div className="trace-seal"><CheckCircle2 size={26} /><strong>Cadena verificable</strong></div>
      </header>

      <section className="trace-search-panel">
        <Search size={23} />
        <input value={query} onChange={event => setQuery(event.target.value)}
          placeholder="Lote, albarán, cliente, semilla o producto de venta"
          aria-label="Buscar trazabilidad" />
        {query && <button type="button" onClick={() => { setQuery(''); setSelection(null); }}><XCircle size={19} /> Limpiar</button>}
      </section>

      <section className="trace-filter-bar">
        <div className="trace-filter-types">
          {[['all', 'Todo'], ['origin', 'Origen'], ['production', 'Cultivos'], ['harvest', 'Cosechas'], ['sales', 'Ventas']].map(([value, label]) => (
            <button type="button" key={value} className={typeFilter === value ? 'is-active' : ''} onClick={() => setTypeFilter(value)}>{label}</button>
          ))}
        </div>
        <div className="trace-date-filters">
          <label>Desde<input type="date" value={dateStart} max={dateEnd || undefined} onChange={event => setDateStart(event.target.value)} /></label>
          <label>Hasta<input type="date" value={dateEnd} min={dateStart || undefined} onChange={event => setDateEnd(event.target.value)} /></label>
          {(dateStart || dateEnd || typeFilter !== 'all') && <button type="button" onClick={() => { setTypeFilter('all'); setDateStart(''); setDateEnd(''); }}>Restablecer</button>}
        </div>
      </section>

      <div className="trace-results">
        <div className="trace-results__title">
          <strong>{query ? `${visibleCandidates.length} coincidencias` : 'Registros recientes'}</strong>
          <small>Lotes · albaranes · clientes · semillas · productos</small>
        </div>
        <div className="trace-result-grid">
          {visibleCandidates.map(candidate => (
            <button type="button" key={candidate.key}
              className={selection?.key === candidate.key ? 'is-selected' : ''}
              onClick={() => setSelection(candidate)}>
              <span className={`trace-result-type trace-result-type--${candidate.type}`}>{TYPE_LABELS[candidate.type]}</span>
              <strong>{candidate.title}</strong>
              <small>{candidate.subtitle}</small>
            </button>
          ))}
          {!visibleCandidates.length && <div className="trace-no-results">No se encontraron coincidencias.</div>}
        </div>
      </div>

      {trace && (
        <div className="trace-detail-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelection(null); }}>
        <div className="trace-journey" role="dialog" aria-modal="true" aria-label="Detalle completo de trazabilidad">
          <div className="trace-journey__summary">
            <div>
              <span>BÚSQUEDA: {TYPE_LABELS[selection.type]}</span>
              <h2>{selection.title}</h2>
              <p>{selection.subtitle}</p>
            </div>
            <div className="trace-summary-actions">
              <button type="button" className="trace-pdf-button" onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
                <Download size={17} /> {isGeneratingPdf ? 'Generando...' : 'Descargar informe PDF'}
              </button>
              <div className="trace-score"><strong>{traceCompleteness}%</strong><span>cadena localizada</span></div>
              <button type="button" className="trace-close-button" aria-label="Cerrar detalle" onClick={() => setSelection(null)}>×</button>
            </div>
          </div>

          <div className="trace-scheme">
            <Stage icon={Truck} step="01 · ORIGEN" title="Semilla y proveedor" tone="origin"
              empty={!trace.relatedLots.length ? 'Sin lote de semilla vinculado' : null}>
              {trace.relatedLots.map(lot => {
                const article = indexes.articles.get(String(lot.articleId));
                const provider = indexes.providers.get(String(lot.providerId));
                const line = indexes.noteLines.get(String(lot.deliveryNoteLineId));
                const note = line && indexes.purchaseNotes.get(String(line.deliveryNoteId));
                return (
                  <CompactRecord key={lot.id} title={article?.name || 'Semilla'} badge={lot.supplierBatch} accent="amber"
                    focused={isFocused('supplier', 'purchaseNote', 'seed')}>
                    <Field label="Lote" value={lot.supplierBatch} focused={isFocused('supplier')} />
                    <Field label="Proveedor" value={provider?.name} />
                    <Field label="Entrada" value={formatDate(lot.receivedAt || note?.date)} />
                    <Field label="Albarán" value={note?.number} focused={isFocused('purchaseNote')} />
                  </CompactRecord>
                );
              })}
            </Stage>

            <FlowArrow />

            <Stage icon={Leaf} step="02 · PRODUCCIÓN" title="Siembra y cultivo" tone="crop"
              empty={!trace.relatedCrops.length ? 'Sin cultivo vinculado' : null}>
              {trace.relatedCrops.map(crop => {
                const cropType = indexes.cropTypes.get(String(crop.cropTypeId));
                const trays = trace.relatedHarvests.reduce((sum, harvest) => sum + Number(harvest.selectedCropUsages?.[crop.id] || 0), 0);
                return (
                  <CompactRecord key={crop.id} title={cropType?.name || 'Cultivo'} badge={crop.cultivationBatchNumber} accent="green"
                    focused={isFocused('crop')}>
                    <Field label="Plantado" value={formatDate(crop.datePlanted)} />
                    <Field label="Semilla" value={`${crop.seedQuantityUsed ?? 0} g`} />
                    <Field label="Bandejas" value={trays || crop.traysCount || 0} />
                  </CompactRecord>
                );
              })}
            </Stage>

            <FlowArrow />

            <Stage icon={Factory} step="03 · COSECHA" title="Producto y lote de venta" tone="harvest"
              empty={!trace.relatedHarvests.length ? 'Todavía sin cosecha' : null}>
              {trace.relatedHarvests.map(harvest => {
                const product = indexes.products.get(String(harvest.productId));
                return (
                  <CompactRecord key={harvest.id} title={product?.name || 'Producto terminado'} badge={harvest.batchNumber} accent="blue"
                    focused={isFocused('harvest', 'product')}>
                    <Field label="Cosecha" value={formatDate(harvest.harvestDate)} />
                    <Field label="Producción" value={`${harvest.tuppersCount} unidades`} />
                    <Field label="Lote venta" value={harvest.batchNumber} focused={isFocused('harvest')} />
                  </CompactRecord>
                );
              })}
            </Stage>

            <FlowArrow />

            <Stage icon={UserRound} step="04 · DESTINO" title="Cliente y entrega" tone="customer"
              empty={!trace.relatedOrders.length ? 'Todavía sin cliente' : null}>
              {trace.relatedOrders.map(order => {
                const client = indexes.clients.get(String(order.clientId));
                const note = (deliveryNotes || []).find(item => String(item.orderId) === String(order.id));
                const deliveryNumber = note?.deliveryNoteNumber || note?.albaranNumber;
                return (
                  <CompactRecord key={order.id} title={client?.commercialName || client?.name || order.clientName || 'Cliente'}
                    badge={deliveryNumber || order.orderNumber} accent="violet"
                    focused={isFocused('client', 'deliveryNote')}>
                    <Field label="Cliente" value={client?.commercialName || client?.name || order.clientName} focused={isFocused('client')} />
                    <Field label="Albarán" value={deliveryNumber} focused={isFocused('deliveryNote')} />
                    <Field label="Entrega" value={formatDate(note?.date || order.date)} />
                  </CompactRecord>
                );
              })}
            </Stage>
          </div>

          <section className="trace-environment">
            <div><Thermometer /><span>Temperatura</span><strong>{environmentalStats.temperature?.avg.toFixed(1) ?? '--'} ºC</strong><small>{environmentalStats.temperature ? `${environmentalStats.temperature.min}–${environmentalStats.temperature.max} ºC` : 'Sin registros'}</small></div>
            <div><Waves /><span>Humedad</span><strong>{environmentalStats.humidity?.avg.toFixed(1) ?? '--'} %</strong><small>{environmentalStats.humidity ? `${environmentalStats.humidity.min}–${environmentalStats.humidity.max} %` : 'Sin registros'}</small></div>
            <div className="trace-environment__count"><CalendarDays /><strong>{trace.environmental.length}</strong><span>controles ambientales</span></div>
          </section>
        </div>
        </div>
      )}
    </div>
  );
}
