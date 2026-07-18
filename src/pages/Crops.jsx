import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import EmployeeTasks from '../components/EmployeeTasks';
import Supplies from './Supplies';
import '../crops.css';
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div style={{padding: '2rem', background: '#fee2e2', color: '#991b1b'}}><h2>¡Error en la Aplicación!</h2><p>Por favor, haz una captura de pantalla de este error y envíasela a la IA:</p><pre style={{background: 'white', padding: '1rem', marginTop: '1rem', overflowX: 'auto'}}>{this.state.error && this.state.error.toString()}</pre><pre style={{background: 'white', padding: '1rem', marginTop: '1rem', overflowX: 'auto'}}>{this.state.error && this.state.error.stack}</pre></div>;
    }
    return this.props.children;
  }
}


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
  const [sowTab, setSowTab] = useState('activos');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Modals state
  const [isSowModalOpen, setIsSowModalOpen] = useState(false);
  const [isHarvestModalOpen, setIsHarvestModalOpen] = useState(false);

  const [newCrop, setNewCrop] = useState({ cropTypeId: '', traysCount: 1, selectedSeedBatchId: '' });
  const [newTarget, setNewTarget] = useState({ targetDayOfWeek: 1, productId: '', tuppersCount: 1 });
  const [newHarvest, setNewHarvest] = useState({ productId: '', tuppersCount: 1, selectedCropIds: [] });

  // Computed properties for seed availability
  const selectedCropType = cropTypes?.find(c => c.id === newCrop.cropTypeId);
  const totalAvailableSeed = stockEntries?.filter(e => e.articleId === selectedCropType?.seedId).reduce((acc, curr) => acc + Number(curr.quantity || 0), 0) || 0;

  const availableBatches = useMemo(() => {
    if (!selectedCropType?.seedId) return [];
    const entries = stockEntries?.filter(e => e.articleId === selectedCropType.seedId) || [];
    const batches = {};
    entries.forEach(e => {
      const batch = e.batchNumber || 'SIN_LOTE';
      if (!batches[batch]) batches[batch] = { batchNumber: batch, quantity: 0, date: e.purchaseDate || e.createdAt || '' };
      batches[batch].quantity += Number(e.quantity || 0);
      const eDate = e.purchaseDate || e.createdAt || '';
      if (eDate && eDate < batches[batch].date) batches[batch].date = eDate;
    });
    
    return Object.values(batches)
      .filter(b => b.quantity > 0)
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))); // Oldest first
  }, [selectedCropType, stockEntries]);

  const oldestBatch = availableBatches.length > 0 ? availableBatches[0].batchNumber : '';

  useEffect(() => {
    if (oldestBatch && newCrop.cropTypeId && !newCrop.selectedSeedBatchId) {
      setNewCrop(prev => ({ ...prev, selectedSeedBatchId: oldestBatch }));
    }
  }, [oldestBatch, newCrop.cropTypeId]);

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

    const renderHistorial = () => {
    const historicalCrops = crops?.filter(c => c.status === 'HARVESTED' || c.status === 'DISCARDED') || [];
    
    const filteredHistory = historicalCrops.filter(crop => {
      const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
      const search = historySearch.toLowerCase();
      const matchBatch = (crop.batchNumber || '').toLowerCase().includes(search);
      const matchName = (cType?.name || '').toLowerCase().includes(search);
      return matchBatch || matchName;
    }).sort((a, b) => new Date(b.datePlanted || b.plantedAt) - new Date(a.datePlanted || a.plantedAt));

    const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
    const paginatedHistory = filteredHistory.slice((historyPage - 1) * ITEMS_PER_PAGE, historyPage * ITEMS_PER_PAGE);

    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '250px', maxWidth: '400px' }}>
            <span style={{ position: 'absolute', top: '50%', left: '1rem', transform: 'translateY(-50%)', color: '#94a3b8' }}>
              🔍
            </span>
            <input 
              type="text" 
              placeholder="Buscar por lote o cultivo..." 
              className="premium-input" 
              style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
              value={historySearch}
              onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
            />
          </div>
        </div>

        <div className="premium-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', textAlign: 'left', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700' }}>Lote / Siembra</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700' }}>Ficha de Cultivo</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700' }}>Fecha Siembra</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700', textAlign: 'center' }}>Bandejas</th>
                  <th style={{ padding: '1.25rem 1.5rem', fontWeight: '700', textAlign: 'right' }}>Estado Final</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHistory.map(crop => {
                  const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
                  const plantedDate = new Date(crop.datePlanted || crop.plantedAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' });
                  
                  return (
                    <tr key={crop.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s', cursor: 'default' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '1.25rem 1.5rem', fontWeight: '600', color: '#0f172a' }}>{crop.batchNumber || 'N/A'}</td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', backgroundColor: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', fontWeight: 'bold', fontSize: '0.75rem' }}>
                            {(cType?.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontWeight: '600', color: '#334155' }}>{cType?.name || 'Desconocido'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '1.25rem 1.5rem', color: '#64748b' }}>{plantedDate}</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center', fontWeight: 'bold', color: '#334155' }}>{crop.traysCount}</td>
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                        <span style={{ 
                          padding: '6px 12px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px',
                          backgroundColor: crop.status === 'HARVESTED' ? '#dcfce7' : '#fee2e2',
                          color: crop.status === 'HARVESTED' ? '#166534' : '#991b1b'
                        }}>
                          {crop.status === 'HARVESTED' ? '✅' : '🗑️'} {translateStatus(crop.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {paginatedHistory.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#64748b' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📭</div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: '0 0 0.5rem 0' }}>No hay resultados</h3>
                <p style={{ margin: 0 }}>No se encontraron cultivos en el historial que coincidan con tu búsqueda.</p>
              </div>
            )}
          </div>
          
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 1rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
              <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Mostrando {(historyPage - 1) * ITEMS_PER_PAGE + 1} a {Math.min(historyPage * ITEMS_PER_PAGE, filteredHistory.length)} de {filteredHistory.length} resultados</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  onClick={() => setHistoryPage(p => Math.max(1, p - 1))} 
                  disabled={historyPage === 1}
                  style={{ padding: '0.15rem 0.5rem', borderRadius: '0.25rem', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: '500', cursor: historyPage === 1 ? 'not-allowed' : 'pointer', opacity: historyPage === 1 ? 0.5 : 1 }}
                >Anterior</button>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button 
                      key={page} 
                      onClick={() => setHistoryPage(page)}
                      style={{ width: '2rem', height: '2rem', borderRadius: '0.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500', cursor: 'pointer', border: page === historyPage ? 'none' : '1px solid #cbd5e1', backgroundColor: page === historyPage ? '#059669' : 'white', color: page === historyPage ? 'white' : '#475569' }}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))} 
                  disabled={historyPage === totalPages}
                  style={{ padding: '0.15rem 0.5rem', borderRadius: '0.25rem', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: '500', cursor: historyPage === totalPages ? 'not-allowed' : 'pointer', opacity: historyPage === totalPages ? 0.5 : 1 }}
                >Siguiente</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLotes = () => {
    const activeCropsList = crops?.filter(c => c.status !== 'HARVESTED' && c.status !== 'DISCARDED') || [];

    return (
      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.875rem', fontWeight: '900', color: '#1e293b', margin: '0 0 0.25rem 0', letterSpacing: '-0.025em' }}>Gestión de Siembra</h2>
            <p style={{ color: '#64748b', fontSize: '1.125rem', margin: 0 }}>Supervisa y planta nuevas bandejas</p>
          </div>
          <button onClick={() => setIsSowModalOpen(true)} className="btn" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '0.875rem 1.5rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.3)', transition: 'transform 0.2s ease' }} onMouseOver={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseOut={e=>e.currentTarget.style.transform='none'}>
            <span style={{ fontSize: '1.2rem' }}>⊕</span> Registrar Siembra
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '0.75rem', width: 'fit-content' }}>
          <button 
            onClick={() => setSowTab('activos')}
            style={{ padding: '0.625rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', transition: 'all 0.2s', cursor: 'pointer', border: 'none', backgroundColor: sowTab === 'activos' ? 'white' : 'transparent', color: sowTab === 'activos' ? '#047857' : '#64748b', boxShadow: sowTab === 'activos' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
          >
            🪴 Bandejas Activas ({activeCropsList.length})
          </button>
          <button 
            onClick={() => setSowTab('historico')}
            style={{ padding: '0.625rem 1.5rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', transition: 'all 0.2s', cursor: 'pointer', border: 'none', backgroundColor: sowTab === 'historico' ? 'white' : 'transparent', color: sowTab === 'historico' ? '#1e293b' : '#64748b', boxShadow: sowTab === 'historico' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
          >
            📖 Histórico de Siembras
          </button>
        </div>

        {isSowModalOpen && (
          <div style={modalOverlayStyle}>
            <div style={{ ...modalCardStyle, maxWidth: '500px', padding: 0, overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '1.5rem', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '0.5rem', fontSize: '1.5rem' }}>🌱</div>
                  <div>
                    <h3 style={{ fontWeight: 'bold', fontSize: '1.25rem', margin: 0 }}>Registrar Siembra</h3>
                    <p style={{ color: '#d1fae5', fontSize: '0.875rem', margin: 0 }}>Añade nuevas bandejas al invernadero</p>
                  </div>
                </div>
                <button onClick={() => setIsSowModalOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', opacity: 0.8 }} onMouseOver={e=>e.currentTarget.style.opacity=1} onMouseOut={e=>e.currentTarget.style.opacity=0.8}>&times;</button>
              </div>
              <div style={{ padding: '2rem' }}>
                <form onSubmit={handleAddCrop} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'block', color: '#334155' }}>1. ¿Qué vas a plantar?</label>
                    <select className="premium-input" style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', background: '#f8fafc', fontSize: '1rem', fontWeight: '500', boxSizing: 'border-box' }} required value={newCrop.cropTypeId} onChange={e=>setNewCrop({...newCrop, cropTypeId: e.target.value, selectedSeedBatchId: ''})}>
                      <option value="">Selecciona una variedad...</option>
                      {cropTypes?.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedCropType && (
                      <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid #bbf7d0', display: 'flex', gap: '1rem', alignItems: 'flex-start', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                          <div style={{ fontSize: '1.5rem', marginTop: '0.25rem' }}>🌱</div>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#166534', display: 'block', marginBottom: '0.25rem' }}>Inventario Disponible Total</label>
                            <p style={{ fontSize: '1.25rem', fontWeight: '900', color: '#14532d', margin: 0 }}>
                              {totalAvailableSeed.toFixed(2)} g 
                              {selectedCropType.seedGrams > 0 && <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#15803d', marginLeft: '0.5rem' }}>(Max. {Math.floor(totalAvailableSeed / selectedCropType.seedGrams)} bandejas)</span>}
                            </p>
                          </div>
                        </div>

                        <div style={{ width: '100%', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed #bbf7d0' }}>
                          <label style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#166534', display: 'block', marginBottom: '0.5rem' }}>Selecciona el Lote de Semillas (Trazabilidad)</label>
                          <select className="premium-input" style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #86efac', background: 'white', fontSize: '0.875rem', fontWeight: 'bold' }} required value={newCrop.selectedSeedBatchId || ''} onChange={e => setNewCrop({...newCrop, selectedSeedBatchId: e.target.value})}>
                            <option value="">-- Sin stock de lotes --</option>
                            {availableBatches.map(b => (
                              <option key={b.batchNumber} value={b.batchNumber}>{b.batchNumber} ({b.quantity.toFixed(2)} g disponibles) {b.batchNumber === oldestBatch ? ' - [FIFO Recomendado]' : ''}</option>
                            ))}
                          </select>
                          
                          {newCrop.selectedSeedBatchId && newCrop.selectedSeedBatchId !== oldestBatch && (
                            <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', backgroundColor: '#fffbeb', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #fde68a' }}>
                              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
                              <p style={{ margin: 0, fontSize: '0.75rem', color: '#92400e', fontWeight: 'bold', lineHeight: 1.4 }}>Aviso: Hay semillas de un lote más antiguo en stock ({oldestBatch}). Se recomienda encarecidamente usar el método FIFO para evitar caducidades y mermas.</p>
                            </div>
                          )}
                          
                          <p style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '0.75rem', lineHeight: 1.5 }}>Al plantar, se descontará automáticamente el consumo asignándolo al lote seleccionado para garantizar la trazabilidad.</p>
                        </div>
                      </div>
                    )}

                  <div>
                    <label style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'block', color: '#334155' }}>2. ¿Cuántas bandejas son?</label>
                    <input type="number" required min="1" className="premium-input" style={{ width: '100%', padding: '1rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', fontSize: '1.5rem', fontWeight: '900', color: '#0f172a', textAlign: 'center', boxSizing: 'border-box' }} value={newCrop.traysCount} onChange={e=>setNewCrop({...newCrop, traysCount: Number(e.target.value)})}/>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                    <button type="button" onClick={() => setIsSowModalOpen(false)} style={{ flex: '1', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '2px solid #e2e8f0', color: '#475569', fontWeight: 'bold', backgroundColor: 'white', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#f8fafc'} onMouseOut={e=>e.currentTarget.style.backgroundColor='white'}>Cancelar</button>
                    <button type="submit" disabled={selectedCropType && totalAvailableSeed <= 0} style={{ flex: '1', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: 'none', color: 'white', fontWeight: 'bold', background: 'linear-gradient(135deg, #10b981, #059669)', cursor: (selectedCropType && totalAvailableSeed <= 0) ? 'not-allowed' : 'pointer', opacity: (selectedCropType && totalAvailableSeed <= 0) ? 0.5 : 1, boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}>
                      {selectedCropType && totalAvailableSeed <= 0 ? 'Sin Semilla' : 'Confirmar Siembra'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {sowTab === 'activos' && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Lotes en Producción</h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                  <button onClick={() => setStatusFilter('ALL')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'ALL' ? 'white' : 'transparent', color: statusFilter === 'ALL' ? '#0f172a' : '#64748b', boxShadow: statusFilter === 'ALL' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Todos</button>
                  <button onClick={() => setStatusFilter('SOAKING')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'SOAKING' ? '#dbeafe' : 'transparent', color: statusFilter === 'SOAKING' ? '#1e3a8a' : '#64748b', boxShadow: statusFilter === 'SOAKING' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>En Remojo</button>
                  <button onClick={() => setStatusFilter('GERMINATING')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'GERMINATING' ? '#fef3c7' : 'transparent', color: statusFilter === 'GERMINATING' ? '#92400e' : '#64748b', boxShadow: statusFilter === 'GERMINATING' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Germinando</button>
                  <button onClick={() => setStatusFilter('GROWING')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'GROWING' ? '#d1fae5' : 'transparent', color: statusFilter === 'GROWING' ? '#065f46' : '#64748b', boxShadow: statusFilter === 'GROWING' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Creciendo</button>
                </div>
              </div>

              <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variedad y Lote</th>
                      <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>Bandejas</th>
                      <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fase Actual</th>
                      <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', width: '25%' }}>Desarrollo</th>
                      <th style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeCropsList
                      .filter(crop => {
                        if (weekFilter === 'ALL') return true;
                        const date = new Date(crop.datePlanted || crop.plantedAt);
                        const daysAgo = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
                        if (weekFilter === 'THIS_WEEK') return daysAgo <= 7;
                        if (weekFilter === 'LAST_WEEK') return daysAgo > 7 && daysAgo <= 14;
                        if (weekFilter === 'OLDER') return daysAgo > 14;
                        return true;
                      })
                      .sort((a, b) => {
                        // Older crops (closest to harvest) first
                        const dateA = new Date(a.datePlanted || a.plantedAt);
                        const dateB = new Date(b.datePlanted || b.plantedAt);
                        return dateA - dateB;
                      })
                      .map(crop => {
                        const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
                        const daysAlive = Math.floor((new Date() - new Date(crop.datePlanted || crop.plantedAt)) / (1000 * 60 * 60 * 24));
                        const expectedDays = cType?.daysToHarvest || 14;
                        const progressPercentage = Math.min(100, Math.max(0, (daysAlive / expectedDays) * 100));
                        
                        let statusColor = { bg: '#f1f5f9', text: '#475569', bar: '#94a3b8' };
                        const statusStr = (crop.status || '').toUpperCase();
                        if (statusStr === 'SOAKING') statusColor = { bg: '#dbeafe', text: '#1e3a8a', bar: '#3b82f6' };
                        else if (statusStr === 'GERMINATING') statusColor = { bg: '#fef3c7', text: '#92400e', bar: '#f59e0b' };
                        else if (statusStr === 'GROWING') statusColor = { bg: '#d1fae5', text: '#065f46', bar: '#10b981' };

                        return (
                          <tr key={crop.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} onMouseOver={e=>e.currentTarget.style.backgroundColor='#f8fafc'} onMouseOut={e=>e.currentTarget.style.backgroundColor='transparent'}>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.5rem', backgroundColor: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1rem', border: '1px solid #d1fae5' }}>
                                  {cType?.name ? cType.name.charAt(0).toUpperCase() : '🌱'}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '0.85rem' }}>{cType?.name || 'Desconocido'}</div>
                                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace', marginTop: '-2px' }}>{crop.batchNumber || 'N/A'}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '0.5rem 1rem', textAlign: 'center' }}>
                              <span style={{ fontSize: '1rem', fontWeight: '900', color: '#0f172a' }}>{crop.traysCount}</span>
                            </td>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <span style={{ backgroundColor: statusColor.bg, color: statusColor.text, padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 'bold', border: `1px solid ${statusColor.text}20` }}>
                                {translateStatus(crop.status)}
                              </span>
                            </td>
                            <td style={{ padding: '0.5rem 1rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ flex: 1, backgroundColor: '#e2e8f0', borderRadius: '9999px', height: '0.35rem', overflow: 'hidden' }}>
                                  <div style={{ backgroundColor: statusColor.bar, height: '100%', borderRadius: '9999px', width: `${progressPercentage}%` }}></div>
                                </div>
                                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b', minWidth: '4rem', textAlign: 'right' }}>
                                  Día {daysAlive >= 0 ? daysAlive : 0} / {expectedDays}
                                </span>
                              </div>
                            </td>
                            <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                <button onClick={() => discardCrop(crop)} title="Descartar" style={{ padding: '0.25rem 0.5rem', borderRadius: '0.35rem', border: '1px solid #fecaca', color: '#dc2626', backgroundColor: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                                <button onClick={() => advanceCropStatus(crop)} title="Avanzar Fase" style={{ padding: '0.25rem 0.5rem', borderRadius: '0.35rem', border: 'none', backgroundColor: '#1e293b', color: 'white', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <span>Siguiente</span>
                                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      
                      {activeCropsList.length === 0 && (
                        <tr>
                          <td colSpan="5">
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', backgroundColor: 'transparent' }}>
                              <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🌱</div>
                              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#334155', margin: '0 0 0.5rem 0' }}>Invernadero Vacío</h3>
                              <p style={{ color: '#64748b', margin: 0, textAlign: 'center' }}>No hay bandejas en producción actualmente.<br/>Usa el botón de arriba para registrar una nueva siembra.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        {sowTab === 'historico' && renderHistorial()}

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

  const renderSowingAnalytics = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentOrders = orders?.filter(o => new Date(o.date || o.createdAt) >= thirtyDaysAgo && o.status !== 'CANCELLED') || [];
    
    const productSales = {};
    recentOrders.forEach(o => {
      o.items?.forEach(item => {
        productSales[item.productId] = (productSales[item.productId] || 0) + Number(item.quantity || 0);
      });
    });

    const recentHarvests = harvests?.filter(h => new Date(h.harvestDate) >= thirtyDaysAgo) || [];
    
    const productYields = {};
    recentHarvests.forEach(h => {
      if(!productYields[h.productId]) productYields[h.productId] = { totalTuppers: 0, totalTrays: 0 };
      productYields[h.productId].totalTuppers += Number(h.tuppersCount || 0);
      
      let traysHarvested = 0;
      h.selectedCropIds?.forEach(cid => {
        const crop = crops?.find(c => c.id === cid);
        if (crop) traysHarvested += Number(crop.traysCount || 1);
      });
      if (traysHarvested === 0 && h.selectedCropIds?.length > 0) traysHarvested = h.selectedCropIds.length;
      
      productYields[h.productId].totalTrays += traysHarvested;
    });

    const analytics = cropTypes?.map(cType => {
      const linkedProducts = products?.filter(p => p.recipeSeeds?.some(rs => rs.seedId === cType.seedId) || (p.recipeSeeds?.length === 0 && p.id === cType.id)) || [];
      
      let totalDemand30d = 0;
      let yieldTuppers = 0;
      let yieldTrays = 0;

      linkedProducts.forEach(p => {
        totalDemand30d += (productSales[p.id] || 0);
        if (productYields[p.id]) {
          yieldTuppers += productYields[p.id].totalTuppers;
          yieldTrays += productYields[p.id].totalTrays;
        }
      });

      const avgWeeklyDemand = totalDemand30d / (30 / 7);
      const actualYieldRate = yieldTrays > 0 ? (yieldTuppers / yieldTrays) : 5;
      
      const recommendedTrays = Math.ceil(avgWeeklyDemand / actualYieldRate);
      const currentlyPlannedTrays = harvestTargets?.filter(ht => ht.productId === cType.id).reduce((sum, ht) => sum + Number(ht.tuppersCount || 0), 0) || 0;

      return {
        cType,
        avgWeeklyDemand: avgWeeklyDemand.toFixed(1),
        yieldRate: actualYieldRate.toFixed(1),
        recommendedTrays,
        currentlyPlannedTrays,
        diff: currentlyPlannedTrays - recommendedTrays
      };
    });

    return (
      <div style={{ background: 'white', borderRadius: '20px', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.4rem', color: '#1e293b' }}>
          <span>💡</span> Sugerencias de Siembra (Últimos 30 días)
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '1rem', color: '#64748b', fontWeight: 'bold' }}>Variedad</th>
                <th style={{ padding: '1rem', color: '#64748b', fontWeight: 'bold' }}>Ventas Medias</th>
                <th style={{ padding: '1rem', color: '#64748b', fontWeight: 'bold' }}>Rendimiento Real</th>
                <th style={{ padding: '1rem', color: '#64748b', fontWeight: 'bold' }}>Recomendación</th>
                <th style={{ padding: '1rem', color: '#64748b', fontWeight: 'bold' }}>Estado Actual</th>
              </tr>
            </thead>
            <tbody>
              {analytics?.map(a => (
                <tr key={a.cType.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '1rem', fontWeight: 'bold', color: '#334155' }}>{a.cType.name}</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{a.avgWeeklyDemand} tup/sem</td>
                  <td style={{ padding: '1rem', color: '#64748b' }}>{a.yieldRate} tup/bandeja</td>
                  <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--crop-primary)' }}>🌱 {a.recommendedTrays} bandejas/sem</td>
                  <td style={{ padding: '1rem' }}>
                    {a.diff === 0 ? (
                      <span style={{ background: '#ecfdf5', color: '#059669', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}>✔️ Óptimo</span>
                    ) : a.diff > 0 ? (
                      <span style={{ background: '#fffbeb', color: '#d97706', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}>⚠️ Sobran {a.diff}</span>
                    ) : (
                      <span style={{ background: '#fef2f2', color: '#ef4444', padding: '4px 8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}>⚠️ Faltan {Math.abs(a.diff)}</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!analytics || analytics.length === 0) && (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>No hay suficientes datos todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPlanificador = () => (
    <div>
      <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #ccfbf1)', border: '1px solid #99f6e4', padding: '2rem', borderRadius: '20px', marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', fontWeight: 900, color: '#065f46' }}>Planificador Semanal de Siembra</h2>
        <p style={{ margin: 0, color: '#047857', fontSize: '1.1rem', fontWeight: 500, lineHeight: 1.5 }}>
          Define qué variedades vas a sembrar cada día de la semana para mantener tu ritmo de producción. El sistema generará automáticamente las tareas de Siembra y te avisará un día antes si la semilla requiere remojo.
        </p>
      </div>

      {renderSowingAnalytics()}

      <div className="premium-card" style={{ marginBottom: '2rem' }}>
        <form onSubmit={handleAddHarvestTarget} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label className="premium-label">Día de Siembra</label>
            <select className="premium-input" value={newTarget.targetDayOfWeek} onChange={e=>setNewTarget({...newTarget, targetDayOfWeek: Number(e.target.value)})}>
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
            <label className="premium-label">Variedad a Cultivar</label>
            <select className="premium-input" required value={newTarget.productId} onChange={e=>setNewTarget({...newTarget, productId: e.target.value})}>
              <option value="">-- Seleccionar Variedad --</option>
              {cropTypes?.map(ct => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
            </select>
          </div>
          <div style={{ flex: '1', minWidth: '150px' }}>
            <label className="premium-label">Cantidad de Bandejas</label>
            <input type="number" className="premium-input" required min="1" value={newTarget.tuppersCount} onChange={e=>setNewTarget({...newTarget, tuppersCount: Number(e.target.value)})}/>
          </div>
          <button type="submit" className="climate-btn" style={{ margin: 0, width: 'auto', minWidth: '150px' }}>Añadir a Rutina</button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        {harvestTargets?.map(ht => {
          const cType = cropTypes?.find(c => c.id === ht.productId);
          const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
          return (
            <div key={ht.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--crop-primary)' }}></div>
              <button onClick={() => deleteHarvestTarget(ht.id)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem' }}>✖</button>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 900, color: '#1e293b', paddingRight: '1rem' }}>{cType?.name || 'Variedad Eliminada'}</h4>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--crop-primary)', lineHeight: 1 }}>{ht.tuppersCount}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#64748b' }}>bandejas</span>
              </div>
              <div style={{ display: 'inline-block', padding: '4px 12px', background: '#ecfdf5', color: '#059669', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                Sembramos en: {days[ht.targetDayOfWeek]}
              </div>
            </div>
          )
        })}
        {(!harvestTargets || harvestTargets.length === 0) && (
          <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#64748b', padding: '2rem' }}>No has configurado ninguna rutina de siembra semanal.</p>
        )}
      </div>
    </div>
  );

    const renderCropsHub = () => (
    <div className="hub-container" style={{ padding: '2rem', animation: 'fadeIn 0.4s ease' }}>
      <div className="hub-content" style={{ maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <div className="hub-header" style={{ marginBottom: '4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 style={{ fontSize: '3rem', margin: '0 0 0.5rem 0', color: '#0f172a', fontWeight: '900', letterSpacing: '-0.05em' }}>Control de Cultivo</h1>
          <p style={{ color: '#64748b', fontSize: '1.25rem', margin: 0 }}>Selecciona tu zona de trabajo para gestionar el invernadero</p>
        </div>
        
        <div className="hub-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <button onClick={() => setActiveTab('stock')} className="hub-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)', transition: 'all 0.3s ease', cursor: 'pointer' }}>
            <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#92400e', margin: '0 0 0.5rem 0' }}>Stock</h2>
              <p style={{ fontSize: '1rem', color: '#b45309', margin: 0 }}>Semillas e insumos</p>
            </div>
            <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#fefce8', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>📦</div>
          </button>

        <button onClick={() => setActiveTab('tareas')} className="hub-card crops-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', background: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)', transition: 'all 0.3s ease', cursor: 'pointer' }}>
          <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', margin: '0 0 0.5rem 0' }}>Tareas</h2>
            <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>Día / Semana / Mes</p>
          </div>
          <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#fef2f2', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>🎯</div>
        </button>

        <button onClick={() => setActiveTab('lotes')} className="hub-card tv-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', background: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)', transition: 'all 0.3s ease', cursor: 'pointer' }}>
          <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', margin: '0 0 0.5rem 0' }}>Siembra</h2>
            <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>Bandejas en curso</p>
          </div>
          <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#f0fdf4', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>🪴</div>
        </button>

        <button onClick={() => setActiveTab('cosechas')} className="hub-card admin-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', background: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)', transition: 'all 0.3s ease', cursor: 'pointer' }}>
          <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', margin: '0 0 0.5rem 0' }}>Cosecha</h2>
            <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>Envasado y etiquetas</p>
          </div>
          <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#f8fafc', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>🔪</div>
        </button>

        <button onClick={() => setActiveTab('planificador')} className="hub-card driver-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', background: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)', transition: 'all 0.3s ease', cursor: 'pointer' }}>
          <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', margin: '0 0 0.5rem 0' }}>Planificador</h2>
            <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>Rutinas automáticas</p>
          </div>
          <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#eff6ff', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>📅</div>
        </button>
      </div>
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
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
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
    <ErrorBoundary>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
              <button 
                onClick={() => window.open('/tv', 'TVMode', 'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no,resizable=yes')} 
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
        {activeTab === 'stock' && <Supplies />}
      </div>
      
    </div>
      </ErrorBoundary>
    );
}