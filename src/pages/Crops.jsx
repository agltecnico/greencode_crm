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
  const [sowTab, setSowTab] = useState('activos');
  const [historySearch, setHistorySearch] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

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
        <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
          <div className="relative flex-1 min-w-[250px] max-w-md">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              🔍
            </span>
            <input 
              type="text" 
              placeholder="Buscar por lote o cultivo..." 
              className="premium-input w-full pl-10" 
              style={{ padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '12px', border: '1px solid #cbd5e1' }}
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
                    <tr key={crop.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' }} className="hover:bg-slate-50">
                      <td style={{ padding: '1.25rem 1.5rem', fontWeight: '600', color: '#0f172a' }}>{crop.batchNumber || 'N/A'}</td>
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs">
                            {(cType?.name || '?').charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-700">{cType?.name || 'Desconocido'}</span>
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
                <h3 className="text-xl font-bold mb-2">No hay resultados</h3>
                <p>No se encontraron cultivos en el historial que coincidan con tu búsqueda.</p>
              </div>
            )}
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
              <span className="text-sm text-slate-500">Mostrando {(historyPage - 1) * ITEMS_PER_PAGE + 1} a {Math.min(historyPage * ITEMS_PER_PAGE, filteredHistory.length)} de {filteredHistory.length} resultados</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setHistoryPage(p => Math.max(1, p - 1))} 
                  disabled={historyPage === 1}
                  className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-100 font-medium"
                >Anterior</button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button 
                      key={page} 
                      onClick={() => setHistoryPage(page)}
                      className={`w-8 h-8 rounded flex items-center justify-center font-medium ${historyPage === page ? 'bg-emerald-600 text-white' : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'}`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))} 
                  disabled={historyPage === totalPages}
                  className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-100 font-medium"
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
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-3xl font-black text-slate-800 tracking-tight">Gestión de Siembra</h2>
            <p className="text-slate-500 text-lg mt-1">Supervisa y planta nuevas bandejas</p>
          </div>
          <button onClick={() => setIsSowModalOpen(true)} className="btn hover:-translate-y-1 transition-transform shadow-lg shadow-emerald-600/30" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', padding: '0.875rem 1.5rem', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⊕</span> Registrar Siembra
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 bg-slate-100 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setSowTab('activos')}
            className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${sowTab === 'activos' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            🪴 Bandejas Activas ({activeCropsList.length})
          </button>
          <button 
            onClick={() => setSowTab('historico')}
            className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-all ${sowTab === 'historico' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
          >
            📖 Histórico de Siembras
          </button>
        </div>

        {isSowModalOpen && (
          <div style={modalOverlayStyle}>
            <div style={{ ...modalCardStyle, maxWidth: '500px', padding: 0, overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '1.5rem', color: 'white' }} className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg text-2xl">🌱</div>
                  <div>
                    <h3 className="font-bold text-xl m-0">Registrar Siembra</h3>
                    <p className="text-emerald-100 text-sm m-0">Añade nuevas bandejas al invernadero</p>
                  </div>
                </div>
                <button onClick={() => setIsSowModalOpen(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', opacity: 0.8 }} className="hover:opacity-100 transition-opacity">&times;</button>
              </div>
              <div style={{ padding: '2rem' }}>
                <form onSubmit={handleAddCrop} className="flex flex-col gap-5">
                  <div>
                    <label className="text-sm font-bold mb-2 block text-slate-700">1. ¿Qué vas a plantar?</label>
                    <select className="premium-input w-full" style={{ padding: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', background: '#f8fafc', fontSize: '1rem', fontWeight: '500' }} required value={newCrop.cropTypeId} onChange={e=>setNewCrop({...newCrop, cropTypeId: e.target.value, selectedSeedBatchId: ''})}>
                      <option value="">Selecciona una variedad...</option>
                      {cropTypes?.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  {selectedCropType && (
                    <div style={{ background: '#f0fdf4', padding: '1.25rem', borderRadius: '12px', border: '1px solid #bbf7d0', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <div className="text-2xl mt-1">📦</div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-green-800 block mb-1">Inventario Disponible</label>
                        <p className="text-xl font-black text-green-900 m-0">
                          {totalAvailableSeed.toFixed(2)} g 
                          {selectedCropType.seedGrams > 0 && <span className="text-sm font-semibold text-green-700 ml-2">(Max. {Math.floor(totalAvailableSeed / selectedCropType.seedGrams)} bandejas)</span>}
                        </p>
                        <p className="text-xs text-green-700 mt-1 leading-relaxed">El sistema descontará automáticamente {selectedCropType.seedGrams}g por cada bandeja empleando el método FIFO.</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-sm font-bold mb-2 block text-slate-700">2. ¿Cuántas bandejas son?</label>
                    <input type="number" required min="1" className="premium-input w-full text-center" style={{ padding: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1.5rem', fontWeight: '900', color: '#0f172a' }} value={newCrop.traysCount} onChange={e=>setNewCrop({...newCrop, traysCount: Number(e.target.value)})}/>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button type="button" onClick={() => setIsSowModalOpen(false)} className="flex-1 py-3 px-4 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors">Cancelar</button>
                    <button type="submit" className="flex-1 py-3 px-4 rounded-xl text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none' }} disabled={selectedCropType && totalAvailableSeed <= 0}>
                      {selectedCropType && totalAvailableSeed <= 0 ? 'Sin Semilla' : 'Confirmar Siembra'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {sowTab === 'activos' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {activeCropsList.map(crop => {
              const cType = cropTypes?.find(c => c.id === crop.seedId || c.id === crop.cropTypeId);
              const daysAlive = Math.floor((new Date() - new Date(crop.datePlanted || crop.plantedAt)) / (1000 * 60 * 60 * 24));
              const expectedDays = cType?.daysToHarvest || 14;
              const progressPercentage = Math.min(100, Math.max(0, (daysAlive / expectedDays) * 100));
              
              return (
                <div key={crop.id} className={`bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col`}>
                  <div className="p-5 border-b border-slate-100 flex justify-between items-start">
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center font-black text-xl border border-emerald-100">
                        {cType?.name ? cType.name.charAt(0).toUpperCase() : '🌱'}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg m-0">{cType?.name || 'Desconocido'}</h4>
                        <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full mt-1 inline-block border border-slate-200">{crop.batchNumber || 'N/A'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-emerald-600 block leading-none">{crop.traysCount}</span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Bandejas</span>
                    </div>
                  </div>
                  
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Estado</p>
                          <p className="font-bold text-slate-700 m-0">{translateStatus(crop.status)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Progreso</p>
                          <p className="font-black text-emerald-600 m-0 text-xl">{daysAlive >= 0 ? daysAlive : 0} <span className="text-sm text-slate-400 font-bold">/ {expectedDays} d</span></p>
                        </div>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: `${progressPercentage}%` }}></div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2">
                      <button onClick={() => discardCrop(crop)} className="flex-1 py-2 rounded-lg font-bold text-xs border border-red-200 text-red-600 hover:bg-red-50 transition-colors">
                        Descartar
                      </button>
                      <button onClick={() => advanceCropStatus(crop)} className="flex-[2] py-2 rounded-lg font-bold text-sm bg-slate-800 text-white hover:bg-slate-700 transition-colors shadow-md">
                        Avanzar Fase ⏭
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {activeCropsList.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-200">
                <div className="text-5xl mb-4 opacity-50">🪴</div>
                <h3 className="text-xl font-bold text-slate-700 mb-2">Invernadero Vacío</h3>
                <p className="text-slate-500 mb-6 text-center max-w-md">No tienes ninguna bandeja creciendo actualmente. Registra tu primera siembra para empezar.</p>
                <button onClick={() => setIsSowModalOpen(true)} className="btn btn-primary shadow-lg shadow-emerald-600/20" style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '12px', fontWeight: 'bold' }}>
                  Hacer una Siembra
                </button>
              </div>
            )}
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
    <div className="hub-container" style={{ padding: '2rem', animation: 'fadeIn 0.4s ease', maxWidth: '1000px', margin: '0 auto' }}>
      <div className="hub-header" style={{ marginBottom: '4rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h1 style={{ fontSize: '3rem', margin: '0 0 0.5rem 0', color: '#0f172a', fontWeight: '900', letterSpacing: '-0.05em' }}>Control de Cultivo</h1>
        <p style={{ color: '#64748b', fontSize: '1.25rem', margin: 0 }}>Selecciona tu zona de trabajo para gestionar el invernadero</p>
      </div>
      
      <div className="hub-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        <button onClick={() => setActiveTab('tareas')} className="hub-card crops-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', background: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)', transition: 'all 0.3s ease' }}>
          <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', margin: '0 0 0.5rem 0' }}>Tareas</h2>
            <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>Día / Semana / Mes</p>
          </div>
          <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#fef2f2', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>🎯</div>
        </button>

        <button onClick={() => setActiveTab('lotes')} className="hub-card tv-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', background: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)', transition: 'all 0.3s ease' }}>
          <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', margin: '0 0 0.5rem 0' }}>Siembra</h2>
            <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>Bandejas en curso</p>
          </div>
          <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#f0fdf4', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>🪴</div>
        </button>

        <button onClick={() => setActiveTab('cosechas')} className="hub-card admin-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', background: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)', transition: 'all 0.3s ease' }}>
          <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', margin: '0 0 0.5rem 0' }}>Cosecha</h2>
            <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>Envasado y etiquetas</p>
          </div>
          <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#f8fafc', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>🔪</div>
        </button>

        <button onClick={() => setActiveTab('planificador')} className="hub-card driver-card" style={{ border: 'none', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 1rem', background: 'white', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)', transition: 'all 0.3s ease' }}>
          <div className="hub-card-text" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b', margin: '0 0 0.5rem 0' }}>Planificador</h2>
            <p style={{ fontSize: '1rem', color: '#64748b', margin: 0 }}>Rutinas automáticas</p>
          </div>
          <div className="hub-card-icon" style={{ fontSize: '4rem', background: '#eff6ff', width: '80px', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>📅</div>
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
