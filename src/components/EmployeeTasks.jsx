import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import '../crops.css';
import Swal from 'sweetalert2';

const CULTIVATION_TASK_ICONS = {
  GERMINACIÓN: '🌿',
  OSCURIDAD: '🌑',
  LUZ: '☀️'
};

const localDateKey = (dateValue) => {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calendarDayNumber = (dateValue) => {
  const date = new Date(dateValue);
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
};

const calendarDaysBetween = (from, to) => calendarDayNumber(to) - calendarDayNumber(from);

export default function EmployeeTasks({ onTaskAction, onHarvestBatchAction, onSowingGroupAction }) {
  const navigate = useNavigate();
  const { 
    harvestTargets, crops, cropTypes, seedVarieties, articles, stockLots, providers,
    sowCrop, updateCrop, sowingTasks, syncSowingTasks
  } = useData();
  const sowingSyncStarted = useRef(false);
  
  const [timeFilter, setTimeFilter] = useState(1);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDayTasks, setSelectedDayTasks] = useState(null);
  
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [isSowModalOpen, setIsSowModalOpen] = useState(false);
  const [batchSelections, setBatchSelections] = useState({});

  useEffect(() => {
    if (sowingSyncStarted.current) return;
    sowingSyncStarted.current = true;
    syncSowingTasks().catch(error => console.error('No se pudieron sincronizar las siembras del día:', error));
  }, [syncSowingTasks]);

  const activeCrops = crops?.filter(c => c.status !== 'HARVESTED' && c.status !== 'DISCARDED') || [];

  const getCropVarietyName = (cropType, crop = null) => {
    const varietyId = cropType?.varietyId
      || articles?.find(article => article.id === cropType?.seedId || article.id === crop?.seedId)?.varietyId;
    return seedVarieties?.find(variety => variety.id === varietyId)?.name
      || cropType?.name
      || 'Variedad desconocida';
  };

  const getCompatibleLots = (cropType) => {
    const varietyId = cropType?.varietyId
      || articles?.find(article => article.id === cropType?.seedId)?.varietyId;
    if (!varietyId) return [];
    return (stockLots || [])
      .filter(lot => {
        const article = articles?.find(item => item.id === lot.articleId);
        return article?.type === 'SEMILLA'
          && article.varietyId === varietyId
          && article.active !== false
          && Number(lot.remainingQuantity || 0) > 0;
      })
      .sort((a, b) => String(a.receivedAt || a.createdAt || '').localeCompare(String(b.receivedAt || b.createdAt || '')));
  };
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const displayedMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const displayedMonthIndex = displayedMonth.getMonth();
  const displayedYear = displayedMonth.getFullYear();
  const datesToAnalyze = (() => {
    if (timeFilter !== 30) {
      return Array.from({ length: timeFilter }).map((_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return d;
      });
    }

    const monthStart = new Date(displayedYear, displayedMonthIndex, 1);
    const monthEnd = new Date(displayedYear, displayedMonthIndex + 1, 0);
    const calendarStart = new Date(monthStart);
    const leadingDays = (monthStart.getDay() + 6) % 7;
    calendarStart.setDate(monthStart.getDate() - leadingDays);
    const calendarEnd = new Date(monthEnd);
    const trailingDays = (7 - calendarEnd.getDay()) % 7;
    calendarEnd.setDate(monthEnd.getDate() + trailingDays);
    const dayCount = calendarDaysBetween(calendarStart, calendarEnd) + 1;

    return Array.from({ length: dayCount }).map((_, i) => {
      const d = new Date(calendarStart);
      d.setDate(calendarStart.getDate() + i);
      return d;
    });
  })();

  const allTasks = [];

  datesToAnalyze.forEach(targetDate => {
    const targetDayOfWeek = targetDate.getDay();
    const dateKey = localDateKey(targetDate);
    const isToday = dateKey === localDateKey(today);
    const isPast = calendarDayNumber(targetDate) < calendarDayNumber(today);

    const tasksForDate = [];

    activeCrops.forEach(crop => {
      const cType = cropTypes?.find(c => c.id === crop.cropTypeId || c.id === crop.seedId);
      if (!cType) return;
      const varietyName = getCropVarietyName(cType, crop);

      const planted = new Date(crop.datePlanted || crop.plantedAt);
      const daysSincePlanted = calendarDaysBetween(planted, targetDate);
      if (daysSincePlanted < 0) return;

      const soakOffset = (cType?.soakingHours || 0) > 0 ? 1 : 0;
      const germDay = soakOffset;
      const darkDay = soakOffset + Number((cType?.germinationDays || 0));
      const lightDay = darkDay + Number((cType?.darknessDays || 0));
      const harvestDay = lightDay + Number((cType?.lightDays || 0));

      let action = null;
      let phaseStr = '';
      
      const st = crop.status || 'SOWED';
      const hasDarkness = Number(cType?.darknessDays || 0) > 0;

      if (isToday) {
        if (daysSincePlanted >= germDay && (st === 'SOAKING' || st === 'SOWED')) { 
          action = 'move'; phaseStr = 'GERMINACIÓN'; 
        }
        else if (st === 'GERMINATING') {
          if (hasDarkness && daysSincePlanted >= darkDay) {
            action = 'move'; phaseStr = 'OSCURIDAD';
          } else if (!hasDarkness && daysSincePlanted >= lightDay) {
            action = 'move'; phaseStr = 'LUZ';
          }
        }
        else if (daysSincePlanted >= lightDay && st === 'DARKNESS') { 
          action = 'move'; phaseStr = 'LUZ'; 
        }
        else if (daysSincePlanted >= harvestDay && ['LIGHT', 'READY'].includes(st)) {
          action = 'harvest'; 
        }
      } else if (!isPast) {
        if (daysSincePlanted === germDay && (st === 'SOAKING' || st === 'SOWED')) {
          action = 'move'; phaseStr = 'GERMINACIÓN'; 
        }
        else if (hasDarkness && daysSincePlanted === darkDay && ['SOAKING', 'SOWED', 'GERMINATING'].includes(st)) {
          action = 'move'; phaseStr = 'OSCURIDAD'; 
        }
        else if (daysSincePlanted === lightDay && !['LIGHT', 'READY'].includes(st)) {
          action = 'move'; phaseStr = 'LUZ'; 
        }
        else if (daysSincePlanted === harvestDay && ['LIGHT', 'READY'].includes(st)) {
          action = 'harvest'; 
        }
      }

      if (action === 'move') {
        tasksForDate.push({
          id: `move-${dateKey}-${crop.id}`,
          type: 'move',
          title: `Mover a ${phaseStr}`,
          desc: `${crop.traysCount} bandejas de ${varietyName} (Lote: ${crop.batchNumber})`,
          icon: CULTIVATION_TASK_ICONS[phaseStr] || '🌿',
          className: 'move',
          cropId: crop.id,
          trays: Number(crop.traysCount || 0),
          nextStatus: phaseStr === 'GERMINACIÓN' ? 'GERMINATING' : phaseStr === 'OSCURIDAD' ? 'DARKNESS' : 'LIGHT'
        });
      } else if (action === 'harvest') {
        tasksForDate.push({
          id: `harv-${dateKey}-${crop.id}`,
          type: 'harvest',
          title: `¡COSECHAR!`,
          desc: `${crop.traysCount} bandejas de ${varietyName} (Lote: ${crop.batchNumber})`,
          icon: '✂️',
          className: 'harvest',
          cropId: crop.id,
          trays: Number(crop.traysCount || 0),
          cropTypeId: cType.id
        });
      }
    });

    harvestTargets?.forEach(routine => {
      const cType = cropTypes?.find(ct => ct.id == routine.productId);
      if(!cType) return;

      const harvestWd = Number(routine.targetDayOfWeek);
      const soakOffset = Number(cType.soakingHours || 0) > 0
        ? Math.max(1, Math.ceil(Number(cType.soakingHours) / 24))
        : 0;
      const harvestOffset = soakOffset
        + Number(cType.germinationDays || 0)
        + Number(cType.darknessDays || 0)
        + Number(cType.lightDays || 0);
      const plantWd = ((harvestWd - harvestOffset) % 7 + 7) % 7;

      const isAlreadyPlanted = () => {
        const tDate = new Date(targetDate);
        tDate.setHours(0,0,0,0);
        return crops.some(c => {
          if (c.status === 'DISCARDED' || c.status === 'HARVESTED') return false;
          if (c.cropTypeId != routine.productId && c.seedId != routine.productId) return false;
          const cDate = new Date(c.datePlanted);
          return calendarDaysBetween(cDate, tDate) === 0;
        });
      };

      // Las siembras de hoy y atrasadas viven en la cola persistente.
      // Aquí solo se mantienen las futuras como vista previa del calendario.
      if(calendarDayNumber(targetDate) > calendarDayNumber(today) && plantWd == targetDayOfWeek && !isAlreadyPlanted()) {
        const gramsPerTray = Number(cType.seedGrams || 0);
        const totalSeedGrams = gramsPerTray * Number(routine.tuppersCount || 0);
        tasksForDate.push({ 
          id: `plant-${dateKey}-${routine.id}`,
          type: 'plant', 
          title: `Plantar ${cType.name}`, 
          desc: `Rutina semanal: ${routine.tuppersCount} bandejas · ${gramsPerTray} g/bandeja · ${totalSeedGrams} g total`,
          icon: '🌱', 
          className: 'plant', 
          cropTypeId: cType.id, 
          trays: routine.tuppersCount, 
          routineId: routine.id 
        });
      }
    });

    allTasks.push({
      date: targetDate,
      isToday,
      isOutsideMonth: timeFilter === 30
        && (targetDate.getMonth() !== displayedMonthIndex || targetDate.getFullYear() !== displayedYear),
      items: tasksForDate
    });
  });

  const toggleTaskSelection = (task) => {
    if (!['plant', 'move', 'harvest'].includes(task.type)) {
      alert("Esta tarea no admite selección múltiple.");
      return;
    }

    const selectingHarvest = task.type === 'harvest';
    const hasHarvests = selectedTasks.some(selected => selected.type === 'harvest');
    const hasOperationalTasks = selectedTasks.some(selected => selected.type !== 'harvest');
    if ((selectingHarvest && hasOperationalTasks) || (!selectingHarvest && hasHarvests)) {
      alert("Las cosechas se procesan por separado de las siembras y los cambios de fase.");
      return;
    }
    
    if (selectedTasks.find(t => t.id === task.id)) {
      setSelectedTasks(selectedTasks.filter(t => t.id !== task.id));
    } else {
      setSelectedTasks([...selectedTasks, task]);
    }
  };

  const handleBatchActionClick = () => {
    const harvestTasks = selectedTasks.filter(t => t.type === 'harvest');
    if (harvestTasks.length > 0) {
      if (onHarvestBatchAction) {
        onHarvestBatchAction(harvestTasks);
      } else if (onTaskAction) {
        onTaskAction(harvestTasks[0]);
      }
      setSelectedTasks([]);
      setIsMultiSelectMode(false);
      return;
    }

    const plants = selectedTasks.filter(t => t.type === 'plant');
    if (plants.length > 0) {
      // Open modal to configure seed batches
      const initialBatches = {};
      plants.forEach(p => {
        const cropType = cropTypes?.find(type => type.id === p.cropTypeId);
        initialBatches[p.id] = getCompatibleLots(cropType)[0]?.id || '';
      });
      setBatchSelections(initialBatches);
      setIsSowModalOpen(true);
    } else {
      confirmAndExecuteBatch([]);
    }
  };

  const confirmAndExecuteBatch = async (configuredPlants) => {
    const result = await Swal.fire({
      title: '¿Confirmar tareas realizadas?',
      text: `Se actualizarán ${selectedTasks.length} tareas. La fase del cultivo solo cambiará después de esta confirmación.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) await executeBatch(configuredPlants);
  };

  const confirmMoveTask = async (task) => {
    const result = await Swal.fire({
      title: `¿Confirmar “${task.title}”?`,
      text: task.desc,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, tarea realizada',
      cancelButtonText: 'Cancelar'
    });
    if (!result.isConfirmed) return;
    await updateCrop(task.cropId, { status: task.nextStatus, phaseConfirmedAt: new Date().toISOString() });
    await Swal.fire({
      title: 'Tarea completada',
      text: 'La fase física del cultivo se ha actualizado.',
      icon: 'success',
      timer: 1400,
      showConfirmButton: false
    });
  };

  const executeBatch = async (configuredPlants) => {
    try {
      // Execute moves
      const moves = selectedTasks.filter(t => t.type === 'move');
      for (const m of moves) {
        await updateCrop(m.cropId, { status: m.nextStatus, phaseConfirmedAt: new Date().toISOString() });
      }

      // Execute plants
      for (const p of configuredPlants) {
        await sowCrop({ 
          cropTypeId: p.cropTypeId, 
          traysCount: p.trays, 
          stockLotId: p.stockLotId
        });
        // We do not delete routine from harvestTargets! The routine is persistent.
      }

      await Swal.fire('Tareas completadas', `Se han confirmado ${selectedTasks.length} tareas.`, 'success');
      setSelectedTasks([]);
      setIsMultiSelectMode(false);
      setIsSowModalOpen(false);
    } catch (err) {
      Swal.fire('Error', 'No se pudieron completar las tareas: ' + err.message, 'error');
    }
  };

  const renderDetailedDay = (dayGroup) => (
    <div className={`task-day-group ${dayGroup.isToday ? 'is-today' : ''}`}>
      <div className="task-day-header">
        <span className="task-day-title">
          {dayGroup.title || (dayGroup.isToday ? '🎯 TAREAS DE HOY' : dayGroup.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }))}
        </span>
      </div>
      {dayGroup.items.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--crop-text-muted)' }}>
          ✨ Todo despejado para este día.
        </div>
      ) : (
        <div className="task-grid">
          {dayGroup.items.map((task, i) => {
            const isSelected = selectedTasks.some(t => t.id === task.id);
            return (
              <div 
                key={task.id || i} 
                className={`task-card ${task.className} ${isSelected ? 'selected' : ''}`} 
                onClick={() => {
                  if (isMultiSelectMode) {
                    toggleTaskSelection(task);
                  } else {
                    if (task.type === 'plant') {
                      if(onTaskAction){onTaskAction(task)}else{navigate('/crops?action=sow&cropTypeId=' + task.cropTypeId + '&trays=' + task.trays)}
                    } else if (task.type === 'harvest') {
                      if(onTaskAction){onTaskAction(task)}else{navigate('/crops?action=harvest&cropTypeId=' + task.cropTypeId)}
                    } else if (task.type === 'move') {
                      confirmMoveTask(task);
                    }
                  }
                }} 
                style={{ 
                  cursor: (isMultiSelectMode || task.type === 'plant' || task.type === 'harvest' || task.type === 'move') ? 'pointer' : 'default',
                  border: isSelected ? '2px solid #22c55e' : '',
                  transform: isSelected ? 'scale(0.98)' : '',
                  position: 'relative'
                }}
              >
                {isMultiSelectMode && (task.type === 'plant' || task.type === 'move' || task.type === 'harvest') && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                    <input type="checkbox" checked={isSelected} readOnly style={{ transform: 'scale(1.5)', accentColor: '#22c55e' }} />
                  </div>
                )}
                <div className="task-icon">{task.icon}</div>
                <div className="task-content">
                  <h4>{task.title}</h4>
                  <p>{task.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderDailyGroups = dayGroup => {
    const todayKey = localDateKey(today);
    const groups = [
      {
        key: 'sowing',
        title: 'Siembras del día',
        icon: '🌱',
        color: '#16a34a',
        background: '#f0fdf4',
        items: (sowingTasks || []).filter(task => task.status === 'PENDING' && task.plannedDate === todayKey),
        action: onSowingGroupAction
      },
      {
        key: 'darkness',
        title: 'Pasar a oscuridad',
        icon: '🌑',
        color: '#4f46e5',
        background: '#eef2ff',
        items: dayGroup.items.filter(task => task.type === 'move' && task.nextStatus === 'DARKNESS')
      },
      {
        key: 'light',
        title: 'Pasar a luz',
        icon: '☀️',
        color: '#d97706',
        background: '#fffbeb',
        items: dayGroup.items.filter(task => task.type === 'move' && task.nextStatus === 'LIGHT')
      },
      {
        key: 'harvest',
        title: 'Listos para cosechar',
        icon: '✂️',
        color: '#dc2626',
        background: '#fef2f2',
        items: dayGroup.items.filter(task => task.type === 'harvest')
      }
    ];
    const otherTasks = dayGroup.items.filter(task => task.type === 'move' && !['DARKNESS', 'LIGHT'].includes(task.nextStatus));
    if (otherTasks.length) groups.splice(1, 0, { key: 'other', title: 'Otros cambios de fase', icon: '🌿', color: '#0284c7', background: '#f0f9ff', items: otherTasks });

    return (
      <div className="task-day-group is-today">
        <div className="task-day-header"><span className="task-day-title">🎯 TAREAS DE HOY</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', padding: '1rem' }}>
          {groups.map(group => {
            const trays = group.items.reduce((sum, item) => sum + Number(item.trays || 0), 0);
            const disabled = group.items.length === 0;
            return (
              <button key={group.key} type="button" disabled={disabled} onClick={() => {
                if (group.action) group.action();
                else setSelectedDayTasks({ ...dayGroup, title: `${group.icon} ${group.title}`, items: group.items });
              }} style={{ padding: '1rem', border: `1px solid ${disabled ? '#e2e8f0' : group.color + '45'}`, borderLeft: `5px solid ${disabled ? '#cbd5e1' : group.color}`, borderRadius: '12px', background: disabled ? '#f8fafc' : group.background, textAlign: 'left', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}><strong style={{ color: disabled ? '#64748b' : group.color, fontSize: '1rem' }}>{group.icon} {group.title}</strong><span style={{ minWidth: '28px', height: '28px', padding: '0 0.45rem', display: 'grid', placeItems: 'center', borderRadius: '999px', background: disabled ? '#e2e8f0' : 'white', color: disabled ? '#64748b' : group.color, fontWeight: 900 }}>{group.items.length}</span></span>
                <small style={{ display: 'block', marginTop: '0.45rem', color: '#64748b' }}>{group.items.length ? `${trays} bandejas · Ver listado →` : 'Sin tareas pendientes'}</small>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="crops-module">
      <div className="tasks-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="tasks-title-area">
          <h2>Dashboard de Tareas</h2>
          <p>Controla el pulso de tu invernadero en tiempo real y a futuro.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
          <div className="time-filters">
            {[
              { v: 1, l: 'HOY' },
              { v: 7, l: '7 DÍAS' },
              { v: 30, l: 'MES' }
            ].map(f => (
              <button 
                key={f.v}
                onClick={() => {
                  setTimeFilter(f.v);
                  if (f.v === 30) setMonthOffset(0);
                }}
                className={`time-filter-btn ${timeFilter === f.v ? 'active' : ''}`}
              >
                {f.l}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className={`btn ${isMultiSelectMode ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                setSelectedTasks([]);
              }}
            >
              {isMultiSelectMode ? 'Cancelar Selección' : 'Selección Múltiple'}
            </button>

            {isMultiSelectMode && selectedTasks.length > 0 && (
              <button className="btn btn-success" onClick={handleBatchActionClick}>
                Completar ({selectedTasks.length})
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="tasks-list-area">
        {timeFilter === 1 ? (
          allTasks[0] ? renderDailyGroups(allTasks[0]) : null
        ) : timeFilter === 30 ? (
          <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
            <div style={{ minWidth: '760px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', textTransform: 'capitalize' }}>
                  {displayedMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={monthOffset === 0}
                    onClick={() => setMonthOffset(previous => Math.max(0, previous - 1))}
                    style={{ padding: '0.45rem 0.7rem', minWidth: '2.35rem' }}
                    aria-label="Mes anterior"
                  >
                    ‹
                  </button>
                  {monthOffset > 0 && (
                    <button type="button" className="btn btn-secondary" onClick={() => setMonthOffset(0)} style={{ padding: '0.45rem 0.75rem' }}>
                      Mes actual
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setMonthOffset(previous => previous + 1)}
                    style={{ padding: '0.45rem 0.7rem', minWidth: '2.35rem' }}
                    aria-label="Mes siguiente"
                  >
                    ›
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', border: '1px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden', background: '#cbd5e1', gap: '1px' }}>
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => (
                  <div key={day} style={{ padding: '0.65rem', textAlign: 'center', background: '#f1f5f9', color: '#475569', fontWeight: 800, fontSize: '0.8rem', textTransform: 'uppercase' }}>
                    {day}
                  </div>
                ))}
                {allTasks.map((dayGroup, idx) => {
                  const taskCount = dayGroup.items.length;
                  const plantingTasks = dayGroup.items.filter(task => task.type === 'plant');
                  const otherTasks = dayGroup.items.filter(task => task.type !== 'plant');
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedDayTasks(dayGroup)}
                      style={{
                        minHeight: '138px',
                        padding: '0.55rem',
                        cursor: 'pointer',
                        background: dayGroup.isToday ? '#ecfdf5' : dayGroup.isOutsideMonth ? '#f1f5f9' : 'white',
                        boxShadow: dayGroup.isToday ? 'inset 0 0 0 2px #22c55e' : 'none',
                        color: dayGroup.isOutsideMonth ? '#94a3b8' : '#1e293b',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={event => { event.currentTarget.style.background = dayGroup.isToday ? '#dcfce7' : '#f8fafc'; }}
                      onMouseLeave={event => { event.currentTarget.style.background = dayGroup.isToday ? '#ecfdf5' : dayGroup.isOutsideMonth ? '#f1f5f9' : 'white'; }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontWeight: dayGroup.isToday ? 900 : 700, color: dayGroup.isToday ? '#15803d' : 'inherit' }}>
                          {dayGroup.date.getDate()}
                        </span>
                        {dayGroup.isToday && <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>Hoy</span>}
                      </div>
                      {taskCount > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {plantingTasks.length > 0 && (
                            <div
                              title={plantingTasks.map(task => task.title).join(' · ')}
                              style={{
                                background: dayGroup.isOutsideMonth ? '#dcfce7' : '#ecfdf5',
                                border: '1px solid #bbf7d0',
                                borderRadius: '6px',
                                padding: '0.35rem 0.4rem',
                                color: '#166534',
                                fontSize: '0.66rem',
                                lineHeight: 1.35
                              }}
                            >
                              <strong style={{ display: 'block', marginBottom: '0.15rem', fontSize: '0.68rem' }}>🌱 {plantingTasks.length} siembras</strong>
                              <span>{plantingTasks.map(task => task.title.replace(/^Plantar\s+/i, '')).join(' · ')}</span>
                            </div>
                          )}
                          {otherTasks.slice(0, plantingTasks.length > 0 ? 2 : 3).map((task, taskIndex) => (
                            <div key={task.id || taskIndex} title={`${task.title}: ${task.desc}`} style={{ background: dayGroup.isOutsideMonth ? '#e2e8f0' : '#f8fafc', borderRadius: '5px', padding: '0.25rem 0.35rem', fontSize: '0.7rem', color: dayGroup.isOutsideMonth ? '#64748b' : '#334155', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {task.icon} {task.title}
                            </div>
                          ))}
                          {otherTasks.length > (plantingTasks.length > 0 ? 2 : 3) && (
                            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>
                              +{otherTasks.length - (plantingTasks.length > 0 ? 2 : 3)} tareas adicionales
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: dayGroup.isOutsideMonth ? '#cbd5e1' : '#94a3b8' }}>Sin tareas</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
            <div style={{ minWidth: '1050px', display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', border: '1px solid #cbd5e1', borderRadius: '12px', overflow: 'hidden', background: '#cbd5e1', gap: '1px' }}>
              {allTasks.map((dayGroup, idx) => (
                <div key={idx} style={{ minHeight: '250px', background: dayGroup.isToday ? '#ecfdf5' : 'white', boxShadow: dayGroup.isToday ? 'inset 0 0 0 2px #22c55e' : 'none' }}>
                  <div style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', background: dayGroup.isToday ? '#dcfce7' : '#f8fafc', textAlign: 'center' }}>
                    <div style={{ color: dayGroup.isToday ? '#15803d' : '#64748b', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                      {dayGroup.date.toLocaleDateString('es-ES', { weekday: 'short' })}
                    </div>
                    <div style={{ color: dayGroup.isToday ? '#166534' : '#1e293b', fontSize: '1.35rem', fontWeight: 900 }}>
                      {dayGroup.date.getDate()}
                    </div>
                    {dayGroup.isToday && <div style={{ color: '#15803d', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>Hoy</div>}
                  </div>

                  <div style={{ padding: '0.55rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {dayGroup.items.length === 0 ? (
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center', padding: '1.5rem 0.25rem' }}>Sin tareas</div>
                    ) : dayGroup.items.map((task, taskIndex) => {
                      const isSelected = selectedTasks.some(selected => selected.id === task.id);
                      const isActionable = isMultiSelectMode || task.type === 'plant' || task.type === 'harvest' || task.type === 'move';
                      const accentColors = {
                        plant: '#22c55e',
                        move: '#3b82f6',
                        dark: '#6366f1',
                        light: '#f59e0b',
                        harvest: '#ef4444'
                      };
                      return (
                        <div
                          key={task.id || taskIndex}
                          onClick={() => {
                            if (isMultiSelectMode) {
                              toggleTaskSelection(task);
                            } else if (task.type === 'plant') {
                              if (onTaskAction) onTaskAction(task);
                              else navigate('/crops?action=sow&cropTypeId=' + task.cropTypeId + '&trays=' + task.trays);
                            } else if (task.type === 'harvest') {
                              if (onTaskAction) onTaskAction(task);
                              else navigate('/crops?action=harvest&cropTypeId=' + task.cropTypeId);
                            } else if (task.type === 'move') {
                              confirmMoveTask(task);
                            }
                          }}
                          style={{
                            position: 'relative',
                            padding: '0.55rem',
                            background: isSelected ? '#dcfce7' : '#f8fafc',
                            border: isSelected ? '1px solid #22c55e' : '1px solid #e2e8f0',
                            borderLeft: `3px solid ${accentColors[task.className] || '#94a3b8'}`,
                            borderRadius: '7px',
                            cursor: isActionable ? 'pointer' : 'default'
                          }}
                        >
                          {isMultiSelectMode && (task.type === 'plant' || task.type === 'move' || task.type === 'harvest') && (
                            <input type="checkbox" checked={isSelected} readOnly style={{ position: 'absolute', top: '0.45rem', right: '0.45rem', accentColor: '#22c55e' }} />
                          )}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.35rem', paddingRight: isMultiSelectMode ? '1rem' : 0 }}>
                            <span style={{ fontSize: '0.95rem', lineHeight: 1.2 }}>{task.icon}</span>
                            <strong style={{ color: '#1e293b', fontSize: '0.72rem', lineHeight: 1.25 }}>{task.title}</strong>
                          </div>
                          <div style={{ color: '#64748b', fontSize: '0.66rem', lineHeight: 1.35, marginTop: '0.3rem' }}>{task.desc}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedDayTasks && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }} onClick={() => setSelectedDayTasks(null)}>
          <div style={{
            background: '#f8fafc', width: '90%', maxWidth: '800px', maxHeight: '90vh',
            borderRadius: '24px', padding: '2rem', overflowY: 'auto', position: 'relative',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setSelectedDayTasks(null)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: '#e2e8f0', border: 'none', width: '40px', height: '40px', borderRadius: '50%', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ×
            </button>
            {renderDetailedDay(selectedDayTasks)}
          </div>
        </div>
      )}

      {isSowModalOpen && (
        <div className="modal-backdrop" style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
        }}>
          <div className="modal-content" style={{ 
            background: 'white', padding: '2rem', borderRadius: '16px', 
            width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' 
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#065f46' }}>
              Confirmar Siembras Automáticas
            </h3>
            <p style={{ marginBottom: '1.5rem', color: '#475569' }}>
              Por favor, asigna el lote de semilla correcto para cada cultivo antes de procesar las siembras.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {selectedTasks.filter(t => t.type === 'plant').map(task => {
                const cType = cropTypes?.find(c => c.id === task.cropTypeId);
                const compatibleLots = getCompatibleLots(cType);

                return (
                  <div key={task.id} style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{task.title}</div>
                    <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem' }}>{task.desc}</div>
                    
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#0f172a' }}>
                      Lote de Semilla a Utilizar
                    </label>
                    <select 
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                      value={batchSelections[task.id] || compatibleLots[0]?.id || ''}
                      onChange={(e) => setBatchSelections({...batchSelections, [task.id]: e.target.value})}
                    >
                      <option value="">Selecciona un lote...</option>
                      {compatibleLots.map(lot => (
                        <option key={lot.id} value={lot.id}>
                          {lot.supplierBatch} · {articles?.find(a => a.id === lot.articleId)?.name || 'Semilla'}
                          {' · '}{providers?.find(p => p.id === lot.providerId)?.name || 'Sin proveedor'}
                          {' · '}{Number(lot.remainingQuantity).toFixed(2)} g
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsSowModalOpen(false)}>Cancelar</button>
              <button 
                className="btn btn-success" 
                onClick={() => {
                  const plants = selectedTasks.filter(t => t.type === 'plant').map(t => ({
                    ...t,
                    stockLotId: batchSelections[t.id] || getCompatibleLots(cropTypes?.find(c => c.id === t.cropTypeId))[0]?.id || ''
                  }));
                  confirmAndExecuteBatch(plants);
                }}
              >
                Confirmar y Sembrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
