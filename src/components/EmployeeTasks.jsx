import { useState } from 'react';
import { useData } from '../context/DataContext';

export default function EmployeeTasks() {
  const { harvestTargets, crops, seeds, products, dailyLogs, addDailyLog } = useData();
  const [timeFilter, setTimeFilter] = useState(1); // 1 = Hoy, 7 = Esta semana, 30 = Este mes

  const activeCrops = crops?.filter(c => c.status !== 'HARVESTED' && c.status !== 'DISCARDED') || [];
  
  // Generar un rango de fechas a proyectar
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const datesToAnalyze = Array.from({length: timeFilter}).map((_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const allTasks = [];

  // Analizar cada fecha proyectada
  datesToAnalyze.forEach(targetDate => {
    const targetDayOfWeek = targetDate.getDay();
    const dateKey = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const isToday = dateKey === today.toISOString().split('T')[0];

    const tasksForDate = [];

    // --- 1. Tareas de Invernadero (basado en bandejas activas) ---
    activeCrops.forEach(crop => {
      const seed = seeds?.find(s => s.id === crop.seedId);
      if(!seed) return;

      const planted = new Date(crop.datePlanted);
      planted.setHours(0,0,0,0);
      const daysSincePlanted = Math.floor((targetDate - planted) / (1000 * 60 * 60 * 24));

      // Solo evaluamos si el targetDate es el da EXACTO del cambio de fase.
      // Si miramos a futuro, queremos saber el da exacto que toca.
      // Si miramos hoy, mostramos si debera haberse hecho (retrasado) o toca hoy.
      
      const soakOffset = seed.soakingHours > 0 ? 1 : 0;
      const germDay = soakOffset;
      const darkDay = soakOffset + Number(seed.germinationDays);
      const lightDay = soakOffset + Number(seed.germinationDays) + Number(seed.darknessDays);
      const harvestDay = soakOffset + Number(seed.germinationDays) + Number(seed.darknessDays) + Number(seed.lightDays);

      let action = null;
      let phaseStr = '';
      
      // La lgica: Si es hoy, avisar de todas las transiciones pendientes o vencidas
      // Si es a futuro, slo avisar en el da EXACTO
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
          color: 'from-blue-500/20 to-cyan-500/10 border-cyan-500/50 text-cyan-400'
        });
      } else if (action === 'harvest') {
        tasksForDate.push({
          type: 'harvest',
          title: `¡COSECHAR!`,
          desc: `${crop.traysCount} bandejas de ${seed.name} (Lote: ${crop.batchNumber})`,
          icon: '🔪',
          color: 'from-emerald-500/30 to-green-500/10 border-emerald-500/50 text-emerald-400'
        });
      }
    });

    // --- 2. Tareas Predictivas del Planificador ---
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
            color: 'from-amber-500/20 to-orange-500/10 border-orange-500/50 text-orange-400'
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
              color: 'from-blue-600/20 to-indigo-500/10 border-indigo-500/50 text-indigo-400'
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
    <div className="w-full">
      {/* HEADER DE FILTROS Y REGISTRO AMBIENTAL */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
        <div>
          <h2 className="text-3xl font-black bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-sm mb-2">
            Dashboard de Tareas
          </h2>
          <p className="text-slate-400 font-medium">Controla el pulso de tu invernadero en tiempo real y a futuro.</p>
        </div>

        {/* TIME FILTERS */}
        <div className="flex bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/50 shadow-inner backdrop-blur-md">
          {[
            { v: 1, l: 'HOY' },
            { v: 7, l: '7 DÍAS' },
            { v: 30, l: '30 DÍAS' }
          ].map(f => (
            <button 
              key={f.v}
              onClick={() => setTimeFilter(f.v)}
              className={`px-6 py-2 rounded-lg font-bold transition-all duration-300 ${timeFilter === f.v ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg scale-105' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
            >
              {f.l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* LISTA DE TAREAS */}
        <div className="xl:col-span-3 space-y-6">
          {allTasks.map((dayGroup, idx) => (
            <div key={idx} className={`rounded-2xl border ${dayGroup.isToday ? 'border-emerald-500/30 bg-slate-800/60' : 'border-slate-700/50 bg-slate-900/40'} p-6 backdrop-blur-sm shadow-xl transition-all`}>
              <div className="flex items-center gap-4 mb-6 border-b border-slate-700/50 pb-4">
                <div className={`text-xl font-black ${dayGroup.isToday ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {dayGroup.isToday ? '🎯 TAREAS DE HOY' : dayGroup.date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase()}
                </div>
                {!dayGroup.isToday && <div className="h-px bg-slate-700/50 flex-1"></div>}
              </div>

              {dayGroup.items.length === 0 ? (
                <div className="flex items-center justify-center p-8 rounded-xl bg-slate-800/30 border border-slate-700/30 border-dashed">
                  <p className="text-slate-500 font-medium text-lg">✨ Todo despejado para este día.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dayGroup.items.map((task, i) => (
                    <div key={i} className={`group relative p-5 rounded-xl border bg-gradient-to-br ${task.color} hover:-translate-y-1 transition-all duration-300 cursor-default`}>
                      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none"></div>
                      <div className="flex gap-4">
                        <div className="text-4xl filter drop-shadow-md">{task.icon}</div>
                        <div>
                          <h4 className="font-black text-lg mb-1 leading-tight text-white">{task.title}</h4>
                          <p className="text-sm opacity-80 font-medium leading-snug">{task.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* SIDEBAR DERECHO: WIDGET AMBIENTAL */}
        <div className="xl:col-span-1 space-y-6">
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/60 p-6 backdrop-blur-sm shadow-xl sticky top-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">🌡️</span>
              <h3 className="text-xl font-black text-white">Clima Invernadero</h3>
            </div>
            
            <p className="text-sm text-slate-400 mb-6 font-medium leading-relaxed">
              Introduce las métricas actuales. Se requiere un registro diario obligatorio por normativas de Sanidad.
            </p>
            
            <div className="space-y-5">
              <div className="relative">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Temperatura (°C)</label>
                <div className="absolute inset-y-0 right-0 pt-6 pr-4 flex items-center pointer-events-none">
                  <span className="text-slate-500 font-medium text-lg">°C</span>
                </div>
                <input type="number" id="temp-input" step="0.1" className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 text-lg font-bold focus:border-emerald-500 focus:outline-none transition-colors" placeholder="Ej: 24.5" />
              </div>
              
              <div className="relative">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Humedad (%)</label>
                <div className="absolute inset-y-0 right-0 pt-6 pr-4 flex items-center pointer-events-none">
                  <span className="text-slate-500 font-medium text-lg">%</span>
                </div>
                <input type="number" id="hum-input" className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 text-lg font-bold focus:border-cyan-500 focus:outline-none transition-colors" placeholder="Ej: 55" />
              </div>

              <button 
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black py-4 rounded-xl shadow-lg shadow-emerald-500/20 transform transition-all active:scale-95 mt-4"
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
