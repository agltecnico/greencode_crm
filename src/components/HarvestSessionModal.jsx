import { useEffect, useMemo, useState } from 'react';
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

const makeLine = () => ({ id: crypto.randomUUID(), productId: '', packagingQuantities: {} });

export default function HarvestSessionModal({ open, onClose }) {
  const {
    crops, cropTypes, seedVarieties, articles, products, harvests, stockEntries,
    registerHarvestSession
  } = useData();
  const [harvestDate, setHarvestDate] = useState(localInputValue());
  const [selectedCrops, setSelectedCrops] = useState({});
  const [lines, setLines] = useState([makeLine()]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const readyCrops = useMemo(() => (crops || [])
    .filter(crop => crop.status === 'READY' && Number(crop.traysCount || crop.trays || 0) > 0)
    .sort((a, b) => new Date(a.datePlanted || a.plantedAt) - new Date(b.datePlanted || b.plantedAt)), [crops]);

  useEffect(() => {
    if (!open) return;
    setHarvestDate(localInputValue());
    setSelectedCrops(Object.fromEntries(readyCrops.map(crop => [crop.id, true])));
    setLines([makeLine()]);
    setNotes('');
  }, [open, readyCrops]);

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
  const activeLines = lines.filter(line => line.productId && lineUnits(line) > 0);
  const usedVarietyIds = new Set(activeLines.flatMap(line => recipeIds(products?.find(product => product.id === line.productId))));
  const selectedReadyCrops = readyCrops.filter(crop => selectedCrops[crop.id]);
  const totalSelectedTrays = selectedReadyCrops.reduce((sum, crop) => sum + Number(crop.traysCount || crop.trays || 0), 0);
  const totalUnits = activeLines.reduce((sum, line) => sum + lineUnits(line), 0);

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
        const trays = Number(crop.traysCount || crop.trays || 0);
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
          <label>Fecha real<input type="datetime-local" value={harvestDate} max={localInputValue()} onChange={event => setHarvestDate(event.target.value)} /></label>
          <button type="button" className="harvest-session__close" onClick={onClose}>×</button>
        </header>

        <div className="harvest-session__columns">
          <section className="harvest-session__crops">
            <div className="harvest-session__title"><div><span>1</span><h3>Cultivos listos</h3></div><strong>{totalSelectedTrays} bandejas</strong></div>
            <p>Están seleccionados por defecto. Desmarca lo que deba seguir pendiente.</p>
            <div className="harvest-session__crop-list">
              {readyCrops.map(crop => {
                const selected = Boolean(selectedCrops[crop.id]);
                const covered = selected && usedVarietyIds.has(cropVarietyId(crop));
                return <label key={crop.id} className={`harvest-crop ${selected ? 'is-selected' : ''} ${covered ? 'is-used' : ''}`}>
                  <input type="checkbox" checked={selected} onChange={() => setSelectedCrops(current => ({ ...current, [crop.id]: !selected }))} />
                  <div><strong>{varietyName(crop)}</strong><small>Sembrado {new Date(crop.datePlanted || crop.plantedAt).toLocaleDateString('es-ES')} · lote {crop.batchNumber || 'sin lote'}</small></div>
                  <b>{crop.traysCount || crop.trays} <small>bandejas</small></b>
                  {covered && <em>Asignada</em>}
                </label>;
              })}
              {!readyCrops.length && <div className="harvest-session__empty">No hay cultivos listos para cosechar.</div>}
            </div>
          </section>

          <section className="harvest-session__production">
            <div className="harvest-session__title"><div><span>2</span><h3>Táperes obtenidos</h3></div><strong>{totalUnits} unidades</strong></div>
            <p>Añade una línea para cada variedad o mix producido.</p>
            <div className="harvest-session__line-list">
              {lines.map((line, lineIndex) => {
                const product = products?.find(item => item.id === line.productId);
                const recipe = recipeIds(product);
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
                  </>}
                </article>;
              })}
            </div>
            <button className="harvest-session__add" type="button" onClick={() => setLines(current => [...current, makeLine()])}>＋ Añadir otra cosecha</button>
            <label className="harvest-session__notes">Comentario opcional<textarea rows="2" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Observaciones de la cosecha…" /></label>
          </section>
        </div>

        <footer className="harvest-session__footer">
          <div><strong>{activeLines.length} productos · {totalUnits} táperes</strong><span>{selectedReadyCrops.length} cultivos seleccionados · {readyCrops.length - selectedReadyCrops.length} quedan pendientes</span></div>
          <button type="button" onClick={onClose}>Cancelar</button>
          <button type="submit" disabled={saving || !readyCrops.length}>{saving ? 'Registrando todo…' : 'Registrar cosecha completa'}</button>
        </footer>
      </form>
    </div>
  );
}
