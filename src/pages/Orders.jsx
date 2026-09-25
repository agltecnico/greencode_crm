import Swal from 'sweetalert2';
import { useState, Fragment } from 'react';
import { CalendarDays, Plus, Search, ShoppingBag, Trash2, UserRound, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePagination } from '../hooks/usePagination';

export default function Orders() {
  const {
    clients, products, orders, deliveryNotes, invoices, productMovements,
    addOrder, deleteOrder, updateOrderList
  } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  
  const [clientId, setClientId] = useState('');
  const [orderItems, setOrderItems] = useState([]);
  
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [isFree, setIsFree] = useState(false);
  
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);

  // Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterClientId, setFilterClientId] = useState('');

  const [activeTab, setActiveTab] = useState('PENDING');
  const [searchTerm, setSearchTerm] = useState('');


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
    const associatedNotes = deliveryNotes.filter(note => note.orderId === order.id);
    const isBilled = associatedNotes.some(note => note.status === 'BILLED')
      || invoices.some(invoice => invoice.deliveryNoteIds?.some(id => associatedNotes.some(note => note.id === id)));
    if (isBilled) {
      Swal.fire({
        title: 'Pedido ya facturado',
        text: 'Para modificarlo debes anular primero la factura asociada. Así evitamos que pedido, albarán y factura tengan importes distintos.',
        icon: 'warning',
        confirmButtonColor: '#059669'
      });
      return;
    }
    setEditingOrder(order);
    
    const parsedDate = String(order.date || '').slice(0, 10) || new Date().toISOString().split('T')[0];

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
      if (prod) setEditNewItemPrice(prod.salePrice ?? prod.price ?? 0);
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
      price: editNewIsFree ? 0 : (editNewItemPrice !== '' ? Number(editNewItemPrice) : Number(prod.salePrice ?? prod.price ?? 0)),
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

  const handleSaveEdit = async () => {
    if (!editFormData.clientId || editFormData.items.length === 0) {
      await Swal.fire('Faltan datos', 'Selecciona un cliente y añade al menos un producto.', 'warning');
      return;
    }
    const invalidItem = editFormData.items.some(item =>
      !item.productId || Number(item.quantity) <= 0 || Number(item.price) < 0
      || Number(item.discount) < 0 || Number(item.discount) > 100
    );
    if (invalidItem) {
      await Swal.fire('Revisa las líneas', 'Las cantidades, precios o descuentos no son válidos.', 'warning');
      return;
    }
    const newTotal = editFormData.items.reduce((sum, item) => {
      const lineTotal = (item.price * item.quantity) * (1 - item.discount / 100);
      return sum + lineTotal;
    }, 0);

    const parsedDate = new Date(editFormData.date);
    const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

    const saved = await updateOrderList(editingOrder.id, {
      date: safeDate,
      clientId: editFormData.clientId,
      items: editFormData.items,
      total: newTotal,
      deliveredTo: editFormData.deliveredTo
    });
    if (!saved) return;
    setEditingOrder(null);
    setEditFormData(null);
    await Swal.fire({ title: 'Pedido actualizado', text: 'Los cambios se han guardado y el albarán asociado se ha sincronizado.', icon: 'success', timer: 1800, showConfirmButton: false });
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
      if (product) setCustomPrice(product.salePrice ?? product.price ?? 0);
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

  const closeCreateModal = () => {
    setIsAdding(false);
    setClientId('');
    setOrderItems([]);
    setSelectedProductId('');
    setCustomPrice('');
    setQuantity(1);
    setDiscount(0);
    setIsFree(false);
    setOrderDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!clientId || orderItems.length === 0) return;

    const parsedDate = new Date(orderDate);
    const safeDate = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();

    const newOrder = {
      clientId,
      items: orderItems,
      total: calculateTotal(),
      date: safeDate
    };

    addOrder(newOrder);
    closeCreateModal();
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

  
  const heavilyFilteredOrders = filteredOrders.filter(order => {
    // Tab filter
    if (activeTab !== 'ALL' && order.status !== activeTab) return false;
    
    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const client = clients.find(c => c.id === order.clientId);
      const clientName = client ? (client.commercialName || client.name).toLowerCase() : '';
      if (!order.id.toLowerCase().includes(term) && !clientName.includes(term)) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    const currentDay = new Date();
    currentDay.setHours(0, 0, 0, 0);
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    const distanceA = Number.isNaN(dateA.getTime()) ? Number.POSITIVE_INFINITY : Math.abs(dateA.setHours(0, 0, 0, 0) - currentDay.getTime());
    const distanceB = Number.isNaN(dateB.getTime()) ? Number.POSITIVE_INFINITY : Math.abs(dateB.setHours(0, 0, 0, 0) - currentDay.getTime());
    if (distanceA !== distanceB) return distanceA - distanceB;
    return new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0);
  });

  const { currentData: paginatedData, currentPage, totalPages, nextPage, prevPage, goToPage } = usePagination(heavilyFilteredOrders, 10);
  const editingInventoryLocked = editingOrder
    ? productMovements.some(movement =>
        movement.type === 'ORDER'
        && (movement.referenceId === editingOrder.id || movement.referenceId?.startsWith(`${editingOrder.id}|`))
      )
    : false;
  
  return (
    <div className="admin-container orders-page-clean">
      <div className="admin-header">
        <div>
          <span className="orders-eyebrow">VENTAS</span>
          <h2 className="text-2xl font-bold">Pedidos</h2>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>Consulta, prepara y registra pedidos desde una sola vista.</p>
        </div>
        <button className="orders-primary-action" onClick={() => setIsAdding(true)}><Plus size={18}/> Nuevo pedido</button>
      </div>

      <div className="admin-tabs">
        {['ALL', 'PENDING', 'PREPARED', 'IN_TRANSIT', 'DELIVERED'].map(tab => {
          const labels = {
            ALL: 'Todos',
            PENDING: 'Pendientes',
            PREPARED: 'Preparados',
            IN_TRANSIT: 'En reparto',
            DELIVERED: 'Entregados'
          };
          const count = tab === 'ALL' ? orders.length : orders.filter(order => order.status === tab).length;
          return (
            <button 
              key={tab}
              className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {labels[tab]} <small>{count}</small>
            </button>
          );
        })}
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Buscar por cliente, ID o fecha..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input 
            type="date" 
            className="form-control" 
            style={{ width: 'auto' }}
            value={filterStartDate} 
            onChange={e => setFilterStartDate(e.target.value)} 
          />
          <input 
            type="date" 
            className="form-control" 
            style={{ width: 'auto' }}
            value={filterEndDate} 
            onChange={e => setFilterEndDate(e.target.value)} 
          />
          <select 
            className="form-control" 
            style={{ width: 'auto' }}
            value={filterClientId} 
            onChange={e => setFilterClientId(e.target.value)}
          >
            <option value="">Todos los clientes</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.commercialName || c.name}</option>)}
          </select>
        </div>
      </div>

      {isAdding && <div className="order-create-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) closeCreateModal(); }}>
        <form className="order-create-modal" onSubmit={handleSubmit} role="dialog" aria-modal="true" aria-label="Crear nuevo pedido">
          <header className="order-create-header">
            <div className="order-create-title"><i><ShoppingBag/></i><div><span>NUEVO PEDIDO</span><h3>Crear pedido</h3><p>Selecciona el cliente y añade los productos.</p></div></div>
            <div className="order-create-head-fields">
              <label><span><UserRound size={14}/> Cliente</span><select value={clientId} onChange={handleClientChange} required><option value="">Seleccionar cliente…</option>{clients.map(client => <option key={client.id} value={client.id}>{client.commercialName || client.name}</option>)}</select></label>
              <label><span><CalendarDays size={14}/> Fecha</span><input type="date" value={orderDate} onChange={event => setOrderDate(event.target.value)} required/></label>
            </div>
            <button type="button" className="order-create-close" onClick={closeCreateModal} aria-label="Cerrar"><X/></button>
          </header>

          <main className="order-create-body">
            <section className="order-create-add">
              <div className="order-create-section-title"><div><span>1</span><h4>Añadir artículo</h4></div><small>El precio se carga automáticamente y puedes modificarlo.</small></div>
              <div className="order-create-line-form">
                <label className="order-create-product"><span>Producto</span><select value={selectedProductId} onChange={handleProductChange}><option value="">Buscar y seleccionar producto…</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} · {Number(product.salePrice ?? product.price ?? 0).toFixed(2)} €</option>)}</select></label>
                <label><span>Precio</span><input type="number" min="0" step="0.01" value={customPrice} onChange={event => setCustomPrice(event.target.value)}/></label>
                <label><span>Cantidad</span><input type="number" min="1" value={quantity} onChange={event => setQuantity(Number(event.target.value))}/></label>
                <label><span>Dto. %</span><input type="number" min="0" max="100" value={discount} onChange={event => setDiscount(Number(event.target.value))}/></label>
                <label className="order-create-free"><input type="checkbox" checked={isFree} onChange={event => setIsFree(event.target.checked)}/><span>Sin cargo</span></label>
                <button type="button" onClick={handleAddItem} disabled={!selectedProductId}><Plus size={17}/> Añadir</button>
              </div>
            </section>

            <section className="order-create-lines">
              <div className="order-create-section-title"><div><span>2</span><h4>Artículos del pedido</h4></div><small>{orderItems.length} líneas · {orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0)} unidades</small></div>
              {orderItems.length ? <div className="table-container"><table><thead><tr><th>Producto</th><th>Precio</th><th>Cantidad</th><th>Descuento</th><th>Total</th><th/></tr></thead><tbody>{orderItems.map((item, index) => {
                const lineTotal = Number(item.price) * Number(item.quantity) * (1 - Number(item.discount) / 100);
                return <tr key={`${item.productId}-${index}`}><td><strong>{item.name}</strong></td><td>{Number(item.price).toFixed(2)} €</td><td>{item.quantity}</td><td>{item.discount || 0} %</td><td><strong>{lineTotal.toFixed(2)} €</strong></td><td><button type="button" onClick={() => handleRemoveItem(index)} aria-label={`Quitar ${item.name}`}><Trash2 size={16}/></button></td></tr>;
              })}</tbody></table></div> : <div className="order-create-empty"><Search/><strong>El pedido está vacío</strong><span>Selecciona un producto arriba para empezar.</span></div>}
            </section>
          </main>

          <footer className="order-create-footer"><div><span>Total del pedido</span><strong>{calculateTotal().toFixed(2)} €</strong><small>Impuestos incluidos según producto</small></div><button type="button" onClick={closeCreateModal}>Cancelar</button><button type="submit" className="primary" disabled={!clientId || !orderItems.length}>Guardar pedido</button></footer>
        </form>
      </div>}

      {editingOrder && editFormData && (
        <div className="order-edit-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setEditingOrder(null); }}>
          <section className="order-edit-modal" role="dialog" aria-modal="true" aria-label={`Editar pedido ${editingOrder.id.slice(-6)}`}>
            <header>
              <div><span>EDICIÓN DE PEDIDO</span><h3>Pedido #{editingOrder.id.slice(-6)}</h3><p>Los cambios se sincronizan con el albarán asociado.</p></div>
              <button type="button" aria-label="Cerrar" onClick={() => setEditingOrder(null)}>×</button>
            </header>

            <div className="order-edit-body">
              {editingInventoryLocked && (
                <div className="order-edit-warning">
                  Este pedido ya descontó producto con trazabilidad. Puedes corregir cliente, fecha, entrega, precios y descuentos, pero no cambiar productos ni cantidades.
                </div>
              )}

              <div className="order-edit-fields">
                <label>Cliente
                  <select className="form-control" value={editFormData.clientId} onChange={event => setEditFormData({ ...editFormData, clientId: event.target.value })}>
                    <option value="">Selecciona un cliente</option>
                    {clients.map(client => <option key={client.id} value={client.id}>{client.commercialName || client.name}</option>)}
                  </select>
                </label>
                <label>Fecha del pedido
                  <input className="form-control" type="date" value={editFormData.date} onChange={event => setEditFormData({ ...editFormData, date: event.target.value })} />
                </label>
                <label>Persona que recibió
                  <input className="form-control" value={editFormData.deliveredTo} onChange={event => setEditFormData({ ...editFormData, deliveredTo: event.target.value })} placeholder="Opcional" />
                </label>
              </div>

              {!editingInventoryLocked && (
                <div className="order-edit-add-line">
                  <select className="form-control" value={editNewItemProduct} onChange={handleEditNewProductChange}>
                    <option value="">Añadir producto…</option>
                    {products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
                  </select>
                  <input className="form-control" type="number" min="0" step="0.01" value={editNewItemPrice} onChange={event => setEditNewItemPrice(event.target.value)} placeholder="Precio" />
                  <input className="form-control" type="number" min="1" value={editNewItemQuantity} onChange={event => setEditNewItemQuantity(Number(event.target.value))} aria-label="Cantidad" />
                  <input className="form-control" type="number" min="0" max="100" value={editNewItemDiscount} onChange={event => setEditNewItemDiscount(Number(event.target.value))} aria-label="Descuento" />
                  <label className="order-edit-free"><input type="checkbox" checked={editNewIsFree} onChange={event => setEditNewIsFree(event.target.checked)} /> Gratis</label>
                  <button type="button" className="btn btn-secondary" onClick={handleAddEditItem}>Añadir</button>
                </div>
              )}

              <div className="order-edit-lines">
                <table>
                  <thead><tr><th>Producto</th><th>Precio</th><th>Cantidad</th><th>Dto.</th><th>Total</th><th /></tr></thead>
                  <tbody>
                    {editFormData.items.map((item, index) => {
                      const lineTotal = Number(item.price || 0) * Number(item.quantity || 0) * (1 - Number(item.discount || 0) / 100);
                      return (
                        <tr key={`${item.productId}-${index}`}>
                          <td><strong>{products.find(product => product.id === item.productId)?.name || item.name}</strong></td>
                          <td><input type="number" min="0" step="0.01" value={item.price} onChange={event => handleEditItemChange(index, 'price', event.target.value)} /></td>
                          <td><input type="number" min="1" disabled={editingInventoryLocked} value={item.quantity} onChange={event => handleEditItemChange(index, 'quantity', event.target.value)} /></td>
                          <td><input type="number" min="0" max="100" value={item.discount || 0} onChange={event => handleEditItemChange(index, 'discount', event.target.value)} /></td>
                          <td><strong>{lineTotal.toFixed(2)} €</strong></td>
                          <td>{!editingInventoryLocked && <button type="button" onClick={() => handleRemoveEditItem(index)}>Quitar</button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <footer>
              <div><span>Nuevo total</span><strong>{editFormData.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0) * (1 - Number(item.discount || 0) / 100), 0).toFixed(2)} €</strong></div>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingOrder(null)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveEdit}>Guardar cambios</button>
            </footer>
          </section>
        </div>
      )}

      <div className="table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Referencia</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Estado</th>
              <th>Importe</th>
              <th style={{ width: '220px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.map(order => {
              const client = clients.find(c => c.id === order.clientId);
              
              let statusBadgeClass = 'pending';
              let statusText = 'PENDIENTE';
              if(order.status === 'PREPARED') { statusBadgeClass = 'prepared'; statusText = 'PREPARADO'; }
              if(order.status === 'IN_TRANSIT') { statusBadgeClass = 'intransit'; statusText = 'EN REPARTO'; }
              if(order.status === 'DELIVERED') { statusBadgeClass = 'delivered'; statusText = 'ENTREGADO'; }

              return (
                <Fragment key={order.id}>
                  <tr>
                    <td className="text-muted font-mono" style={{ fontSize: '0.9rem' }}>#{order.id.slice(-6)}</td>
                    <td>{new Date(order.date).toLocaleDateString()}</td>
                    <td className="font-medium">{client ? (client.commercialName || client.name) : 'Desconocido'}</td>
                    <td>
                      <span className={`status-badge ${statusBadgeClass}`}>{statusText}</span>
                    </td>
                    <td className="font-bold">{order.total?.toFixed(2)} €</td>
                    <td className="flex gap-2 items-center flex-wrap">
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                        onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                      >
                        {expandedOrderId === order.id ? 'Ocultar' : 'Ver Detalles'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                        onClick={() => openEditModal(order)}
                      >
                        Editar
                      </button>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: 'transparent', color: '#ef4444', border: '1px solid #ef4444' }}
                        onClick={() => { Swal.fire({text: '¿Seguro que quieres eliminar este pedido?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#94a3b8', confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar'}).then(r => { if(r.isConfirmed) deleteOrder(order.id); }) }}
                      >
                        X
                      </button>
                    </td>
                  </tr>
                  
                  {expandedOrderId === order.id && (
                    <tr style={{ background: '#f8fafc' }}>
                      <td colSpan="6" style={{ padding: '1.5rem' }}>
                        <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '1rem' }}>
                          <h4 className="font-bold mb-3 text-sm text-slate-500 uppercase">Detalle de Líneas</h4>
                          <table className="admin-table" style={{ background: 'transparent' }}>
                            <thead>
                              <tr>
                                <th>Producto</th>
                                <th>Precio Unit.</th>
                                <th>Cant.</th>
                                <th>Dto.</th>
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
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            
            {paginatedData.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                  No se han encontrado pedidos que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="page-btn" onClick={prevPage} disabled={currentPage === 1}>&lt; Anterior</button>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <button 
                key={page} 
                className={`page-btn ${currentPage === page ? 'active' : ''}`}
                onClick={() => goToPage(page)}
              >
                {page}
              </button>
            ))}
          </div>
          <button className="page-btn" onClick={nextPage} disabled={currentPage === totalPages}>Siguiente &gt;</button>
        </div>
      )}
    </div>
  );
}
