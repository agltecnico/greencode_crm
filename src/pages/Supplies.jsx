import { useState } from 'react';
import { useData } from '../context/DataContext';
import { usePagination } from '../hooks/usePagination';

export default function Supplies() {
  const { 
    providers, addProvider, deleteProvider,
    articles, addArticle, deleteArticle,
    stockEntries, addStockEntry, deleteStockEntry,
    cropTypes, addCropType, deleteCropType
  } = useData();

  const [activeTab, setActiveTab] = useState('CATALOG');
  const [searchTerm, setSearchTerm] = useState('');

  // Forms State
  const [newProvider, setNewProvider] = useState({ name: '', contactInfo: '' });
  const [newArticle, setNewArticle] = useState({ name: '', type: 'SEMILLA' });
  const [newStockEntry, setNewStockEntry] = useState({ purchaseDate: new Date().toISOString().split('T')[0], deliveryNote: '', batchNumber: '', articleId: '', providerId: '', quantity: 1, price: 0 });
  
  const [newType, setNewType] = useState({
    name: '',
    seedId: '',
    seedGrams: 0,
    substrateId: '',
    substrateLiters: 0,
    containerId: '',
    expectedYieldGrams: 0,
    providerId: ''
  });

  // Handlers
  const handleAddProvider = e => { e.preventDefault(); addProvider(newProvider); setNewProvider({name:'', contactInfo:''}); };
  const handleAddArticle = e => { e.preventDefault(); addArticle(newArticle); setNewArticle({...newArticle, name:''}); };
  
  const handleAddStockEntry = e => { 
    e.preventDefault(); 
    addStockEntry(newStockEntry); 
    setNewStockEntry({...newStockEntry, deliveryNote: '', batchNumber: '', providerId: '', quantity: 1, price: 0}); 
  };

  const handleAddCropType = e => {
    e.preventDefault();
    addCropType(newType);
    setNewType({ name: '', seedId: '', seedGrams: 0, substrateId: '', substrateLiters: 0, containerId: '', expectedYieldGrams: 0, providerId: '' });
    setActiveTab('CROP_TYPES_LIST');
  };

  // Filtration logic
  const filteredProviders = providers?.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) || [];
  const { currentData: paginatedProviders, currentPage: pPage, totalPages: pTotal, goToPage: pGo, nextPage: pNext, prevPage: pPrev } = usePagination(filteredProviders, 10);

  const filteredArticles = articles?.filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.type.toLowerCase().includes(searchTerm.toLowerCase())) || [];
  const { currentData: paginatedArticles, currentPage: aPage, totalPages: aTotal, goToPage: aGo, nextPage: aNext, prevPage: aPrev } = usePagination(filteredArticles, 10);

  const filteredStock = stockEntries?.filter(entry => {
    const art = articles?.find(a => a.id === entry.articleId);
    return art?.name.toLowerCase().includes(searchTerm.toLowerCase()) || entry.deliveryNote?.toLowerCase().includes(searchTerm.toLowerCase()) || entry.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a,b) => new Date(b.purchaseDate) - new Date(a.purchaseDate)) || [];
  const { currentData: paginatedStock, currentPage: sPage, totalPages: sTotal, goToPage: sGo, nextPage: sNext, prevPage: sPrev } = usePagination(filteredStock, 10);

  const filteredTypes = cropTypes?.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())) || [];
  const { currentData: paginatedTypes, currentPage: tPage, totalPages: tTotal, goToPage: tGo, nextPage: tNext, prevPage: tPrev } = usePagination(filteredTypes, 10);

  const getTypeLabel = (type) => {
    switch(type) {
      case 'SEMILLA': return '🌱 Semilla';
      case 'SUSTRATO': return '🪨 Sustrato';
      case 'ENVASE': return '📦 Envase';
      case 'OTRO': return '🏷️ Consumible/Otro';
      default: return type;
    }
  };

  const getUnitLabel = (type) => {
    switch(type) {
      case 'SEMILLA': return 'Gramos';
      case 'SUSTRATO': return 'Litros';
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
  const containers = articles?.filter(a => a.type === 'ENVASE') || [];
  const selectedArticleType = newStockEntry.articleId ? articles?.find(a => a.id === newStockEntry.articleId)?.type : null;

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Cultivo</h2>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>Control unificado de logística, recetas y costes de producción.</p>
        </div>
      </div>

      <div className="admin-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button className={`admin-tab ${activeTab === 'PROVIDERS' ? 'active' : ''}`} onClick={() => setActiveTab('PROVIDERS')}>Proveedores</button>
        <button className={`admin-tab ${activeTab === 'CATALOG' ? 'active' : ''}`} onClick={() => setActiveTab('CATALOG')}>Catálogo de Artículos</button>
        <button className={`admin-tab ${activeTab === 'STOCK' ? 'active' : ''}`} onClick={() => setActiveTab('STOCK')}>Albaranes (Stock)</button>
        <button className={`admin-tab ${activeTab === 'CROP_TYPES_CREATE' ? 'active' : ''}`} onClick={() => setActiveTab('CROP_TYPES_CREATE')}>Nueva Ficha</button>
        <button className={`admin-tab ${activeTab === 'CROP_TYPES_LIST' ? 'active' : ''}`} onClick={() => setActiveTab('CROP_TYPES_LIST')}>Ver Escandallos</button>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Buscar en esta sección..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {activeTab === 'PROVIDERS' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 className="font-bold mb-4">Añadir Nuevo Proveedor</h3>
            <form onSubmit={handleAddProvider} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 250px' }}>
                <label className="form-label">Nombre del Proveedor</label>
                <input required type="text" className="form-control" value={newProvider.name} onChange={e => setNewProvider({...newProvider, name: e.target.value})} />
              </div>
              <div style={{ flex: '1 1 250px' }}>
                <label className="form-label">Contacto (Email / Tel)</label>
                <input type="text" className="form-control" value={newProvider.contactInfo} onChange={e => setNewProvider({...newProvider, contactInfo: e.target.value})} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>Guardar Proveedor</button>
            </form>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre del Proveedor</th>
                  <th>Información de Contacto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProviders.map(p => (
                  <tr key={p.id}>
                    <td className="font-bold">{p.name}</td>
                    <td>{p.contactInfo || '-'}</td>
                    <td>
                      <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }} onClick={() => deleteProvider(p.id)}>X</button>
                    </td>
                  </tr>
                ))}
                {paginatedProviders.length === 0 && (
                  <tr><td colSpan="3" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No hay proveedores registrados.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {pTotal > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={pPrev} disabled={pPage === 1}>&lt; Ant</button>
              {Array.from({ length: pTotal }, (_, i) => i + 1).map(page => (
                <button key={page} className={`page-btn ${pPage === page ? 'active' : ''}`} onClick={() => pGo(page)}>{page}</button>
              ))}
              <button className="page-btn" onClick={pNext} disabled={pPage === pTotal}>Sig &gt;</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'CATALOG' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 className="font-bold mb-4">Crear Artículo para el Almacén</h3>
            <form onSubmit={handleAddArticle} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ width: '200px' }}>
                <label className="form-label">Tipo de Artículo</label>
                <select className="form-control" value={newArticle.type} onChange={e => setNewArticle({...newArticle, type: e.target.value})}>
                  <option value="SEMILLA">🌱 Semilla</option>
                  <option value="SUSTRATO">🪨 Sustrato</option>
                  <option value="ENVASE">📦 Envase / Bandeja</option>
                  <option value="OTRO">🏷️ Consumible / Otro</option>
                </select>
              </div>
              <div style={{ flex: '1 1 250px' }}>
                <label className="form-label">Nombre del Artículo (Ej: Bandeja 1020, Coco Mix)</label>
                <input required type="text" className="form-control" value={newArticle.name} onChange={e => setNewArticle({...newArticle, name: e.target.value})} />
              </div>
              <button type="submit" className="btn btn-secondary" style={{ height: '42px', padding: '0 1.5rem' }}>Añadir al Catálogo</button>
            </form>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Nombre del Artículo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedArticles.map(a => (
                  <tr key={a.id}>
                    <td className="font-medium text-slate-500">{getTypeLabel(a.type)}</td>
                    <td className="font-bold text-slate-800">{a.name}</td>
                    <td>
                      <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }} onClick={() => deleteArticle(a.id)}>Borrar</button>
                    </td>
                  </tr>
                ))}
                {paginatedArticles.length === 0 && (
                  <tr><td colSpan="3" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>El catálogo está vacío. Añade tu primer artículo.</td></tr>
                )}
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
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 className="font-bold mb-4">Registro de Albaranes (Entrada de Stock)</h3>
            
            <form onSubmit={handleAddStockEntry} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
              <div>
                <label className="form-label">Proveedor</label>
                <select required className="form-control" value={newStockEntry.providerId} onChange={e => setNewStockEntry({...newStockEntry, providerId: e.target.value})}>
                  <option value="">Selecciona...</option>
                  {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Fecha</label>
                <input required type="date" className="form-control" value={newStockEntry.purchaseDate} onChange={e => setNewStockEntry({...newStockEntry, purchaseDate: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Artículo</label>
                <select required className="form-control" value={newStockEntry.articleId} onChange={e => setNewStockEntry({...newStockEntry, articleId: e.target.value})}>
                  <option value="">Selecciona...</option>
                  {articles?.map(a => <option key={a.id} value={a.id}>{getTypeLabel(a.type)} - {a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Nº Albarán</label>
                <input type="text" className="form-control" placeholder="Ej: ALB-123" value={newStockEntry.deliveryNote} onChange={e => setNewStockEntry({...newStockEntry, deliveryNote: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Lote</label>
                <input type="text" className="form-control" placeholder="Ej: L-2026-X" value={newStockEntry.batchNumber} onChange={e => setNewStockEntry({...newStockEntry, batchNumber: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Cant. ({selectedArticleType ? getUnitLabel(selectedArticleType) : 'Uds'})</label>
                <input required type="number" min="0.01" step="0.01" className="form-control" value={newStockEntry.quantity} onChange={e => setNewStockEntry({...newStockEntry, quantity: Number(e.target.value)})} />
              </div>
              <div>
                <label className="form-label">Precio Total (€)</label>
                <input required type="number" step="0.01" min="0" className="form-control" value={newStockEntry.price} onChange={e => setNewStockEntry({...newStockEntry, price: Number(e.target.value)})} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>Registrar Entrada</button>
            </form>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Artículo</th>
                  <th>Albarán</th>
                  <th>Lote</th>
                  <th>Cantidad</th>
                  <th>Coste Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStock.map(entry => {
                  const art = articles?.find(a => a.id === entry.articleId);
                  return (
                    <tr key={entry.id}>
                      <td>{new Date(entry.purchaseDate).toLocaleDateString()}</td>
                      <td className="text-muted">{providers?.find(p => p.id === entry.providerId)?.name || '-'}</td>
                      <td className="font-bold text-primary">{art ? getTypeLabel(art.type) + ' ' + art.name : 'Desconocido'}</td>
                      <td className="text-muted font-mono">{entry.deliveryNote || '-'}</td>
                      <td className="font-mono text-indigo-600">{entry.batchNumber || '-'}</td>
                      <td>{entry.quantity} {art ? getUnitLabel(art.type) : ''}</td>
                      <td className="font-semibold">{entry.price ? `${entry.price.toFixed(2)} €` : '-'}</td>
                      <td>
                        <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }} onClick={() => deleteStockEntry(entry.id)}>Borrar</button>
                      </td>
                    </tr>
                  )
                })}
                {paginatedStock.length === 0 && (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No hay entradas de stock registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {sTotal > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={sPrev} disabled={sPage === 1}>&lt; Ant</button>
              {Array.from({ length: sTotal }, (_, i) => i + 1).map(page => (
                <button key={page} className={`page-btn ${sPage === page ? 'active' : ''}`} onClick={() => sGo(page)}>{page}</button>
              ))}
              <button className="page-btn" onClick={sNext} disabled={sPage === sTotal}>Sig &gt;</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'CROP_TYPES_CREATE' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="card">
            <h3 className="font-bold mb-4">Nueva Ficha de Cultivo</h3>
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
              <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
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

              {/* Substrate Section */}
              <div className="card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
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
              <div className="card" style={{ gridColumn: 'span 2', background: '#f8fafc', border: '1px solid #e2e8f0', boxShadow: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ height: '48px', padding: '0 2rem', fontSize: '1.1rem' }}>Crear Ficha de Cultivo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'CROP_TYPES_LIST' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
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

                  return (
                    <tr key={c.id}>
                      <td className="font-bold text-slate-800">{c.name}</td>
                      <td className="text-muted">{providers?.find(p => p.id === c.providerId)?.name || 'Cualquiera'}</td>
                      <td className="text-sm text-slate-500">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span>🌱 {c.seedGrams}g ({seedCost.toFixed(2)}€)</span>
                          {Number(c.substrateLiters) > 0 && <span>🪨 {c.substrateLiters}L ({subCost.toFixed(2)}€)</span>}
                          <span>📦 1 ud ({contCost.toFixed(2)}€)</span>
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
                        <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }} onClick={() => deleteCropType(c.id)}>Borrar</button>
                      </td>
                    </tr>
                  )
                })}
                {paginatedTypes.length === 0 && (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No has creado ninguna Ficha de Cultivo todavía.</td></tr>
                )}
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
    </div>
  );
}
