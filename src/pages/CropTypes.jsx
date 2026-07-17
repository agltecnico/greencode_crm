import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { usePagination } from '../hooks/usePagination';

export default function CropTypes() {
  const { articles, stockEntries, cropTypes, addCropType, deleteCropType } = useData();

  const [activeTab, setActiveTab] = useState('LIST');
  const [searchTerm, setSearchTerm] = useState('');

  const [newType, setNewType] = useState({
    name: '',
    seedId: '',
    seedGrams: 0,
    substrateId: '',
    substrateLiters: 0,
    containerId: '',
    expectedYieldGrams: 0
  });

  const seeds = articles?.filter(a => a.type === 'SEMILLA') || [];
  const substrates = articles?.filter(a => a.type === 'SUSTRATO') || [];
  const containers = articles?.filter(a => a.type === 'ENVASE') || [];

  const handleAdd = e => {
    e.preventDefault();
    addCropType(newType);
    setNewType({ name: '', seedId: '', seedGrams: 0, substrateId: '', substrateLiters: 0, containerId: '', expectedYieldGrams: 0 });
    setActiveTab('LIST');
  };

  // Helper to compute average cost of an article
  const getAverageUnitCost = (articleId) => {
    if (!articleId) return 0;
    const entries = stockEntries?.filter(e => e.articleId === articleId) || [];
    if (entries.length === 0) return 0;
    
    const totalQty = entries.reduce((acc, curr) => acc + Number(curr.quantity), 0);
    const totalPrice = entries.reduce((acc, curr) => acc + Number(curr.price), 0);
    
    if (totalQty === 0) return 0;
    return totalPrice / totalQty; // price per unit (gram, liter, unit)
  };

  const filteredTypes = cropTypes?.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase())) || [];
  const { currentData, currentPage, totalPages, goToPage, nextPage, prevPage } = usePagination(filteredTypes, 10);

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h2 className="text-2xl font-bold">Calculadora de Tipos de Cultivo</h2>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>Recetas de producción, escandallos y cálculo automático de rentabilidad.</p>
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${activeTab === 'LIST' ? 'active' : ''}`} onClick={() => setActiveTab('LIST')}>Ver Escandallos (Costes)</button>
        <button className={`admin-tab ${activeTab === 'CREATE' ? 'active' : ''}`} onClick={() => setActiveTab('CREATE')}>Crear Tipo de Cultivo</button>
      </div>

      {activeTab === 'CREATE' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="card">
            <h3 className="font-bold mb-4">Nueva Ficha de Cultivo</h3>
            <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              
              <div style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Nombre de la Ficha (Ej: Rábano en Bandeja 1020)</label>
                <input required type="text" className="form-control" value={newType.name} onChange={e => setNewType({...newType, name: e.target.value})} />
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

      {activeTab === 'LIST' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="admin-toolbar" style={{ marginTop: 0 }}>
            <div className="admin-search">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Buscar fichas..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Tipo de Cultivo</th>
                  <th>Receta (Semilla + Sustrato + Envase)</th>
                  <th>Coste Directo (Bandeja)</th>
                  <th>Rendimiento</th>
                  <th>Coste Producción (por Kg)</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {currentData.map(c => {
                  const seedCost = getAverageUnitCost(c.seedId) * Number(c.seedGrams || 0);
                  const subCost = getAverageUnitCost(c.substrateId) * Number(c.substrateLiters || 0);
                  const contCost = getAverageUnitCost(c.containerId) * 1; // 1 container per tray
                  
                  const totalCost = seedCost + subCost + contCost;
                  const expectedKg = Number(c.expectedYieldGrams || 0) / 1000;
                  const costPerKg = expectedKg > 0 ? totalCost / expectedKg : 0;

                  return (
                    <tr key={c.id}>
                      <td className="font-bold text-slate-800">{c.name}</td>
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
                {currentData.length === 0 && (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No has creado ninguna Ficha de Cultivo todavía.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button className="page-btn" onClick={prevPage} disabled={currentPage === 1}>&lt; Ant</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button key={page} className={`page-btn ${currentPage === page ? 'active' : ''}`} onClick={() => goToPage(page)}>{page}</button>
              ))}
              <button className="page-btn" onClick={nextPage} disabled={currentPage === totalPages}>Sig &gt;</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}