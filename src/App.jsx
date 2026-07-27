import { Routes, Route, Outlet } from 'react-router-dom';
import Layout from './components/Layout';
import Hub from './pages/Hub';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Providers from './pages/Providers';
import Products from './pages/Products';
import Orders from './pages/Orders';
import DeliveryNotes from './pages/DeliveryNotes';
import Invoices from './pages/Invoices';
import Crops from './pages/Crops';
import TvDashboard from './pages/TvDashboard';
import DriverView from './pages/DriverView';
import PublicTicket from './pages/PublicTicket';
import Login from './pages/Login';
import UserAccess from './pages/UserAccess';
import ProtectedRoute from './components/ProtectedRoute';
import { DataProvider } from './context/DataContext';
import { AdminModeProvider } from './context/AdminModeContext';
import './App.css';

const ProtectedProviders = () => (
  <ProtectedRoute>
    <AdminModeProvider>
      <DataProvider><Outlet /></DataProvider>
    </AdminModeProvider>
  </ProtectedRoute>
);

const PermissionGate = ({ permission, children }) => (
  <ProtectedRoute permission={permission}>{children}</ProtectedRoute>
);

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedProviders />}>
      <Route path="/" element={<Hub />} />
      <Route path="/admin" element={<PermissionGate permission="administration"><Layout /></PermissionGate>}>
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="providers" element={<Providers />} />
        <Route path="products" element={<Products />} />
        <Route path="orders" element={<Orders />} />
        <Route path="delivery-notes" element={<DeliveryNotes />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="users" element={<PermissionGate permission="users"><UserAccess /></PermissionGate>} />
                      </Route>
      <Route path="/crops" element={<PermissionGate permission="crops"><Crops /></PermissionGate>} />

      {/* Rutas sin Layout (Pantalla completa) */}
      <Route path="/tv" element={<PermissionGate permission="tv"><TvDashboard /></PermissionGate>} />
      <Route path="/repartidor" element={<PermissionGate permission="delivery"><DriverView /></PermissionGate>} />
      </Route>
      <Route path="/ticket/:id" element={<DataProvider><PublicTicket /></DataProvider>} />
      </Routes>
  );
}

export default App;
