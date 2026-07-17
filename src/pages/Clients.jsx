import { useState } from 'react';
import { useData } from '../context/DataContext';

export default function Clients() {
  const { clients, addClient, updateClient, deleteClient } = useData();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', commercialName: '', email: '', phone: '', address: '', 
    postalCode: '', city: '', province: '', nif: '', defaultDiscount: 0,
    paymentMethod: 'Transferencia'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name) {
      if (editingId) {
        updateClient(editingId, formData);
      } else {
        addClient(formData);
      }
      setFormData({ name: '', commercialName: '', email: '', phone: '', address: '', postalCode: '', city: '', province: '', nif: '', defaultDiscount: 0, paymentMethod: 'Transferencia' });
      setIsFormOpen(false);
      setEditingId(null);
    }
  };

  const handleEditClick = (client) => {
    setFormData({
      name: client.name || '',
        commercialName: client.commercialName || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      postalCode: client.postalCode || '',
      city: client.city || '',
      province: client.province || '',
      nif: client.nif || '',
      defaultDiscount: client.defaultDiscount || 0,
      paymentMethod: client.paymentMethod || 'Transferencia'
    });
    setEditingId(client.id);
    setIsFormOpen(true);
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo(0, 0);
  };

  const cancelForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setFormData({ name: '', commercialName: '', email: '', phone: '', address: '', postalCode: '', city: '', province: '', nif: '', defaultDiscount: 0, paymentMethod: 'Transferencia' });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Gestión de Clientes</h2>
        <button className="btn btn-primary" onClick={isFormOpen ? cancelForm : () => setIsFormOpen(true)}>
          {isFormOpen ? 'Cancelar' : '+ Nuevo Cliente'}
        </button>
      </div>

      {isFormOpen && (
        <div className="card mb-6">
          <h3 className="font-bold mb-4">{editingId ? 'Editar Cliente' : 'Añadir Nuevo Cliente'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Nombre del Cliente / Empresa</label>
              <input type="text" className="form-control" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            </div>
            <div className="form-group">
                <label className="form-label">Nombre Comercial</label>
                <input type="text" className="form-control" value={formData.commercialName || ''} onChange={e => setFormData({...formData, commercialName: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">NIF / CIF</label>
              <input type="text" className="form-control" value={formData.nif} onChange={e => setFormData({...formData, nif: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-control" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input type="text" className="form-control" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">Dirección</label>
              <input type="text" className="form-control" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Código Postal</label>
              <input type="text" className="form-control" value={formData.postalCode} onChange={e => setFormData({...formData, postalCode: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Población / Ciudad</label>
              <input type="text" className="form-control" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Provincia</label>
              <input type="text" className="form-control" value={formData.province} onChange={e => setFormData({...formData, province: e.target.value})} />
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Descuento (%) Por Defecto</label>
              <input type="number" min="0" max="100" className="form-control" value={formData.defaultDiscount} onChange={e => setFormData({...formData, defaultDiscount: Number(e.target.value)})} />
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Forma de Pago (Por Defecto)</label>
              <select className="form-control" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                <option value="Transferencia">Transferencia</option>
                <option value="30 Días">30 Días</option>
                <option value="Contado">Contado</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Guardar Cambios' : 'Guardar Cliente'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {clients.length === 0 ? (
          <p className="text-muted text-center py-4">No hay clientes registrados.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Nombre Comercial / Fiscal</th>
                  <th>NIF/CIF</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[...clients].sort((a,b) => (a.commercialName || a.name || "").localeCompare(b.commercialName || b.name || "")).map(client => (
                  <tr key={client.id}>
                    <td className="font-bold text-primary">{client.clientNumber}</td>
                    <td className="font-medium">
                      <div className="font-bold">{client.commercialName || client.name}</div>
                      {client.commercialName && client.name !== client.commercialName && <div className="text-xs text-gray-500">{client.name}</div>}
                    </td>
                    <td>{client.nif || '-'}</td>
                    <td>
                      {client.email || '-'}
                      <div className="text-sm mt-3 pt-3 border-t border-[rgba(0,0,0,0.05)]">
                        <p className="font-semibold mb-1">Dirección: <span className="font-normal">{client.address || '-'}</span></p>
                        {(client.postalCode || client.city || client.province) && (
                          <p className="font-semibold mb-1">C.P. / Pobl.: <span className="font-normal">{`${client.postalCode || ''} ${client.city || ''} ${client.province ? '('+client.province+')' : ''}`.trim()}</span></p>
                        )}
                        {client.defaultDiscount > 0 && <p className="font-semibold text-primary mb-1">Descuento por defecto: <span className="font-normal">{client.defaultDiscount}%</span></p>}
                      </div>
                    </td>
                    <td>{client.phone || '-'}</td>
                    <td className="flex gap-2">
                      <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleEditClick(client)}>
                        Editar
                      </button>
                      <button className="btn btn-danger" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }} onClick={() => deleteClient(client.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
