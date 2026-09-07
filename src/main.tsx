import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './globalDesignSystem.css';
import './mobileUx.css';
import './accessibilityContrast.css';
import './accentContrast.css';
import './activityFilterRegression.css';
import { applyThemePreferences, readStoredUserPreferences } from './themeEngine';
import { migrateLegacyCategoriesInBrowserStorage } from './utils/legacyCategoryMigration';

// Repair only deterministic legacy source-category relationships before the
// household is loaded. The migration makes an exact local rollback copy first.
migrateLegacyCategoriesInBrowserStorage();

// Apply the saved token set before React paints to prevent theme flash.
applyThemePreferences(readStoredUserPreferences());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);