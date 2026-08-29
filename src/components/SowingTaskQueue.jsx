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

export default function SowingTaskQueue() {
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

  return (
    <section style={{ marginBottom: '2rem', border: '1px solid #bbf7d0', borderRadius: '18px', background: '#f0fdf4', overflow: 'hidden', boxShadow: '0 8px 24px rgba(22, 101, 52, 0.08)' }}>
      <header style={{ padding: '1.1rem 1.25rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #bbf7d0' }}>
        <div>
          <h3 style={{ margin: 0, color: '#14532d', fontSize: '1.2rem' }}>🌱 Siembras pendientes</h3>
          <p style={{ margin: '0.3rem 0 0', color: '#4d7c0f' }}>{pendingTasks.length} previstas{overdueCount ? ` · ${overdueCount} atrasadas` : ''}. La fecha prevista siempre se conserva.</p>
        </div>
        <button type="button" className="btn btn-success" disabled={!selectedCount || saving} onClick={() => executeSelected()}>
          {saving ? 'Realizando…' : `Realizar ${selectedCount} siembra${selectedCount === 1 ? '' : 's'}`}
        </button>
      </header>
      <div style={{ display: 'grid', gap: '0.75rem', padding: '1rem' }}>
        {groupedTasks.map(([plannedDate, dayTasks]) => {
          const selectedForDay = dayTasks.filter(task => !deselectedIds.has(task.id)).length;
          const isOverdueDay = plannedDate < todayKey;
          return <div key={plannedDate} style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', padding: '0.2rem 0.15rem' }}>
              <strong style={{ color: isOverdueDay ? '#c2410c' : '#166534', textTransform: 'capitalize' }}>
                {isOverdueDay ? '⚠️ Atrasadas' : plannedDate === todayKey ? '🎯 Hoy' : '📅 Previstas'} · {new Date(`${plannedDate}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
              </strong>
              <button type="button" className="btn btn-secondary" disabled={!selectedForDay || saving} onClick={() => executeSelected(dayTasks)} style={{ padding: '0.45rem 0.75rem' }}>
                Realizar las {selectedForDay} de este día
              </button>
            </div>
            {dayTasks.map(task => {
          const lots = compatibleLots(task);
          const trays = Number(valueFor(task, 'trays') || 0);
          const cropType = cropTypeFor(task);
          const requiredSeed = trays * Number(cropType?.seedGrams || 0);
          const selectedLot = lots.find(lot => String(lot.id) === String(valueFor(task, 'stockLotId')));
          const insufficient = selectedLot && Number(selectedLot.remainingQuantity || 0) < requiredSeed;
          const overdue = task.plannedDate < todayKey;
          return (
            <article key={task.id} style={{ padding: '1rem', background: 'white', border: `1px solid ${overdue ? '#fdba74' : '#d1fae5'}`, borderLeft: `5px solid ${overdue ? '#f97316' : '#22c55e'}`, borderRadius: '12px', opacity: deselectedIds.has(task.id) ? 0.62 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.75rem', marginBottom: '0.85rem' }}>
                <label style={{ display: 'flex', gap: '0.65rem', alignItems: 'start', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!deselectedIds.has(task.id)} onChange={() => toggleSelected(task.id)} style={{ marginTop: '0.25rem', transform: 'scale(1.2)', accentColor: '#16a34a' }} />
                  <span><strong style={{ color: '#1e293b', fontSize: '1.05rem' }}>{varietyNameFor(task)}</strong><small style={{ display: 'block', color: overdue ? '#c2410c' : '#64748b', marginTop: '0.2rem' }}>{overdue ? '⚠️ Atrasada · ' : ''}Prevista: {new Date(`${task.plannedDate}T12:00:00`).toLocaleDateString('es-ES')}</small></span>
                </label>
                <button type="button" onClick={() => cancelTask(task)} style={{ border: 0, background: '#fee2e2', color: '#b91c1c', borderRadius: '8px', padding: '0.45rem 0.65rem', cursor: 'pointer', fontWeight: 700 }}>Eliminar</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                <label style={{ color: '#475569', fontSize: '0.78rem', fontWeight: 700 }}>BANDEJAS
                  <input type="number" min="1" step="1" value={valueFor(task, 'trays')} onChange={event => setEdit(task.id, 'trays', event.target.value)} onBlur={event => persistField(task, 'trays', Number(event.target.value))} className="driver-input" style={{ marginTop: '0.3rem' }} />
                </label>
                <label style={{ color: '#475569', fontSize: '0.78rem', fontWeight: 700 }}>FECHA REAL DE SIEMBRA
                  <input type="datetime-local" value={localDateTimeValue(valueFor(task, 'actualPlantedAt'))} onChange={event => setEdit(task.id, 'actualPlantedAt', event.target.value)} onBlur={event => persistField(task, 'actualPlantedAt', event.target.value)} className="driver-input" style={{ marginTop: '0.3rem' }} />
                  <button type="button" onClick={() => { const now = todayAtCurrentTime(); setEdit(task.id, 'actualPlantedAt', now); persistField(task, 'actualPlantedAt', now); }} style={{ border: 0, padding: '0.25rem 0', background: 'transparent', color: '#2563eb', cursor: 'pointer', fontWeight: 700 }}>Usar ahora</button>
                </label>
                <label style={{ color: '#475569', fontSize: '0.78rem', fontWeight: 700 }}>LOTE DE SEMILLA
                  <select value={valueFor(task, 'stockLotId') || ''} onChange={event => { setEdit(task.id, 'stockLotId', event.target.value); persistField(task, 'stockLotId', event.target.value); }} className="driver-input" style={{ marginTop: '0.3rem' }}>
                    <option value="">Seleccionar lote…</option>
                    {lots.map(lot => <option key={lot.id} value={lot.id}>{lot.supplierBatch} · {Number(lot.remainingQuantity).toLocaleString('es-ES')} g</option>)}
                  </select>
                  <small style={{ display: 'block', marginTop: '0.3rem', color: insufficient ? '#dc2626' : '#64748b' }}>{requiredSeed.toLocaleString('es-ES')} g necesarios{insufficient ? ' · Stock insuficiente' : ''}</small>
                </label>
              </div>
            </article>
          );
            })}
          </div>;
        })}
      </div>
    </section>
  );
}
