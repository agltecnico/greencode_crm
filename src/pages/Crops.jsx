import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import EmployeeTasks from '../components/EmployeeTasks';
import '../crops.css';

export default function Crops() {
  const navigate = useNavigate();
  const { 
    crops, sowCrop, updateCrop, advanceCropStatus, discardCrop,
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
  const [newHarvest, setNewHarvest] = useState({ productId: '', tuppersCount: 1, selectedCropIds: [] });

  // Computed properties for seed availability
  const selectedCropType = cropTypes?.find(c => c.id === newCrop.cropTypeId);
  const totalAvailableSeed = stockEntries?.filter(e => e.articleId === selectedCropType?.seedId).reduce((acc, curr) => acc + Number(curr.quantity || 0), 0) || 0;

  const handleAddCrop = async (e) => { 
    e.preventDefault(); 
    try {
      if (selectedCropType) {
        const requiredGrams = (selectedCropType.seedGrams || 0) * newCrop.traysCount;
        const remainingSeed = totalAvailableSeed - requiredGrams;
        
        if (remainingSeed < 0) {
          alert(`⛔ Stock insuficiente: Necesitas ${requiredGrams}g pero solo tienes ${totalAvailableSeed}g en el inventario. Registra una entrada de almacén primero.`);
          return;
        }

        const seedArticle = articles?.find(a => a.id === selectedCropType.seedId);
        if (seedArticle && seedArticle.minStock > 0 && remainingSeed <= seedArticle.minStock) {
          alert(`¡Atención! Con esta siembra el stock de la semilla "${seedArticle.name}" bajará o ya está por debajo del límite de seguridad (${seedArticle.minStock}g). Recuerda pedir más a tu proveedor.`);
        }
      }
      await sowCrop(newCrop);
      setNewCrop({ cropTypeId: '', traysCount: 1, selectedSeedBatchId: '' }); 
      setIsSowModalOpen(false);
      alert("Cultivo plantado con éxito. Stock de semillas y sustrato descontado.");
    } catch (error) {
      alert(error.message);
    }
  };

  const handleAddHarvestTarget = e => { e.preventDefault(); addHarvestTarget(newTarget); };
  
  const handleRegisterHarvest = async (e) => {
    e.preventDefault();
    if (newHarvest.selectedCropIds.length === 0) {
      alert("Debes seleccionar al menos una bandeja para cosechar.");
      return;
    }

    const batchNum = `L-${Date.now().toString().slice(-6)}`;
    
    // 1. Mark selected crops as HARVESTED
    for (const cropId of newHarvest.selectedCropIds) {
      const cropToHarvest = crops.find(c => c.id === cropId);
      if (cropToHarvest) {
        await updateCrop(cropId, { status: 'HARVESTED' });
      }
    }

    // 2. Register the harvest product
    addHarvest({...newHarvest, harvestDate: new Date().toISOString(), batchNumber: batchNum});
    const product = products?.find(p => p.id === newHarvest.productId);
    generateLabelPDF(product?.name || 'Desconocido', batchNum, product?.shelfLifeDays || 10, newHarvest.tuppersCount);
    
    setNewHarvest({ productId: '', tuppersCount: 1, selectedCropIds: [] });
    setIsHarvestModalOpen(false);
    alert(`Cosecha registrada con el lote Sanidad: ${batchNum}. Generando PDF...`);
  };

  const handleProductSelect = (productId) => {
    setNewHarvest(prev => ({ ...prev, productId }));
    const product = products?.find(p => p.id === productId);
    if (!product) return;
    
    if (product.recipeSeeds && product.recipeSeeds.length > 0) {
      const allowedSeedIds = product.recipeSeeds.map(rs => rs.seedId);
      const autoSelectedIds = [];
      
      allowedSeedIds.forEach(seedId => {
        // Find all growing crops matching this seedId or cropTypeId (since cropType matches seedId 1-to-1 usually)
        // Wait, crop.seedId might be null if it's relying on cropTypeId. We need to check both.
        const matchingCrops = crops.filter(c => c.status === 'GROWING' && (c.seedId === seedId || c.cropTypeId === seedId || cropTypes?.find(ct => ct.id === c.cropTypeId)?.seedId === seedId));
        
        matchingCrops.sort((a, b) => new Date(a.datePlanted || a.plantedAt) - new Date(b.datePlanted || b.plantedAt));
        if (matchingCrops.length > 0) {
          autoSelectedIds.push(matchingCrops[0].id);
        }
      });

      setNewHarvest(prev => ({ ...prev, selectedCropIds: autoSelectedIds }));
    }
  };

  const generateLabelPDF = (productName, batch, shelfLife, copies) => {
    import('../utils/labelPdf.js').then(module => {
      module.generateAndPrintLabels(productName, batch, shelfLife, copies);
    });
  };

  // Modal Styles
  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
  const modalCardStyle = { width: '100%', maxWidth: '600px', margin: '20px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fff', padding: '2rem', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' };

  const translateStatus = (status) => {
    const statusMap = {
      'SOAKING': 'En Remojo',
      'SOWED': 'Sembrado',
      'GERMINATING': 'Germinando',
      'GROWING': 'Creciendo',
      'HARVESTED': 'Cosechado',
      'DISCARDED': 'Descartado'
    };
    const normalized = (status || '').toUpperCase();
    return statusMap[normalized] || status;
  };

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
                    <label className="text-sm font-semibold mb-1 block text-amber-900">Stock de Semilla Disponible</label>
                    <p className="text-lg font-bold text-amber-800 m-0">{totalAvailableSeed.toFixed(2)} g disponibles</p>
                    <p className="text-xs text-amber-700 mt-1">El sistema descontará {selectedCropType.seedGrams}g por cada bandeja automáticamente usando el método FIFO (primeras entradas, primeras salidas).</p>
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
                  <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', background: 'var(--crop-primary)', color: 'white', border: 'none', fontWeight: 'bold' }} disabled={selectedCropType && totalAvailableSeed <= 0}>
                    {selectedCropType && totalAvailableSeed <= 0 ? 'Sin Stock de Semilla' : 'Plantar Cultivo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6">
          {activeCropsList.map(crop => {
            const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
            const daysAlive = Math.floor((new Date() - new Date(crop.datePlanted || crop.plantedAt)) / (1000 * 60 * 60 * 24));
            
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
                    <p className="status-current">{translateStatus(crop.status)}</p>
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

        <div className="mt-12">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">📖 Histórico de Siembras</h2>
              <p className="text-slate-500">Consulta los cultivos que ya han finalizado su ciclo.</p>
            </div>
          </div>

          <div className="premium-card">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)', color: '#64748b', textAlign: 'left' }}>
                    <th style={{ padding: '1rem', fontWeight: '600' }}>Lote / Siembra</th>
                    <th style={{ padding: '1rem', fontWeight: '600' }}>Ficha de Cultivo</th>
                    <th style={{ padding: '1rem', fontWeight: '600' }}>Fecha Siembra</th>
                    <th style={{ padding: '1rem', fontWeight: '600' }}>Bandejas</th>
                    <th style={{ padding: '1rem', fontWeight: '600' }}>Estado Final</th>
                  </tr>
                </thead>
                <tbody>
                  {(crops?.filter(c => c.status === 'HARVESTED' || c.status === 'DISCARDED') || []).map(crop => {
                    const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
                    const plantedDate = new Date(crop.datePlanted || crop.plantedAt).toLocaleDateString();
                    
                    return (
                      <tr key={crop.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ padding: '1rem', fontWeight: '500' }}>{crop.batchNumber || 'N/A'}</td>
                        <td style={{ padding: '1rem' }}>{cType?.name || 'Desconocido'}</td>
                        <td style={{ padding: '1rem' }}>{plantedDate}</td>
                        <td style={{ padding: '1rem' }}>{crop.traysCount}</td>
                        <td style={{ padding: '1rem' }}>
                          <span style={{ 
                            padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold',
                            backgroundColor: crop.status === 'HARVESTED' ? '#dcfce7' : '#fee2e2',
                            color: crop.status === 'HARVESTED' ? '#166534' : '#991b1b'
                          }}>
                            {translateStatus(crop.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {(crops?.filter(c => c.status === 'HARVESTED' || c.status === 'DISCARDED') || []).length === 0 && (
                <p style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>No hay registros en el historial.</p>
              )}
            </div>
          </div>
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
                  <label className="text-sm font-semibold mb-1 block">1. ¿Qué producto final vas a envasar?</label>
                  <select className="premium-input w-full" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} required value={newHarvest.productId} onChange={e=>handleProductSelect(e.target.value)}>
                    <option value="">-- Seleccionar --</option>
                    {products?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block flex justify-between">
                    <span>2. Selecciona las bandejas que vas a cortar:</span>
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-slate-300 rounded-lg p-2 bg-slate-50 flex flex-col gap-2">
                    {(crops?.filter(c => c.status === 'GROWING') || []).map(crop => {
                      const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
                      const isChecked = newHarvest.selectedCropIds.includes(crop.id);
                      
                      const harvestProduct = products?.find(p => p.id === newHarvest.productId);
                      const hasRecipe = harvestProduct?.recipeSeeds && harvestProduct.recipeSeeds.length > 0;
                      const allowedSeedIds = hasRecipe ? harvestProduct.recipeSeeds.map(rs => rs.seedId) : [];
                      
                      const actualSeedId = crop.seedId || cropTypes?.find(ct => ct.id === crop.cropTypeId)?.seedId;
                      const isAllowed = !hasRecipe || allowedSeedIds.includes(actualSeedId);

                      return (
                        <label key={crop.id} className={`flex items-center gap-3 p-2 bg-white rounded border cursor-pointer transition-colors ${!isAllowed ? 'opacity-40 border-red-100 bg-red-50 cursor-not-allowed' : isChecked ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 text-green-600 rounded focus:ring-green-500 disabled:opacity-50"
                            checked={isChecked}
                            disabled={!isAllowed}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewHarvest(prev => ({ ...prev, selectedCropIds: [...prev.selectedCropIds, crop.id] }));
                              } else {
                                setNewHarvest(prev => ({ ...prev, selectedCropIds: prev.selectedCropIds.filter(id => id !== crop.id) }));
                              }
                            }}
                          />
                          <div className="flex-1 flex justify-between">
                            <span className="font-semibold text-slate-700">{cType?.name || 'Desconocido'} <span className="font-normal text-slate-500 text-sm">({crop.traysCount} bandejas)</span></span>
                            {!isAllowed && hasRecipe ? (
                              <span className="text-xs text-red-500 font-bold px-2 py-1">No permitido en la receta</span>
                            ) : (
                              <span className="text-xs bg-slate-200 text-slate-600 px-2 py-1 rounded font-mono">{crop.batchNumber}</span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                    {(crops?.filter(c => c.status === 'GROWING') || []).length === 0 && (
                      <p className="text-slate-500 text-sm text-center py-2">No hay cultivos listos para cosechar.</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-1 block">3. ¿Cuántos tuppers en total han salido?</label>
                  <input type="number" className="premium-input w-full" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} required min="1" value={newHarvest.tuppersCount} onChange={e=>setNewHarvest({...newHarvest, tuppersCount: e.target.value})}/>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button type="button" onClick={() => setIsHarvestModalOpen(false)} className="btn btn-secondary" style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white' }}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" style={{ background: '#0f172a', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold' }}>
                    🖨️ Registrar e Imprimir
                  </button>
                </div>
              </form>
            </div></div>
      )}

      <div className="premium-card mt-6">
        <h3 className="premium-card-title mb-4">🌱 Cultivos Listos para Cosechar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(crops?.filter(c => c.status === 'GROWING') || []).map(crop => {
            const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
            const daysAlive = Math.floor((new Date() - new Date(crop.datePlanted || crop.plantedAt)) / (1000 * 60 * 60 * 24));
            
            return (
              <div key={crop.id} className="p-4 rounded-xl border border-green-200 bg-green-50 shadow-sm relative">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold text-green-800 text-lg">{cType?.name || 'Desconocido'}</h4>
                  <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-md font-mono">{crop.batchNumber || 'N/A'}</span>
                </div>
                <div className="flex flex-col gap-1 text-sm text-green-700">
                  <p><strong>Bandejas:</strong> {crop.traysCount}</p>
                  <p><strong>Días de vida:</strong> {daysAlive} días</p>
                </div>
                <button 
                  onClick={() => {
                    setNewHarvest(prev => ({ ...prev, selectedCropIds: [crop.id] }));
                    setIsHarvestModalOpen(true);
                  }}
                  className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition-colors"
                >
                  Ir a Envasar
                </button>
              </div>
            );
          })}
          {(crops?.filter(c => c.status === 'GROWING') || []).length === 0 && (
            <div className="col-span-full text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500">No hay cultivos en fase de crecimiento actualmente.</p>
            </div>
          )}
        </div>
      </div>

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
        {activeTab === 'historial' && renderHistorial()}
        {activeTab === 'pedidos' && renderPedidos()}
      </div>
      
    </div>
  );
}
