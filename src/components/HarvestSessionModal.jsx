import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { useData } from '../context/DataContext';
import './HarvestSessionModal.css';

const localInputValue = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const cleanInitials = name => {
  const words = String(name || 'LOTE').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ').replace(/[^A-Za-z0-9 ]/g, ' ').trim().toUpperCase().split(/\s+/).filter(Boolean);
  return words.length === 1 ? words[0].slice(0, 3) : words.slice(0, 3).map(word => word[0]).join('');
};

const isoWeek = value => {
  const source = new Date(value);
  const date = new Date(Date.UTC(source.getFullYear(), source.getMonth(), source.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - start) / 86400000) + 1) / 7);
};

const pendingDeliveryGroups = movements => {
  const groups = new Map();
  [...movements].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).forEach(movement => {
    const date = new Date(movement.createdAt);
    const weekKey = `${date.getFullYear()}-${String(isoWeek(date)).padStart(2, '0')}`;
    if (!groups.has(weekKey)) groups.set(weekKey, { year: date.getFullYear(), week: isoWeek(date), dates: new Map(), units: 0 });
    const group = groups.get(weekKey);
    const dateLabel = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const units = Math.abs(Number(movement.quantity || 0));
    group.units += units;
    group.dates.set(dateLabel, (group.dates.get(dateLabel) || 0) + units);
  });
  return [...groups.values()];
};

const makeLine = () => ({ id: crypto.randomUUID(), productId: '', packagingQuantities: {} });

const FLOW_MODES = {
  WEEK: 'week',
  RETROACTIVE: 'retroactive',
  TRACEABILITY: 'traceability'
};

export default function HarvestSessionModal({ open, onClose }) {
  const {
    crops, cropTypes, seedVarieties, articles, products, harvests, stockEntries, productMovements,
    registerHarvestSession
  } = useData();
  const [harvestDate, setHarvestDate] = useState(localInputValue());
  const [selectedCropTrays, setSelectedCropTrays] = useState({});
  const [lines, setLines] = useState([makeLine()]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [flowMode, setFlowMode] = useState(FLOW_MODES.WEEK);
  const [focusedPendingProductId, setFocusedPendingProductId] = useState('');

  const harvestWeek = useMemo(() => {
    const selected = new Date(harvestDate);
    const start = new Date(selected);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (start.getDay() === 0 ? 6 : start.getDay() - 1));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { start, end };
  }, [harvestDate]);

  const expectedHarvestForCrop = useCallback(crop => {
    const type = cropTypes?.find(item => item.id === crop.cropTypeId || item.id === crop.seedId);
    const planted = new Date(crop.datePlanted || crop.plantedAt);
    if (Number.isNaN(planted.getTime()) || !type) return null;
    const soakingDays = Number(type.soakingHours || 0) > 0 ? Math.max(1, Math.ceil(Number(type.soakingHours) / 24)) : 0;
    const cycleDays = soakingDays + Number(type.germinationDays || 0) + Number(type.darknessDays || 0) + Number(type.lightDays || 0);
    const expected = new Date(planted);
    expected.setDate(expected.getDate() + cycleDays - Number(crop.cycleDayAdjustment || 0));
    return expected;
  }, [cropTypes]);

  const readyCrops = useMemo(() => (crops || [])
    .filter(crop => crop.status === 'READY' && Number(crop.traysCount || crop.trays || 0) > 0)
    .filter(crop => {
      const planted = new Date(crop.datePlanted || crop.plantedAt);
      return !Number.isNaN(planted.getTime()) && planted <= new Date(harvestDate);
    })
    .sort((a, b) => {
      const aExpected = expectedHarvestForCrop(a);
      const bExpected = expectedHarvestForCrop(b);
      const aInWeek = aExpected >= harvestWeek.start && aExpected < harvestWeek.end;
      const bInWeek = bExpected >= harvestWeek.start && bExpected < harvestWeek.end;
      return Number(bInWeek) - Number(aInWeek) || new Date(a.datePlanted || a.plantedAt) - new Date(b.datePlanted || b.plantedAt);
    }), [crops, expectedHarvestForCrop, harvestDate, harvestWeek]);

  const weeklyReadyCropIds = useMemo(() => new Set(readyCrops.filter(crop => {
    const expected = expectedHarvestForCrop(crop);
    return expected && expected >= harvestWeek.start && expected < harvestWeek.end;
  }).map(crop => crop.id)), [expectedHarvestForCrop, readyCrops, harvestWeek]);

  useEffect(() => {
    if (!open) return;
    setHarvestDate(localInputValue());
    setLines([makeLine()]);
    setNotes('');
    setFlowMode(FLOW_MODES.WEEK);
    setFocusedPendingProductId('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedCropTrays(Object.fromEntries(readyCrops.map(crop => [
      crop.id,
      flowMode === FLOW_MODES.WEEK && weeklyReadyCropIds.has(crop.id)
        ? Number(crop.traysCount || crop.trays || 0)
        : 0
    ])));
  }, [flowMode, harvestDate, open, readyCrops, weeklyReadyCropIds]);

  const cropVarietyId = crop => {
    const type = cropTypes?.find(item => item.id === crop.cropTypeId || item.id === crop.seedId);
    return type?.varietyId || articles?.find(article => article.id === (crop.seedId || type?.seedId))?.varietyId || null;
  };
  const varietyName = crop => {
    const type = cropTypes?.find(item => item.id === crop.cropTypeId || item.id === crop.seedId);
    return seedVarieties?.find(item => item.id === cropVarietyId(crop))?.name || type?.name || 'Variedad';
  };
  const recipeIds = product => {
    if (Array.isArray(product?.recipeVarieties) && product.recipeVarieties.length) {
      return product.recipeVarieties.map(item => item.varietyId).filter(Boolean);
    }
    return (product?.recipeSeeds || []).map(item => articles?.find(article => article.id === item.seedId)?.varietyId).filter(Boolean);
  };
  const packagingFor = product => (product?.packagingArticleIds || [])
    .map(id => articles?.find(article => article.id === id && article.active !== false))
    .filter(Boolean);
  const lineUnits = line => Object.values(line.packagingQuantities || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const pendingOrdersForProduct = productId => (productMovements || []).filter(movement =>
    movement.type === 'ORDER'
    && String(movement.productId) === String(productId)
    && Number(movement.quantity || 0) < 0
    && String(movement.referenceId || '').endsWith('|PENDING-TRACEABILITY')
  );
  const activeLines = lines.filter(line => line.productId && lineUnits(line) > 0);
  const usedVarietyIds = new Set(activeLines.flatMap(line => recipeIds(products?.find(product => product.id === line.productId))));
  const selectedProductVarietyIds = new Set(lines.filter(line => line.productId).flatMap(line => recipeIds(products?.find(product => product.id === line.productId))));
  const selectedReadyCrops = readyCrops.filter(crop => Number(selectedCropTrays[crop.id] || 0) > 0);
  const totalSelectedTrays = selectedReadyCrops.reduce((sum, crop) => sum + Number(selectedCropTrays[crop.id] || 0), 0);
  const totalReadyTrays = readyCrops.reduce((sum, crop) => sum + Number(crop.traysCount || crop.trays || 0), 0);
  const remainingTrays = totalReadyTrays - totalSelectedTrays;
  const totalUnits = activeLines.reduce((sum, line) => sum + lineUnits(line), 0);

  const pendingProducts = useMemo(() => (products || []).map(product => {
    const movements = (productMovements || []).filter(movement =>
      movement.type === 'ORDER'
      && String(movement.productId) === String(product.id)
      && Number(movement.quantity || 0) < 0
      && String(movement.referenceId || '').endsWith('|PENDING-TRACEABILITY')
    ).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const groups = pendingDeliveryGroups(movements);
    return {
      product,
      movements,
      groups,
      units: movements.reduce((sum, movement) => sum + Math.abs(Number(movement.quantity || 0)), 0),
      oldestDate: movements[0]?.createdAt || null
    };
  }).filter(item => item.units > 0).sort((a, b) => b.units - a.units), [productMovements, products]);

  useEffect(() => {
    if (!open || flowMode !== FLOW_MODES.TRACEABILITY || !focusedPendingProductId) return;
    const product = products?.find(item => String(item.id) === String(focusedPendingProductId));
    const varieties = new Set(Array.isArray(product?.recipeVarieties) && product.recipeVarieties.length
      ? product.recipeVarieties.map(item => item.varietyId).filter(Boolean)
      : (product?.recipeSeeds || []).map(item => articles?.find(article => article.id === item.seedId)?.varietyId).filter(Boolean));
    setSelectedCropTrays(Object.fromEntries(readyCrops.map(crop => {
      const type = cropTypes?.find(item => item.id === crop.cropTypeId || item.id === crop.seedId);
      const varietyId = type?.varietyId || articles?.find(article => article.id === (crop.seedId || type?.seedId))?.varietyId;
      return [crop.id, varieties.has(varietyId) ? Number(crop.traysCount || crop.trays || 0) : 0];
    })));
  }, [articles, cropTypes, flowMode, focusedPendingProductId, open, products, readyCrops]);

  const totalPendingTraceability = pendingProducts.reduce((sum, item) => sum + item.units, 0);
  const totalLinkableUnits = activeLines.reduce((sum, line) => {
    const pendingThisWeek = pendingOrdersForProduct(line.productId)
      .filter(movement => {
        const deliveryDate = new Date(movement.createdAt);
        return deliveryDate >= harvestWeek.start && deliveryDate < harvestWeek.end;
      })
      .reduce((units, movement) => units + Math.abs(Number(movement.quantity || 0)), 0);
    return sum + Math.min(lineUnits(line), pendingThisWeek);
  }, 0);

  const changeFlowMode = mode => {
    setFlowMode(mode);
    setFocusedPendingProductId('');
    setLines([makeLine()]);
    setNotes(mode === FLOW_MODES.RETROACTIVE ? 'Cosecha retroactiva' : '');
    setHarvestDate(localInputValue());
  };

  const preparePendingHarvest = item => {
    const date = new Date(item.oldestDate);
    setFlowMode(FLOW_MODES.TRACEABILITY);
    setFocusedPendingProductId(item.product.id);
    setHarvestDate(localInputValue(date));
    setLines([{ ...makeLine(), productId: item.product.id }]);
    setNotes(`Regularización de entregas pendientes de ${item.product.name}`);
  };

  if (!open) return null;

  const updateLine = (id, patch) => setLines(current => current.map(line => line.id === id ? { ...line, ...patch } : line));
  const removeLine = id => setLines(current => current.length === 1 ? [makeLine()] : current.filter(line => line.id !== id));

  const buildAllocations = () => {
    const allocations = Object.fromEntries(activeLines.map(line => [line.id, {}]));
    selectedReadyCrops.forEach(crop => {
      const varietyId = cropVarietyId(crop);
      const compatible = activeLines.filter(line => recipeIds(products.find(product => product.id === line.productId)).includes(varietyId));
      const weight = compatible.reduce((sum, line) => sum + lineUnits(line), 0);
      compatible.forEach((line, index) => {
        const trays = Number(selectedCropTrays[crop.id] || 0);
        const allocated = index === compatible.length - 1
          ? trays - compatible.slice(0, -1).reduce((sum, previous) => sum + Number(allocations[previous.id][crop.id] || 0), 0)
          : Number((trays * lineUnits(line) / weight).toFixed(3));
        allocations[line.id][crop.id] = allocated;
      });
    });
    return allocations;
  };

  const submit = async event => {
    event.preventDefault();
    if (activeLines.length === 0) return Swal.fire('Faltan cosechas', 'Añade al menos un producto y sus táperes.', 'warning');
    if (selectedReadyCrops.length === 0) return Swal.fire('Faltan cultivos', 'Selecciona al menos un cultivo listo.', 'warning');
    const date = new Date(harvestDate);
    if (Number.isNaN(date.getTime()) || date > new Date()) return Swal.fire('Fecha no válida', 'Revisa la fecha real de cosecha.', 'warning');

    const uncovered = selectedReadyCrops.filter(crop => !usedVarietyIds.has(cropVarietyId(crop)));
    if (uncovered.length) {
      return Swal.fire('Cultivos sin asignar', `${uncovered.map(varietyName).join(', ')} están seleccionados pero no aparecen en ningún producto. Desmárcalos o añade su cosecha.`, 'warning');
    }
    const availableVarieties = new Set(selectedReadyCrops.map(cropVarietyId));
    const incomplete = activeLines.find(line => {
      const recipe = recipeIds(products.find(product => product.id === line.productId));
      return recipe.filter(id => availableVarieties.has(id)).length < Math.min(4, recipe.length);
    });
    if (incomplete) return Swal.fire('Mix incompleto', 'No están seleccionadas suficientes variedades para uno de los productos.', 'warning');

    const allocations = buildAllocations();
    const dateKey = date.toISOString().slice(0, 10);
    const sequenceByProduct = {};
    const payload = activeLines.map(line => {
      const product = products.find(item => item.id === line.productId);
      const previous = (harvests || []).filter(item => item.productId === line.productId && String(item.harvestDate || '').slice(0, 10) === dateKey).length;
      sequenceByProduct[line.productId] = (sequenceByProduct[line.productId] || previous) + 1;
      const batchNumber = `${cleanInitials(product.name)}-${String(isoWeek(date)).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}${String(date.getMonth() + 1).padStart(2, '0')}-${String(sequenceByProduct[line.productId]).padStart(2, '0')}`;
      return {
        productId: line.productId,
        batchNumber,
        selectedCropUsages: allocations[line.id],
        packagingBreakdown: Object.entries(line.packagingQuantities).map(([articleId, quantity]) => ({ articleId, quantity: Number(quantity) })).filter(item => item.quantity > 0),
        registrationNotes: notes
      };
    });

    setSaving(true);
    try {
      const result = await registerHarvestSession({ harvestDate: date.toISOString(), harvestLines: payload });
      if (!result) return;
      const linked = (result.harvests || []).reduce((sum, item) => sum + Number(item.linkedUnits || 0), 0);
      onClose();
      Swal.fire('Cosecha registrada', `${totalUnits} táperes registrados en ${payload.length} lotes. ${linked} unidades vinculadas automáticamente a pedidos entregados.`, 'success');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="harvest-session-overlay">
      <form className="harvest-session" onSubmit={submit}>
        <header className="harvest-session__header">
          <div><span>COSECHA DEL DÍA</span><h2>Registrar toda la producción</h2><p>Selecciona los cultivos utilizados y añade todos los productos obtenidos.</p></div>
          <label>{flowMode === FLOW_MODES.RETROACTIVE ? 'Fecha pasada real' : flowMode === FLOW_MODES.TRACEABILITY ? 'Fecha de la entrega a regularizar' : 'Fecha real'}<input type="datetime-local" value={harvestDate} max={localInputValue()} onChange={event => setHarvestDate(event.target.value)} /></label>
          <button type="button" className="harvest-session__close" onClick={onClose}>×</button>
        </header>

        <nav className="harvest-session__flows" aria-label="Tipo de registro de cosecha">
          <button type="button" className={flowMode === FLOW_MODES.WEEK ? 'is-active' : ''} onClick={() => changeFlowMode(FLOW_MODES.WEEK)}>
            <span>1</span><b>Esta semana</b><small>Cosechar lo previsto ahora</small>
          </button>
          <button type="button" className={flowMode === FLOW_MODES.RETROACTIVE ? 'is-active is-retroactive' : ''} onClick={() => changeFlowMode(FLOW_MODES.RETROACTIVE)}>
            <span>2</span><b>Cosecha retroactiva</b><small>Registrar una fecha pasada</small>
          </button>
          <button type="button" className={flowMode === FLOW_MODES.TRACEABILITY ? 'is-active is-traceability' : ''} onClick={() => changeFlowMode(FLOW_MODES.TRACEABILITY)}>
            <span>3</span><b>Regularizar ventas</b><small>{totalPendingTraceability} uds. sin cosecha vinculada</small>
          </button>
        </nav>

        {flowMode === FLOW_MODES.RETROACTIVE && (
          <div className="harvest-session__guidance is-retroactive">
            <b>Registro retroactivo</b>
            <span>Primero selecciona arriba la fecha real. Después marca los cultivos usados y los envases obtenidos. Solo se relacionarán entregas de esa misma semana.</span>
          </div>
        )}

        {flowMode === FLOW_MODES.TRACEABILITY && (
          <section className="harvest-session__pending">
            <header><div><b>Ventas entregadas que aún no tienen cosecha</b><span>Elige un producto para preparar el registro correcto.</span></div><strong>{totalPendingTraceability} uds. pendientes</strong></header>
            <div>
              {pendingProducts.map(item => (
                <button type="button" key={item.product.id} className={String(focusedPendingProductId) === String(item.product.id) ? 'is-selected' : ''} onClick={() => preparePendingHarvest(item)}>
                  <span><b>{item.product.name}</b><small>{item.groups.length} semana{item.groups.length === 1 ? '' : 's'} pendiente{item.groups.length === 1 ? '' : 's'} · desde {new Date(item.oldestDate).toLocaleDateString('es-ES')}</small></span>
                  <strong>{item.units} uds.</strong><em>Preparar cosecha →</em>
                </button>
              ))}
              {!pendingProducts.length && <div className="harvest-session__pending-empty">✓ Todas las ventas entregadas tienen su cosecha vinculada.</div>}
            </div>
          </section>
        )}

        <div className="harvest-session__columns">
          <section className="harvest-session__crops">
            <div className="harvest-session__title"><div><span>1</span><h3>Cultivos listos</h3></div><strong>{totalSelectedTrays} bandejas</strong></div>
            <p>{flowMode === FLOW_MODES.WEEK ? 'Están marcados los previstos esta semana.' : 'Marca los cultivos que se utilizaron en esta cosecha.'} Ajusta las bandejas reales.</p>
            <div className="harvest-session__crop-list">
              {readyCrops.map(crop => {
                const maxTrays = Number(crop.traysCount || crop.trays || 0);
                const selectedTrays = Number(selectedCropTrays[crop.id] || 0);
                const selected = selectedTrays > 0;
                const covered = selected && selectedProductVarietyIds.has(cropVarietyId(crop));
                const expected = expectedHarvestForCrop(crop);
                const expectedThisWeek = weeklyReadyCropIds.has(crop.id);
                return <div key={crop.id} className={`harvest-crop ${selected ? 'is-selected' : ''} ${covered ? 'is-used' : ''}`}>
                  <input type="checkbox" aria-label={`Seleccionar ${varietyName(crop)}`} checked={selected} onChange={() => setSelectedCropTrays(current => ({ ...current, [crop.id]: selected ? 0 : maxTrays }))} />
                  <div><strong>{varietyName(crop)}</strong><small>{expectedThisWeek ? 'Previsto esta semana' : `Previsto ${expected?.toLocaleDateString('es-ES') || 'sin fecha'}`} · Lote {crop.batchNumber || 'sin lote'}</small></div>
                  <label className="harvest-crop__trays">
                    <input type="number" min="0" max={maxTrays} step="1" value={selectedTrays} onChange={event => setSelectedCropTrays(current => ({ ...current, [crop.id]: Math.min(maxTrays, Math.max(0, Number(event.target.value || 0))) }))} />
                    <small>de {maxTrays} bandejas</small>
                  </label>
                  {covered && <em>Asignada</em>}
                </div>;
              })}
              {!readyCrops.length && <div className="harvest-session__empty">No hay cultivos listos sembrados antes de esta fecha.</div>}
            </div>
          </section>

          <section className="harvest-session__production">
            <div className="harvest-session__title"><div><span>2</span><h3>Táperes obtenidos</h3></div><strong>{totalUnits} unidades</strong></div>
            <p>{flowMode === FLOW_MODES.TRACEABILITY && focusedPendingProductId ? 'Producto pendiente preparado. Indica ahora los envases producidos.' : 'Añade una línea para cada variedad o mix producido.'}</p>
            <div className="harvest-session__line-list">
              {lines.map((line, lineIndex) => {
                const product = products?.find(item => item.id === line.productId);
                const recipe = recipeIds(product);
                const producedUnits = lineUnits(line);
                const pendingMovements = pendingOrdersForProduct(line.productId);
                const deliveryGroups = pendingDeliveryGroups(pendingMovements);
                const pendingUnits = pendingMovements.reduce((sum, movement) => sum + Math.abs(Number(movement.quantity || 0)), 0);
                const weekPendingUnits = pendingMovements
                  .filter(movement => {
                    const deliveryDate = new Date(movement.createdAt);
                    return deliveryDate >= harvestWeek.start && deliveryDate < harvestWeek.end;
                  })
                  .reduce((sum, movement) => sum + Math.abs(Number(movement.quantity || 0)), 0);
                const olderPendingUnits = Math.max(0, pendingUnits - weekPendingUnits);
                const linkedUnits = Math.min(producedUnits, weekPendingUnits);
                const surplusUnits = Math.max(0, producedUnits - weekPendingUnits);
                return <article className="harvest-line" key={line.id}>
                  <div className="harvest-line__top"><b>Cosecha {lineIndex + 1}</b><button type="button" onClick={() => removeLine(line.id)}>Eliminar</button></div>
                  <select value={line.productId} onChange={event => updateLine(line.id, { productId: event.target.value, packagingQuantities: {} })}>
                    <option value="">Seleccionar variedad o mix…</option>
                    {(products || []).filter(item => recipeIds(item).length && packagingFor(item).length).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  {product && <>
                    <div className="harvest-line__recipe">{recipe.map(id => <span key={id}>{seedVarieties?.find(item => item.id === id)?.name || 'Variedad'}</span>)}</div>
                    <div className="harvest-line__formats">
                      {packagingFor(product).map(format => {
                        const stock = (stockEntries || []).filter(entry => entry.articleId === format.id).reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
                        return <label key={format.id}><span>{format.name}<small>{stock} disponibles</small></span><input type="number" min="0" placeholder="0" value={line.packagingQuantities[format.id] || ''} onChange={event => updateLine(line.id, { packagingQuantities: { ...line.packagingQuantities, [format.id]: Math.max(0, Number(event.target.value || 0)) } })} /></label>;
                      })}
                    </div>
                    <div className="harvest-line__allocation">
                      <div className="is-linked"><span>SE ASIGNAN A PEDIDOS ENTREGADOS</span><strong>{linkedUnits} uds.</strong><small>de {weekPendingUnits} pendientes esta semana</small></div>
                      <div className="is-surplus"><span>QUEDAN DISPONIBLES</span><strong>{surplusUnits} uds.</strong><small>en stock</small></div>
                    </div>
                    {deliveryGroups.length > 0 ? (
                      <details className="harvest-line__deliveries">
                        <summary>Ver detalle de pedidos pendientes ({pendingUnits} uds.)</summary>
                        <p>Solo se asignan automáticamente las entregas de la semana {isoWeek(harvestDate)}.</p>
                        {deliveryGroups.map(group => (
                          <div key={`${group.year}-${group.week}`} className={group.week === isoWeek(harvestDate) ? 'is-current-week' : 'is-other-week'}>
                            <b>{group.week === isoWeek(harvestDate) ? 'Esta semana' : `Semana ${group.week}`} · {group.units} uds.</b>
                            <small>{[...group.dates.entries()].map(([dateLabel, units]) => `${dateLabel}: ${units}`).join(' · ')}</small>
                          </div>
                        ))}
                        {olderPendingUnits > 0 && <em>{olderPendingUnits} uds. anteriores seguirán pendientes.</em>}
                      </details>
                    ) : (
                      <div className="harvest-line__no-deliveries">No hay pedidos entregados pendientes de vincular para {product.name}.</div>
                    )}
                  </>}
                </article>;
              })}
            </div>
            <button className="harvest-session__add" type="button" onClick={() => setLines(current => [...current, makeLine()])}>＋ Añadir otra cosecha</button>
            <label className="harvest-session__notes">Comentario opcional<textarea rows="2" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Observaciones de la cosecha…" /></label>
          </section>
        </div>

        <footer className="harvest-session__footer">
          <div><strong>{activeLines.length} productos · {totalUnits} táperes</strong><span>{totalSelectedTrays} bandejas · {totalUnits > 0 ? `${totalLinkableUnits} uds. se vincularán` : `${remainingTrays} bandejas quedarán pendientes`}</span></div>
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="submit" disabled={saving || !readyCrops.length}>
            {saving
              ? 'Registrando todo…'
              : flowMode === FLOW_MODES.TRACEABILITY
                ? `Registrar y vincular ${totalLinkableUnits} uds.`
                : flowMode === FLOW_MODES.RETROACTIVE
                  ? 'Registrar cosecha retroactiva'
                  : 'Registrar cosecha de la semana'}
          </button>
        </footer>
      </form>
    </div>
  );
}
