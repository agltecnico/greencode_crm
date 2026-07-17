import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import EmployeeTasks from '../components/EmployeeTasks';
import '../crops.css';

export default function Crops() {
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

  const [activeTab, setActiveTab] = useState('menu');

        const [newCrop, setNewCrop] = useState({ seedId: '', traysCount: 1, seedGramsPerTray: 0, inventoryId: '' });
  const [newTarget, setNewTarget] = useState({ targetDayOfWeek: 1, productId: '', tuppersCount: 10 });
  const [newHarvest, setNewHarvest] = useState({ productId: '', tuppersCount: 1 });

        const handleAddCrop = e => { 
    e.preventDefault(); 
    const batchNum = `S-${Date.now().toString().slice(-6)}`;
    addCrop({...newCrop, datePlanted: new Date().toISOString(), batchNumber: batchNum, status: 'SOAKING'}); 
    setNewCrop({...newCrop, traysCount: 1, seedGramsPerTray: 0}); 
  };
  const handleAddHarvestTarget = e => { e.preventDefault(); addHarvestTarget(newTarget); };
  
  const handleRegisterHarvest = e => {
    e.preventDefault();
    const batchNum = `L-${Date.now().toString().slice(-6)}`;
    addHarvest({...newHarvest, harvestDate: new Date().toISOString(), batchNumber: batchNum});
    const product = products?.find(p => p.id === newHarvest.productId);
    generateLabelPDF(product?.name || 'Desconocido', batchNum, product?.shelfLifeDays || 10, newHarvest.tuppersCount);
    setNewHarvest({...newHarvest, tuppersCount: 1});
    alert(`Cosecha registrada con el lote Sanidad: ${batchNum}. Generando PDF...`);
  };

  const generateLabelPDF = (productName, batch, shelfLife, copies) => {
    import('../utils/labelPdf.js').then(module => {
      module.generateAndPrintLabels(productName, batch, shelfLife, copies);
    });
  };

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

        <button onClick={() => setActiveTab('pedidos')} className="hub-card driver-card" style={{ border: 'none', width: '100%' }}>
          <div className="hub-card-icon" style={{ fontSize: '3.5rem' }}>📦</div>
          <div className="hub-card-text">
            <h2 style={{ fontSize: '1.5rem' }}>Pedidos y Reparto</h2>
            <p style={{ fontSize: '1rem' }}>Preparar y Enviar</p>
          </div>
        </button>
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

  const renderLotes = () => {
    const activeCropsList = crops?.filter(c => c.status !== 'HARVESTED' && c.status !== 'DISCARDED') || [];
    
    return (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="premium-card" style={{ height: 'fit-content' }}>
          <h3 className="premium-card-title">🪴 Sembrar / Remojar</h3>
          <form onSubmit={handleAddCrop} className="flex flex-col gap-4">
            <div>
              <label className="premium-label">¿De qué saco vas a coger?</label>
              <select className="premium-input" required value={newCrop.inventoryId} onChange={e=>{
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
            <div className="grid-form">
              <div>
                <label className="premium-label">Nº Bandejas</label>
                <input type="number" required min="1" className="premium-input" value={newCrop.traysCount} onChange={e=>setNewCrop({...newCrop, traysCount: e.target.value})}/>
              </div>
              <div>
                <label className="premium-label">g x Bandeja</label>
                <input type="number" required min="1" className="premium-input" value={newCrop.seedGramsPerTray} onChange={e=>setNewCrop({...newCrop, seedGramsPerTray: e.target.value})}/>
              </div>
            </div>
            <button type="submit" className="climate-btn">Comenzar Ciclo</button>
          </form>
        </div>

        <div className="premium-card lg:col-span-3">
          <h3 className="premium-card-title">🌱 Bandejas en Curso</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeCropsList.map(crop => {
              const seed = seeds?.find(s => s.id === crop.seedId);
              const daysAlive = Math.floor((new Date() - new Date(crop.datePlanted)) / (1000 * 60 * 60 * 24));
              
              return (
                <div key={crop.id} className={`status-card \${crop.status}`}>
                  <div className="status-header">
                    <div>
                      <h4 className="status-title">{seed?.name}</h4>
                      <span className="status-batch">LOTE: {crop.batchNumber}</span>
                    </div>
                    <button onClick={() => discardCrop(crop)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Descartar</button>
                  </div>
                  
                  <div className="status-footer">
                    <div>
                      <p style={{ margin: '0 0 2px 0', fontSize: '0.65rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Estado Actual</p>
                      <p className="status-current">{crop.status}</p>
                      <p className="status-days">Día {daysAlive}</p>
                    </div>
                    <button onClick={() => advanceCropStatus(crop)} style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      Avanzar ⏭
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

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


  const renderCropsHub = () => (
    <div className="hub-container" style={{ padding: '1rem', animation: 'fadeIn 0.3s ease' }}>
      <div className="hub-header" style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#1e293b' }}>🌱 Central del Invernadero</h1>
        <p style={{ color: '#64748b', fontSize: '1.2rem' }}>Selecciona tu zona de trabajo</p>
      </div>
      
      <div className="hub-grid">
        <button onClick={() => setActiveTab('tareas')} className="hub-card crops-card" style={{ border: 'none', width: '100%' }}>
          <div className="hub-card-icon" style={{ fontSize: '3.5rem' }}>🎯</div>
          <div className="hub-card-text">
            <h2 style={{ fontSize: '1.5rem' }}>Tareas</h2>
            <p style={{ fontSize: '1rem' }}>Día / Semana / Mes</p>
          </div>
        </button>

        <button onClick={() => setActiveTab('lotes')} className="hub-card tv-card" style={{ border: 'none', width: '100%' }}>
          <div className="hub-card-icon" style={{ fontSize: '3.5rem' }}>🪴</div>
          <div className="hub-card-text">
            <h2 style={{ fontSize: '1.5rem' }}>Invernadero Activo</h2>
            <p style={{ fontSize: '1rem' }}>Bandejas y Riegos</p>
          </div>
        </button>

        <button onClick={() => setActiveTab('cosechas')} className="hub-card admin-card" style={{ border: 'none', width: '100%' }}>
          <div className="hub-card-icon" style={{ fontSize: '3.5rem' }}>🔪</div>
          <div className="hub-card-text">
            <h2 style={{ fontSize: '1.5rem' }}>Envasado y Sanidad</h2>
            <p style={{ fontSize: '1rem' }}>Mermas y Etiquetas</p>
          </div>
        </button>

        <button onClick={() => setActiveTab('planificador')} className="hub-card driver-card" style={{ border: 'none', width: '100%' }}>
          <div className="hub-card-icon" style={{ fontSize: '3.5rem' }}>📅</div>
          <div className="hub-card-text">
            <h2 style={{ fontSize: '1.5rem' }}>Planificador Inverso</h2>
            <p style={{ fontSize: '1rem' }}>Próximas Siembras</p>
          </div>
        </button>
      </div>
    </div>
  );


  const renderPedidos = () => {
    const handleStatusChange = (orderId, newStatus) => {
      updateOrderList(orderId, { status: newStatus });
    };

    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div className="tasks-header" style={{ marginBottom: '3rem', textAlign: 'center' }}>
          <h2>Gestión de Pedidos y Reparto</h2>
          <p style={{ color: '#64748b', fontSize: '1.25rem' }}>Mueve los pedidos por el circuito logístico.</p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
          {/* Columna Pendientes */}
          <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ color: '#d97706', fontSize: '1.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>🟡 PENDIENTES</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {orders?.filter(o => o.status === 'PENDING').map(o => {
                const client = clients?.find(c => c.id === o.clientId);
                return (
                  <div key={o.id} className="crops-card" style={{ padding: '1rem', borderLeft: '6px solid #fbbf24' }}>
                    <h4 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>{client?.name || 'Desconocido'}</h4>
                    <p style={{ margin: '0 0 1rem 0', color: '#64748b' }}>{o.items?.length || 0} tuppers a preparar</p>
                    <button 
                      onClick={() => handleStatusChange(o.id, 'PREPARED')}
                      className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', background: '#38bdf8', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                      MARCAR PREPARADO ✅
                    </button>
                  </div>
                );
              })}
              {(!orders || orders.filter(o => o.status === 'PENDING').length === 0) && <p style={{ textAlign: 'center', color: '#94a3b8' }}>Todo envasado</p>}
            </div>
          </div>

          {/* Columna Preparados */}
          <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ color: '#0284c7', fontSize: '1.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>🔵 PREPARADOS</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {orders?.filter(o => o.status === 'PREPARED').map(o => {
                const client = clients?.find(c => c.id === o.clientId);
                return (
                  <div key={o.id} className="crops-card" style={{ padding: '1rem', borderLeft: '6px solid #38bdf8' }}>
                    <h4 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>{client?.name || 'Desconocido'}</h4>
                    <p style={{ margin: '0 0 1rem 0', color: '#64748b' }}>Caja lista en expedición</p>
                    <button 
                      onClick={() => handleStatusChange(o.id, 'IN_TRANSIT')}
                      className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', background: '#a855f7', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                      METER A FURGONETA 🚚
                    </button>
                  </div>
                );
              })}
              {(!orders || orders.filter(o => o.status === 'PREPARED').length === 0) && <p style={{ textAlign: 'center', color: '#94a3b8' }}>Nada esperando carga</p>}
            </div>
          </div>

          {/* Columna En Reparto */}
          <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ color: '#7e22ce', fontSize: '1.5rem', textAlign: 'center', marginBottom: '1.5rem' }}>🟣 EN REPARTO</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {orders?.filter(o => o.status === 'IN_TRANSIT').map(o => {
                const client = clients?.find(c => c.id === o.clientId);
                return (
                  <div key={o.id} className="crops-card" style={{ padding: '1rem', borderLeft: '6px solid #a855f7' }}>
                    <h4 style={{ fontSize: '1.2rem', margin: '0 0 0.5rem 0' }}>{client?.name || 'Desconocido'}</h4>
                    <p style={{ margin: '0 0 1rem 0', color: '#64748b' }}>El conductor lo lleva</p>
                    <button 
                      onClick={() => window.location.href='/repartidor'}
                      className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', background: '#10b981', border: 'none', borderRadius: '8px', fontWeight: 'bold' }}>
                      FIRMAR ENTREGA 📱
                    </button>
                  </div>
                );
              })}
              {(!orders || orders.filter(o => o.status === 'IN_TRANSIT').length === 0) && <p style={{ textAlign: 'center', color: '#94a3b8' }}>Ningún conductor en ruta</p>}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="crops-module" style={{ paddingBottom: '5rem', maxWidth: '1400px', margin: '0 auto', paddingTop: '1rem' }}>
      {activeTab === 'menu' && (
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: '1px solid var(--crop-border)', color: 'var(--crop-text-main)', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🏠</span> Volver al Hub Central
        </button>
      )}
      
      {activeTab !== 'menu' && (
        <button onClick={() => setActiveTab('menu')} style={{ background: 'transparent', border: '1px solid var(--crop-border)', color: 'var(--crop-text-main)', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>🔙</span> Volver al Menú Invernadero
        </button>
      )}

      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        {activeTab === 'menu' && renderCropsHub()}
        
        {activeTab === 'tareas' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '-4rem', position: 'relative', zIndex: 50 }}>
              <button 
                onClick={() => window.open('/tv', '_blank')} 
                style={{ background: '#0ea5e9', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)' }}>
                🖥️ Lanzar en Modo TV
              </button>
            </div>
            <EmployeeTasks />
          </div>
        )}
        {activeTab === 'lotes' && renderLotes()}
        {activeTab === 'cosechas' && renderCosechas()}
        {activeTab === 'planificador' && renderPlanificador()}
        {activeTab === 'pedidos' && renderPedidos()}
      </div>
      
    </div>
  );
}
