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
  const [selectedCropId, setSelectedCropId] = useState(null);
  const counts = Object.fromEntries(PHASES.map(phase => [phase.id,
    phase.id === 'ALL' ? crops.length : crops.filter(crop => cropStatus(crop) === phase.id).length
  ]));
  const visible = crops
    .filter(crop => statusFilter === 'ALL' || cropStatus(crop) === statusFilter)
    .sort((a, b) => new Date(a.datePlanted || a.plantedAt) - new Date(b.datePlanted || b.plantedAt));
  const selectedCrop = crops.find(crop => String(crop.id) === String(selectedCropId));
  const selectedType = selectedCrop && cropTypes?.find(item => item.id === selectedCrop.seedId || item.id === selectedCrop.cropTypeId);
  const selectedPhase = selectedCrop ? (PHASES.find(item => item.id === cropStatus(selectedCrop)) || PHASES[0]) : null;
  const selectedDays = selectedCrop ? cycleDay(selectedCrop.datePlanted || selectedCrop.plantedAt, selectedCrop.cycleDayAdjustment) : 0;
  const selectedExpectedDays = selectedType ? (Number(selectedType.germinationDays || 0) + Number(selectedType.darknessDays || 0) + Number(selectedType.lightDays || 0) || 14) : 14;
  const selectedHarvestDate = selectedCrop ? expectedHarvest(selectedType, selectedCrop.datePlanted || selectedCrop.plantedAt, selectedCrop.cycleDayAdjustment) : null;

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
          const harvestDate = expectedHarvest(type, crop.datePlanted || crop.plantedAt, crop.cycleDayAdjustment);
          return (
            <button type="button" className="active-crop-tag" key={crop.id} style={{ '--phase-color': phase.color, '--phase-soft': phase.soft }} onClick={() => setSelectedCropId(crop.id)} title={`${phase.label} · abrir detalle`}>
              <span><i /> <strong>{type?.name || 'Cultivo sin nombre'}</strong><b>{Number(crop.traysCount || crop.trays || 0)} bdj.</b></span>
              <small>Siembra {new Date(crop.datePlanted || crop.plantedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} · Cosecha {harvestDate ? harvestDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '—'}</small>
            </button>
          );
        })}
        {!visible.length && <div className="active-crops-board__empty"><span>🌱</span><b>No hay cultivos en esta fase</b><small>Selecciona otra etiqueta o registra una nueva siembra.</small></div>}
      </div>
      {selectedCrop && (
        <div className="active-crop-detail-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedCropId(null); }}>
          <article className="active-crop-detail" style={{ '--phase-color': selectedPhase.color, '--phase-soft': selectedPhase.soft }}>
            <header><div><span>{selectedPhase.icon} {selectedPhase.label}</span><h3>{selectedType?.name || 'Cultivo sin nombre'}</h3><small>{selectedCrop.batchNumber || 'Sin lote'}</small></div><button type="button" onClick={() => setSelectedCropId(null)}>×</button></header>
            <div className="active-crop-row__facts">
              <span><small>Bandejas activas</small>{Number(selectedCrop.traysCount || selectedCrop.trays || 0)}</span>
              <span><small>Fecha de siembra</small>{formatSowingDate(selectedCrop.datePlanted || selectedCrop.plantedAt)}</span>
              <span><small>Cosecha prevista</small>{selectedHarvestDate ? selectedHarvestDate.toLocaleDateString('es-ES') : 'Sin fecha'}</span>
              <span><small>Desarrollo</small>Día {selectedDays} de {selectedExpectedDays}</span>
            </div>
            <div className="active-crop-card__progress"><i style={{ width: `${Math.min(100, Math.max(0, selectedDays / selectedExpectedDays * 100))}%` }} /></div>
            <footer><button type="button" onClick={() => { setSelectedCropId(null); onAddTrays(selectedCrop); }}>＋ Añadir bandejas</button><button type="button" onClick={() => { setSelectedCropId(null); onAdjust(selectedCrop); }}>Ajustar ciclo y fechas</button><button type="button" className="is-danger" onClick={() => { setSelectedCropId(null); onDelete(selectedCrop); }}>Eliminar cultivo</button></footer>
          </article>
        </div>
      )}
    </section>
  );
}
