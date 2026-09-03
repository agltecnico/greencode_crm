import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { useData } from '../context/DataContext';
import './HarvestSessionModal.css';

const localInputValue = (date = new Date()) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const localDateKey = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const harvestDateWithCurrentTime = dateValue => {
  const now = new Date();
  const [year, month, day] = String(dateValue).split('-').map(Number);
  const selected = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return localInputValue(selected);
};

const cleanInitials = name => {
  const words = String(name || 'LOTE').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ').replace(/[^A-Za-z0-9 ]/g, ' ').trim().toUpperCase().split(/\s+/).filter(Boolean);
  return words.length === 1 ? words[0].slice(0, 3) : words.slice(0, 3).map(word => word[0]).join('');
};

const harvestProductName = name => String(name || 'Producto')
  .replace(/\s*\(\s*\d+\s*ML\s*\)\s*$/i, '')
  .replace(/\s+\d+\s*ML\s*$/i, '')
  .trim();

const harvestProductKey = name => harvestProductName(name)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

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
const HARVEST_CATCH_UP_CUTOFF = new Date('2026-09-02T00:00:00+02:00');

export default function HarvestSessionModal({ open, onClose }) {
  const {
    crops, cropTypes, seedVarieties, articles, products, orders, harvests, stockEntries, productMovements,
    registerHarvestSession
  } = useData();
  const [harvestDate, setHarvestDate] = useState(localInputValue());
  const [selectedCropTrays, setSelectedCropTrays] = useState({});
  const [lines, setLines] = useState([makeLine()]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingLineId, setEditingLineId] = useState(null);
  const [pickerProductId, setPickerProductId] = useState('');
  const [pickerQuantities, setPickerQuantities] = useState({});
  const [demandPlanOpen, setDemandPlanOpen] = useState(false);
  const [demandPlanFocusId, setDemandPlanFocusId] = useState(null);
  const [demandPlanDraft, setDemandPlanDraft] = useState({});

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
    setStep(1);
    setPickerOpen(false);
    setEditingLineId(null);
    setPickerProductId('');
    setPickerQuantities({});
    setDemandPlanOpen(false);
    setDemandPlanFocusId(null);
    setDemandPlanDraft({});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedCropTrays(Object.fromEntries(readyCrops.map(crop => [
      crop.id,
      Number(crop.traysCount || crop.trays || 0)
    ])));
  }, [harvestDate, open, readyCrops, weeklyReadyCropIds]);

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
  const selectedVarietyIds = new Set(selectedReadyCrops.map(cropVarietyId));
  const compatibleProducts = (products || []).filter(product => {
    const recipe = recipeIds(product);
    const selectedRecipeVarieties = new Set(recipe.filter(varietyId => selectedVarietyIds.has(varietyId)));
    const minimumVarieties = Math.min(4, new Set(recipe).size);
    return recipe.length > 0 && packagingFor(product).length > 0 && selectedRecipeVarieties.size >= minimumVarieties;
  });
  const selectableProducts = Object.values(compatibleProducts.reduce((groups, product) => {
    const key = harvestProductKey(product.name);
    const current = groups[key];
    const productHasCapacity = /\d+\s*ML/i.test(product.name || '');
    const currentHasCapacity = /\d+\s*ML/i.test(current?.name || '');
    if (!current || (currentHasCapacity && !productHasCapacity)) groups[key] = product;
    return groups;
  }, {}));
  const totalSelectedTrays = selectedReadyCrops.reduce((sum, crop) => sum + Number(selectedCropTrays[crop.id] || 0), 0);
  const totalReadyTrays = readyCrops.reduce((sum, crop) => sum + Number(crop.traysCount || crop.trays || 0), 0);
  const remainingTrays = totalReadyTrays - totalSelectedTrays;
  const totalUnits = activeLines.reduce((sum, line) => sum + lineUnits(line), 0);

  const isPastWeek = harvestWeek.end <= new Date();
  const appliesCatchUpCutoff = HARVEST_CATCH_UP_CUTOFF >= harvestWeek.start && HARVEST_CATCH_UP_CUTOFF < harvestWeek.end;
  const harvestPeriodStart = appliesCatchUpCutoff ? HARVEST_CATCH_UP_CUTOFF : harvestWeek.start;
  const harvestWeekStartKey = localDateKey(harvestPeriodStart);
  const harvestWeekEnd = new Date(harvestWeek.end);
  harvestWeekEnd.setDate(harvestWeekEnd.getDate() - 1);
  const harvestWeekEndKey = localDateKey(harvestWeekEnd);
  const isInHarvestWeek = useCallback(value => {
    const key = localDateKey(value);
    return key && key >= harvestWeekStartKey && key <= harvestWeekEndKey;
  }, [harvestWeekEndKey, harvestWeekStartKey]);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const selectedDateStart = new Date(harvestDate);
  selectedDateStart.setHours(0, 0, 0, 0);
  const isRetroactive = selectedDateStart < todayStart;
  const weekDemand = useMemo(() => (products || []).map(product => {
    const weekOrders = (orders || []).filter(order => {
      if (!isInHarvestWeek(order.date || order.deliveryDate || order.createdAt)) return false;
      if (String(order.status).toUpperCase() === 'CANCELLED') return false;
      return !isPastWeek || String(order.status).toUpperCase() === 'DELIVERED';
    });
    const requested = weekOrders.reduce((sum, order) => sum + (order.items || [])
      .filter(item => String(item.productId) === String(product.id))
      .reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0);
    const harvested = (harvests || []).filter(harvest => {
      return String(harvest.productId) === String(product.id) && isInHarvestWeek(harvest.harvestDate || harvest.createdAt);
    }).reduce((sum, harvest) => sum + Number(harvest.tuppersCount || 0), 0);
    const delivered = weekOrders.filter(order => String(order.status).toUpperCase() === 'DELIVERED').reduce((sum, order) => sum + (order.items || [])
      .filter(item => String(item.productId) === String(product.id))
      .reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0);
    const open = Math.max(0, requested - delivered);
    const pendingRegistration = Math.max(0, delivered - harvested);
    const harvestedForOpenOrders = Math.max(0, harvested - delivered);
    const pendingProduction = Math.max(0, open - harvestedForOpenOrders);
    return { product, requested, delivered, open, harvested, pendingRegistration, pendingProduction, missing: pendingRegistration + pendingProduction, orderCount: weekOrders.filter(order => (order.items || []).some(item => String(item.productId) === String(product.id))).length };
  }).filter(row => row.requested > 0 || row.harvested > 0).sort((a, b) => b.missing - a.missing || b.requested - a.requested), [harvests, isInHarvestWeek, isPastWeek, orders, products]);
  const weekRequestedUnits = weekDemand.reduce((sum, row) => sum + row.requested, 0);
  const weekHarvestedUnits = weekDemand.reduce((sum, row) => sum + row.harvested, 0);
  const weekPendingHarvestUnits = weekDemand.reduce((sum, row) => sum + row.missing, 0);
  const retroactivePending = useMemo(() => (products || []).map(product => {
    const movements = (productMovements || []).filter(movement =>
      movement.type === 'ORDER'
      && String(movement.productId) === String(product.id)
      && Number(movement.quantity || 0) < 0
      && String(movement.referenceId || '').endsWith('|PENDING-TRACEABILITY')
    ).filter(movement => {
      const date = new Date(movement.createdAt);
      return date >= harvestPeriodStart && date < harvestWeek.end;
    });
    return {
      product,
      units: movements.reduce((sum, movement) => sum + Math.abs(Number(movement.quantity || 0)), 0),
      deliveries: movements.length
    };
  }).filter(row => row.units > 0).sort((a, b) => b.units - a.units), [harvestPeriodStart, harvestWeek.end, productMovements, products]);
  const retroactivePendingUnits = retroactivePending.reduce((sum, row) => sum + row.units, 0);
  const totalLinkableUnits = activeLines.reduce((sum, line) => {
    const pendingThisWeek = pendingOrdersForProduct(line.productId)
      .filter(movement => {
        const deliveryDate = new Date(movement.createdAt);
        return deliveryDate >= harvestPeriodStart && deliveryDate < harvestWeek.end;
      })
      .reduce((units, movement) => units + Math.abs(Number(movement.quantity || 0)), 0);
    return sum + Math.min(lineUnits(line), pendingThisWeek);
  }, 0);
  const totalCoveredOrderUnits = activeLines.reduce((sum, line) => {
    const demand = weekDemand.find(row => String(row.product.id) === String(line.productId));
    return sum + Math.min(lineUnits(line), Number(demand?.missing || 0));
  }, 0);

  if (!open) return null;

  const updateLine = (id, patch) => setLines(current => current.map(line => line.id === id ? { ...line, ...patch } : line));
  const removeLine = id => setLines(current => current.length === 1 ? [makeLine()] : current.filter(line => line.id !== id));
  const selectProductForLine = (lineId, productId, suggestedUnits = 0) => {
    const product = products?.find(item => String(item.id) === String(productId));
    const formats = packagingFor(product);
    updateLine(lineId, {
      productId,
      packagingQuantities: suggestedUnits > 0 && formats.length === 1 ? { [formats[0].id]: suggestedUnits } : {}
    });
  };
  const prepareDemandProduct = row => {
    const existing = lines.find(line => String(line.productId) === String(row.product.id));
    const formats = packagingFor(row.product);
    setEditingLineId(existing?.id || null);
    setPickerProductId(row.product.id);
    setPickerQuantities(existing?.packagingQuantities || (formats[0] ? { [formats[0].id]: row.missing } : {}));
    setPickerOpen(true);
  };
  const openProductPicker = line => {
    setEditingLineId(line?.id || null);
    setPickerProductId(line?.productId || '');
    setPickerQuantities(line?.packagingQuantities || {});
    setPickerOpen(true);
  };
  const choosePickerProduct = productId => {
    const product = products.find(item => String(item.id) === String(productId));
    const formats = packagingFor(product);
    const recommendation = weekDemand.find(row => String(row.product.id) === String(productId))?.missing || 0;
    setPickerProductId(productId);
    setPickerQuantities(recommendation > 0 && formats.length === 1 ? { [formats[0].id]: recommendation } : {});
  };
  const savePickerProduct = () => {
    const units = Object.values(pickerQuantities).reduce((sum, quantity) => sum + Number(quantity || 0), 0);
    if (!pickerProductId || units <= 0) {
      Swal.fire('Faltan datos', 'Selecciona una variedad o mix e indica al menos un táper.', 'warning');
      return;
    }
    if (editingLineId) {
      updateLine(editingLineId, { productId: pickerProductId, packagingQuantities: pickerQuantities });
    } else {
      const blank = lines.find(line => !line.productId && lineUnits(line) === 0);
      if (blank) updateLine(blank.id, { productId: pickerProductId, packagingQuantities: pickerQuantities });
      else setLines(current => [...current, { ...makeLine(), productId: pickerProductId, packagingQuantities: pickerQuantities }]);
    }
    setPickerOpen(false);
  };
  const demandPlanRows = weekDemand.filter(row => row.missing > 0
    && selectableProducts.some(product => String(product.id) === String(row.product.id)));
  const compatibleDemandUnits = demandPlanRows.reduce((sum, row) => sum + row.missing, 0);
  const unavailableDemandUnits = Math.max(0, weekPendingHarvestUnits - compatibleDemandUnits);
  const openDemandPlan = focusId => {
    const draft = {};
    demandPlanRows.forEach(row => {
      const existing = lines.find(line => String(line.productId) === String(row.product.id));
      const formats = packagingFor(row.product);
      const existingFormatId = Object.entries(existing?.packagingQuantities || {}).find(([, quantity]) => Number(quantity) > 0)?.[0];
      draft[row.product.id] = {
        units: existing ? lineUnits(existing) : row.missing,
        formatId: existingFormatId || formats[0]?.id || ''
      };
    });
    setDemandPlanDraft(draft);
    setDemandPlanFocusId(focusId || null);
    setDemandPlanOpen(true);
  };
  const applyDemandPlan = () => {
    const demandIds = new Set(demandPlanRows.map(row => String(row.product.id)));
    const manualLines = activeLines.filter(line => !demandIds.has(String(line.productId)));
    const plannedLines = demandPlanRows.flatMap(row => {
      const draft = demandPlanDraft[row.product.id];
      const units = Number(draft?.units || 0);
      if (units <= 0 || !draft?.formatId) return [];
      const existing = lines.find(line => String(line.productId) === String(row.product.id));
      return [{
        id: existing?.id || crypto.randomUUID(),
        productId: row.product.id,
        packagingQuantities: { [draft.formatId]: units }
      }];
    });
    setLines([...manualLines, ...plannedLines].length ? [...manualLines, ...plannedLines] : [makeLine()]);
    setDemandPlanOpen(false);
  };
  const nextStep = () => {
    if (step === 2 && selectedReadyCrops.length === 0) {
      Swal.fire('Selecciona cultivos', 'Marca al menos un cultivo listo para continuar.', 'warning');
      return;
    }
    if (step === 3 && activeLines.length === 0) {
      Swal.fire('Indica la producción', 'Selecciona al menos una variedad o mix e indica sus táperes.', 'warning');
      return;
    }
    setStep(current => Math.min(4, current + 1));
  };

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

  const submitHarvest = async () => {
    if (activeLines.length === 0) return Swal.fire('Faltan cosechas', 'Añade al menos un producto y sus táperes.', 'warning');
    if (selectedReadyCrops.length === 0) return Swal.fire('Faltan cultivos', 'Selecciona al menos un cultivo listo.', 'warning');
    const date = new Date(harvestDate);
    if (Number.isNaN(date.getTime()) || date > new Date()) return Swal.fire('Fecha no válida', 'Revisa la fecha real de cosecha.', 'warning');

    const uncovered = selectedReadyCrops.filter(crop => !usedVarietyIds.has(cropVarietyId(crop)));
    if (uncovered.length) {
      return Swal.fire('Cultivos sin asignar', `${uncovered.map(varietyName).join(', ')} están seleccionados pero no aparecen en ningún producto. Desmárcalos o añade su cosecha.`, 'warning');
    }
    const incomplete = activeLines.find(line => {
      const recipe = recipeIds(products.find(product => product.id === line.productId));
      const selectedRecipeVarieties = new Set(recipe.filter(id => selectedVarietyIds.has(id)));
      return selectedRecipeVarieties.size < Math.min(4, new Set(recipe).size);
    });
    if (incomplete) return Swal.fire('Producto no disponible', 'Una variedad individual necesita su cultivo y un mix necesita al menos cuatro variedades compatibles de su receta.', 'warning');

    const confirmation = await Swal.fire({
      title: '¿Registrar esta cosecha?',
      html: `<b>${totalSelectedTrays} bandejas</b> producirán <b>${totalUnits} táperes</b> en ${activeLines.length} cosecha${activeLines.length === 1 ? '' : 's'}.<br><small>Después podrás consultar los lotes en el histórico.</small>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar cosecha',
      cancelButtonText: 'Volver a revisar',
      confirmButtonColor: '#059669'
    });
    if (!confirmation.isConfirmed) return;

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
      <form className="harvest-session" onSubmit={event => { event.preventDefault(); if (step < 4) nextStep(); }}>
        <header className="harvest-session__header">
          <div><span>COSECHA DEL DÍA</span><h2>Registrar toda la producción</h2><p>Selecciona los cultivos utilizados y añade todos los productos obtenidos.</p></div>
          <button type="button" className="harvest-session__close" onClick={onClose}>×</button>
        </header>

        <nav className="harvest-wizard" aria-label="Pasos para registrar la cosecha">
          {[['1', 'Fecha'], ['2', 'Cultivos listos'], ['3', 'Variedades y táperes'], ['4', 'Revisar']].map(([number, label]) => (
            <button type="button" key={number} className={step === Number(number) ? 'is-active' : step > Number(number) ? 'is-complete' : ''} onClick={() => Number(number) < step && setStep(Number(number))}>
              <span>{step > Number(number) ? '✓' : number}</span><b>{label}</b>
            </button>
          ))}
        </nav>

        {step === 1 && <section className={`harvest-date-step ${isRetroactive ? 'is-retroactive' : ''}`}>
          <header><span>{isRetroactive ? '↶' : '✓'}</span><div><h3>{isRetroactive ? 'Cosecha retroactiva detectada' : 'Cosecha de hoy'}</h3><p>{isRetroactive ? 'Mostramos las ventas entregadas de esa semana que todavía no tienen cultivo ni lote vinculados.' : 'La fecha actual está seleccionada. Puedes continuar con los cultivos listos.'}</p></div></header>
          <label>Fecha real de cosecha<input autoFocus type="date" value={harvestDate.slice(0, 10)} max={localInputValue().slice(0, 10)} onChange={event => setHarvestDate(harvestDateWithCurrentTime(event.target.value))} /><small>La hora se guardará automáticamente al registrar la cosecha.</small></label>
          <div className="harvest-date-step__week"><small>PERIODO DE COSECHA</small><strong>{harvestPeriodStart.toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })} — {new Date(harvestWeek.end.getTime() - 86400000).toLocaleDateString('es-ES', { day: '2-digit', month: 'long' })}</strong><span>{readyCrops.length} cultivos listos disponibles</span></div>
          {isRetroactive && <div className="harvest-date-step__pending"><div><h4>Táperes vendidos sin cultivo vinculado</h4><strong>{retroactivePendingUnits} uds.</strong></div>{retroactivePending.map(row => <button type="button" key={row.product.id} onClick={() => prepareDemandProduct({ ...row, missing: row.units })}><span><b>{row.product.name}</b><small>{row.deliveries} movimiento{row.deliveries === 1 ? '' : 's'} de venta pendiente{row.deliveries === 1 ? '' : 's'}</small></span><strong>{row.units} uds.</strong><em>Preparar →</em></button>)}{!retroactivePending.length && <p>✓ No hay ventas entregadas sin cultivo para esta semana.</p>}</div>}
        </section>}

        {step === 3 && <section className="harvest-demand">
          <header>
            <div><span>{isPastWeek ? 'PERIODO PASADO' : 'PERIODO ACTUAL'}</span><h3>{harvestPeriodStart.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} — {new Date(harvestWeek.end.getTime() - 86400000).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</h3><p>{isPastWeek ? 'Cantidades realmente vendidas en el periodo de cosecha.' : 'Pedidos del periodo actual; los días ya incluidos en la cosecha anterior quedan fuera.'}</p></div>
            <div className="harvest-demand__totals"><span><small>{isPastWeek ? 'VENDIDO' : 'PEDIDO ESTA SEMANA'}</small><b>{weekRequestedUnits}</b></span><span><small>YA COSECHADO</small><b>{weekHarvestedUnits}</b></span><span className={weekPendingHarvestUnits > 0 ? 'has-missing' : ''}><small>QUEDA POR COSECHAR</small><b>{weekPendingHarvestUnits}</b></span></div>
          </header>
          {demandPlanRows.length > 0 && <button type="button" className="harvest-demand__prepare" onClick={() => openDemandPlan()}><span>⚡ Preparar cosecha según pedidos de la semana</span><strong>{demandPlanRows.length} productos compatibles · {compatibleDemandUnits} uds.</strong></button>}
          {unavailableDemandUnits > 0 && <p className="harvest-demand__warning">⚠ Hay {unavailableDemandUnits} unidades pedidas que no se pueden preparar con los cultivos seleccionados. Se muestran debajo para que puedas identificarlas.</p>}
          <div className="harvest-demand__products">
            {weekDemand.map(row => {
              const compatible = selectableProducts.some(product => String(product.id) === String(row.product.id));
              return <button type="button" key={row.product.id} disabled={!compatible} className={`${row.missing > 0 ? 'needs-harvest' : 'is-complete'} ${compatible ? '' : 'is-unavailable'}`} onClick={() => compatible && prepareDemandProduct(row)}>
                <span><b>{row.product.name}</b><small>{row.requested} uds. pedidas esta semana · {row.harvested} ya cosechadas</small></span>
                <strong>{row.missing > 0 ? `${row.missing} por cosechar` : '✓ Completo'}</strong>
              </button>;
            })}
            {!weekDemand.length && <p className="harvest-demand__empty">No hay pedidos registrados para esta semana. Puedes introducir la cosecha manualmente debajo.</p>}
          </div>
          <small className="harvest-demand__hint">Pulsa un producto para editarlo por separado o prepara todos los compatibles con los cultivos seleccionados.</small>
        </section>}

        <div className={`harvest-session__columns is-step-${step}`}>
          <section className="harvest-session__crops">
            <div className="harvest-session__title"><div><span>2</span><h3>¿Qué bandejas se han cosechado?</h3></div><div className="harvest-session__crop-actions"><button type="button" onClick={() => setSelectedCropTrays(Object.fromEntries(readyCrops.map(crop => [crop.id, Number(crop.traysCount || crop.trays || 0)])))}>Seleccionar todas</button><button type="button" onClick={() => setSelectedCropTrays(Object.fromEntries(readyCrops.map(crop => [crop.id, 0])))}>Limpiar</button><strong>{totalSelectedTrays} bandejas</strong></div></div>
            <p>Están marcados los cultivos previstos para la semana elegida. Ajusta las bandejas reales.</p>
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
            <div className="harvest-session__title"><div><span>3</span><h3>Variedades y táperes obtenidos</h3></div><strong>{totalUnits} unidades</strong></div>
            <p>Añade cada variedad o mix una sola vez e indica sus formatos.</p>
            <div className="harvest-products-simple">
              {activeLines.map(line => {
                const product = products.find(item => String(item.id) === String(line.productId));
                return <article key={line.id}><div><b>{harvestProductName(product?.name)}</b><span>{Object.entries(line.packagingQuantities).filter(([, quantity]) => Number(quantity) > 0).map(([articleId, quantity]) => `${quantity} × ${articles.find(article => article.id === articleId)?.name || 'envase'}`).join(' · ')}</span></div><strong>{lineUnits(line)}<small> táperes</small></strong><button type="button" onClick={() => openProductPicker(line)}>Editar</button><button type="button" className="is-delete" onClick={() => removeLine(line.id)}>×</button></article>;
              })}
              {!activeLines.length && <div className="harvest-products-simple__empty"><span>🥗</span><b>Todavía no has añadido ninguna cosecha</b><small>Pulsa el botón para elegir una variedad individual o un mix.</small></div>}
              <button type="button" className="harvest-products-simple__add" onClick={() => openProductPicker()}>＋ Añadir cosecha</button>
            </div>
            <div className="harvest-session__line-list">
              {lines.map((line, lineIndex) => {
                const product = products?.find(item => item.id === line.productId);
                const recipe = recipeIds(product);
                const producedUnits = lineUnits(line);
                const demand = weekDemand.find(row => String(row.product.id) === String(line.productId));
                const selectedElsewhere = new Set(lines.filter(other => other.id !== line.id && other.productId).map(other => String(other.productId)));
                const pendingMovements = pendingOrdersForProduct(line.productId);
                const deliveryGroups = pendingDeliveryGroups(pendingMovements);
                const pendingUnits = pendingMovements.reduce((sum, movement) => sum + Math.abs(Number(movement.quantity || 0)), 0);
                const weekPendingUnits = pendingMovements
                  .filter(movement => {
                    const deliveryDate = new Date(movement.createdAt);
                    return deliveryDate >= harvestPeriodStart && deliveryDate < harvestWeek.end;
                  })
                  .reduce((sum, movement) => sum + Math.abs(Number(movement.quantity || 0)), 0);
                const olderPendingUnits = Math.max(0, pendingUnits - weekPendingUnits);
                const linkedUnits = Math.min(producedUnits, weekPendingUnits);
                const reservedUnits = Math.min(Math.max(0, producedUnits - linkedUnits), Number(demand?.pendingProduction || 0));
                const surplusUnits = Math.max(0, producedUnits - linkedUnits - reservedUnits);
                return <article className="harvest-line" key={line.id}>
                  <div className="harvest-line__top"><b>Cosecha {lineIndex + 1}</b><button type="button" onClick={() => removeLine(line.id)}>Eliminar</button></div>
                  <select value={line.productId} onChange={event => {
                    const productId = event.target.value;
                    const recommendation = weekDemand.find(row => String(row.product.id) === String(productId))?.missing || 0;
                    selectProductForLine(line.id, productId, recommendation);
                  }}>
                    <option value="">Seleccionar variedad o mix…</option>
                    {selectableProducts.filter(item => !selectedElsewhere.has(String(item.id)) || String(item.id) === String(line.productId)).map(item => <option key={item.id} value={item.id}>{item.name}{recipeIds(item).length > 1 ? ' · Mix' : ' · Variedad individual'}</option>)}
                  </select>
                  {!product && selectableProducts.length === 0 && <div className="harvest-line__no-deliveries">Los cultivos seleccionados no permiten elaborar ningún producto configurado. Vuelve al paso anterior y revisa las bandejas.</div>}
                  {product && <>
                    <div className="harvest-line__recipe">{recipe.map(id => <span key={id}>{seedVarieties?.find(item => item.id === id)?.name || 'Variedad'}</span>)}</div>
                    <div className={`harvest-line__need ${demand?.missing > 0 ? 'has-missing' : 'is-covered'}`}>
                      <div><span>{isPastWeek ? 'VENDIDOS ESTA SEMANA' : 'PEDIDOS ESTA SEMANA'}</span><strong>{demand?.requested || 0}</strong></div>
                      <div><span>YA COSECHADOS</span><strong>{demand?.harvested || 0}</strong></div>
                      <div><span>QUEDA POR COSECHAR</span><strong>{demand?.missing > 0 ? `${demand.missing} táperes` : 'Completo'}</strong><small>{demand?.missing > 0 ? 'según todos los pedidos de la semana' : 'los pedidos de la semana ya están cubiertos'}</small></div>
                    </div>
                    <div className="harvest-line__formats">
                      {packagingFor(product).map(format => {
                        const stock = (stockEntries || []).filter(entry => entry.articleId === format.id).reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
                        return <label key={format.id}><span>{format.name}<small>{stock} disponibles</small></span><input type="number" min="0" placeholder="0" value={line.packagingQuantities[format.id] || ''} onChange={event => updateLine(line.id, { packagingQuantities: { ...line.packagingQuantities, [format.id]: Math.max(0, Number(event.target.value || 0)) } })} /></label>;
                      })}
                    </div>
                    <div className="harvest-line__allocation">
                      <div className="is-linked"><span>SE VINCULAN AHORA</span><strong>{linkedUnits} uds.</strong><small>pedidos ya entregados</small></div>
                      <div className="is-reserved"><span>RESERVADAS PARA PEDIDOS</span><strong>{reservedUnits} uds.</strong><small>pedidos abiertos de la semana</small></div>
                      <div className="is-surplus"><span>STOCK LIBRE</span><strong>{surplusUnits} uds.</strong><small>sin reservar</small></div>
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
          </section>
        </div>

        {step === 4 && <section className="harvest-review">
          <header><span>✓</span><div><h3>Revisa la cosecha</h3><p>Comprueba cultivos, productos y vinculación antes de guardar.</p></div></header>
          <div className="harvest-review__totals"><article><small>CULTIVOS</small><strong>{selectedReadyCrops.length}</strong><span>{totalSelectedTrays} bandejas</span></article><article><small>PRODUCCIÓN</small><strong>{totalUnits}</strong><span>táperes en {activeLines.length} producto{activeLines.length === 1 ? '' : 's'}</span></article><article><small>PEDIDOS CUBIERTOS</small><strong>{totalCoveredOrderUnits}</strong><span>{totalLinkableUnits} se vinculan ahora</span></article></div>
          <div className="harvest-review__content">
            <div><h4>Cultivos utilizados <button type="button" onClick={() => setStep(2)}>Modificar</button></h4>{selectedReadyCrops.map(crop => <p key={crop.id}><b>{varietyName(crop)}</b><span>{selectedCropTrays[crop.id]} bandejas · {crop.batchNumber || 'sin lote'}</span></p>)}</div>
            <div><h4>Productos obtenidos <button type="button" onClick={() => setStep(3)}>Modificar</button></h4>{activeLines.map(line => { const product = products.find(item => item.id === line.productId); return <p key={line.id}><b>{harvestProductName(product?.name)}</b><span>{Object.entries(line.packagingQuantities).filter(([, quantity]) => Number(quantity) > 0).map(([articleId, quantity]) => `${quantity} × ${articles.find(article => article.id === articleId)?.name || 'envase'}`).join(' · ')}</span></p>; })}</div>
          </div>
          <label className="harvest-session__notes">Comentario opcional<textarea rows="2" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Observaciones de la cosecha…" /></label>
        </section>}

        {pickerOpen && <div className="harvest-picker-overlay">
          <section className="harvest-picker">
            <header><div><span>AÑADIR COSECHA</span><h3>{pickerProductId ? 'Indica los táperes obtenidos' : 'Elige variedad o mix'}</h3></div><button type="button" onClick={() => setPickerOpen(false)}>×</button></header>
            <div className="harvest-picker__products">
              {selectableProducts.filter(product => {
                const selectedLine = lines.find(line => line.id === editingLineId);
                return !lines.some(line => line.id !== selectedLine?.id && String(line.productId) === String(product.id));
              }).map(product => <button type="button" key={product.id} className={String(pickerProductId) === String(product.id) ? 'is-selected' : ''} onClick={() => choosePickerProduct(product.id)}><b>{harvestProductName(product.name)}</b><small>{recipeIds(product).length > 1 ? `Mix · ${recipeIds(product).map(id => seedVarieties.find(item => item.id === id)?.name).filter(Boolean).join(', ')}` : 'Variedad individual'}</small></button>)}
            </div>
            {pickerProductId && <div className="harvest-picker__formats"><h4>¿Cuántos táperes has obtenido?</h4>{packagingFor(products.find(item => String(item.id) === String(pickerProductId))).map(format => <label key={format.id}><span><b>{format.name}</b><small>{(stockEntries || []).filter(entry => entry.articleId === format.id).reduce((sum, entry) => sum + Number(entry.quantity || 0), 0)} envases disponibles</small></span><input type="number" min="0" placeholder="0" value={pickerQuantities[format.id] || ''} onChange={event => setPickerQuantities(current => ({ ...current, [format.id]: Math.max(0, Number(event.target.value || 0)) }))} /></label>)}</div>}
            <footer><button type="button" onClick={() => setPickerOpen(false)}>Cancelar</button><button type="button" className="is-primary" onClick={savePickerProduct}>{editingLineId ? 'Guardar cambios' : 'Añadir cosecha'}</button></footer>
          </section>
        </div>}

        {demandPlanOpen && <div className="harvest-demand-plan-overlay">
          <section className="harvest-demand-plan">
            <header><div><span>COSECHA DESDE PEDIDOS</span><h3>Todas las cosechas a registrar</h3><p>Las cantidades pedidas están rellenadas como mínimo recomendado. Puedes aumentar o reducir cualquier fila.</p></div><button type="button" onClick={() => setDemandPlanOpen(false)}>×</button></header>
            <div className="harvest-demand-plan__grid">
              {demandPlanRows.map(row => {
                const draft = demandPlanDraft[row.product.id] || {};
                const formats = packagingFor(row.product);
                const units = Number(draft.units || 0);
                const covered = Math.min(units, row.missing);
                const free = Math.max(0, units - row.missing);
                return <article key={row.product.id} className={String(demandPlanFocusId) === String(row.product.id) ? 'is-focused' : ''}>
                  <div className="harvest-demand-plan__product"><div><b>{harvestProductName(row.product.name)}</b><small>{row.orderCount} pedido{row.orderCount === 1 ? '' : 's'} · {row.harvested} ya cosechados</small></div><strong>{row.missing} solicitados</strong></div>
                  <label><span>Cantidad a cosechar</span><input type="number" min="0" step="1" value={draft.units ?? ''} onChange={event => setDemandPlanDraft(current => ({ ...current, [row.product.id]: { ...current[row.product.id], units: Math.max(0, Number(event.target.value || 0)) } }))} /></label>
                  <label><span>Formato de envase</span><select value={draft.formatId || ''} onChange={event => setDemandPlanDraft(current => ({ ...current, [row.product.id]: { ...current[row.product.id], formatId: event.target.value } }))}>{formats.map(format => <option key={format.id} value={format.id}>{format.name}</option>)}</select></label>
                  <div className="harvest-demand-plan__allocation"><span><b>{covered}</b> para pedidos</span><span><b>{free}</b> stock libre</span></div>
                </article>;
              })}
            </div>
            <footer><div><b>{demandPlanRows.length} productos</b><span>{Object.values(demandPlanDraft).reduce((sum, draft) => sum + Number(draft.units || 0), 0)} unidades preparadas</span></div><button type="button" onClick={() => setDemandPlanOpen(false)}>Cancelar</button><button type="button" className="is-primary" onClick={applyDemandPlan}>Pasar al registro de cosechas</button></footer>
          </section>
        </div>}

        <footer className="harvest-session__footer">
          <div><strong>{activeLines.length} productos · {totalUnits} táperes</strong><span>{totalSelectedTrays} bandejas · {totalUnits > 0 ? `${totalCoveredOrderUnits} uds. cubren pedidos · ${Math.max(0, totalUnits - totalCoveredOrderUnits)} libres` : `${remainingTrays} bandejas quedarán pendientes`}</span></div>
          <button type="button" onClick={step === 1 ? onClose : () => setStep(current => current - 1)}>{step === 1 ? 'Cancelar' : '← Volver'}</button>
          {step < 4 ? <button type="button" className="harvest-session__next" onClick={nextStep}>Continuar →</button> : <button type="button" className="harvest-session__submit" onClick={submitHarvest} disabled={saving || !readyCrops.length}>
            {saving
              ? 'Registrando todo…'
              : isPastWeek
                ? `Registrar cosecha pasada · cubrir ${totalCoveredOrderUnits} uds.`
                : `Registrar cosecha · cubrir ${totalCoveredOrderUnits} uds.`}
          </button>}
        </footer>
      </form>
    </div>
  );
}
