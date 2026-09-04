import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { applyThemePreferences, readStoredUserPreferences } from './themeEngine';

// Apply the saved token set before React paints to prevent theme flash.
applyThemePreferences(readStoredUserPreferences());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
