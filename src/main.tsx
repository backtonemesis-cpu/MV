import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './globalDesignSystem.css';
import './mobileUx.css';
import './accessibilityContrast.css';
import './accentContrast.css';
import './activityFilterRegression.css';
import './unifiedAddConsistency.css';
import './unifiedAddDesktopTransferPromptBalance.css';
import './unifiedAddLauncherCompact.css';
import './unifiedAddSelectIndicator.css';
import './unifiedAddIphoneDateContainment.css';
import './globalControlSurface.css';
import './mvSelect.css';
import './dashboard.css';
import './dashboardPriorityOneClosure.css';
import './unifiedAddBridge';
import { applyThemePreferences, readStoredUserPreferences } from './themeEngine';

// Apply the saved token set before React paints to prevent theme flash.
applyThemePreferences(readStoredUserPreferences());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
