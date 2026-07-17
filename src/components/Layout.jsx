import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, FileBox, ShoppingBag, FileText, Receipt, Menu, X } from 'lucide-react';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-container">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <button className="sidebar-close-btn" onClick={() => setSidebarOpen(false)} aria-label="Cerrar menú">
            <X size={20} />
          </button>
          <img src="/logo.png" alt="GreenCode" className="sidebar-logo" />
        </div>
        <nav className="sidebar-nav">
          <NavLink onClick={() => setSidebarOpen(false)} to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            <LayoutDashboard /> Dashboard
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/clients" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users /> Clientes
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/products" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileBox /> Productos
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/orders" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ShoppingBag /> Pedidos
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/delivery-notes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileText /> Albaranes
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/invoices" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Receipt /> Facturación
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/expenses" className={({ isActive }) => `nav-item hide-on-mobile ${isActive ? 'active' : ''}`}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Gastos
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/repartidor" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
            Reparto (Móvil)
          </NavLink>
        </nav>
      </aside>
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      
      <main className="main-content">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú">
            <Menu size={24} />
          </button>
          <h1 className="page-title">Microgreens CRM</h1>
          <div className="user-profile">
            {/* simple avatar placeholder */}
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary-light)', color: 'var(--color-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              A
            </div>
          </div>
        </header>
        <div className="page-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
