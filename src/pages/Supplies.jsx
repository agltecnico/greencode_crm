import { useState } from 'react';
import { useData } from '../context/DataContext';
import { usePagination } from '../hooks/usePagination';

export default function Supplies() {
  const { 
    providers, addProvider, deleteProvider,
    articles, addArticle, deleteArticle,
    stockEntries, addStockEntry, deleteStockEntry
  } = useData();

  const [activeTab, setActiveTab] = useState('CATALOG');
  const [searchTerm, setSearchTerm] = useState('');

  // Forms State
  const [newProvider, setNewProvider] = useState({ name: '', contactInfo: '' });
  
  // Catalog State
  const [newArticle, setNewArticle] = useState({ name: '', type: 'SEMILLA' });
  
  // Stock State
  const [newStockEntry, setNewStockEntry] = useState({ purchaseDate: new Date().toISOString().split('T')[0], deliveryNote: '', batchNumber: '', articleId: '', providerId: '', quantity: 1, price: 0 });

  // Handlers
  const handleAddProvider = e => { e.preventDefault(); addProvider(newProvider); setNewProvider({name:'', contactInfo:''}); };
  const handleAddArticle = e => { e.preventDefault(); addArticle(newArticle); setNewArticle({...newArticle, name:''}); };
  
  const handleAddStockEntry = e => { 
    e.preventDefault(); 
    addStockEntry(newStockEntry); 
    setNewStockEntry({...newStockEntry, deliveryNote: '', batchNumber: '', providerId: '', quantity: 1, price: 0}); 
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

  const selectedArticleType = newStockEntry.articleId ? articles?.find(a => a.id === newStockEntry.articleId)?.type : null;

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Insumos y Almacén</h2>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>Control unificado de artículos, stock y proveedores.</p>
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${activeTab === 'PROVIDERS' ? 'active' : ''}`} onClick={() => setActiveTab('PROVIDERS')}>Proveedores</button>
        <button className={`admin-tab ${activeTab === 'CATALOG' ? 'active' : ''}`} onClick={() => setActiveTab('CATALOG')}>Catálogo de Artículos</button>
        <button className={`admin-tab ${activeTab === 'STOCK' ? 'active' : ''}`} onClick={() => setActiveTab('STOCK')}>Entrada de Albaranes (Stock)</button>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Buscar..." 
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
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No hay entradas de stock registradas.</td></tr>
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
    </div>
  );
}
