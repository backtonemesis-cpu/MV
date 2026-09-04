import React, { useEffect, useRef, useState } from 'react';
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
  UserSession,
  ThemePreference,
  AccentColor,
  UserPreferences,
} from '../types';

const ACCENT_OPTIONS: { id: AccentColor; name: string; color: string }[] = [
  { id: 'emerald', name: 'Emerald Green', color: '#22C55E' },
  { id: 'sapphire', name: 'Sapphire Blue', color: '#2563eb' },
  { id: 'amethyst', name: 'Amethyst Purple', color: '#8b5cf6' },
  { id: 'crimson', name: 'Crimson Ruby', color: '#e11d48' },
  { id: 'amber', name: 'Sunset Amber', color: '#d97706' },
  { id: 'teal', name: 'Ocean Teal', color: '#0d9488' },
  { id: 'indigo', name: 'Midnight Indigo', color: '#4f46e5' },
  { id: 'rose', name: 'Rose Quartz', color: '#db2777' },
  { id: 'gold', name: 'Classic Gold', color: '#b45309' },
];

interface SettingsViewProps {
  currentSession: UserSession;
  members: HouseholdMember[];
  auditLogs: AuditLogEntry[];
  userPreferences: UserPreferences;
  onUpdatePreferences: (prefs: Partial<UserPreferences>) => void;
  onSaveAppearance?: () => Promise<void>;
  onCreateMember: (data: { name: string }) => Promise<void>;
  onUpdateMember: (memberId: string, data: { name?: string }) => Promise<void>;
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
  onCreateMember,
  onUpdateMember,
  onRemoveMember,
  onDownloadBackup,
  onRestoreBackup,
  onOpenAcceptanceTests,
  onResetHousehold,
  onLoadSampleData,
}) => {
  const isOwner = currentSession.role === 'owner';
  const [activeTab, setActiveTab] = useState<'appearance' | 'members' | 'audit' | 'backup'>('appearance');
  const [restoreJson, setRestoreJson] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);
  const [appearanceSavedMessage, setAppearanceSavedMessage] = useState<string | null>(null);
  const [hoveredAccent, setHoveredAccent] = useState<AccentColor | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [sampleMessage, setSampleMessage] = useState<string | null>(null);
  const [memberName, setMemberName] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberMessage, setMemberMessage] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [isUpdatingMember, setIsUpdatingMember] = useState(false);
  const memberNameInputRef = useRef<HTMLInputElement>(null);

  const settingsTabOrder = ['appearance', 'members', 'audit', 'backup'] as const;

  const handleSettingsTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: (typeof settingsTabOrder)[number]
  ) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;

    event.preventDefault();
    const currentIndex = settingsTabOrder.indexOf(currentTab);
    const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex =
      (currentIndex + direction + settingsTabOrder.length) % settingsTabOrder.length;
    const nextTab = settingsTabOrder[nextIndex];
    setActiveTab(nextTab);
    requestAnimationFrame(() => {
      document.getElementById(`settings-tab-${nextTab}`)?.focus();
    });
  };

  useEffect(() => {
    if (activeTab !== 'members' || !isOwner) return;
    const frame = requestAnimationFrame(() => memberNameInputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [activeTab, isOwner]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (editingMemberId) {
        setEditingMemberId(null);
        setEditMemberName('');
        return;
      }

      if (showResetConfirm) {
        setShowResetConfirm(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [editingMemberId, showResetConfirm]);

  const activeAccentName =
    ACCENT_OPTIONS.find((item) => item.id === (hoveredAccent ?? userPreferences.accent))?.name ??
    'Emerald Green';

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

  const handleAddMember = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setIsAddingMember(true);
      setMemberMessage(null);
      await onCreateMember({
        name: memberName.trim(),
      });
      setMemberName('');
      setMemberMessage('Household member added.');
    } catch (err: any) {
      setMemberMessage(err.message || 'Failed to add household member.');
    } finally {
      setIsAddingMember(false);
    }
  };

  const beginEditMember = (member: HouseholdMember) => {
    setEditingMemberId(member.id);
    setEditMemberName(member.name);
    setMemberMessage(null);
  };

  const saveEditedMember = async (memberId: string) => {
    try {
      setIsUpdatingMember(true);
      setMemberMessage(null);
      await onUpdateMember(memberId, {
        name: editMemberName.trim(),
      });
      setEditingMemberId(null);
      setMemberMessage('Household member updated.');
    } catch (err: any) {
      setMemberMessage(err.message || 'Failed to update household member.');
    } finally {
      setIsUpdatingMember(false);
    }
  };

  return (
    <div className="mv-settings space-y-4 pb-8">
      {/* Header */}
      <div className="px-1 sm:px-0">
        <h1 className="text-main text-xl sm:text-2xl font-bold tracking-tight leading-tight">
          Settings
        </h1>
      </div>

      {/* Settings Tabs */}
      <div className="mv-settings-tabs" role="tablist" aria-label="Settings sections">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          <button
            id="settings-tab-appearance"
            role="tab"
            aria-selected={activeTab === 'appearance'}
            onClick={() => setActiveTab('appearance')}
            onKeyDown={(event) => handleSettingsTabKeyDown(event, 'appearance')}
            className={`mv-settings-tab ${activeTab === 'appearance' ? 'is-active' : ''}`}
          >
            <Palette className="w-4 h-4 shrink-0" />
            <span className="leading-none">Appearance</span>
          </button>

          <button
              id="settings-tab-members"
            role="tab"
            aria-selected={activeTab === 'members'}
              onClick={() => setActiveTab('members')}
              onKeyDown={(event) => handleSettingsTabKeyDown(event, 'members')}
              className={`mv-settings-tab ${activeTab === 'members' ? 'is-active' : ''}`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className="leading-none">Household</span>
              {members.some((m) => m.role === 'pending') && (
                <span className="w-2 h-2 rounded-full bg-warning-soft inline-block" />
              )}
            </button>

          <button
            id="settings-tab-audit"
            role="tab"
            aria-selected={activeTab === 'audit'}
            onClick={() => setActiveTab('audit')}
            onKeyDown={(event) => handleSettingsTabKeyDown(event, 'audit')}
            className={`mv-settings-tab ${activeTab === 'audit' ? 'is-active' : ''}`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="leading-none">Audit</span>
          </button>

          <button
            id="settings-tab-backup"
            role="tab"
            aria-selected={activeTab === 'backup'}
            onClick={() => setActiveTab('backup')}
            onKeyDown={(event) => handleSettingsTabKeyDown(event, 'backup')}
            className={`mv-settings-tab ${activeTab === 'backup' ? 'is-active' : ''}`}
          >
            <Download className="w-4 h-4 shrink-0" />
            <span className="leading-none">Backup</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Appearance & Themes */}
      {activeTab === 'appearance' && (
        <div className="mv-settings-stack max-w-3xl">
          <div className="mv-settings-panel space-y-4">
            <div>
              <h2 className="text-main text-base font-bold tracking-tight">
                Appearance
              </h2>
            </div>

            {/* Base Theme Modes */}
            <div>
              <label className="text-muted block text-xs font-semibold uppercase tracking-[0.08em] mb-3">
                Base Theme
              </label>
              <div className="mv-settings-segmented">
                {[
                  { id: 'light' as ThemePreference, name: 'Light', icon: Sun },
                  { id: 'dark' as ThemePreference, name: 'Dark', icon: Moon },
                  { id: 'slate' as ThemePreference, name: 'Slate Grey', icon: Monitor },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = userPreferences.theme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onUpdatePreferences({ theme: item.id })}
                      className={`mv-settings-segment ${isSelected ? 'is-active' : ''}`}
                      aria-pressed={isSelected}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="leading-tight text-center">{item.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Accent Highlights */}
            <div className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <label className="text-muted text-xs font-semibold uppercase tracking-[0.08em]">
                  Accent Highlight
                </label>
                <span className="mv-accent-current-label" aria-live="polite">
                  {activeAccentName}
                </span>
              </div>

              <div
                className="mv-accent-picker"
                role="group"
                aria-label="Accent highlight"
                onMouseLeave={() => setHoveredAccent(null)}
              >
                {ACCENT_OPTIONS.map((item) => {
                  const isSelected = userPreferences.accent === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-label={item.name}
                      title={item.name}
                      aria-pressed={isSelected}
                      onMouseEnter={() => setHoveredAccent(item.id)}
                      onFocus={() => setHoveredAccent(item.id)}
                      onBlur={() => setHoveredAccent(null)}
                      onClick={() => onUpdatePreferences({ accent: item.id })}
                      className={`mv-accent-swatch ${isSelected ? 'is-active' : ''}`}
                      style={{ '--swatch': item.color } as React.CSSProperties}
                    />
                  );
                })}
              </div>
            </div>

            <div className="mv-settings-actions">
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
                className="mv-settings-primary inline-flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSavingAppearance ? 'Saving...' : 'Save Appearance'}
              </button>

              {appearanceSavedMessage && (
                <div className="text-accent text-xs font-semibold flex items-center gap-1.5 animate-fadeIn">
                  <Check className="w-3.5 h-3.5" />
                  <span>{appearanceSavedMessage}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Household people */}
      {activeTab === 'members' && (
        <div className="mv-settings-stack max-w-3xl">
          <div className="mv-settings-panel">
            <div className="flex items-start gap-3">
              <Users className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
              <div>
                <h2 className="text-sm font-bold text-main">Household Members</h2>
                <p className="mt-1 text-xs leading-5 text-muted">
                  Manage the people whose finances are tracked in MV. Active names are used in
                  account owner, received by, paid by, bill responsibility and savings selectors.
                </p>
                <p className="mt-1 text-[11px] leading-4 text-subtle">
                  Removing a person only removes them from future selections. Historical records
                  keep the original name for the audit trail.
                </p>
              </div>
            </div>
          </div>

          {isOwner && (
            <form
              onSubmit={handleAddMember}
              className="mv-settings-panel"
            >
              <div className="mb-4">
                <h3 className="text-sm font-bold text-main">Add Household Member</h3>
                <p className="mt-0.5 text-xs text-muted">
                  Add another person whose accounts, income or spending you want to track.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1 block text-xs font-semibold text-muted">Name</label>
                  <input
                    ref={memberNameInputRef}
                    value={memberName}
                    onChange={(event) => setMemberName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        setMemberName('');
                        event.currentTarget.blur();
                      }
                    }}
                    className="mv-settings-control w-full"
                    placeholder="e.g. Vesta"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingMember || !memberName.trim()}
                  className="mv-settings-primary"
                >
                  {isAddingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>

              {memberMessage && (
                <div className="mt-3 text-xs font-medium text-muted">{memberMessage}</div>
              )}
            </form>
          )}

          <div className="mv-settings-panel">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-main">Active Members</h2>
              <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-muted">
                {members.filter((member) => member.role !== 'removed').length}
              </span>
            </div>

            <div className="space-y-3">
              {members
                .filter((member) => member.role !== 'removed')
                .map((member) => (
                  <div
                    key={member.id}
                    className="rounded-xl border border-muted bg-surface-muted p-4"
                  >
                    {editingMemberId === member.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold text-muted">Name</label>
                          <input
                            autoFocus
                            value={editMemberName}
                            onChange={(event) => setEditMemberName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                if (editMemberName.trim() && !isUpdatingMember) {
                                  void saveEditedMember(member.id);
                                }
                              }
                              if (event.key === 'Escape') {
                                event.preventDefault();
                                setEditingMemberId(null);
                                setEditMemberName('');
                              }
                            }}
                            className="mv-settings-control w-full"
                          />
                        </div>

                        <div className="flex justify-end gap-2 border-t border-muted pt-3">
                          <button
                            type="button"
                            onClick={() => setEditingMemberId(null)}
                            className="mv-settings-secondary"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isUpdatingMember || !editMemberName.trim()}
                            onClick={() => saveEditedMember(member.id)}
                            className="mv-settings-primary"
                          >
                            {isUpdatingMember ? 'Saving...' : 'Save Member'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-main">{member.name}</span>
                          {member.role === 'owner' && (
                            <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                              Primary
                            </span>
                          )}
                        </div>

                        {isOwner && member.role !== 'owner' && (
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => beginEditMember(member)}
                              className="h-9 rounded-xl border border-muted bg-surface px-3 text-xs font-semibold text-main transition hover:bg-surface-muted"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Remove ${member.name} from future household selections? Historical records will be kept.`
                                  )
                                ) {
                                  onRemoveMember(member.id);
                                }
                              }}
                              className="h-9 rounded-xl border border-danger bg-danger-soft px-3 text-xs font-semibold text-danger transition hover:opacity-80"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {members.some((member) => member.role === 'removed') && (
            <div className="mv-settings-panel">
              <h3 className="text-xs font-bold text-muted mb-3">Removed from future selections</h3>
              <div className="space-y-2">
                {members
                  .filter((member) => member.role === 'removed')
                  .map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-muted bg-surface-muted px-3 py-2.5"
                    >
                      <span className="text-xs font-medium text-muted">{member.name}</span>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setMemberMessage(null);
                              await onCreateMember({ name: member.name });
                              setMemberMessage(`${member.name} restored to household selections.`);
                            } catch (err: any) {
                              setMemberMessage(err.message || 'Failed to restore household member.');
                            }
                          }}
                          className="h-8 rounded-lg border border-muted bg-surface px-3 text-[11px] font-semibold text-main transition hover:bg-surface-muted"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="mv-settings-panel max-w-4xl">
          <h2 className="text-sm font-bold text-main mb-4">
            Audit Trail ({auditLogs.length} Events)
          </h2>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="mv-settings-log-row"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-bold text-main">
                      {log.action}
                    </span>
                    <span className="text-subtle ml-2">
                      by {log.actorEmail}
                    </span>
                    <p className="text-muted mt-1 leading-relaxed">
                      {log.summary}
                    </p>
                  </div>
                  <span className="text-[10px] text-subtle whitespace-nowrap">
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
        <div className="mv-settings-stack max-w-3xl">
          {showDevelopmentTools && (
            <div className="mv-settings-panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-main">
                  Diagnostics
                </h2>
              </div>
              <button
                onClick={onOpenAcceptanceTests}
                className="mv-settings-primary inline-flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                Run Diagnostics
              </button>
            </div>
          )}

          {/* Backup & Export */}
          <div className="mv-settings-panel space-y-3">
            <div>
              <h2 className="text-sm font-bold text-main">
                Backup
              </h2>
            </div>
            <button
              onClick={onDownloadBackup}
              className="mv-settings-secondary inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download Backup
            </button>
          </div>

          {/* Restore */}
          {isOwner && (
            <>
              <div className="mv-settings-panel space-y-3">
              <div>
                <h2 className="text-sm font-bold text-main">
                  Restore
                </h2>
              </div>

              {restoreError && (
                <div className="p-3 bg-danger-soft border border-danger rounded-xl text-danger text-xs">
                  {restoreError}
                </div>
              )}
              {restoreSuccess && (
                <div className="p-3 bg-success-soft border border-success rounded-xl text-success text-xs">
                  {restoreSuccess}
                </div>
              )}

              <form onSubmit={handleRestoreSubmit} className="mv-settings-restore-stack">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="mv-settings-file w-full"
                />
                <textarea
                  value={restoreJson}
                  onChange={(e) => setRestoreJson(e.target.value)}
                  placeholder="Paste backup JSON"
                  rows={4}
                  className="mv-settings-textarea w-full font-mono"
                />
                <button
                  type="submit"
                  disabled={!restoreJson.trim() || isRestoring}
                  className="mv-settings-primary"
                >
                  {isRestoring ? 'Restoring...' : 'Restore'}
                </button>
              </form>
            </div>

            {/* Clean Production Reset */}
            <div className="mv-settings-panel space-y-3">
              <div>
                <h2 className="text-sm font-bold text-main">
                  Reset Data
                </h2>
              </div>

              {resetMessage && (
                <div className="p-3 bg-surface-muted rounded-xl text-xs text-main">
                  {resetMessage}
                </div>
              )}

              {!showResetConfirm ? (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="mv-settings-danger"
                >
                  Reset Data
                </button>
              ) : (
                <div className="p-4 rounded-xl border border-danger bg-danger-soft space-y-3">
                  <p className="text-xs font-semibold text-danger">
                    This deletes all financial data. Export a backup first if needed.
                  </p>
                  <div className="mv-hscroll items-center">
                    <button
                      onClick={handleResetExecute}
                      disabled={isResetting}
                      className="mv-settings-danger is-confirm"
                    >
                      {isResetting ? 'Resetting...' : 'Delete All Data'}
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="mv-settings-secondary"
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
                <div className="mv-settings-panel space-y-3">
                <div>
                <h2 className="text-sm font-bold text-main">
                Sample Data
                </h2>
                </div>
                
                {sampleMessage && (
                <div className="p-3 bg-surface-muted rounded-xl text-xs text-main">
                {sampleMessage}
                </div>
                )}
                
                <button
                onClick={handleLoadSampleExecute}
                disabled={isLoadingSample}
                className="mv-settings-secondary"
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
