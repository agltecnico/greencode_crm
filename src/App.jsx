import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Products from './pages/Products';
import Orders from './pages/Orders';
import DeliveryNotes from './pages/DeliveryNotes';
import Invoices from './pages/Invoices';
import Expenses from './pages/Expenses';
import DriverView from './pages/DriverView';
import PublicTicket from './pages/PublicTicket';
import './App.css';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="products" element={<Products />} />
        <Route path="orders" element={<Orders />} />
        <Route path="delivery-notes" element={<DeliveryNotes />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="expenses" element={<Expenses />} />
      </Route>

      {/* Rutas sin Layout (Pantalla completa) */}
      <Route path="/repartidor" element={<DriverView />} />
      <Route path="/ticket/:id" element={<PublicTicket />} />
      </Routes>
  );
}

export default App;
