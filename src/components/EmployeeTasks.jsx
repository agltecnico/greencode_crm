import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useData } from '../context/DataContext';
import '../crops.css';

export default function EmployeeTasks() {
  const navigate = useNavigate();
  const { harvestTargets, crops, seeds, cropTypes, dailyLogs, addDailyLog } = useData();
  const [timeFilter, setTimeFilter] = useState(1);
  const [selectedDayTasks, setSelectedDayTasks] = useState(null);

  const activeCrops = crops?.filter(c => c.status !== 'HARVESTED' && c.status !== 'DISCARDED') || [];
  
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const datesToAnalyze = Array.from({length: timeFilter}).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const allTasks = [];

  datesToAnalyze.forEach(targetDate => {
    const targetDayOfWeek = targetDate.getDay();
    const dateKey = targetDate.toISOString().split('T')[0];
    const isToday = dateKey === today.toISOString().split('T')[0];

    const tasksForDate = [];

    activeCrops.forEach(crop => {
      const cType = cropTypes?.find(c => c.id === crop.cropTypeId || c.id === crop.seedId);
      const seed = seeds?.find(s => s.id === cType?.seedId || s.id === crop.seedId);
      if (!cType || !seed) return;

      const planted = new Date(crop.datePlanted || crop.plantedAt);
      planted.setHours(0,0,0,0);
      const daysSincePlanted = Math.floor((targetDate - planted) / (1000 * 60 * 60 * 24));
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
          else if (daysSincePlanted >= harvestDay && st === 'LIGHT') { 
            action = 'harvest'; 
          }
        } else {
          // Future days: we just look at exactly the day match, regardless of current status
          if (daysSincePlanted === germDay) { 
            action = 'move'; phaseStr = 'GERMINACIÓN'; 
          }
          else if (hasDarkness && daysSincePlanted === darkDay) { 
            action = 'move'; phaseStr = 'OSCURIDAD'; 
          }
          else if (daysSincePlanted === lightDay) { 
            action = 'move'; phaseStr = 'LUZ'; 
          }
          else if (daysSincePlanted === harvestDay) { 
            action = 'harvest'; 
          }
        }

        if (action === 'move') {
        tasksForDate.push({
          type: 'move',
          title: `Mover a ${phaseStr}`,
          desc: `${crop.traysCount} bandejas de ${seed.name} (Lote: ${crop.batchNumber})`,
          icon: '🪴',
          className: 'move'
        });
      } else if (action === 'harvest') {
        tasksForDate.push({
          type: 'harvest',
          title: `¡COSECHAR!`,
          desc: `${crop.traysCount} bandejas de ${seed.name} (Lote: ${crop.batchNumber})`,
          icon: '📦',
          className: 'harvest', cropTypeId: cType.id
        });
      }
    });

    harvestTargets?.forEach(routine => {
      const cType = cropTypes?.find(ct => ct.id === routine.productId);
      if(!cType) return;
      const seed = seeds?.find(s => s.id === cType.seedId);
      if(!seed) return;

      const plantWd = Number(routine.targetDayOfWeek);
      const soakHrs = cType.soakingHours || 0;
      const soakOffset = soakHrs > 0 ? 1 : 0;
      const germOffset = soakOffset;
      const darkOffset = soakOffset + Number(cType.germinationDays || 0);
      const lightOffset = darkOffset + Number(cType.darknessDays || 0);
      const harvestOffset = lightOffset + Number(cType.lightDays || 0);

            const germWd = (plantWd + germOffset) % 7;
      const darkWd = (plantWd + darkOffset) % 7;
      const lightWd = (plantWd + lightOffset) % 7;
      const harvestWd = (plantWd + harvestOffset) % 7;

      const checkPlanted = (offset) => {
        const tDate = new Date(targetDate);
        tDate.setDate(tDate.getDate() - offset);
        tDate.setHours(0,0,0,0);
        return crops.some(c => {
          if (c.status === 'DISCARDED' || c.status === 'HARVESTED') return false;
            if (c.cropTypeId !== routine.productId && c.seedId !== routine.productId) return false;
          const cDate = new Date(c.datePlanted);
          cDate.setHours(0,0,0,0);
          return Math.abs((cDate - tDate) / 86400000) <= 1;
        });
      };

      if(plantWd === targetDayOfWeek) {
        tasksForDate.push({ type: 'plant', title: `Plantar ${cType.name}`, desc: `Rutina semanal: ${routine.tuppersCount} bandejas`, icon: '🌱', className: 'plant', cropTypeId: cType.id, trays: routine.tuppersCount });
      }
      
      const hasDarkness = Number(cType.darknessDays) > 0;

      if(germWd === targetDayOfWeek) {
        // Germination happens automatically on plant or after soak, usually don't need a manual task for germ if we just planted, 
        // but if soak was 1 day, then germ is the day after.
        if (soakHrs > 0) {
           // tasksForDate.push({ type: 'germ', title: `A Germinación: ${cType.name}`, desc: `Desde remojo (Rutina)`, icon: '🌱', className: 'germ', cropTypeId: cType.id });
        }
      }

      if(hasDarkness && darkWd === targetDayOfWeek) {
        tasksForDate.push({ type: 'dark', title: `A Oscuridad: ${cType.name}`, desc: `Rutina esperada`, icon: '🌑', className: 'dark', cropTypeId: cType.id });
      }

      if(lightWd === targetDayOfWeek) {
        tasksForDate.push({ type: 'light', title: `A Luz: ${cType.name}`, desc: `Rutina esperada`, icon: '☀️', className: 'light', cropTypeId: cType.id });
      }

      if(harvestWd === targetDayOfWeek) {
        tasksForDate.push({ type: 'harvest', title: `Cosechar ${cType.name}`, desc: `Rutina esperada: ${routine.tuppersCount} bandejas`, icon: '✂️', className: 'harvest', cropTypeId: cType.id });
      }
    });

    // Always push the date so the user sees empty days as requested
    allTasks.push({ date: targetDate, isToday, items: tasksForDate });
  });

  
  const renderDetailedDay = (dayGroup) => (
    <div className={`task-day-group ${dayGroup.isToday ? 'is-today' : ''}`}>
      <div className="task-day-header">
        <span className="task-day-title">
          {dayGroup.isToday ? '📅 TAREAS DE HOY' : dayGroup.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
        </span>
      </div>
      {dayGroup.items.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--crop-text-muted)' }}>
          🍃 Todo despejado para este día.
            
        </div>
      ) : (
        <div className="task-grid">
          {dayGroup.items.map((task, i) => (
            <div key={i} className={`task-card ${task.className}`} onClick={() => {
                if (task.type === 'plant') {
                  window.location.href = '/crops?action=sow&cropTypeId=' + task.cropTypeId + '&trays=' + task.trays;
                } else if (task.type === 'harvest') {
                  window.location.href = '/crops?action=harvest&cropTypeId=' + task.cropTypeId;
                }
              }} style={{ cursor: (task.type === 'plant' || task.type === 'harvest') ? 'pointer' : 'default' }}>
              <div className="task-icon">{task.icon}</div>
              <div className="task-content">
                <h4>{task.title}</h4>
                <p>{task.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );


  return (
    <div className="crops-module">
      <div className="tasks-header">
        <div className="tasks-title-area">
          <h2>Dashboard de Tareas</h2>
          <p>Controla el pulso de tu invernadero en tiempo real y a futuro.</p>
        </div>

        <div className="time-filters">
          {[
            { v: 1, l: 'HOY' },
            { v: 7, l: '7 DÍAS' },
            { v: 30, l: '30 DÍAS' }
          ].map(f => (
            <button 
              key={f.v}
              onClick={() => setTimeFilter(f.v)}
              className={`time-filter-btn \${timeFilter === f.v ? 'active' : ''}`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      
        
        
        <div className="tasks-list-area">
          {timeFilter === 1 ? (
            // TODAY VIEW (Detailed)
            allTasks.map((dayGroup, idx) => (
              <div key={idx}>
                {renderDetailedDay(dayGroup)}
              </div>
            ))
          ) : (
            // CALENDAR GRID VIEW (7 or 30 days)
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: timeFilter === 7 ? 'repeat(auto-fit, minmax(120px, 1fr))' : 'repeat(auto-fill, minmax(100px, 1fr))', 
              gap: '1rem' 
            }}>
              {allTasks.map((dayGroup, idx) => {
                const dayName = dayGroup.date.toLocaleDateString('es-ES', { weekday: 'short' });
                const dayNum = dayGroup.date.getDate();
                const taskCount = dayGroup.items.length;
                
                return (
                  <div 
                    key={idx} 
                    onClick={() => setSelectedDayTasks(dayGroup)}
                    style={{
                      background: dayGroup.isToday ? '#f0fdf4' : 'white',
                      border: dayGroup.isToday ? '2px solid #22c55e' : '1px solid #cbd5e1',
                      borderRadius: '12px',
                      padding: '1rem',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'transform 0.2s, boxShadow 0.2s',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.05)'; }}
                  >
                    <div style={{ fontWeight: 'bold', color: dayGroup.isToday ? '#166534' : '#64748b', textTransform: 'capitalize' }}>
                      {dayName}
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '900', color: dayGroup.isToday ? '#15803d' : '#1e293b' }}>
                      {dayNum}
                    </div>
                    
                    {taskCount > 0 ? (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {dayGroup.items.slice(0,3).map((t, i) => (
                          <span key={i} title={t.title} style={{ fontSize: '1.2rem' }}>{t.icon}</span>
                        ))}
                        {taskCount > 3 && <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>+{taskCount - 3}</span>}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>Libre</div>
                    )}
                  </div>
                )
              })}
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

    </div>
  );
}
