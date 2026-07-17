import { useState } from 'react';
import { useData } from '../context/DataContext';
import { generateInvoicePDF, generateInvoiceBlob } from '../utils/pdf';

export default function Invoices() {
  const { clients, deliveryNotes, invoices, addInvoice, deleteInvoice, markInvoiceAsPaid } = useData();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [ivaPercentage, setIvaPercentage] = useState(4);
  const [paymentMethod, setPaymentMethod] = useState('Transferencia');
  const [documentType, setDocumentType] = useState('INVOICE');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Sharing state
  const [sharingInvoice, setSharingInvoice] = useState(null);
  const [sharePhone, setSharePhone] = useState('');
  const [shareEmail, setShareEmail] = useState('');

  const clientUnbilledNotes = deliveryNotes.filter(
    dn => dn.clientId === selectedClientId && dn.status === 'UNBILLED'
  );

  const modalOverlayStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 };
  const modalCardStyle = { width: '100%', maxWidth: '900px', margin: '20px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#fff', padding: '2rem', borderRadius: '8px', border: '1px solid var(--color-border)' };

  const handleSelectClient = (e) => {
    setSelectedClientId(e.target.value);
    setSelectedNotes([]); // Reset selection on client change
    const client = clients.find(c => c.id === e.target.value);
    if (client) {
      if (documentType === 'SUMMARY') {
        setPaymentMethod('Contado');
      } else {
        setPaymentMethod(client.paymentMethod || 'Transferencia');
      }
    } else {
      setPaymentMethod('Transferencia');
    }
  };

  const handleDocumentTypeChange = (type) => {
    setDocumentType(type);
    if (type === 'SUMMARY') {
      setPaymentMethod('Contado');
    } else {
      const client = clients.find(c => c.id === selectedClientId);
      setPaymentMethod(client ? (client.paymentMethod || 'Transferencia') : 'Transferencia');
    }
  };

  const handleToggleNote = (noteId) => {
    if (selectedNotes.includes(noteId)) {
      setSelectedNotes(selectedNotes.filter(id => id !== noteId));
    } else {
      setSelectedNotes([...selectedNotes, noteId]);
    }
  };

  const calculateInvoiceTotal = () => {
    return selectedNotes.reduce((sum, noteId) => {
      const note = deliveryNotes.find(dn => dn.id === noteId);
      return sum + (note ? note.total : 0);
    }, 0);
  };

  const handleDeleteInvoice = (id) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta factura? Los albaranes asociados pasarán a estar pendientes de nuevo.')) {
      deleteInvoice(id);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!selectedClientId || selectedNotes.length === 0) return;

    const client = clients.find(c => c.id === selectedClientId);
    if (!client) return;

    // Generate Invoice Number format: YYYY-NNNN
    const year = new Date().getFullYear();
    
    // Find how many invoices exist globally this year of the selected type
    const typedInvoicesThisYear = invoices.filter(inv => {
       const isSameType = documentType === 'SUMMARY' ? inv.type === 'SUMMARY' : inv.type !== 'SUMMARY';
       return new Date(inv.date).getFullYear() === year && isSameType;
    });
    
    const seqStr = String(typedInvoicesThisYear.length + 1).padStart(4, '0');
    const invoiceNumber = documentType === 'SUMMARY' ? `ALB${year}-${seqStr}` : `F${year}-${seqStr}`;

    const subtotal = calculateInvoiceTotal();
    const finalIva = documentType === 'SUMMARY' ? 0 : ivaPercentage;
    const total = subtotal + (subtotal * (finalIva / 100));

    const newInvoice = {
      invoiceNumber,
      type: documentType,
      clientId: client.id,
      deliveryNoteIds: selectedNotes,
      subtotal,
      ivaPercentage: finalIva,
      total,
      date: new Date(invoiceDate).toISOString(),
      paymentMethod
    };

    // Use context to add and update status
    addInvoice(newInvoice, selectedNotes);

    // Get the full delivery note objects to print
    const notesToPrint = deliveryNotes.filter(dn => selectedNotes.includes(dn.id));
    
    // Auto download PDF is disabled per user request
    // await generateInvoicePDF(newInvoice, client, notesToPrint);

    setIsAdding(false);
    setSelectedClientId('');
    setSelectedNotes([]);
  };

  const handleDownloadOldInvoice = async (invoice) => {
    const client = clients.find(c => c.id === invoice.clientId);
    const notesToPrint = deliveryNotes.filter(dn => invoice.deliveryNoteIds.includes(dn.id));
    if (client) {
      await generateInvoicePDF(invoice, client, notesToPrint);
    }
  };

  const handleViewOldInvoice = async (invoice) => {
    const client = clients.find(c => c.id === invoice.clientId);
    const notesToPrint = deliveryNotes.filter(dn => invoice.deliveryNoteIds.includes(dn.id));
    if (client) {
      const blob = await generateInvoiceBlob(invoice, client, notesToPrint);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

  const openShareModal = (invoice) => {
    const client = clients.find(c => c.id === invoice.clientId);
    setSharingInvoice(invoice);
    setSharePhone(client?.phone || '');
    setShareEmail(client?.email || '');
  };

  const handleSendWhatsApp = () => {
    if (!sharePhone) return;
    const client = clients.find(c => c.id === sharingInvoice.clientId);
    let formattedPhone = sharePhone.replace(/\D/g, '');
    if (formattedPhone.length === 9) formattedPhone = '34' + formattedPhone;
    
    const text = `🌱 Hola ${client?.name}, adjunto le enviamos la factura ${sharingInvoice.invoiceNumber} por un total de ${sharingInvoice.total.toFixed(2)} €. ¡Muchas gracias por seguir confiando en nuestros microgreens! 🥙`;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) { window.location.href = `whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`; } else { window.open(`https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodeURIComponent(text)}`, '_blank'); }
  };

  const handleSendEmail = () => {
    if (!shareEmail) return;
    const client = clients.find(c => c.id === sharingInvoice.clientId);
    const subject = `Factura ${sharingInvoice.invoiceNumber} - GreenCode`;
    const body = `🌱 Hola ${client?.name},\n\nAdjunto le enviamos la factura correspondiente a sus últimos pedidos por un total de ${sharingInvoice.total.toFixed(2)} €.\n\n¡Muchas gracias por confiar en nosotros!\n\nUn saludo,\nEquipo GreenCode 🥙`;
    window.open(`mailto:${shareEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
  };

  const handleNativeShare = async () => {
    const client = clients.find(c => c.id === sharingInvoice.clientId);
    if (!client) return;
    const notesToPrint = deliveryNotes.filter(dn => sharingInvoice.deliveryNoteIds.includes(dn.id));
    
    try {
      const blob = await generateInvoiceBlob(sharingInvoice, client, notesToPrint);
      const file = new File([blob], `Factura_${sharingInvoice.invoiceNumber}_${client.name}.pdf`, { type: 'application/pdf' });
      
      const text = `🌱 Hola ${client.name}, adjunto le enviamos la factura ${sharingInvoice.invoiceNumber}. ¡Muchas gracias por seguir confiando en nuestros microgreens! 🥙`;
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Factura ${sharingInvoice.invoiceNumber}`,
          text: text
        });
      } else {
        alert("Tu dispositivo o navegador no soporta enviar archivos directamente adjuntos (común en PC). \n\nPor favor, descarga el PDF primero usando el botón de la lista y adjúntalo manualmente en WhatsApp Web o en tu correo.");
      }
    } catch (e) {
      console.error("Error sharing file:", e);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'PENDING') return !inv.isPaid;
    if (filterStatus === 'PAID') return inv.isPaid;
    return true;
  });

  return (
    <div className="admin-container">
      <div className="admin-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 className="text-2xl font-bold">Facturación</h2>
          <p className="text-muted" style={{ marginTop: '0.25rem' }}>Emisión de facturas y control de pagos.</p>
        </div>
        <button className="btn btn-primary shadow-sm" onClick={() => setIsAdding(true)}>
          + Nueva Factura
        </button>
      </div>

      {isAdding && (
        <div style={modalOverlayStyle}>
          <div style={modalCardStyle}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-xl">Generar Factura / Albarán Resumen</h3>
              <button className="btn btn-secondary" style={{ padding: '0.2rem 0.6rem' }} onClick={() => setIsAdding(false)}>Cerrar</button>
            </div>
          
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-md" style={{ borderColor: documentType === 'INVOICE' ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: documentType === 'INVOICE' ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
              <input type="radio" name="docType" value="INVOICE" checked={documentType === 'INVOICE'} onChange={() => handleDocumentTypeChange('INVOICE')} />
              <div>
                <div className="font-bold text-sm">📄 Factura Oficial</div>
                <div className="text-xs text-muted">Aplica IVA, serie F- y Datos Fiscales</div>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-md" style={{ borderColor: documentType === 'SUMMARY' ? 'var(--color-primary)' : 'var(--color-border)', backgroundColor: documentType === 'SUMMARY' ? 'rgba(99,102,241,0.05)' : 'transparent' }}>
              <input type="radio" name="docType" value="SUMMARY" checked={documentType === 'SUMMARY'} onChange={() => handleDocumentTypeChange('SUMMARY')} />
              <div>
                <div className="font-bold text-sm">📝 Albarán Resumen</div>
                <div className="text-xs text-muted">Sin IVA, serie ALB- y sin Datos Fiscales</div>
              </div>
            </label>
          </div>
          
          <div className="flex gap-4">
            <div className="mb-6 max-w-md w-full">
              <label className="form-label">Seleccionar Cliente</label>
              <select className="form-control" value={selectedClientId} onChange={handleSelectClient}>
                <option value="">-- Elige un cliente --</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.commercialName || c.name} ({c.clientNumber})</option>)}
              </select>
            </div>
            {selectedClientId && (
              <>
                <div className="mb-6 max-w-xs w-full">
                  <label className="form-label">Fecha del Documento</label>
                  <input type="date" className="form-control" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} required />
                </div>
                <div className="mb-6 max-w-xs w-full">
                  <label className="form-label">Forma de Pago</label>
                  <select className="form-control" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                    <option value="Transferencia">Transferencia</option>
                    <option value="30 Días">30 Días</option>
                    <option value="Contado">Contado</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {selectedClientId && (
            <div>
              <h4 className="font-semibold mb-3">Albaranes Pendientes de Facturar</h4>
              {clientUnbilledNotes.length === 0 ? (
                <p className="text-muted mb-4 border border-color-border p-4 rounded-md">
                  El cliente seleccionado no tiene albaranes pendientes de facturar.
                </p>
              ) : (
                <div className="table-container mb-6">
                  <table className="table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>
                          <input 
                            type="checkbox" 
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedNotes(clientUnbilledNotes.map(n => n.id));
                              } else {
                                setSelectedNotes([]);
                              }
                            }}
                            checked={selectedNotes.length === clientUnbilledNotes.length && clientUnbilledNotes.length > 0}
                          />
                        </th>
                        <th>Ref. Albarán</th>
                        <th>Fecha</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientUnbilledNotes.map(dn => (
                        <tr key={dn.id}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedNotes.includes(dn.id)}
                              onChange={() => handleToggleNote(dn.id)}
                            />
                          </td>
                          <td className="font-mono">ALB-{dn.albaranNumber || dn.id.slice(-6)}</td>
                          <td>{new Date(dn.date).toLocaleDateString()}</td>
                          <td className="font-bold">{dn.total.toFixed(2)} €</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="3" className="text-right font-medium pt-4">SUBTOTAL:</td>
                        <td className="font-semibold pt-4">{calculateInvoiceTotal().toFixed(2)} €</td>
                      </tr>
                      {documentType === 'INVOICE' && (
                        <tr>
                          <td colSpan="3" className="text-right font-medium pb-2 pt-2 flex justify-end items-center gap-2">
                            IVA:
                            <select className="form-control" style={{ width: '100px', display: 'inline-block' }} value={ivaPercentage} onChange={(e) => setIvaPercentage(Number(e.target.value))}>
                              <option value={4}>4%</option>
                              <option value={10}>10%</option>
                              <option value={21}>21%</option>
                              <option value={0}>SIN IVA (0%)</option>
                            </select>
                          </td>
                          <td className="font-semibold pb-2 pt-2">{(calculateInvoiceTotal() * (ivaPercentage / 100)).toFixed(2)} €</td>
                        </tr>
                      )}
                      <tr>
                        <td colSpan="3" className="text-right font-bold text-lg pt-2 pb-4 border-t border-[rgba(0,0,0,0.1)]">
                          TOTAL {documentType === 'SUMMARY' ? 'RESUMEN' : 'A FACTURAR'}:
                        </td>
                        <td className="font-bold text-primary text-xl pt-2 pb-4 border-t border-[rgba(0,0,0,0.1)]">
                          {(calculateInvoiceTotal() * (documentType === 'SUMMARY' ? 1 : (1 + ivaPercentage / 100))).toFixed(2)} €
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button className="btn btn-secondary" onClick={() => setIsAdding(false)}>Cancelar</button>
                <button 
                  className="btn btn-primary" 
                  disabled={selectedNotes.length === 0}
                  onClick={handleGenerateInvoice}
                >
                  Generar {documentType === 'SUMMARY' ? 'Resumen' : 'Factura'}
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      )}

      <div>

        <div className="flex gap-2 mb-4" style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: '10px' }}>
          <button 
            className={`btn ${filterStatus === 'ALL' ? 'btn-primary' : 'btn-outline'}`}
            style={{ borderRadius: '20px', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
            onClick={() => setFilterStatus('ALL')}
          >
            Todas
          </button>
          <button 
            className={`btn ${filterStatus === 'PENDING' ? 'btn-primary' : 'btn-outline'}`}
            style={{ borderRadius: '20px', padding: '0.4rem 1rem', fontSize: '0.85rem', backgroundColor: filterStatus === 'PENDING' ? '#f59e0b' : 'transparent', borderColor: '#f59e0b', color: filterStatus === 'PENDING' ? 'white' : '#b45309' }}
            onClick={() => setFilterStatus('PENDING')}
          >
            ⏳ Pendientes
          </button>
          <button 
            className={`btn ${filterStatus === 'PAID' ? 'btn-primary' : 'btn-outline'}`}
            style={{ borderRadius: '20px', padding: '0.4rem 1rem', fontSize: '0.85rem', backgroundColor: filterStatus === 'PAID' ? '#10b981' : 'transparent', borderColor: '#10b981', color: filterStatus === 'PAID' ? 'white' : '#047857' }}
            onClick={() => setFilterStatus('PAID')}
          >
            ✅ Cobradas
          </button>
        </div>

        {filteredInvoices.length === 0 ? (
           <p className="text-muted text-center py-4">No se han generado facturas todavía.</p>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Referencia</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th>Total</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map(inv => {
                  const client = clients.find(c => c.id === inv.clientId);
                  const isSummary = inv.type === 'SUMMARY';
                  return (
                    <tr key={inv.id}>
                      <td className="font-mono font-bold text-secondary">{inv.invoiceNumber}</td>
                      <td>
                        <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: isSummary ? '#e0e7ff' : '#dcfce7', color: isSummary ? '#4338ca' : '#166534' }}>
                          {isSummary ? 'Resumen' : 'Factura'}
                        </span>
                      </td>
                      <td>{new Date(inv.date).toLocaleDateString()}</td>
                      <td className="font-medium">{client ? (client.commercialName || client.name) : 'Desconocido'}</td>
                      <td className="font-bold text-success">{inv.total.toFixed(2)} €</td>
                      <td>
                        {inv.isPaid ? (
                          <span className="badge bg-green-500 text-white">Cobrado</span>
                        ) : (
                          <span className="badge badge-warning">Pendiente</span>
                        )}
                      </td>
                      <td className="flex gap-2 items-center flex-wrap">
                        {!inv.isPaid ? (
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'green', borderColor: 'green' }}
                            onClick={() => markInvoiceAsPaid(inv.id, true)}
                            title="Establecer como Cobrado"
                          >
                            Cobrar
                          </button>
                        ) : (
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'gray', borderColor: 'gray' }}
                            onClick={() => markInvoiceAsPaid(inv.id, false)}
                            title="Desmarcar Cobrado"
                          >
                            Des-cobrar
                          </button>
                        )}
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          onClick={() => handleViewOldInvoice(inv)}
                          title="Ver PDF"
                        >
                          Ver
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                          onClick={() => handleDownloadOldInvoice(inv)}
                          title="Descargar PDF"
                        >
                          PDF
                        </button>
                        <button 
                          className="btn btn-primary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', backgroundColor: '#10b981' }}
                          onClick={() => openShareModal(inv)}
                          title="Enviar a cliente"
                        >
                          Enviar
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'red' }}
                          onClick={() => handleDeleteInvoice(inv.id)}
                          title="Eliminar Factura"
                        >
                          Eliminar
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

      {sharingInvoice && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', margin: '20px' }}>
            <h3 className="text-xl font-bold mb-4">Enviar Factura {sharingInvoice.invoiceNumber}</h3>
            <p className="text-muted mb-4 text-sm">Verifica los datos de contacto antes de elegir por dónde enviar. <b>Nota:</b> Recuerda descargar primero el PDF para poder adjuntarlo manualmente si no usas móvil o navegador compatible.</p>
            
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
              
              <button className="btn btn-secondary w-full mt-2" onClick={() => setSharingInvoice(null)}>
                Cancelar y cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
