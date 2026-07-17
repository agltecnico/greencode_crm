import { useState } from 'react';
import { useData } from '../context/DataContext';

export default function Products() {
  const { products, addProduct, updateProduct, deleteProduct } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', price: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.price) {
      if (editingId) {
        updateProduct(editingId, { ...formData, price: parseFloat(formData.price) });
      } else {
        addProduct({ ...formData, price: parseFloat(formData.price) });
      }
      setFormData({ name: '', price: '' });
      setIsAdding(false);
      setEditingId(null);
    }
  };

  const handleEditClick = (product) => {
    setFormData({ name: product.name, price: product.price });
    setEditingId(product.id);
    setIsAdding(true);
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo(0, 0);
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', price: '' });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Catálogo de Productos</h2>
        <button className="btn btn-primary" onClick={isAdding ? cancelForm : () => setIsAdding(true)}>
          {isAdding ? 'Cancelar' : '+ Nuevo Producto'}
        </button>
      </div>

      {isAdding && (
        <div className="card mb-6" style={{ maxWidth: '500px' }}>
          <h3 className="font-bold mb-4">{editingId ? 'Editar Microgreen' : 'Añadir Nuevo Microgreen'}</h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="form-group mb-0">
              <label className="form-label">Nombre de Variedad</label>
              <input type="text" className="form-control" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Brotes de Rábano" />
            </div>
            <div className="form-group mb-0">
              <label className="form-label">Precio Unitario (€)</label>
              <input type="number" step="0.01" min="0" className="form-control" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="Ej: 12.50" />
            </div>
            <div className="mt-2 flex justify-end">
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Guardar Cambios' : 'Guardar Producto'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {products.length === 0 ? (
          <div className="col-span-3 card text-center py-8">
            <p className="text-muted">No hay productos registrados en el catálogo.</p>
          </div>
        ) : (
          products.map(product => (
            <div key={product.id} className="card flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">{product.name}</h3>
                <p className="text-2xl text-primary font-bold">{Number(product.price).toFixed(2)} €</p>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleEditClick(product)}>
                  Editar
                </button>
                <button className="btn btn-danger" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => deleteProduct(product.id)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
