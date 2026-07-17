import { useState } from 'react';
import { useData } from '../context/DataContext';

export default function Supplies() {
  const { 
    providers, addProvider, deleteProvider,
    seeds, addSeed, deleteSeed,
    seedInventory, addSeedInventory, deleteSeedInventory
  } = useData();

  const [activeTab, setActiveTab] = useState('catalogo');

  // Forms State
  const [newProvider, setNewProvider] = useState({ name: '', contactInfo: '' });
  const [newSeed, setNewSeed] = useState({ name: '', providerId: '', soakingHours: 0, germinationDays: 3, darknessDays: 2, lightDays: 5, expectedYieldGrams: 0 });
  const [newInventory, setNewInventory] = useState({ seedId: '', providerBatch: '', weightGrams: 1000, purchaseDate: new Date().toISOString().split('T')[0] });
      
  const handleAddProvider = e => { e.preventDefault(); addProvider(newProvider); setNewProvider({name:'', contactInfo:''}); };
  const handleAddSeed = e => { e.preventDefault(); addSeed(newSeed); setNewSeed({...newSeed, name:''}); };
  const handleAddInventory = e => { e.preventDefault(); addSeedInventory(newInventory); setNewInventory({...newInventory, providerBatch:''}); };

  const renderCatalogo = () => (
    <div>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>Gestión de Proveedores</h2>
        <form onSubmit={handleAddProvider} style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <input required type="text" placeholder="Nombre del Proveedor" value={newProvider.name} onChange={e => setNewProvider({...newProvider, name: e.target.value})} className="input" />
          <input type="text" placeholder="Contacto (Email/Tel)" value={newProvider.contactInfo} onChange={e => setNewProvider({...newProvider, contactInfo: e.target.value})} className="input" />
          <button type="submit" className="btn btn-primary">Añadir Proveedor</button>
        </form>
        
        <table className="table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Contacto</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {providers?.map(p => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.contactInfo}</td>
                <td>
                  <button onClick={() => deleteProvider(p.id)} className="btn btn-danger" style={{ padding: '0.2rem 0.5rem' }}>Eliminar</button>
                </td>
              </tr>
            ))}
            {(!providers || providers.length === 0) && <tr><td colSpan="3" style={{textAlign: 'center'}}>No hay proveedores.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Catálogo de Variedades de Semillas</h2>
        <form onSubmit={handleAddSeed} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          <input required type="text" placeholder="Variedad (ej. Rábano Sango)" value={newSeed.name} onChange={e => setNewSeed({...newSeed, name: e.target.value})} className="input" />
          <select required value={newSeed.providerId} onChange={e => setNewSeed({...newSeed, providerId: e.target.value})} className="input">
            <option value="">Seleccionar Proveedor...</option>
            {providers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input required type="number" placeholder="Horas Remojo" value={newSeed.soakingHours} onChange={e => setNewSeed({...newSeed, soakingHours: Number(e.target.value)})} className="input" title="Horas de remojo" />
          <input required type="number" placeholder="Días Germinación" value={newSeed.germinationDays} onChange={e => setNewSeed({...newSeed, germinationDays: Number(e.target.value)})} className="input" title="Días germinación" />
          <input required type="number" placeholder="Días Oscuridad" value={newSeed.darknessDays} onChange={e => setNewSeed({...newSeed, darknessDays: Number(e.target.value)})} className="input" title="Días oscuridad" />
          <input required type="number" placeholder="Días Luz" value={newSeed.lightDays} onChange={e => setNewSeed({...newSeed, lightDays: Number(e.target.value)})} className="input" title="Días luz" />
          <input required type="number" placeholder="Rendimiento (g)" value={newSeed.expectedYieldGrams} onChange={e => setNewSeed({...newSeed, expectedYieldGrams: Number(e.target.value)})} className="input" title="Rendimiento esperado por bandeja en gramos" />
          <button type="submit" className="btn btn-primary">Añadir Semilla</button>
        </form>

        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Variedad</th>
                <th>Proveedor</th>
                <th>Remojo (h)</th>
                <th>Germinación (d)</th>
                <th>Oscuridad (d)</th>
                <th>Luz (d)</th>
                <th>Rendimiento (g)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {seeds?.map(s => {
                const prov = providers?.find(p => p.id === s.providerId);
                return (
                  <tr key={s.id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{prov?.name || 'Desconocido'}</td>
                    <td>{s.soakingHours}</td>
                    <td>{s.germinationDays}</td>
                    <td>{s.darknessDays}</td>
                    <td>{s.lightDays}</td>
                    <td>{s.expectedYieldGrams} g</td>
                    <td>
                      <button onClick={() => deleteSeed(s.id)} className="btn btn-danger" style={{ padding: '0.2rem 0.5rem' }}>Eliminar</button>
                    </td>
                  </tr>
                );
              })}
              {(!seeds || seeds.length === 0) && <tr><td colSpan="8" style={{textAlign: 'center'}}>No hay semillas en el catálogo.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderInventario = () => (
    <div>
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2>Registrar Compra de Semillas</h2>
        <form onSubmit={handleAddInventory} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          <select required value={newInventory.seedId} onChange={e => setNewInventory({...newInventory, seedId: e.target.value})} className="input">
            <option value="">Seleccionar Semilla...</option>
            {seeds?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <input required type="text" placeholder="Lote Proveedor" value={newInventory.providerBatch} onChange={e => setNewInventory({...newInventory, providerBatch: e.target.value})} className="input" />
          <input required type="number" placeholder="Peso (gramos)" value={newInventory.weightGrams} onChange={e => setNewInventory({...newInventory, weightGrams: Number(e.target.value)})} className="input" title="Peso total comprado en gramos" />
          <input required type="date" value={newInventory.purchaseDate} onChange={e => setNewInventory({...newInventory, purchaseDate: e.target.value})} className="input" />
          <button type="submit" className="btn btn-primary">Registrar Compra</button>
        </form>
      </div>

      <div className="card">
        <h2>Stock de Semillas y Lotes</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Variedad</th>
              <th>Lote Proveedor</th>
              <th>Peso Original</th>
              <th>Fecha Compra</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {seedInventory?.map(inv => {
              const seed = seeds?.find(s => s.id === inv.seedId);
              return (
                <tr key={inv.id}>
                  <td><strong>{seed?.name || 'Desconocida'}</strong></td>
                  <td>{inv.providerBatch}</td>
                  <td>{inv.weightGrams} g</td>
                  <td>{new Date(inv.purchaseDate).toLocaleDateString()}</td>
                  <td>
                    <button onClick={() => deleteSeedInventory(inv.id)} className="btn btn-danger" style={{ padding: '0.2rem 0.5rem' }}>Eliminar</button>
                  </td>
                </tr>
              );
            })}
            {(!seedInventory || seedInventory.length === 0) && <tr><td colSpan="5" style={{textAlign: 'center'}}>No hay compras registradas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="admin-page-container" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid #e2e8f0', paddingBottom: '1rem' }}>
        <button 
            onClick={() => setActiveTab('catalogo')}
            style={{ 
              padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', 
              background: activeTab === 'catalogo' ? '#0ea5e9' : 'transparent', 
              color: activeTab === 'catalogo' ? 'white' : '#64748b', 
              fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' 
            }}>
            Catálogo de Variedades
        </button>
        <button 
            onClick={() => setActiveTab('inventario')}
            style={{ 
              padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', 
              background: activeTab === 'inventario' ? '#0ea5e9' : 'transparent', 
              color: activeTab === 'inventario' ? 'white' : '#64748b', 
              fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' 
            }}>
            Registro de Compras y Stock
        </button>
      </div>

      <div style={{ animation: 'fadeIn 0.3s ease' }}>
        {activeTab === 'catalogo' && renderCatalogo()}
        {activeTab === 'inventario' && renderInventario()}
      </div>
    </div>
  );
}
