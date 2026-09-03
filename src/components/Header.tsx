import React, { useState } from 'react';
import {
  Shield,
  RefreshCw,
  DownloadCloud,
  CheckCircle2,
  Users,
  ChevronDown,
  UserCheck,
  Clock,
  Sparkles,
  Lock,
} from 'lucide-react';
import { UserRole, UserSession } from '../types';

interface HeaderProps {
  session: UserSession | null;
  datasetVersion: number;
  onSwitchUser: (email: string) => void;
  onRefresh: () => void;
  onOpenBackupModal: () => void;
  onOpenTestsModal: () => void;
  isLoading: boolean;
  availableIdentities: { email: string; name: string; role: UserRole }[];
}

export const Header: React.FC<HeaderProps> = ({
  session,
  datasetVersion,
  onSwitchUser,
  onRefresh,
  onOpenBackupModal,
  onOpenTestsModal,
  isLoading,
  availableIdentities,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [customEmail, setCustomEmail] = useState('');

  const getRoleBadge = (role?: UserRole) => {
    switch (role) {
      case 'owner':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Shield className="w-3 h-3 text-amber-600" />
            Owner / Admin
          </span>
        );
      case 'editor':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <UserCheck className="w-3 h-3 text-emerald-600" />
            Editor
          </span>
        );
      case 'view_only':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <Lock className="w-3 h-3 text-blue-600" />
            View Only
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <Clock className="w-3 h-3 text-rose-600" />
            Pending Approval
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-neutral-900/95 backdrop-blur border-b border-neutral-200 dark:border-neutral-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo and Household Info */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-700 dark:bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
              MV
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-neutral-900 dark:text-neutral-100 tracking-tight text-base sm:text-lg">
                  MV Finance
                </span>
                <span className="hidden sm:inline-block text-xs font-medium px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-md border border-neutral-200 dark:border-neutral-700">
                  v{datasetVersion}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 hidden sm:block">
                Authoritative Household Ledger
              </p>
            </div>
          </div>

          {/* Controls and Active User Switcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Test Suite Runner Button */}
            <button
              id="header-run-tests-btn"
              onClick={onOpenTestsModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 transition-colors shadow-xs"
              title="Run 22 Hand-off Acceptance Tests"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden md:inline">Acceptance Tests (22/22)</span>
            </button>

            {/* Backup & Restore Button */}
            <button
              id="header-backup-btn"
              onClick={onOpenBackupModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              title="Backup & Restore Dataset"
            >
              <DownloadCloud className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
              <span className="hidden lg:inline">Backup & Restore</span>
            </button>

            {/* Refresh Button */}
            <button
              id="header-refresh-btn"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
              title="Sync latest state"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            {/* Simulated Active User Selector */}
            <div className="relative">
              <button
                id="header-identity-selector"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-white dark:bg-neutral-800 text-left transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 flex items-center justify-center font-bold text-xs uppercase">
                  {session?.name ? session.name.substring(0, 1) : 'U'}
                </div>
                <div className="hidden sm:block text-xs">
                  <div className="font-semibold text-neutral-800 dark:text-neutral-200 leading-tight">
                    {session?.name || 'User'}
                  </div>
                  <div className="text-neutral-500 dark:text-neutral-400 text-[10px] truncate max-w-[120px]">
                    {session?.email}
                  </div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-neutral-850 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 p-2 z-50 animate-in fade-in">
                  <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 mb-1">
                    <p className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">Simulate Authenticated Identity</p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Enforces server-side permissions for Marius, Vesta, or Pending guests.
                    </p>
                  </div>

                  <div className="space-y-1">
                    {availableIdentities.map((item) => (
                      <button
                        key={item.email}
                        onClick={() => {
                          onSwitchUser(item.email);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                          session?.email.toLowerCase() === item.email.toLowerCase()
                            ? 'bg-neutral-100 dark:bg-neutral-750 font-semibold'
                            : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
                        }`}
                      >
                        <div>
                          <div className="text-neutral-900 dark:text-neutral-100">{item.name}</div>
                          <div className="text-[11px] text-neutral-500 dark:text-neutral-400">{item.email}</div>
                        </div>
                        <div>{getRoleBadge(item.role)}</div>
                      </button>
                    ))}
                  </div>

                  {/* Option to test unknown pending account */}
                  <div className="pt-2 mt-2 border-t border-neutral-100 dark:border-neutral-800 px-2">
                    <p className="text-[11px] font-medium text-neutral-600 dark:text-neutral-300 mb-1.5">
                      Test Unknown Account (Pending Status):
                    </p>
                    <div className="flex gap-1">
                      <input
                        type="email"
                        placeholder="newuser@example.com"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        className="flex-1 px-2 py-1 text-xs border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 rounded focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        onClick={() => {
                          if (customEmail.trim()) {
                            onSwitchUser(customEmail.trim());
                            setCustomEmail('');
                            setDropdownOpen(false);
                          }
                        }}
                        className="px-2.5 py-1 text-xs bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 rounded font-medium hover:bg-neutral-900 dark:hover:bg-neutral-100"
                      >
                        Test
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile secondary bar showing role and current state */}
        <div className="sm:hidden py-1.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 dark:text-neutral-400 text-[11px]">{session?.email}</span>
          </div>
          <div>{getRoleBadge(session?.role)}</div>
        </div>
      </div>
    </header>
  );
};
