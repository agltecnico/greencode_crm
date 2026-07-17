import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import EmployeeTasks from '../components/EmployeeTasks';
import '../crops.css';

export default function Crops() {
  const navigate = useNavigate();
  const { 
    crops, sowCrop, advanceCropStatus, discardCrop,
    stockEntries, articles,
    cropTypes,
    harvestTargets, addHarvestTarget, deleteHarvestTarget,
    harvests, addHarvest,
    products,
    orders, clients, updateOrderList
  } = useData();

  const [activeTab, setActiveTab] = useState('menu');

  // Modals state
  const [isSowModalOpen, setIsSowModalOpen] = useState(false);
  const [isHarvestModalOpen, setIsHarvestModalOpen] = useState(false);

  const [newCrop, setNewCrop] = useState({ cropTypeId: '', traysCount: 1, selectedSeedBatchId: '' });
  const [newTarget, setNewTarget] = useState({ targetDayOfWeek: 1, productId: '', tuppersCount: 10 });
  const [newHarvest, setNewHarvest] = useState({ productId: '', tuppersCount: 1 });

  // Computed properties for seed batch selection
  const selectedCropType = cropTypes?.find(c => c.id === newCrop.cropTypeId);
  const availableSeedBatches = stockEntries?.filter(e => e.articleId === selectedCropType?.seedId && Number(e.remainingQuantity) > 0).sort((a,b) => new Date(a.purchaseDate) - new Date(b.purchaseDate)) || [];
  
  if (availableSeedBatches.length > 0 && !newCrop.selectedSeedBatchId) {
    setNewCrop(prev => ({...prev, selectedSeedBatchId: availableSeedBatches[0].id}));
  }

  const handleAddCrop = async (e) => { 
    e.preventDefault(); 
    try {
      await sowCrop(newCrop);
      setNewCrop({ cropTypeId: '', traysCount: 1, selectedSeedBatchId: '' }); 
      setIsSowModalOpen(false);
      alert("Cultivo plantado con éxito. Stock de semillas y sustrato descontado.");
    } catch (error) {
      alert(error.message);
    }
  };

  const handleAddHarvestTarget = e => { e.preventDefault(); addHarvestTarget(newTarget); };
  
  const handleRegisterHarvest = e => {
    e.preventDefault();
    const batchNum = `L-${Date.now().toString().slice(-6)}`;
    addHarvest({...newHarvest, harvestDate: new Date().toISOString(), batchNumber: batchNum});
    const product = products?.find(p => p.id === newHarvest.productId);
    generateLabelPDF(product?.name || 'Desconocido', batchNum, product?.shelfLifeDays || 10, newHarvest.tuppersCount);
    setNewHarvest({...newHarvest, tuppersCount: 1});
    setIsHarvestModalOpen(false);
    alert(`Cosecha registrada con el lote Sanidad: ${batchNum}. Generando PDF...`);
  };

  const generateLabelPDF = (productName, batch, shelfLife, copies) => {
    import('../utils/labelPdf.js').then(module => {
      module.generateAndPrintLabels(productName, batch, shelfLife, copies);
    });
  };

  // Modal Styles
  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
  const modalCardStyle = { width: '100%', maxWidth: '600px', margin: '20px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fff', padding: '2rem', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' };

  const renderLotes = () => {
    const activeCropsList = crops?.filter(c => c.status !== 'HARVESTED' && c.status !== 'DISCARDED') || [];
    
    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">🪴 Invernadero Activo</h2>
            <p className="text-gray-500">Gestión de bandejas en curso.</p>
          </div>
          <button onClick={() => setIsSowModalOpen(true)} className="btn btn-primary" style={{ background: 'var(--crop-primary)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            + Nueva Siembra
          </button>
        </div>

        {isSowModalOpen && (
          <div style={modalOverlayStyle}>
            <div style={modalCardStyle}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-xl">🪴 Sembrar / Remojar</h3>
                <button onClick={() => setIsSowModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
              </div>
              <form onSubmit={handleAddCrop} className="flex flex-col gap-4">
                <div>
                  <label className="text-sm font-semibold mb-1 block">Tipo de Cultivo (Ficha)</label>
                  <select className="premium-input w-full" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} required value={newCrop.cropTypeId} onChange={e=>setNewCrop({...newCrop, cropTypeId: e.target.value, selectedSeedBatchId: ''})}>
                    <option value="">Selecciona...</option>
                    {cropTypes?.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                
                {selectedCropType && (
                  <div style={{ background: '#fffbeb', padding: '1rem', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    <label className="text-sm font-semibold mb-1 block text-amber-900">Lote Físico de Semilla a utilizar</label>
                    <select className="premium-input w-full" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #fcd34d' }} value={newCrop.selectedSeedBatchId} onChange={e=>setNewCrop({...newCrop, selectedSeedBatchId: e.target.value})}>
                      {availableSeedBatches.length === 0 && <option value="">No hay stock de esta semilla</option>}
                      {availableSeedBatches.map((b, idx) => (
                        <option key={b.id} value={b.id}>
                          {idx === 0 ? '🟢 Lote Más Antiguo (Recomendado) - ' : '⚪ '}
                          {new Date(b.purchaseDate).toLocaleDateString()} | Lote: {b.batchNumber || 'N/A'} | Quedan: {b.remainingQuantity}g
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-amber-700 mt-1">Si este lote no tiene suficientes gramos, se completará con el siguiente más antiguo.</p>
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-sm font-semibold mb-1 block">Número de Bandejas</label>
                    <input type="number" required min="1" className="premium-input w-full" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} value={newCrop.traysCount} onChange={e=>setNewCrop({...newCrop, traysCount: Number(e.target.value)})}/>
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-4">
                  <button type="button" onClick={() => setIsSowModalOpen(false)} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white' }}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: 'var(--crop-primary)', color: 'white', border: 'none', fontWeight: 'bold' }} disabled={selectedCropType && availableSeedBatches.length === 0}>
                    {selectedCropType && availableSeedBatches.length === 0 ? 'Sin Stock de Semilla' : 'Plantar Cultivo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
          {activeCropsList.map(crop => {
            const cType = cropTypes?.find(c => c.id === crop.cropTypeId);
            const daysAlive = Math.floor((new Date() - new Date(crop.plantedAt || crop.datePlanted)) / (1000 * 60 * 60 * 24));
            
            return (
              <div key={crop.id} className={`status-card \${crop.status}`}>
                <div className="status-header">
                  <div>
                    <h4 className="status-title">{cType?.name || 'Desconocido'}</h4>
                    <span className="status-batch">{crop.traysCount} Bandejas</span>
                  </div>
                  <button onClick={() => discardCrop(crop)} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>Descartar</button>
                </div>
                
                <div className="status-footer">
                  <div>
                    <p style={{ margin: '0 0 2px 0', fontSize: '0.65rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase' }}>Estado Actual</p>
                    <p className="status-current">{crop.status}</p>
                    <p className="status-days">Día {daysAlive >= 0 ? daysAlive : 0}</p>
                  </div>
                  <button onClick={() => advanceCropStatus(crop)} style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }}>
                    Avanzar ⏭
                  </button>
                </div>
              </div>
            );
          })}
          {activeCropsList.length === 0 && (
            <div className="col-span-full text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500">No hay cultivos activos. ¡Siembra tu primera bandeja!</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderCosechas = () => (
    <div style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">🔪 Envasado y Sanidad</h2>
          <p className="text-gray-500">Registra lo cosechado y genera etiquetas.</p>
        </div>
        <button onClick={() => setIsHarvestModalOpen(true)} className="btn btn-primary" style={{ background: '#0f172a', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
          + Registrar Cosecha
        </button>
      </div>

      {isHarvestModalOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-xl">🔪 Registrar Cosecha y Envasado</h3>
              <button onClick={() => setIsHarvestModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>
            <form onSubmit={handleRegisterHarvest} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-semibold mb-1 block">¿Qué producto has envasado hoy?</label>
                <select className="premium-input w-full" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} required value={newHarvest.productId} onChange={e=>setNewHarvest({...newHarvest, productId: e.target.value})}>
                  <option value="">-- Seleccionar --</option>
                  {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block">¿Cuántos tuppers en total han salido?</label>
                <input type="number" className="premium-input w-full" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} required min="1" value={newHarvest.tuppersCount} onChange={e=>setNewHarvest({...newHarvest, tuppersCount: e.target.value})}/>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setIsHarvestModalOpen(false)} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white' }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ background: '#0f172a', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold' }}>
                  🖨️ Registrar e Imprimir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="premium-card mt-6">
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
          {(!harvests || harvests.length === 0) && (
            <p className="text-center text-gray-500 py-4">No hay cosechas registradas.</p>
          )}
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
            <h2 style={{ fontSize: '1.5rem' }}>Siembra</h2>
            <p style={{ fontSize: '1rem' }}>Bandejas en curso</p>
          </div>
        </button>

        <button onClick={() => setActiveTab('cosechas')} className="hub-card admin-card" style={{ border: 'none', width: '100%' }}>
          <div className="hub-card-icon" style={{ fontSize: '3.5rem' }}>🔪</div>
          <div className="hub-card-text">
            <h2 style={{ fontSize: '1.5rem' }}>Cosecha</h2>
            <p style={{ fontSize: '1rem' }}>Envasado y etiquetas</p>
          </div>
        </button>

        <button onClick={() => setActiveTab('planificador')} className="hub-card driver-card" style={{ border: 'none', width: '100%' }}>
          <div className="hub-card-icon" style={{ fontSize: '3.5rem' }}>📅</div>
          <div className="hub-card-text">
            <h2 style={{ fontSize: '1.5rem' }}>Planificador</h2>
            <p style={{ fontSize: '1rem' }}>Rutinas automáticas</p>
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
          <span>🔙</span> Volver al Menú Cultivo
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
