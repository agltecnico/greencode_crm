import { useState, Fragment } from 'react';
import { useData } from '../context/DataContext';

export default function Orders() {
  const { clients, products, orders, addOrder, markOrderAsDelivered, deleteOrder, updateOrderList } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  
  const [clientId, setClientId] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [isFree, setIsFree] = useState(false);
  
  const [deliveringOrderId, setDeliveringOrderId] = useState(null);
  const [deliveredToName, setDeliveredToName] = useState('');
  
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);

  // Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterClientId, setFilterClientId] = useState('');

  // Editing state
  const [editingOrder, setEditingOrder] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  
  // State for newly added item in edit modal
  const [editNewItemProduct, setEditNewItemProduct] = useState('');
  const [editNewItemPrice, setEditNewItemPrice] = useState('');
  const [editNewItemQuantity, setEditNewItemQuantity] = useState(1);
  const [editNewItemDiscount, setEditNewItemDiscount] = useState(0);
  const [editNewIsFree, setEditNewIsFree] = useState(false);

  const openEditModal = (order) => {
    setEditingOrder(order);
    
    let parsedDate = '';
    try {
      parsedDate = order.date ? order.date.split('T')[0] : new Date().toISOString().split('T')[0];
    } catch(e) { parsedDate = ''; }

    setEditFormData({
      date: parsedDate,
      clientId: order.clientId,
      deliveredTo: order.deliveredTo || '',
      items: JSON.parse(JSON.stringify(order.items || []))
    });
  };

  const handleEditItemChange = (index, field, value) => {
    const updatedItems = [...editFormData.items];
    updatedItems[index][field] = Number(value);
    setEditFormData({ ...editFormData, items: updatedItems });
  };

  const handleEditNewProductChange = (e) => {
    const pId = e.target.value;
    setEditNewItemProduct(pId);
    if (pId) {
      const prod = products.find(p => p.id === pId);
      if (prod) setEditNewItemPrice(prod.price);
    } else {
      setEditNewItemPrice('');
    }
  };

  const handleAddEditItem = () => {
    if (!editNewItemProduct) return;
    const prod = products.find(p => p.id === editNewItemProduct);
    if (!prod) return;
    const newItem = {
      productId: prod.id,
      name: editNewIsFree ? `${prod.name} (Sin cargo)` : prod.name,
      price: editNewIsFree ? 0 : (editNewItemPrice !== '' ? Number(editNewItemPrice) : prod.price),
      quantity: Number(editNewItemQuantity),
      discount: editNewIsFree ? 0 : Number(editNewItemDiscount)
    };
    setEditFormData({
      ...editFormData,
      items: [...editFormData.items, newItem]
    });
    setEditNewItemProduct('');
    setEditNewItemPrice('');
    setEditNewItemQuantity(1);
    setEditNewItemDiscount(0);
    setEditNewIsFree(false);
  };
  
  const handleRemoveEditItem = (index) => {
    const updatedItems = [...editFormData.items];
    updatedItems.splice(index, 1);
    setEditFormData({ ...editFormData, items: updatedItems });
  };

  const handleSaveEdit = () => {
    const newTotal = editFormData.items.reduce((sum, item) => {
      const lineTotal = (item.price * item.quantity) * (1 - item.discount / 100);
      return sum + lineTotal;
    }, 0);

    let safeDate = new Date().toISOString();
    try {
      if (editFormData.date) safeDate = new Date(editFormData.date).toISOString();
    } catch(e) {}

    updateOrderList(editingOrder.id, {
      date: safeDate,
      clientId: editFormData.clientId,
      items: editFormData.items,
      total: newTotal,
      deliveredTo: editFormData.deliveredTo
    });
    setEditingOrder(null);
    setEditFormData(null);
  };

  const handleClientChange = (e) => {
    const newClientId = e.target.value;
    setClientId(newClientId);
    if (newClientId) {
      const client = clients.find(c => c.id === newClientId);
      setDiscount(client ? (client.defaultDiscount || 0) : 0);
    } else {
      setDiscount(0);
    }
  };

  const handleAddItem = () => {
    if (!selectedProductId) return;
    const product = products.find(p => p.id === selectedProductId);
    if (!product) return;

    const newItem = {
      productId: product.id,
      name: isFree ? `${product.name} (Sin cargo)` : product.name,
      price: isFree ? 0 : (customPrice !== '' ? Number(customPrice) : product.price),
      quantity: Number(quantity),
      discount: isFree ? 0 : Number(discount)
    };
    
    setOrderItems([...orderItems, newItem]);
    setSelectedProductId('');
    setCustomPrice('');
    setQuantity(1);
    setIsFree(false);
    
    // Reset discount to client default for next item
    const client = clients.find(c => c.id === clientId);
    setDiscount(client ? (client.defaultDiscount || 0) : 0);
  };

  const handleRemoveItem = (index) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleProductChange = (e) => {
    const pId = e.target.value;
    setSelectedProductId(pId);
    if (pId) {
      const product = products.find(p => p.id === pId);
      if (product) setCustomPrice(product.price);
    } else {
      setCustomPrice('');
    }
  };

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => {
      const lineTotal = (item.price * item.quantity) * (1 - item.discount / 100);
      return sum + lineTotal;
    }, 0);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!clientId || orderItems.length === 0) return;

    let safeDate = new Date().toISOString();
    try {
      if (orderDate) safeDate = new Date(orderDate).toISOString();
    } catch(e) {}

    const newOrder = {
      clientId,
      items: orderItems,
      total: calculateTotal(),
      date: safeDate
    };

    addOrder(newOrder);
    setIsAdding(false);
    setClientId('');
    setOrderItems([]);
    setDiscount(0);
    setOrderDate(new Date().toISOString().split('T')[0]);
  };

  const filteredOrders = orders.filter(order => {
    if (filterStartDate) {
      const orderDate = new Date(order.date).getTime();
      const start = new Date(filterStartDate).getTime();
      if (orderDate < start) return false;
    }
    if (filterEndDate) {
      const orderDate = new Date(order.date).getTime();
      const end = new Date(filterEndDate).getTime() + 86400000; // include full end day
      if (orderDate >= end) return false;
    }
    if (filterClientId && order.clientId !== filterClientId) {
      return false;
    }
    return true;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Pedidos</h2>
        <button className="btn btn-primary" onClick={() => setIsAdding(!isAdding)}>
          {isAdding ? 'Cancelar' : '+ Nuevo Pedido'}
        </button>
      </div>

      {isAdding && (
        <div className="card mb-6">
          <h3 className="font-bold mb-4">Crear Pedido</h3>
          <form onSubmit={handleSubmit}>
            <div className="flex gap-4 mb-6">
              <div className="flex-1 max-w-md">
                <label className="form-label">Seleccionar Cliente</label>
                <select className="form-control" value={clientId} onChange={handleClientChange} required>
                  <option value="">-- Elige un cliente --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.commercialName || c.name} ({c.clientNumber})</option>)}
                </select>
              </div>
              <div className="flex-1 max-w-xs">
                <label className="form-label">Fecha del Pedido</label>
                <input type="date" className="form-control" required value={orderDate} onChange={e => setOrderDate(e.target.value)} />
              </div>
            </div>

            <div className="border border-color-border rounded-lg p-4 mb-6 bg-color-background">
              <h4 className="font-semibold mb-3">Añadir Línea de Pedido</h4>
              <div className="grid grid-cols-5 gap-4 items-end">
                <div>
                  <label className="form-label">Producto</label>
                  <select className="form-control" value={selectedProductId} onChange={handleProductChange}>
                    <option value="">-- Seleccionar --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.price}€)</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Precio (€)</label>
                  <input type="number" step="0.01" min="0" className="form-control" value={isFree ? 0 : customPrice} onChange={e => setCustomPrice(e.target.value)} disabled={isFree} />
                </div>
                <div>
                  <label className="form-label">Cantidad</label>
                  <input type="number" min="1" className="form-control" value={quantity} onChange={e => setQuantity(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Descuento (%)</label>
                  <input type="number" min="0" max="100" className="form-control" value={isFree ? 0 : discount} onChange={e => setDiscount(e.target.value)} disabled={isFree} />
                </div>
                <div className="flex flex-col items-center justify-center pt-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs" style={{ color: 'var(--color-primary)' }}>
                    <input type="checkbox" checked={isFree} onChange={e => setIsFree(e.target.checked)} />
                    Sin cargo
                  </label>
                </div>
                <div>
                  <button type="button" className="btn btn-secondary w-full" onClick={handleAddItem}>Añadir</button>
                </div>
              </div>
            </div>

            {orderItems.length > 0 && (
              <div className="mb-6 table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Precio Unit.</th>
                      <th>Cantidad</th>
                      <th>Descuento</th>
                      <th>Total Línea</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item, index) => {
                      const lineTotal = (item.price * item.quantity) * (1 - item.discount / 100);
                      return (
                        <tr key={index}>
                          <td>{item.name}</td>
                          <td>{item.price.toFixed(2)} €</td>
                          <td>{item.quantity}</td>
                          <td>{item.discount}%</td>
                          <td className="font-semibold">{lineTotal.toFixed(2)} €</td>
                          <td>
                            <button type="button" className="btn btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleRemoveItem(index)}>Quitar</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="4" className="text-right font-bold text-lg pt-4 pb-4">TOTAL:</td>
                      <td colSpan="2" className="font-bold text-primary text-xl pt-4 pb-4">{calculateTotal().toFixed(2)} €</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-4">
              <button type="submit" className="btn btn-primary" disabled={!clientId || orderItems.length === 0}>
                Guardar Pedido
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filtros */}
      <div className="card mb-4" style={{ padding: '0.75rem 1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-secondary)' }}>Filtros:</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', flex: 1, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Desde:</span>
            <input type="date" className="form-control" style={{ width: 'auto', padding: '0.35rem 0.5rem', fontSize: '0.8rem', height: '32px' }} value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Hasta:</span>
            <input type="date" className="form-control" style={{ width: 'auto', padding: '0.35rem 0.5rem', fontSize: '0.8rem', height: '32px' }} value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flex: '1', minWidth: '150px', maxWidth: '280px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>Cliente:</span>
            <select className="form-control" style={{ padding: '0.35rem 0.5rem', fontSize: '0.8rem', height: '32px' }} value={filterClientId} onChange={e => setFilterClientId(e.target.value)}>
              <option value="">Todos los clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.commercialName || c.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
           <button className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', height: '32px' }} onClick={() => {
             setFilterStartDate('');
             setFilterEndDate('');
             setFilterClientId('');
           }}>Limpiar</button>
           
        </div>
      </div>

            <div className="card">
        {filteredOrders.length === 0 ? (
          <p className="text-muted text-center py-4">No hay pedidos que coincidan con los filtros.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ref.</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th style={{ width: '220px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => {
                  const client = clients.find(c => c.id === order.clientId);
                  return (
                    <Fragment key={order.id}>
                      <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <td className="text-muted font-mono">{order.id.slice(-6)}</td>
                        <td>{new Date(order.date).toLocaleDateString()}</td>
                        <td className="font-medium">{client ? (client.commercialName || client.name) : 'Desconocido'}</td>
                        <td className="font-bold">{order.total.toFixed(2)} €</td>
                        <td className="flex gap-2 items-center flex-wrap">
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                            onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                          >
                            {expandedOrderId === order.id ? 'Ocultar' : 'Ver'}
                          </button>
                          
                          {order.status === 'PENDING' ? (
                            deliveringOrderId === order.id ? (
                              <div className="flex flex-col gap-2">
                                <input 
                                  type="text" 
                                  className="form-control" 
                                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                                  placeholder="Nombre persona"
                                  value={deliveredToName}
                                  onChange={(e) => setDeliveredToName(e.target.value)}
                                  autoFocus
                                />
                                <div className="flex gap-1 justify-end">
                                  <button 
                                    className="btn btn-secondary" 
                                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                                    onClick={() => setDeliveringOrderId(null)}
                                  >
                                    Cancelar
                                  </button>
                                  <button 
                                    className="btn btn-primary" 
                                    style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem' }}
                                    onClick={() => {
                                      markOrderAsDelivered(order.id, deliveredToName);
                                      setDeliveringOrderId(null);
                                    }}
                                  >
                                    Confirmar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button 
                                className="btn btn-success"
                                style={{ backgroundColor: 'var(--color-success)', color: 'white', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                                onClick={() => { setDeliveringOrderId(order.id); setDeliveredToName(''); }}
                              >
                                Marcar ENTREGADO
                              </button>
                            )
                          ) : (
                            <span className="text-secondary font-bold text-xs">ENTREGADO</span>
                          )}

                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                            onClick={() => openEditModal(order)}
                            title="Editar Pedido"
                          >
                            Editar
                          </button>
                          
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                            onClick={() => {
                              if (window.confirm('¿Estás seguro de que quieres eliminar este pedido permanentemente?')) {
                                deleteOrder(order.id);
                              }
                            }}
                            title="Eliminar pedido"
                          >
                            X
                          </button>
                        </td>
                      </tr>
                      {expandedOrderId === order.id && (
                        <tr style={{ backgroundColor: 'rgba(0,0,0,0.02)' }}>
                          <td colSpan="5" className="p-4 rounded-lg shadow-inner">
                            <h4 className="font-bold mb-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>Detalles del Pedido</h4>
                            <table className="table" style={{ fontSize: '0.9rem', marginBottom: 0 }}>
                              <thead style={{ backgroundColor: 'transparent' }}>
                                <tr>
                                  <th>Producto</th>
                                  <th>Precio Unit.</th>
                                  <th>Cantidad</th>
                                  <th>Descuento</th>
                                  <th>Total Línea</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items.map((item, i) => {
                                  const lineTotal = (item.price * item.quantity) * (1 - item.discount / 100);
                                  return (
                                    <tr key={i}>
                                      <td>{item.name}</td>
                                      <td>{item.price.toFixed(2)} €</td>
                                      <td>{item.quantity}</td>
                                      <td>{item.discount}%</td>
                                      <td className="font-semibold">{lineTotal.toFixed(2)} €</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                }).reverse()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingOrder && editFormData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '100%', maxWidth: '700px', margin: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 className="text-xl font-bold mb-4">Editar Pedido</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="form-group mb-0">
                <label className="form-label">Cliente Asociado</label>
                <select className="form-control" value={editFormData.clientId} onChange={e => setEditFormData({...editFormData, clientId: e.target.value})}>
                  <option value="">-- Seleccionar --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.commercialName || c.name}</option>)}
                </select>
              </div>
              <div className="form-group mb-0">
                <label className="form-label">Fecha del Pedido</label>
                <input type="date" className="form-control" value={editFormData.date} onChange={e => setEditFormData({...editFormData, date: e.target.value})} />
              </div>
            </div>
            
            {editingOrder.status === 'DELIVERED' && (
              <div className="form-group mb-4">
                <label className="form-label font-bold text-success">Entregado a (Nombre del receptor)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ border: '1px solid var(--color-success)', backgroundColor: 'rgba(16,185,129,0.05)' }}
                  value={editFormData.deliveredTo} 
                  onChange={e => setEditFormData({...editFormData, deliveredTo: e.target.value})} 
                  placeholder="Ej: Juan Pérez"
                />
              </div>
            )}

            <h4 className="font-semibold mb-2 mt-4">Líneas de Producto</h4>
            <div className="table-container mb-6">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ width: '100px' }}>Precio Unit. (€)</th>
                    <th style={{ width: '90px' }}>Cant.</th>
                    <th style={{ width: '90px' }}>Desc. (%)</th>
                    <th style={{ width: '80px' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {editFormData.items.map((item, index) => (
                    <tr key={index}>
                      <td className="font-medium align-middle">{item.name}</td>
                      <td>
                        <input type="number" step="0.01" min="0" className="form-control" style={{ padding: '0.3rem' }} value={item.price} onChange={e => handleEditItemChange(index, 'price', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" min="1" className="form-control" style={{ padding: '0.3rem' }} value={item.quantity} onChange={e => handleEditItemChange(index, 'quantity', e.target.value)} />
                      </td>
                      <td>
                        <input type="number" min="0" max="100" className="form-control" style={{ padding: '0.3rem' }} value={item.discount} onChange={e => handleEditItemChange(index, 'discount', e.target.value)} />
                      </td>
                      <td>
                        <button type="button" className="btn btn-danger" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => handleRemoveEditItem(index)}>Quitar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-color-background border border-color-border rounded-lg p-3 mb-6">
              <h5 className="font-semibold text-sm mb-2">Añadir Nuevo Artículo</h5>
              <div className="grid grid-cols-6 gap-3 items-end">
                <div>
                  <select className="form-control" style={{ fontSize: '0.8rem', padding: '0.3rem' }} value={editNewItemProduct} onChange={handleEditNewProductChange}>
                    <option value="">-- Producto --</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <input type="number" step="0.01" min="0" placeholder="Precio" className="form-control" style={{ fontSize: '0.8rem', padding: '0.3rem' }} value={editNewIsFree ? 0 : editNewItemPrice} onChange={e => setEditNewItemPrice(e.target.value)} disabled={editNewIsFree} />
                </div>
                <div>
                  <input type="number" min="1" placeholder="Cant." className="form-control" style={{ fontSize: '0.8rem', padding: '0.3rem' }} value={editNewItemQuantity} onChange={e => setEditNewItemQuantity(e.target.value)} />
                </div>
                <div>
                  <input type="number" min="0" max="100" placeholder="Desc. %" className="form-control" style={{ fontSize: '0.8rem', padding: '0.3rem' }} value={editNewIsFree ? 0 : editNewItemDiscount} onChange={e => setEditNewItemDiscount(e.target.value)} disabled={editNewIsFree} />
                </div>
                <div className="flex justify-center pb-2">
                  <label className="flex items-center gap-1 cursor-pointer font-bold" style={{ color: 'var(--color-primary)', fontSize: '0.7rem' }}>
                    <input type="checkbox" checked={editNewIsFree} onChange={e => setEditNewIsFree(e.target.checked)} />
                    Regalo
                  </label>
                </div>
                <div>
                  <button type="button" className="btn btn-secondary w-full" style={{ padding: '0.3rem', fontSize: '0.8rem' }} onClick={handleAddEditItem}>Añadir</button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button className="btn btn-secondary" onClick={() => {
                setEditingOrder(null);
                setEditFormData(null);
              }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
