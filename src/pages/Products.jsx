import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';

export default function Products() {
  const { products, addProduct, updateProduct, deleteProduct, seeds, productMovements, orders } = useData();
  const [activeTab, setActiveTab] = useState('NEVERA'); // 'NEVERA', 'MOVIMIENTOS', 'CATALOG'
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
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
      
      if (!payload.isMix && payload.recipeSeeds.length > 1) {
          // Si cambian de mix a individual, nos quedamos solo con la primera semilla seleccionada (o vacío si no había)
          payload.recipeSeeds = payload.recipeSeeds.slice(0, 1);
        }

        delete payload.isMix;

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
      isMix: product.recipeSeeds && product.recipeSeeds.length > 1,
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

  const handleDeleteProduct = (productId) => {
    Swal.fire({
      title: '⚠️ ATENCIÓN ADMINISTRACIÓN',
      text: 'Vas a eliminar permanentemente este producto del catálogo. Esta acción no se puede deshacer y afectará a la trazabilidad histórica de los envasados. ¿Estás absolutamente seguro?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar producto',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        deleteProduct(productId);
        Swal.fire('Eliminado', 'El producto ha sido borrado del catálogo.', 'success');
      }
    });
  };

  const generateDemoData = async () => {
    if (!seeds || seeds.length === 0) {
      Swal.fire('Error', 'No hay semillas en la base de datos para crear los productos demo.', 'error');
      return;
    }
    
    Swal.fire({
      title: 'Generando Datos Demo...',
      text: 'Por favor espera, creando fichas de producto y cultivos.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      // 1. Crear productos individuales para cada semilla
      for (const seed of seeds) {
        const exists = products?.find(p => p.name === `Tuppers ${seed.name}`);
        if (!exists) {
          await addProduct({
            name: `Tuppers ${seed.name}`,
            price: 3.50,
            shelfLifeDays: 10,
            isMix: false,
            recipeSeeds: [{ seedId: seed.id }]
          });
        }
      }

      // 2. Crear Mixes Especiales
      const vulcanoSeeds = seeds.filter(s => ['Rúcula', 'Daikon', 'Rambo', 'Mizuna', 'Mostaza'].some(n => s.name.includes(n)));
      if (vulcanoSeeds.length > 0 && !products?.find(p => p.name === 'Vulcano Mix')) {
        await addProduct({
          name: 'Vulcano Mix',
          price: 5.00,
          shelfLifeDays: 10,
          isMix: true,
          recipeSeeds: vulcanoSeeds.map(s => ({ seedId: s.id }))
        });
      }

      const jardinSeeds = seeds.filter(s => ['Brócoli', 'Pak Choi', 'Kale', 'Col Roja', 'Rábano Rosa', 'Remolacha'].some(n => s.name.includes(n)));
      if (jardinSeeds.length > 0 && !products?.find(p => p.name === 'Jardín Esencial Mix')) {
        await addProduct({
          name: 'Jardín Esencial Mix',
          price: 5.50,
          shelfLifeDays: 10,
          isMix: true,
          recipeSeeds: jardinSeeds.map(s => ({ seedId: s.id }))
        });
      }

      // 3. Crear cultivos (Siembras) listos para cosechar (10 bandejas por semilla)
      // Necesitamos importar el contexto general o hacer un alert pidiendo que lo hagan en la otra vista
      Swal.fire('Éxito', 'Fichas de producto individuales y Mixes generados correctamente. Para poblar el invernadero, por favor siembra manualmente unas cuantas bandejas y usa el botón "Ajustar Fase de Cultivo" para pasarlas a Listo (READY).', 'success');
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    }
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

  // --- LOGICA NEVERA (STOCK) ---
  const fridgeStock = useMemo(() => {
    if (!products || !productMovements) return [];
    
    return products.map(product => {
      // 1. Envasados (Stock Físico)
      const movements = productMovements.filter(m => m.productId === product.id);
      const envasados = movements.reduce((sum, m) => sum + Number(m.quantity || 0), 0);
      
      // 2. En Pedidos (Pendientes)
      const pendingOrders = orders?.filter(o => o.status === 'PENDIENTE' || o.status === 'PREPARED' || o.status === 'IN_TRANSIT') || [];
      let enPedidos = 0;
      pendingOrders.forEach(o => {
        if (o.items) {
          o.items.forEach(item => {
            if (item.productId === product.id) enPedidos += Number(item.quantity || 0);
          });
        }
      });
      
      // 3. Sobran (Disponibles)
      const sobran = envasados - enPedidos;

      return {
        ...product,
        stock: envasados,
        enPedidos: enPedidos,
        sobran: sobran,
        stockValue: sobran > 0 ? sobran * Number(product.price || 0) : 0
      };
    }).filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [products, productMovements, orders, searchTerm]);

  const totalFridgeValue = fridgeStock.reduce((sum, p) => sum + p.stockValue, 0);
  const totalTuppers = fridgeStock.reduce((sum, p) => sum + (p.stock > 0 ? p.stock : 0), 0);

  // --- LOGICA MOVIMIENTOS ---
  const filteredMovements = useMemo(() => {
    if (!productMovements) return [];
    return [...productMovements].sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).filter(m => {
      const p = products?.find(prod => prod.id === m.productId);
      return p?.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.type.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [productMovements, products, searchTerm]);

  const getMovementLabel = (type) => {
    switch(type) {
      case 'HARVEST': return <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded text-xs font-bold">COSECHA</span>;
      case 'ORDER': return <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs font-bold">PEDIDO PREPARADO</span>;
      case 'WASTE': return <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-bold">MERMA</span>;
      case 'ADJUST': return <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded text-xs font-bold">AJUSTE</span>;
      case 'RETURN': return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-bold">DEVOLUCIÓN</span>;
      default: return <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded text-xs font-bold">{type}</span>;
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <div>
          <h2 className="text-2xl font-bold">Nevera y Catálogo</h2>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>Gestión de producto terminado y lista de precios.</p>
        </div>
        {activeTab === 'CATALOG' && (
          <button className="btn btn-primary" onClick={isAdding ? cancelForm : () => setIsAdding(true)}>
            {isAdding ? 'Cancelar' : '+ Nuevo Producto'}
          </button>
        )}
      </div>

      <div className="admin-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button className={`admin-tab ${activeTab === 'NEVERA' ? 'active' : ''}`} onClick={() => setActiveTab('NEVERA')}>Stock Actual (Nevera)</button>
        <button className={`admin-tab ${activeTab === 'MOVIMIENTOS' ? 'active' : ''}`} onClick={() => setActiveTab('MOVIMIENTOS')}>Registro de Movimientos</button>
        <button className={`admin-tab ${activeTab === 'CATALOG' ? 'active' : ''}`} onClick={() => setActiveTab('CATALOG')}>Catálogo / Recetas</button>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input type="text" placeholder="Buscar producto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {activeTab === 'NEVERA' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="flex justify-between items-center mb-6">
             <div>
               <h3 className="font-bold text-lg">Stock de Producto Terminado</h3>
               <p className="text-muted text-sm">Inventario físico de bandejas/tuppers listos para la venta.</p>
             </div>
             <div className="flex gap-4">
               <div className="text-right bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
                 <p className="text-muted text-xs font-semibold mb-0 text-emerald-800">TUPPERS TOTALES</p>
                 <h3 className="font-bold text-2xl text-emerald-600 m-0">{totalTuppers} ud</h3>
               </div>
               <div className="text-right bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
                 <p className="text-muted text-xs font-semibold mb-0 text-indigo-800">VALOR VENTA NEVERA</p>
                 <h3 className="font-bold text-2xl text-indigo-600 m-0">{totalFridgeValue.toFixed(2)} €</h3>
               </div>
             </div>
          </div>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Producto (Variedad)</th>
                  <th>📦 Envasados</th>
                  <th>🛒 En Pedidos</th>
                  <th>✅ Disp. (Sobran)</th>
                </tr>
              </thead>
              <tbody>
                {fridgeStock.map(p => (
                  <tr key={p.id}>
                    <td className="font-bold text-slate-800">
                      {p.name}
                      {p.isMix && <div className="text-xs text-amber-600 mt-1">🌿 Mix / Mezcla</div>}
                    </td>
                    <td className="text-slate-600">{Number(p.price).toFixed(2)} € / ud</td>
                    <td className="font-bold text-slate-600 text-lg">{p.stock}</td>
                    <td className="font-bold text-orange-500 text-lg">{p.enPedidos > 0 ? p.enPedidos : '-'}</td>
                    <td className={`font-bold text-xl ${p.sobran > 0 ? 'text-emerald-600' : p.sobran < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {p.sobran} <span className="text-sm font-normal text-slate-500">ud</span>
                    </td>
                  </tr>
                ))}
                {fridgeStock.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-slate-500">No hay productos que coincidan con la búsqueda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'MOVIMIENTOS' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Tipo</th>
                  <th>Producto</th>
                  <th>Cant.</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map(m => {
                  const product = products?.find(p => p.id === m.productId);
                  const isPositive = Number(m.quantity) > 0;
                  return (
                    <tr key={m.id}>
                      <td className="text-sm text-slate-500">{new Date(m.createdAt).toLocaleString()}</td>
                      <td>{getMovementLabel(m.type)}</td>
                      <td className="font-bold">{product?.name || 'Producto Eliminado'}</td>
                      <td className={`font-bold ${isPositive ? 'text-emerald-600' : 'text-orange-600'}`}>
                        {isPositive ? '+' : ''}{m.quantity} ud
                      </td>
                      <td className="text-xs text-slate-400">{m.referenceId || '-'}</td>
                    </tr>
                  );
                })}
                {filteredMovements.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-8 text-slate-500">No hay movimientos registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'CATALOG' && (
        <div style={{ animation: 'fadeIn 0.3s ease' }}>
          {isAdding && (
            <div className="card mb-6" style={{ maxWidth: '600px' }}>
              <h3 className="font-bold mb-4 text-xl">{editingId ? 'Editar Producto' : 'Añadir Nuevo Producto'}</h3>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-group mb-0">
                      <label className="form-label font-bold text-gray-700">Nombre del Producto</label>
                      <input type="text" className="form-input" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ej: Tuppers Rúcula, Mix Primavera..." />
                    </div>
                    <div className="form-group mb-0">
                      <label className="form-label font-bold text-gray-700">Precio Venta (€)</label>
                      <input type="number" step="0.01" className="form-input" required value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="0.00" />
                    </div>
                  </div>
                  
                  <div className="form-group mb-0">
                    <label className="form-label font-bold text-gray-700">Días de Caducidad (Etiqueta)</label>
                    <input type="number" min="1" className="form-input" required value={formData.shelfLifeDays} onChange={e => setFormData({...formData, shelfLifeDays: e.target.value})} placeholder="Ej: 10" />
                  </div>

                  <div className="form-group mb-0 p-4 bg-slate-800 rounded-lg border border-slate-700">
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input type="checkbox" checked={formData.isMix} onChange={e => setFormData({...formData, isMix: e.target.checked})} className="w-5 h-5 rounded text-green-500 focus:ring-green-500 bg-slate-700 border-slate-600" />
                      <span className="font-bold text-gray-300">¿Es un Mix (Mezcla de varias variedades)?</span>
                    </label>
                    <p className="text-xs text-gray-400 mb-0">Si es un mix, seleccionarás múltiples semillas. Si no, seleccionarás una sola variedad base.</p>
                  </div>

                  {!formData.isMix ? (
                    <div className="form-group mb-0 p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <label className="form-label font-bold text-slate-700 mb-2">Variedad (Semilla Principal)</label>
                      <select 
                        className="form-input" 
                        required 
                        value={formData.recipeSeeds.length > 0 ? formData.recipeSeeds[0].seedId : ''}
                        onChange={e => setFormData({...formData, recipeSeeds: [{ seedId: e.target.value }]})}
                      >
                        <option value="">-- Selecciona una semilla --</option>
                        {(seeds || []).map(seed => (
                          <option key={seed.id} value={seed.id}>{seed.name}</option>
                        ))}
                      </select>
                      {formData.recipeSeeds.length === 0 && (
                        <p className="text-xs text-red-500 mt-2 font-bold">Debes seleccionar la semilla base para la trazabilidad.</p>
                      )}
                    </div>
                  ) : (
                    <div className="form-group mb-0 p-4 bg-indigo-900/30 rounded-lg border border-indigo-500/30">
                      <label className="form-label font-bold text-indigo-300 mb-3">Receta del Mix (Selecciona las semillas que lo componen)</label>
                      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {(seeds || []).map(seed => {
                          const isSelected = formData.recipeSeeds.find(s => s.seedId === seed.id);
                          return (
                            <label key={seed.id} className={`p-2 rounded cursor-pointer border text-sm flex items-center gap-3 transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-700 border-slate-600 text-gray-300 hover:bg-slate-600'}`}>
                              <input 
                                type="checkbox"
                                checked={!!isSelected}
                                onChange={() => toggleSeedInRecipe(seed.id)}
                                className="w-5 h-5 rounded text-indigo-500 focus:ring-indigo-500 border-slate-400 bg-slate-800"
                              />
                              <span className="truncate font-semibold" title={seed.name}>{seed.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      {formData.recipeSeeds.length === 0 && (
                        <p className="text-xs text-red-400 mt-2 font-bold">Debes seleccionar al menos una semilla para el mix.</p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 justify-end mt-4">
                    <button type="button" className="btn btn-secondary" onClick={cancelForm}>Cancelar</button>
                    <button type="submit" className="btn btn-primary" disabled={formData.recipeSeeds.length === 0}>Guardar Producto</button>
                  </div>
                </form>
            </div>
          )}

          <div className="grid">
            {products?.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => (
              <div key={product.id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg text-emerald-400">{product.name}</h3>
                  <div className="flex gap-2">
                    <button className="text-blue-400 hover:text-blue-300" onClick={() => handleEditClick(product)} title="Editar">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button className="text-red-400 hover:text-red-300" onClick={() => handleDeleteProduct(product.id)} title="Eliminar">
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="16" height="16"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
                
                <div className="text-2xl font-bold text-white mb-4">
                  {Number(product.price).toFixed(2)} €
                  <span className="text-sm font-normal text-gray-400 ml-1">/ unidad</span>
                </div>

                <div className="bg-slate-800 rounded p-3 mt-4">
                  <p className="text-xs text-gray-400 mb-1">Días de Caducidad (Etiqueta): <strong className="text-gray-200">{product.shelfLifeDays || 10} días</strong></p>
                  {product.recipeSeeds && product.recipeSeeds.length > 0 ? (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Receta / Trazabilidad:</p>
                      <div className="flex flex-wrap gap-1">
                        {product.recipeSeeds.map(rs => {
                          const seed = seeds?.find(s => s.id === rs.seedId);
                          return <span key={rs.seedId} className="px-2 py-1 bg-indigo-900/50 text-indigo-300 rounded text-[10px] font-bold border border-indigo-700">{seed ? seed.name : 'Semilla Eliminada'}</span>
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 mb-0 italic">Producto simple (Sin mix / receta)</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
