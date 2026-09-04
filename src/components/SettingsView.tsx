import React, { useState } from 'react';
import {
  Palette,
  Users,
  Shield,
  FileDown,
  FileUp,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sun,
  Moon,
  Monitor,
  Check,
  Download,
  Upload,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  HouseholdMember,
  AuditLogEntry,
  UserRole,
  UserSession,
  ThemePreference,
  AccentColor,
  UserPreferences,
} from '../types';
import { MV_SINGLE_USER_MODE } from '../accessPolicy';

interface SettingsViewProps {
  currentSession: UserSession;
  members: HouseholdMember[];
  auditLogs: AuditLogEntry[];
  userPreferences: UserPreferences;
  onUpdatePreferences: (prefs: Partial<UserPreferences>) => void;
  onSaveAppearance?: () => Promise<void>;
  onApproveMember: (memberId: string, role: 'editor' | 'view_only') => Promise<void>;
  onChangeRole: (memberId: string, newRole: UserRole) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  onDownloadBackup: () => Promise<void>;
  onRestoreBackup: (payload: any) => Promise<void>;
  onOpenAcceptanceTests: () => void;
  onResetHousehold?: () => Promise<void>;
  onLoadSampleData?: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentSession,
  members,
  auditLogs,
  userPreferences,
  onUpdatePreferences,
  onSaveAppearance,
  onApproveMember,
  onChangeRole,
  onRemoveMember,
  onDownloadBackup,
  onRestoreBackup,
  onOpenAcceptanceTests,
  onResetHousehold,
  onLoadSampleData,
}) => {
  const [activeTab, setActiveTab] = useState<'appearance' | 'members' | 'audit' | 'backup'>('appearance');
  const [restoreJson, setRestoreJson] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);
  const [appearanceSavedMessage, setAppearanceSavedMessage] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [sampleMessage, setSampleMessage] = useState<string | null>(null);

  const isOwner = currentSession.role === 'owner';
  const showDevelopmentTools = !import.meta.env.PROD;

  const handleResetExecute = async () => {
    if (!onResetHousehold) return;
    try {
      setIsResetting(true);
      setResetMessage(null);
      await onResetHousehold();
      setResetMessage('Household successfully reset to clean zero state.');
      setShowResetConfirm(false);
    } catch (err: any) {
      setResetMessage(err.message || 'Failed to reset household.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleLoadSampleExecute = async () => {
    if (!onLoadSampleData) return;
    try {
      setIsLoadingSample(true);
      setSampleMessage(null);
      await onLoadSampleData();
      setSampleMessage('Development sample data loaded successfully.');
    } catch (err: any) {
      setSampleMessage(err.message || 'Failed to load sample data.');
    } finally {
      setIsLoadingSample(false);
    }
  };

  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestoreError(null);
    setRestoreSuccess(null);
    try {
      setIsRestoring(true);
      const parsed = JSON.parse(restoreJson);
      await onRestoreBackup(parsed);
      setRestoreSuccess('Household data successfully restored and reconciled.');
      setRestoreJson('');
    } catch (err: any) {
      setRestoreError(err.message || 'Invalid backup JSON file.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRestoreJson(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-7 pb-12 px-1 sm:px-0">
      {/* Header */}
      <div className="px-1 sm:px-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight text-neutral-900 dark:text-neutral-100">
          Settings
        </h1>
      </div>

      {/* Settings Tabs */}
      <div className="rounded-xl border border-slate-200 dark:border-neutral-700 bg-[#f1f5f9] dark:bg-neutral-800/90 p-1.5 shadow-inner shadow-slate-200/40 dark:shadow-none">
        <div className={`grid gap-1.5 ${MV_SINGLE_USER_MODE ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
          <button
            onClick={() => setActiveTab('appearance')}
            className={`min-w-0 rounded-lg px-2 py-2 text-[11px] sm:text-xs font-semibold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
              activeTab === 'appearance'
                ? 'bg-white dark:bg-neutral-700 text-slate-950 dark:text-white shadow-sm ring-1 ring-slate-200/70 dark:ring-neutral-600'
                : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-100 hover:bg-white/60 dark:hover:bg-neutral-700/50'
            }`}
          >
            <Palette className="w-4 h-4 shrink-0" />
            <span className="leading-none">Appearance</span>
          </button>

          {!MV_SINGLE_USER_MODE && (
            <button
              onClick={() => setActiveTab('members')}
              className={`min-w-0 rounded-lg px-2 py-2 text-[11px] sm:text-xs font-semibold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
                activeTab === 'members'
                  ? 'bg-white dark:bg-neutral-700 text-slate-950 dark:text-white shadow-sm ring-1 ring-slate-200/70 dark:ring-neutral-600'
                  : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-100 hover:bg-white/60 dark:hover:bg-neutral-700/50'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className="leading-none">Access</span>
              {members.some((m) => m.role === 'pending') && (
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('audit')}
            className={`min-w-0 rounded-lg px-2 py-2 text-[11px] sm:text-xs font-semibold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-white dark:bg-neutral-700 text-slate-950 dark:text-white shadow-sm ring-1 ring-slate-200/70 dark:ring-neutral-600'
                : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-100 hover:bg-white/60 dark:hover:bg-neutral-700/50'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="leading-none">Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`min-w-0 rounded-lg px-2 py-2 text-[11px] sm:text-xs font-semibold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 ${
              activeTab === 'backup'
                ? 'bg-white dark:bg-neutral-700 text-slate-950 dark:text-white shadow-sm ring-1 ring-slate-200/70 dark:ring-neutral-600'
                : 'text-slate-500 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-neutral-100 hover:bg-white/60 dark:hover:bg-neutral-700/50'
            }`}
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="leading-none">Backup</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Appearance & Themes */}
      {activeTab === 'appearance' && (
        <div className="space-y-6 max-w-3xl">
          <div className="bg-white dark:bg-neutral-900 p-5 sm:p-7 rounded-2xl border border-slate-200/80 dark:border-neutral-800 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.14),0_2px_8px_-4px_rgba(15,23,42,0.08)] space-y-7">
            <div>
              <h2 className="text-base font-bold tracking-tight text-slate-950 dark:text-white">
                Appearance
              </h2>
            </div>

            {/* Mode Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-neutral-300 mb-3">
                Theme
              </label>
              <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3">
                <button
                  type="button"
                  onClick={() => onUpdatePreferences({ theme: 'light' })}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2.5 transition-all ${
                    userPreferences.theme === 'light'
                      ? 'border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-800/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-semibold ring-1 ring-emerald-200/70 dark:ring-emerald-800/60 shadow-sm'
                      : 'border-slate-200/80 dark:border-neutral-700 bg-white dark:bg-neutral-850 text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
                  }`}
                >
                  <Sun className="w-5 h-5" />
                  <span className="text-xs">Light</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdatePreferences({ theme: 'dark' })}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2.5 transition-all ${
                    userPreferences.theme === 'dark'
                      ? 'border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-800/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-semibold ring-1 ring-emerald-200/70 dark:ring-emerald-800/60 shadow-sm'
                      : 'border-slate-200/80 dark:border-neutral-700 bg-white dark:bg-neutral-850 text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
                  }`}
                >
                  <Moon className="w-5 h-5" />
                  <span className="text-xs">Dark</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdatePreferences({ theme: 'system' })}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2.5 transition-all ${
                    userPreferences.theme === 'system'
                      ? 'border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-800/70 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-semibold ring-1 ring-emerald-200/70 dark:ring-emerald-800/60 shadow-sm'
                      : 'border-slate-200/80 dark:border-neutral-700 bg-white dark:bg-neutral-850 text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
                  }`}
                >
                  <Monitor className="w-5 h-5" />
                  <span className="text-xs">System</span>
                </button>
              </div>
            </div>

            {/* Accent Color Selection */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600 dark:text-neutral-300 mb-3">
                Accent
              </label>
              <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] sm:grid-cols-3 gap-3">
                {[
                  { id: 'default', name: 'Emerald (Default)', color: 'bg-emerald-600', glow: 'shadow-[0_0_0_3px_rgba(5,150,105,0.16),0_8px_18px_-10px_rgba(5,150,105,0.45)]' },
                  { id: 'blue', name: 'Ocean Blue', color: 'bg-blue-600', glow: 'shadow-[0_0_0_3px_rgba(37,99,235,0.16),0_8px_18px_-10px_rgba(37,99,235,0.45)]' },
                  { id: 'lilac', name: 'Lilac / Purple', color: 'bg-purple-600', glow: 'shadow-[0_0_0_3px_rgba(147,51,234,0.16),0_8px_18px_-10px_rgba(147,51,234,0.45)]' },
                  { id: 'yellow', name: 'Warm Yellow', color: 'bg-amber-500', glow: 'shadow-[0_0_0_3px_rgba(245,158,11,0.18),0_8px_18px_-10px_rgba(245,158,11,0.45)]' },
                  { id: 'red', name: 'Crimson Red', color: 'bg-rose-600', glow: 'shadow-[0_0_0_3px_rgba(225,29,72,0.16),0_8px_18px_-10px_rgba(225,29,72,0.45)]' },
                  { id: 'green', name: 'Meadow Green', color: 'bg-green-600', glow: 'shadow-[0_0_0_3px_rgba(22,163,74,0.16),0_8px_18px_-10px_rgba(22,163,74,0.45)]' },
                  { id: 'teal', name: 'Teal Mineral', color: 'bg-teal-600', glow: 'shadow-[0_0_0_3px_rgba(13,148,136,0.16),0_8px_18px_-10px_rgba(13,148,136,0.45)]' },
                  { id: 'orange', name: 'Sunset Orange', color: 'bg-orange-600', glow: 'shadow-[0_0_0_3px_rgba(234,88,12,0.16),0_8px_18px_-10px_rgba(234,88,12,0.45)]' },
                  { id: 'rose', name: 'Rose Petal', color: 'bg-pink-600', glow: 'shadow-[0_0_0_3px_rgba(219,39,119,0.16),0_8px_18px_-10px_rgba(219,39,119,0.45)]' },
                ].map((item) => {
                  const isSelected =
                    userPreferences.accent === item.id ||
                    (item.id === 'default' && (userPreferences.accent as string) === 'emerald');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onUpdatePreferences({ accent: item.id as AccentColor })}
                      className={`p-3.5 rounded-xl border text-center transition-all flex flex-col items-center gap-2 bg-white dark:bg-neutral-850 border-slate-200 dark:border-neutral-700 hover:-translate-y-0.5 hover:bg-slate-50 dark:hover:bg-neutral-800 ${
                        isSelected
                          ? `${item.glow} border-slate-200 dark:border-neutral-600`
                          : 'shadow-[0_1px_2px_rgba(15,23,42,0.03)]'
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-full ${item.color} flex items-center justify-center text-white shadow-sm`}>
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className="text-[11px] leading-4 font-medium text-slate-700 dark:text-neutral-200">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Explicit Save Button & Confirmation */}
            <div className="pt-5 border-t border-slate-100 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <button
                type="button"
                id="save-appearance-button"
                disabled={isSavingAppearance}
                onClick={async () => {
                  try {
                    setIsSavingAppearance(true);
                    setAppearanceSavedMessage(null);
                    if (onSaveAppearance) {
                      await onSaveAppearance();
                    }
                    setAppearanceSavedMessage('Saved');
                    setTimeout(() => setAppearanceSavedMessage(null), 4000);
                  } catch (err: any) {
                    setAppearanceSavedMessage('Failed to persist preferences: ' + (err.message || 'Unknown error'));
                  } finally {
                    setIsSavingAppearance(false);
                  }
                }}
                className="px-7 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-700 active:translate-y-px text-white text-sm font-semibold shadow-[0_8px_18px_-8px_rgba(5,150,105,0.65),0_2px_6px_-2px_rgba(15,23,42,0.12)] transition-all flex items-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:shadow-none"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSavingAppearance ? 'Saving Appearance...' : 'Save Appearance'}
              </button>

              {appearanceSavedMessage && (
                <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 animate-fadeIn">
                  <Check className="w-3.5 h-3.5" />
                  <span>{appearanceSavedMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Members & Access */}
      {!MV_SINGLE_USER_MODE && activeTab === 'members' && (
        <div className="space-y-4 max-w-3xl">
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-4">
              Members
            </h2>

            <div className="space-y-3">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="p-4 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-200 dark:border-neutral-750 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {m.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          m.role === 'owner'
                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                            : m.role === 'editor'
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : m.role === 'view_only'
                            ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {m.role}
                      </span>
                    </div>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 block mt-0.5">
                      {m.email}
                    </span>
                  </div>

                  {isOwner && m.role !== 'owner' && (
                    <div className="mv-hscroll items-center max-w-full">
                      {m.role === 'pending' ? (
                        <>
                          <button
                            onClick={() => onApproveMember(m.id, 'editor')}
                            className="px-2.5 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition"
                          >
                            Editor
                          </button>
                          <button
                            onClick={() => onApproveMember(m.id, 'view_only')}
                            className="px-2.5 py-1.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs font-semibold hover:bg-neutral-300 transition"
                          >
                            View Only
                          </button>
                        </>
                      ) : (
                        <select
                          value={m.role}
                          onChange={(e) => onChangeRole(m.id, e.target.value as UserRole)}
                          className="px-2 py-1 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg text-xs font-medium text-neutral-800 dark:text-neutral-200"
                        >
                          <option value="editor">Editor</option>
                          <option value="view_only">View-Only</option>
                          <option value="removed">Remove</option>
                        </select>
                      )}
                      <button
                        onClick={() => onRemoveMember(m.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs max-w-4xl">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-4">
            Audit Trail ({auditLogs.length} Events)
          </h2>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-100 dark:border-neutral-750 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {log.action}
                    </span>
                    <span className="text-neutral-500 dark:text-neutral-400 ml-2">
                      by {log.actorEmail}
                    </span>
                    <p className="text-neutral-700 dark:text-neutral-300 mt-1 leading-relaxed">
                      {log.summary}
                    </p>
                  </div>
                  <span className="text-[10px] text-neutral-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('en-GB')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Backup & Testing */}
      {activeTab === 'backup' && (
        <div className="space-y-6 max-w-3xl">
          {showDevelopmentTools && (
            <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Diagnostics
                </h2>
              </div>
              <button
                onClick={onOpenAcceptanceTests}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 shadow-xs transition"
              >
                <Play className="w-3.5 h-3.5" />
                Run Diagnostics
              </button>
            </div>
          )}

          {/* Backup & Export */}
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Backup
              </h2>
            </div>
            <button
              onClick={onDownloadBackup}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-200 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download Backup
            </button>
          </div>

          {/* Restore */}
          {isOwner && (
            <>
              <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs space-y-4">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Restore
                </h2>
              </div>

              {restoreError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-800 dark:text-rose-300 text-xs">
                  {restoreError}
                </div>
              )}
              {restoreSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-xs">
                  {restoreSuccess}
                </div>
              )}

              <form onSubmit={handleRestoreSubmit} className="space-y-3">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-neutral-100 file:text-neutral-700 hover:file:bg-neutral-200"
                />
                <textarea
                  value={restoreJson}
                  onChange={(e) => setRestoreJson(e.target.value)}
                  placeholder="Paste backup JSON"
                  rows={4}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-850 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-mono text-neutral-800 dark:text-neutral-200"
                />
                <button
                  type="submit"
                  disabled={!restoreJson.trim() || isRestoring}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition"
                >
                  {isRestoring ? 'Restoring...' : 'Restore'}
                </button>
              </form>
            </div>

            {/* Clean Production Reset */}
            <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs space-y-4">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Reset Data
                </h2>
              </div>

              {resetMessage && (
                <div className="p-3 bg-neutral-100 dark:bg-neutral-700 rounded-xl text-xs text-neutral-800 dark:text-neutral-200">
                  {resetMessage}
                </div>
              )}

              {!showResetConfirm ? (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="px-4 py-2 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl text-xs font-semibold transition"
                >
                  Reset Data
                </button>
              ) : (
                <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 space-y-3">
                  <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                    This deletes all financial data. Export a backup first if needed.
                  </p>
                  <div className="mv-hscroll items-center">
                    <button
                      onClick={handleResetExecute}
                      disabled={isResetting}
                      className="shrink-0 whitespace-nowrap px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
                    >
                      {isResetting ? 'Resetting...' : 'Delete All Data'}
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="shrink-0 whitespace-nowrap px-3 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-semibold hover:bg-neutral-300 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {showDevelopmentTools && (
              <>
                {/* Opt-in Sample Fixture Data */}
                <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs space-y-4">
                <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Sample Data
                </h2>
                </div>
                
                {sampleMessage && (
                <div className="p-3 bg-neutral-100 dark:bg-neutral-700 rounded-xl text-xs text-neutral-800 dark:text-neutral-200">
                {sampleMessage}
                </div>
                )}
                
                <button
                onClick={handleLoadSampleExecute}
                disabled={isLoadingSample}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-900 dark:bg-neutral-200 dark:hover:bg-white text-white dark:text-neutral-900 rounded-xl text-xs font-semibold shadow-xs transition"
                >
                {isLoadingSample ? 'Loading Fixtures...' : 'Load Sample Data'}
                </button>
                </div>
              </>
            )}
          </>
        )}
        </div>
      )}
    </div>
  );
};
