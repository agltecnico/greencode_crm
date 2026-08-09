import React, { useState, useEffect, useMemo } from 'react';
import EmployeeTasks from '../components/EmployeeTasks';
import { useData } from '../context/DataContext';
import '../crops.css';

export default function TvDashboard() {
  const tvViews = ['tasks', 'greenhouse', 'climate', 'orders', 'stock'];
  const [screenMode, setScreenMode] = useState(() => {
    const urlView = new URLSearchParams(window.location.search).get('view');
    if (tvViews.includes(urlView)) return urlView;
    const savedView = localStorage.getItem('greencode_tv_screen_mode');
    return savedView === 'rotate' || tvViews.includes(savedView) ? savedView : 'rotate';
  });
  const [tvTab, setTvTab] = useState(() => screenMode === 'rotate' ? 'tasks' : screenMode);
  const [cropStatusFilter, setCropStatusFilter] = useState('ALL');
  const [cropPage, setCropPage] = useState(1);
  const [cropLabelSize, setCropLabelSize] = useState(() => localStorage.getItem('greencode_tv_crop_label_size') || 'medium');
  const { crops, cropTypes, seeds, refreshData, orders, clients, products, productMovements } = useData();

  const translateStatus = (status) => {
    const statusMap = {
      'SOAKING': 'En Remojo',
      'SOWED': 'Sembrado',
      'GERMINATING': 'Germinando',
        'DARKNESS': 'Oscuridad',
        'LIGHT': 'Luz',
      'GROWING': 'Creciendo',
      'READY': 'Listo para cosechar',
      'HARVESTED': 'Cosechado',
      'DISCARDED': 'Descartado'
    };
    const normalized = (status || '').toUpperCase();
    return statusMap[normalized] || status;
  };

  const activeCropsList = useMemo(() => crops?.filter(c => c.status !== 'HARVESTED' && c.status !== 'DISCARDED') || [], [crops]);
  const cropStatusTone = {
    SOAKING: 'blue',
    SOWED: 'green',
    GERMINATING: 'green',
    DARKNESS: 'violet',
    LIGHT: 'amber',
    GROWING: 'green',
    READY: 'green'
  };

  const cropsPerPage = cropLabelSize === 'small' ? 48 : cropLabelSize === 'large' ? 20 : 32;
  const filteredCrops = useMemo(() => activeCropsList
    .filter(crop => cropStatusFilter === 'ALL' || String(crop.status || '').toUpperCase() === cropStatusFilter)
    .sort((a, b) => new Date(a.datePlanted || 0) - new Date(b.datePlanted || 0)), [activeCropsList, cropStatusFilter]);
  const cropPageCount = Math.max(1, Math.ceil(filteredCrops.length / cropsPerPage));
  const visibleCrops = filteredCrops.slice((cropPage - 1) * cropsPerPage, cropPage * cropsPerPage);

  useEffect(() => {
    localStorage.setItem('greencode_tv_screen_mode', screenMode);
    const url = new URL(window.location.href);
    if (screenMode === 'rotate') url.searchParams.delete('view');
    else url.searchParams.set('view', screenMode);
    window.history.replaceState({}, '', url);
  }, [screenMode]);

  useEffect(() => {
    localStorage.setItem('greencode_tv_crop_label_size', cropLabelSize);
    setCropPage(1);
  }, [cropLabelSize]);

  useEffect(() => {
    // Auto-refresh data every 30 seconds for TV Mode
    const interval = setInterval(() => {
      if (refreshData) refreshData();
    }, 30000);
    return () => clearInterval(interval);
  }, [refreshData]);



  useEffect(() => {
    if (screenMode !== 'rotate') return undefined;
    const tabs = ['tasks', 'greenhouse', 'climate', 'orders', 'stock'];
    const rotateInterval = setInterval(() => {
      setTvTab(prev => {
        const nextIndex = (tabs.indexOf(prev) + 1) % tabs.length;
        return tabs[nextIndex];
      });
    }, 15000); // Rotate every 15 seconds
    return () => clearInterval(rotateInterval);
  }, [screenMode]);

  return (
    <div className="tv-mode" style={{ minHeight: "100vh" }}>
      <div className="tv-screen-profile">
        <div><span>PANTALLA</span><strong>{screenMode === 'rotate' ? 'Rotación general' : screenMode === 'greenhouse' ? 'Sala de cultivos' : screenMode === 'orders' ? 'Sala de cosecha y pedidos' : screenMode === 'tasks' ? 'Tareas del equipo' : screenMode === 'stock' ? 'Stock de nevera' : 'Clima'}</strong></div>
        <select value={screenMode} onChange={event => {
          const nextMode = event.target.value;
          setScreenMode(nextMode);
          if (nextMode !== 'rotate') setTvTab(nextMode);
        }} aria-label="Perfil de esta pantalla">
          <option value="rotate">Rotación general</option>
          <option value="greenhouse">Sala de cultivos</option>
          <option value="orders">Sala de cosecha · Pedidos</option>
          <option value="tasks">Tareas del equipo</option>
          <option value="stock">Stock de nevera</option>
          <option value="climate">Clima</option>
        </select>
      </div>
      {screenMode === 'rotate' && (
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
      )}

        {tvTab === 'tasks' && (
          <EmployeeTasks />
        )}
        
        {tvTab === 'greenhouse' && (
          <div className="tv-crop-screen" style={{ animation: 'fadeIn 0.4s ease' }}>
            <aside className="tv-crop-sidebar">
              <div className="tv-crop-sidebar-title"><span>🌱</span><strong>Cultivos</strong><small>{activeCropsList.length} activos</small></div>
              <nav className="tv-crop-toolbar" aria-label="Filtrar cultivos por fase">
              {[
                ['ALL', 'Todos'], ['SOAKING', 'Remojo'], ['GERMINATING', 'Germinación'],
                ['DARKNESS', 'Oscuridad'], ['LIGHT', 'Luz'], ['READY', 'Listos']
              ].map(([value, label]) => (
                <button key={value} data-status={value} className={cropStatusFilter === value ? 'active' : ''} onClick={() => { setCropStatusFilter(value); setCropPage(1); }}>
                  {label}
                  <strong>{value === 'ALL' ? activeCropsList.length : activeCropsList.filter(crop => String(crop.status || '').toUpperCase() === value).length}</strong>
                </button>
              ))}
              </nav>
              <div className="tv-crop-size-control"><span>Tamaño</span><div>
                {[['small', 'S'], ['medium', 'M'], ['large', 'L']].map(([value, label]) => (
                  <button key={value} className={cropLabelSize === value ? 'active' : ''} onClick={() => setCropLabelSize(value)}>{label}</button>
                ))}
              </div></div>
            </aside>
            <main className="tv-crop-main">
              <div className="tv-crop-compact-heading"><strong>{cropStatusFilter === 'ALL' ? 'Todos los cultivos' : translateStatus(cropStatusFilter)}</strong><span>{filteredCrops.length} lotes · actualización automática</span></div>
              <div className={`tv-crop-label-grid size-${cropLabelSize}`}>
                  {visibleCrops.map(crop => {
                    const cType = cropTypes?.find(type => type.id === crop.cropTypeId) || seeds?.find(seed => seed.id === crop.seedId);
                    const planted = new Date(crop.datePlanted);
                    const daysAlive = Math.max(0, Math.floor((new Date() - planted) / 86_400_000));
                    return (
                      <article key={crop.id} className="tv-crop-label" data-status={String(crop.status || '').toUpperCase()}>
                        <div className="tv-crop-label-top"><span>{translateStatus(crop.status)}</span><strong>{crop.traysCount || 0}<small> band.</small></strong></div>
                        <h3>{cType?.name || 'Variedad desconocida'}</h3>
                        <div className="tv-crop-label-meta"><strong>Día {daysAlive}</strong><span>{Number.isNaN(planted.getTime()) ? '—' : planted.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span></div>
                        <small className="tv-crop-label-batch">{crop.cultivationBatchNumber || crop.batchNumber || 'Sin lote'}</small>
                      </article>
                    );
                  })}
                {filteredCrops.length === 0 && <div className="tv-crop-empty">No hay cultivos en esta fase.</div>}
              </div>
            {cropPageCount > 1 && <div className="tv-pagination">
              <span>Mostrando {filteredCrops.length ? (cropPage - 1) * cropsPerPage + 1 : 0}–{Math.min(cropPage * cropsPerPage, filteredCrops.length)} de {filteredCrops.length}</span>
              <div><button disabled={cropPage <= 1} onClick={() => setCropPage(page => Math.max(1, page - 1))}>← Anterior</button><strong>Página {cropPage} / {cropPageCount}</strong><button disabled={cropPage >= cropPageCount} onClick={() => setCropPage(page => Math.min(cropPageCount, page + 1))}>Siguiente →</button></div>
            </div>}
            </main>
          
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
