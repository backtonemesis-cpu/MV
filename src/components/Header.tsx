import React from 'react';
import {
  Shield,
  RefreshCw,
  DownloadCloud,
  Monitor,
  Smartphone,
  Eye,
  EyeOff,
} from 'lucide-react';
import { UserSession } from '../types';
import { APP_VERSION } from '../appVersion';

interface HeaderProps {
  session: UserSession | null;
  datasetVersion: number;
  onSwitchUser: (email: string) => void;
  onRefresh: () => void;
  onOpenBackupModal: () => void;
  onOpenTestsModal: () => void;
  isLoading: boolean;
  availableIdentities: { email: string; name: string; role: any }[];
  layoutMode: 'pc' | 'phone';
  onLayoutModeChange: (mode: 'pc' | 'phone') => void;
  isPrivacyMasked: boolean;
  onTogglePrivacyMask: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  datasetVersion,
  onRefresh,
  onOpenBackupModal,
  isLoading,
  layoutMode,
  onLayoutModeChange,
  isPrivacyMasked,
  onTogglePrivacyMask,
}) => {
  return (
    <header className="mv-app-header sticky top-0 z-30 bg-surface backdrop-blur border-b border-muted transition-colors">
      <div className="mv-shell-boundary mx-auto w-full max-w-[1200px] px-4">
        <div className="mv-app-header-row flex h-[44px] items-center justify-between gap-2.5">
          <div className="mv-header-brand flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-[12px] font-bold text-on-accent">
              MV
            </div>
            <div className="mv-header-brand-copy min-w-0">
              <div className="flex items-center gap-2">
                <span className="mv-header-brand-title text-[14px] font-semibold tracking-tight text-main">
                  MV Finance
                </span>
                <span
                  className="hidden rounded-md border border-muted bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted sm:inline-block"
                  title="Application version"
                >
                  v{APP_VERSION}
                </span>
                <span
                  className="hidden rounded-md border border-muted bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted sm:inline-block"
                  title="Local financial dataset revision"
                >
                  Data v{datasetVersion}
                </span>
              </div>
            </div>
          </div>

          <div className="mv-header-actions flex items-center gap-1.5 sm:gap-2">
            <button
              id="header-backup-btn"
              onClick={onOpenBackupModal}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-muted bg-surface px-2.5 text-[11px] font-semibold text-main transition-colors"
              title="Backup"
            >
              <DownloadCloud className="w-4 h-4 text-muted" />
              <span className="mv-header-backup-label hidden sm:inline">Backup</span>
            </button>

            <button
              id="header-refresh-btn"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex h-8 w-8 items-center justify-center rounded-md p-0 text-muted transition-colors hover:bg-surface-muted disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-accent' : 'text-muted'}`} />
            </button>

            <div className="mv-header-user hidden h-8 items-center gap-1.5 rounded-md border border-muted bg-surface px-2 sm:flex">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-warning-soft text-warning">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div className="text-[11px] leading-tight">
                <div className="font-semibold text-main">
                  {session?.name || 'Marius'}
                </div>
              </div>
            </div>

            <button
              type="button"
              id="header-privacy-mask-btn"
              onClick={onTogglePrivacyMask}
              aria-pressed={isPrivacyMasked}
              className={`mv-privacy-toggle inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold transition-colors ${
                isPrivacyMasked
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-muted bg-surface text-main hover:bg-surface-muted'
              }`}
              title={isPrivacyMasked ? 'Show balances' : 'Mask balances'}
            >
              {isPrivacyMasked ? (
                <EyeOff className="h-4 w-4 shrink-0" />
              ) : (
                <Eye className="h-4 w-4 shrink-0" />
              )}
              <span className="mv-privacy-label">
                {isPrivacyMasked ? 'Show Balances' : 'Mask Balances'}
              </span>
            </button>

            <div
              className="mv-layout-switcher"
              role="group"
              aria-label="App display mode"
              title="Choose the layout for this device"
            >
              <button
                type="button"
                id="header-layout-pc-btn"
                onClick={() => onLayoutModeChange('pc')}
                aria-pressed={layoutMode === 'pc'}
                className={`mv-layout-switcher-option ${layoutMode === 'pc' ? 'is-active' : ''}`}
              >
                <Monitor className="h-4 w-4 shrink-0" />
                <span>PC</span>
              </button>
              <button
                type="button"
                id="header-layout-phone-btn"
                onClick={() => onLayoutModeChange('phone')}
                aria-pressed={layoutMode === 'phone'}
                className={`mv-layout-switcher-option ${layoutMode === 'phone' ? 'is-active' : ''}`}
              >
                <Smartphone className="h-4 w-4 shrink-0" />
                <span>Phone</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
