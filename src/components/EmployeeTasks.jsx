import { useState } from 'react';
import { useData } from '../context/DataContext';
import '../crops.css';

export default function EmployeeTasks() {
  const { harvestTargets, crops, seeds, products, dailyLogs, addDailyLog } = useData();
  const [timeFilter, setTimeFilter] = useState(1);

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
      const seed = seeds?.find(s => s.id === crop.seedId);
      if(!seed) return;

      const planted = new Date(crop.datePlanted);
      planted.setHours(0,0,0,0);
      const daysSincePlanted = Math.floor((targetDate - planted) / (1000 * 60 * 60 * 24));
      
      const soakOffset = seed.soakingHours > 0 ? 1 : 0;
      const germDay = soakOffset;
      const darkDay = soakOffset + Number(seed.germinationDays);
      const lightDay = soakOffset + Number(seed.germinationDays) + Number(seed.darknessDays);
      const harvestDay = soakOffset + Number(seed.germinationDays) + Number(seed.darknessDays) + Number(seed.lightDays);

      let action = null;
      let phaseStr = '';
      
      if (isToday) {
        if (daysSincePlanted >= germDay && crop.status === 'SOAKING') { action = 'move'; phaseStr = 'GERMINACIÓN'; }
        else if (daysSincePlanted >= darkDay && crop.status === 'GERMINATION') { action = 'move'; phaseStr = 'OSCURIDAD'; }
        else if (daysSincePlanted >= lightDay && crop.status === 'DARKNESS') { action = 'move'; phaseStr = 'LUZ'; }
        else if (daysSincePlanted >= harvestDay && crop.status === 'LIGHT') { action = 'harvest'; }
      } else {
        if (daysSincePlanted === germDay) { action = 'move'; phaseStr = 'GERMINACIÓN'; }
        else if (daysSincePlanted === darkDay) { action = 'move'; phaseStr = 'OSCURIDAD'; }
        else if (daysSincePlanted === lightDay) { action = 'move'; phaseStr = 'LUZ'; }
        else if (daysSincePlanted === harvestDay) { action = 'harvest'; }
      }

      if (action === 'move') {
        tasksForDate.push({
          type: 'move',
          title: `Mover a ${phaseStr}`,
          desc: `${crop.traysCount} bandejas de ${seed.name} (Lote: ${crop.batchNumber})`,
          icon: '🌱',
          className: 'move'
        });
      } else if (action === 'harvest') {
        tasksForDate.push({
          type: 'harvest',
          title: `¡COSECHAR!`,
          desc: `${crop.traysCount} bandejas de ${seed.name} (Lote: ${crop.batchNumber})`,
          icon: '🔪',
          className: 'harvest'
        });
      }
    });

    harvestTargets?.forEach(target => {
      const product = products?.find(p => p.id === target.productId);
      if(!product) return;

      const recipeSeedsList = product.recipeSeeds?.length > 0 ? product.recipeSeeds : [{ seedId: target.productId }];
      
      recipeSeedsList.forEach(rs => {
        const seed = seeds?.find(s => s.id === rs.seedId);
        if(!seed) return;

        const totalCycleDays = (seed.soakingHours > 0 ? 1 : 0) + Number(seed.germinationDays) + Number(seed.darknessDays) + Number(seed.lightDays);
        
        let plantingDay = target.targetDayOfWeek - totalCycleDays;
        while(plantingDay < 0) plantingDay += 7;

        if(plantingDay === targetDayOfWeek) {
          tasksForDate.push({
            type: 'plant',
            title: `Plantar ${seed.name}`,
            desc: `Para el objetivo de ${product.name} (Cosecha: Día ${target.targetDayOfWeek})`,
            icon: '🪴',
            className: 'plant'
          });
        }
        
        if(seed.soakingHours > 0) {
          let soakingDay = plantingDay - 1;
          if(soakingDay < 0) soakingDay += 7;
          if(soakingDay === targetDayOfWeek) {
            tasksForDate.push({
              type: 'soak',
              title: `Poner a remojo ${seed.name}`,
              desc: `${seed.soakingHours}h requeridas. Plantar al día siguiente.`,
              icon: '💧',
              className: 'soak'
            });
          }
        }
      });
    });

    if (tasksForDate.length > 0 || isToday) {
      allTasks.push({ date: targetDate, isToday, items: tasksForDate });
    }
  });

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

      <div className="dashboard-layout">
        
        <div className="tasks-list-area">
          {allTasks.map((dayGroup, idx) => (
            <div key={idx} className={`task-day-group \${dayGroup.isToday ? 'is-today' : ''}`}>
              <div className="task-day-header">
                <span className="task-day-title">
                  {dayGroup.isToday ? '🎯 TAREAS DE HOY' : dayGroup.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
                </span>
              </div>

              {dayGroup.items.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--crop-text-muted)' }}>
                  ✨ Todo despejado para este día.
                </div>
              ) : (
                <div className="task-grid">
                  {dayGroup.items.map((task, i) => (
                    <div key={i} className={`task-card \${task.className}`}>
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
          ))}
        </div>

        <div className="climate-sidebar">
          <div className="climate-widget">
            <div className="climate-widget-header">
              <span style={{ fontSize: '2rem' }}>🌡️</span>
              <h3>Clima Invernadero</h3>
            </div>
            
            <p className="climate-desc">
              Introduce las métricas actuales. Se requiere un registro diario obligatorio por normativas de Sanidad.
            </p>
            
            <div className="climate-form">
              <div className="climate-input-group">
                <label className="climate-label">Temperatura (°C)</label>
                <input type="number" id="temp-input" step="0.1" className="climate-input" placeholder="Ej: 24.5" />
              </div>
              
              <div className="climate-input-group">
                <label className="climate-label">Humedad (%)</label>
                <input type="number" id="hum-input" className="climate-input" placeholder="Ej: 55" />
              </div>

              <button 
                className="climate-btn"
                onClick={() => {
                   const t = document.getElementById('temp-input').value;
                   const h = document.getElementById('hum-input').value;
                   if(t && h) {
                     if(addDailyLog) addDailyLog({ temperature: t, humidity: h, date: new Date().toISOString() });
                     alert("✅ Registro climático guardado con éxito.");
                     document.getElementById('temp-input').value = '';
                     document.getElementById('hum-input').value = '';
                   }
                }}
              >
                REGISTRAR LECTURA
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
