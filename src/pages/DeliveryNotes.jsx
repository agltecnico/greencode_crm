import Swal from 'sweetalert2';
import { useState, Fragment } from 'react';
import { useData } from '../context/DataContext';
import { generateDeliveryNotePDF, generateDeliveryNoteBlob } from '../utils/pdf';

export default function DeliveryNotes() {
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterClientId, setFilterClientId] = useState('');
  const { deliveryNotes, updateDeliveryNote, deleteDeliveryNote, clients, products } = useData();
  const [sharingAlbaran, setSharingAlbaran] = useState(null);
  const [sharePhone, setSharePhone] = useState('');
  const [shareEmail, setShareEmail] = useState('');

  // Editing state
  const [editingAlbaran, setEditingAlbaran] = useState(null);
  const [editFormData, setEditFormData] = useState(null);

  // State for newly added item in edit modal
  const [editNewItemProduct, setEditNewItemProduct] = useState('');
  const [editNewItemPrice, setEditNewItemPrice] = useState('');
  const [editNewItemQuantity, setEditNewItemQuantity] = useState(1);
  const [editNewItemDiscount, setEditNewItemDiscount] = useState(0);
  const [editNewIsFree, setEditNewIsFree] = useState(false);

  const handleDownloadPDF = async (albaran) => {
    const client = clients.find(c => c.id === albaran.clientId);
    if (client) {
      await generateDeliveryNotePDF(albaran, client);
    }
  };

  const handleViewPDF = async (albaran) => {
    const client = clients.find(c => c.id === albaran.clientId);
    if (client) {
      const blob = await generateDeliveryNoteBlob(albaran, client);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

  const openShareModal = (albaran) => {
    const client = clients.find(c => c.id === albaran.clientId);
    setSharingAlbaran(albaran);
    setSharePhone(client?.phone || '');
    setShareEmail(client?.email || '');
  };

  const handleSendWhatsApp = () => {
    if (!sharePhone) return;
    const client = clients.find(c => c.id === sharingAlbaran.clientId);
    // Format phone: remove spaces/symbols. Default to Spain +34 if not specified
    let formattedPhone = sharePhone.replace(/\D/g, '');
    if (formattedPhone.length === 9) {
       formattedPhone = '34' + formattedPhone;
    }
    const deliveredText = sharingAlbaran.deliveredTo ? ` a ${sharingAlbaran.deliveredTo}` : '';
    const text = `🌱 Hola ${client?.name}, su pedido de microgreens de GreenCode ha sido entregado${deliveredText}. Aquí tiene su albarán ALB-${sharingAlbaran.albaranNumber || sharingAlbaran.id.slice(-6)}. ¡Muchas gracias por confiar en nosotros! 🥙`;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) { window.location.href = `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`; } else { window.open(`https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`, '_blank'); }
    updateDeliveryNote(sharingAlbaran.id, { sent: true });
    setSharingAlbaran(null);
  };

  const handleSendEmail = () => {
    if (!shareEmail) return;
    const client = clients.find(c => c.id === sharingAlbaran.clientId);
    const subject = `Su Albarán de GreenCode - ALB-${sharingAlbaran.albaranNumber || sharingAlbaran.id.slice(-6)}`;
    const deliveredText = sharingAlbaran.deliveredTo ? ` a ${sharingAlbaran.deliveredTo}` : '';
    const body = `🌱 Hola ${client?.name},\n\nSu pedido de microgreens de GreenCode ha sido entregado${deliveredText}.\n\nAdjunto le enviamos el albarán de entrega correspondiente por un total de ${sharingAlbaran.total.toFixed(2)} €.\n\n¡Muchas gracias por confiar en nosotros!\n\nUn saludo,\nEquipo GreenCode 🥙`;
    window.open(`mailto:${shareEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    updateDeliveryNote(sharingAlbaran.id, { sent: true });
    setSharingAlbaran(null);
  };

  const handleNativeShare = async () => {
    const client = clients.find(c => c.id === sharingAlbaran.clientId);
    if (!client) return;
    
    try {
      const blob = await generateDeliveryNoteBlob(sharingAlbaran, client);
      const file = new File([blob], `Albaran_${sharingAlbaran.albaranNumber || sharingAlbaran.id.slice(-6)}_${client.name}.pdf`, { type: 'application/pdf' });
      
      const deliveredText = sharingAlbaran.deliveredTo ? ` a ${sharingAlbaran.deliveredTo}` : '';
      const text = `🌱 Hola ${client.name}, su pedido de microgreens de GreenCode ha sido entregado${deliveredText}. Aquí tiene su albarán. ¡Gracias! 🥙`;
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Albarán ALB-${sharingAlbaran.albaranNumber || sharingAlbaran.id.slice(-6)}`,
          text: text
        });
      } else {
        alert("Tu dispositivo o navegador no soporta enviar archivos directamente adjuntos (común en PC). \n\nPor favor, descarga el PDF primero usando el botón de la lista y adjúntalo manualmente en WhatsApp Web o en tu correo.");
      }
    } catch (e) {
      console.error("Error sharing file:", e);
    }
  };

  // --- EDITING LOGIC ---
  const openEditModal = (albaran) => {
    setEditingAlbaran(albaran);
    
    let parsedDate = '';
    try {
      parsedDate = albaran.date ? albaran.date.split('T')[0] : new Date().toISOString().split('T')[0];
    } catch(e) { parsedDate = ''; }

    setEditFormData({
      date: parsedDate,
      clientId: albaran.clientId,
      deliveredTo: albaran.deliveredTo || '',
      items: JSON.parse(JSON.stringify(albaran.items || [])) // deep copy
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
    // Recalculate total
    const newTotal = editFormData.items.reduce((sum, item) => {
      const lineTotal = (item.price * item.quantity) * (1 - item.discount / 100);
      return sum + lineTotal;
    }, 0);

    // Combine date while keeping time roughly the same or just passing the date
    updateDeliveryNote(editingAlbaran.id, {
      date: new Date(editFormData.date).toISOString(),
      clientId: editFormData.clientId,
      deliveredTo: editFormData.deliveredTo,
      items: editFormData.items,
      total: newTotal
    });
    setEditingAlbaran(null);
    setEditFormData(null);
  };

  const filteredNotes = deliveryNotes.filter(dn => {
    if (filterStartDate) {
      const start = new Date(filterStartDate).getTime();
      const noteTime = new Date(dn.date).getTime();
      if (noteTime < start) return false;
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate).getTime() + 86400000;
      const noteTime = new Date(dn.date).getTime();
      if (noteTime > end) return false;
    }
    if (filterClientId && dn.clientId !== filterClientId) {
      return false;
    }
    return true;
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Albaranes de Entrega</h2>
      </div>

      {/* Filtros */}
      <div className="card mb-4" style={{ padding: '0.75rem 1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem', backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--color-secondary)' }}>Buscar:</span>
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
        <div>
           <button className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', height: '32px' }} onClick={() => {
             setFilterStartDate('');
             setFilterEndDate('');
             setFilterClientId('');
           }}>Limpiar</button>
        </div>
      </div>

      <div className="card">
        {filteredNotes.length === 0 ? (
          <p className="text-muted text-center py-4">No hay albaranes que coincidan con los filtros.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Ref. Albarán</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Envío</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredNotes.map(dn => {
                  const client = clients.find(c => c.id === dn.clientId);
                  return (
                    <tr key={dn.id}>
                      <td className="font-mono font-bold">ALB-{dn.albaranNumber || dn.id.slice(-6)}</td>
                      <td>{new Date(dn.date).toLocaleDateString()}</td>
                      <td className="font-medium">{client ? (client.commercialName || client.name) : 'Desconocido'}</td>
                      <td className="font-bold">{dn.total.toFixed(2)} €</td>
                      <td>
                        <span className={`badge ${dn.status === 'BILLED' ? 'badge-primary' : 'badge-warning'}`}>
                          {dn.status === 'BILLED' ? 'Facturado' : 'Pendiente Facturar'}
                        </span>
                      </td>
                      <td>
                        <span 
                          className={`badge ${dn.sent ? 'badge-success' : 'badge-danger'}`} 
                          style={{ cursor: 'pointer', userSelect: 'none' }} 
                          onClick={() => updateDeliveryNote(dn.id, { sent: !dn.sent })}
                          title="Haga clic para cambiar el estado de envío manualmente"
                        >
                          {dn.sent ? 'Enviado' : 'No Enviado'}
                        </span>
                      </td>
                      <td className="flex gap-2 items-center flex-wrap">
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          onClick={() => handleViewPDF(dn)}
                          title="Ver PDF"
                        >
                          Ver
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          onClick={() => handleDownloadPDF(dn)}
                          title="Descargar PDF"
                        >
                          PDF
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          onClick={() => openEditModal(dn)}
                          title="Editar Albarán"
                        >
                          Editar
                        </button>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', backgroundColor: '#10b981' }}
                          onClick={() => openShareModal(dn)}
                          title="Enviar a cliente"
                        >
                          Enviar
                        </button>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          onClick={() => {
                            Swal.fire({
                              text: '¿Estás seguro de que quieres eliminar este albarán permanentemente?',
                              icon: 'warning',
                              showCancelButton: true,
                              confirmButtonColor: '#ef4444',
                              cancelButtonColor: '#94a3b8',
                              confirmButtonText: 'Sí, eliminar',
                              cancelButtonText: 'Cancelar'
                            }).then((result) => {
                              if (result.isConfirmed) {
                                deleteDeliveryNote(dn.id);
                              }
                            });
                          }}
                          title="Eliminar Albarán"
                        >
                          X
                        </button>
                      </td>
                    </tr>
                  );
                }).reverse()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sharingAlbaran && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', margin: '20px' }}>
            <h3 className="text-xl font-bold mb-4">Enviar Albarán ALB-{sharingAlbaran.albaranNumber || sharingAlbaran.id.slice(-6)}</h3>
            <p className="text-muted mb-4 text-sm">Verifica los datos de contacto antes de elegir por dónde enviar. <b>Nota:</b> Recuerda descargar primero el PDF para poder adjuntarlo manualmente en WhatsApp o en tu gestor de correo.</p>
            
            <div className="form-group">
              <label className="form-label">Teléfono (WhatsApp)</label>
              <input type="text" className="form-control" value={sharePhone} onChange={e => setSharePhone(e.target.value)} placeholder="Ej: +34 600 000 000" />
            </div>
            
            <div className="form-group mb-6">
              <label className="form-label">Correo Electrónico (Email)</label>
              <input type="email" className="form-control" value={shareEmail} onChange={e => setShareEmail(e.target.value)} placeholder="Ej: cliente@empresa.com" />
            </div>

            <div className="flex flex-col gap-3">
              <button className="btn w-full flex justify-center items-center gap-2" style={{ backgroundColor: '#000', color: 'white' }} onClick={handleNativeShare}>
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                Compartir Documento con PDF adjunto
              </button>
            
              <hr className="my-2 border-color-border" />
              <p className="text-xs text-center text-muted">Links manuales (sin archivo PDF adjunto):</p>
              <button className="btn w-full flex justify-center items-center gap-2" style={{ backgroundColor: '#25D366', color: 'white' }} onClick={handleSendWhatsApp}>
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                Abrir WhatsApp con mensaje
              </button>
              
              <button className="btn btn-primary w-full flex justify-center items-center gap-2" onClick={handleSendEmail}>
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                Abrir Email con mensaje
              </button>
              
              <button className="btn btn-secondary w-full mt-2" onClick={() => setSharingAlbaran(null)}>
                Cancelar y cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAlbaran && editFormData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '100%', maxWidth: '700px', margin: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 className="text-xl font-bold mb-4">Editar Albarán ALB-{editingAlbaran.albaranNumber || editingAlbaran.id.slice(-6)}</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="form-group mb-0" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Cliente Asociado</label>
                <select className="form-control" value={editFormData.clientId} onChange={e => setEditFormData({...editFormData, clientId: e.target.value})}>
                  <option value="">-- Seleccionar --</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.commercialName || c.name}</option>)}
                </select>
              </div>
              <div className="form-group mb-0">
                <label className="form-label">Fecha</label>
                <input type="date" className="form-control" value={editFormData.date} onChange={e => setEditFormData({...editFormData, date: e.target.value})} />
              </div>
              <div className="form-group mb-0">
                <label className="form-label">Entregado a (Nombre)</label>
                <input type="text" className="form-control" value={editFormData.deliveredTo} onChange={e => setEditFormData({...editFormData, deliveredTo: e.target.value})} />
              </div>
            </div>

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
                    {products && products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
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
              <button className="btn btn-secondary" onClick={() => setEditingAlbaran(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSaveEdit}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
