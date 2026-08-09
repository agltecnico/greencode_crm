import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StockAlerts from '../components/StockAlerts';
import ProcurementSummary from '../components/ProcurementSummary';
import { useAuth } from '../context/AuthContext';

export default function Hub() {
  const navigate = useNavigate();
  const { profile, hasPermission, signOut } = useAuth();

  useEffect(() => {
    const mobileEntry = window.matchMedia('(max-width: 768px)').matches;
    const entryKey = `greencode-mobile-default-${profile?.id || profile?.email || 'user'}`;
    if (mobileEntry && hasPermission('delivery') && !sessionStorage.getItem(entryKey)) {
      sessionStorage.setItem(entryKey, 'delivery');
      navigate('/repartidor', { replace: true });
    }
  }, [hasPermission, navigate, profile?.email, profile?.id]);

  return (
    <div className="hub-container">
      <div className="hub-content">
        <div className="hub-header">
          <img src="/logo.png" alt="GreenCode Logo" className="hub-logo" />
          <h1>Central de Operaciones</h1>
          <p>Selecciona el módulo al que deseas acceder</p>
          <div className="hub-session">
            <span>{profile?.display_name || profile?.email}</span>
            <button type="button" onClick={signOut}>Cerrar sesión</button>
          </div>
        </div>

        {(hasPermission('stock') || hasPermission('administration')) && <StockAlerts />}
        {(hasPermission('stock') || hasPermission('administration')) && <ProcurementSummary />}

        <div className="hub-grid">
          
          {hasPermission('administration') && <button className="hub-card admin-card" onClick={() => navigate('/admin')}>
            <div className="hub-card-icon">📊</div>
            <div className="hub-card-text">
              <h2>Administración</h2>
              <p>Oficina, Ventas, Clientes y Facturación</p>
            </div>
          </button>}

          {(hasPermission('crops') || hasPermission('stock') || hasPermission('tasks') || hasPermission('harvest') || hasPermission('planner') || hasPermission('traceability')) && <button className="hub-card crops-card" onClick={() => navigate('/crops')}>
            <div className="hub-card-icon">🌱</div>
            <div className="hub-card-text">
              <h2>Producción</h2>
              <p>Stock, Cultivos, Cosecha y Planificador</p>
            </div>
          </button>}

          {hasPermission('tv') && <button className="hub-card tv-card" onClick={() => window.open('/tv', 'TVMode', 'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no,resizable=yes')}>
            <div className="hub-card-icon">🖥️</div>
            <div className="hub-card-text">
              <h2>Modo TV</h2>
              <p>Pantalla de trabajo en tiempo real</p>
            </div>
          </button>}

          {hasPermission('delivery') && <button className="hub-card driver-card" onClick={() => navigate('/repartidor')}>
            <div className="hub-card-icon">🚚</div>
            <div className="hub-card-text">
              <h2>Modo Reparto</h2>
              <p>Entregas móviles y firma digital</p>
            </div>
          </button>}

        </div>
      </div>
    </div>
  );
}
