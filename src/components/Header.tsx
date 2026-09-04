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
    <header className="sticky top-0 z-30 bg-surface backdrop-blur border-b border-muted transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-accent text-on-accent w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
              MV
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-main tracking-tight text-base sm:text-lg">
                  MV Finance
                </span>
                <span className="hidden sm:inline-block text-xs font-medium px-2 py-0.5 bg-surface-muted text-muted rounded-md border border-muted">
                  v{datasetVersion}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="header-backup-btn"
              onClick={onOpenBackupModal}
              className="bg-surface text-main border border-muted inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors"
              title="Backup"
            >
              <DownloadCloud className="w-4 h-4 text-muted" />
              <span className="hidden sm:inline">Backup</span>
            </button>

            <button
              id="header-refresh-btn"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg text-muted hover:bg-surface-muted transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-accent' : 'text-muted'}`} />
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-muted bg-surface">
              <div className="w-7 h-7 rounded-full bg-warning-soft text-warning flex items-center justify-center">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs leading-tight">
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
