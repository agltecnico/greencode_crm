import Swal from 'sweetalert2';

window.alert = (msg) => {
  let icon = 'info';
  let title = 'Información';
  let color = '#0ea5e9'; // default blue
  
  const textLower = msg.toLowerCase();
  
  if (textLower.includes('error') || textLower.includes('crítico') || textLower.includes('incompletos')) {
    icon = 'error';
    title = '¡Error!';
    color = '#ef4444'; // red
  } else if (textLower.includes('atención') || textLower.includes('insuficiente') || textLower.includes('seguro') || textLower.includes('por favor')) {
    icon = 'warning';
    title = '¡Atención!';
    color = '#f59e0b'; // amber
  } else if (textLower.includes('éxito') || textLower.includes('completado') || textLower.includes('registrada') || textLower.includes('plantado')) {
    icon = 'success';
    title = '¡Genial!';
    color = '#10b981'; // emerald
  }

  Swal.fire({
    title: title,
    text: msg,
    icon: icon,
    confirmButtonColor: color,
    confirmButtonText: 'Entendido',
    customClass: {
      popup: 'premium-swal-popup',
      title: 'premium-swal-title',
      confirmButton: 'premium-swal-button'
    }
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
