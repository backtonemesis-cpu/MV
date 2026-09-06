import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './globalDesignSystem.css';
import { applyThemePreferences, readStoredUserPreferences } from './themeEngine';
import { installModalAccessibility } from './utils/modalAccessibility';

// Apply the saved token set before React paints to prevent theme flash.
applyThemePreferences(readStoredUserPreferences());

// Enforce one modal-dialog accessibility contract across legacy and current
// modal components: semantics, initial/contained focus, label association and
// focus restoration. Individual modal business logic remains unchanged.
installModalAccessibility();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);