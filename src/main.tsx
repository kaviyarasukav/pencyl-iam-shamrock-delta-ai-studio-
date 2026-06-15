import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import axios from 'axios';
import App from './App.tsx';
import './index.css';

// Global axios error logging
axios.interceptors.response.use(
  response => response,
  error => {
    // Suppress 401 errors from global logging as they are handled by the UI
    // Suppress specific network errors to prevent console spam during dev reloads
    if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
      console.error('🌐 Network Error Details:', {
        message: error.message,
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        data: error.response?.data
      });
    }
    return Promise.reject(error);
  }
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
