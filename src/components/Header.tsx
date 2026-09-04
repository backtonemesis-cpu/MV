import React from 'react';
import {
  Shield,
  RefreshCw,
  DownloadCloud,
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
}

export const Header: React.FC<HeaderProps> = ({
  session,
  datasetVersion,
  onRefresh,
  onOpenBackupModal,
  isLoading,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-surface backdrop-blur border-b border-muted transition-colors">
      <div className="mx-auto w-full max-w-[1440px] px-4">
        <div className="flex h-[52px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-on-accent shadow-xs">
              MV
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[15px] font-semibold tracking-tight text-main">
                  MV Finance
                </span>
                <span
                  className="hidden rounded-md border border-muted bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted sm:inline-block"
                  title="Application version"
                >
                  v{APP_VERSION}
                </span>
                <span
                  className="hidden sm:inline-block text-xs font-medium px-2 py-0.5 bg-surface-muted text-muted rounded-md border border-muted"
                  title="Local financial dataset revision"
                >
                  Data v{datasetVersion}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              id="header-backup-btn"
              onClick={onOpenBackupModal}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-muted bg-surface px-2.5 text-[11px] font-semibold text-main transition-colors"
              title="Backup"
            >
              <DownloadCloud className="w-4 h-4 text-muted" />
              <span className="hidden sm:inline">Backup</span>
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

            <div className="hidden h-8 items-center gap-1.5 rounded-md border border-muted bg-surface px-2 sm:flex">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-warning-soft text-warning">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div className="text-[11px] leading-tight">
                <div className="font-semibold text-main">
                  {session?.name || 'Marius'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
