import React from 'react';
import { useNavigate } from 'react-router-dom';
import StockAlerts from '../components/StockAlerts';

export default function Hub() {
  const navigate = useNavigate();

  return (
    <div className="hub-container">
      <div className="hub-content">
        <div className="hub-header">
          <img src="/logo.png" alt="GreenCode Logo" className="hub-logo" />
          <h1>Central de Operaciones</h1>
          <p>Selecciona el módulo al que deseas acceder</p>
        </div>

        <StockAlerts />

        <div className="hub-grid">
          
          <button className="hub-card admin-card" onClick={() => navigate('/admin')}>
            <div className="hub-card-icon">📊</div>
            <div className="hub-card-text">
              <h2>Administración</h2>
              <p>Oficina, Ventas, Clientes y Facturación</p>
            </div>
          </button>

          <button className="hub-card crops-card" onClick={() => navigate('/crops')}>
            <div className="hub-card-icon">🌱</div>
            <div className="hub-card-text">
              <h2>Cultivo</h2>
              <p>Bandejas, Tareas y Planificador</p>
            </div>
          </button>

          <button className="hub-card tv-card" onClick={() => window.open('/tv', 'TVMode', 'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no,resizable=yes')}>
            <div className="hub-card-icon">🖥️</div>
            <div className="hub-card-text">
              <h2>Modo TV</h2>
              <p>Pantalla de trabajo en tiempo real</p>
            </div>
          </button>

          <button className="hub-card driver-card" onClick={() => navigate('/repartidor')}>
            <div className="hub-card-icon">🚚</div>
            <div className="hub-card-text">
              <h2>Modo Reparto</h2>
              <p>Entregas móviles y firma digital</p>
            </div>
          </button>

        </div>
      </div>
    </div>
  );
}
