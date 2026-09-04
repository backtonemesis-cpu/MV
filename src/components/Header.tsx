import React from 'react';
import {
  Shield,
  RefreshCw,
  DownloadCloud,
} from 'lucide-react';
import { UserSession } from '../types';

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
    <header className="sticky top-0 z-30 mv-surface bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-b mv-border border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="mv-primary-bg w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
              MV
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold mv-text text-neutral-900 dark:text-neutral-100 tracking-tight text-base sm:text-lg">
                  MV Finance
                </span>
                <span className="hidden sm:inline-block text-xs font-medium px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-md border mv-border border-neutral-200 dark:border-neutral-700">
                  v{datasetVersion}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="header-backup-btn"
              onClick={onOpenBackupModal}
              className="mv-secondary-button inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              title="Backup"
            >
              <DownloadCloud className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
              <span className="hidden sm:inline">Backup</span>
            </button>

            <button
              id="header-refresh-btn"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin mv-primary-text' : 'mv-text-muted'}`} />
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border mv-border border-neutral-200 dark:border-neutral-700 mv-surface bg-white dark:bg-neutral-800">
              <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs leading-tight">
                <div className="font-semibold text-neutral-800 dark:text-neutral-200">
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
