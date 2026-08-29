import { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { useData } from '../context/DataContext';

const localDateTimeValue = value => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const todayAtCurrentTime = () => localDateTimeValue(new Date());
const localDateKey = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function SowingTaskQueue({ summaryOnly = false, onOpen }) {
  const {
    sowingTasks, syncSowingTasks, updateSowingTask, cancelSowingTask, completeSowingTasks,
    cropTypes, seedVarieties, articles, stockLots
  } = useData();
  const syncStarted = useRef(false);
  const [edits, setEdits] = useState({});
  const [deselectedIds, setDeselectedIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (syncStarted.current) return;
    syncStarted.current = true;
    syncSowingTasks()
      .catch(error => {
        console.error('No se pudieron sincronizar las siembras previstas:', error);
        setLoadError(error.message || 'No se pudieron cargar las siembras previstas.');
      })
      .finally(() => setLoading(false));
  }, [syncSowingTasks]);

  const pendingTasks = useMemo(() => (sowingTasks || [])
    .filter(task => task.status === 'PENDING')
    .sort((a, b) => String(a.plannedDate).localeCompare(String(b.plannedDate))), [sowingTasks]);
  const groupedTasks = useMemo(() => Object.entries(pendingTasks.reduce((groups, task) => {
    if (!groups[task.plannedDate]) groups[task.plannedDate] = [];
    groups[task.plannedDate].push(task);
    return groups;
  }, {})), [pendingTasks]);

  const cropTypeFor = task => cropTypes?.find(type => String(type.id) === String(task.cropTypeId));
  const varietyNameFor = task => {
    const cropType = cropTypeFor(task);
    return seedVarieties?.find(variety => String(variety.id) === String(cropType?.varietyId))?.name
      || cropType?.name
      || 'Variedad sin ficha';
  };
  const compatibleLots = task => {
    const cropType = cropTypeFor(task);
    return (stockLots || []).filter(lot => {
      const article = articles?.find(item => String(item.id) === String(lot.articleId));
      return article?.type === 'SEMILLA'
        && String(article.varietyId) === String(cropType?.varietyId)
        && article.active !== false
        && Number(lot.remainingQuantity || 0) > 0;
    }).sort((a, b) => String(a.receivedAt || '').localeCompare(String(b.receivedAt || '')));
  };
  const valueFor = (task, field) => edits[task.id]?.[field] ?? task[field];
  const setEdit = (taskId, field, value) => setEdits(previous => ({
    ...previous,
    [taskId]: { ...previous[taskId], [field]: value }
  }));
  const persistField = async (task, field, value) => {
    try {
      const persisted = field === 'actualPlantedAt' && value ? new Date(value).toISOString() : value;
      await updateSowingTask(task.id, { [field]: persisted });
    } catch (error) {
      Swal.fire('No se pudo guardar', error.message || 'Revisa el dato e inténtalo de nuevo.', 'error');
    }
  };

  const toggleSelected = taskId => setDeselectedIds(previous => {
    const next = new Set(previous);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    return next;
  });

  const cancelTask = async task => {
    const result = await Swal.fire({
      title: '¿Eliminar esta siembra pendiente?',
      text: `La previsión de ${varietyNameFor(task)} quedará cancelada y no volverá a aparecer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, cancelar siembra',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#dc2626'
    });
    if (!result.isConfirmed) return;
    try {
      await cancelSowingTask(task.id);
    } catch (error) {
      Swal.fire('No se pudo cancelar', error.message, 'error');
    }
  };

  const executeSelected = async (scope = pendingTasks) => {
    const selected = scope.filter(task => !deselectedIds.has(task.id));
    if (!selected.length) return;
    const payload = selected.map(task => ({
      taskId: task.id,
      trays: Number(valueFor(task, 'trays')),
      stockLotId: valueFor(task, 'stockLotId') || null,
      actualPlantedAt: new Date(valueFor(task, 'actualPlantedAt')).toISOString()
    }));
    const invalid = payload.find(item => !item.stockLotId || item.trays <= 0 || !item.actualPlantedAt);
    if (invalid) {
      Swal.fire('Faltan datos', 'Todas las siembras seleccionadas necesitan bandejas, fecha real y lote.', 'warning');
      return;
    }
    const confirmation = await Swal.fire({
      title: `¿Realizar ${payload.length} siembra${payload.length === 1 ? '' : 's'}?`,
      text: 'Se crearán los cultivos y se descontará la semilla de cada lote en una sola operación.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Realizar siembras',
      cancelButtonText: 'Revisar',
      confirmButtonColor: '#059669'
    });
    if (!confirmation.isConfirmed) return;
    setSaving(true);
    try {
      const result = await completeSowingTasks(payload);
      setEdits({});
      setDeselectedIds(new Set());
      await Swal.fire({
        title: 'Siembras registradas',
        text: `Se han creado ${result?.completed || payload.length} cultivos con su fecha y lote correspondientes.`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
    } catch (error) {
      Swal.fire('No se realizaron las siembras', error.message || 'No se ha aplicado ningún cambio.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '1rem', marginBottom: '1rem', borderRadius: '14px', background: '#f0fdf4', color: '#166534' }}>⏳ Preparando siembras pendientes…</div>;
  if (loadError) return <div style={{ padding: '1rem', marginBottom: '1rem', borderRadius: '14px', background: '#fef2f2', color: '#991b1b' }}>⚠️ {loadError}</div>;
  if (!pendingTasks.length) return null;

  const todayKey = localDateKey();
  const overdueCount = pendingTasks.filter(task => task.plannedDate < todayKey).length;
  const selectedCount = pendingTasks.filter(task => !deselectedIds.has(task.id)).length;
  const allSelected = selectedCount === pendingTasks.length;
  const toggleAll = () => setDeselectedIds(allSelected ? new Set(pendingTasks.map(task => task.id)) : new Set());

  if (summaryOnly) {
    const todayTasks = pendingTasks.filter(task => task.plannedDate === todayKey);
    if (!todayTasks.length) return null;
    return (
      <button type="button" onClick={onOpen} style={{ width: '100%', marginBottom: '1.25rem', padding: '1rem 1.15rem', border: '1px solid #bbf7d0', borderLeft: '6px solid #22c55e', borderRadius: '14px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', textAlign: 'left', cursor: 'pointer', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <span style={{ width: '42px', height: '42px', display: 'grid', placeItems: 'center', borderRadius: '12px', background: '#dcfce7', fontSize: '1.35rem' }}>🌱</span>
          <span><strong style={{ display: 'block', color: '#14532d', fontSize: '1.05rem' }}>Siembras del día</strong><small style={{ display: 'block', color: '#64748b', marginTop: '0.2rem' }}>{todayTasks.length} variedades · {todayTasks.reduce((sum, task) => sum + Number(task.trays || 0), 0)} bandejas previstas</small></span>
        </span>
        <span style={{ color: '#15803d', fontWeight: 800, whiteSpace: 'nowrap' }}>Ir a cultivos →</span>
      </button>
    );
  }

  return (
    <section style={{ marginBottom: '1.5rem', border: '1px solid #dbe4df', borderRadius: '14px', background: 'white', overflow: 'hidden', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.05)' }}>
      <header style={{ padding: '0.9rem 1rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', background: '#f8faf9', borderBottom: '1px solid #e2e8f0' }}>
        <div>
          <h3 style={{ margin: 0, color: '#14532d', fontSize: '1.05rem' }}>🌱 Siembras pendientes de validar</h3>
          <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>{pendingTasks.length} siembras{overdueCount ? ` · ${overdueCount} atrasadas` : ''}. Desmarca una variedad para dejarla pendiente.</p>
        </div>
        <button type="button" className="btn btn-success" disabled={!selectedCount || saving} onClick={() => executeSelected()}>
          {saving ? 'Realizando…' : `Realizar siembras seleccionadas (${selectedCount})`}
        </button>
      </header>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: '920px', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: '#f8fafc', color: '#475569', fontSize: '0.72rem', textTransform: 'uppercase' }}>
            <tr>
              <th style={{ padding: '0.65rem', width: '42px' }}><input type="checkbox" checked={allSelected} onChange={toggleAll} title={allSelected ? 'Desmarcar todas' : 'Seleccionar todas'} style={{ transform: 'scale(1.15)', accentColor: '#16a34a' }} /></th>
              <th style={{ padding: '0.65rem' }}>Variedad</th>
              <th style={{ padding: '0.65rem', width: '105px' }}>Bandejas</th>
              <th style={{ padding: '0.65rem', width: '220px' }}>Fecha real</th>
              <th style={{ padding: '0.65rem', minWidth: '250px' }}>Lote de semilla</th>
              <th style={{ padding: '0.65rem', width: '90px' }}></th>
            </tr>
          </thead>
          <tbody>
            {groupedTasks.map(([plannedDate, dayTasks]) => {
              const isOverdueDay = plannedDate < todayKey;
              return [
                <tr key={`date-${plannedDate}`}>
                  <td colSpan="6" style={{ padding: '0.55rem 0.75rem', background: isOverdueDay ? '#fff7ed' : '#ecfdf5', color: isOverdueDay ? '#c2410c' : '#166534', fontWeight: 800, fontSize: '0.82rem', textTransform: 'capitalize', borderTop: '1px solid #e2e8f0' }}>
                    {isOverdueDay ? '⚠️ Pendientes atrasadas' : plannedDate === todayKey ? 'Hoy' : 'Previstas'} · {new Date(`${plannedDate}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </td>
                </tr>,
                ...dayTasks.map(task => {
                  const lots = compatibleLots(task);
                  const trays = Number(valueFor(task, 'trays') || 0);
                  const cropType = cropTypeFor(task);
                  const requiredSeed = trays * Number(cropType?.seedGrams || 0);
                  const selectedLot = lots.find(lot => String(lot.id) === String(valueFor(task, 'stockLotId')));
                  const insufficient = selectedLot && Number(selectedLot.remainingQuantity || 0) < requiredSeed;
                  const disabled = deselectedIds.has(task.id);
                  const cellStyle = { padding: '0.55rem 0.65rem', borderTop: '1px solid #eef2f7', opacity: disabled ? 0.55 : 1 };
                  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.55rem', border: '1px solid #cbd5e1', borderRadius: '7px', background: 'white', color: '#1e293b' };
                  return (
                    <tr key={task.id} style={{ background: disabled ? '#f8fafc' : 'white' }}>
                      <td style={cellStyle}><input type="checkbox" checked={!disabled} onChange={() => toggleSelected(task.id)} title={disabled ? 'Seleccionar para sembrar' : 'Dejar pendiente'} style={{ transform: 'scale(1.15)', accentColor: '#16a34a' }} /></td>
                      <td style={cellStyle}><strong style={{ color: '#1e293b' }}>{varietyNameFor(task)}</strong>{disabled && <span style={{ marginLeft: '0.45rem', padding: '0.15rem 0.35rem', borderRadius: '999px', background: '#fef3c7', color: '#92400e', fontSize: '0.68rem', fontWeight: 800 }}>QUEDARÁ PENDIENTE</span>}<small style={{ display: 'block', marginTop: '0.15rem', color: '#64748b' }}>{Number(cropType?.seedGrams || 0)} g/bandeja · {requiredSeed.toLocaleString('es-ES')} g</small></td>
                      <td style={cellStyle}><input type="number" min="1" step="1" value={valueFor(task, 'trays')} onChange={event => setEdit(task.id, 'trays', event.target.value)} onBlur={event => persistField(task, 'trays', Number(event.target.value))} style={inputStyle} /></td>
                      <td style={cellStyle}><input type="datetime-local" value={localDateTimeValue(valueFor(task, 'actualPlantedAt'))} onChange={event => setEdit(task.id, 'actualPlantedAt', event.target.value)} onBlur={event => persistField(task, 'actualPlantedAt', event.target.value)} style={inputStyle} /><button type="button" onClick={() => { const now = todayAtCurrentTime(); setEdit(task.id, 'actualPlantedAt', now); persistField(task, 'actualPlantedAt', now); }} style={{ border: 0, padding: '0.2rem 0 0', background: 'transparent', color: '#2563eb', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>Usar ahora</button></td>
                      <td style={cellStyle}><select value={valueFor(task, 'stockLotId') || ''} onChange={event => { setEdit(task.id, 'stockLotId', event.target.value); persistField(task, 'stockLotId', event.target.value); }} style={inputStyle}><option value="">Seleccionar lote…</option>{lots.map(lot => <option key={lot.id} value={lot.id}>{lot.supplierBatch} · {Number(lot.remainingQuantity).toLocaleString('es-ES')} g disponibles</option>)}</select>{insufficient && <small style={{ display: 'block', color: '#dc2626', marginTop: '0.2rem' }}>Stock insuficiente</small>}</td>
                      <td style={cellStyle}><button type="button" onClick={() => cancelTask(task)} title="Eliminar propuesta" style={{ border: 0, background: '#fee2e2', color: '#b91c1c', borderRadius: '7px', padding: '0.45rem 0.55rem', cursor: 'pointer', fontWeight: 700 }}>Eliminar</button></td>
                    </tr>
                  );
                })
              ];
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
