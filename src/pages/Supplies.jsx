import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { usePagination } from '../hooks/usePagination';

export default function Supplies() {
  const { 
    providers, 
    articles, addArticle, updateArticle, deleteArticle,
    stockEntries, addStockEntry, deleteStockEntry,
    cropTypes, addCropType, updateCropType, deleteCropType
  } = useData();

  const [activeTab, setActiveTab] = useState('INVENTORY');
  const [searchTerm, setSearchTerm] = useState('');

  // Expenses Filters
  const [expMonth, setExpMonth] = useState('');
  const [expType, setExpType] = useState('');
  const [expProvider, setExpProvider] = useState('');

  // Forms State
  const [newArticle, setNewArticle] = useState({ name: '', type: 'SEMILLA', minStock: 0 });
  const [editingArticleId, setEditingArticleId] = useState(null);
  const [editedArticle, setEditedArticle] = useState(null);
  const [editingCropTypeId, setEditingCropTypeId] = useState(null);
  const [editedCropType, setEditedCropType] = useState(null);
  const [newStockEntry, setNewStockEntry] = useState({ purchaseDate: new Date().toISOString().split('T')[0], deliveryNote: '', batchNumber: '', articleId: '', providerId: '', quantity: 1, price: 0 });
  
  const [newType, setNewType] = useState({
    name: '', seedId: '', seedGrams: 0, substrateId: '', substrateLiters: 0, containerId: '', expectedYieldGrams: 0, providerId: ''
  });

  // Modal States
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showCropTypeModal, setShowCropTypeModal] = useState(false);

  // Handlers
  const handleAddArticle = e => { 
    e.preventDefault(); 
    addArticle(newArticle); 
    setNewArticle({name:'', type:'SEMILLA', minStock: 0}); 
    setShowArticleModal(false);
  };
  
  const handleAddStockEntry = e => { 
    e.preventDefault(); 
    addStockEntry(newStockEntry); 
    setNewStockEntry({...newStockEntry, deliveryNote: '', batchNumber: '', providerId: '', quantity: 1, price: 0}); 
    setShowStockModal(false);
  };

  const handleAddCropType = e => {
    e.preventDefault();
    const payload = { ...newType };
    if (payload.providerId === '') payload.providerId = null;
    if (payload.substrateId === '') payload.substrateId = null;
    if (payload.containerId === '') payload.containerId = null;
    if (payload.seedId === '') payload.seedId = null;
    addCropType(payload);
    setNewType({ name: '', seedId: '', seedGrams: 0, substrateId: '', substrateLiters: 0, containerId: '', expectedYieldGrams: 0, providerId: '', soakingHours: 0, germinationDays: 0, darknessDays: 0, lightDays: 0 });
    setShowCropTypeModal(false);
  };

  // Filtration logic
  const filteredArticles = articles?.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.type.toLowerCase().includes(searchTerm.toLowerCase())) || [];
  const { currentData: paginatedArticles, currentPage: aPage, totalPages: aTotal, goToPage: aGo, nextPage: aNext, prevPage: aPrev } = usePagination(filteredArticles, 10);

  const filteredStock = stockEntries?.filter(entry => {
    const art = articles?.find(a => a.id === entry.articleId);
    return art?.name.toLowerCase().includes(searchTerm.toLowerCase()) || entry.deliveryNote?.toLowerCase().includes(searchTerm.toLowerCase()) || entry.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a,b) => new Date(b.purchaseDate) - new Date(a.purchaseDate)) || [];
  const filteredStockIn = filteredStock.filter(entry => Number(entry.quantity) > 0);
  const filteredStockOut = filteredStock.filter(entry => Number(entry.quantity) <= 0);
  const { currentData: paginatedStockIn, currentPage: siPage, totalPages: siTotal, goToPage: siGo, nextPage: siNext, prevPage: siPrev } = usePagination(filteredStockIn, 10);
  const { currentData: paginatedStockOut, currentPage: soPage, totalPages: soTotal, goToPage: soGo, nextPage: soNext, prevPage: soPrev } = usePagination(filteredStockOut, 10);

  const filteredTypes = cropTypes?.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())) || [];
  const { currentData: paginatedTypes, currentPage: tPage, totalPages: tTotal, goToPage: tGo, nextPage: tNext, prevPage: tPrev } = usePagination(filteredTypes, 10);

  // Expense History Logic
  const filteredExpenses = useMemo(() => {
    return stockEntries?.filter(entry => {
      const art = articles?.find(a => a.id === entry.articleId);
      const matchMonth = expMonth ? entry.purchaseDate.startsWith(expMonth) : true;
      const matchType = expType ? art?.type === expType : true;
      const matchProv = expProvider ? entry.providerId === expProvider : true;
      return matchMonth && matchType && matchProv;
    }).sort((a,b) => new Date(b.purchaseDate) - new Date(a.purchaseDate)) || [];
  }, [stockEntries, articles, expMonth, expType, expProvider]);

  const totalExpenseFiltered = filteredExpenses.reduce((acc, curr) => acc + Number(curr.price || 0), 0);
  const { currentData: paginatedExpenses, currentPage: ePage, totalPages: eTotal, goToPage: eGo, nextPage: eNext, prevPage: ePrev } = usePagination(filteredExpenses, 15);

  const getTypeLabel = (type) => {
    switch(type) {
      case 'SEMILLA': return '🌱 Semilla';
      case 'SUSTRATO': return '🪨 Sustrato';
      case 'ENVASE': return '📦 Envase';
      case 'OTRO': return '🏷️ Consumible (Stock)';
      case 'GASTO_FIJO': return '💸 Gasto Fijo General';
      case 'SUMINISTROS': return '⚡ Suministros (Luz, Agua)';
      case 'MANTENIMIENTO': return '🔧 Mantenimiento';
      case 'MARKETING': return '📢 Marketing / Software';
      case 'NOMINAS': return '👥 Nóminas / Personal';
      default: return type;
    }
  };

  const getUnitLabel = (type) => {
    switch(type) {
      case 'SEMILLA': return 'Gramos';
      case 'SUSTRATO': return 'Litros';
      case 'GASTO_FIJO':
      case 'SUMINISTROS':
      case 'MANTENIMIENTO':
      case 'MARKETING':
      case 'NOMINAS': return 'Servicios / Pagos';
      default: return 'Unidades';
    }
  };

  // Cost calculation
  const getAverageUnitCost = (articleId, providerId = null) => {
    if (!articleId) return 0;
    let entries = stockEntries?.filter(e => e.articleId === articleId) || [];
    if (providerId) {
      const providerEntries = entries.filter(e => e.providerId === providerId);
      if (providerEntries.length > 0) entries = providerEntries;
    }
    if (entries.length === 0) return 0;
    
    const totalQty = entries.reduce((acc, curr) => acc + Number(curr.quantity), 0);
    const totalPrice = entries.reduce((acc, curr) => acc + Number(curr.price), 0);
    
    if (totalQty === 0) return 0;
    return totalPrice / totalQty;
  };

  const seeds = articles?.filter(a => a.type === 'SEMILLA') || [];
  const substrates = articles?.filter(a => a.type === 'SUSTRATO') || [];
  const containers = articles?.filter(a => a.type === 'ENVASE' || a.type === 'BANDEJA' || a.type === 'SUMINISTROS') || [];
  const selectedArticleType = newStockEntry.articleId ? articles?.find(a => a.id === newStockEntry.articleId)?.type : null;
  const isExpenseOnly = ['GASTO_FIJO', 'SUMINISTROS', 'MANTENIMIENTO', 'MARKETING', 'NOMINAS', 'BANDEJA'].includes(selectedArticleType);

  const getLiveCosts = (formData) => {
    if (!formData) return { totalTray: 0, perKg: 0 };
    const sCost = getAverageUnitCost(formData.seedId, formData.providerId) * Number(formData.seedGrams || 0);
    const subCost = getAverageUnitCost(formData.substrateId, formData.providerId) * Number(formData.substrateLiters || 0);
    const cCost = getAverageUnitCost(formData.containerId, formData.providerId) * 1;
    const totalTray = sCost + subCost + cCost;
    const expKg = Number(formData.expectedYieldGrams || 0) / 1000;
    const perKg = expKg > 0 ? totalTray / expKg : 0;
    return { totalTray, perKg };
  };

  const newTypeCosts = getLiveCosts(newType);
  const editTypeCosts = getLiveCosts(editedCropType);

  const getStockBalance = (article) => {
    if (['GASTO_FIJO', 'SUMINISTROS', 'MANTENIMIENTO', 'MARKETING', 'NOMINAS', 'BANDEJA'].includes(article.type)) {
      return '-';
    }
    // Total entradas
    const totalIn = stockEntries?.filter(e => e.articleId === article.id).reduce((acc, curr) => acc + Number(curr.quantity || 0), 0) || 0;
    // Nota: Aquí se restaría el consumo (crops) en el futuro
    return `${totalIn.toFixed(2)} ${getUnitLabel(article.type)}`;
  };

  const totalWarehouseValue = articles?.filter(a => !['GASTO_FIJO', 'SUMINISTROS', 'MANTENIMIENTO', 'MARKETING', 'NOMINAS', 'BANDEJA'].includes(a.type))
    .reduce((sum, a) => {
      const totalIn = stockEntries?.filter(e => e.articleId === a.id).reduce((acc, curr) => acc + Number(curr.quantity || 0), 0) || 0;
      const avgCost = getAverageUnitCost(a.id);
      return sum + (totalIn * avgCost);
    }, 0) || 0;

  // Modal Styles
  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
  const modalCardStyle = { width: '100%', maxWidth: '700px', margin: '20px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', border: '1px solid var(--color-border)' };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Cultivo</h2>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>Logística, compras, recetas y análisis de costes.</p>
        </div>
      </div>

      <div className="admin-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button className={`admin-tab ${activeTab === 'INVENTORY' ? 'active' : ''}`} onClick={() => setActiveTab('INVENTORY')}>Inventario (Stock)</button>
        <button className={`admin-tab ${activeTab === 'CATALOG' ? 'active' : ''}`} onClick={() => setActiveTab('CATALOG')}>Catálogo de Artículos</button>
        <button className={`admin-tab ${activeTab === 'STOCK' ? 'active' : ''}`} onClick={() => setActiveTab('STOCK')}>Albaranes de Entrada</button>
          <button className={`admin-tab ${activeTab === 'STOCK_OUT' ? 'active' : ''}`} onClick={() => setActiveTab('STOCK_OUT')}>Salidas / Consumos</button>
        <button className={`admin-tab ${activeTab === 'EXPENSES' ? 'active' : ''}`} onClick={() => setActiveTab('EXPENSES')}>Historial de Gastos</button>
        <button className={`admin-tab ${activeTab === 'CROP_TYPES_LIST' ? 'active' : ''}`} onClick={() => setActiveTab('CROP_TYPES_LIST')}>Fichas de Cultivo</button>
      </div>

      {activeTab !== 'EXPENSES' && (
        <div className="admin-toolbar">
          <div className="admin-search">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
      )}

      {activeTab === 'INVENTORY' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="flex justify-between items-center mb-4">
             <div>
               <h3 className="font-bold text-lg">Inventario Actual (Físico)</h3>
               <p className="text-muted text-sm">Resumen de semillas, sustratos y envases disponibles.</p>
             </div>
             <div className="text-right bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
               <p className="text-muted text-xs font-semibold mb-0 text-indigo-800">VALOR TOTAL ALMACÉN</p>
               <h3 className="font-bold text-2xl text-indigo-600 m-0">{totalWarehouseValue.toFixed(2)} €</h3>
             </div>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Artículo</th>
                  <th>Coste Medio</th>
                  <th>Stock Físico Actual</th>
                  <th>Valor Est. Almacén</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const inventoryGroups = [];
                  articles?.filter(a => !['GASTO_FIJO', 'SUMINISTROS', 'MANTENIMIENTO', 'MARKETING', 'NOMINAS', 'BANDEJA'].includes(a.type))
                    .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .forEach(a => {
                      const entries = stockEntries?.filter(e => e.articleId === a.id) || [];
                      const groups = {};
                      entries.forEach(e => {
                        const batch = e.batchNumber || 'SIN_LOTE';
                        if (!groups[batch]) groups[batch] = { article: a, batchNumber: batch, totalQuantity: 0, costSum: 0, count: 0, provIds: new Set() };
                        groups[batch].totalQuantity += Number(e.quantity || 0);
                        if (Number(e.price) > 0 && Number(e.quantity) > 0) {
                          groups[batch].costSum += (Number(e.price) / Number(e.quantity));
                          groups[batch].count++;
                        }
                        if (e.providerId && e.providerId !== 'INTERNAL' && Number(e.quantity) > 0) {
                          groups[batch].provIds.add(e.providerId);
                        }
                      });
                      
                      Object.values(groups).forEach(g => {
                        // Rounding to avoid floating point issues
                        if (Math.abs(g.totalQuantity) > 0.001) {
                          inventoryGroups.push(g);
                        }
                      });
                    });

                  return inventoryGroups.map((g, idx) => {
                    const avgCost = g.count > 0 ? (g.costSum / g.count) : getAverageUnitCost(g.article.id);
                    const totalValue = g.totalQuantity * avgCost;
                    const provNames = Array.from(g.provIds).map(pid => providers?.find(p => p.id === pid)?.name || 'Desconocido').join(', ') || 'Varios / Sin Asignar';

                    return (
                      <tr key={`${g.article.id}-${g.batchNumber}-${idx}`}>
                        <td className="font-medium text-slate-500">{getTypeLabel(g.article.type)}</td>
                        <td className="font-bold text-slate-800">
                          {g.article.name}
                          <div className="text-xs text-slate-500 mt-1 font-normal">Lote: <span className="font-bold text-slate-700 bg-slate-100 px-1 rounded">{g.batchNumber}</span> | Prov: {provNames}</div>
                        </td>
                        <td className="text-slate-600">{avgCost.toFixed(2)} € / {getUnitLabel(g.article.type)}</td>
                        <td className="font-bold text-emerald-600 text-lg">{g.totalQuantity.toFixed(2)} <span className="text-sm font-normal text-slate-500">{getUnitLabel(g.article.type)}</span></td>
                        <td className="font-bold text-indigo-600">{totalValue.toFixed(2)} €</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'CATALOG' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-lg">Catálogo de Artículos y Consumibles</h3>
             <button className="btn btn-primary shadow-sm" onClick={() => setShowArticleModal(true)}>+ Nuevo Artículo</button>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)', color: '#64748b', textAlign: 'left' }}>
                  <th className="font-bold text-slate-700 pb-3 border-b">Tipo</th>
                  <th className="font-bold text-slate-700 pb-3 border-b">Artículo</th>
                  <th className="font-bold text-slate-700 pb-3 border-b">Stock Mínimo</th>
                  <th className="font-bold text-slate-700 pb-3 border-b text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedArticles.map(a => (
                  editingArticleId === a.id ? (
                    <tr key={a.id}>
                      <td>
                        <select className="form-control" value={editedArticle.type} onChange={e => setEditedArticle({...editedArticle, type: e.target.value})}>
                          <option value="SEMILLA">🌱 Semilla (Stock y Gasto)</option>
                          <option value="SUSTRATO">🟤 Sustrato (Stock y Gasto)</option>
                          <option value="ENVASE">📦 Envase / Bandeja (Stock y Gasto)</option>
                          <option value="OTRO">❓ Consumible (Stock y Gasto)</option>
                          <option value="BANDEJA">🔲 Bandeja Reutilizable (Sin Stock)</option>
                  <optgroup label="Gastos (Sin Stock)">
                            <option value="GASTO_FIJO">🏢 Gasto Fijo General</option>
                            <option value="SUMINISTROS">💧 Suministros (Luz, Agua, etc)</option>
                            <option value="MANTENIMIENTO">🔧 Reparaciones / Mantenimiento</option>
                            <option value="MARKETING">📢 Publicidad y Software</option>
                            <option value="NOMINAS">👥 Nóminas y Seguros Sociales</option>
                          </optgroup>
                        </select>
                      </td>
                      <td>
                        <input type="text" className="form-control" style={{ marginBottom: editedArticle.type === 'SEMILLA' ? '0.5rem' : '0' }} value={editedArticle.name} onChange={e => setEditedArticle({...editedArticle, name: e.target.value})} />
                        
                      </td>
                      <td>
                        {['SEMILLA', 'SUSTRATO', 'ENVASE', 'OTRO'].includes(editedArticle.type) ? (
                          <input type="number" min="0" className="form-control w-24" value={editedArticle.minStock || 0} onChange={e => setEditedArticle({...editedArticle, minStock: parseFloat(e.target.value) || 0})} />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => { updateArticle(a.id, editedArticle); setEditingArticleId(null); }}>Guardar</button>
                          <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent' }} onClick={() => setEditingArticleId(null)}>Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={a.id}>
                      <td className="font-medium text-slate-500">{getTypeLabel(a.type)}</td>
                      <td className="font-bold text-slate-800">{a.name}</td>
                      <td className="font-mono text-slate-600">{['SEMILLA', 'SUSTRATO', 'ENVASE', 'OTRO'].includes(a.type) ? (a.minStock || 0) : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent' }} onClick={() => { setEditingArticleId(a.id); setEditedArticle(a); }}>Editar</button>
                          <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }} onClick={() => deleteArticle(a.id)}>Borrar</button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
          {aTotal > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={aPrev} disabled={aPage === 1}>&lt; Ant</button>
              {Array.from({ length: aTotal }, (_, i) => i + 1).map(page => (
                <button key={page} className={`page-btn ${aPage === page ? 'active' : ''}`} onClick={() => aGo(page)}>{page}</button>
              ))}
              <button className="page-btn" onClick={aNext} disabled={aPage === aTotal}>Sig &gt;</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'STOCK' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-lg">Registro de Albaranes de Entrada</h3>
               <button className="btn btn-primary shadow-sm" onClick={() => setShowStockModal(true)}>+ Nuevo Registro</button>
            </div>
  
            <div className="table-container mb-8">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Proveedor</th>
                    <th>Artículo</th>
                    <th>Factura/Albarán</th>
                    <th>Lote</th>
                    <th>Cantidad</th>
                    <th>Coste Total</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStockIn.map(entry => {
                    const art = articles?.find(a => a.id === entry.articleId);
                    return (
                      <tr key={entry.id}>
                        <td>{new Date(entry.purchaseDate || entry.date || entry.createdAt).toLocaleDateString()}</td>
                        <td className="text-muted">{providers?.find(p => p.id === entry.providerId)?.name || '-'}</td>
                        <td className="font-bold text-primary">{art ? getTypeLabel(art.type) + ' ' + art.name : 'Desconocido'}</td>
                        <td className="text-muted font-mono">{entry.deliveryNote || '-'}</td>
                        <td className="font-mono text-indigo-600">{entry.batchNumber || '-'}</td>
                        <td>{entry.quantity} {art ? getUnitLabel(art.type) : ''}</td>
                        <td className="font-bold text-red-600">{entry.price ? `${entry.price.toFixed(2)} €` : '-'}</td>
                        <td>
                          <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }} onClick={() => deleteStockEntry(entry.id)}>Borrar</button>
                        </td>
                      </tr>
                    )
                  })}
                  {paginatedStockIn.length === 0 && (
                    <tr><td colSpan="8" className="text-center text-slate-500 py-4">No hay albaranes de entrada.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {siTotal > 1 && (
              <div className="pagination mb-8">
                <button className="page-btn" onClick={siPrev} disabled={siPage === 1}>&lt; Ant</button>
                {Array.from({ length: siTotal }, (_, i) => i + 1).map(page => (
                  <button key={page} className={`page-btn ${siPage === page ? 'active' : ''}`} onClick={() => siGo(page)}>{page}</button>
                ))}
                <button className="page-btn" onClick={siNext} disabled={siPage === siTotal}>Sig &gt;</button>
              </div>
            )}

            
          </div>
        )}
  
        

        {activeTab === 'STOCK_OUT' && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
<div className="flex justify-between items-center mb-4">
               <h3 className="font-bold text-lg text-orange-700">Historial de Salidas / Consumos</h3>
            </div>
            <div className="table-container border-orange-200">
              <table className="admin-table">
                <thead>
                  <tr style={{ backgroundColor: '#fff7ed' }}>
                    <th>Fecha</th>
                    <th>Motivo</th>
                    <th>Artículo</th>
                    <th>Lote Sembrado</th>
                    <th>Cantidad Extraída</th>
                    <th>Coste</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStockOut.map(entry => {
                    const art = articles?.find(a => a.id === entry.articleId);
                    return (
                      <tr key={entry.id}>
                        <td>{new Date(entry.purchaseDate || entry.date || entry.createdAt).toLocaleDateString()}</td>
                        <td className="text-muted">{entry.notes || 'Consumo interno'}</td>
                        <td className="font-bold text-orange-600">{art ? getTypeLabel(art.type) + ' ' + art.name : 'Desconocido'}</td>
                        <td className="font-mono text-slate-600">{entry.batchNumber || '-'}</td>
                        <td className="font-bold text-red-500">{entry.quantity} {art ? getUnitLabel(art.type) : ''}</td>
                        <td className="text-muted">{entry.price ? `${entry.price.toFixed(2)} €` : '0.00 €'}</td>
                        <td>
                          <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }} onClick={() => deleteStockEntry(entry.id)}>Borrar</button>
                        </td>
                      </tr>
                    )
                  })}
                  {paginatedStockOut.length === 0 && (
                    <tr><td colSpan="7" className="text-center text-slate-500 py-4">No hay salidas registradas.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {soTotal > 1 && (
              <div className="pagination">
                <button className="page-btn" onClick={soPrev} disabled={soPage === 1}>&lt; Ant</button>
                {Array.from({ length: soTotal }, (_, i) => i + 1).map(page => (
                  <button key={page} className={`page-btn ${soPage === page ? 'active' : ''}`} onClick={() => soGo(page)}>{page}</button>
                ))}
                <button className="page-btn" onClick={soNext} disabled={soPage === soTotal}>Sig &gt;</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'EXPENSES' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="card" style={{ marginBottom: '1.5rem', background: '#f8fafc', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Mes de Gasto</label>
              <input type="month" className="form-control" style={{ padding: '0.3rem', height: 'auto' }} value={expMonth} onChange={e => setExpMonth(e.target.value)} />
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Tipo de Gasto</label>
              <select className="form-control" style={{ padding: '0.3rem', height: 'auto' }} value={expType} onChange={e => setExpType(e.target.value)}>
                <option value="">Todos los tipos</option>
                <option value="SEMILLA">Solo Semillas</option>
                <option value="SUSTRATO">Solo Sustratos</option>
                <option value="ENVASE">Solo Envases</option>
                <option value="GASTO_FIJO">Gastos Fijos</option>
                <option value="SUMINISTROS">Suministros</option>
                <option value="MANTENIMIENTO">Mantenimiento</option>
                <option value="MARKETING">Marketing</option>
                <option value="NOMINAS">Nóminas</option>
              </select>
            </div>
            <div>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>Proveedor</label>
              <select className="form-control" style={{ padding: '0.3rem', height: 'auto' }} value={expProvider} onChange={e => setExpProvider(e.target.value)}>
                <option value="">Todos los proveedores</option>
                {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Total Gastos (Filtrados)</p>
              <h3 className="text-2xl font-bold text-red-600" style={{ margin: 0 }}>{totalExpenseFiltered.toFixed(2)} €</h3>
            </div>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Concepto</th>
                  <th>Albarán/Fra</th>
                  <th style={{ textAlign: 'right' }}>Importe (€)</th>
                </tr>
              </thead>
              <tbody>
                {paginatedExpenses.map(entry => {
                  const art = articles?.find(a => a.id === entry.articleId);
                  return (
                    <tr key={entry.id}>
                      <td>{new Date(entry.purchaseDate).toLocaleDateString()}</td>
                      <td className="font-semibold text-slate-700">{providers?.find(p => p.id === entry.providerId)?.name || 'Sin Asignar'}</td>
                      <td>{art ? getTypeLabel(art.type) + ' - ' + art.name : 'Desconocido'}</td>
                      <td className="text-muted">{entry.deliveryNote || '-'}</td>
                      <td style={{ textAlign: 'right' }} className="font-bold text-red-500">{Number(entry.price || 0).toFixed(2)} €</td>
                    </tr>
                  )
                })}
                {paginatedExpenses.length === 0 && (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No hay gastos que coincidan con estos filtros.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {eTotal > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={ePrev} disabled={ePage === 1}>&lt; Ant</button>
              {Array.from({ length: eTotal }, (_, i) => i + 1).map(page => (
                <button key={page} className={`page-btn ${ePage === page ? 'active' : ''}`} onClick={() => eGo(page)}>{page}</button>
              ))}
              <button className="page-btn" onClick={eNext} disabled={ePage === eTotal}>Sig &gt;</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'CROP_TYPES_LIST' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-bold text-lg">Fichas de Cultivo</h3>
             <button className="btn btn-primary shadow-sm" onClick={() => setShowCropTypeModal(true)}>+ Nueva Ficha</button>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tipo de Cultivo</th>
                  <th>Proveedor (Semilla)</th>
                  <th>Receta (Semilla + Sustrato + Envase)</th>
                  <th>Coste Directo (Bandeja)</th>
                  <th>Rendimiento</th>
                  <th>Coste Producción (por Kg)</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTypes.map(c => {
                  const seedCost = getAverageUnitCost(c.seedId, c.providerId) * Number(c.seedGrams || 0);
                  const subCost = getAverageUnitCost(c.substrateId, c.providerId) * Number(c.substrateLiters || 0);
                  const contCost = getAverageUnitCost(c.containerId, c.providerId) * 1;
                  
                  const totalCost = seedCost + subCost + contCost;
                  const expectedKg = Number(c.expectedYieldGrams || 0) / 1000;
                  const costPerKg = expectedKg > 0 ? totalCost / expectedKg : 0;

                  return editingCropTypeId === c.id ? (
                    <tr key={c.id}>
                      <td colSpan="7" style={{ padding: '1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                          <div>
                            <label className="form-label text-sm">Nombre de la Ficha</label>
                            <input type="text" className="form-control" value={editedCropType.name} onChange={e => setEditedCropType({...editedCropType, name: e.target.value})} />
                          </div>
                          <div>
                            <label className="form-label text-sm">Proveedor Predilecto</label>
                            <select className="form-control" value={editedCropType.providerId || ''} onChange={e => setEditedCropType({...editedCropType, providerId: e.target.value})}>
                              <option value="">Cualquiera</option>
                              {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="form-label text-sm">Semilla</label>
                            <select className="form-control" value={editedCropType.seedId || ''} onChange={e => setEditedCropType({...editedCropType, seedId: e.target.value})}>
                              <option value="">Selecciona...</option>
                              {seeds.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="form-label text-sm">Gramos de Semilla</label>
                            <input type="number" step="0.1" min="0" className="form-control" value={editedCropType.seedGrams} onChange={e => setEditedCropType({...editedCropType, seedGrams: Number(e.target.value)})} />
                          </div>
                          <div>
                            <label className="form-label text-sm">Sustrato</label>
                            <select className="form-control" value={editedCropType.substrateId || ''} onChange={e => setEditedCropType({...editedCropType, substrateId: e.target.value})}>
                              <option value="">Ninguno</option>
                              {substrates.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="form-label text-sm">Litros de Sustrato</label>
                            <input type="number" step="0.1" min="0" className="form-control" value={editedCropType.substrateLiters} onChange={e => setEditedCropType({...editedCropType, substrateLiters: Number(e.target.value)})} />
                          </div>
                          <div>
                            <label className="form-label text-sm">Envase / Bandeja</label>
                            <select className="form-control" value={editedCropType.containerId || ''} onChange={e => setEditedCropType({...editedCropType, containerId: e.target.value})}>
                              <option value="">Selecciona...</option>
                              {containers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="form-label text-sm">Rendimiento Esperado (g)</label>
                            <input type="number" step="1" min="0" className="form-control" value={editedCropType.expectedYieldGrams} onChange={e => setEditedCropType({...editedCropType, expectedYieldGrams: Number(e.target.value)})} />
                          </div>
                          <div>
                            <label className="form-label text-sm">Remojo (h)</label>
                            <input type="number" min="0" className="form-control" value={editedCropType.soakingHours || ''} onChange={e => setEditedCropType({...editedCropType, soakingHours: parseFloat(e.target.value) || 0})} />
                          </div>
                          <div>
                            <label className="form-label text-sm">Germinación (d)</label>
                            <input type="number" min="0" className="form-control" value={editedCropType.germinationDays || ''} onChange={e => setEditedCropType({...editedCropType, germinationDays: parseFloat(e.target.value) || 0})} />
                          </div>
                          <div>
                            <label className="form-label text-sm">Oscuridad (d)</label>
                            <input type="number" min="0" className="form-control" value={editedCropType.darknessDays || ''} onChange={e => setEditedCropType({...editedCropType, darknessDays: parseFloat(e.target.value) || 0})} />
                          </div>
                          <div>
                            <label className="form-label text-sm">Luz (d)</label>
                            <input type="number" min="0" className="form-control" value={editedCropType.lightDays || ''} onChange={e => setEditedCropType({...editedCropType, lightDays: parseFloat(e.target.value) || 0})} />
                          </div>
                        </div>

                        <div style={{ marginTop: '1rem', padding: '1rem', background: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-around' }}>
                          <div style={{ textAlign: 'center' }}>
                            <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Coste por Bandeja</p>
                            <p className="font-bold text-amber-600 text-xl" style={{ margin: 0 }}>{editTypeCosts.totalTray.toFixed(2)} €</p>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <p className="text-muted" style={{ fontSize: '0.8rem', margin: 0 }}>Coste por Kg</p>
                            <p className="font-bold text-emerald-600 text-xl" style={{ margin: 0 }}>{editTypeCosts.perKg > 0 ? editTypeCosts.perKg.toFixed(2) : '-'} €</p>
                          </div>
                        </div>

                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <div className="flex gap-2">
                              <button className="btn btn-primary" onClick={() => { 
                                const payload = { ...editedCropType };
                                if (payload.providerId === '') payload.providerId = null;
                                if (payload.substrateId === '') payload.substrateId = null;
                                if (payload.containerId === '') payload.containerId = null;
                                if (payload.seedId === '') payload.seedId = null;
                                updateCropType(c.id, payload); 
                                setEditingCropTypeId(null); 
                              }}>Guardar Ficha</button>
                              <button className="btn btn-secondary" onClick={() => setEditingCropTypeId(null)}>Cancelar</button>
                            </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={c.id}>
                      <td className="font-bold text-slate-800">{c.name}</td>
                      <td className="text-muted">{providers?.find(p => p.id === c.providerId)?.name || 'Cualquiera'}</td>
                      <td className="text-sm text-slate-500">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span>🌱 {c.seedGrams}g ({seedCost.toFixed(2)}€)</span>
                          {Number(c.substrateLiters) > 0 && <span>🪨 {c.substrateLiters}L ({subCost.toFixed(2)}€)</span>}
                          <span>📦 1 ud ({contCost.toFixed(2)}€)</span>
                          <div style={{ marginTop: '0.5rem', background: '#f1f5f9', padding: '0.2rem 0.5rem', borderRadius: '4px', display: 'flex', gap: '0.5rem', fontSize: '0.75rem', width: 'fit-content' }}>
                            <span title="Remojo">💧 {c.soakingHours || 0}h</span>
                            <span title="Germinación">🌱 {c.germinationDays || 0}d</span>
                            <span title="Oscuridad">🌑 {c.darknessDays || 0}d</span>
                            <span title="Luz">☀️ {c.lightDays || 0}d</span>
                          </div>
                        </div>
                      </td>
                      <td className="font-bold text-amber-600 text-lg">
                        {totalCost.toFixed(2)} €
                      </td>
                      <td className="font-medium text-slate-600">
                        {c.expectedYieldGrams} g
                      </td>
                      <td>
                        {costPerKg > 0 ? (
                          <span className="font-bold text-emerald-600" style={{ background: '#ecfdf5', padding: '0.3rem 0.6rem', borderRadius: '4px' }}>
                            {costPerKg.toFixed(2)} €/Kg
                          </span>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent' }} onClick={() => { setEditingCropTypeId(c.id); setEditedCropType(c); }}>Editar</button>
                          <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }} onClick={() => deleteCropType(c.id)}>Borrar</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {tTotal > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={tPrev} disabled={tPage === 1}>&lt; Ant</button>
              {Array.from({ length: tTotal }, (_, i) => i + 1).map(page => (
                <button key={page} className={`page-btn ${tPage === page ? 'active' : ''}`} onClick={() => tGo(page)}>{page}</button>
              ))}
              <button className="page-btn" onClick={tNext} disabled={tPage === tTotal}>Sig &gt;</button>
            </div>
          )}
        </div>
      )}

      {/* --- MODALS --- */}
      
      {showArticleModal && (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <h3 className="font-bold mb-4 text-xl">Crear Artículo para el Almacén / Gasto</h3>
            <form onSubmit={handleAddArticle} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="form-label">Tipo de Artículo</label>
                <select className="form-control" value={newArticle.type} onChange={e => setNewArticle({...newArticle, type: e.target.value})}>
                  <option value="SEMILLA">🌱 Semilla (Stock y Gasto)</option>
                  <option value="SUSTRATO">🪨 Sustrato (Stock y Gasto)</option>
                  <option value="ENVASE">📦 Envase / Bandeja (Stock y Gasto)</option>
                  <option value="OTRO">🏷️ Consumible (Stock y Gasto)</option>
                  <option value="BANDEJA">🔲 Bandeja Reutilizable (Sin Stock)</option>
                  <optgroup label="Gastos (Sin Stock)">
                    <option value="GASTO_FIJO">💸 Gasto Fijo General</option>
                    <option value="SUMINISTROS">⚡ Suministros (Luz, Agua, etc)</option>
                    <option value="MANTENIMIENTO">🔧 Reparaciones / Mantenimiento</option>
                    <option value="MARKETING">📢 Publicidad y Software</option>
                    <option value="NOMINAS">👥 Nóminas y Seguros Sociales</option>
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="form-label">Nombre (Ej: Bandeja 1020, Recibo Luz, Semilla X)</label>
                <input required type="text" className="form-control" value={newArticle.name} onChange={e => setNewArticle({...newArticle, name: e.target.value})} />
              </div>
              {['SEMILLA', 'SUSTRATO', 'ENVASE', 'OTRO'].includes(newArticle.type) && (
                <div>
                  <label className="form-label">Stock de Seguridad (Aviso si baja de esta cantidad)</label>
                  <input type="number" min="0" className="form-control" value={newArticle.minStock} onChange={e => setNewArticle({...newArticle, minStock: parseFloat(e.target.value) || 0})} />
                </div>
              )}
              
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" className="btn btn-secondary" onClick={() => setShowArticleModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Añadir al Catálogo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStockModal && (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <h3 className="font-bold mb-4 text-xl">Registrar Albarán de Entrada / Gasto</h3>
            <form onSubmit={handleAddStockEntry} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', alignItems: 'start' }}>
              <div>
                <label className="form-label">Proveedor / Acreedor</label>
                <select required className="form-control" value={newStockEntry.providerId} onChange={e => setNewStockEntry({...newStockEntry, providerId: e.target.value})}>
                  <option value="">Selecciona...</option>
                  {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Fecha Factura/Albarán</label>
                <input required type="date" className="form-control" value={newStockEntry.purchaseDate} onChange={e => setNewStockEntry({...newStockEntry, purchaseDate: e.target.value})} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Artículo (Semilla, Luz...)</label>
                <select required className="form-control" value={newStockEntry.articleId} onChange={e => setNewStockEntry({...newStockEntry, articleId: e.target.value})}>
                  <option value="">Selecciona...</option>
                  {articles?.map(a => <option key={a.id} value={a.id}>{getTypeLabel(a.type)} - {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Nº Factura / Albarán</label>
                <input type="text" className="form-control" placeholder="Opcional" value={newStockEntry.deliveryNote} onChange={e => setNewStockEntry({...newStockEntry, deliveryNote: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Lote (Para Trazabilidad)</label>
                <input type="text" className="form-control" placeholder="Solo si aplica" disabled={isExpenseOnly} value={newStockEntry.batchNumber} onChange={e => setNewStockEntry({...newStockEntry, batchNumber: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Cant. ({selectedArticleType ? getUnitLabel(selectedArticleType) : 'Uds'})</label>
                <input required type="number" min="0.01" step="0.01" className="form-control" value={newStockEntry.quantity} onChange={e => setNewStockEntry({...newStockEntry, quantity: Number(e.target.value)})} />
              </div>
              <div>
                <label className="form-label">Coste Total (€)</label>
                <input required type="number" step="0.01" min="0" className="form-control" value={newStockEntry.price} onChange={e => setNewStockEntry({...newStockEntry, price: Number(e.target.value)})} />
              </div>
              
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowStockModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Entrada</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCropTypeModal && (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <h3 className="font-bold mb-4 text-xl">Nueva Ficha de Cultivo</h3>
            <form onSubmit={handleAddCropType} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Nombre de la Ficha (Ej: Rábano en Bandeja 1020)</label>
                <input required type="text" className="form-control" value={newType.name} onChange={e => setNewType({...newType, name: e.target.value})} />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Proveedor Predilecto (Opcional - Si quieres el coste específico de uno)</label>
                <select className="form-control" value={newType.providerId} onChange={e => setNewType({...newType, providerId: e.target.value})}>
                  <option value="">Indiferente / Cualquier Proveedor</option>
                  {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Seed Section */}
              <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', boxShadow: 'none', padding: '1.25rem' }}>
                <h4 className="font-semibold text-slate-700 mb-3">🌱 Semilla a utilizar</h4>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Seleccionar Semilla</label>
                  <select required className="form-control" value={newType.seedId} onChange={e => setNewType({...newType, seedId: e.target.value})}>
                    <option value="">Selecciona...</option>
                    {seeds.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Gramos por Bandeja</label>
                  <input required type="number" step="0.1" min="0" className="form-control" value={newType.seedGrams} onChange={e => setNewType({...newType, seedGrams: Number(e.target.value)})} />
                </div>
              </div>

                              {/* Cultivation Parameters Section */}
                <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', boxShadow: 'none', padding: '1.25rem', gridColumn: 'span 2' }}>
                  <h4 className="font-semibold text-slate-700 mb-3">⏱️ Parámetros de Ciclo</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    <div>
                      <label className="form-label">Remojo (h)</label>
                      <input type="number" min="0" className="form-control" value={newType.soakingHours || ''} onChange={e => setNewType({...newType, soakingHours: parseFloat(e.target.value) || 0})} />
                    </div>
                    <div>
                      <label className="form-label">Germinación (d)</label>
                      <input type="number" min="0" className="form-control" value={newType.germinationDays || ''} onChange={e => setNewType({...newType, germinationDays: parseFloat(e.target.value) || 0})} />
                    </div>
                    <div>
                      <label className="form-label">Oscuridad (d)</label>
                      <input type="number" min="0" className="form-control" value={newType.darknessDays || ''} onChange={e => setNewType({...newType, darknessDays: parseFloat(e.target.value) || 0})} />
                    </div>
                    <div>
                      <label className="form-label">Luz (d)</label>
                      <input type="number" min="0" className="form-control" value={newType.lightDays || ''} onChange={e => setNewType({...newType, lightDays: parseFloat(e.target.value) || 0})} />
                    </div>
                  </div>
                </div>
                
                {/* Substrate Section */}
              <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', boxShadow: 'none', padding: '1.25rem' }}>
                <h4 className="font-semibold text-slate-700 mb-3">🪨 Sustrato a utilizar</h4>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Seleccionar Sustrato</label>
                  <select className="form-control" value={newType.substrateId} onChange={e => setNewType({...newType, substrateId: e.target.value})}>
                    <option value="">Ninguno / Hidropónico</option>
                    {substrates.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Litros por Bandeja</label>
                  <input type="number" step="0.1" min="0" className="form-control" value={newType.substrateLiters} onChange={e => setNewType({...newType, substrateLiters: Number(e.target.value)})} />
                </div>
              </div>

              {/* Container and Yield Section */}
              <div className="card" style={{ gridColumn: 'span 2', background: '#f8fafc', border: '1px solid #e2e8f0', boxShadow: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1.25rem' }}>
                <div>
                  <label className="form-label">📦 Envase / Bandeja</label>
                  <select required className="form-control" value={newType.containerId} onChange={e => setNewType({...newType, containerId: e.target.value})}>
                    <option value="">Selecciona...</option>
                    {containers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">⚖️ Rendimiento Esperado (Gramos por Bandeja)</label>
                  <input required type="number" step="1" min="0" className="form-control" value={newType.expectedYieldGrams} onChange={e => setNewType({...newType, expectedYieldGrams: Number(e.target.value)})} />
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', padding: '1.25rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-around' }}>
                <div style={{ textAlign: 'center' }}>
                  <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>Coste Directo por Bandeja</p>
                  <p className="font-bold text-amber-600 text-2xl" style={{ margin: 0 }}>{newTypeCosts.totalTray.toFixed(2)} €</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p className="text-muted" style={{ fontSize: '0.9rem', margin: 0 }}>Coste de Producción por Kg</p>
                  <p className="font-bold text-emerald-600 text-2xl" style={{ margin: 0 }}>{newTypeCosts.perKg > 0 ? newTypeCosts.perKg.toFixed(2) : '-'} €</p>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCropTypeModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0 2rem' }}>Crear Ficha</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
