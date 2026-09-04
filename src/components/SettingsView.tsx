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
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Household Settings & Controls
        </h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Private single-user settings, audit trail, and backups
        </p>
      </div>

      {/* Settings Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-700 gap-1 sm:gap-2">
        <button
          onClick={() => setActiveTab('appearance')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'appearance'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 dark:border-emerald-400'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Palette className="w-4 h-4" />
          Appearance & Themes
        </button>

        {!MV_SINGLE_USER_MODE && (
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'members'
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 dark:border-emerald-400'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Members & Access
            {members.some((m) => m.role === 'pending') && (
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'audit'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 dark:border-emerald-400'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          Audit Trail
        </button>

        <button
          onClick={() => setActiveTab('backup')}
          className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'backup'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 dark:border-emerald-400'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Download className="w-4 h-4" />
          Backup & Testing
        </button>
      </div>

      {/* TAB 1: Appearance & Themes */}
      {activeTab === 'appearance' && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs space-y-6">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                User Appearance Preferences
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Saved independently for <strong>{currentSession.email}</strong> in browser local storage. Changes do not alter shared household data.
              </p>
            </div>

            {/* Mode Selection */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-2">
                Interface Theme Mode
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => onUpdatePreferences({ theme: 'light' })}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition ${
                    userPreferences.theme === 'light'
                      ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/20'
                      : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-850 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Sun className="w-5 h-5" />
                  <span className="text-xs">Light</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdatePreferences({ theme: 'dark' })}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition ${
                    userPreferences.theme === 'dark'
                      ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/20'
                      : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-850 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Moon className="w-5 h-5" />
                  <span className="text-xs">Dark</span>
                </button>

                <button
                  type="button"
                  onClick={() => onUpdatePreferences({ theme: 'system' })}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition ${
                    userPreferences.theme === 'system'
                      ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/20'
                      : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-850 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Monitor className="w-5 h-5" />
                  <span className="text-xs">System</span>
                </button>
              </div>
            </div>

            {/* Accent Color Selection */}
            <div>
              <label className="block text-xs font-bold text-neutral-800 dark:text-neutral-200 mb-2">
                Accent Brand Tone
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'default', name: 'Emerald (Default)', color: 'bg-emerald-600' },
                  { id: 'blue', name: 'Ocean Blue', color: 'bg-blue-600' },
                  { id: 'lilac', name: 'Lilac / Purple', color: 'bg-purple-600' },
                  { id: 'yellow', name: 'Warm Yellow', color: 'bg-amber-500' },
                  { id: 'red', name: 'Crimson Red', color: 'bg-rose-600' },
                  { id: 'green', name: 'Meadow Green', color: 'bg-green-600' },
                  { id: 'teal', name: 'Teal Mineral', color: 'bg-teal-600' },
                  { id: 'orange', name: 'Sunset Orange', color: 'bg-orange-600' },
                  { id: 'rose', name: 'Rose Petal', color: 'bg-pink-600' },
                ].map((item) => {
                  const isSelected =
                    userPreferences.accent === item.id ||
                    (item.id === 'default' && (userPreferences.accent as string) === 'emerald');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onUpdatePreferences({ accent: item.id as AccentColor })}
                      className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1.5 ${
                        isSelected
                          ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-850 font-bold shadow-xs'
                          : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full ${item.color} flex items-center justify-center text-white`}>
                        {isSelected && <Check className="w-3 h-3" />}
                      </span>
                      <span className="text-[11px] text-neutral-800 dark:text-neutral-200">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Explicit Save Appearance Button & Confirmation */}
            <div className="pt-4 border-t border-neutral-100 dark:border-neutral-750 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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
                    setAppearanceSavedMessage(`Appearance preferences saved successfully for ${currentSession.email}!`);
                    setTimeout(() => setAppearanceSavedMessage(null), 4000);
                  } catch (err: any) {
                    setAppearanceSavedMessage('Failed to persist preferences: ' + (err.message || 'Unknown error'));
                  } finally {
                    setIsSavingAppearance(false);
                  }
                }}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
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
              Household Roster & Roles
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
                    <div className="flex items-center gap-2">
                      {m.role === 'pending' ? (
                        <>
                          <button
                            onClick={() => onApproveMember(m.id, 'editor')}
                            className="px-2.5 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition"
                          >
                            Approve as Editor
                          </button>
                          <button
                            onClick={() => onApproveMember(m.id, 'view_only')}
                            className="px-2.5 py-1.5 bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-lg text-xs font-semibold hover:bg-neutral-300 transition"
                          >
                            Approve View-Only
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
                          <option value="removed">Revoke Access</option>
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
            Immutable Audit Trail ({auditLogs.length} Events)
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
                  Development Verification
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Local diagnostic UI only. Production verification is provided by CI and Firestore Emulator evidence.
                </p>
              </div>
              <button
                onClick={onOpenAcceptanceTests}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 shadow-xs transition"
              >
                <Play className="w-3.5 h-3.5" />
                Run Local Diagnostics
              </button>
            </div>
          )}

          {/* Backup & Export */}
          <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                Export Verified Backup
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Download a validated JSON snapshot of the complete financial/configuration dataset and audit evidence.
              </p>
            </div>
            <button
              onClick={onDownloadBackup}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold rounded-xl hover:bg-neutral-800 dark:hover:bg-neutral-200 transition"
            >
              <Download className="w-3.5 h-3.5" />
              Download Verified Snapshot
            </button>
          </div>

          {/* Restore */}
          {isOwner && (
            <>
              <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs space-y-4">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Idempotent Restore
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Restore from a verified backup file. System validates row counts and financial totals prior to write confirmation.
                </p>
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
                  placeholder="Or paste backup JSON content here..."
                  rows={4}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-850 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs font-mono text-neutral-800 dark:text-neutral-200"
                />
                <button
                  type="submit"
                  disabled={!restoreJson.trim() || isRestoring}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition"
                >
                  {isRestoring ? 'Restoring...' : 'Restore from Backup'}
                </button>
              </form>
            </div>

            {/* Clean Production Reset */}
            <div className="bg-white dark:bg-neutral-800 p-6 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs space-y-4">
              <div>
                <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Clean Production Setup — Reset to Zero
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Clear all sample accounts, transactions, and scheduled bills so you can start from a completely clean slate with zero test data. User logins and permissions are preserved.
                </p>
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
                  Reset Household Data to Zero...
                </button>
              ) : (
                <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 space-y-3">
                  <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                    Are you sure? This will remove all transactions, accounts, and planned payments. This cannot be undone unless you export a backup first.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleResetExecute}
                      disabled={isResetting}
                      className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-xs transition"
                    >
                      {isResetting ? 'Resetting...' : 'Yes, Permanently Clear All Financial Data'}
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="px-3 py-2 bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-semibold hover:bg-neutral-300 transition"
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
                Development Mode — Load Sample Fixture Data
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Populate realistic household demonstration accounts, split transactions, and transfer plan bills from sample fixtures for development testing.
                </p>
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
                {isLoadingSample ? 'Loading Fixtures...' : 'Load Sample Demonstration Data'}
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
