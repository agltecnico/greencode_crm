import { useState } from 'react';
import { useData } from '../context/DataContext';
import { usePagination } from '../hooks/usePagination';

export default function Supplies() {
  const { 
    providers, addProvider, deleteProvider,
    seeds, addSeed, deleteSeed,
    seedInventory, addSeedInventory, deleteSeedInventory,
    substrates, addSubstrate, deleteSubstrate,
    substrateInventory, addSubstrateInventory, deleteSubstrateInventory
  } = useData();

  const [activeTab, setActiveTab] = useState('PROVIDERS');
  const [searchTerm, setSearchTerm] = useState('');

  // Forms State
  const [newProvider, setNewProvider] = useState({ name: '', contactInfo: '' });
  
  // Semillas State
  const [newSeed, setNewSeed] = useState({ name: '', expectedYieldGrams: 0 });
  const [newSeedEntry, setNewSeedEntry] = useState({ purchaseDate: new Date().toISOString().split('T')[0], deliveryNote: '', seedId: '', quantity: 1000, price: 0 });
  
  // Sustratos State
  const [newSubstrate, setNewSubstrate] = useState({ name: '' });
  const [newSubstrateEntry, setNewSubstrateEntry] = useState({ purchaseDate: new Date().toISOString().split('T')[0], deliveryNote: '', substrateId: '', quantity: 50, price: 0 });

  // Handlers
  const handleAddProvider = e => { e.preventDefault(); addProvider(newProvider); setNewProvider({name:'', contactInfo:''}); };
  const handleAddSeed = e => { e.preventDefault(); addSeed(newSeed); setNewSeed({name:'', expectedYieldGrams: 0}); };
  const handleAddSubstrate = e => { e.preventDefault(); addSubstrate(newSubstrate); setNewSubstrate({name:''}); };
  
  const handleAddSeedEntry = e => { 
    e.preventDefault(); 
    addSeedInventory(newSeedEntry); 
    setNewSeedEntry({...newSeedEntry, deliveryNote: '', quantity: 1000, price: 0}); 
  };
  
  const handleAddSubstrateEntry = e => { 
    e.preventDefault(); 
    addSubstrateInventory(newSubstrateEntry); 
    setNewSubstrateEntry({...newSubstrateEntry, deliveryNote: '', quantity: 50, price: 0}); 
  };

  // Filtration logic
  const filteredProviders = providers?.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) || [];
  const { currentData: paginatedProviders, currentPage: pPage, totalPages: pTotal, goToPage: pGo, nextPage: pNext, prevPage: pPrev } = usePagination(filteredProviders, 10);

  const filteredSeedEntries = seedInventory?.filter(entry => {
    const seed = seeds?.find(s => s.id === entry.seedId);
    return seed?.name.toLowerCase().includes(searchTerm.toLowerCase()) || entry.deliveryNote?.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a,b) => new Date(b.purchaseDate) - new Date(a.purchaseDate)) || [];
  const { currentData: paginatedSeedEntries, currentPage: sPage, totalPages: sTotal, goToPage: sGo, nextPage: sNext, prevPage: sPrev } = usePagination(filteredSeedEntries, 10);

  const filteredSubstrateEntries = substrateInventory?.filter(entry => {
    const sub = substrates?.find(s => s.id === entry.substrateId);
    return sub?.name.toLowerCase().includes(searchTerm.toLowerCase()) || entry.deliveryNote?.toLowerCase().includes(searchTerm.toLowerCase());
  }).sort((a,b) => new Date(b.purchaseDate) - new Date(a.purchaseDate)) || [];
  const { currentData: paginatedSubstrateEntries, currentPage: subPage, totalPages: subTotal, goToPage: subGo, nextPage: subNext, prevPage: subPrev } = usePagination(filteredSubstrateEntries, 10);

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Insumos y Stock</h2>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>Control de proveedores, semillas y sustratos mediante albaranes.</p>
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${activeTab === 'PROVIDERS' ? 'active' : ''}`} onClick={() => setActiveTab('PROVIDERS')}>Proveedores</button>
        <button className={`admin-tab ${activeTab === 'SEEDS' ? 'active' : ''}`} onClick={() => setActiveTab('SEEDS')}>Compra de Semillas</button>
        <button className={`admin-tab ${activeTab === 'SUBSTRATES' ? 'active' : ''}`} onClick={() => setActiveTab('SUBSTRATES')}>Compra de Sustratos</button>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Buscar por nombre o número de albarán..." 
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

      {activeTab === 'SEEDS' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 className="font-bold mb-4">Entrada de Stock de Semillas (con Albarán)</h3>
            
            {/* Pequeño formulario para dar de alta nombre de semilla si no existe */}
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
              <h4 className="font-semibold mb-2 text-sm text-slate-500">¿No existe la variedad en el catálogo? Añádela primero:</h4>
              <form onSubmit={handleAddSeed} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Variedad de Semilla</label>
                  <input required type="text" className="form-control" value={newSeed.name} onChange={e => setNewSeed({...newSeed, name: e.target.value})} />
                </div>
                <button type="submit" className="btn btn-secondary" style={{ height: '38px', padding: '0 1rem' }}>+ Crear Catálogo</button>
              </form>
            </div>

            <form onSubmit={handleAddSeedEntry} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
              <div>
                <label className="form-label">Fecha</label>
                <input required type="date" className="form-control" value={newSeedEntry.purchaseDate} onChange={e => setNewSeedEntry({...newSeedEntry, purchaseDate: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Nº Albarán</label>
                <input required type="text" className="form-control" placeholder="Ej: ALB-123" value={newSeedEntry.deliveryNote} onChange={e => setNewSeedEntry({...newSeedEntry, deliveryNote: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Artículo (Semilla)</label>
                <select required className="form-control" value={newSeedEntry.seedId} onChange={e => setNewSeedEntry({...newSeedEntry, seedId: e.target.value})}>
                  <option value="">Selecciona...</option>
                  {seeds?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Cantidad (Gramos)</label>
                <input required type="number" min="1" className="form-control" value={newSeedEntry.quantity} onChange={e => setNewSeedEntry({...newSeedEntry, quantity: Number(e.target.value)})} />
              </div>
              <div>
                <label className="form-label">Precio Total (€)</label>
                <input required type="number" step="0.01" min="0" className="form-control" value={newSeedEntry.price} onChange={e => setNewSeedEntry({...newSeedEntry, price: Number(e.target.value)})} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>Registrar Compra</button>
            </form>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Albarán</th>
                  <th>Artículo / Variedad</th>
                  <th>Cantidad Registrada</th>
                  <th>Coste Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSeedEntries.map(entry => {
                  const seed = seeds?.find(s => s.id === entry.seedId);
                  return (
                    <tr key={entry.id}>
                      <td>{new Date(entry.purchaseDate).toLocaleDateString()}</td>
                      <td className="text-muted font-mono">{entry.deliveryNote || '-'}</td>
                      <td className="font-bold text-primary">{seed?.name || 'Desconocida'}</td>
                      <td>{entry.quantity} g <span className="text-muted" style={{fontSize:'0.8rem'}}>({(entry.quantity/1000).toFixed(2)} Kg)</span></td>
                      <td className="font-semibold">{entry.price ? `${entry.price.toFixed(2)} €` : '-'}</td>
                      <td>
                        <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }} onClick={() => deleteSeedInventory(entry.id)}>Borrar</button>
                      </td>
                    </tr>
                  )
                })}
                {paginatedSeedEntries.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No hay compras de semillas registradas.</td></tr>
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

      {activeTab === 'SUBSTRATES' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="card" style={{ marginBottom: '2rem' }}>
            <h3 className="font-bold mb-4">Entrada de Stock de Sustratos (con Albarán)</h3>
            
            {/* Pequeño formulario para dar de alta nombre de sustrato si no existe */}
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
              <h4 className="font-semibold mb-2 text-sm text-slate-500">¿No existe el sustrato en el catálogo? Añádelo primero:</h4>
              <form onSubmit={handleAddSubstrate} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Nombre / Tipo de Sustrato (Ej: Coco Mix)</label>
                  <input required type="text" className="form-control" value={newSubstrate.name} onChange={e => setNewSubstrate({...newSubstrate, name: e.target.value})} />
                </div>
                <button type="submit" className="btn btn-secondary" style={{ height: '38px', padding: '0 1rem' }}>+ Crear Catálogo</button>
              </form>
            </div>

            <form onSubmit={handleAddSubstrateEntry} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
              <div>
                <label className="form-label">Fecha</label>
                <input required type="date" className="form-control" value={newSubstrateEntry.purchaseDate} onChange={e => setNewSubstrateEntry({...newSubstrateEntry, purchaseDate: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Nº Albarán</label>
                <input required type="text" className="form-control" placeholder="Ej: ALB-123" value={newSubstrateEntry.deliveryNote} onChange={e => setNewSubstrateEntry({...newSubstrateEntry, deliveryNote: e.target.value})} />
              </div>
              <div>
                <label className="form-label">Artículo (Sustrato)</label>
                <select required className="form-control" value={newSubstrateEntry.substrateId} onChange={e => setNewSubstrateEntry({...newSubstrateEntry, substrateId: e.target.value})}>
                  <option value="">Selecciona...</option>
                  {substrates?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Cantidad (Litros)</label>
                <input required type="number" min="1" className="form-control" value={newSubstrateEntry.quantity} onChange={e => setNewSubstrateEntry({...newSubstrateEntry, quantity: Number(e.target.value)})} />
              </div>
              <div>
                <label className="form-label">Precio Total (€)</label>
                <input required type="number" step="0.01" min="0" className="form-control" value={newSubstrateEntry.price} onChange={e => setNewSubstrateEntry({...newSubstrateEntry, price: Number(e.target.value)})} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>Registrar Compra</button>
            </form>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Albarán</th>
                  <th>Artículo / Tipo de Sustrato</th>
                  <th>Cantidad Registrada</th>
                  <th>Coste Total</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSubstrateEntries.map(entry => {
                  const sub = substrates?.find(s => s.id === entry.substrateId);
                  return (
                    <tr key={entry.id}>
                      <td>{new Date(entry.purchaseDate).toLocaleDateString()}</td>
                      <td className="text-muted font-mono">{entry.deliveryNote || '-'}</td>
                      <td className="font-bold text-emerald-600">{sub?.name || 'Desconocido'}</td>
                      <td>{entry.quantity} Litros</td>
                      <td className="font-semibold">{entry.price ? `${entry.price.toFixed(2)} €` : '-'}</td>
                      <td>
                        <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }} onClick={() => deleteSubstrateInventory(entry.id)}>Borrar</button>
                      </td>
                    </tr>
                  )
                })}
                {paginatedSubstrateEntries.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No hay compras de sustratos registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {subTotal > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={subPrev} disabled={subPage === 1}>&lt; Ant</button>
              {Array.from({ length: subTotal }, (_, i) => i + 1).map(page => (
                <button key={page} className={`page-btn ${subPage === page ? 'active' : ''}`} onClick={() => subGo(page)}>{page}</button>
              ))}
              <button className="page-btn" onClick={subNext} disabled={subPage === subTotal}>Sig &gt;</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
