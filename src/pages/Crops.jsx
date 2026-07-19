/* eslint-disable no-unused-vars */
import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import EmployeeTasks from '../components/EmployeeTasks';
import Supplies from './Supplies';
import '../crops.css';
import React from 'react';
import Swal from 'sweetalert2';

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
    crops, sowCrop, updateCrop, advanceCropStatus, setCropPhase, discardCrop, deleteCrop,
    stockEntries, articles,
    cropTypes,
    harvestTargets, addHarvestTarget, updateHarvestTarget, deleteHarvestTarget,
    harvests, addHarvest,
    addProductMovement, productMovements,
    products,
    orders, clients, updateOrderList
  } = useData();

  
  const handleDeleteCrop = (crop) => {
    Swal.fire({
      title: '⚠️ ATENCIÓN ADMINISTRACIÓN',
      text: 'Vas a eliminar permanentemente este registro de cultivo. Esta acción no se puede deshacer y afectará a la trazabilidad histórica. ¿Estás absolutamente seguro?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteCrop(crop.id);
        Swal.fire({ title: 'Eliminado', text: 'El registro ha sido eliminado.', icon: 'success', timer: 1500, showConfirmButton: false });
      }
    });
  };

  const [activeTab, setActiveTab] = useState('menu');
  const [sowTab, setSowTab] = useState('activos');
  const [harvestTab, setHarvestTab] = useState('cosechar');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Modals state
  const [isSowModalOpen, setIsSowModalOpen] = useState(false);
  const [isHarvestModalOpen, setIsHarvestModalOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'sow') {
      const cId = searchParams.get('cropTypeId');
      const trays = searchParams.get('trays');
      if (cId) {
        setNewCrop(prev => ({ ...prev, cropTypeId: cId, traysCount: trays || 1, selectedSeedBatchId: '' }));
        setIsSowModalOpen(true);
        // Clean URL so it doesn't reopen on refresh
        setSearchParams({});
      }
    } else if (action === 'harvest') {
      const cId = searchParams.get('cropTypeId');
      if (cId) {
        // We might not know the specific crop ID, but we know it's a harvest action. 
        // We'll just open the modal.
        setIsHarvestModalOpen(true);
        setSearchParams({});
      }
    }
  }, [searchParams, setSearchParams]);

  const [showPhaseChangeModal, setShowPhaseChangeModal] = useState(null);
  const [pendingPhase, setPendingPhase] = useState(null);

  const [newCrop, setNewCrop] = useState({ cropTypeId: '', traysCount: 1, selectedSeedBatchId: '' });
  const [newTarget, setNewTarget] = useState({ targetDayOfWeek: 1, productId: '', tuppersCount: 1 });
  const [newHarvest, setNewHarvest] = useState({ productId: '', tuppersCount: 1, selectedCropUsages: {} });

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
      Swal.fire({ title: '¡Cultivo Plantado!', text: 'Stock de semillas y sustrato descontado correctamente.', icon: 'success', confirmButtonColor: '#10b981' });
    } catch (error) {
      Swal.fire({ title: 'Error', text: error.message, icon: 'error', confirmButtonColor: '#ef4444' });
    }
  };

  const handleAddHarvestTarget = e => { e.preventDefault(); addHarvestTarget(newTarget); };
  
  const handleRegisterHarvest = async (e) => {
    e.preventDefault();
    const cropIdsToHarvest = Object.keys(newHarvest.selectedCropUsages).filter(id => newHarvest.selectedCropUsages[id] > 0);
    
    if (cropIdsToHarvest.length === 0) {
      Swal.fire({ title: 'Faltan datos', text: 'Debes indicar cuántas bandejas vas a cosechar de al menos un cultivo.', icon: 'warning', confirmButtonColor: '#f59e0b' });
      return;
    }

    const batchNum = `L-${Date.now().toString().slice(-6)}`;
    
    // 1. Mark selected crops as HARVESTED or partially update trays
    for (const cropId of cropIdsToHarvest) {
      const cropToHarvest = crops.find(c => c.id === cropId);
      const consumedTrays = newHarvest.selectedCropUsages[cropId];
      if (cropToHarvest) {
        const remaining = cropToHarvest.traysCount - consumedTrays;
        if (remaining <= 0) {
          await updateCrop(cropId, { traysCount: 0, status: 'HARVESTED' });
        } else {
          await updateCrop(cropId, { traysCount: remaining });
        }
      }
    }

    // 2. Register the harvest product
    addHarvest({...newHarvest, selectedCropIds: cropIdsToHarvest, harvestDate: new Date().toISOString(), batchNumber: batchNum});
      
      // Añadir al inventario de Nevera (Productos Finales)
      if (newHarvest.productId && newHarvest.tuppersCount > 0) {
        await addProductMovement({
          productId: newHarvest.productId,
          quantity: newHarvest.tuppersCount,
          type: 'HARVEST',
          referenceId: batchNum
        });
      }

    const product = products?.find(p => p.id === newHarvest.productId);
    generateLabelPDF(product?.name || 'Desconocido', batchNum, product?.shelfLifeDays || 10, newHarvest.tuppersCount);
    
    setNewHarvest({ productId: '', tuppersCount: 1, selectedCropUsages: {} });
    setIsHarvestModalOpen(false);
    Swal.fire({ title: '¡Cosecha Registrada!', text: `Se ha guardado el lote de Sanidad: ${batchNum}. Generando etiquetas PDF...`, icon: 'success', confirmButtonColor: '#10b981' });
  };

  const handleProductSelect = (productId) => {
    setNewHarvest(prev => {
      const newProduct = products?.find(p => p.id === productId);
      if (!newProduct) return { ...prev, productId, selectedCropUsages: {} };
      
      const allowedSeedIds = newProduct.recipeSeeds?.map(rs => rs.seedId) || [];
      const validUsages = {};
      
      for (const [cropId, qty] of Object.entries(prev.selectedCropUsages)) {
        const crop = crops?.find(c => c.id === cropId);
        const actualSeedId = crop?.seedId || cropTypes?.find(ct => ct.id === crop?.cropTypeId)?.seedId;
        if (allowedSeedIds.includes(actualSeedId)) {
          validUsages[cropId] = qty;
        }
      }
      
      return { ...prev, productId, selectedCropUsages: validUsages };
    });
  };

  const openHarvestModalForCrop = (crop) => {
    // 1. Pre-seleccionar la bandeja
    const usages = { [crop.id]: crop.traysCount };
    setNewHarvest(prev => ({ ...prev, selectedCropUsages: usages, productId: '' }));
    
    // 2. Buscar si hay algún producto que encaje con esta semilla
    const actualSeedId = crop.seedId || cropTypes?.find(ct => ct.id === crop.cropTypeId)?.seedId;
    if (actualSeedId) {
      const compatibleProducts = products?.filter(p => p.recipeSeeds?.some(rs => rs.seedId === actualSeedId)) || [];
      if (compatibleProducts.length > 0) {
        // Auto-seleccionar el primer producto compatible por defecto para no dejar el Step 2 bloqueado
        setNewHarvest(prev => ({ ...prev, selectedCropUsages: usages, productId: compatibleProducts[0].id }));
      }
    }
    
    setIsHarvestModalOpen(true);
  };

  const generateLabelPDF = (productName, batch, shelfLife, copies) => {
    import('../utils/labelPdf.js').then(module => {
      module.generateAndPrintLabels(productName, batch, shelfLife, copies);
    });
  };

  // Modal Styles
  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999 };
  const modalCardStyle = { width: '100%', maxWidth: '600px', margin: '20px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fff', padding: '2rem', borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' };

  const translateStatus = (status) => {
    const statusMap = {
      'SOAKING': 'En Remojo',
      'SOWED': 'Sembrado',
      'GERMINATING': 'Germinando',
      'DARKNESS': 'Oscuridad',
        'LIGHT': 'Luz',
        'READY': 'Listo',
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
    // Solo mostramos cultivos vivos y que tengan al menos 1 bandeja física
    const activeCropsList = crops?.filter(c => c.status !== 'HARVESTED' && c.status !== 'DISCARDED' && (c.traysCount > 0 || c.trays > 0)) || [];

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

        
          {/* SOWING SMART TASKS OUTSIDE MODAL */}
          {(() => {
            const today = new Date();
            const targetDayOfWeek = today.getDay();
            const tasks = [];
            
            (harvestTargets || []).forEach(routine => {
              const cType = (cropTypes || []).find(ct => ct.id == routine.productId);
              if(!cType) return;
              
              const plantWd = Number(routine.targetDayOfWeek);
              
              const isPlanted = (crops || []).some(c => {
                if(c.cropTypeId !== cType.id) return false;
                if(!c.datePlanted || c.status === 'DISCARDED' || c.status === 'HARVESTED') return false;
                const cDate = new Date(c.datePlanted);
                const tDate = new Date();
                return cDate.getFullYear() === tDate.getFullYear() && 
                       cDate.getMonth() === tDate.getMonth() && 
                       cDate.getDate() === tDate.getDate();
              });
              
              if(plantWd === targetDayOfWeek && !isPlanted) {
                tasks.push({
                  cropTypeId: cType.id,
                  name: cType.name,
                  trays: routine.tuppersCount
                });
              }
            });

            if (tasks.length > 0) {
              return (
                <div style={{ marginBottom: '2rem', backgroundColor: '#f0fdf4', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #bbf7d0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <h4 style={{ fontWeight: 'bold', color: '#166534', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                    <span>📋</span> Tareas de Siembra Pendientes para Hoy
                  </h4>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    {tasks.map((t, idx) => (
                      <div key={idx} 
                          onClick={() => {
                            setNewCrop(prev => ({ ...prev, cropTypeId: t.cropTypeId, traysCount: t.trays, selectedSeedBatchId: '' }));
                            setIsSowModalOpen(true);
                          }}
                          style={{ flex: '1 1 min-content', minWidth: '250px', display: 'flex', justifyContent: 'space-between', padding: '1rem', backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #cbd5e1', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#22c55e'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(34,197,94,0.2)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'; }}
                      >
                        <div>
                          <span style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '1.1rem' }}>Sembrar {t.name}</span>
                          <div style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.25rem' }}>{t.trays} bandejas planificadas</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', color: '#22c55e', fontWeight: 'bold' }}>
                           <span style={{ backgroundColor: '#dcfce7', padding: '0.5rem 1rem', borderRadius: '999px', fontSize: '0.85rem' }}>Empezar ➔</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            return null;
          })()}

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

        

        {sowTab === 'activos' && (
            <div style={{ animation: 'fadeIn 0.3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>Lotes en Producción</h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f8fafc', padding: '0.25rem', borderRadius: '0.75rem', border: '1px solid #e2e8f0' }}>
                  <button onClick={() => setStatusFilter('ALL')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'ALL' ? 'white' : 'transparent', color: statusFilter === 'ALL' ? '#0f172a' : '#64748b', boxShadow: statusFilter === 'ALL' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Todos</button>
                  <button onClick={() => setStatusFilter('SOAKING')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'SOAKING' ? '#dbeafe' : 'transparent', color: statusFilter === 'SOAKING' ? '#1e3a8a' : '#64748b', boxShadow: statusFilter === 'SOAKING' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>En Remojo</button>
                  <button onClick={() => setStatusFilter('GERMINATING')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'GERMINATING' ? '#fef3c7' : 'transparent', color: statusFilter === 'GERMINATING' ? '#92400e' : '#64748b', boxShadow: statusFilter === 'GERMINATING' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Germinación</button>
                  <button onClick={() => setStatusFilter('DARKNESS')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'DARKNESS' ? '#e0e7ff' : 'transparent', color: statusFilter === 'DARKNESS' ? '#3730a3' : '#64748b', boxShadow: statusFilter === 'DARKNESS' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Oscuridad</button>
                  <button onClick={() => setStatusFilter('LIGHT')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'LIGHT' ? '#ccfbf1' : 'transparent', color: statusFilter === 'LIGHT' ? '#0f766e' : '#64748b', boxShadow: statusFilter === 'LIGHT' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Luz</button>
                  <button onClick={() => setStatusFilter('READY')} style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', fontWeight: 'bold', fontSize: '0.875rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', backgroundColor: statusFilter === 'READY' ? '#dcfce7' : 'transparent', color: statusFilter === 'READY' ? '#166534' : '#64748b', boxShadow: statusFilter === 'READY' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Listo para cosechar</button>
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
                          if (statusFilter === 'ALL') return true;
                          const s = crop.status || 'SOWED';
                          if (statusFilter === 'READY') return s === 'READY';
                          return s === statusFilter;
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
                        const expectedDays = cType ? ((Number(cType.germinationDays || 0) + Number(cType.darknessDays || 0) + Number(cType.lightDays || 0)) || 14) : 14;
                        const progressPercentage = Math.min(100, Math.max(0, (daysAlive / expectedDays) * 100));
                        
                        let statusColor = { bg: '#f1f5f9', text: '#475569', bar: '#94a3b8' };
                        const statusStr = (crop.status || '').toUpperCase();
                        if (statusStr === 'SOAKING') statusColor = { bg: '#dbeafe', text: '#1e3a8a', bar: '#3b82f6' };
                        else if (statusStr === 'GERMINATING') statusColor = { bg: '#fef3c7', text: '#92400e', bar: '#f59e0b' };
                        else if (statusStr === 'DARKNESS') statusColor = { bg: '#e0e7ff', text: '#3730a3', bar: '#4f46e5' };
                          else if (statusStr === 'LIGHT') statusColor = { bg: '#ccfbf1', text: '#0f766e', bar: '#14b8a6' };
                          else if (statusStr === 'READY') statusColor = { bg: '#dcfce7', text: '#166534', bar: '#22c55e' };

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
                                <button onClick={() => handleDeleteCrop(crop)} title="Eliminar Registro" style={{ padding: '0.25rem 0.5rem', borderRadius: '0.35rem', border: '1px solid #fecaca', color: '#dc2626', backgroundColor: '#fee2e2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
</button>

                                <button onClick={() => { setShowPhaseChangeModal(crop); setPendingPhase(crop.status || "SOWED"); }} title="Cambiar Fase" style={{ padding: '0.35rem 0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', color: '#334155', fontWeight: 'bold', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>Cambiar Fase</button>
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
          <h2 className="text-2xl font-bold text-gray-800">🔪 Envasado y Pedidos</h2>
          <p className="text-gray-500">Registra lo cosechado y gestiona el inventario de ventas.</p>
        </div>
        <button onClick={() => setIsHarvestModalOpen(true)} className="btn btn-primary" style={{ background: '#0f172a', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
          + Registrar Cosecha
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setHarvestTab('cosechar')}
          style={{ 
            background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold',
            color: harvestTab === 'cosechar' ? '#16a34a' : '#64748b',
            borderBottom: harvestTab === 'cosechar' ? '3px solid #16a34a' : '3px solid transparent',
            marginBottom: '-0.65rem', transition: 'all 0.2s'
          }}
        >
          🌱 Para Cosechar
        </button>
        <button 
          onClick={() => setHarvestTab('inventario')}
          style={{ 
            background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold',
            color: harvestTab === 'inventario' ? '#0f172a' : '#64748b',
            borderBottom: harvestTab === 'inventario' ? '3px solid #0f172a' : '3px solid transparent',
            marginBottom: '-0.65rem', transition: 'all 0.2s'
          }}
        >
          📦 Producto Terminado
        </button>
      </div>

      {harvestTab === 'inventario' && (
      <div className="premium-card mb-6" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: 'white', border: '1px solid #334155', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)' }}>
        <h3 className="premium-card-title" style={{ margin: 0, color: 'white', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid #334155', padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
          <span style={{ fontSize: '1.5rem' }}>📦</span> Inventario de Producto Terminado y Reservas
        </h3>
        
        <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {products?.map(product => {
            const harvested = productMovements?.filter(m => m.productId === product.id && m.type === 'HARVEST').reduce((acc, curr) => acc + curr.quantity, 0) || 0;
            const sold = productMovements?.filter(m => m.productId === product.id && m.type === 'ORDER').reduce((acc, curr) => acc + Math.abs(curr.quantity), 0) || 0;
            const physicalStock = harvested - sold;

            const pendingOrders = orders?.filter(o => o.status === 'PENDING' || o.status === 'PREPARED') || [];
            const reserved = pendingOrders.reduce((acc, order) => {
              const item = order.items?.find(i => i.productId === product.id);
              return acc + (item ? item.quantity : 0);
            }, 0);

            const available = physicalStock - reserved;

            if (physicalStock <= 0 && reserved <= 0) return null;

            return (
              <div key={product.id} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-lg" style={{ color: '#e2e8f0' }}>{product.name}</h4>
                  <div className="text-xs px-2 py-1 rounded" style={{ background: '#334155', color: '#94a3b8' }}>
                    Físico: <span style={{ color: 'white', fontWeight: 'bold' }}>{physicalStock}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center mb-2">
                  <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Reservado (Pedidos)</span>
                  <span className="font-bold text-lg" style={{ color: '#f59e0b' }}>{reserved}</span>
                </div>

                <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px dashed #334155' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Disponible</span>
                  <span className={`font-bold text-xl ${available < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {available}
                  </span>
                </div>
                
                {available < 0 && (
                  <div className="mt-3 text-xs font-bold p-2 rounded" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    ⚠️ Faltan {Math.abs(available)} tuppers
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      )}

      
      {harvestTab === 'cosechar' && (
      <>
      <div className="premium-card mt-6" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', overflow: 'hidden' }}>
        <h3 className="premium-card-title" style={{ margin: 0, padding: '1.25rem 1.5rem', background: 'linear-gradient(to right, #f8fafc, #ffffff)', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e293b', fontSize: '1.25rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🌱</span> Cultivos Listos para Cosechar
        </h3>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {(crops?.filter(c => c.status === 'READY' && (c.traysCount > 0 || c.trays > 0)) || []).map(crop => {
              const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
              const daysAlive = Math.floor((new Date() - new Date(crop.datePlanted || crop.plantedAt)) / (1000 * 60 * 60 * 24));
              
              return (
                <div key={crop.id} style={{ padding: '1.25rem', borderRadius: '12px', border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', position: 'relative', display: 'flex', flexDirection: 'column', gap: '1rem', transition: 'transform 0.2s, box-shadow 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(34, 197, 94, 0.2)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ margin: 0, fontWeight: '800', color: '#166534', fontSize: '1.1rem' }}>{cType?.name || 'Desconocido'}</h4>
                    <span style={{ backgroundColor: '#16a34a', color: 'white', fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '6px', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.05em' }}>{crop.batchNumber || 'N/A'}</span>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: '#15803d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #bbf7d0', paddingBottom: '0.25rem' }}>
                      <strong>Bandejas cultivadas:</strong> <span>{crop.traysCount} unds</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>Días de crecimiento:</strong> <span>{daysAlive} días</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => openHarvestModalForCrop(crop)}
                    style={{ marginTop: 'auto', width: '100%', backgroundColor: '#16a34a', color: 'white', fontWeight: 'bold', padding: '0.75rem', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s, transform 0.1s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#15803d'}
                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#16a34a'}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'none'}
                  >
                    <span>✂️</span> Cortar y Envasar
                  </button>
                </div>
              );
            })}
          </div>
          {(crops?.filter(c => c.status === 'LIGHT' || c.status === 'READY') || []).length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>🌱</div>
              <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0, fontWeight: '500' }}>No hay cultivos en fase de crecimiento actualmente.</p>
            </div>
          )}
        </div>
      </div>

      <div className="premium-card mt-6" style={{ background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden', marginTop: '2rem' }}>
        <h3 className="premium-card-title" style={{ margin: 0, padding: '1.25rem 1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e293b', fontSize: '1.25rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🏷️</span> Histórico de Ventas
        </h3>
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {harvests?.slice().reverse().map(h => {
              const product = products?.find(p => p.id === h.productId);
              const harvestCrops = crops?.filter(c => h.selectedCropIds?.includes(c.id)) || [];
              
              return (
                <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1', transition: 'background-color 0.2s, border-color 0.2s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: '800', fontSize: '1.15rem', color: '#0f172a' }}>{product?.name || 'Desconocido'}</span>
                      <span style={{ fontSize: '0.75rem', backgroundColor: '#dcfce7', color: '#166534', padding: '0.25rem 0.6rem', borderRadius: '999px', fontFamily: 'monospace', fontWeight: 'bold', border: '1px solid #bbf7d0' }}>Lote: {h.batchNumber}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', color: '#64748b' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>📅 Fecha: <strong style={{ color: '#334155' }}>{new Date(h.harvestDate).toLocaleDateString()}</strong></span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>📦 Vendidos/Envasados: <strong style={{ color: '#334155' }}>{h.tuppersCount} tuppers</strong></span>
                    </div>
                    
                    {harvestCrops.length > 0 && (
                      <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#e2e8f0', borderRadius: '8px', fontSize: '0.85rem', color: '#475569' }}>
                        <strong style={{ display: 'block', marginBottom: '0.25rem', color: '#1e293b' }}>🌱 Composición (Lotes de Semilla):</strong>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                          {harvestCrops.map(c => {
                            const cType = cropTypes?.find(ct => ct.id === c.cropTypeId || ct.id === c.seedId);
                            return (
                              <li key={c.id}>
                                {cType?.name || 'Variedad'}: <strong style={{ color: '#0f172a' }}>{c.batchNumber || 'SIN LOTE'}</strong>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                    
                  </div>
                  <button 
                    style={{ backgroundColor: 'white', border: '1px solid #cbd5e1', padding: '0.75rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s', marginLeft: '1rem' }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.backgroundColor = 'white'; }}
                    onClick={() => generateLabelPDF(product?.name || '', h.batchNumber, product?.shelfLifeDays || 10, h.tuppersCount)}
                  >
                    <span>🖨️</span> Re-Imprimir PDF
                  </button>
                </div>
              )
            })}
            {(!harvests || harvests.length === 0) && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                No hay cosechas registradas.
              </div>
            )}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );

  const getCycleEventsForCrop = (cType, harvestTargets) => {
    const events = [];
    const targets = harvestTargets?.filter(t => t.productId == cType.id) || [];
    
    targets.forEach(ht => {
      const sowDay = ht.targetDayOfWeek;
      let currentDayOffset = 0;
      
      // Soaking
      const hasSoak = Number(cType.soakingHours) > 0;
      if (hasSoak) {
        currentDayOffset += 1;
        events.push({
          type: 'soak',
          icon: '💧',
          color: '#3b82f6',
          dayOfWeek: (sowDay + currentDayOffset) % 7,
          weekOffset: Math.floor((sowDay + currentDayOffset) / 7),
          fromSowDay: sowDay
        });
      }
      
      // Germination (starts either after soak, or immediately on sowDay + germination offset?)
      // Wait, germDay in previous logic was just the day after soaking. 
      // Actually, germination starts immediately. If there is soaking, soaking takes 1 day, then germination starts?
      // Yes, currentDayOffset holds the start of the current phase.
      const germDayOfWeek = (sowDay + currentDayOffset) % 7;
      const germWeek = Math.floor((sowDay + currentDayOffset) / 7);
      events.push({
        type: 'germ',
        icon: '🌱',
        color: '#c026d3', // Fuchsia
        dayOfWeek: germDayOfWeek,
        weekOffset: germWeek,
        fromSowDay: sowDay
      });
      
      // Darkness
      currentDayOffset += Number(cType.germinationDays) || 0;
      const hasDarkness = Number(cType.darknessDays) > 0;
      if (hasDarkness) {
        events.push({
          type: 'dark',
          icon: '🌑',
          color: '#475569',
          dayOfWeek: (sowDay + currentDayOffset) % 7,
          weekOffset: Math.floor((sowDay + currentDayOffset) / 7),
          fromSowDay: sowDay
        });
      }
      
      // Light
      currentDayOffset += Number(cType.darknessDays) || 0;
      events.push({
        type: 'light',
        icon: '☀️',
        color: '#eab308',
        dayOfWeek: (sowDay + currentDayOffset) % 7,
        weekOffset: Math.floor((sowDay + currentDayOffset) / 7),
        fromSowDay: sowDay
      });
      
      // Harvest
      currentDayOffset += Number(cType.lightDays) || 0;
      events.push({
        type: 'harvest',
        icon: '✂️',
        color: '#10b981',
        dayOfWeek: (sowDay + currentDayOffset) % 7,
        weekOffset: Math.floor((sowDay + currentDayOffset) / 7),
        fromSowDay: sowDay
      });
    });
    
    return events;
  };

  const handleCellClick = (cType, dayIndex) => {
    const existing = harvestTargets?.find(ht => ht.productId == cType.id && ht.targetDayOfWeek == dayIndex);
    const dayNames = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    if (existing) {
      Swal.fire({
        title: 'Modificar Rutina',
        html: `¿Cuántas bandejas quieres sembrar de <b>${cType.name}</b> los <b>${dayNames[dayIndex]}</b>?`,
        input: 'number',
        inputValue: existing.tuppersCount,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonColor: '#059669',
        denyButtonColor: '#ef4444',
        confirmButtonText: 'Actualizar',
        denyButtonText: 'Eliminar Siembra',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed && result.value > 0) {
          updateHarvestTarget(existing.id, { tuppersCount: Number(result.value) });
        } else if (result.isDenied || (result.isConfirmed && result.value <= 0)) {
          deleteHarvestTarget(existing.id);
        }
      });
    } else {
      Swal.fire({
        title: 'Nueva Siembra Semanal',
        html: `¿Cuántas bandejas quieres sembrar de <b>${cType.name}</b> los <b>${dayNames[dayIndex]}</b>?`,
        input: 'number',
        inputValue: 1,
        showCancelButton: true,
        confirmButtonColor: '#059669',
        confirmButtonText: 'Añadir Rutina',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed && result.value > 0) {
          addHarvestTarget({
            productId: cType.id,
            targetDayOfWeek: dayIndex,
            tuppersCount: Number(result.value)
          });
        }
      });
    }
  };

  const renderPlanificador = () => {
    console.log("harvestTargets state:", harvestTargets);
    const tableDays = [
      { idx: 1, name: 'Lunes', short: 'Lun' },
      { idx: 2, name: 'Martes', short: 'Mar' },
      { idx: 3, name: 'Miércoles', short: 'Mié' },
      { idx: 4, name: 'Jueves', short: 'Jue' },
      { idx: 5, name: 'Viernes', short: 'Vie' },
      { idx: 6, name: 'Sábado', short: 'Sáb' },
      { idx: 0, name: 'Domingo', short: 'Dom' }
    ];

    return (
      <div>
        <div style={{ background: 'linear-gradient(135deg, #f0fdf4, #ccfbf1)', border: '1px solid #99f6e4', padding: '2rem', borderRadius: '20px', marginBottom: '2rem' }}>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', fontWeight: 900, color: '#065f46' }}>Planificador Semanal de Siembra</h2>
          <p style={{ margin: 0, color: '#047857', fontSize: '1.1rem', fontWeight: 500, lineHeight: 1.5 }}>
            Haz clic en cualquier celda para añadir o modificar la cantidad de bandejas a sembrar. Las fases del ciclo se distribuirán automáticamente en los días correspondientes.
          </p>
        </div>

        <div style={{ overflowX: 'auto', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', padding: '1.5rem', marginBottom: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #e2e8f0', color: '#475569', width: '200px' }}>Variedad</th>
                {tableDays.map(d => (
                  <th key={d.idx} style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #e2e8f0', color: '#475569', fontWeight: 800 }}>{d.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cropTypes?.map(cType => {
                const cropEvents = getCycleEventsForCrop(cType, harvestTargets);

                return (
                  <tr key={cType.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem', fontWeight: 700, color: '#1e293b' }}>{cType.name}</td>
                    {tableDays.map(d => {
                      const ht = harvestTargets?.find(t => t.productId == cType.id && t.targetDayOfWeek == d.idx);
                      const eventsToday = cropEvents.filter(e => e.dayOfWeek === d.idx);
                      
                      return (
                        <td key={d.idx} style={{ padding: '0.5rem', verticalAlign: 'top', height: '100%' }}>
                          <div 
                            onClick={() => handleCellClick(cType, d.idx)}
                            style={{
                              height: '100%',
                              minHeight: '90px',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'flex-start',
                              padding: '0.5rem',
                              transition: 'all 0.2s ease',
                              border: ht ? '2px solid #10b981' : '2px dashed #cbd5e1',
                              background: ht ? '#f0fdf4' : (eventsToday.length > 0 ? '#f8fafc' : 'transparent'),
                              position: 'relative'
                            }}
                            onMouseEnter={e => {
                              if (!ht) e.currentTarget.style.borderColor = '#94a3b8';
                              e.currentTarget.style.transform = 'scale(1.02)';
                            }}
                            onMouseLeave={e => {
                              if (!ht) e.currentTarget.style.borderColor = '#cbd5e1';
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            {ht ? (
                              <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#059669', marginBottom: '0.5rem', background: '#d1fae5', padding: '2px 8px', borderRadius: '12px' }}>
                                📥 Siembra: {ht.tuppersCount}
                              </div>
                            ) : (
                              eventsToday.length === 0 && <div style={{ color: '#cbd5e1', fontSize: '1.5rem', fontWeight: 900, opacity: 0.5 }}>+</div>
                            )}

                            {eventsToday.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
                                {eventsToday.map((ev, i) => {
                                  const sourceDay = tableDays.find(td => td.idx === ev.fromSowDay)?.short || '';
                                  const weekStr = ev.weekOffset > 0 ? ` (+${ev.weekOffset}s)` : '';
                                  return (
                                    <div key={i} style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '4px', 
                                      fontSize: '0.75rem', 
                                      color: ev.color, 
                                      fontWeight: ev.type === 'harvest' || ev.type === 'germ' ? 'bold' : 'normal',
                                      background: 'white',
                                      padding: '2px 6px',
                                      borderRadius: '6px',
                                      border: `1px solid ${ev.color}40`,
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}>
                                      <span>{ev.icon}</span>
                                      <span>de {sourceDay}{weekStr}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

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
            <EmployeeTasks onTaskAction={(task) => { if (task.type === 'plant') { setNewCrop(prev => ({ ...prev, cropTypeId: task.cropTypeId, traysCount: task.trays || 1, selectedSeedBatchId: '' })); setIsSowModalOpen(true); } else if (task.type === 'harvest') { setIsHarvestModalOpen(true); } }} />
          </div>
        )}
        {activeTab === 'lotes' && renderLotes()}
        {activeTab === 'cosechas' && renderCosechas()}
        {activeTab === 'planificador' && renderPlanificador()}
        {activeTab === 'historial' && renderHistorial()}
        {activeTab === 'pedidos' && renderPedidos()}
        {activeTab === 'stock' && <Supplies />}
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
                              <option key={b.batchNumber} value={b.batchNumber}>{b.batchNumber} ({b.quantity.toFixed(2)} g disponibles)</option>
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
                  <select className="premium-input w-full" style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc' }} required value={newHarvest.productId} onChange={e => handleProductSelect(e.target.value)}>
                    <option value="">-- Seleccionar Producto --</option>
                    {(() => {
                      const selectedIds = Object.keys(newHarvest.selectedCropUsages);
                      let availableProducts = products || [];
                      
                      // Filtro Inteligente: Si hay cultivos pre-seleccionados, solo mostramos productos compatibles
                      if (selectedIds.length > 0) {
                        const neededSeedIds = new Set();
                        selectedIds.forEach(cid => {
                          const c = crops?.find(x => x.id === cid);
                          const sId = c?.seedId || cropTypes?.find(ct => ct.id === c?.cropTypeId)?.seedId;
                          if (sId) neededSeedIds.add(sId);
                        });
                        
                        availableProducts = availableProducts.filter(p => {
                          if (!p.recipeSeeds) return false;
                          const productSeedIds = p.recipeSeeds.map(rs => rs.seedId);
                          // El producto debe contener al menos todas las semillas pre-seleccionadas
                          return Array.from(neededSeedIds).every(sId => productSeedIds.includes(sId));
                        });
                      }

                      return availableProducts.map(p => <option key={p.id} value={p.id}>{p.name} {p.isMix ? '(Mix)' : ''}</option>);
                    })()}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 block">
                    2. Selecciona las bandejas que vas a cortar:
                  </label>
                  <div className="max-h-64 overflow-y-auto border border-slate-300 rounded-lg p-2 bg-slate-50 flex flex-col gap-3 custom-scrollbar">
                    {(() => {
                      const harvestProduct = products?.find(p => p.id === newHarvest.productId);
                      if (!harvestProduct) return <p className="text-slate-500 text-sm text-center py-4 bg-white rounded border border-dashed">Selecciona un producto arriba para ver las bandejas compatibles.</p>;

                      const hasRecipe = harvestProduct.recipeSeeds && harvestProduct.recipeSeeds.length > 0;
                      const allowedSeedIds = hasRecipe ? harvestProduct.recipeSeeds.map(rs => rs.seedId) : [];

                      let availableCrops = crops?.filter(c => c.status === 'READY' && (c.traysCount > 0 || c.trays > 0)) || [];
                      
                      // Filter by recipe if it has one
                      if (hasRecipe) {
                        availableCrops = availableCrops.filter(c => {
                          const actualSeedId = c.seedId || cropTypes?.find(ct => ct.id === c.cropTypeId)?.seedId;
                          return allowedSeedIds.includes(actualSeedId);
                        });
                      }

                      if (availableCrops.length === 0) {
                        return <p className="text-slate-500 text-sm text-center py-2">No hay cultivos listos para las variedades requeridas.</p>;
                      }

                      // Group by variety
                      const grouped = {};
                      availableCrops.forEach(crop => {
                        const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
                        const name = cType?.name || 'Desconocido';
                        if (!grouped[name]) grouped[name] = [];
                        grouped[name].push(crop);
                      });

                      return Object.entries(grouped).map(([varietyName, varietyCrops]) => (
                        <div key={varietyName} className="bg-white border border-slate-200 rounded p-2">
                          <h4 className="font-bold text-sm text-indigo-700 mb-2 border-b pb-1">{varietyName}</h4>
                          <div className="flex flex-col gap-2">
                            {varietyCrops.map(crop => {
                              const consumed = newHarvest.selectedCropUsages[crop.id] || 0;
                              const currentTrays = crop.traysCount !== undefined ? crop.traysCount : crop.trays;
                              return (
                                <div key={crop.id} className={`flex items-center justify-between gap-3 p-3 rounded border transition-colors ${consumed > 0 ? 'bg-indigo-50 border-indigo-300' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                  <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="font-semibold text-slate-700 text-sm">Lote: <span className="font-mono bg-white border px-2 py-0.5 rounded text-indigo-700">{crop.batchNumber}</span></span>
                                      <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded border">Disp: <strong className="text-slate-700">{currentTrays}</strong> uds</span>
                                    </div>
                                    <div className="text-xs text-slate-500">Cultivado hace {Math.floor((new Date() - new Date(crop.datePlanted || crop.plantedAt)) / (1000 * 60 * 60 * 24))} días</div>
                                  </div>
                                  
                                  <div className="flex flex-col items-end gap-1 border-l pl-3">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">A Cortar</span>
                                    <input 
                                      type="number"
                                      min="0"
                                      max={currentTrays}
                                      value={consumed}
                                      onChange={(e) => {
                                        let val = parseInt(e.target.value) || 0;
                                        if (val > crop.traysCount) val = crop.traysCount;
                                        if (val < 0) val = 0;
                                        setNewHarvest(prev => ({
                                          ...prev,
                                          selectedCropUsages: { ...prev.selectedCropUsages, [crop.id]: val }
                                        }));
                                      }}
                                      className="w-16 p-1 text-center border border-slate-300 rounded focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
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

{showPhaseChangeModal && (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#0f172a', margin: 0 }}>Ajustar Fase de Cultivo</h3>
              <button onClick={() => { setShowPhaseChangeModal(null); setPendingPhase(null); }} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            <p style={{ marginBottom: '1.5rem', color: '#475569', fontSize: '0.95rem' }}>
              Selecciona la fase a la que deseas mover este lote y pulsa Aplicar. Los días de crecimiento se sincronizarán automáticamente con la ficha de cultivo.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {(() => {
                const cType = cropTypes?.find(c => c.id === showPhaseChangeModal.seedId || c.id === showPhaseChangeModal.cropTypeId);
                const availablePhases = [];
                if (cType) {
                  if (parseInt(cType.soakDays) > 0) availablePhases.push('SOAKING');
                  if (parseInt(cType.germinationDays) > 0) availablePhases.push('GERMINATING');
                  if (parseInt(cType.darknessDays) > 0) availablePhases.push('DARKNESS');
                  if (parseInt(cType.lightDays) > 0) availablePhases.push('LIGHT');
                } else {
                  availablePhases.push('SOAKING', 'GERMINATING', 'DARKNESS', 'LIGHT');
                }
                availablePhases.push('READY');
                
                return availablePhases.map(phase => {
                  const isCurrent = pendingPhase === phase;
                  const isActual = (showPhaseChangeModal.status || 'SOWED') === phase;
                  let cTheme = { bg: 'white', border: '#cbd5e1', text: '#334155', tagBg: '#94a3b8' };
                  
                  if (phase === 'SOAKING') cTheme = { bg: '#dbeafe', border: '#3b82f6', text: '#1e3a8a', tagBg: '#3b82f6' };
                  else if (phase === 'GERMINATING') cTheme = { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', tagBg: '#f59e0b' };
                  else if (phase === 'DARKNESS') cTheme = { bg: '#e0e7ff', border: '#4f46e5', text: '#3730a3', tagBg: '#4f46e5' };
                  else if (phase === 'LIGHT') cTheme = { bg: '#ccfbf1', border: '#14b8a6', text: '#0f766e', tagBg: '#14b8a6' };
                  else if (phase === 'READY') cTheme = { bg: '#dcfce7', border: '#22c55e', text: '#166534', tagBg: '#22c55e' };

                  return (
                    <button 
                      key={phase} 
                      onClick={() => setPendingPhase(phase)}
                      style={{ 
                        padding: '1rem', 
                        border: isCurrent ? `2px solid ${cTheme.border}` : '1px solid #cbd5e1', 
                        borderRadius: '12px', 
                        textAlign: 'left', 
                        backgroundColor: isCurrent ? cTheme.bg : 'white', 
                        fontWeight: isCurrent ? 'bold' : 'normal',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transform: isCurrent ? 'scale(1.02)' : 'scale(1)'
                      }}
                    >
                      <span style={{ color: isCurrent ? cTheme.text : '#334155' }}>{translateStatus(phase)}</span>
                      {isActual && <span style={{ fontSize: '0.75rem', backgroundColor: '#64748b', color: 'white', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>Estado Actual</span>}
                    </button>
                  );
                });
              })()}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => { setShowPhaseChangeModal(null); setPendingPhase(null); }} style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}>
                Cancelar
              </button>
              <button 
                onClick={() => {
                  if (pendingPhase && pendingPhase !== (showPhaseChangeModal.status || 'SOWED')) {
                    setCropPhase(showPhaseChangeModal, pendingPhase);
                  }
                  setShowPhaseChangeModal(null);
                  setPendingPhase(null);
                }} 
                style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', backgroundColor: '#0f172a', color: 'white', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                Aplicar Cambio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </ErrorBoundary>
    );
}
