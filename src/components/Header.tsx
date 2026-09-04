import React from 'react';
import {
  Shield,
  RefreshCw,
  DownloadCloud,
  HardDrive,
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
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 dark:bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
              MV
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-900 dark:text-neutral-100 tracking-tight text-base sm:text-lg">
                  MV Finance
                </span>
                <span className="hidden sm:inline-block text-xs font-medium px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-md border border-neutral-200 dark:border-neutral-700">
                  v{datasetVersion}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 hidden sm:flex items-center gap-1.5">
                <HardDrive className="w-3 h-3" />
                Local browser data • £0
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="header-backup-btn"
              onClick={onOpenBackupModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              title="Backup & Restore Local Data"
            >
              <DownloadCloud className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
              <span className="hidden sm:inline">Backup & Restore</span>
            </button>

            <button
              id="header-refresh-btn"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              title="Reload local state"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
              <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs leading-tight">
                <div className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {session?.name || 'Marius'}
                </div>
                <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                  Local only
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="sm:hidden py-1.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px]">
          <span className="text-neutral-500 dark:text-neutral-400">
            {session?.name || 'Marius'}
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
            <HardDrive className="w-3 h-3" />
            Local only
          </span>
        </div>
      </div>
    </header>
  );
};
