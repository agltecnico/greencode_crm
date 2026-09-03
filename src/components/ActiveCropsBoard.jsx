import { useState } from 'react';

const PHASES = [
  { id: 'ALL', label: 'Todos', icon: '◉', color: '#334155', soft: '#f1f5f9' },
  { id: 'SOAKING', label: 'Remojo', icon: '◌', color: '#2563eb', soft: '#dbeafe' },
  { id: 'GERMINATING', label: 'Germinación', icon: '●', color: '#d97706', soft: '#fef3c7' },
  { id: 'DARKNESS', label: 'Oscuridad', icon: '◐', color: '#4f46e5', soft: '#e0e7ff' },
  { id: 'LIGHT', label: 'Luz', icon: '☀', color: '#0f766e', soft: '#ccfbf1' },
  { id: 'READY', label: 'Para cosechar', icon: '✓', color: '#15803d', soft: '#dcfce7' }
];

const cropStatus = crop => String(crop.status || 'GERMINATING').toUpperCase();

export default function ActiveCropsBoard({
  crops, cropTypes, statusFilter, onFilterChange, onAddTrays, onAdjust, onDelete,
  cycleDay, expectedHarvest, formatSowingDate
}) {
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const counts = Object.fromEntries(PHASES.map(phase => [phase.id,
    phase.id === 'ALL' ? crops.length : crops.filter(crop => cropStatus(crop) === phase.id).length
  ]));
  const visible = crops
    .filter(crop => statusFilter === 'ALL' || cropStatus(crop) === statusFilter)
    .sort((a, b) => new Date(a.datePlanted || a.plantedAt) - new Date(b.datePlanted || b.plantedAt));
  const grouped = [...visible.reduce((map, crop) => {
    const type = cropTypes?.find(item => item.id === crop.seedId || item.id === crop.cropTypeId);
    const key = String(type?.id || crop.cropTypeId || crop.seedId || 'unknown');
    const current = map.get(key) || { id: key, type, name: type?.name || 'Cultivo sin nombre', crops: [], trays: 0, phases: {} };
    const phaseId = cropStatus(crop);
    const trays = Number(crop.traysCount || crop.trays || 0);
    current.crops.push(crop);
    current.trays += trays;
    current.phases[phaseId] = (current.phases[phaseId] || 0) + trays;
    map.set(key, current);
    return map;
  }, new Map()).values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const selectedGroup = grouped.find(group => group.id === selectedGroupId);

  return (
    <section className="active-crops-board">
      <header className="active-crops-board__header">
        <div><h3>Cultivos activos</h3><p>Selecciona una fase para centrarte solo en ese trabajo.</p></div>
        <strong>{grouped.length} tipos · {visible.length} lotes · {visible.reduce((sum, crop) => sum + Number(crop.traysCount || crop.trays || 0), 0)} bandejas</strong>
      </header>

      <nav className="active-crops-phases" aria-label="Filtrar cultivos por fase">
        {PHASES.map(phase => (
          <button type="button" key={phase.id} className={statusFilter === phase.id ? 'is-active' : ''}
            style={{ '--phase-color': phase.color, '--phase-soft': phase.soft }} onClick={() => onFilterChange(phase.id)}>
            <i>{phase.icon}</i><span>{phase.label}</span><b>{counts[phase.id]}</b>
          </button>
        ))}
      </nav>

      <div className="active-crops-grid">
        {grouped.map(group => {
          const activePhases = PHASES.filter(phase => phase.id !== 'ALL' && group.phases[phase.id] > 0);
          const mainPhase = activePhases[activePhases.length - 1] || PHASES[0];
          return (
            <button type="button" className="active-crop-group" key={group.id} style={{ '--phase-color': mainPhase.color, '--phase-soft': mainPhase.soft }} onClick={() => setSelectedGroupId(group.id)} title="Abrir lotes y acciones">
              <header><span>{group.name.charAt(0).toUpperCase()}</span><div><strong>{group.name}</strong><small>{group.crops.length} lote{group.crops.length === 1 ? '' : 's'} activo{group.crops.length === 1 ? '' : 's'}</small></div><b>{group.trays}<small> bandejas</small></b></header>
              <div className="active-crop-group__phases">{activePhases.map(phase => <span key={phase.id} style={{ '--item-color': phase.color, '--item-soft': phase.soft }}><i>{phase.icon}</i><b>{group.phases[phase.id]}</b><small>{phase.label}</small></span>)}</div>
              <footer>Ver lotes, fechas y acciones <b>→</b></footer>
            </button>
          );
        })}
        {!visible.length && <div className="active-crops-board__empty"><span>🌱</span><b>No hay cultivos en esta fase</b><small>Selecciona otra etiqueta o registra una nueva siembra.</small></div>}
      </div>
      {selectedGroup && (
        <div className="active-crop-detail-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedGroupId(null); }}>
          <article className="active-crop-detail active-crop-group-detail" style={{ '--phase-color': '#10b981', '--phase-soft': '#ecfdf5' }}>
            <header><div><span>{selectedGroup.trays} bandejas activas</span><h3>{selectedGroup.name}</h3><small>{selectedGroup.crops.length} lote{selectedGroup.crops.length === 1 ? '' : 's'} en producción</small></div><button type="button" onClick={() => setSelectedGroupId(null)}>×</button></header>
            <div className="active-crop-group-detail__lots">{selectedGroup.crops.map(crop => {
              const phase = PHASES.find(item => item.id === cropStatus(crop)) || PHASES[0];
              const days = cycleDay(crop.datePlanted || crop.plantedAt, crop.cycleDayAdjustment);
              const expectedDays = Number(selectedGroup.type?.germinationDays || 0) + Number(selectedGroup.type?.darknessDays || 0) + Number(selectedGroup.type?.lightDays || 0) || 14;
              const harvestDate = expectedHarvest(selectedGroup.type, crop.datePlanted || crop.plantedAt, crop.cycleDayAdjustment);
              return <section key={crop.id} style={{ '--item-color': phase.color, '--item-soft': phase.soft }}><header><span>{phase.icon} {phase.label}</span><strong>{Number(crop.traysCount || crop.trays || 0)} bandejas</strong></header><div><small>{crop.batchNumber || 'Sin lote'}</small><p>Siembra: {formatSowingDate(crop.datePlanted || crop.plantedAt)}</p><p>Día {days} de {expectedDays} · Cosecha: {harvestDate ? harvestDate.toLocaleDateString('es-ES') : 'sin fecha'}</p></div><footer><button type="button" onClick={() => { setSelectedGroupId(null); onAddTrays(crop); }}>＋ Bandejas</button><button type="button" onClick={() => { setSelectedGroupId(null); onAdjust(crop); }}>Ajustar</button><button type="button" className="is-danger" onClick={() => { setSelectedGroupId(null); onDelete(crop); }}>Eliminar</button></footer></section>;
            })}</div>
          </article>
        </div>
      )}
    </section>
  );
}
