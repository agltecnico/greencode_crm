import React, { useContext, useState, useRef, useEffect } from 'react';
import { DataContext } from '../context/DataContext';
import SignatureCanvas from 'react-signature-canvas';
import { useNavigate } from 'react-router-dom';
import { generateDeliveryNoteBlob } from '../utils/pdf';

function DriverView() {
  const { clients, orders, deliveryNotes, markOrderAsDelivered, saveSignedDeliveryNote, updateDeliveryNote, updateOrderList, companyLogo, companyProfile } = useContext(DataContext);
  const [view, setView] = useState('orders');
  const [pdfBlob, setPdfBlob] = useState(null);
    const [pdfError, setPdfError] = useState(null); // 'orders', 'deliver', 'ticket', 'sign'
  const [activeTab, setActiveTab] = useState('pending');
 // 'pending', 'delivered'
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deliveredTo, setDeliveredTo] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [editItems, setEditItems] = useState([]);
  
  const sigCanvas = useRef({});
  const pdfGeneratedRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    if (view === 'ticket' && selectedTicket) {
      if (pdfGeneratedRef.current === selectedTicket.id) return; // Prevent infinite re-trigger loop
      pdfGeneratedRef.current = selectedTicket.id;
      
      setPdfError(null);
      const client = clients.find(c => c.id === selectedTicket.clientId);
      if (client) {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de 6 segundos')), 6000));
        
        Promise.race([
          generateDeliveryNoteBlob(selectedTicket, client),
          timeoutPromise
        ]).then(blob => {
          if (isMounted) setPdfBlob(blob);
        }).catch(err => {
          console.error("PDF gen error:", err);
          if (isMounted) {
            setPdfBlob(false);
            setPdfError(err.name + ': ' + err.message);
          }
        });
      }
    } else {
      pdfGeneratedRef.current = null;
      setPdfBlob(null);
      setPdfError(null);
    }
    return () => { isMounted = false; };
  }, [view, selectedTicket, clients]);

  const navigate = useNavigate();

  // Helper to get client name from order or ticket
  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client ? (client.commercialName || client.name) : 'Cliente Desconocido';
  };

  // Helper to safely parse items list
  const getItemsArray = (items) => {
    if (!items) return [];
    if (Array.isArray(items)) return items;
    if (typeof items === 'string') {
      try {
        return JSON.parse(items);
      } catch (e) {
        console.error('Error parsing items JSON', e);
        return [];
      }
    }
    return [];
  };

  // Count metrics for tabs
  const pendingCount = orders.filter(o => o.status !== 'DELIVERED').length;
  const deliveredCount = orders.filter(o => o.status === 'DELIVERED').length;

  // Filter orders by active tab and search term
  const filteredOrders = orders
    .filter(o => activeTab === 'pending' ? o.status !== 'DELIVERED' : o.status === 'DELIVERED')
    .filter(o => {
      const name = getClientName(o.clientId).toLowerCase();
      return name.includes(searchTerm.toLowerCase());
    })
    .sort((a,b) => new Date(b.date) - new Date(a.date));

  const handleStartDelivery = (order) => {
    setSelectedOrder(order);
    setEditItems(getItemsArray(order.items).map(item => ({ 
      ...item, 
      quantity: Number(item.quantity || 1) 
    })));
    setDeliveredTo('');
    setView('deliver');
  };

  const handleConfirmDelivery = async () => {
    if(!deliveredTo.trim()) return alert('Por favor, indica a quién se le entrega.');
    if(editItems.length === 0) return alert('El pedido debe tener al menos un artículo.');
    
    try {
      // Mark as delivered and get the generated note directly, passing the modified items
      const newTicket = await markOrderAsDelivered(selectedOrder.id, deliveredTo, editItems);
      if (newTicket) {
        setSelectedTicket(newTicket);
        setView('ticket');
      } else {
        alert('Error al generar el albarán.');
      }
    } catch (err) {
      console.error(err);
      alert('Error en el proceso de entrega.');
    }
  };

  const handleSign = async () => {
    try {
      if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
        return alert('Por favor, firme en el recuadro');
      }
      const rawSignatureBase64 = sigCanvas.current.toDataURL('image/jpeg', 0.5);
      const signatureBase64 = rawSignatureBase64.replace(/^data:image\/\w+;base64,/, '');
      
      // Save signature to delivery note and mark order DELIVERED in one transactional step
      const savedTicket = await saveSignedDeliveryNote(selectedTicket, signatureBase64);
      
      // Update local ticket state so it reflects the signature and database ID on-screen
      setSelectedTicket(savedTicket);
      setView('ticket'); // Transition back to ticket view to see the final signed albarán!
    } catch (err) {
      console.error(err);
      alert('Error al guardar la firma: ' + err.message);
    }
  };

  const handleViewTicket = (order) => {
    const ticket = deliveryNotes.find(dn => dn.orderId === order.id);
    if (ticket) {
      setSelectedOrder(order);
      setSelectedTicket(ticket);
      setView('ticket');
    } else {
      alert('No se encontró el albarán correspondiente.');
    }
  };

  const sendWhatsApp = () => {
    const client = clients.find(c => c.id === selectedTicket.clientId);
    const clientName = client ? client.name : (selectedTicket.clientName || '');
    const url = `https://${window.location.host}/ticket/${selectedTicket.id}`;
    const greeting = clientName ? `Hola ${clientName}!` : 'Hola!';
    const text = `Y" *NUEVO ALBARÁN*\n${greeting} Puedes ver y descargar tu albarán firmado aquíí:\nY'% ${url}`;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) { window.location.href = `whatsapp://send?text=${encodeURIComponent(text)}`; } else { window.open(`https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank'); }
    updateDeliveryNote(selectedTicket.id, { sent: true });
    setSelectedTicket(prev => ({ ...prev, sent: true }));
  };

  const sharePDF = async () => {
    try {
      const client = clients.find(c => c.id === selectedTicket.clientId);
      if (!client) return alert('No se encontraron los datos del cliente.');
      
      const blob = pdfBlob || await generateDeliveryNoteBlob(selectedTicket, client);
      const albaranDisplay = selectedTicket.albaranNumber || selectedTicket.id.slice(-6);
      const fileName = `Albaran_${albaranDisplay}_${client.name.replace(/\s+/g, '_')}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });

      let sharedSuccessfully = false;
      let lastShareError = null;

      // Try native share first
      if (navigator.share) {
        try {
          // Check canShare if available to prevent throwing on completely unsupported devices
          if (navigator.canShare && !navigator.canShare({ files: [file] })) {
             throw new Error('Navegador no soporta compartir archivos por Web Share API');
          }
          await navigator.share({
            files: [file],
            title: `Albarǭn ALB-${albaranDisplay}`,
            text: `Hola ${client.name}! Adjuntamos el albarán firmado ALB-${albaranDisplay}.`
          });
          await updateDeliveryNote(selectedTicket.id, { sent: true });
          setSelectedTicket(prev => ({ ...prev, sent: true }));
          sharedSuccessfully = true;
          return; // Stop here if successful
        } catch (shareErr) {
          console.warn("Native file sharing failed:", shareErr);
          lastShareError = shareErr;
          if (shareErr.name === 'AbortError') return; // User cancelled
        }
      } else {
        lastShareError = new Error("navigator.share no estǭ disponible en este navegador");
      }

      if (!sharedSuccessfully) {
        // En los teléfonos que bloquean el envío automático del archivo (como el que da NotAllowedError),
        // pasamos al "Plan C" silencioso: enviamos un enlace de descarga en vez del archivo físico.
        // Así el proceso sigue siendo 100% automático para el repartidor.
        
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const phoneParam = client.phone ? `phone=${client.phone.replace(/[^0-9]/g, '')}&` : '';
        
        const ticketUrl = `https://${window.location.host}/ticket/${selectedTicket.id}`;
        const text = `Hola ${client.name}! Aquǭ tienes tu albarǭn firmado ALB-${albaranDisplay}: \n${ticketUrl}`;
        
        const waUrl = isMobile 
          ? `whatsapp://send?${phoneParam}text=${encodeURIComponent(text)}` 
          : `https://web.whatsapp.com/send?${phoneParam}text=${encodeURIComponent(text)}`;
          
        if (isMobile) { window.location.href = waUrl; } else { window.open(waUrl, '_blank'); }
        
        await updateDeliveryNote(selectedTicket.id, { sent: true });
        setSelectedTicket(prev => ({ ...prev, sent: true }));
      }
    } catch (err) {
      console.error(err);
      alert('Error al compartir el PDF: ' + err.message);
    }
  };

    const updateItemQty = (index, delta) => {
    setEditItems(prev => prev.map((item, idx) => {
      if (idx === index) {
        const newQty = Math.max(1, Number(item.quantity) + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeItem = (index) => {
    setEditItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Prevent background scrolling when canvas is open to fix scroll issues
  useEffect(() => {
    if (view === 'sign') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [view]);

  // Handle signature canvas resizing dynamically on view change to prevent 0-px canvas layout issue
  useEffect(() => {
    if (view === 'sign' && sigCanvas.current) {
      // Wait for rendering to complete
      setTimeout(() => {
        const canvas = sigCanvas.current.getCanvas();
        if (canvas && canvas.parentNode) {
          const rect = canvas.parentNode.getBoundingClientRect();
          canvas.width = rect.width || 340;
          canvas.height = rect.height || 280;
          sigCanvas.current.clear();
        }
      }, 100);
    }
  }, [view]);

  return (
    <div className="driver-page">
      <style>{`
        .driver-page {
          background-color: #f1f5f9;
          min-height: 100vh;
          width: 100%;
          color: #1e293b;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .driver-content-wrapper {
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
          background-color: #ffffff;
          min-height: 100vh;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          display: flex;
          flex-direction: column;
          border-left: 1px solid #e2e8f0;
          border-right: 1px solid #e2e8f0;
        }
        .driver-header {
          background: linear-gradient(135deg, #2c8c32 0%, #3db846 100%);
          color: white;
          padding: 1.25rem 1.5rem;
          position: sticky;
          top: 0;
          z-index: 100;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
        }
        .driver-header h1 {
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .driver-back-btn {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .driver-back-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        .driver-main {
          padding: 1.5rem;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          background-color: #f8fafc;
        }
        .tabs-container {
          display: flex;
          background: #e2e8f0;
          border-radius: 12px;
          padding: 0.25rem;
          margin-bottom: 0.5rem;
        }
        .tab-btn {
          flex: 1;
          text-align: center;
          padding: 0.75rem;
          border-radius: 9px;
          font-weight: 700;
          font-size: 0.9rem;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          background: transparent;
          color: #64748b;
          font-family: inherit;
        }
        .tab-btn.active {
          background: white;
          color: #2c8c32;
          box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .section-title {
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          margin-bottom: 0.5rem;
          margin-top: 0.25rem;
        }
        .driver-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 1rem 1.25rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
          position: relative;
          overflow: hidden;
          margin-bottom: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .driver-card::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background-color: #f59e0b;
          transition: background-color 0.2s ease;
        }
        .driver-card.expanded::before {
          background-color: #3db846;
        }
        .driver-card.delivered::before {
          background-color: #10b981;
        }
        .driver-card-summary {
          display: flex;
          justify-content: space-between;
          align-items: center;
          width: 100%;
        }
        .driver-client-name {
          font-size: 1rem;
          font-weight: 700;
          color: #1e293b;
        }
        .driver-date {
          font-size: 0.8rem;
          color: #64748b;
        }
        .driver-badge {
          font-size: 0.75rem;
          font-weight: 700;
          padding: 0.25rem 0.65rem;
          border-radius: 9999px;
          background-color: #fef3c7;
          color: #b45309;
        }
        .driver-card.expanded .driver-badge {
          background-color: #e8f5e9;
          color: #2c8c32;
        }
        .driver-badge.delivered-badge {
          background-color: #d1fae5;
          color: #065f46;
        }
        .driver-items-list {
          background-color: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          padding: 0.875rem;
          margin-bottom: 1.25rem;
        }
        .driver-items-list-title {
          font-weight: 700;
          font-size: 0.8rem;
          margin-bottom: 0.5rem;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }
        .driver-items-list ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .driver-items-list li {
          font-size: 0.875rem;
          color: #334155;
          padding: 0.25rem 0;
          border-bottom: 1px dashed #f1f5f9;
        }
        .driver-items-list li:last-child {
          border-bottom: none;
        }
        .driver-btn {
          width: 100%;
          padding: 1rem;
          font-size: 1rem;
          font-weight: 700;
          border-radius: 12px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-family: inherit;
        }
        .driver-btn-primary {
          background-color: #3db846;
          color: white;
          box-shadow: 0 4px 12px rgba(61, 184, 70, 0.25);
        }
        .driver-btn-primary:hover {
          background-color: #2c8c32;
        }
        .driver-btn-blue {
          background-color: #2563eb;
          color: white;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }
        .driver-btn-blue:hover {
          background-color: #1d4ed8;
        }
        .driver-btn-whatsapp {
          background-color: #25D366;
          color: white;
          box-shadow: 0 4px 12px rgba(37, 211, 102, 0.25);
        }
        .driver-btn-whatsapp:hover {
          background-color: #128C7E;
        }
        .driver-btn-secondary {
          background-color: #e2e8f0;
          color: #334155;
        }
        .driver-btn-secondary:hover {
          background-color: #cbd5e1;
        }
        .driver-input {
          width: 100%;
          padding: 1rem;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          font-size: 1.05rem;
          transition: all 0.2s ease;
          font-family: inherit;
          margin-top: 0.5rem;
          box-sizing: border-box;
        }
        .driver-input:focus {
          outline: none;
          border-color: #3db846;
          box-shadow: 0 0 0 3px rgba(61, 184, 70, 0.15);
        }
        .canvas-container {
          width: 100%;
          height: 280px;
          background-color: #ffffff;
          border: 2px dashed #cbd5e1;
          border-radius: 16px;
          position: relative;
          overflow: hidden;
          margin: 1rem 0;
        }
        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          background: white;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          color: #64748b;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .empty-state p {
          font-size: 1.1rem;
          font-weight: 500;
          margin: 0;
        }
        .ticket-wrapper {
          background: white;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
        }
        .ticket-header {
          background: linear-gradient(135deg, #2c8c32 0%, #3db846 100%);
          color: white;
          padding: 1.5rem;
          text-align: center;
        }
        .ticket-header h2 {
          margin: 0 0 0.25rem 0;
          font-size: 1.5rem;
          font-weight: 700;
        }
        .ticket-header p {
          margin: 0;
          opacity: 0.9;
          font-size: 0.9rem;
          font-weight: 500;
        }
        .ticket-body {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .ticket-field-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }
        .ticket-field-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: #1e293b;
        }
        .ticket-divider {
          border-top: 1px solid #f1f5f9;
          padding-top: 1rem;
        }
        .ticket-product-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8fafc;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          margin-bottom: 0.5rem;
          border: 1px solid #f1f5f9;
        }
        .ticket-product-name {
          font-weight: 500;
          color: #334155;
        }
        .ticket-product-qty {
          font-weight: 700;
          color: #475569;
        }
        
        /* Edit items UI elements */
        .editor-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #ffffff;
          padding: 0.75rem;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          margin-bottom: 0.5rem;
        }
        .qty-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          font-weight: bold;
          cursor: pointer;
          color: #475569;
          transition: all 0.15s ease;
        }
        .qty-btn:active {
          background: #e2e8f0;
        }
        .delete-item-btn {
          background: none;
          border: none;
          color: #ef4444;
          font-weight: 700;
          font-size: 0.8rem;
          cursor: pointer;
          margin-left: 0.5rem;
          padding: 0.25rem;
        }
      `}</style>

      <div className="driver-content-wrapper">
        {/* Header */}
        <div className="driver-header">
          <h1>Reparto Móvil</h1>
          {view !== 'orders' && !selectedTicket?.signature && (
            <button onClick={() => setView('orders')} className="driver-back-btn">
              Atrás
            </button>
          )}
          {view === 'orders' && (
            <button onClick={() => navigate('/')} className="driver-back-btn">
              Volver al CRM
            </button>
          )}
        </div>

        <div className="driver-main">
          {/* VIEW: ORDER LIST */}
          {view === 'orders' && (
            <div>
              <div className="tabs-container">
                <button 
                  type="button" 
                  className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('pending'); setExpandedOrderId(null); }}
                >
                  Pendientes ({pendingCount})
                </button>
                <button 
                  type="button" 
                  className={`tab-btn ${activeTab === 'delivered' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('delivered'); setExpandedOrderId(null); }}
                >
                  Entregados ({deliveredCount})
                </button>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <input 
                  type="text"
                  placeholder="🔍 Buscar por cliente..."
                  className="driver-input"
                  style={{ marginTop: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <h2 className="section-title">
                {activeTab === 'pending' ? 'Pedidos Pendientes' : 'Pedidos Entregados'} ({filteredOrders.length})
              </h2>
              
              {filteredOrders.map(order => (
                <div 
                  key={order.id} 
                  className={`driver-card ${activeTab === 'delivered' ? 'delivered' : ''} ${expandedOrderId === order.id ? 'expanded' : ''}`}
                  onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                >
                  <div className="driver-card-summary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '0.75rem' }}>
                      <p className="driver-client-name" style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--color-secondary)' }}>
                        {getClientName(order.clientId)}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem', marginTop: '0.3rem' }}>
                        <span className="driver-date" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginRight: '0.2rem' }}>
                          {new Date(order.date).toLocaleDateString()}
                        </span>
                        <span className={`driver-badge ${activeTab === 'delivered' ? 'delivered-badge' : ''}`} style={{ margin: 0, fontSize: '0.65rem', padding: '0.15rem 0.35rem', borderRadius: '4px', border: 'none' }}>
                          {activeTab === 'delivered' ? '✓ Entregado' : (expandedOrderId === order.id ? 'Detalle' : 'Pendiente')}
                        </span>
                        {(() => {
                          const ticket = deliveryNotes.find(dn => dn.orderId === order.id);
                          const isSent = ticket ? ticket.sent : false;
                          return activeTab === 'delivered' && (
                            <span className="driver-badge" style={{ 
                              margin: 0, 
                              backgroundColor: isSent ? '#e6f4ea' : '#fce8e6', 
                              color: isSent ? '#137333' : '#c5221f',
                              border: 'none',
                              fontWeight: '600',
                              fontSize: '0.65rem',
                              padding: '0.15rem 0.35rem',
                              borderRadius: '4px'
                            }}>
                              {isSent ? 'Enviado' : 'No Enviado'}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <svg 
                        style={{ 
                          width: '18px', 
                          height: '18px', 
                          color: '#64748b', 
                          transform: expandedOrderId === order.id ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 0.25s ease'
                        }} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path>
                      </svg>
                    </div>
                  </div>
                  
                  {expandedOrderId === order.id && (
                    <div 
                      style={{ marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}
                      onClick={e => e.stopPropagation()} // Prevent collapsing when clicking detail area
                    >
                      <div className="driver-items-list">
                        <p className="driver-items-list-title">Artículos:</p>
                        <ul>
                          {getItemsArray(order.items).map((item, idx) => (
                            <li key={idx} className="truncate">{item.quantity}x {item.name}</li>
                          ))}
                        </ul>
                      </div>

                      {activeTab === 'pending' ? (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartDelivery(order);
                          }}
                          className="driver-btn driver-btn-blue"
                        >
                          Entregar Pedido
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewTicket(order);
                          }}
                          className="driver-btn driver-btn-primary"
                        >
                          Ver Albarán / Compartir PDF
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              
              {filteredOrders.length === 0 && (
                <div className="empty-state">
                  <p>
                    {activeTab === 'pending' 
                      ? '🎅 No hay pedidos pendientes' 
                      : '📦 No hay pedidos entregados todavía'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* VIEW: DELIVER INPUT */}
          {view === 'deliver' && selectedOrder && (
            <div className="driver-card" style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: '800', margin: '0 0 0.25rem 0' }}>Confirmar Entrega</h2>
                <p style={{ color: '#64748b', margin: 0, fontWeight: '500' }}>{getClientName(selectedOrder.clientId)}</p>
              </div>

              {/* Items editing section */}
              <div style={{ marginBottom: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <label className="section-title" style={{ display: 'block', marginBottom: '0.75rem' }}>Artículos a entregar</label>
                <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '12px' }}>
                  {editItems.map((item, idx) => (
                    <div key={idx} className="editor-row">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#1e293b', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {Number(item.price).toFixed(2)} €
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button type="button" className="qty-btn" onClick={() => updateItemQty(idx, -1)}>-</button>
                        <span style={{ fontWeight: '700', fontSize: '1.05rem', minWidth: '24px', textAlign: 'center' }}>{item.quantity}</span>
                        <button type="button" className="qty-btn" onClick={() => updateItemQty(idx, 1)}>+</button>
                        <button type="button" className="delete-item-btn" onClick={() => removeItem(idx)}>✕</button>
                      </div>
                    </div>
                  ))}
                  {editItems.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#ef4444', fontSize: '0.85rem', padding: '1rem 0', margin: 0, fontWeight: 'bold' }}>
                      ¡Sin productos! El pedido no se podrá generar.
                    </p>
                  )}
                </div>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label className="section-title" style={{ display: 'block', marginBottom: '0.5rem' }}>¿A quién se le entrega?</label>
                <input 
                  type="text"
                  autoFocus
                  placeholder="Nombre del receptor..."
                  className="driver-input"
                  value={deliveredTo}
                  onChange={e => setDeliveredTo(e.target.value)}
                />
              </div>

              <button 
                onClick={handleConfirmDelivery}
                className="driver-btn driver-btn-primary"
                disabled={editItems.length === 0}
                style={{ opacity: editItems.length === 0 ? 0.6 : 1 }}
              >
                Generar Albarán
              </button>
            </div>
          )}

          {/* VIEW: TICKET SUMMARY */}
          {view === 'ticket' && selectedTicket && (
            <div className="ticket-wrapper">
              <div className="ticket-header">
                {companyLogo ? (
                  <img src={companyLogo} alt="Logo" style={{ maxHeight: '48px', margin: '0 auto 0.5rem auto', display: 'block', backgroundColor: 'white', borderRadius: '8px', padding: '4px' }} />
                ) : (
                  <h2>{companyProfile?.fiscalName || 'Albarán de Entrega'}</h2>
                )}
                <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>{companyProfile?.address} - {companyProfile?.city}</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '0.1rem', fontWeight: 'bold' }}>{selectedTicket.albaranNumber}</p>
              </div>
              
              <div className="ticket-body">
                <div>
                  <p className="ticket-field-label">Cliente</p>
                  <p className="ticket-field-value">{getClientName(selectedTicket.clientId)}</p>
                </div>
                
                <div>
                  <p className="ticket-field-label">Entregado a</p>
                  <p className="ticket-field-value">{selectedTicket.deliveredTo}</p>
                </div>

                <div className="ticket-divider">
                  <p className="ticket-field-label" style={{ marginBottom: '0.5rem' }}>Productos</p>
                  <div>
                    {getItemsArray(selectedTicket.items).map((item, idx) => (
                      <div key={idx} className="ticket-product-row">
                        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                          <span className="ticket-product-name" style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{item.name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.quantity} x {Number(item.price).toFixed(2)} €</span>
                        </div>
                        <span className="ticket-product-qty" style={{ fontSize: '1rem', fontWeight: 'bold' }}>{(item.quantity * item.price).toFixed(2)} €</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '1rem', borderRadius: '12px', marginTop: '0.5rem', border: '1px solid #e2e8f0' }}>
                  <span style={{ fontWeight: '700', color: '#475569' }}>Total Albarán</span>
                  <span style={{ fontWeight: '800', color: '#2c8c32', fontSize: '1.2rem' }}>{Number(selectedTicket.total || 0).toFixed(2)} €</span>
                </div>

                {selectedTicket.signature ? (
                  /* RENDER SIGNATURE AT THE BOTTOM IF SIGNED */
                  <div className="ticket-divider" style={{ textAlign: 'center' }}>
                    <p className="ticket-field-label" style={{ marginBottom: '0.5rem' }}>Firma de Conformidad</p>
                    <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'inline-block', width: '100%' }}>
                      <img src={selectedTicket.signature.startsWith('data:image') ? selectedTicket.signature : `data:image/png;base64,${selectedTicket.signature}`} alt="Firma" style={{ maxHeight: '100px', margin: '0 auto', display: 'block' }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
                      {pdfError && <div style={{color: '#d32f2f', fontSize: '13px', textAlign: 'center', marginBottom: '8px', fontWeight: 'bold'}}>⚠️ Error: {pdfError}</div>}
                        <button 
                          onClick={sharePDF}
                          disabled={!pdfBlob && pdfBlob !== false}
                          className="driver-btn driver-btn-whatsapp"
                          style={{ opacity: (!pdfBlob && pdfBlob !== false) ? 0.6 : 1, transition: 'opacity 0.3s' }}
                        >
                          {pdfError ? 'Compartir Enlace (Fallo PDF)' : (!pdfBlob ? 'Preparando PDF...' : 'Compartir PDF (WhatsApp)')}
                        </button>
                      <button 
                        onClick={() => {
                          setSelectedOrder(null);
                          setSelectedTicket(null);
                          setView('orders');
                        }}
                        className="driver-btn driver-btn-secondary"
                      >
                        Volver a Pedidos
                      </button>
                    </div>
                  </div>
                ) : (
                  /* RENDER ACCEPT & SIGN BUTTON IF NOT SIGNED YET */
                  <button 
                    onClick={() => setView('sign')}
                    className="driver-btn driver-btn-blue"
                    style={{ marginTop: '1rem' }}
                  >
                    Aceptar y Firmar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* VIEW: SIGNATURE CANVAS */}
          {view === 'sign' && selectedTicket && (
            <div className="driver-card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '800', margin: '0 0 0.5rem 0', textAlign: 'center' }}>Firma del Cliente</h2>
              <p style={{ color: '#64748b', textAlign: 'center', fontSize: '0.9rem', margin: '0 0 1.5rem 0' }}>
                Firme en el recuadro para confirmar la recepción del albarán {selectedTicket.albaranNumber}.
              </p>
              
              <div className="canvas-container">
                <SignatureCanvas 
                  ref={sigCanvas} 
                  penColor="black"
                  backgroundColor="rgb(255,255,255)"
                  canvasProps={{
                    className: 'signature-canvas',
                    style: { width: '100%', height: '100%', display: 'block' }
                  }} 
                />
              </div>
              
              <div className="flex gap-2" style={{ marginTop: '1rem' }}>
                <button 
                  onClick={() => sigCanvas.current.clear()}
                  className="driver-btn driver-btn-secondary"
                  style={{ flex: 1 }}
                >
                  Borrar
                </button>
                <button 
                  onClick={handleSign}
                  className="driver-btn driver-btn-primary"
                  style={{ flex: 2 }}
                >
                  Guardar Firma
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DriverView;