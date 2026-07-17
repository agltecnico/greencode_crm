import { useState } from 'react';
import { useData } from '../context/DataContext';
import { usePagination } from '../hooks/usePagination';

export default function Providers() {
  const { providers, addProvider, deleteProvider } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [newProvider, setNewProvider] = useState({ name: '', contact: '', phone: '', email: '' });

  const handleAdd = e => { 
    e.preventDefault(); 
    addProvider(newProvider); 
    setNewProvider({name:'', contact:'', phone:'', email:''}); 
  };

  const filteredProviders = providers?.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) || [];
  const { currentData, currentPage, totalPages, goToPage, nextPage, prevPage } = usePagination(filteredProviders, 10);

  return (
    <div className="admin-container" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="admin-header">
        <div>
          <h2 className="text-2xl font-bold">Proveedores</h2>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>Directorio de empresas de las que adquieres semillas, sustratos y servicios.</p>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Buscar proveedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 className="font-bold mb-4">Añadir Nuevo Proveedor</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label">Nombre del Proveedor</label>
            <input required type="text" className="form-control" value={newProvider.name} onChange={e => setNewProvider({...newProvider, name: e.target.value})} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label">Persona de Contacto</label>
            <input type="text" className="form-control" value={newProvider.contact} onChange={e => setNewProvider({...newProvider, contact: e.target.value})} />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label className="form-label">Teléfono</label>
            <input type="text" className="form-control" value={newProvider.phone} onChange={e => setNewProvider({...newProvider, phone: e.target.value})} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label className="form-label">Email</label>
            <input type="email" className="form-control" value={newProvider.email} onChange={e => setNewProvider({...newProvider, email: e.target.value})} />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>Guardar Proveedor</button>
        </form>
      </div>

      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nombre del Proveedor</th>
              <th>Contacto</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map(p => (
              <tr key={p.id}>
                <td className="font-bold">{p.name}</td>
                <td>{p.contact || '-'}</td>
                <td>{p.phone || '-'}</td>
                <td>{p.email || '-'}</td>
                <td>
                  <button className="btn btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }} onClick={() => deleteProvider(p.id)}>Borrar</button>
                </td>
              </tr>
            ))}
            {currentData.length === 0 && (
              <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No hay proveedores registrados.</td></tr>
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
  );
}
