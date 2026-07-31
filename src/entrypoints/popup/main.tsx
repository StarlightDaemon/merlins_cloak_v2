import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { injectPopupTheme } from '../../theme/popup-theme';
import './style.css';

injectPopupTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
