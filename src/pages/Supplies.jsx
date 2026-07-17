import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import '../crops.css';

export default function Supplies() {
  const navigate = useNavigate();
  const { 
    providers, addProvider, deleteProvider,
    seeds, addSeed, deleteSeed,
    seedInventory, addSeedInventory, deleteSeedInventory,
    crops, addCrop, advanceCropStatus, discardCrop,
    harvestTargets, addHarvestTarget, deleteHarvestTarget,
    harvests, addHarvest,
    products
  } = useData();

  const [activeTab, setActiveTab] = useState('catalogo');

  const [newProvider, setNewProvider] = useState({ name: '', contactInfo: '' });
  const [newSeed, setNewSeed] = useState({ name: '', providerId: '', soakingHours: 0, germinationDays: 3, darknessDays: 2, lightDays: 5, expectedYieldGrams: 0 });
  const [newInventory, setNewInventory] = useState({ seedId: '', providerBatch: '', weightGrams: 1000, purchaseDate: new Date().toISOString().split('T')[0] });
      
  const handleAddProvider = e => { e.preventDefault(); addProvider(newProvider); setNewProvider({name:'', contactInfo:''}); };
  const handleAddSeed = e => { e.preventDefault(); addSeed(newSeed); setNewSeed({...newSeed, name:''}); };
  const handleAddInventory = e => { e.preventDefault(); addSeedInventory(newInventory); setNewInventory({...newInventory, providerBatch:''}); };
      
  
  
  const renderCatalogo = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="premium-card">
        <h3 className="premium-card-title">🏭 Proveedores de Semilla</h3>
        <form onSubmit={handleAddProvider} className="flex flex-col gap-4">
          <input type="text" placeholder="Nombre Proveedor" required className="premium-input" value={newProvider.name} onChange={e=>setNewProvider({...newProvider, name: e.target.value})}/>
          <input type="text" placeholder="Contacto / Web" className="premium-input" value={newProvider.contactInfo} onChange={e=>setNewProvider({...newProvider, contactInfo: e.target.value})}/>
          <button type="submit" className="climate-btn mt-4">Añadir Proveedor</button>
        </form>
        <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {providers?.map(p => (
            <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontWeight: 'bold' }}>{p.name}</span>
              <button onClick={()=>deleteProvider(p.id)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>✖</button>
            </div>
          ))}
        </div>
      </div>

      <div className="premium-card">
        <h3 className="premium-card-title">🌱 Catálogo de Semillas</h3>
        <form onSubmit={handleAddSeed} className="grid-form">
          <div className="col-span-2">
            <select className="premium-input" required value={newSeed.providerId} onChange={e=>setNewSeed({...newSeed, providerId: e.target.value})}>
              <option value="">-- Proveedor --</option>
              {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <input type="text" placeholder="Nombre Semilla (Ej: Rábano Sango)" required className="premium-input" value={newSeed.name} onChange={e=>setNewSeed({...newSeed, name: e.target.value})}/>
          </div>
          <div><label className="premium-label">Horas Remojo</label><input type="number" required min="0" className="premium-input" value={newSeed.soakingHours} onChange={e=>setNewSeed({...newSeed, soakingHours: e.target.value})}/></div>
          <div><label className="premium-label">Días Germinación</label><input type="number" required min="0" className="premium-input" value={newSeed.germinationDays} onChange={e=>setNewSeed({...newSeed, germinationDays: e.target.value})}/></div>
          <div><label className="premium-label">Días Oscuridad</label><input type="number" required min="0" className="premium-input" value={newSeed.darknessDays} onChange={e=>setNewSeed({...newSeed, darknessDays: e.target.value})}/></div>
          <div><label className="premium-label">Días Luz</label><input type="number" required min="0" className="premium-input" value={newSeed.lightDays} onChange={e=>setNewSeed({...newSeed, lightDays: e.target.value})}/></div>
          <div className="col-span-2"><button type="submit" className="climate-btn mt-4">Añadir Semilla al Catálogo</button></div>
        </form>
      </div>
    </div>
  );

  const renderInventario = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="premium-card" style={{ height: 'fit-content' }}>
        <h3 className="premium-card-title">📦 Registrar Compra (Saco)</h3>
        <form onSubmit={handleAddInventory} className="flex flex-col gap-4">
          <select className="premium-input" required value={newInventory.seedId} onChange={e=>setNewInventory({...newInventory, seedId: e.target.value})}>
            <option value="">-- Qué Semilla es --</option>
            {seeds?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input type="text" placeholder="Lote del Proveedor" required className="premium-input" value={newInventory.providerBatch} onChange={e=>setNewInventory({...newInventory, providerBatch: e.target.value})}/>
          <div className="grid-form">
            <div>
              <label className="premium-label">Peso (g)</label>
              <input type="number" required min="1" className="premium-input" value={newInventory.weightGrams} onChange={e=>setNewInventory({...newInventory, weightGrams: e.target.value})}/>
            </div>
            <div>
              <label className="premium-label">Fecha</label>
              <input type="date" required className="premium-input" value={newInventory.purchaseDate} onChange={e=>setNewInventory({...newInventory, purchaseDate: e.target.value})}/>
            </div>
          </div>
          <button type="submit" className="climate-btn">Guardar Saco en Inventario</button>
        </form>
      </div>
      
      <div className="premium-card col-span-2">
        <h3 className="premium-card-title">📋 Stock Disponible</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {seedInventory?.map(inv => {
            const seed = seeds?.find(s => s.id === inv.seedId);
            return (
              <div key={inv.id} style={{ padding: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', position: 'relative' }}>
                <button onClick={() => deleteSeedInventory(inv.id)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}>✖</button>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, fontWeight: 800 }}>{seed?.name || 'Semilla Eliminada'}</h4>
                  <span style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>{inv.providerBatch}</span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Comprado</p>
                    <p style={{ margin: 0, fontWeight: 'bold' }}>{inv.weightGrams}g</p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Restante</p>
                    <p style={{ margin: 0, fontWeight: 900, color: 'var(--crop-primary)', fontSize: '1.25rem' }}>{inv.remainingGrams || inv.weightGrams}g</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );

  const renderCosechas = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="premium-card" style={{ height: 'fit-content' }}>
        <h3 className="premium-card-title">🔪 Registrar Cosecha y Envasado</h3>
        <form onSubmit={handleRegisterHarvest} className="flex flex-col gap-4">
          <div>
            <label className="premium-label">¿Qué producto has envasado hoy?</label>
            <select className="premium-input" required value={newHarvest.productId} onChange={e=>setNewHarvest({...newHarvest, productId: e.target.value})}>
              <option value="">-- Seleccionar --</option>
              {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="premium-label">¿Cuántos tuppers en total han salido?</label>
            <input type="number" className="premium-input" required min="1" value={newHarvest.tuppersCount} onChange={e=>setNewHarvest({...newHarvest, tuppersCount: e.target.value})}/>
          </div>
          <button type="submit" className="climate-btn" style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
            🖨️ Registrar Cosecha e Imprimir Etiquetas
          </button>
        </form>
      </div>

      <div className="premium-card">
        <h3 className="premium-card-title">🏷️ Historial de Lotes de Sanidad</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {harvests?.slice().reverse().map(h => {
            const product = products?.find(p => p.id === h.productId);
            return (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1e293b' }}>{product?.name || 'Desconocido'}</span>
                    <span style={{ fontSize: '0.75rem', background: '#d1fae5', color: '#059669', padding: '2px 8px', borderRadius: '999px', fontFamily: 'monospace', fontWeight: 'bold' }}>{h.batchNumber}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Envasado: {new Date(h.harvestDate).toLocaleDateString()} • <strong style={{ color: '#334155' }}>{h.tuppersCount} tuppers</strong></p>
                </div>
                <button 
                  style={{ background: 'white', border: '1px solid #e2e8f0', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#334155' }}
                  onClick={() => generateLabelPDF(product?.name || '', h.batchNumber, product?.shelfLifeDays || 10, h.tuppersCount)}>
                  🖨️ Re-Imprimir
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );

  const renderPlanificador = () => (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #ccfbf1)', border: '1px solid #99f6e4', padding: '2rem', borderRadius: '20px', marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', fontWeight: 900, color: '#065f46' }}>Planificador Inverso Automático</h2>
        <p style={{ margin: 0, color: '#047857', fontSize: '1.1rem', fontWeight: 500, lineHeight: 1.5 }}>
          Dinos qué producto final quieres envasar y qué día de la semana. El sistema calculará automáticamente 
          qué día hay que plantar cada semilla basándose en su receta, y colocará las tareas correspondientes 
          en el Dashboard para que no tengas que pensar en fechas.
        </p>
      </div>

      <div className="premium-card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={handleAddHarvestTarget} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label className="premium-label">Día de Cosecha Objetivo</label>
            <select className="premium-input" value={newTarget.targetDayOfWeek} onChange={e=>setNewTarget({...newTarget, targetDayOfWeek: e.target.value})}>
              <option value="1">Lunes</option>
              <option value="2">Martes</option>
              <option value="3">Miércoles</option>
              <option value="4">Jueves</option>
              <option value="5">Viernes</option>
              <option value="6">Sábado</option>
              <option value="0">Domingo</option>
            </select>
          </div>
          <div style={{ flex: '2', minWidth: '250px' }}>
            <label className="premium-label">Producto a Envasar</label>
            <select className="premium-input" required value={newTarget.productId} onChange={e=>setNewTarget({...newTarget, productId: e.target.value})}>
              <option value="">-- Seleccionar --</option>
              {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ flex: '1', minWidth: '150px' }}>
            <label className="premium-label">Tuppers Deseados</label>
            <input type="number" className="premium-input" required min="1" value={newTarget.tuppersCount} onChange={e=>setNewTarget({...newTarget, tuppersCount: e.target.value})}/>
          </div>
          <button type="submit" className="climate-btn" style={{ margin: 0, width: 'auto', minWidth: '150px' }}>Crear Rutina</button>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {harvestTargets?.map(ht => {
          const product = products?.find(p => p.id === ht.productId);
          const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
          return (
            <div key={ht.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--crop-primary)' }}></div>
              <button onClick={() => deleteHarvestTarget(ht.id)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}>✖</button>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', paddingRight: '1rem' }}>{product?.name || 'Producto Eliminado'}</h4>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--crop-primary)', lineHeight: 1 }}>{ht.tuppersCount}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b' }}>tuppers</span>
              </div>
              <div style={{ display: 'inline-block', padding: '4px 12px', background: '#ecfdf5', color: '#059669', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                Todos los {days[ht.targetDayOfWeek]}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );

  return (
    <div className="admin-page-container" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
            onClick={() => setActiveTab('catalogo')}
            style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: activeTab === 'catalogo' ? '#10b981' : '#e2e8f0', color: activeTab === 'catalogo' ? 'white' : '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>
            🧬 Catálogo de Variedades
        </button>
        <button 
            onClick={() => setActiveTab('inventario')}
            style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: activeTab === 'inventario' ? '#10b981' : '#e2e8f0', color: activeTab === 'inventario' ? 'white' : '#64748b', fontWeight: 'bold', cursor: 'pointer' }}>
            📦 Registro de Compras y Stock
        </button>
      </div>

      <div className="crops-module" style={{ animation: 'fadeIn 0.3s ease' }}>
        {activeTab === 'catalogo' && renderCatalogo()}
        {activeTab === 'inventario' && renderInventario()}
      </div>
    </div>
  );
}
