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
  const counts = Object.fromEntries(PHASES.map(phase => [phase.id,
    phase.id === 'ALL' ? crops.length : crops.filter(crop => cropStatus(crop) === phase.id).length
  ]));
  const visible = crops
    .filter(crop => statusFilter === 'ALL' || cropStatus(crop) === statusFilter)
    .sort((a, b) => new Date(a.datePlanted || a.plantedAt) - new Date(b.datePlanted || b.plantedAt));

  return (
    <section className="active-crops-board">
      <header className="active-crops-board__header">
        <div><h3>Cultivos activos</h3><p>Selecciona una fase para centrarte solo en ese trabajo.</p></div>
        <strong>{visible.length} lotes · {visible.reduce((sum, crop) => sum + Number(crop.traysCount || crop.trays || 0), 0)} bandejas</strong>
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
        {visible.map(crop => {
          const type = cropTypes?.find(item => item.id === crop.seedId || item.id === crop.cropTypeId);
          const phase = PHASES.find(item => item.id === cropStatus(crop)) || PHASES[0];
          const days = cycleDay(crop.datePlanted || crop.plantedAt, crop.cycleDayAdjustment);
          const expectedDays = type ? (Number(type.germinationDays || 0) + Number(type.darknessDays || 0) + Number(type.lightDays || 0) || 14) : 14;
          const progress = Math.min(100, Math.max(0, days / expectedDays * 100));
          const harvestDate = expectedHarvest(type, crop.datePlanted || crop.plantedAt, crop.cycleDayAdjustment);
          return (
            <article className="active-crop-card" key={crop.id} style={{ '--phase-color': phase.color, '--phase-soft': phase.soft }}>
              <div className="active-crop-card__top">
                <span className="active-crop-card__initial">{type?.name?.charAt(0).toUpperCase() || '🌱'}</span>
                <div><h4>{type?.name || 'Cultivo sin nombre'}</h4><small>{crop.batchNumber || 'Sin lote'}</small></div>
                <b>{Number(crop.traysCount || crop.trays || 0)}<small>bandejas</small></b>
              </div>
              <div className="active-crop-card__meta">
                <span className="active-crop-card__phase">{phase.icon} {phase.label}</span>
                <span>Día {days} de {expectedDays}</span>
              </div>
              <div className="active-crop-card__progress"><i style={{ width: `${progress}%` }} /></div>
              <div className="active-crop-card__dates">
                <span><small>Sembrado</small>{formatSowingDate(crop.datePlanted || crop.plantedAt)}</span>
                <span><small>Cosecha prevista</small>{harvestDate ? harvestDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : 'Sin fecha'}</span>
              </div>
              <footer>
                <button type="button" onClick={() => onAddTrays(crop)}>＋ Bandejas</button>
                <button type="button" onClick={() => onAdjust(crop)}>Ajustar ciclo</button>
                <button type="button" className="is-danger" onClick={() => onDelete(crop)} aria-label={`Eliminar ${type?.name || 'cultivo'}`}>×</button>
              </footer>
            </article>
          );
        })}
        {!visible.length && <div className="active-crops-board__empty"><span>🌱</span><b>No hay cultivos en esta fase</b><small>Selecciona otra etiqueta o registra una nueva siembra.</small></div>}
      </div>
    </section>
  );
}
