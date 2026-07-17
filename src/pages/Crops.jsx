import { useState } from 'react';
import { useData } from '../context/DataContext';
import { generateLabelPDF } from '../utils/labelPdf';

export default function Crops() {
  const { 
    providers, addProvider, deleteProvider,
    seeds, addSeed, deleteSeed,
    seedInventory, addSeedInventory,
    crops, addCrop, updateCrop, deleteCrop,
    harvestTargets, addHarvestTarget, deleteHarvestTarget,
    harvests, addHarvest,
    products
  } = useData();

  const [activeTab, setActiveTab] = useState('catalogo');

  // FORM STATES
  const [newProvider, setNewProvider] = useState({ name: '', contact: '', phone: '', email: '' });
  const [newSeed, setNewSeed] = useState({ name: '', providerId: '', costPerKg: '', soakingHours: 0, germinationDays: 2, darknessDays: 3, lightDays: 7, expectedYieldGrams: 0, minimumStockAlert: 500 });
  const [newPurchase, setNewPurchase] = useState({ seedId: '', providerLotNumber: '', gramsPurchased: '', costPerKg: '' });
  const [newCrop, setNewCrop] = useState({ seedInventoryId: '', traysCount: '', gramsPerTray: '', substrateCostPerTray: '' });
  const [newHarvest, setNewHarvest] = useState({ productId: '', tuppersCount: '' });
  const [newTarget, setNewTarget] = useState({ targetDayOfWeek: '1', productId: '', tuppersCount: '' });

  // HANDLERS
  const handleAddProvider = (e) => {
    e.preventDefault();
    if(newProvider.name) {
      addProvider(newProvider);
      setNewProvider({ name: '', contact: '', phone: '', email: '' });
    }
  };

  const handleAddSeed = (e) => {
    e.preventDefault();
    if(newSeed.name && newSeed.providerId && newSeed.costPerKg) {
      addSeed({ ...newSeed, costPerKg: Number(newSeed.costPerKg), stockGrams: 0 });
      setNewSeed({ name: '', providerId: '', costPerKg: '', soakingHours: 0, germinationDays: 2, darknessDays: 3, lightDays: 7, expectedYieldGrams: 0, minimumStockAlert: 500 });
    }
  };

  const handleAddPurchase = (e) => {
    e.preventDefault();
    if(newPurchase.seedId && newPurchase.providerLotNumber && newPurchase.gramsPurchased) {
      const g = Number(newPurchase.gramsPurchased);
      addSeedInventory({
        ...newPurchase,
        gramsPurchased: g,
        gramsRemaining: g,
        costPerKg: Number(newPurchase.costPerKg),
        purchaseDate: new Date().toISOString()
      });
      setNewPurchase({ seedId: '', providerLotNumber: '', gramsPurchased: '', costPerKg: '' });
      alert("Lote de semillas registrado correctamente");
    }
  };

  const handleAddCrop = (e) => {
    e.preventDefault();
    if(newCrop.seedInventoryId && newCrop.traysCount) {
      const inv = seedInventory.find(i => i.id === newCrop.seedInventoryId);
      if(!inv) return;
      const seedDef = seeds.find(s => s.id === inv.seedId);
      if(!seedDef) return;

      const g = Number(newCrop.gramsPerTray) || 0;
      const t = Number(newCrop.traysCount) || 1;
      
      const batchNum = `S-${Date.now().toString().slice(-6)}`;
      addCrop({
        ...newCrop,
        batchNumber: batchNum,
        seedId: inv.seedId,
        datePlanted: new Date().toISOString(),
        traysCount: t,
        gramsPerTray: g,
        substrateCostPerTray: Number(newCrop.substrateCostPerTray) || 0,
        status: seedDef.soakingHours > 0 ? 'SOAKING' : 'GERMINATION'
      });
      setNewCrop({ seedInventoryId: '', traysCount: '', gramsPerTray: '', substrateCostPerTray: '' });
    }
  };

  const handleAddHarvestTarget = (e) => {
    e.preventDefault();
    if(newTarget.productId && newTarget.tuppersCount) {
      addHarvestTarget({
        ...newTarget,
        targetDayOfWeek: Number(newTarget.targetDayOfWeek),
        tuppersCount: Number(newTarget.tuppersCount)
      });
      setNewTarget({ targetDayOfWeek: '1', productId: '', tuppersCount: '' });
    }
  };

  const advanceCropStatus = (crop) => {
    const states = ['SOAKING', 'GERMINATION', 'DARKNESS', 'LIGHT', 'HARVESTED'];
    const idx = states.indexOf(crop.status);
    if(idx < states.length - 1) {
      updateCrop(crop.id, { status: states[idx + 1] });
    }
  };

  const handleRegisterHarvest = (e) => {
    e.preventDefault();
    if(newHarvest.productId && newHarvest.tuppersCount) {
      const p = products.find(prod => prod.id === newHarvest.productId);
      if(!p) return;

      const lotSanidad = `LOT-${new Date().toISOString().slice(2,10).replace(/-/g,'')}-${p.name.substring(0,3).toUpperCase()}`;
      const costPerTupper = 0.50; // Calculo simplificado para la demo

      addHarvest({
        productId: newHarvest.productId,
        tuppersCount: Number(newHarvest.tuppersCount),
        batchNumber: lotSanidad,
        costPerTupper: costPerTupper,
        harvestDate: new Date().toISOString()
      });

      // Generar Etiquetas
      generateLabelPDF(p.name, lotSanidad, p.shelfLifeDays || 10, Number(newHarvest.tuppersCount));

      setNewHarvest({ productId: '', tuppersCount: '' });
      alert("Cosecha registrada. Lote: " + lotSanidad + "\\nImprimiendo Etiquetas...");
    }
  };

  // RENDERERS
  const renderCatalogo = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Proveedores */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4 border-b border-slate-700 pb-2">Proveedores de Semillas</h3>
        <form onSubmit={handleAddProvider} className="flex flex-col gap-3 mb-6 bg-slate-800/50 p-4 rounded border border-slate-700">
          <input className="form-control" placeholder="Nombre Proveedor" required value={newProvider.name} onChange={e => setNewProvider({...newProvider, name: e.target.value})} />
          <div className="grid grid-cols-2 gap-2">
            <input className="form-control" placeholder="Teléfono" value={newProvider.phone} onChange={e => setNewProvider({...newProvider, phone: e.target.value})} />
            <input className="form-control" placeholder="Email" value={newProvider.email} onChange={e => setNewProvider({...newProvider, email: e.target.value})} />
          </div>
          <button type="submit" className="btn btn-primary w-full text-sm">Añadir Proveedor</button>
        </form>

        <div className="space-y-2">
          {providers?.map(p => (
            <div key={p.id} className="flex justify-between items-center bg-slate-800 p-3 rounded">
              <div>
                <p className="font-bold">{p.name}</p>
                <p className="text-xs text-gray-400">{p.phone} | {p.email}</p>
              </div>
              <button onClick={() => deleteProvider(p.id)} className="text-red-400 hover:text-red-300">✕</button>
            </div>
          ))}
          {!providers?.length && <p className="text-sm text-gray-500">No hay proveedores.</p>}
        </div>
      </div>

      {/* Variedades de Semillas */}
      <div className="card">
        <h3 className="text-xl font-bold mb-4 border-b border-slate-700 pb-2">Catálogo de Semillas</h3>
        <form onSubmit={handleAddSeed} className="flex flex-col gap-3 mb-6 bg-slate-800/50 p-4 rounded border border-slate-700">
          <div className="grid grid-cols-2 gap-2">
            <input className="form-control" placeholder="Nombre (Ej: Rábano Sango)" required value={newSeed.name} onChange={e => setNewSeed({...newSeed, name: e.target.value})} />
            <select className="form-control" required value={newSeed.providerId} onChange={e => setNewSeed({...newSeed, providerId: e.target.value})}>
              <option value="">-- Proveedor --</option>
              {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input className="form-control" type="number" step="0.01" placeholder="Coste Estimado (€/Kg)" required value={newSeed.costPerKg} onChange={e => setNewSeed({...newSeed, costPerKg: e.target.value})} />
            <input className="form-control" type="number" placeholder="Alerta Stock Mín (Gramos)" value={newSeed.minimumStockAlert} onChange={e => setNewSeed({...newSeed, minimumStockAlert: e.target.value})} />
          </div>
          <p className="text-xs text-primary font-bold mt-2">Días del Ciclo (Planificador Inverso):</p>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div><label>Remojo (h)</label><input type="number" className="form-control px-1" value={newSeed.soakingHours} onChange={e=>setNewSeed({...newSeed, soakingHours: e.target.value})}/></div>
            <div><label>Germ. (d)</label><input type="number" className="form-control px-1" value={newSeed.germinationDays} onChange={e=>setNewSeed({...newSeed, germinationDays: e.target.value})}/></div>
            <div><label>Oscuridad (d)</label><input type="number" className="form-control px-1" value={newSeed.darknessDays} onChange={e=>setNewSeed({...newSeed, darknessDays: e.target.value})}/></div>
            <div><label>Luz (d)</label><input type="number" className="form-control px-1" value={newSeed.lightDays} onChange={e=>setNewSeed({...newSeed, lightDays: e.target.value})}/></div>
          </div>
          <button type="submit" className="btn btn-primary w-full text-sm mt-2">Añadir Semilla</button>
        </form>

        <div className="space-y-2">
          {seeds?.map(s => (
            <div key={s.id} className="bg-slate-800 p-3 rounded flex justify-between items-center border-l-4 border-l-primary">
              <div>
                <p className="font-bold text-white">{s.name}</p>
                <div className="flex gap-2 text-xs mt-1 text-gray-400">
                  <span className="bg-slate-700 px-1 rounded">Rem: {s.soakingHours}h</span>
                  <span className="bg-slate-700 px-1 rounded">Ger: {s.germinationDays}d</span>
                  <span className="bg-slate-700 px-1 rounded">Osc: {s.darknessDays}d</span>
                  <span className="bg-slate-700 px-1 rounded">Luz: {s.lightDays}d</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-green-400">{s.costPerKg} €/Kg</p>
                <button onClick={() => deleteSeed(s.id)} className="text-red-400 hover:text-red-300 text-xs mt-1">Borrar</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderInventario = () => (
    <div className="card">
      <h3 className="text-xl font-bold mb-4">Registro de Compras (Trazabilidad)</h3>
      <form onSubmit={handleAddPurchase} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6 bg-slate-800/50 p-4 rounded border border-slate-700">
        <select className="form-control" required value={newPurchase.seedId} onChange={e => setNewPurchase({...newPurchase, seedId: e.target.value})}>
          <option value="">-- Variedad Comprada --</option>
          {seeds?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input className="form-control" placeholder="Nº Lote Proveedor" required value={newPurchase.providerLotNumber} onChange={e => setNewPurchase({...newPurchase, providerLotNumber: e.target.value})} />
        <input className="form-control" type="number" placeholder="Gramos (Ej: 5000 = 5Kg)" required value={newPurchase.gramsPurchased} onChange={e => setNewPurchase({...newPurchase, gramsPurchased: e.target.value})} />
        <input className="form-control" type="number" step="0.01" placeholder="Precio Pagado (€/Kg)" required value={newPurchase.costPerKg} onChange={e => setNewPurchase({...newPurchase, costPerKg: e.target.value})} />
        <button type="submit" className="btn btn-primary h-full">Registrar Saco</button>
      </form>

      <table className="table">
        <thead>
          <tr>
            <th>Fecha Compra</th>
            <th>Semilla</th>
            <th>Lote Trazabilidad</th>
            <th>Gramos Restantes</th>
            <th>Coste Kg</th>
          </tr>
        </thead>
        <tbody>
          {seedInventory?.map(inv => {
            const seed = seeds?.find(s => s.id === inv.seedId);
            return (
              <tr key={inv.id}>
                <td>{new Date(inv.purchaseDate).toLocaleDateString()}</td>
                <td className="font-bold">{seed?.name || 'Desconocida'}</td>
                <td className="font-mono text-primary text-sm">{inv.providerLotNumber}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-green-500 h-full" style={{ width: `${Math.max(0, (inv.gramsRemaining/inv.gramsPurchased)*100)}%` }}></div>
                    </div>
                    <span className="text-xs">{inv.gramsRemaining}g</span>
                  </div>
                </td>
                <td>{inv.costPerKg} €</td>
              </tr>
            );
          })}
          {!seedInventory?.length && <tr><td colSpan="5" className="text-center">No hay compras registradas.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  const renderLotes = () => {
    const activeCrops = crops?.filter(c => c.status !== 'HARVESTED' && c.status !== 'DISCARDED') || [];
    
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-1 border-t-4 border-t-primary h-fit">
          <h3 className="font-bold mb-4">Nueva Siembra Manual</h3>
          <form onSubmit={handleAddCrop} className="flex flex-col gap-3">
            <select className="form-control" required value={newCrop.seedInventoryId} onChange={e => setNewCrop({...newCrop, seedInventoryId: e.target.value})}>
              <option value="">-- Seleccionar Saco de Semilla --</option>
              {seedInventory?.filter(i => i.gramsRemaining > 0).map(inv => {
                const s = seeds?.find(x => x.id === inv.seedId);
                return <option key={inv.id} value={inv.id}>{s?.name} (Lote: {inv.providerLotNumber}) - Quedan {inv.gramsRemaining}g</option>
              })}
            </select>
            <input className="form-control" type="number" required placeholder="Nº de Bandejas" value={newCrop.traysCount} onChange={e => setNewCrop({...newCrop, traysCount: e.target.value})} />
            <input className="form-control" type="number" required placeholder="Gramos de semilla por bandeja" value={newCrop.gramsPerTray} onChange={e => setNewCrop({...newCrop, gramsPerTray: e.target.value})} />
            <input className="form-control" type="number" step="0.01" required placeholder="Coste Sustrato por Bandeja (€)" value={newCrop.substrateCostPerTray} onChange={e => setNewCrop({...newCrop, substrateCostPerTray: e.target.value})} />
            <button type="submit" className="btn btn-primary mt-2">Plantar</button>
          </form>
        </div>

        <div className="card lg:col-span-2">
          <h3 className="font-bold mb-4">Invernadero Activo (Lotes)</h3>
          <div className="space-y-3">
            {activeCrops.map(crop => {
              const inv = seedInventory?.find(i => i.id === crop.seedInventoryId);
              const seed = seeds?.find(s => s.id === inv?.seedId || s.id === crop.seedId);
              
              const statusColors = {
                'SOAKING': 'bg-blue-500/20 text-blue-300 border-blue-500',
                'GERMINATION': 'bg-yellow-500/20 text-yellow-300 border-yellow-500',
                'DARKNESS': 'bg-slate-700/80 text-gray-300 border-slate-500',
                'LIGHT': 'bg-green-500/20 text-green-300 border-green-500'
              };

              return (
                <div key={crop.id} className="bg-slate-800 p-4 rounded flex justify-between items-center border border-slate-700">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-lg">{seed?.name}</span>
                      <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">{crop.batchNumber}</span>
                    </div>
                    <p className="text-sm text-gray-400">
                      {crop.traysCount} Bandejas | Plantado: {new Date(crop.datePlanted).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`px-3 py-1 rounded text-sm font-bold border ${statusColors[crop.status] || 'bg-gray-500'}`}>
                      {crop.status}
                    </div>
                    <button onClick={() => advanceCropStatus(crop)} className="btn btn-secondary text-xs px-2 py-1">
                      Siguiente Fase ➔
                    </button>
                  </div>
                </div>
              );
            })}
            {activeCrops.length === 0 && <p className="text-gray-500 text-center py-8">No hay cultivos activos en el invernadero.</p>}
          </div>
        </div>
      </div>
    );
  };

  const renderCosechas = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="card">
        <h3 className="font-bold mb-4 text-xl border-b border-slate-700 pb-2">Registrar Cosecha y Envasado</h3>
        <form onSubmit={handleRegisterHarvest} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-gray-400 font-bold block mb-1">¿Qué producto has envasado hoy?</label>
            <select className="form-control" required value={newHarvest.productId} onChange={e=>setNewHarvest({...newHarvest, productId: e.target.value})}>
              <option value="">-- Seleccionar --</option>
              {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 font-bold block mb-1">¿Cuántos tuppers en total han salido?</label>
            <input type="number" className="form-control" required min="1" value={newHarvest.tuppersCount} onChange={e=>setNewHarvest({...newHarvest, tuppersCount: e.target.value})}/>
          </div>
          <button type="submit" className="btn btn-primary h-12 mt-2">
            ✅ Registrar Cosecha e Imprimir Etiquetas
          </button>
        </form>
      </div>

      <div className="card">
        <h3 className="font-bold mb-4 text-xl border-b border-slate-700 pb-2">Historial de Lotes de Sanidad</h3>
        <div className="space-y-3">
          {harvests?.slice().reverse().map(h => {
            const product = products?.find(p => p.id === h.productId);
            return (
              <div key={h.id} className="bg-slate-800 p-3 rounded border border-slate-700 flex justify-between items-center">
                <div>
                  <div className="flex gap-2 items-center mb-1">
                    <span className="font-bold text-white">{product?.name || 'Desconocido'}</span>
                    <span className="font-mono text-xs text-primary bg-primary/10 px-2 rounded">{h.batchNumber}</span>
                  </div>
                  <p className="text-xs text-gray-400">Envasado: {new Date(h.harvestDate).toLocaleDateString()} | {h.tuppersCount} tuppers</p>
                </div>
                <button className="text-sm text-primary hover:text-green-300 flex items-center gap-1" onClick={() => generateLabelPDF(product?.name || '', h.batchNumber, product?.shelfLifeDays || 10, h.tuppersCount)}>
                  🖨️ Re-Imprimir
                </button>
              </div>
            )
          })}
          {!harvests?.length && <p className="text-sm text-gray-500">Aún no hay envasados registrados.</p>}
        </div>
      </div>
    </div>
  );

  const renderPlanificador = () => (
    <div>
      <div className="bg-primary/10 border border-primary p-6 rounded-lg mb-8">
        <h2 className="text-2xl font-bold text-primary mb-2">Planificador Inverso Automático</h2>
        <p className="text-sm text-gray-300">
          Dinos qué producto final quieres envasar y qué día de la semana. El sistema calculará automáticamente 
          qué día hay que plantar cada semilla que compone el producto basándose en su receta, y pondrá las tareas 
          en el Dashboard de la TV para que los empleados sepan qué hacer cada día.
        </p>
      </div>

      <div className="card mb-8">
        <form onSubmit={handleAddHarvestTarget} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm text-gray-400 font-bold mb-1 block">Día de Cosecha / Envasado</label>
            <select className="form-control" value={newTarget.targetDayOfWeek} onChange={e=>setNewTarget({...newTarget, targetDayOfWeek: e.target.value})}>
              <option value="1">Lunes</option>
              <option value="2">Martes</option>
              <option value="3">Miércoles</option>
              <option value="4">Jueves</option>
              <option value="5">Viernes</option>
              <option value="6">Sábado</option>
              <option value="0">Domingo</option>
            </select>
          </div>
          <div className="flex-[2]">
            <label className="text-sm text-gray-400 font-bold mb-1 block">Producto a Envasar (Simple o Mix)</label>
            <select className="form-control" required value={newTarget.productId} onChange={e=>setNewTarget({...newTarget, productId: e.target.value})}>
              <option value="">-- Seleccionar --</option>
              {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm text-gray-400 font-bold mb-1 block">Tuppers Deseados</label>
            <input type="number" className="form-control" required min="1" value={newTarget.tuppersCount} onChange={e=>setNewTarget({...newTarget, tuppersCount: e.target.value})}/>
          </div>
          <button type="submit" className="btn btn-primary h-12">Crear Rutina</button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {harvestTargets?.map(ht => {
          const product = products?.find(p => p.id === ht.productId);
          const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
          return (
            <div key={ht.id} className="card relative border-l-4 border-l-green-500">
              <button onClick={() => deleteHarvestTarget(ht.id)} className="absolute top-3 right-3 text-red-400 hover:text-red-300">✕</button>
              <h4 className="font-bold text-lg">{product?.name || 'Producto Eliminado'}</h4>
              <p className="text-3xl font-black text-green-400 my-2">{ht.tuppersCount} <span className="text-sm font-normal text-gray-400">tuppers</span></p>
              <p className="text-sm font-bold bg-slate-700 inline-block px-3 py-1 rounded">Todos los {days[ht.targetDayOfWeek]}</p>
            </div>
          )
        })}
      </div>
    </div>
  );

  return (
    <div className="pb-20">
      <h1 className="text-3xl font-bold mb-6">Módulo de Control de Cultivos</h1>
      
      {/* TABS HEADER */}
      <div className="flex flex-wrap gap-2 mb-8 bg-slate-800 p-2 rounded-lg">
        {[
          { id: 'catalogo', label: 'Proveedores y Semillas', icon: '🌱' },
          { id: 'inventario', label: 'Trazabilidad y Compras', icon: '📦' },
          { id: 'lotes', label: 'Invernadero Activo', icon: '💧' },
          { id: 'cosechas', label: 'Envasado y Cosecha', icon: '✂️' },
          { id: 'planificador', label: 'Planificador Inverso', icon: '🤖' }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-4 rounded-md font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-primary text-slate-900 shadow-md' : 'text-gray-400 hover:text-white hover:bg-slate-700'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {activeTab === 'catalogo' && renderCatalogo()}
      {activeTab === 'inventario' && renderInventario()}
      {activeTab === 'lotes' && renderLotes()}
      {activeTab === 'cosechas' && renderCosechas()}
      {activeTab === 'planificador' && renderPlanificador()}
      
    </div>
  );
}
