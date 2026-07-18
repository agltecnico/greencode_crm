import Swal from 'sweetalert2';

window.alert = (msg) => {
  Swal.fire({
    text: msg,
    icon: 'info',
    confirmButtonColor: '#0ea5e9',
    confirmButtonText: 'Entendido'
  });
};

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'

import React from 'react';
class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("GlobalErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '2rem', background: '#fee2e2', color: '#991b1b', minHeight: '100vh'}}>
          <h2>¡Error Crítico en la Aplicación!</h2>
          <p>Por favor, copia este texto técnico y envíaselo a la IA para que lo arregle:</p>
          <pre style={{background: 'white', padding: '1rem', marginTop: '1rem', overflowX: 'auto'}}>{this.state.error && this.state.error.toString()}</pre>
          <pre style={{background: 'white', padding: '1rem', marginTop: '1rem', overflowX: 'auto'}}>{this.state.error && this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

import { DataProvider } from './context/DataContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <DataProvider>
        <GlobalErrorBoundary><App /></GlobalErrorBoundary>
      </DataProvider>
    </BrowserRouter>
  </StrictMode>,
)
