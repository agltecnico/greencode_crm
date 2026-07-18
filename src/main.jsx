import Swal from 'sweetalert2';

window.alert = (msg) => {
  Swal.fire({
    text: msg,
    icon: 'info',
    confirmButtonColor: '#0ea5e9'
  });
};

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { DataProvider } from './context/DataContext.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <DataProvider>
        <App />
      </DataProvider>
    </BrowserRouter>
  </StrictMode>,
)
