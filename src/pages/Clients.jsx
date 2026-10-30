import { useState } from 'react';
import { useData } from '../context/DataContext';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { sanitizeProductDiscounts } from '../utils/clientDiscounts';

const emptyClient = () => ({
  name: '', commercialName: '', email: '', phone: '', address: '',
  postalCode: '', city: '', province: '', nif: '', defaultDiscount: 0,
  productDiscounts: {}, paymentMethod: 'Transferencia', paymentTermsDays: 15,
  billingMode: 'INVOICE'
});

export default function Clients() {
  const { clients, products, addClient, updateClient, deleteClient } = useData();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyClient);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
  const modalCardStyle = { width: '100%', maxWidth: '700px', margin: '20px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', border: '1px solid var(--color-border)' };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name) {
      if (editingId) {
        updateClient(editingId, formData);
      } else {
        addClient(formData);
      }
      setFormData(emptyClient());
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
      productDiscounts: client.productDiscounts || {},
      paymentMethod: client.paymentMethod || 'Transferencia',
      paymentTermsDays: Number(client.paymentTermsDays ?? 15),
      billingMode: client.billingMode || 'INVOICE'
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
    setFormData(emptyClient());
    setIsDiscountModalOpen(false);
    setProductSearch('');
  };

  const setProductDiscount = (productId, value) => {
    setFormData(current => ({
      ...current,
      productDiscounts: sanitizeProductDiscounts({ ...current.productDiscounts, [productId]: value })
    }));
  };

  const removeProductDiscount = (productId) => {
    setFormData(current => {
      const nextDiscounts = { ...current.productDiscounts };
      delete nextDiscounts[productId];
      return { ...current, productDiscounts: nextDiscounts };
    });
  };

  const filteredProducts = products.filter(product =>
    String(product.name || '').toLowerCase().includes(productSearch.trim().toLowerCase())
  );
  const customDiscountCount = Object.keys(formData.productDiscounts || {}).length;

  return (
    <div className="admin-container">
      <div className="admin-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 className="text-2xl font-bold">Gestión de Clientes</h2>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>Directorio de clientes, descuentos y condiciones de pago.</p>
        </div>
        <button className="btn btn-primary shadow-sm" onClick={() => setIsFormOpen(true)}>
          + Nuevo Cliente
        </button>
      </div>

      {isFormOpen && (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <h3 className="font-bold mb-4 text-xl">{editingId ? 'Editar Cliente' : 'Añadir Nuevo Cliente'}</h3>
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
              <label className="form-label">Descuentos</label>
              <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: '0.5rem', alignItems: 'center' }} onClick={() => setIsDiscountModalOpen(true)}>
                <SlidersHorizontal size={16} /> Configurar descuentos
              </button>
              <small className="text-muted">General: {formData.defaultDiscount || 0}%{customDiscountCount > 0 ? ` · ${customDiscountCount} producto${customDiscountCount === 1 ? '' : 's'} personalizado${customDiscountCount === 1 ? '' : 's'}` : ''}</small>
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Forma de Pago (Por Defecto)</label>
              <select className="form-control" value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})}>
                <option value="Transferencia">Transferencia</option>
                <option value="30 Días">30 Días</option>
                <option value="Contado">Contado</option>
              </select>
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Modo de facturación</label>
              <select className="form-control" value={formData.billingMode} onChange={e => setFormData({...formData, billingMode: e.target.value})}>
                <option value="INVOICE">Factura oficial</option>
                <option value="SUMMARY">Albarán resumen</option>
              </select>
              <small className="text-muted">Determina la prefactura mensual y el filtro al crear documentos.</small>
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Plazo de pago (días)</label>
              <input type="number" min="0" max="365" className="form-control" value={formData.paymentTermsDays} onChange={e => setFormData({...formData, paymentTermsDays: Number(e.target.value)})} />
              <small className="text-muted">Se aplicará a las nuevas facturas. Por defecto: 15 días.</small>
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button type="button" className="btn btn-secondary" onClick={cancelForm}>Cancelar</button>
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Guardar Cambios' : 'Guardar Cliente'}
              </button>
            </div>
          </form>
        </div>
        </div>
      )}

      {isDiscountModalOpen && (
        <div style={{ ...modalOverlayStyle, zIndex: 70 }}>
          <div style={{ ...modalCardStyle, maxWidth: '820px' }} role="dialog" aria-modal="true" aria-labelledby="discount-modal-title">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 id="discount-modal-title" className="font-bold text-xl">Descuentos del cliente</h3>
                <p className="text-muted">El descuento general se aplica salvo que indiques otro para un producto.</p>
              </div>
              <button type="button" className="btn btn-secondary" aria-label="Cerrar descuentos" onClick={() => setIsDiscountModalOpen(false)}><X size={18} /></button>
            </div>

            <div className="form-group" style={{ maxWidth: '280px' }}>
              <label className="form-label">Descuento general (%)</label>
              <input type="number" min="0" max="100" className="form-control" value={formData.defaultDiscount} onChange={e => setFormData({...formData, defaultDiscount: Math.min(100, Math.max(0, Number(e.target.value) || 0))})} />
            </div>

            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Search size={17} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input className="form-control" style={{ paddingLeft: '2.3rem' }} placeholder="Buscar producto..." value={productSearch} onChange={e => setProductSearch(e.target.value)} />
            </div>

            <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
              {filteredProducts.length === 0 ? <p className="text-muted text-center py-4">No hay productos que coincidan.</p> : filteredProducts.map(product => {
                const hasCustomDiscount = Object.prototype.hasOwnProperty.call(formData.productDiscounts || {}, product.id);
                return (
                  <div key={product.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 180px 110px', gap: '0.75rem', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
                    <strong>{product.name}</strong>
                    <select className="form-control" value={hasCustomDiscount ? 'CUSTOM' : 'DEFAULT'} onChange={e => e.target.value === 'DEFAULT' ? removeProductDiscount(product.id) : setProductDiscount(product.id, formData.defaultDiscount)}>
                      <option value="DEFAULT">General ({formData.defaultDiscount || 0}%)</option>
                      <option value="CUSTOM">Personalizado</option>
                    </select>
                    <input type="number" min="0" max="100" className="form-control" aria-label={`Descuento para ${product.name}`} disabled={!hasCustomDiscount} value={hasCustomDiscount ? formData.productDiscounts[product.id] : formData.defaultDiscount} onChange={e => setProductDiscount(product.id, e.target.value)} />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="btn btn-primary" onClick={() => setIsDiscountModalOpen(false)}>Aceptar</button>
            </div>
          </div>
        </div>
      )}

      <div className="table-container">
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
                  <th>Facturación</th>
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
                        {Object.keys(client.productDiscounts || {}).length > 0 && <p className="font-semibold text-primary mb-1">Descuentos personalizados: <span className="font-normal">{Object.keys(client.productDiscounts).length} productos</span></p>}
                        <p className="font-semibold mb-1">Plazo de pago: <span className="font-normal">{Number(client.paymentTermsDays ?? 15)} días</span></p>
                      </div>
                    </td>
                    <td><span className={client.billingMode === 'SUMMARY' ? 'client-billing-mode summary' : 'client-billing-mode invoice'}>{client.billingMode === 'SUMMARY' ? 'Albarán' : 'Factura'}</span></td>
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
