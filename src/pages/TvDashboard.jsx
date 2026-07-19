import React, { useState, useEffect } from 'react';
import EmployeeTasks from '../components/EmployeeTasks';
import { useData } from '../context/DataContext';
import '../crops.css';

export default function TvDashboard() {
  const [tvTab, setTvTab] = useState('tasks');
  const { crops, cropTypes, seeds, advanceCropStatus, refreshData, orders, clients, products, productMovements } = useData();

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

      </div>\n\n        {tvTab === 'tasks' && (
          <EmployeeTasks />
        )}
        
        {tvTab === 'greenhouse' && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
              {activeCropsList.map(crop => {
                const cType = cropTypes?.find(c => c.id === crop.cropTypeId) || seeds?.find(s => s.id === crop.seedId);
                const daysAlive = Math.floor((new Date() - new Date(crop.datePlanted)) / (1000 * 60 * 60 * 24));
                
                return (
                  <div key={crop.id} className={`status-card ${crop.status}`} style={{ background: '#1e293b', borderColor: '#334155', padding: '1rem' }}>
                    <div className="status-header" style={{ marginBottom: '0.75rem' }}>
                      <div>
                        <h4 className="status-title" style={{ color: '#f8fafc', fontSize: '1rem', minHeight: '24px', margin: 0 }}>{cType?.name || 'Variedad Desconocida'}</h4>
                        <span className="status-batch" style={{ background: '#0f172a', color: '#94a3b8', fontSize: '0.75rem', padding: '2px 8px', display: 'inline-block', marginTop: '4px' }}>LOTE: {crop.batchNumber}</span>
                      </div>
                    </div>
                    
                    <div className="status-footer" style={{ borderTopColor: '#334155', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #334155' }}>
                      <div>
                        <p style={{ margin: '0 0 2px 0', fontSize: '0.65rem', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Estado</p>
                        <p className="status-current" style={{ fontSize: '1.2rem', margin: 0 }}>{translateStatus(crop.status)}</p>
                        <p className="status-days" style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '2px', marginBottom: 0 }}>Día {daysAlive}</p>
                      </div>
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

      {tvTab === 'orders' && (
        <div style={{ animation: 'fadeIn 0.4s ease' }}>
          <div className="tasks-header" style={{ marginBottom: '3rem' }}>
            <h2>Panel Logístico de Pedidos</h2>
            <p style={{ color: '#94a3b8', fontSize: '1.25rem' }}>Estado en tiempo real de los envíos de hoy.</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
            <div style={{ background: '#1e293b', borderRadius: '24px', padding: '2rem', border: '2px solid #334155' }}>
              <h3 style={{ color: '#fbbf24', fontSize: '1.8rem', textAlign: 'center', marginBottom: '2rem' }}>🟡 PENDIENTES</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {orders?.filter(o => o.status === 'PENDING').map(o => {
                  const client = clients?.find(c => c.id === o.clientId);
                  return (
                    <div key={o.id} style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '16px', borderLeft: '6px solid #fbbf24' }}>
                      <h4 style={{ color: 'white', fontSize: '1.3rem', margin: '0 0 0.5rem 0' }}>{client?.name || 'Desconocido'}</h4>
                      <p style={{ color: '#94a3b8', margin: 0 }}>{o.items?.length || 0} productos</p>
                    </div>
                  );
                })}
                {(!orders || orders.filter(o => o.status === 'PENDING').length === 0) && <p style={{ textAlign: 'center', color: '#64748b' }}>No hay pedidos pendientes</p>}
              </div>
            </div>

            <div style={{ background: '#1e293b', borderRadius: '24px', padding: '2rem', border: '2px solid #334155' }}>
              <h3 style={{ color: '#38bdf8', fontSize: '1.8rem', textAlign: 'center', marginBottom: '2rem' }}>🔵 PREPARADOS</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {orders?.filter(o => o.status === 'PREPARED').map(o => {
                  const client = clients?.find(c => c.id === o.clientId);
                  return (
                    <div key={o.id} style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '16px', borderLeft: '6px solid #38bdf8' }}>
                      <h4 style={{ color: 'white', fontSize: '1.3rem', margin: '0 0 0.5rem 0' }}>{client?.name || 'Desconocido'}</h4>
                      <p style={{ color: '#94a3b8', margin: 0 }}>Listo para la furgoneta</p>
                    </div>
                  );
                })}
                {(!orders || orders.filter(o => o.status === 'PREPARED').length === 0) && <p style={{ textAlign: 'center', color: '#64748b' }}>Nada preparado ahora mismo</p>}
              </div>
            </div>

            <div style={{ background: '#1e293b', borderRadius: '24px', padding: '2rem', border: '2px solid #334155' }}>
              <h3 style={{ color: '#a855f7', fontSize: '1.8rem', textAlign: 'center', marginBottom: '2rem' }}>🟣 EN REPARTO</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {orders?.filter(o => o.status === 'IN_TRANSIT').map(o => {
                  const client = clients?.find(c => c.id === o.clientId);
                  return (
                    <div key={o.id} style={{ background: '#0f172a', padding: '1.5rem', borderRadius: '16px', borderLeft: '6px solid #a855f7' }}>
                      <h4 style={{ color: 'white', fontSize: '1.3rem', margin: '0 0 0.5rem 0' }}>{client?.name || 'Desconocido'}</h4>
                      <p style={{ color: '#94a3b8', margin: 0 }}>En camino hacia el cliente</p>
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
            <h2 style={{ color: '#fff', fontSize: '2.5rem', textAlign: 'center', marginBottom: '2rem' }}>📦 CONTROL DE DISPONIBILIDAD</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {(() => {
                if (!products || !productMovements) return <p style={{color:'white'}}>Cargando datos...</p>;
                
                return products.map(product => {
                  // 1. Tuppers Envasados (Stock físico)
                  const movements = productMovements.filter(m => m.productId === product.id);
                  const envasados = movements.reduce((sum, m) => sum + Number(m.quantity || 0), 0);
                  
                  // 2. Tuppers en Pedidos (Pendientes de entrega)
                  const pendingOrders = orders?.filter(o => o.status === 'PENDIENTE' || o.status === 'PREPARED' || o.status === 'IN_TRANSIT') || [];
                  let enPedidos = 0;
                  pendingOrders.forEach(o => {
                    if (o.items) {
                      o.items.forEach(item => {
                        if (item.productId === product.id) enPedidos += Number(item.quantity || 0);
                      });
                    }
                  });

                  // 3. Tuppers que Sobran (Disponibles)
                  const sobran = envasados - enPedidos;

                  if (envasados === 0 && enPedidos === 0) return null;

                  return (
                    <div key={product.id} style={{ 
                      background: '#1e293b', 
                      border: `3px solid ${sobran > 0 ? '#10b981' : sobran < 0 ? '#ef4444' : '#334155'}`, 
                      borderRadius: '16px', 
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      <h3 style={{ color: '#fff', fontSize: '1.8rem', margin: 0, textAlign: 'center', borderBottom: '1px solid #334155', paddingBottom: '0.5rem' }}>{product.name}</h3>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ color: '#94a3b8', fontSize: '1rem', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Envasados</span>
                          <span style={{ color: '#fff', fontSize: '2.5rem', fontWeight: '900' }}>{envasados}</span>
                        </div>
                        <div style={{ fontSize: '2rem', color: '#64748b' }}>-</div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ color: '#fb923c', fontSize: '1rem', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>En Pedido</span>
                          <span style={{ color: '#fb923c', fontSize: '2.5rem', fontWeight: '900' }}>{enPedidos}</span>
                        </div>
                        <div style={{ fontSize: '2rem', color: '#64748b' }}>=</div>
                        <div style={{ textAlign: 'center', background: sobran > 0 ? 'rgba(16, 185, 129, 0.2)' : sobran < 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(51, 65, 85, 0.5)', padding: '0.5rem 1rem', borderRadius: '12px' }}>
                          <span style={{ color: sobran > 0 ? '#10b981' : sobran < 0 ? '#ef4444' : '#94a3b8', fontSize: '1rem', display: 'block', textTransform: 'uppercase', fontWeight: 'bold' }}>Sobran</span>
                          <span style={{ color: sobran > 0 ? '#10b981' : sobran < 0 ? '#ef4444' : '#94a3b8', fontSize: '3rem', fontWeight: '900' }}>{sobran}</span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

    </div>
  );
}