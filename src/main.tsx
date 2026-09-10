import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { MVNativeSelectBridge } from './components/MVSelect';
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
import './unifiedAddBridge';
import { applyThemePreferences, readStoredUserPreferences } from './themeEngine';
import { installMVNativeSelectTouchGuard } from './nativeSelectTouchGuard';

// Apply the saved token set before React paints to prevent theme flash.
applyThemePreferences(readStoredUserPreferences());
installMVNativeSelectTouchGuard();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <MVNativeSelectBridge />
  </React.StrictMode>
);
