import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, FileBox, ShoppingBag, FileText, Receipt, Menu, X, Sprout } from 'lucide-react';

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
          <NavLink onClick={() => setSidebarOpen(false)} to="/" className="nav-item" end style={{ background: "#f8fafc", color: "#0ea5e9", fontWeight: "bold", border: "1px solid #e0f2fe", marginBottom: "1rem" }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Volver al Hub
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            <LayoutDashboard /> Dashboard
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin/clients" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users /> Clientes
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin/products" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileBox /> Productos
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin/orders" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ShoppingBag /> Pedidos
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin/delivery-notes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileText /> Albaranes
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin/invoices" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Receipt /> Facturación
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin/supplies" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Gestión de Cultivo
          </NavLink>
          
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin/expenses" className={({ isActive }) => `nav-item hide-on-mobile ${isActive ? 'active' : ''}`}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Gastos
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
