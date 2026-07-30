import React, { useState, useEffect } from 'react';
import EmployeeTasks from '../components/EmployeeTasks';
import { useData } from '../context/DataContext';
import '../crops.css';

export default function TvDashboard() {
  const [tvTab, setTvTab] = useState('tasks');
  const { crops, cropTypes, seeds, articles, advanceCropStatus, refreshData, orders, clients, products, productMovements, packagingFormats } = useData();

  const translateStatus = (status) => {
    const statusMap = {
      'SOAKING': 'En Remojo',
      'SOWED': 'Sembrado',
      'GERMINATING': 'Germinando',
        'DARKNESS': 'Oscuridad',
        'LIGHT': 'Luz',
      'GROWING': 'Creciendo',
      'HARVESTED': 'Cosechado',
      'DISCARDED': 'Descartado'
    };
    const normalized = (status || '').toUpperCase();
    return statusMap[normalized] || status;
  };

  const activeCropsList = crops?.filter(c => c.status !== 'HARVESTED' && c.status !== 'DISCARDED') || [];
  const cropStatusTone = {
    SOAKING: 'blue',
    SOWED: 'green',
    GERMINATING: 'green',
    DARKNESS: 'violet',
    LIGHT: 'amber',
    GROWING: 'green'
  };

  useEffect(() => {
    // Auto-refresh data every 30 seconds for TV Mode
    const interval = setInterval(() => {
      if (refreshData) refreshData();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);



  useEffect(() => {
    const tabs = ['tasks', 'greenhouse', 'climate', 'orders', 'stock'];
    const rotateInterval = setInterval(() => {
      setTvTab(prev => {
        const nextIndex = (tabs.indexOf(prev) + 1) % tabs.length;
        return tabs[nextIndex];
      });
    }, 15000); // Rotate every 15 seconds
    return () => clearInterval(rotateInterval);
  }, []);

  return (
    <div className="tv-mode" style={{ minHeight: "100vh" }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '3rem', justifyContent: 'center' }}>
        <button 
          onClick={() => setTvTab('tasks')}
          style={{
            background: tvTab === 'tasks' ? 'linear-gradient(135deg, #34d399, #0ea5e9)' : '#1e293b',
            color: tvTab === 'tasks' ? 'white' : '#94a3b8',
            border: '2px solid',
            borderColor: tvTab === 'tasks' ? 'transparent' : '#334155',
            padding: '1rem 3rem',
            fontSize: '1.5rem',
            fontWeight: '900',
            borderRadius: '16px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: tvTab === 'tasks' ? '0 10px 25px rgba(52, 211, 153, 0.3)' : 'none'
          }}>
          🎯 TAREAS DEL DÍA
        </button>
        <button 
          onClick={() => setTvTab('greenhouse')}
          style={{
            background: tvTab === 'greenhouse' ? 'linear-gradient(135deg, #34d399, #0ea5e9)' : '#1e293b',
            color: tvTab === 'greenhouse' ? 'white' : '#94a3b8',
            border: '2px solid',
            borderColor: tvTab === 'greenhouse' ? 'transparent' : '#334155',
            padding: '1rem 3rem',
            fontSize: '1.5rem',
            fontWeight: '900',
            borderRadius: '16px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: tvTab === 'greenhouse' ? '0 10px 25px rgba(52, 211, 153, 0.3)' : 'none'
          }}>
          🌱 CULTIVOS ACTIVOS
        </button>

        <button 
          onClick={() => setTvTab('orders')}
          style={{
            background: tvTab === 'orders' ? 'linear-gradient(135deg, #34d399, #0ea5e9)' : '#1e293b',
            color: tvTab === 'orders' ? 'white' : '#94a3b8',
            border: '2px solid',
            borderColor: tvTab === 'orders' ? 'transparent' : '#334155',
            padding: '1rem 3rem',
            fontSize: '1.5rem',
            fontWeight: '900',
            borderRadius: '16px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: tvTab === 'orders' ? '0 10px 25px rgba(52, 211, 153, 0.3)' : 'none'
          }}>
          📦 ESTADO PEDIDOS
        </button>

        <button 
          onClick={() => setTvTab('climate')}
          style={{
            background: tvTab === 'climate' ? 'linear-gradient(135deg, #34d399, #0ea5e9)' : '#1e293b',
            color: tvTab === 'climate' ? 'white' : '#94a3b8',
            border: '2px solid',
            borderColor: tvTab === 'climate' ? 'transparent' : '#334155',
            padding: '1rem 3rem',
            fontSize: '1.5rem',
            fontWeight: '900',
            borderRadius: '16px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: tvTab === 'climate' ? '0 10px 25px rgba(52, 211, 153, 0.3)' : 'none'
          }}>
          🌡️ CLIMA ACTUAL
        </button>

              <button 
          onClick={() => setTvTab('stock')}
          style={{
            background: tvTab === 'stock' ? 'linear-gradient(135deg, #f59e0b, #ea580c)' : '#1e293b',
            color: tvTab === 'stock' ? 'white' : '#94a3b8',
            border: '2px solid',
            borderColor: tvTab === 'stock' ? 'transparent' : '#334155',
            padding: '1rem 3rem',
            fontSize: '1.5rem',
            fontWeight: '900',
            borderRadius: '16px',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            boxShadow: tvTab === 'stock' ? '0 10px 25px rgba(245, 158, 11, 0.3)' : 'none'
          }}>
          📦 STOCK NEVERA
        </button>

      </div>

        {tvTab === 'tasks' && (
          <EmployeeTasks />
        )}
        
        {tvTab === 'greenhouse' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div className="tv-panel-heading">
              <div>
                <span className="tv-eyebrow">PRODUCCIÓN EN TIEMPO REAL</span>
                <h2>Cultivos activos</h2>
              </div>
              <span className="tv-summary-badge">{activeCropsList.length} lotes activos</span>
            </div>
            <div className="tv-info-grid">
              {activeCropsList.map(crop => {
                const cType = cropTypes?.find(c => c.id === crop.cropTypeId) || seeds?.find(s => s.id === crop.seedId);
                const daysAlive = Math.floor((new Date() - new Date(crop.datePlanted)) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={crop.id} className="tv-info-card" data-tone={cropStatusTone[crop.status] || 'slate'}>
                    <div className="tv-card-topline">
                      <span className={`tv-label ${cropStatusTone[crop.status] || 'slate'}`}>{translateStatus(crop.status)}</span>
                      <span className="tv-label neutral">Día {daysAlive}</span>
                    </div>
                    <h3>{cType?.name || 'Variedad desconocida'}</h3>
                    <div className="tv-label-row">
                      <span className="tv-label neutral">Lote {crop.batchNumber || 'sin lote'}</span>
                      <span className="tv-label green">{crop.traysCount || 0} bandejas</span>
                    </div>
                  </div>
                );
              })}
            </div>
          
          {activeCropsList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '5rem', color: '#64748b', fontSize: '1.5rem' }}>
              🪴 El cultivo está completamente vacío en este momento.
            </div>
          )}
        </div>
      )}

      {tvTab === 'climate' && (
        <div style={{ animation: 'fadeIn 0.4s ease' }}>
          <div className="tv-panel-heading">
            <div>
              <span className="tv-eyebrow">CONDICIONES DEL CULTIVO</span>
              <h2>Clima actual</h2>
            </div>
            <span className="tv-summary-badge muted">Sin sensor conectado</span>
          </div>
          <div className="tv-climate-grid">
            <div className="tv-metric-card" data-tone="amber">
              <span className="tv-metric-icon">🌡️</span>
              <span className="tv-metric-label">Temperatura</span>
              <strong>-- °C</strong>
              <span className="tv-label amber">Pendiente de lectura</span>
            </div>
            <div className="tv-metric-card" data-tone="blue">
              <span className="tv-metric-icon">💧</span>
              <span className="tv-metric-label">Humedad</span>
              <strong>-- %</strong>
              <span className="tv-label blue">Pendiente de lectura</span>
            </div>
            <div className="tv-metric-card" data-tone="green">
              <span className="tv-metric-icon">🌿</span>
              <span className="tv-metric-label">Estado ambiental</span>
              <strong>Sin datos</strong>
              <span className="tv-label neutral">Conecta un sensor climático</span>
            </div>
          </div>
        </div>
      )}

      {tvTab === 'orders' && (
        <div style={{ animation: 'fadeIn 0.4s ease' }}>
          <div className="tv-panel-heading">
            <div>
              <span className="tv-eyebrow">LOGÍSTICA EN TIEMPO REAL</span>
              <h2>Estado de pedidos</h2>
            </div>
            <span className="tv-summary-badge">{orders?.filter(order => ['PENDING', 'PREPARED', 'IN_TRANSIT'].includes(order.status)).length || 0} pedidos activos</span>
          </div>
          
          <div className="tv-order-grid">
            <div className="tv-order-column">
              <h3><span className="tv-label amber">Pendientes</span></h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {orders?.filter(o => o.status === 'PENDING').map(o => {
                  const client = clients?.find(c => c.id === o.clientId);
                  return (
                    <div key={o.id} className="tv-info-card compact" data-tone="amber">
                      <h4 style={{ color: 'white', fontSize: '1.3rem', margin: '0 0 0.5rem 0' }}>{client?.name || 'Desconocido'}</h4>
                      <div className="tv-label-row"><span className="tv-label neutral">{o.items?.length || 0} productos</span><span className="tv-label amber">Por preparar</span></div>
                    </div>
                  );
                })}
                {(!orders || orders.filter(o => o.status === 'PENDING').length === 0) && <p style={{ textAlign: 'center', color: '#64748b' }}>No hay pedidos pendientes</p>}
              </div>
            </div>

            <div className="tv-order-column">
              <h3><span className="tv-label blue">Preparados</span></h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {orders?.filter(o => o.status === 'PREPARED').map(o => {
                  const client = clients?.find(c => c.id === o.clientId);
                  return (
                    <div key={o.id} className="tv-info-card compact" data-tone="blue">
                      <h4 style={{ color: 'white', fontSize: '1.3rem', margin: '0 0 0.5rem 0' }}>{client?.name || 'Desconocido'}</h4>
                      <div className="tv-label-row"><span className="tv-label blue">Listo</span><span className="tv-label neutral">Para furgoneta</span></div>
                    </div>
                  );
                })}
                {(!orders || orders.filter(o => o.status === 'PREPARED').length === 0) && <p style={{ textAlign: 'center', color: '#64748b' }}>Nada preparado ahora mismo</p>}
              </div>
            </div>

            <div className="tv-order-column">
              <h3><span className="tv-label violet">En reparto</span></h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {orders?.filter(o => o.status === 'IN_TRANSIT').map(o => {
                  const client = clients?.find(c => c.id === o.clientId);
                  return (
                    <div key={o.id} className="tv-info-card compact" data-tone="violet">
                      <h4 style={{ color: 'white', fontSize: '1.3rem', margin: '0 0 0.5rem 0' }}>{client?.name || 'Desconocido'}</h4>
                      <div className="tv-label-row"><span className="tv-label violet">En ruta</span><span className="tv-label neutral">Hacia el cliente</span></div>
                    </div>
                  );
                })}
                {(!orders || orders.filter(o => o.status === 'IN_TRANSIT').length === 0) && <p style={{ textAlign: 'center', color: '#64748b' }}>Ningún conductor en ruta</p>}
              </div>
            </div>
          </div>
        </div>
      )}

    
        {tvTab === 'stock' && (
          <div style={{ animation: 'fadeIn 0.4s ease', padding: '0 2rem' }}>
            <div className="tv-panel-heading">
              <div>
                <span className="tv-eyebrow">PRODUCTO TERMINADO</span>
                <h2>Control de disponibilidad</h2>
              </div>
              <span className="tv-summary-badge muted">Actualización automática · 30 s</span>
            </div>
            <div className="tv-info-grid stock">
              {(() => {
                if (!products || !productMovements) return <p style={{color:'white'}}>Cargando datos...</p>;

                const pendingOrders = orders?.filter(order =>
                  ['PENDING', 'PENDIENTE', 'PREPARED', 'IN_TRANSIT'].includes(order.status)
                ) || [];

                const stockRows = products.map(product => {
                  const movements = productMovements.filter(m => m.productId === product.id);
                  const movementBalance = movements.reduce((sum, movement) => sum + Number(movement.quantity || 0), 0);
                  const physical = Math.max(0, movementBalance);
                  const reserved = pendingOrders.reduce((sum, order) =>
                    sum + (order.items || [])
                      .filter(item => item.productId === product.id)
                      .reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0)
                  , 0);
                  return {
                    id: product.id,
                    name: product.name,
                    physical,
                    reserved,
                    available: Math.max(0, physical - reserved),
                    shortage: Math.max(0, reserved - physical)
                  };
                })
                  .filter(row => row.physical !== 0 || row.reserved !== 0)
                  .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es', { sensitivity: 'base' }));

                const columns = [
                  {
                    key: 'physical',
                    title: 'Stock total en nevera',
                    subtitle: 'Producto físico',
                    tone: 'physical',
                    rows: stockRows.filter(row => row.physical > 0)
                  },
                  {
                    key: 'reserved',
                    title: 'Reservado en pedidos',
                    subtitle: 'Pendiente de entregar',
                    tone: 'reserved',
                    rows: stockRows.filter(row => row.reserved > 0)
                  },
                  {
                    key: 'available',
                    title: 'Disponible para venta',
                    subtitle: 'Stock libre',
                    tone: 'available',
                    rows: stockRows.filter(row => row.available > 0)
                  }
                ];

                return columns.map(column => (
                  <section key={column.key} className={`tv-stock-column ${column.tone}`}>
                    <header>
                      <div>
                        <span>{column.subtitle}</span>
                        <h3>{column.title}</h3>
                      </div>
                      <strong>{column.rows.reduce((sum, row) => sum + row[column.key], 0)}</strong>
                    </header>
                    <div className="tv-stock-list">
                      {column.rows.map(row => (
                        <div key={row.id} className={column.key === 'reserved' && row.shortage > 0 ? 'shortage' : ''}>
                          <span>{row.name}</span>
                          <span className="tv-stock-value">
                            <strong>{row[column.key]}</strong>
                            {column.key === 'reserved' && row.shortage > 0 && <small>Faltan {row.shortage}</small>}
                          </span>
                        </div>
                      ))}
                      {column.rows.length === 0 && <p>Sin productos</p>}
                    </div>
                  </section>
                ));
              })()}
            </div>
          </div>
        )}

    </div>
  );
}
