import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Truck, FileBox, ShoppingBag, FileText, Receipt, ReceiptText, Menu, X, UserCog, LogOut } from 'lucide-react';
import AdminModeButton from './AdminModeButton';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, hasPermission, signOut } = useAuth();

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
          <NavLink onClick={() => setSidebarOpen(false)} to="/" className="nav-item" end style={{ background: "#f8fafc", color: "#0ea5e9", fontWeight: "bold", border: "1px solid #e0f2fe", marginBottom: '0.5rem' }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Volver al Hub
          </NavLink>
          
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
            <LayoutDashboard /> Dashboard
          </NavLink>

          <div className="sidebar-group-title" style={{ marginTop: '0.75rem', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.05em', paddingLeft: '1rem' }}>BASE DE DATOS</div>
          
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin/clients" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users /> Clientes
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin/providers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Truck /> Proveedores
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin/products" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileBox /> Productos
          </NavLink>

          <div className="sidebar-group-title" style={{ marginTop: '0.75rem', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.05em', paddingLeft: '1rem' }}>VENTAS</div>

          <NavLink onClick={() => setSidebarOpen(false)} to="/admin/orders" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ShoppingBag /> Pedidos
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin/delivery-notes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileText /> Albaranes
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin/invoices" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Receipt /> Facturación
          </NavLink>
          <NavLink onClick={() => setSidebarOpen(false)} to="/admin/expenses" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ReceiptText /> Gastos
          </NavLink>

          <div className="sidebar-group-title" style={{ marginTop: '0.75rem', marginBottom: '0.25rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', letterSpacing: '0.05em', paddingLeft: '1rem' }}>OPERACIONES</div>

          {hasPermission('users') && <NavLink onClick={() => setSidebarOpen(false)} to="/admin/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <UserCog /> Usuarios y permisos
          </NavLink>}
        </nav>
      </aside>
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      
      <main className="main-content">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)} aria-label="Abrir menú">
            <Menu size={24} />
          </button>
          <h1 className="page-title">Administración</h1>
          <div className="user-profile">
            <span style={{ fontSize: '.75rem', color: '#64748b' }}>{profile?.display_name}</span>
            <AdminModeButton />
            <button type="button" onClick={signOut} title="Cerrar sesión" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#64748b' }}><LogOut size={20} /></button>
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
