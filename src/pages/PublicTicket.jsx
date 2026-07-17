import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { generateDeliveryNotePDF } from '../utils/pdf';

function PublicTicket() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [client, setClient] = useState(null);
  const [profile, setProfile] = useState(null);
  const [logo, setLogo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadTicketAndClient() {
      try {
        // Load delivery note
        const { data: dn, error: dnError } = await supabase
          .from('delivery_notes')
          .select('*')
          .eq('id', id)
          .single();
        
        if (dnError || !dn) throw new Error('Albarán no encontrado');
        setTicket(dn);

        // Load client details to generate identical PDF
        const { data: cl, error: clError } = await supabase
          .from('clients')
          .select('*')
          .eq('id', dn.clientId)
          .single();
        
        if (cl) setClient(cl);

        // Load company profile
        const { data: prof } = await supabase.from('company_profile').select('*').single();
        if (prof) setProfile(prof);

        // Load logo
        const savedLogo = localStorage.getItem('crm_companyLogo');
        if (savedLogo) {
          setLogo(savedLogo);
        } else {
          // Fallback logo
          setLogo('/logo.png');
        }

      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadTicketAndClient();
  }, [id]);

  const handleDownload = async () => {
    if (ticket && client) {
      await generateDeliveryNotePDF(ticket, client);
    } else {
      alert('Error: Datos incompletos para generar el PDF.');
    }
  };

  if (loading) return <div className="loading-state">Cargando albarán...</div>;
  if (error) return <div className="error-state">Error: {error}</div>;

  return (
    <div className="public-page">
      <style>{`
        .public-page {
          background-color: #f1f5f9;
          min-height: 100vh;
          padding: 2rem 1rem;
          font-family: 'Inter', system-ui, sans-serif;
          color: #1e293b;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .loading-state, .error-state {
          text-align: center;
          padding: 3rem;
          font-size: 1.2rem;
          font-weight: 500;
          color: #64748b;
        }
        .error-state {
          color: #ef4444;
        }
        .actions-bar {
          width: 100%;
          max-width: 800px;
          display: flex;
          justify-content: flex-end;
          margin-bottom: 1rem;
        }
        .download-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background-color: #2c8c32;
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 12px;
          font-weight: 700;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(44, 140, 50, 0.2);
        }
        .download-btn:hover {
          background-color: #3db846;
          transform: translateY(-1px);
        }
        .document-container {
          background-color: #ffffff;
          width: 100%;
          max-width: 800px;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
          border: 1px solid #e2e8f0;
          overflow: hidden;
          padding: 3rem;
          box-sizing: border-box;
        }
        .doc-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #f1f5f9;
          padding-bottom: 2rem;
          margin-bottom: 2rem;
        }
        .company-info {
          flex: 1;
        }
        .doc-logo {
          max-height: 60px;
          max-width: 200px;
          object-contain: fit;
          margin-bottom: 1rem;
        }
        .company-name {
          font-size: 1.5rem;
          font-weight: 800;
          color: #2f3c4d;
          margin: 0 0 0.5rem 0;
        }
        .company-details {
          font-size: 0.85rem;
          color: #64748b;
          line-height: 1.4;
        }
        .doc-title-block {
          text-align: right;
        }
        .doc-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: #2f3c4d;
          margin: 0 0 0.5rem 0;
        }
        .doc-meta {
          font-size: 0.9rem;
          color: #64748b;
          line-height: 1.5;
        }
        .doc-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-bottom: 2.5rem;
        }
        .info-card {
          background: #f8fafc;
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          padding: 1.25rem;
        }
        .info-card h3 {
          font-size: 0.8rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0 0 0.75rem 0;
        }
        .client-name {
          font-size: 1.05rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 0.35rem 0;
        }
        .client-details {
          font-size: 0.85rem;
          color: #475569;
          line-height: 1.4;
        }
        .products-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          margin-bottom: 2.5rem;
        }
        .products-table th {
          background-color: #f8fafc;
          color: #475569;
          font-weight: 700;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 1rem;
          border-bottom: 2px solid #e2e8f0;
        }
        .products-table td {
          padding: 1.25rem 1rem;
          font-size: 0.9rem;
          border-bottom: 1px solid #f1f5f9;
        }
        .product-total-row {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 1.5rem;
          margin-bottom: 3rem;
          padding-right: 1rem;
        }
        .total-label {
          font-size: 1.1rem;
          font-weight: 700;
          color: #475569;
        }
        .total-amount {
          font-size: 1.6rem;
          font-weight: 800;
          color: #2c8c32;
        }
        .signature-block {
          border-top: 2px solid #f1f5f9;
          padding-top: 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .signature-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 1rem;
        }
        .signature-box {
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 12px;
          padding: 1rem;
          display: inline-block;
          min-width: 250px;
          max-width: 100%;
        }
        .signature-img {
          max-height: 120px;
          display: block;
          margin: 0 auto;
        }
        @media (max-width: 600px) {
          .document-container {
            padding: 1.5rem;
          }
          .doc-header {
            flex-direction: column;
            gap: 1.5rem;
          }
          .doc-title-block {
            text-align: left;
          }
          .doc-columns {
            grid-template-columns: 1fr;
            gap: 1rem;
          }
          .public-page {
            padding: 1rem 0.5rem;
          }
        }
      `}</style>

      <div className="actions-bar">
        <button onClick={handleDownload} className="download-btn">
          <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"></path></svg>
          Descargar PDF Oficial
        </button>
      </div>

      <div className="document-container">
        {/* Document Header */}
        <div className="doc-header">
          <div className="company-info">
            {logo ? (
              <img src={logo} alt="Logo" className="doc-logo" />
            ) : (
              <h1 className="company-name">{profile?.fiscalName || 'GREENCODE'}</h1>
            )}
            <div className="company-details">
              {profile?.ownerName && <p>{profile.ownerName}</p>}
              {profile?.nif && <p>NIF/CIF: {profile.nif}</p>}
              {profile?.address && <p>{profile.address}</p>}
              <p>{[profile?.postalCode, profile?.city, profile?.province].filter(Boolean).join(' ')}</p>
              {profile?.phone && <p>Tlf: {profile.phone}</p>}
            </div>
          </div>
          <div className="doc-title-block">
            <h2 className="doc-title">ALBARÁN</h2>
            <div className="doc-meta">
              <p><strong>Nº Albarán:</strong> ALB-{ticket.albaranNumber || ticket.id.slice(-6)}</p>
              <p><strong>Fecha:</strong> {new Date(ticket.date).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Client & Delivery Info */}
        <div className="doc-columns">
          <div className="info-card">
            <h3>Datos del Cliente</h3>
            {client?.commercialName ? (
              <>
                <p className="client-name">{client.commercialName}</p>
                <p className="client-details">{client.name}</p>
              </>
            ) : (
              <p className="client-name">{client?.name || 'Cliente Desconocido'}</p>
            )}
            <div className="client-details" style={{ marginTop: '0.5rem' }}>
              <p>NIF: {client?.nif || '-'}</p>
              <p>Dir: {client?.address || '-'}</p>
              <p>{[client?.postalCode, client?.city, client?.province].filter(Boolean).join(' ')}</p>
              <p>Tlf: {client?.phone || '-'}</p>
            </div>
          </div>
          <div className="info-card">
            <h3>Detalle de la Entrega</h3>
            <p style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#16a34a', margin: '0 0 0.5rem 0' }}>
              ✓ Entregado con éxito
            </p>
            <div className="client-details" style={{ lineHeight: '1.6' }}>
              <p><strong>Entregado a:</strong> {ticket.deliveredTo || '-'}</p>
              <p><strong>Estado:</strong> Firmado digitalmente</p>
            </div>
          </div>
        </div>

        {/* Products Table */}
        <table className="products-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th style={{ textAlign: 'center' }}>Cantidad</th>
              <th style={{ textAlign: 'right' }}>Precio Unit.</th>
              <th style={{ textAlign: 'right' }}>Descuento</th>
              <th style={{ textAlign: 'right' }}>Total Línea</th>
            </tr>
          </thead>
          <tbody>
            {ticket.items && ticket.items.map((item, idx) => {
              const lineTotal = (item.price * item.quantity) * (1 - (item.discount || 0) / 100);
              return (
                <tr key={idx}>
                  <td style={{ fontWeight: '500' }}>{item.name}</td>
                  <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                  <td style={{ textAlign: 'right' }}>{Number(item.price).toFixed(2)} €</td>
                  <td style={{ textAlign: 'right' }}>{item.discount || 0}%</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{lineTotal.toFixed(2)} €</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Total Summary */}
        <div className="product-total-row">
          <span className="total-label">Total Albarán:</span>
          <span className="total-amount">{Number(ticket.total || 0).toFixed(2)} €</span>
        </div>

        {/* Signature */}
        {ticket.signature && (
          <div className="signature-block">
            <span className="signature-title">Firma de Conformidad</span>
            <div className="signature-box">
              <img src={ticket.signature.startsWith('data:image') ? ticket.signature : `data:image/png;base64,${ticket.signature}`} alt="Firma del cliente" className="signature-img" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PublicTicket;
