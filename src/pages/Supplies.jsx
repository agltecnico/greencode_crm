import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { usePagination } from '../hooks/usePagination';
import { useAdminMode } from '../context/AdminModeContext';
import Swal from 'sweetalert2';

export default function Supplies() {
  const { 
    providers,
    seedVarieties, addSeedVariety, updateSeedVariety, deleteSeedVariety,
    articles, addArticle, updateArticle, deleteArticle,
    stockEntries, stockLots, purchaseDeliveryNotes, purchaseDeliveryNoteLines,
    receivePurchaseDeliveryNote, updatePurchaseDeliveryNote, deletePurchaseDeliveryNote,
    deleteStockEntry,
    cropTypes, addCropType, updateCropType, deleteCropType
  } = useData();
  const { isAdminMode, requireAdmin } = useAdminMode();

  const [activeTab, setActiveTab] = useState('INVENTORY');
  const [searchTerm, setSearchTerm] = useState('');

  // Expenses Filters
  const [expMonth, setExpMonth] = useState('');
  const [expType, setExpType] = useState('');
  const [expProvider, setExpProvider] = useState('');

  // Forms State
  const [newArticle, setNewArticle] = useState({ name: '', type: 'SEMILLA', minStock: 0, providerId: '', varietyId: '', unit: 'g', supplierReference: '' });
  const [newVariety, setNewVariety] = useState({ name: '', description: '' });
  const [editingVarietyId, setEditingVarietyId] = useState(null);
  const [editedVariety, setEditedVariety] = useState(null);
  const [editingArticleId, setEditingArticleId] = useState(null);
  const [editedArticle, setEditedArticle] = useState(null);
  const [editingCropTypeId, setEditingCropTypeId] = useState(null);
  const [editedCropType, setEditedCropType] = useState(null);
  const [newStockEntry, setNewStockEntry] = useState({ purchaseDate: new Date().toISOString().split('T')[0], deliveryNote: '', batchNumber: '', articleId: '', providerId: '', quantity: 1, price: 0 });
  const [purchaseLines, setPurchaseLines] = useState([]);
  
  const [newType, setNewType] = useState({
    name: '', varietyId: '', seedGrams: 0, substrateId: '', substrateLiters: 0, containerId: '', expectedYieldGrams: 0
  });

  // Modal States
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [showStockModal, setShowStockModal] = useState(false);
  const [showCropTypeModal, setShowCropTypeModal] = useState(false);
  const [isSavingStockEntry, setIsSavingStockEntry] = useState(false);
  const [editingPurchaseNoteId, setEditingPurchaseNoteId] = useState(null);

  const isWeightPurchase = article => article?.type === 'SEMILLA' || article?.unit === 'g';
  const purchasePriceLabel = article => {
    if (isWeightPurchase(article)) return 'Precio por kilo (€/kg)';
    if (article?.unit === 'l' || article?.type === 'SUSTRATO') return 'Precio por litro (€/l)';
    return 'Precio por unidad (€/ud)';
  };
  const purchasePriceFromLine = (article, line) =>
    Number(line?.unitCost || 0) * (isWeightPurchase(article) ? 1000 : 1);
  const purchaseTotalCost = (article, quantity, purchasePrice) =>
    Number(quantity || 0) * Number(purchasePrice || 0) / (isWeightPurchase(article) ? 1000 : 1);

  const resetPurchaseModal = () => {
    setEditingPurchaseNoteId(null);
    setNewStockEntry({
      purchaseDate: new Date().toISOString().split('T')[0],
      deliveryNote: '',
      batchNumber: '',
      articleId: '',
      providerId: '',
      quantity: 1,
      price: 0
    });
    setPurchaseLines([]);
  };

  const openNewPurchaseNote = () => {
    resetPurchaseModal();
    setShowStockModal(true);
  };

  const openEditPurchaseNote = noteId => {
    const note = purchaseDeliveryNotes?.find(item => item.id === noteId);
    if (!note) return;
    const lines = (purchaseDeliveryNoteLines || [])
      .filter(line => line.deliveryNoteId === noteId)
      .map(line => {
        const article = articles?.find(item => item.id === line.articleId);
        return {
          id: line.id,
          articleId: line.articleId,
          supplierBatch: line.supplierBatch,
          quantity: Number(line.quantity),
          totalCost: Number(line.totalCost),
          purchaseUnitPrice: purchasePriceFromLine(article, line)
        };
      });
    setEditingPurchaseNoteId(noteId);
    setNewStockEntry({
      purchaseDate: note.date,
      deliveryNote: note.number,
      batchNumber: '',
      articleId: '',
      providerId: note.providerId,
      quantity: 1,
      price: 0
    });
    setPurchaseLines(lines);
    setShowStockModal(true);
  };

  // Handlers
  const handleAddArticle = e => { 
    e.preventDefault(); 
    const payload = { ...newArticle, providerId: newArticle.providerId || null, varietyId: newArticle.type === 'SEMILLA' ? newArticle.varietyId : null };
    addArticle(payload);
    setNewArticle({name:'', type:'SEMILLA', minStock: 0, providerId: '', varietyId: '', unit: 'g', supplierReference: ''});
    setShowArticleModal(false);
  };

  const handleAddVariety = async e => {
    e.preventDefault();
    const created = await addSeedVariety({ name: newVariety.name.trim().toUpperCase(), description: newVariety.description.trim(), active: true });
    if (created) setNewVariety({ name: '', description: '' });
  };
  
  const handleAddStockEntry = async e => {
    e.preventDefault();
    if (isSavingStockEntry) return;
    setIsSavingStockEntry(true);
    try {
      const pendingLine = newStockEntry.articleId ? {
        articleId: newStockEntry.articleId,
        supplierBatch: newStockEntry.batchNumber,
        quantity: Number(newStockEntry.quantity),
        totalCost: purchaseTotalCost(
          articles?.find(item => item.id === newStockEntry.articleId),
          newStockEntry.quantity,
          newStockEntry.price
        ),
        purchaseUnitPrice: Number(newStockEntry.price)
      } : null;
      const lines = [...purchaseLines, ...(pendingLine ? [pendingLine] : [])];
      if (lines.length === 0) {
        await Swal.fire('Faltan artículos', 'Añade al menos un artículo al albarán.', 'warning');
        return;
      }
      const normalizedLines = lines.map(line => {
        const article = articles?.find(item => item.id === line.articleId);
        return {
          id: line.id,
          articleId: line.articleId,
          supplierBatch: line.supplierBatch,
          quantity: Number(line.quantity),
          totalCost: purchaseTotalCost(article, line.quantity, line.purchaseUnitPrice)
        };
      });
      const result = editingPurchaseNoteId
        ? await updatePurchaseDeliveryNote({
            id: editingPurchaseNoteId,
            number: newStockEntry.deliveryNote,
            date: newStockEntry.purchaseDate,
            lines: normalizedLines
          })
        : await receivePurchaseDeliveryNote({
            providerId: newStockEntry.providerId,
            number: newStockEntry.deliveryNote,
            date: newStockEntry.purchaseDate,
            notes: '',
            lines: normalizedLines
          });
      if (!result) return;
      const wasEditing = Boolean(editingPurchaseNoteId);
      resetPurchaseModal();
      setShowStockModal(false);
      await Swal.fire(
        wasEditing ? 'Albarán actualizado' : 'Entrada registrada',
        'El albarán, el lote, el stock restante y el coste de la referencia se han recalculado.',
        'success'
      );
    } finally {
      setIsSavingStockEntry(false);
    }
  };

  const addPurchaseLine = async () => {
    if (!newStockEntry.articleId) {
      await Swal.fire('Falta el artículo', 'Selecciona el artículo que quieres añadir.', 'warning');
      return;
    }
    if (Number(newStockEntry.quantity) <= 0) {
      await Swal.fire('Cantidad incorrecta', 'La cantidad debe ser mayor que cero.', 'warning');
      return;
    }
    if (!isExpenseOnly && !newStockEntry.batchNumber.trim()) {
      await Swal.fire('Falta el lote', 'Indica el lote del proveedor para mantener la trazabilidad.', 'warning');
      return;
    }
    setPurchaseLines(previous => [...previous, {
      id: crypto.randomUUID(),
      articleId: newStockEntry.articleId,
      supplierBatch: newStockEntry.batchNumber,
      quantity: Number(newStockEntry.quantity),
      totalCost: purchaseTotalCost(
        articles?.find(item => item.id === newStockEntry.articleId),
        newStockEntry.quantity,
        newStockEntry.price
      ),
      purchaseUnitPrice: Number(newStockEntry.price)
    }]);
    setNewStockEntry(previous => ({ ...previous, articleId: '', batchNumber: '', quantity: 1, price: 0 }));
  };

  const runAdminDelete = async (message, action) => {
    if (!(await requireAdmin())) return;
    const result = await Swal.fire({
      title: 'Acción de administrador',
      text: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, borrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626'
    });
    if (result.isConfirmed) await action();
  };

  const handleAddCropType = e => {
    e.preventDefault();
    const payload = { ...newType };
    payload.providerId = null;
    payload.seedId = null;
    if (payload.substrateId === '') payload.substrateId = null;
    if (payload.containerId === '') payload.containerId = null;
    addCropType(payload);
    setNewType({ name: '', varietyId: '', seedGrams: 0, substrateId: '', substrateLiters: 0, containerId: '', expectedYieldGrams: 0, soakingHours: 0, germinationDays: 0, darknessDays: 0, lightDays: 0 });
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
      case 'ETIQUETA': return '🏷️ Etiqueta';
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
    const article = articles?.find(a => a.id === articleId);
    if (article?.currentUnitCost != null && Number(article.currentUnitCost) >= 0) {
      return Number(article.currentUnitCost);
    }
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

  const getLatestVarietySeedCost = (varietyId) => {
    if (!varietyId) return 0;
    const seedArticleIds = new Set(
      (articles || [])
        .filter(article => article.type === 'SEMILLA' && article.varietyId === varietyId)
        .map(article => article.id)
    );
    const latestEntry = (stockEntries || [])
      .filter(entry =>
        seedArticleIds.has(entry.articleId) &&
        entry.purchaseDeliveryNoteId &&
        Number(entry.quantity) > 0
      )
      .sort((a, b) => {
        const aDate = new Date(a.purchaseDate || a.createdAt || 0).getTime();
        const bDate = new Date(b.purchaseDate || b.createdAt || 0).getTime();
        if (bDate !== aDate) return bDate - aDate;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      })[0];
    if (latestEntry) {
      const storedUnitCost = Number(latestEntry.unitCost);
      if (Number.isFinite(storedUnitCost) && storedUnitCost >= 0) return storedUnitCost;
      const quantity = Number(latestEntry.quantity);
      if (quantity > 0) return Number(latestEntry.price || 0) / quantity;
    }
    const linkedArticle = (articles || []).find(
      article => article.type === 'SEMILLA' && article.varietyId === varietyId
    );
    return Number(linkedArticle?.lastPurchaseUnitCost || 0);
  };

  const getLatestArticleUnitCost = (articleId) => {
    if (!articleId) return 0;
    const latestEntry = (stockEntries || [])
      .filter(entry =>
        entry.articleId === articleId &&
        entry.purchaseDeliveryNoteId &&
        Number(entry.quantity) > 0
      )
      .sort((a, b) => {
        const aDate = new Date(a.purchaseDate || a.createdAt || 0).getTime();
        const bDate = new Date(b.purchaseDate || b.createdAt || 0).getTime();
        if (bDate !== aDate) return bDate - aDate;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      })[0];
    if (latestEntry) {
      const storedUnitCost = Number(latestEntry.unitCost);
      if (Number.isFinite(storedUnitCost) && storedUnitCost >= 0) return storedUnitCost;
      const quantity = Number(latestEntry.quantity);
      if (quantity > 0) return Number(latestEntry.price || 0) / quantity;
    }
    const article = (articles || []).find(item => item.id === articleId);
    return Number(article?.lastPurchaseUnitCost || article?.currentUnitCost || 0);
  };

  const substrates = articles?.filter(a => a.type === 'SUSTRATO') || [];
  const containers = articles?.filter(a => a.type === 'ENVASE' || a.type === 'BANDEJA' || a.type === 'SUMINISTROS') || [];
  const selectedArticleType = newStockEntry.articleId ? articles?.find(a => a.id === newStockEntry.articleId)?.type : null;
  const isExpenseOnly = ['GASTO_FIJO', 'SUMINISTROS', 'MANTENIMIENTO', 'MARKETING', 'NOMINAS', 'BANDEJA'].includes(selectedArticleType);

  const getLiveCosts = (formData) => {
    if (!formData) return { totalTray: 0, perKg: 0, seedCostPerGram: 0, seedCostPerKg: 0, substrateUnitCost: 0, substrateCost: 0 };
    const varietyCost = getLatestVarietySeedCost(formData.varietyId);
    const sCost = varietyCost * Number(formData.seedGrams || 0);
    const substrateUnitCost = getLatestArticleUnitCost(formData.substrateId);
    const subCost = substrateUnitCost * Number(formData.substrateLiters || 0);
    const cCost = getAverageUnitCost(formData.containerId) * 1;
    const totalTray = sCost + subCost + cCost;
    const expKg = Number(formData.expectedYieldGrams || 0) / 1000;
    const perKg = expKg > 0 ? totalTray / expKg : 0;
    return {
      totalTray, perKg, seedCostPerGram: varietyCost, seedCostPerKg: varietyCost * 1000,
      substrateUnitCost, substrateCost: subCost
    };
  };

  const newTypeCosts = getLiveCosts(newType);
  const editTypeCosts = getLiveCosts(editedCropType);

  const totalWarehouseValue = articles?.filter(a => !['GASTO_FIJO', 'SUMINISTROS', 'MANTENIMIENTO', 'MARKETING', 'NOMINAS', 'BANDEJA'].includes(a.type))
    .reduce((sum, a) => {
      const totalIn = stockLots?.filter(l => l.articleId === a.id).reduce((acc, curr) => acc + Number(curr.remainingQuantity || 0), 0) || 0;
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
        <button className={`admin-tab ${activeTab === 'VARIETIES' ? 'active' : ''}`} onClick={() => setActiveTab('VARIETIES')}>Variedades</button>
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
                  const inventoryLots = (stockLots || [])
                    .filter(lot => Number(lot.remainingQuantity || 0) > 0.001)
                    .map(lot => ({ ...lot, article: articles?.find(article => article.id === lot.articleId) }))
                    .filter(lot => lot.article && !['GASTO_FIJO', 'SUMINISTROS', 'MANTENIMIENTO', 'MARKETING', 'NOMINAS', 'BANDEJA'].includes(lot.article.type))
                    .filter(lot => lot.article.name.toLowerCase().includes(searchTerm.toLowerCase()));

                  if (!inventoryLots.length) {
                    return <tr><td colSpan="5" className="text-center text-muted py-8">No hay existencias disponibles en el inventario.</td></tr>;
                  }

                  return inventoryLots.map(lot => {
                    const quantity = Number(lot.remainingQuantity || 0);
                    const avgCost = Number(lot.unitCost || getAverageUnitCost(lot.article.id));
                    const totalValue = quantity * avgCost;
                    const providerName = providers?.find(provider => provider.id === lot.providerId)?.name || 'Sin asignar';

                    return (
                      <tr key={lot.id}>
                        <td className="font-medium text-slate-500">{getTypeLabel(lot.article.type)}</td>
                        <td className="font-bold text-slate-800">
                          {lot.article.name}
                          <div className="text-xs text-slate-500 mt-1 font-normal">Lote: <span className="font-bold text-slate-700 bg-slate-100 px-1 rounded">{lot.supplierBatch || 'SIN_LOTE'}</span> | Prov: {providerName}</div>
                        </td>
                        <td className="text-slate-600">{avgCost.toFixed(2)} € / {getUnitLabel(lot.article.type)}</td>
                        <td className="font-bold text-emerald-600 text-lg">{quantity.toFixed(2)} <span className="text-sm font-normal text-slate-500">{getUnitLabel(lot.article.type)}</span></td>
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

      {activeTab === 'VARIETIES' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="premium-card mb-4">
            <h3 className="font-bold text-lg mb-2">Catálogo de variedades agronómicas</h3>
            <p className="text-muted text-sm mb-4">La variedad no depende del proveedor. Después se crea una referencia de compra por cada proveedor.</p>
            <form onSubmit={handleAddVariety} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input required className="premium-input" placeholder="Nombre (ej. RÁBANO RAMBO)" value={newVariety.name} onChange={e => setNewVariety({ ...newVariety, name: e.target.value })} />
              <input className="premium-input" placeholder="Descripción opcional" value={newVariety.description} onChange={e => setNewVariety({ ...newVariety, description: e.target.value })} />
              <button className="btn btn-primary" type="submit">+ Crear variedad</button>
            </form>
          </div>
          <div className="table-container">
            <table className="admin-table">
              <thead><tr><th>Variedad</th><th>Descripción</th><th>Estado</th><th>Acciones</th></tr></thead>
              <tbody>
                {seedVarieties?.map(variety => (
                  editingVarietyId === variety.id ? (
                    <tr key={variety.id}>
                      <td>
                        <input
                          required
                          className="premium-input w-full"
                          value={editedVariety.name}
                          onChange={e => setEditedVariety({ ...editedVariety, name: e.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          className="premium-input w-full"
                          value={editedVariety.description || ''}
                          onChange={e => setEditedVariety({ ...editedVariety, description: e.target.value })}
                          placeholder="Descripción opcional"
                        />
                      </td>
                      <td>
                        <select
                          className="premium-input w-full"
                          value={editedVariety.active === false ? 'INACTIVE' : 'ACTIVE'}
                          onChange={e => setEditedVariety({ ...editedVariety, active: e.target.value === 'ACTIVE' })}
                        >
                          <option value="ACTIVE">Activa</option>
                          <option value="INACTIVE">Inactiva</option>
                        </select>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-primary" onClick={async () => {
                            const name = editedVariety.name.trim().toUpperCase();
                            if (!name) {
                              await Swal.fire('Falta el nombre', 'La variedad debe tener un nombre.', 'warning');
                              return;
                            }
                            const result = await updateSeedVariety(variety.id, {
                              name,
                              description: editedVariety.description?.trim() || '',
                              active: editedVariety.active !== false
                            });
                            if (!result?.error) {
                              setEditingVarietyId(null);
                              setEditedVariety(null);
                            }
                          }}>Guardar</button>
                          <button className="btn btn-secondary" onClick={() => {
                            setEditingVarietyId(null);
                            setEditedVariety(null);
                          }}>Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={variety.id}>
                      <td className="font-bold">{variety.name}</td>
                      <td>{variety.description || '-'}</td>
                      <td>{variety.active === false ? 'Inactiva' : 'Activa'}</td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-secondary" onClick={() => {
                            setEditingVarietyId(variety.id);
                            setEditedVariety({ ...variety });
                          }}>Editar</button>
                          <button className="btn btn-secondary" onClick={() => updateSeedVariety(variety.id, { active: variety.active === false })}>
                            {variety.active === false ? 'Activar' : 'Desactivar'}
                          </button>
                          {isAdminMode && <button className="btn btn-danger" onClick={() => runAdminDelete('Solo se puede borrar si no tiene referencias, fichas o productos asociados.', () => deleteSeedVariety(variety.id))}>Eliminar</button>}
                        </div>
                      </td>
                    </tr>
                  )
                ))}
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
                        <select className="form-control" value={editedArticle.type} onChange={e => {
                          const type = e.target.value;
                          setEditedArticle({
                            ...editedArticle,
                            type,
                            unit: type === 'SEMILLA' ? 'g' : type === 'SUSTRATO' ? 'l' : 'ud',
                            varietyId: type === 'SEMILLA' ? editedArticle.varietyId : ''
                          });
                        }}>
                          <option value="SEMILLA">🌱 Semilla (Stock y Gasto)</option>
                          <option value="SUSTRATO">🟤 Sustrato (Stock y Gasto)</option>
                          <option value="ENVASE">📦 Envase / Bandeja (Stock y Gasto)</option>
                          <option value="ETIQUETA">🏷️ Etiqueta (Stock y Gasto)</option>
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
                        <div style={{ display: 'grid', gap: '0.5rem', minWidth: '260px' }}>
                          <input type="text" className="form-control" value={editedArticle.name} onChange={e => setEditedArticle({...editedArticle, name: e.target.value})} placeholder="Nombre del artículo" />
                          {['SEMILLA', 'SUSTRATO', 'ENVASE', 'ETIQUETA', 'OTRO'].includes(editedArticle.type) && (
                            <>
                              {editedArticle.type === 'SEMILLA' && (
                                <select className="form-control" value={editedArticle.varietyId || ''} onChange={e => setEditedArticle({...editedArticle, varietyId: e.target.value})}>
                                  <option value="">Selecciona variedad...</option>
                                  {seedVarieties?.filter(v => v.active !== false || v.id === editedArticle.varietyId).map(variety => (
                                    <option key={variety.id} value={variety.id}>{variety.name}</option>
                                  ))}
                                </select>
                              )}
                              <select className="form-control" value={editedArticle.providerId || ''} onChange={e => setEditedArticle({...editedArticle, providerId: e.target.value})}>
                                <option value="">Selecciona proveedor...</option>
                                {providers?.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                              </select>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: '0.5rem' }}>
                                <input type="text" className="form-control" value={editedArticle.supplierReference || ''} onChange={e => setEditedArticle({...editedArticle, supplierReference: e.target.value})} placeholder="Referencia proveedor" />
                                <select className="form-control" value={editedArticle.unit || 'ud'} onChange={e => setEditedArticle({...editedArticle, unit: e.target.value})}>
                                  <option value="g">Gramos</option>
                                  <option value="kg">Kilogramos</option>
                                  <option value="l">Litros</option>
                                  <option value="ud">Unidades</option>
                                </select>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                      <td>
                        {['SEMILLA', 'SUSTRATO', 'ENVASE', 'ETIQUETA', 'OTRO'].includes(editedArticle.type) ? (
                          <input type="number" min="0" className="form-control w-24" value={editedArticle.minStock || 0} onChange={e => setEditedArticle({...editedArticle, minStock: parseFloat(e.target.value) || 0})} />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={async () => {
                            const managed = ['SEMILLA', 'SUSTRATO', 'ENVASE', 'ETIQUETA', 'OTRO'].includes(editedArticle.type);
                            if (managed && !editedArticle.providerId) {
                              await Swal.fire('Falta el proveedor', 'Selecciona el proveedor de esta referencia antes de guardar.', 'warning');
                              return;
                            }
                            if (editedArticle.type === 'SEMILLA' && !editedArticle.varietyId) {
                              await Swal.fire('Falta la variedad', 'Selecciona la variedad agronómica de esta semilla.', 'warning');
                              return;
                            }
                            const result = await updateArticle(a.id, {
                              ...editedArticle,
                              providerId: managed ? editedArticle.providerId : null,
                              varietyId: editedArticle.type === 'SEMILLA' ? editedArticle.varietyId : null
                            });
                            if (!result?.error) setEditingArticleId(null);
                          }}>Guardar</button>
                          <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent' }} onClick={() => setEditingArticleId(null)}>Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={a.id}>
                      <td className="font-medium text-slate-500">{getTypeLabel(a.type)}</td>
                      <td className="font-bold text-slate-800">
                        {a.name}
                        <div className="text-xs text-slate-500">
                          {providers?.find(provider => provider.id === a.providerId)?.name || 'Sin proveedor'}
                          {' · '}Último: {Number(a.lastPurchaseUnitCost || 0).toFixed(4)} €/{a.unit || getUnitLabel(a.type)}
                          {' · '}Medio: {Number(a.currentUnitCost || 0).toFixed(4)} €/{a.unit || getUnitLabel(a.type)}
                        </div>
                      </td>
                      <td className="font-mono text-slate-600">{['SEMILLA', 'SUSTRATO', 'ENVASE', 'ETIQUETA', 'OTRO'].includes(a.type) ? (a.minStock || 0) : '-'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent' }} onClick={() => { setEditingArticleId(a.id); setEditedArticle(a); }}>Editar</button>
                          {isAdminMode && <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => runAdminDelete('Se borrará esta referencia si no tiene lotes ni cultivos relacionados.', () => deleteArticle(a.id))}>Borrar</button>}
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
               <button className="btn btn-primary shadow-sm" onClick={openNewPurchaseNote}>+ Nuevo Registro</button>
            </div>
            {isAdminMode && purchaseDeliveryNotes.length > 0 && (
              <div className="card" style={{ marginBottom: '1rem', border: '1px solid #fecaca', background: '#fff7f7' }}>
                <h4 className="font-bold text-red-700 mb-3">Gestión administrativa de albaranes</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {purchaseDeliveryNotes.map(note => (
                    <button
                      key={note.id}
                      type="button"
                      className="btn btn-danger"
                      onClick={() => runAdminDelete(
                        `Se intentará borrar el albarán ${note.number}. Solo se permitirá si sus lotes no se han usado.`,
                        () => deletePurchaseDeliveryNote(note.id)
                      )}
                    >
                      Borrar {note.number}
                    </button>
                  ))}
                </div>
              </div>
            )}
  
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
                    <th>Precio de Compra</th>
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
                        <td className="font-bold text-red-600">
                          {Number(entry.unitCost || 0) > 0 ? (
                            <>
                              {purchasePriceFromLine(art, { unitCost: entry.unitCost }).toFixed(2)} {isWeightPurchase(art) ? '€/kg' : art?.unit === 'l' || art?.type === 'SUSTRATO' ? '€/l' : '€/ud'}
                              <small style={{ display: 'block', color: '#64748b', fontWeight: 500 }}>{Number(entry.price || 0).toFixed(2)} € total</small>
                            </>
                          ) : '-'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {entry.purchaseDeliveryNoteId && (
                              <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => openEditPurchaseNote(entry.purchaseDeliveryNoteId)}>
                                Editar albarán
                              </button>
                            )}
                            {isAdminMode && <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => runAdminDelete('Se borrará esta entrada de prueba.', () => deleteStockEntry(entry.id))}>Borrar</button>}
                          </div>
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
                          {isAdminMode && <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => runAdminDelete('Se borrará este consumo de prueba.', () => deleteStockEntry(entry.id))}>Borrar</button>}
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
                <option value="ETIQUETA">Solo Etiquetas</option>
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
                  <th>Variedad Agronómica</th>
                  <th>Receta (Semilla + Sustrato + Envase)</th>
                  <th>Coste Directo (Bandeja)</th>
                  <th>Rendimiento</th>
                  <th>Coste Producción (por Kg)</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTypes.map(c => {
                  const varietyUnitCost = getLatestVarietySeedCost(c.varietyId);
                  const seedCost = varietyUnitCost * Number(c.seedGrams || 0);
                  const substrateUnitCost = getLatestArticleUnitCost(c.substrateId);
                  const subCost = substrateUnitCost * Number(c.substrateLiters || 0);
                  const contCost = getAverageUnitCost(c.containerId) * 1;
                  
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
                            <label className="form-label text-sm">Variedad Agronómica</label>
                            <select className="form-control" value={editedCropType.varietyId || ''} onChange={e => setEditedCropType({...editedCropType, varietyId: e.target.value})}>
                              <option value="">Selecciona...</option>
                              {seedVarieties?.filter(v => v.active !== false || v.id === editedCropType.varietyId).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="form-label text-sm">Gramos de Semilla</label>
                            <input type="number" step="0.1" min="0" className="form-control" value={editedCropType.seedGrams} onChange={e => setEditedCropType({...editedCropType, seedGrams: Number(e.target.value)})} />
                            <p className="text-xs text-slate-500 mt-1">
                              Última compra: {editTypeCosts.seedCostPerKg > 0 ? `${editTypeCosts.seedCostPerKg.toFixed(2)} €/kg · ${editTypeCosts.seedCostPerGram.toFixed(4)} €/g` : 'sin precio registrado'}
                            </p>
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
                            <p className="text-xs text-slate-500 mt-1">
                              Última compra: {editTypeCosts.substrateUnitCost > 0
                                ? `${editTypeCosts.substrateUnitCost.toFixed(4)} €/L · ${Number(editedCropType.substrateLiters || 0)} L × ${editTypeCosts.substrateUnitCost.toFixed(4)} €/L = ${editTypeCosts.substrateCost.toFixed(2)} €`
                                : 'sin precio registrado'}
                            </p>
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
                                payload.providerId = null;
                                if (payload.substrateId === '') payload.substrateId = null;
                                if (payload.containerId === '') payload.containerId = null;
                                payload.seedId = null;
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
                      <td className="text-muted">{seedVarieties?.find(v => v.id === c.varietyId)?.name || 'Sin variedad'}</td>
                      <td className="text-sm text-slate-500">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span>🌱 {c.seedGrams}g ({seedCost.toFixed(2)}€)</span>
                          <span style={{ color: '#0f766e', fontWeight: 600 }}>
                            Última compra: {varietyUnitCost > 0 ? `${(varietyUnitCost * 1000).toFixed(2)} €/kg · ${varietyUnitCost.toFixed(4)} €/g` : 'sin precio'}
                          </span>
                          {Number(c.substrateLiters) > 0 && (
                            <>
                              <span>🪨 {c.substrateLiters} L ({subCost.toFixed(2)} €)</span>
                              <span style={{ color: '#0f766e', fontWeight: 600 }}>
                                Última compra: {substrateUnitCost > 0
                                  ? `${substrateUnitCost.toFixed(4)} €/L · ${c.substrateLiters} L × ${substrateUnitCost.toFixed(4)} €/L = ${subCost.toFixed(2)} €`
                                  : 'sin precio'}
                              </span>
                            </>
                          )}
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
                          {isAdminMode && <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => runAdminDelete('Se borrará esta ficha si no tiene cultivos relacionados.', () => deleteCropType(c.id))}>Borrar</button>}
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
                <select className="form-control" value={newArticle.type} onChange={e => {
                  const type = e.target.value;
                  setNewArticle({
                    ...newArticle,
                    type,
                    unit: type === 'SEMILLA' ? 'g' : type === 'SUSTRATO' ? 'l' : 'ud',
                    varietyId: type === 'SEMILLA' ? newArticle.varietyId : ''
                  });
                }}>
                  <option value="SEMILLA">🌱 Semilla (Stock y Gasto)</option>
                  <option value="SUSTRATO">🪨 Sustrato (Stock y Gasto)</option>
                  <option value="ENVASE">📦 Envase / Bandeja (Stock y Gasto)</option>
                  <option value="ETIQUETA">🏷️ Etiqueta (Stock y Gasto)</option>
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
              {['SEMILLA', 'SUSTRATO', 'ENVASE', 'ETIQUETA', 'OTRO'].includes(newArticle.type) && (
                <>
                  {newArticle.type === 'SEMILLA' && (
                    <div>
                      <label className="form-label">Variedad agronómica</label>
                      <select required className="form-control" value={newArticle.varietyId} onChange={e => setNewArticle({...newArticle, varietyId: e.target.value})}>
                        <option value="">Selecciona...</option>
                        {seedVarieties?.filter(v => v.active !== false).map(variety => <option key={variety.id} value={variety.id}>{variety.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="form-label">Proveedor de esta referencia</label>
                    <select required className="form-control" value={newArticle.providerId} onChange={e => setNewArticle({...newArticle, providerId: e.target.value})}>
                      <option value="">Selecciona...</option>
                      {providers?.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
                    </select>
                    <p className="text-xs text-slate-500 mt-1">La misma variedad de otro proveedor debe crearse como otra referencia.</p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="form-label">Referencia del proveedor</label>
                      <input type="text" className="form-control" value={newArticle.supplierReference} onChange={e => setNewArticle({...newArticle, supplierReference: e.target.value})} />
                    </div>
                    <div>
                      <label className="form-label">Unidad de stock</label>
                      <select className="form-control" value={newArticle.unit} onChange={e => setNewArticle({...newArticle, unit: e.target.value})}>
                        <option value="g">Gramos</option>
                        <option value="kg">Kilogramos</option>
                        <option value="l">Litros</option>
                        <option value="ud">Unidades</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
              {['SEMILLA', 'SUSTRATO', 'ENVASE', 'ETIQUETA', 'OTRO'].includes(newArticle.type) && (
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
          <div style={{ ...modalCardStyle, maxWidth: editingPurchaseNoteId ? '1050px' : '760px' }}>
            <h3 className="font-bold mb-4 text-xl">{editingPurchaseNoteId ? 'Editar Albarán de Entrada' : 'Registrar Albarán de Entrada / Gasto'}</h3>
            <form onSubmit={handleAddStockEntry} style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', alignItems: 'start' }}>
              <div>
                <label className="form-label">Proveedor / Acreedor</label>
                <select required disabled={Boolean(editingPurchaseNoteId)} className="form-control" value={newStockEntry.providerId} onChange={e => {
                  setNewStockEntry({...newStockEntry, providerId: e.target.value, articleId: '', batchNumber: ''});
                  setPurchaseLines([]);
                }}>
                  <option value="">Selecciona...</option>
                  {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Fecha Factura/Albarán</label>
                <input required type="date" className="form-control" value={newStockEntry.purchaseDate} onChange={e => setNewStockEntry({...newStockEntry, purchaseDate: e.target.value})} />
              </div>
              {!editingPurchaseNoteId && (
                <>
              <div style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Artículo (Semilla, Luz...)</label>
                <select required={purchaseLines.length === 0} className="form-control" value={newStockEntry.articleId} onChange={e => setNewStockEntry({...newStockEntry, articleId: e.target.value, batchNumber: ''})}>
                  <option value="">Selecciona...</option>
                  {articles?.filter(a => a.active !== false && a.providerId === newStockEntry.providerId).map(a => <option key={a.id} value={a.id}>{getTypeLabel(a.type)} - {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Nº Factura / Albarán</label>
                <input required type="text" className="form-control" placeholder="Número del documento" value={newStockEntry.deliveryNote} onChange={e => setNewStockEntry({...newStockEntry, deliveryNote: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Lote (Para Trazabilidad)</label>
                <input required={Boolean(newStockEntry.articleId) && !isExpenseOnly} type="text" className="form-control" placeholder="Lote del proveedor" disabled={!newStockEntry.articleId || isExpenseOnly} value={newStockEntry.batchNumber} onChange={e => setNewStockEntry({...newStockEntry, batchNumber: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Cant. ({selectedArticleType ? getUnitLabel(selectedArticleType) : 'Uds'})</label>
                <input required={Boolean(newStockEntry.articleId)} disabled={!newStockEntry.articleId} type="number" min="0.01" step="0.01" className="form-control" value={newStockEntry.quantity} onChange={e => setNewStockEntry({...newStockEntry, quantity: Number(e.target.value)})} />
              </div>
              <div>
                <label className="form-label">{purchasePriceLabel(articles?.find(item => item.id === newStockEntry.articleId))}</label>
                <input required={Boolean(newStockEntry.articleId)} disabled={!newStockEntry.articleId} type="number" step="0.01" min="0" className="form-control" value={newStockEntry.price} onChange={e => setNewStockEntry({...newStockEntry, price: Number(e.target.value)})} />
                {newStockEntry.articleId && (
                  <small className="text-muted">
                    Total calculado: {purchaseTotalCost(articles?.find(item => item.id === newStockEntry.articleId), newStockEntry.quantity, newStockEntry.price).toFixed(2)} €
                  </small>
                )}
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={addPurchaseLine} disabled={!newStockEntry.articleId}>
                  + Añadir artículo al albarán
                </button>
              </div>
                </>
              )}

              {purchaseLines.length > 0 && (
                <div style={{ gridColumn: 'span 2', border: '1px solid #cbd5e1', borderRadius: '0.75rem', overflow: 'hidden' }}>
                  <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', fontWeight: 'bold', color: '#334155' }}>
                    Artículos incluidos ({purchaseLines.length})
                  </div>
                  {purchaseLines.map((line, index) => {
                    const article = articles?.find(item => item.id === line.articleId);
                    const calculatedTotal = purchaseTotalCost(article, line.quantity, line.purchaseUnitPrice);
                    return (
                      <div key={line.id} style={{ display: 'grid', gridTemplateColumns: editingPurchaseNoteId ? '1.2fr 1fr 0.8fr 1fr auto' : '1fr auto auto auto', gap: '0.75rem', alignItems: 'end', padding: '0.75rem 1rem', borderTop: '1px solid #e2e8f0' }}>
                        <div>
                          <strong>{article?.name || 'Artículo'}</strong>
                          {!editingPurchaseNoteId && <div className="text-xs text-slate-500">{line.supplierBatch ? `Lote ${line.supplierBatch}` : 'Sin lote'}</div>}
                        </div>
                        {editingPurchaseNoteId ? (
                          <>
                            <label>
                              <small className="form-label">Lote</small>
                              <input
                                required
                                className="form-control"
                                value={line.supplierBatch}
                                onChange={event => setPurchaseLines(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, supplierBatch: event.target.value } : item))}
                              />
                            </label>
                            <label>
                              <small className="form-label">Cantidad ({article?.unit || getUnitLabel(article?.type)})</small>
                              <input
                                required
                                type="number"
                                min="0.01"
                                step="0.01"
                                className="form-control"
                                value={line.quantity}
                                onChange={event => setPurchaseLines(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item))}
                              />
                            </label>
                            <label>
                              <small className="form-label">{purchasePriceLabel(article)}</small>
                              <input
                                required
                                type="number"
                                min="0"
                                step="0.01"
                                className="form-control"
                                value={line.purchaseUnitPrice}
                                onChange={event => setPurchaseLines(previous => previous.map((item, itemIndex) => itemIndex === index ? { ...item, purchaseUnitPrice: Number(event.target.value) } : item))}
                              />
                            </label>
                            <strong style={{ paddingBottom: '0.65rem', whiteSpace: 'nowrap' }}>{calculatedTotal.toFixed(2)} €</strong>
                          </>
                        ) : (
                          <>
                            <span>{line.quantity} {article?.unit || getUnitLabel(article?.type)}</span>
                            <strong>{calculatedTotal.toFixed(2)} €</strong>
                            <button type="button" className="btn btn-danger" onClick={() => setPurchaseLines(previous => previous.filter((_, itemIndex) => itemIndex !== index))}>Quitar</button>
                          </>
                        )}
                      </div>
                    );
                  })}
                  <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #cbd5e1', textAlign: 'right', fontWeight: 'bold' }}>
                    Total: {purchaseLines.reduce((sum, line) => {
                      const article = articles?.find(item => item.id === line.articleId);
                      return sum + purchaseTotalCost(article, line.quantity, line.purchaseUnitPrice);
                    }, 0).toFixed(2)} €
                  </div>
                </div>
              )}

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowStockModal(false);
                  resetPurchaseModal();
                }}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={isSavingStockEntry}>
                  {isSavingStockEntry ? 'Guardando...' : editingPurchaseNoteId ? 'Guardar Cambios' : 'Guardar Albarán Completo'}
                </button>
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

              {/* Seed Section */}
              <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', boxShadow: 'none', padding: '1.25rem' }}>
                <h4 className="font-semibold text-slate-700 mb-3">🌱 Variedad a cultivar</h4>
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Variedad agronómica</label>
                  <select required className="form-control" value={newType.varietyId} onChange={e => setNewType({...newType, varietyId: e.target.value})}>
                    <option value="">Selecciona...</option>
                    {seedVarieties?.filter(v => v.active !== false).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                  <p className="text-xs text-slate-500 mt-1">El proveedor y el lote concreto se seleccionarán al registrar la siembra.</p>
                </div>
                <div>
                  <label className="form-label">Gramos por Bandeja</label>
                  <input required type="number" step="0.1" min="0" className="form-control" value={newType.seedGrams} onChange={e => setNewType({...newType, seedGrams: Number(e.target.value)})} />
                  <p className="text-xs text-slate-500 mt-1">
                    Última compra: {newTypeCosts.seedCostPerKg > 0 ? `${newTypeCosts.seedCostPerKg.toFixed(2)} €/kg · ${newTypeCosts.seedCostPerGram.toFixed(4)} €/g` : 'sin precio registrado'}
                  </p>
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
                  <p className="text-xs text-slate-500 mt-1">
                    Última compra: {newTypeCosts.substrateUnitCost > 0
                      ? `${newTypeCosts.substrateUnitCost.toFixed(4)} €/L · ${Number(newType.substrateLiters || 0)} L × ${newTypeCosts.substrateUnitCost.toFixed(4)} €/L = ${newTypeCosts.substrateCost.toFixed(2)} €`
                      : 'sin precio registrado'}
                  </p>
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
