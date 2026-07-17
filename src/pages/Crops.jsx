import { useState } from 'react';
import { useData } from '../context/DataContext';
import EmployeeTasks from '../components/EmployeeTasks';

export default function Crops() {
  const { 
    providers, addProvider, deleteProvider,
    seeds, addSeed, deleteSeed,
    seedInventory, addSeedInventory, deleteSeedInventory,
    crops, addCrop, advanceCropStatus, discardCrop,
    harvestTargets, addHarvestTarget, deleteHarvestTarget,
    harvests, addHarvest,
    products
  } = useData();

  const [activeTab, setActiveTab] = useState('tareas');

  const [newProvider, setNewProvider] = useState({ name: '', contactInfo: '' });
  const [newSeed, setNewSeed] = useState({ name: '', providerId: '', soakingHours: 0, germinationDays: 3, darknessDays: 2, lightDays: 5, expectedYieldGrams: 0 });
  const [newInventory, setNewInventory] = useState({ seedId: '', providerBatch: '', weightGrams: 1000, purchaseDate: new Date().toISOString().split('T')[0] });
  const [newCrop, setNewCrop] = useState({ seedId: '', traysCount: 1, seedGramsPerTray: 0, inventoryId: '' });
  const [newTarget, setNewTarget] = useState({ targetDayOfWeek: 1, productId: '', tuppersCount: 10 });
  const [newHarvest, setNewHarvest] = useState({ productId: '', tuppersCount: 1 });

  // HANDLERS (Same logic as before)
  const handleAddProvider = e => { e.preventDefault(); addProvider(newProvider); setNewProvider({name:'', contactInfo:''}); };
  const handleAddSeed = e => { e.preventDefault(); addSeed(newSeed); setNewSeed({...newSeed, name:''}); };
  const handleAddInventory = e => { e.preventDefault(); addSeedInventory(newInventory); setNewInventory({...newInventory, providerBatch:''}); };
  const handleAddCrop = e => { 
    e.preventDefault(); 
    const batchNum = `S-\${Date.now().toString().slice(-6)}`;
    addCrop({...newCrop, datePlanted: new Date().toISOString(), batchNumber: batchNum, status: 'SOAKING'}); 
    setNewCrop({...newCrop, traysCount: 1, seedGramsPerTray: 0}); 
  };
  const handleAddHarvestTarget = e => { e.preventDefault(); addHarvestTarget(newTarget); };
  
  const handleRegisterHarvest = e => {
    e.preventDefault();
    const batchNum = `L-\${Date.now().toString().slice(-6)}`;
    addHarvest({...newHarvest, harvestDate: new Date().toISOString(), batchNumber: batchNum});
    
    // Auto-generate labels immediately
    const product = products?.find(p => p.id === newHarvest.productId);
    generateLabelPDF(product?.name || 'Desconocido', batchNum, product?.shelfLifeDays || 10, newHarvest.tuppersCount);
    
    setNewHarvest({...newHarvest, tuppersCount: 1});
    alert(`Cosecha registrada con el lote Sanidad: \${batchNum}. Generando PDF...`);
  };

  const generateLabelPDF = (productName, batch, shelfLife, copies) => {
    import('../utils/labelPdf.js').then(module => {
      module.generateAndPrintLabels(productName, batch, shelfLife, copies);
    });
  };

  // UI RENDERERS
  const renderCatalogo = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-slate-800/60 border border-slate-700/50 p-6 rounded-2xl shadow-xl backdrop-blur-sm">
        <h3 className="font-black mb-6 text-xl text-emerald-400 flex items-center gap-2"><span className="text-2xl">🏭</span> Proveedores de Semilla</h3>
        <form onSubmit={handleAddProvider} className="flex flex-col gap-4">
          <input type="text" placeholder="Nombre Proveedor" required className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none transition-colors" value={newProvider.name} onChange={e=>setNewProvider({...newProvider, name: e.target.value})}/>
          <input type="text" placeholder="Contacto / Web" className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none transition-colors" value={newProvider.contactInfo} onChange={e=>setNewProvider({...newProvider, contactInfo: e.target.value})}/>
          <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-transform">Añadir Proveedor</button>
        </form>
        <div className="mt-6 space-y-2">
          {providers?.map(p => (
            <div key={p.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <span className="font-bold text-slate-300">{p.name}</span>
              <button onClick={()=>deleteProvider(p.id)} className="text-red-400 hover:text-red-300">✖</button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/50 p-6 rounded-2xl shadow-xl backdrop-blur-sm">
        <h3 className="font-black mb-6 text-xl text-emerald-400 flex items-center gap-2"><span className="text-2xl">🌱</span> Catálogo de Semillas</h3>
        <form onSubmit={handleAddSeed} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <select className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" required value={newSeed.providerId} onChange={e=>setNewSeed({...newSeed, providerId: e.target.value})}>
              <option value="">-- Proveedor --</option>
              {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <input type="text" placeholder="Nombre Semilla (Ej: Rábano Sango)" required className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" value={newSeed.name} onChange={e=>setNewSeed({...newSeed, name: e.target.value})}/>
          </div>
          <div><label className="text-xs font-bold text-slate-400 mb-1 block">Horas Remojo</label><input type="number" required min="0" className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-2" value={newSeed.soakingHours} onChange={e=>setNewSeed({...newSeed, soakingHours: e.target.value})}/></div>
          <div><label className="text-xs font-bold text-slate-400 mb-1 block">Días Germinación</label><input type="number" required min="0" className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-2" value={newSeed.germinationDays} onChange={e=>setNewSeed({...newSeed, germinationDays: e.target.value})}/></div>
          <div><label className="text-xs font-bold text-slate-400 mb-1 block">Días Oscuridad</label><input type="number" required min="0" className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-2" value={newSeed.darknessDays} onChange={e=>setNewSeed({...newSeed, darknessDays: e.target.value})}/></div>
          <div><label className="text-xs font-bold text-slate-400 mb-1 block">Días Luz</label><input type="number" required min="0" className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-2" value={newSeed.lightDays} onChange={e=>setNewSeed({...newSeed, lightDays: e.target.value})}/></div>
          <button type="submit" className="col-span-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-transform mt-2">Añadir Semilla al Catálogo</button>
        </form>
        <div className="mt-6 space-y-3">
          {seeds?.map(s => (
            <div key={s.id} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 text-sm">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-white text-base">{s.name}</span>
                <button onClick={()=>deleteSeed(s.id)} className="text-red-400 hover:text-red-300">✖</button>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono">
                <div className="bg-blue-900/40 text-blue-300 p-1 rounded">💧 {s.soakingHours}h</div>
                <div className="bg-amber-900/40 text-amber-300 p-1 rounded">🌱 {s.germinationDays}d</div>
                <div className="bg-purple-900/40 text-purple-300 p-1 rounded">🌑 {s.darknessDays}d</div>
                <div className="bg-green-900/40 text-green-300 p-1 rounded">☀️ {s.lightDays}d</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderInventario = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1 bg-slate-800/60 border border-slate-700/50 p-6 rounded-2xl shadow-xl backdrop-blur-sm h-fit">
        <h3 className="font-black mb-6 text-xl text-emerald-400 flex items-center gap-2"><span className="text-2xl">📦</span> Registrar Compra (Saco)</h3>
        <form onSubmit={handleAddInventory} className="flex flex-col gap-4">
          <select className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" required value={newInventory.seedId} onChange={e=>setNewInventory({...newInventory, seedId: e.target.value})}>
            <option value="">-- Qué Semilla es --</option>
            {seeds?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="text" placeholder="Lote del Proveedor (Trazabilidad)" required className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" value={newInventory.providerBatch} onChange={e=>setNewInventory({...newInventory, providerBatch: e.target.value})}/>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-400 mb-1 block">Peso (Gramos)</label>
              <input type="number" required min="1" className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" value={newInventory.weightGrams} onChange={e=>setNewInventory({...newInventory, weightGrams: e.target.value})}/>
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-400 mb-1 block">Fecha</label>
              <input type="date" required className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" value={newInventory.purchaseDate} onChange={e=>setNewInventory({...newInventory, purchaseDate: e.target.value})}/>
            </div>
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-transform mt-2">Guardar Saco en Inventario</button>
        </form>
      </div>
      
      <div className="lg:col-span-2 bg-slate-800/60 border border-slate-700/50 p-6 rounded-2xl shadow-xl backdrop-blur-sm">
        <h3 className="font-black mb-6 text-xl text-emerald-400 flex items-center gap-2"><span className="text-2xl">📋</span> Stock Disponible</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {seedInventory?.map(inv => {
            const seed = seeds?.find(s => s.id === inv.seedId);
            return (
              <div key={inv.id} className="relative p-5 rounded-xl border border-slate-700/50 bg-slate-900/60 overflow-hidden group">
                <button onClick={() => deleteSeedInventory(inv.id)} className="absolute top-3 right-3 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity">✖</button>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-lg text-white">{seed?.name || 'Semilla Eliminada'}</h4>
                  <span className="font-mono text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded">LOTE: {inv.providerBatch}</span>
                </div>
                <div className="flex gap-4 items-end mt-4">
                  <div>
                    <p className="text-xs text-slate-400">Total Comprado</p>
                    <p className="font-black text-xl">{inv.weightGrams}g</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Restante Estimado</p>
                    <p className="font-black text-2xl text-emerald-400">{inv.remainingGrams || inv.weightGrams}g</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );

  const renderLotes = () => {
    const activeCropsList = crops?.filter(c => c.status !== 'HARVESTED' && c.status !== 'DISCARDED') || [];
    
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 bg-slate-800/60 border border-slate-700/50 p-6 rounded-2xl shadow-xl backdrop-blur-sm h-fit">
          <h3 className="font-black mb-6 text-xl text-emerald-400 flex items-center gap-2"><span className="text-2xl">🪴</span> Sembrar / Remojar</h3>
          <form onSubmit={handleAddCrop} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1 block">¿De qué saco vas a coger?</label>
              <select className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" required value={newCrop.inventoryId} onChange={e=>{
                const inv = seedInventory?.find(i => i.id === e.target.value);
                setNewCrop({...newCrop, inventoryId: e.target.value, seedId: inv?.seedId || ''});
              }}>
                <option value="">-- Seleccionar Saco --</option>
                {seedInventory?.filter(i => (i.remainingGrams || i.weightGrams) > 0).map(i => {
                  const seed = seeds?.find(s => s.id === i.seedId);
                  return <option key={i.id} value={i.id}>{seed?.name} (Lote: {i.providerBatch})</option>
                })}
              </select>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-400 mb-1 block">Nº Bandejas</label>
                <input type="number" required min="1" className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" value={newCrop.traysCount} onChange={e=>setNewCrop({...newCrop, traysCount: e.target.value})}/>
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold text-slate-400 mb-1 block">Gramos x Bandeja</label>
                <input type="number" required min="1" className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" value={newCrop.seedGramsPerTray} onChange={e=>setNewCrop({...newCrop, seedGramsPerTray: e.target.value})}/>
              </div>
            </div>
            <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-transform mt-2">Comenzar Ciclo</button>
          </form>
        </div>

        <div className="lg:col-span-3 bg-slate-800/60 border border-slate-700/50 p-6 rounded-2xl shadow-xl backdrop-blur-sm">
          <h3 className="font-black mb-6 text-xl text-emerald-400 flex items-center gap-2"><span className="text-2xl">🌱</span> Bandejas en Curso</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeCropsList.map(crop => {
              const seed = seeds?.find(s => s.id === crop.seedId);
              const daysAlive = Math.floor((new Date() - new Date(crop.datePlanted)) / (1000 * 60 * 60 * 24));
              
              const statusColors = {
                'SOAKING': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
                'GERMINATION': 'bg-amber-500/20 text-amber-400 border-amber-500/50',
                'DARKNESS': 'bg-purple-500/20 text-purple-400 border-purple-500/50',
                'LIGHT': 'bg-green-500/20 text-green-400 border-green-500/50'
              };

              return (
                <div key={crop.id} className={`p-5 rounded-xl border bg-slate-900/80 shadow-md ${statusColors[crop.status]}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-black text-lg text-white">{seed?.name}</h4>
                      <p className="text-xs font-mono opacity-80 mt-1">LOTE: {crop.batchNumber}</p>
                    </div>
                    <button onClick={() => discardCrop(crop)} className="text-red-400 hover:text-red-300 bg-red-400/10 px-2 py-1 rounded text-xs">Descartar</button>
                  </div>
                  
                  <div className="flex justify-between items-end mt-4 border-t border-slate-700/50 pt-4">
                    <div>
                      <p className="text-xs uppercase font-bold opacity-70">Estado Actual</p>
                      <p className="font-black text-lg">{crop.status}</p>
                      <p className="text-xs opacity-70">Día {daysAlive}</p>
                    </div>
                    <button onClick={() => advanceCropStatus(crop)} className="bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors">
                      Avanzar ⏭
                    </button>
                  </div>
                </div>
              );
            })}
            {activeCropsList.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 font-medium border-2 border-dashed border-slate-700 rounded-2xl">
                No hay cultivos activos en el invernadero ahora mismo.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCosechas = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-slate-800/60 border border-slate-700/50 p-6 rounded-2xl shadow-xl backdrop-blur-sm h-fit">
        <h3 className="font-black mb-6 text-xl text-emerald-400 flex items-center gap-2"><span className="text-2xl">🔪</span> Registrar Cosecha y Envasado</h3>
        <form onSubmit={handleRegisterHarvest} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1 block">¿Qué producto has envasado hoy?</label>
            <select className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" required value={newHarvest.productId} onChange={e=>setNewHarvest({...newHarvest, productId: e.target.value})}>
              <option value="">-- Seleccionar --</option>
              {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1 block">¿Cuántos tuppers en total han salido?</label>
            <input type="number" className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" required min="1" value={newHarvest.tuppersCount} onChange={e=>setNewHarvest({...newHarvest, tuppersCount: e.target.value})}/>
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black py-4 rounded-xl shadow-lg hover:scale-[1.02] transition-transform mt-4 flex items-center justify-center gap-2">
            🖨️ Registrar Cosecha e Imprimir Etiquetas
          </button>
        </form>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/50 p-6 rounded-2xl shadow-xl backdrop-blur-sm">
        <h3 className="font-black mb-6 text-xl text-emerald-400 flex items-center gap-2"><span className="text-2xl">🏷️</span> Historial de Lotes de Sanidad</h3>
        <div className="space-y-3">
          {harvests?.slice().reverse().map(h => {
            const product = products?.find(p => p.id === h.productId);
            return (
              <div key={h.id} className="bg-slate-900/60 p-4 rounded-xl border border-slate-700/50 flex justify-between items-center hover:border-emerald-500/30 transition-colors">
                <div>
                  <div className="flex gap-2 items-center mb-1">
                    <span className="font-black text-white text-lg">{product?.name || 'Desconocido'}</span>
                    <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">{h.batchNumber}</span>
                  </div>
                  <p className="text-sm text-slate-400">Envasado: {new Date(h.harvestDate).toLocaleDateString()} • <span className="font-bold text-slate-300">{h.tuppersCount} tuppers</span></p>
                </div>
                <button 
                  className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 font-bold" 
                  onClick={() => generateLabelPDF(product?.name || '', h.batchNumber, product?.shelfLifeDays || 10, h.tuppersCount)}>
                  🖨️ Re-Imprimir
                </button>
              </div>
            )
          })}
          {!harvests?.length && <div className="text-center py-8 text-slate-500 font-medium">Aún no hay envasados registrados.</div>}
        </div>
      </div>
    </div>
  );

  const renderPlanificador = () => (
    <div>
      <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 border border-emerald-500/30 p-8 rounded-2xl mb-8 shadow-lg backdrop-blur-sm">
        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 mb-3">Planificador Inverso Automático</h2>
        <p className="text-slate-300 font-medium text-lg leading-relaxed max-w-4xl">
          Dinos qué producto final quieres envasar y qué día de la semana. El sistema calculará automáticamente 
          qué día hay que plantar cada semilla basándose en su receta, y colocará las tareas correspondientes 
          en el Dashboard para que no tengas que pensar en fechas.
        </p>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/50 p-6 rounded-2xl shadow-xl backdrop-blur-sm mb-8">
        <form onSubmit={handleAddHarvestTarget} className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-slate-400 mb-1 block">Día de Cosecha Objetivo</label>
            <select className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" value={newTarget.targetDayOfWeek} onChange={e=>setNewTarget({...newTarget, targetDayOfWeek: e.target.value})}>
              <option value="1">Lunes</option>
              <option value="2">Martes</option>
              <option value="3">Miércoles</option>
              <option value="4">Jueves</option>
              <option value="5">Viernes</option>
              <option value="6">Sábado</option>
              <option value="0">Domingo</option>
            </select>
          </div>
          <div className="flex-[2] w-full">
            <label className="text-xs font-bold text-slate-400 mb-1 block">Producto a Envasar (Simple o Mix)</label>
            <select className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" required value={newTarget.productId} onChange={e=>setNewTarget({...newTarget, productId: e.target.value})}>
              <option value="">-- Seleccionar --</option>
              {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex-1 w-full">
            <label className="text-xs font-bold text-slate-400 mb-1 block">Tuppers Deseados</label>
            <input type="number" className="w-full bg-slate-900 border-2 border-slate-700 text-white rounded-xl px-4 py-3 focus:border-emerald-500 focus:outline-none" required min="1" value={newTarget.tuppersCount} onChange={e=>setNewTarget({...newTarget, tuppersCount: e.target.value})}/>
          </div>
          <button type="submit" className="w-full md:w-auto px-8 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black py-3.5 rounded-xl shadow-lg hover:scale-[1.02] transition-transform">Crear Rutina</button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {harvestTargets?.map(ht => {
          const product = products?.find(p => p.id === ht.productId);
          const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
          return (
            <div key={ht.id} className="relative bg-slate-900/60 border border-emerald-500/30 p-6 rounded-2xl shadow-lg overflow-hidden group">
              <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
              <button onClick={() => deleteHarvestTarget(ht.id)} className="absolute top-4 right-4 text-slate-500 hover:text-red-400 transition-colors">✖</button>
              <h4 className="font-black text-xl text-white mb-2 pr-6">{product?.name || 'Producto Eliminado'}</h4>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-black text-emerald-400">{ht.tuppersCount}</span>
                <span className="text-sm font-bold text-slate-400 uppercase">tuppers</span>
              </div>
              <div className="inline-block px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold rounded-lg">
                Todos los {days[ht.targetDayOfWeek]}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );

  return (
    <div className="pb-20 max-w-7xl mx-auto">
      {/* TABS HEADER SUPER PREMIUM */}
      <div className="flex flex-wrap lg:flex-nowrap gap-2 mb-10 bg-slate-900/80 p-2 rounded-2xl border border-slate-700/50 shadow-2xl backdrop-blur-xl sticky top-4 z-10">
        {[
          { id: 'tareas', label: 'Dashboard de Tareas', icon: '🎯' },
          { id: 'lotes', label: 'Invernadero Activo', icon: '🪴' },
          { id: 'cosechas', label: 'Envasado y Sanidad', icon: '🔪' },
          { id: 'planificador', label: 'Planificador Inverso', icon: '🗓️' },
          { id: 'inventario', label: 'Compras y Stock', icon: '📦' },
          { id: 'catalogo', label: 'Catálogo Semillas', icon: '🧬' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 whitespace-nowrap \${
              activeTab === tab.id 
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 scale-[1.02]' 
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span className="text-xl">{tab.icon}</span> 
            <span className={activeTab === tab.id ? 'opacity-100' : 'opacity-80'}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="animate-fade-in-up">
        {activeTab === 'tareas' && <EmployeeTasks />}
        {activeTab === 'catalogo' && renderCatalogo()}
        {activeTab === 'inventario' && renderInventario()}
        {activeTab === 'lotes' && renderLotes()}
        {activeTab === 'cosechas' && renderCosechas()}
        {activeTab === 'planificador' && renderPlanificador()}
      </div>
      
    </div>
  );
}
