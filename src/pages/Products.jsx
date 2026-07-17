import { useState } from 'react';
import { useData } from '../context/DataContext';

export default function Products() {
  const { products, addProduct, updateProduct, deleteProduct, seeds } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ 
    name: '', 
    price: '', 
    shelfLifeDays: 10,
    isMix: false,
    recipeSeeds: []
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.price) {
      const payload = { 
        ...formData, 
        price: parseFloat(formData.price),
        shelfLifeDays: parseInt(formData.shelfLifeDays) || 10
      };
      
      if (!payload.isMix) {
        payload.recipeSeeds = [];
      }

      if (editingId) {
        updateProduct(editingId, payload);
      } else {
        addProduct(payload);
      }
      cancelForm();
    }
  };

  const handleEditClick = (product) => {
    setFormData({ 
      name: product.name, 
      price: product.price,
      shelfLifeDays: product.shelfLifeDays || 10,
      isMix: product.recipeSeeds && product.recipeSeeds.length > 0,
      recipeSeeds: product.recipeSeeds || []
    });
    setEditingId(product.id);
    setIsAdding(true);
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo(0, 0);
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', price: '', shelfLifeDays: 10, isMix: false, recipeSeeds: [] });
  };

  const toggleSeedInRecipe = (seedId) => {
    setFormData(prev => {
      const exists = prev.recipeSeeds.find(s => s.seedId === seedId);
      if (exists) {
        return { ...prev, recipeSeeds: prev.recipeSeeds.filter(s => s.seedId !== seedId) };
      } else {
        return { ...prev, recipeSeeds: [...prev.recipeSeeds, { seedId }] };
      }
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Catálogo de Productos y Recetas</h2>
        <button className="btn btn-primary" onClick={isAdding ? cancelForm : () => setIsAdding(true)}>
          {isAdding ? 'Cancelar' : '+ Nuevo Producto'}
        </button>
      </div>

      {isAdding && (
        <div className="card mb-6" style={{ maxWidth: '600px' }}>
          <h3 className="font-bold mb-4 text-xl">{editingId ? 'Editar Producto' : 'Añadir Nuevo Producto'}</h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group mb-0">
                <label className="form-label font-bold text-gray-300">Nombre del Producto / Variedad</label>
                <input type="text" className="form-control" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Brotes de Rábano o Vulcano Mix" />
              </div>
              <div className="form-group mb-0">
                <label className="form-label font-bold text-gray-300">Precio de Venta (€)</label>
                <input type="number" step="0.01" min="0" className="form-control" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="Ej: 12.50" />
              </div>
            </div>

            <div className="form-group mb-0">
              <label className="form-label font-bold text-gray-300 flex items-center gap-2">
                Días de Caducidad
                <span className="text-xs text-blue-400 font-normal">Para la etiqueta de Sanidad</span>
              </label>
              <input type="number" min="1" className="form-control w-1/3" required value={formData.shelfLifeDays} onChange={e => setFormData({...formData, shelfLifeDays: e.target.value})} />
            </div>

            <div className="form-group mb-0 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 text-primary bg-slate-700 border-slate-600 rounded"
                  checked={formData.isMix}
                  onChange={e => setFormData({...formData, isMix: e.target.checked})}
                />
                <span className="font-bold text-gray-200">Este producto es un MIX (Receta de varias semillas)</span>
              </label>

              {formData.isMix && (
                <div className="mt-4 pl-6 border-l-2 border-primary/30">
                  <p className="text-sm text-gray-400 mb-3">Selecciona las semillas que componen este mix.</p>
                  
                  {seeds && seeds.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {seeds.map(seed => {
                        const isSelected = formData.recipeSeeds.some(s => s.seedId === seed.id);
                        return (
                          <label key={seed.id} className={\`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors \${isSelected ? 'bg-primary/20 border border-primary/50' : 'bg-slate-700/50 border border-transparent hover:bg-slate-700'}\`}>
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSeedInRecipe(seed.id)}
                              className="hidden"
                            />
                            <div className={\`w-4 h-4 rounded-full border flex items-center justify-center \${isSelected ? 'bg-primary border-primary' : 'border-gray-500'}\`}>
                              {isSelected && <div className="w-2 h-2 bg-slate-900 rounded-full"></div>}
                            </div>
                            <span className={isSelected ? 'text-white' : 'text-gray-300'}>{seed.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-yellow-500 text-sm p-3 bg-yellow-500/10 rounded border border-yellow-500/20">
                      ⚠️ No tienes ninguna Semilla registrada. Ve al módulo de Cultivos para crear tu inventario de semillas.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={cancelForm}>Cancelar</button>
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Guardar Cambios' : 'Guardar Producto'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.length === 0 ? (
          <div className="col-span-full card text-center py-8">
            <p className="text-muted">No hay productos registrados en el catálogo.</p>
          </div>
        ) : (
          products.map(product => {
            const isMix = product.recipeSeeds && product.recipeSeeds.length > 0;
            return (
              <div key={product.id} className="card flex flex-col justify-between relative overflow-hidden border-t-4 border-t-primary">
                {isMix && (
                  <div className="absolute top-0 right-0 bg-primary text-slate-900 text-xs font-bold px-3 py-1 rounded-bl-lg">
                    MIX / RECETA
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-bold mb-1">{product.name}</h3>
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-2xl text-primary font-bold">{Number(product.price).toFixed(2)} €</p>
                    <span className="text-xs text-gray-400 bg-slate-800 px-2 py-1 rounded-full border border-slate-700">
                      ⏱️ {product.shelfLifeDays || 10} días caduc.
                    </span>
                  </div>
                  
                  {isMix && (
                    <div className="bg-slate-800/80 p-3 rounded-lg mt-2 mb-4">
                      <p className="text-xs text-gray-400 font-bold mb-2 uppercase tracking-wider">Composición:</p>
                      <ul className="text-sm text-gray-300 flex flex-wrap gap-1">
                        {product.recipeSeeds.map(rs => {
                          const seedDef = seeds?.find(s => s.id === rs.seedId);
                          return (
                            <li key={rs.seedId} className="bg-slate-700 px-2 py-1 rounded text-xs">
                              🌱 {seedDef ? seedDef.name : 'Semilla eliminada'}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700 flex justify-end gap-2">
                  <button className="btn btn-secondary text-sm py-1" onClick={() => handleEditClick(product)}>
                    Editar
                  </button>
                  <button className="btn btn-danger text-sm py-1" onClick={() => deleteProduct(product.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
