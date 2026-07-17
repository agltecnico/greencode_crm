import { useData } from '../context/DataContext';

export default function EmployeeTasks() {
  const { 
    harvestTargets, crops, seeds, products, dailyLogs, addDailyLog 
  } = useData();

  // 1. Calculate Tasks from Active Crops
  const activeCrops = crops?.filter(c => c.status !== 'HARVESTED' && c.status !== 'DISCARDED') || [];
  
  const tasks = [];
  
  // Tareas de Invernadero (mover de fase)
  activeCrops.forEach(crop => {
    const seed = seeds?.find(s => s.id === crop.seedId);
    if(!seed) return;

    const planted = new Date(crop.datePlanted);
    const today = new Date();
    const daysSincePlanted = Math.floor((today - planted) / (1000 * 60 * 60 * 24));

    let expectedPhase = 'SOAKING';
    if(daysSincePlanted >= (seed.soakingHours > 0 ? 1 : 0)) expectedPhase = 'GERMINATION';
    if(daysSincePlanted >= (seed.soakingHours > 0 ? 1 : 0) + Number(seed.germinationDays)) expectedPhase = 'DARKNESS';
    if(daysSincePlanted >= (seed.soakingHours > 0 ? 1 : 0) + Number(seed.germinationDays) + Number(seed.darknessDays)) expectedPhase = 'LIGHT';
    if(daysSincePlanted >= (seed.soakingHours > 0 ? 1 : 0) + Number(seed.germinationDays) + Number(seed.darknessDays) + Number(seed.lightDays)) expectedPhase = 'HARVEST_READY';

    if(crop.status !== expectedPhase && expectedPhase !== 'HARVEST_READY') {
      tasks.push({
        type: 'move',
        text: `Mover ${crop.traysCount} bandejas de ${seed.name} (${crop.batchNumber}) a ${expectedPhase}`,
        icon: '🔄',
        color: 'bg-blue-500'
      });
    } else if (expectedPhase === 'HARVEST_READY' && crop.status !== 'HARVESTED') {
      tasks.push({
        type: 'harvest',
        text: `¡COSECHAR! ${crop.traysCount} bandejas de ${seed.name} (${crop.batchNumber})`,
        icon: '✂️',
        color: 'bg-green-500'
      });
    }
  });

  // Tareas del Planificador Inverso (Plantar / Remojar Hoy)
  const todayDayOfWeek = new Date().getDay(); // 0-6 (Sun-Sat)
  
  harvestTargets?.forEach(target => {
    const product = products?.find(p => p.id === target.productId);
    if(!product) return;

    // Si es un producto simple o mix, calculamos para cada semilla
    const recipeSeedsList = product.recipeSeeds?.length > 0 ? product.recipeSeeds : [{ seedId: target.productId }];
    
    recipeSeedsList.forEach(rs => {
      const seed = seeds?.find(s => s.id === rs.seedId);
      if(!seed) return;

      const totalCycleDays = (seed.soakingHours > 0 ? 1 : 0) + Number(seed.germinationDays) + Number(seed.darknessDays) + Number(seed.lightDays);
      
      let plantingDay = target.targetDayOfWeek - totalCycleDays;
      while(plantingDay < 0) plantingDay += 7;

      if(plantingDay === todayDayOfWeek) {
        tasks.push({
          type: 'plant',
          text: `Plantar semilla de ${seed.name} para el objetivo de ${product.name} (cosecha el día ${target.targetDayOfWeek})`,
          icon: '🌱',
          color: 'bg-yellow-500'
        });
        
        if(seed.soakingHours > 0) {
          let soakingDay = plantingDay - 1;
          if(soakingDay < 0) soakingDay += 7;
          if(soakingDay === todayDayOfWeek) {
            tasks.push({
              type: 'soak',
              text: `Poner a remojo semilla de ${seed.name} (${seed.soakingHours}h) para plantar mañana`,
              icon: '💧',
              color: 'bg-blue-400'
            });
          }
        }
      }
    });
  });

  return (
    <div className="mb-8">
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-[3] card bg-slate-900 border-2 border-primary shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <h2 className="text-2xl font-black mb-4 flex items-center gap-3">
            <span className="text-3xl">📺</span> TAREAS DE HOY (PANTALLA EMPLEADOS)
          </h2>
          
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <div className="p-8 text-center bg-slate-800 rounded-xl border border-slate-700">
                <p className="text-2xl text-gray-400">🎉 ¡No hay tareas pendientes para hoy!</p>
              </div>
            ) : (
              tasks.map((task, i) => (
                <div key={i} className={`p-4 rounded-xl flex items-center gap-4 border border-slate-700 shadow-lg ${task.color} bg-opacity-20`}>
                  <div className={`w-12 h-12 flex items-center justify-center rounded-full text-2xl ${task.color} text-white shadow-lg`}>
                    {task.icon}
                  </div>
                  <p className="text-xl font-bold text-white flex-1">{task.text}</p>
                  <button className="px-6 py-3 bg-white text-slate-900 font-black rounded-lg hover:bg-gray-200 transition-colors">
                    HECHO ✓
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 card bg-slate-800 border border-slate-700 flex flex-col justify-between">
          <div>
            <h3 className="text-xl font-bold mb-4">🌡️ Control Ambiental</h3>
            <p className="text-sm text-gray-400 mb-4">Registro diario obligatorio por Sanidad.</p>
            <div className="space-y-4">
              <div>
                <label className="font-bold text-gray-300 block mb-1">Temperatura ºC</label>
                <input type="number" className="form-control text-xl text-center py-3" placeholder="Ej: 24.5" id="temp-input"/>
              </div>
              <div>
                <label className="font-bold text-gray-300 block mb-1">Humedad %</label>
                <input type="number" className="form-control text-xl text-center py-3" placeholder="Ej: 55" id="hum-input"/>
              </div>
            </div>
          </div>
          <button 
            className="btn btn-primary w-full py-4 text-lg mt-6"
            onClick={() => {
               const t = document.getElementById('temp-input').value;
               const h = document.getElementById('hum-input').value;
               if(t && h) {
                 if(addDailyLog) addDailyLog({ temperature: t, humidity: h, date: new Date().toISOString() });
                 alert("Registro guardado con éxito. Queda anotado en la trazabilidad.");
                 document.getElementById('temp-input').value = '';
                 document.getElementById('hum-input').value = '';
               }
            }}
          >
            Guardar Registro
          </button>
        </div>
      </div>
    </div>
  );
}
