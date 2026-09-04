import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchSession,
  switchSession,
  fetchHousehold,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createAccount,
  updateAccount,
  deleteAccount,
  createSavingsGoal,
  updateSavingsGoal,
  createPlannedPayment,
  updatePlannedPayment,
  deletePlannedPayment,
  bulkTogglePlannedPayments,
  executeTransferPlanTransfer,
  approveMember,
  changeMemberRole,
  removeMember,
  importMonth,
  fetchBackup,
  restoreBackup,
  resetHouseholdData,
  loadSampleHouseholdData,
  saveUserPreferences,
  subscribeToHouseholdEvents,
} from './utils/api';
import {
  HouseholdData,
  UserSession,
  Transaction,
  Account,
  SavingsGoal,
  PlannedPayment,
  UserRole,
  NavTab,
  Payer,
  UserPreferences,
  ThemePreference,
} from './types';
import { Header } from './components/Header';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { TransferPlanView } from './components/TransferPlanView';
import { TransactionList } from './components/TransactionList';
import { TransactionModal } from './components/TransactionModal';
import { PlannedPaymentModal } from './components/PlannedPaymentModal';
import { MonthImportModal } from './components/MonthImportModal';
import { AccountsView } from './components/AccountsView';
import { SavingsView } from './components/SavingsView';
import { SettingsView } from './components/SettingsView';
import { BudgetView } from './components/BudgetView';
import { AuditLogView } from './components/AuditLogView';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { AcceptanceTestsModal } from './components/AcceptanceTestsModal';
import { ConflictResolutionModal } from './components/ConflictResolutionModal';
import { Loader2, AlertCircle } from 'lucide-react';
import { MV_SINGLE_USER_MODE } from './accessPolicy';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);
  const [availableIdentities, setAvailableIdentities] = useState<
    { email: string; name: string; role: UserRole }[]
  >([]);
  const [household, setHousehold] = useState<HouseholdData | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [showTxModal, setShowTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [showPlannedPaymentModal, setShowPlannedPaymentModal] = useState(false);
  const [editingPlannedPayment, setEditingPlannedPayment] = useState<PlannedPayment | null>(null);
  const [showMonthImportModal, setShowMonthImportModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showTestsModal, setShowTestsModal] = useState(false);
  const [conflictServerVersion, setConflictServerVersion] = useState<number | null>(null);
  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    theme: (localStorage.getItem('mv-theme-mode') as ThemePreference) || 'system',
    accent: 'emerald',
  });

  // Compute available months across both transactions and planned payments
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add('2026-09');
    set.add('2026-10');
    if (household) {
      household.transactions.forEach((tx) => {
        if (tx.date && tx.date.length >= 7) {
          set.add(tx.date.substring(0, 7));
        }
      });
      (household.plannedPayments || []).forEach((p) => {
        if (p.month) set.add(p.month);
      });
    }
    return Array.from(set).sort();
  }, [household]);

  // Sync theme with document element based on user preferences
  const updateTheme = useCallback((theme?: 'system' | 'light' | 'dark') => {
    const pref = theme || localStorage.getItem('mv-theme-mode') || 'system';
    const isDark =
      pref === 'dark' ||
      (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  useEffect(() => {
    updateTheme();
  }, [updateTheme]);

  // Load Session & Household Data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch Session
      const sessionData = await fetchSession();
      setSession(sessionData);
      setAvailableIdentities(sessionData.availableIdentities || []);

      // 2. If Pending or Removed, catch gracefully
      if (sessionData.role === 'pending' || sessionData.role === 'removed') {
        setHousehold(null);
        setIsLoading(false);
        return;
      }

      // 3. Fetch Authoritative Household Dataset
      const data = await fetchHousehold();
      setHousehold(data);
    } catch (err: any) {
      if (err.status === 403 && err.role === 'pending') {
        setHousehold(null);
      } else {
        setError(err.message || 'Error reading local MV data');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep multiple tabs on this device in sync through local browser events
  useEffect(() => {
    const unsubscribe = subscribeToHouseholdEvents(() => {
      loadData();
    });
    return unsubscribe;
  }, [loadData]);

  // Local-only compatibility hook; only Marius is available
  const handleSwitchUser = async (email: string) => {
    try {
      setIsLoading(true);
      await switchSession(email);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to switch user');
      setIsLoading(false);
    }
  };

  // Transaction Save (Create or Update)
  const handleSaveTransaction = async (txData: Partial<Transaction>) => {
    if (!household) return;
    setIsSubmitting(true);
    try {
      if (editingTx) {
        await updateTransaction(editingTx.id, txData, household.version);
      } else {
        await createTransaction(txData, household.version);
      }
      setShowTxModal(false);
      setEditingTx(null);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        throw err;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Transaction
  const handleDeleteTransaction = async (id: string) => {
    if (!household) return;
    try {
      await deleteTransaction(id, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to delete transaction');
      }
    }
  };

  // Create Account
  const handleCreateAccount = async (data: Partial<Account>) => {
    if (!household) return;
    try {
      await createAccount(data, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to create account');
      }
    }
  };

  // Update Account (including balance reconciliation and archiving)
  const handleUpdateAccount = async (id: string, data: Partial<Account>) => {
    if (!household) return;
    try {
      await updateAccount(id, data, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to update account');
      }
    }
  };

  // Delete / Archive Account
  const handleDeleteAccount = async (id: string) => {
    if (!household) return;
    try {
      await deleteAccount(id, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to delete account');
      }
    }
  };

  // Create Savings Goal
  const handleCreateSavingsGoal = async (data: Partial<SavingsGoal>) => {
    if (!household) return;
    try {
      await createSavingsGoal(data, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to create savings pot');
      }
    }
  };

  // Update Savings Goal
  const handleUpdateSavingsGoal = async (id: string, data: Partial<SavingsGoal>) => {
    if (!household) return;
    try {
      await updateSavingsGoal(id, data, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to update savings goal');
      }
    }
  };

  // Savings Transfer handler (moves money between accounts, e.g. liquid to savings pot or vice-versa)
  const handleSavingsTransfer = async (payload: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountPence: number;
    description?: string;
    payer?: Payer;
    isSavings?: boolean;
  }) => {
    if (!household) return;
    try {
      setIsSubmitting(true);
      const sourceAcc = household.accounts.find((a) => a.id === payload.sourceAccountId);
      const destAcc = household.accounts.find((a) => a.id === payload.destinationAccountId);
      if (!sourceAcc || !destAcc) throw new Error('Account not found');

      // Create a savings transfer transaction
      await createTransaction(
        {
          accountId: payload.sourceAccountId,
          targetAccountId: payload.destinationAccountId,
          amountPence: payload.amountPence,
          description: payload.description || `Transfer to ${destAcc.name}`,
          type: 'transfer',
          isTransfer: true,
          isSavings: payload.isSavings ?? (destAcc.type === 'savings' || sourceAcc.type === 'savings'),
          payer: payload.payer || (sourceAcc.ownerPerson as any) || 'Joint',
          date: new Date().toISOString().substring(0, 10),
          notes: 'Savings allocation',
        },
        household.version
      );

      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to process savings allocation');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Month Import / Cloning Handler
  const handleImportMonth = async (params: {
    sourceMonth: string;
    targetMonth: string;
    paymentIds: string[];
  }) => {
    if (!household) return;
    try {
      setIsSubmitting(true);
      await importMonth({ ...params, expectedVersion: household.version });
      setSelectedMonth(params.targetMonth);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        throw err;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Planned Payments Handlers
  const handleCreatePlannedPayment = async (data: Partial<PlannedPayment>) => {
    if (!household) return;
    try {
      setIsSubmitting(true);
      await createPlannedPayment(data, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to create planned bill');
      }
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePlannedPayment = async (id: string, data: Partial<PlannedPayment>) => {
    if (!household) return;
    try {
      await updatePlannedPayment(id, data, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to update planned bill');
      }
      throw err;
    }
  };

  const handleDeletePlannedPayment = async (id: string) => {
    if (!household) return;
    try {
      await deletePlannedPayment(id, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to delete planned bill');
      }
      throw err;
    }
  };

  const handleBulkTogglePlannedPayments = async (params: {
    month?: string;
    include: boolean;
    onlyUnpaid?: boolean;
    paymentIds?: string[];
  }) => {
    if (!household) return;
    try {
      await bulkTogglePlannedPayments(params, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to update planned bills');
      }
      throw err;
    }
  };

  const handleExecuteTransfer = async (payload: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountPence: number;
    description: string;
    date: string;
    payer: string;
  }) => {
    if (!household) return;
    try {
      setIsSubmitting(true);
      await executeTransferPlanTransfer({
        ...payload,
        expectedVersion: household.version,
      });
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to execute transfer');
      }
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Member Management Handlers
  const handleApproveMember = async (memberId: string, role: 'editor' | 'view_only') => {
    try {
      if (!household) return;
      await approveMember(memberId, role, household.version);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to approve member');
    }
  };

  const handleChangeRole = async (memberId: string, newRole: UserRole) => {
    try {
      if (!household) return;
      await changeMemberRole(memberId, newRole, household.version);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update member role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      if (!household) return;
      await removeMember(memberId, household.version);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to remove member');
    }
  };

  const pendingMembersCount = MV_SINGLE_USER_MODE
    ? 0
    : household
    ? household.members.filter((m) => m.role === 'pending').length
    : 0;

  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 flex flex-col font-sans text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Top Header */}
      <Header
        session={session}
        datasetVersion={household?.version || 1}
        onSwitchUser={handleSwitchUser}
        onRefresh={loadData}
        onOpenBackupModal={() => setShowBackupModal(true)}
        onOpenTestsModal={() => setShowTestsModal(true)}
        isLoading={isLoading}
        availableIdentities={availableIdentities}
      />

      {/* Navigation (Sticky Desktop bar + Mobile bottom dock) */}
      {session && session.role !== 'pending' && session.role !== 'removed' && (
        <Navigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          pendingMembersCount={pendingMembersCount}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-8">
        {/* Error notification banner if any */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-xs font-semibold underline hover:text-rose-950 dark:hover:text-rose-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !household && (
          <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-700 dark:text-emerald-400 animate-spin" />
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Loading MV data from this browser...
            </span>
          </div>
        )}

        {/* Authorized Active Household Views */}
        {!isLoading && household && session && session.role !== 'pending' && session.role !== 'removed' && (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard
                household={household}
                userRole={session.role}
                selectedMonth={selectedMonth}
                availableMonths={availableMonths}
                onSelectMonth={setSelectedMonth}
                onOpenMonthImport={() => setShowMonthImportModal(true)}
                onOpenAddTransaction={() => {
                  setEditingTx(null);
                  setShowTxModal(true);
                }}
                onOpenPlannedPaymentModal={() => {
                  setEditingPlannedPayment(null);
                  setShowPlannedPaymentModal(true);
                }}
                onNavigateToTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'transfer_plan' && (
              <TransferPlanView
                accounts={household.accounts}
                categories={household.categories}
                plannedPayments={household.plannedPayments || []}
                userRole={session.role}
                currentVersion={household.version}
                selectedMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
                onOpenMonthImport={() => setShowMonthImportModal(true)}
                onCreatePlannedPayment={handleCreatePlannedPayment}
                onUpdatePlannedPayment={handleUpdatePlannedPayment}
                onDeletePlannedPayment={handleDeletePlannedPayment}
                onBulkTogglePlannedPayments={handleBulkTogglePlannedPayments}
                onExecuteTransfer={handleExecuteTransfer}
              />
            )}

            {(activeTab === 'activity' || (activeTab as any) === 'transactions') && (
              <TransactionList
                transactions={household.transactions}
                accounts={household.accounts}
                categories={household.categories}
                userRole={session.role}
                selectedMonth={selectedMonth}
                onAddTransaction={() => {
                  setEditingTx(null);
                  setShowTxModal(true);
                }}
                onEditTransaction={(tx) => {
                  setEditingTx(tx);
                  setShowTxModal(true);
                }}
                onDeleteTransaction={handleDeleteTransaction}
              />
            )}

            {activeTab === 'accounts' && (
              <AccountsView
                accounts={household.accounts}
                savingsGoals={household.savingsGoals}
                transactions={household.transactions}
                userRole={session.role}
                onCreateAccount={handleCreateAccount}
                onUpdateAccount={handleUpdateAccount}
                onDeleteAccount={handleDeleteAccount}
                onCreateSavingsGoal={handleCreateSavingsGoal}
              />
            )}

            {activeTab === 'savings' && (
              <SavingsView
                savingsGoals={household.savingsGoals}
                accounts={household.accounts}
                transactions={household.transactions}
                selectedMonth={selectedMonth}
                userRole={session.role}
                onCreateSavingsGoal={handleCreateSavingsGoal}
                onUpdateSavingsGoal={handleUpdateSavingsGoal}
                onExecuteTransfer={handleSavingsTransfer}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                currentSession={session}
                members={household.members}
                auditLogs={household.auditLogs}
                userPreferences={userPreferences}
                onUpdatePreferences={(prefs) => {
                  setUserPreferences((prev) => {
                    const next = { ...prev, ...prefs };
                    if (prefs.theme) {
                      localStorage.setItem('mv-theme-mode', prefs.theme);
                      updateTheme(prefs.theme);
                    }
                    return next;
                  });
                }}
                onSaveAppearance={async () => {
                  await saveUserPreferences(userPreferences);
                }}
                onApproveMember={handleApproveMember}
                onChangeRole={handleChangeRole}
                onRemoveMember={handleRemoveMember}
                onDownloadBackup={async () => {
                  const data = await fetchBackup();
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `mv-household-backup-${new Date().toISOString().substring(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                onRestoreBackup={async (payload) => {
                  await restoreBackup(payload, household.version);
                  await loadData();
                }}
                onResetHousehold={async () => {
                  await resetHouseholdData(household.version);
                  await loadData();
                }}
                onLoadSampleData={async () => {
                  await loadSampleHouseholdData();
                  await loadData();
                }}
                onOpenAcceptanceTests={() => setShowTestsModal(true)}
              />
            )}

            {/* Backwards compatibility for direct sub-views */}
            {activeTab === 'budget' && (
              <BudgetView
                categories={household.categories}
                transactions={household.transactions}
                plannedIncomes={household.plannedIncomes || []}
                plannedPayments={household.plannedPayments || []}
                selectedMonth={selectedMonth}
                availableMonths={availableMonths}
                onSelectMonth={setSelectedMonth}
              />
            )}

            {activeTab === 'audit' && (
              <AuditLogView auditLogs={household.auditLogs} />
            )}
          </>
        )}
      </main>

      {/* Transaction Modal */}
      {household && (
        <TransactionModal
          isOpen={showTxModal}
          onClose={() => {
            setShowTxModal(false);
            setEditingTx(null);
          }}
          onSave={handleSaveTransaction}
          initialTransaction={editingTx}
          accounts={household.accounts}
          categories={household.categories}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Planned Bill / Payment Modal */}
      {household && showPlannedPaymentModal && (
        <PlannedPaymentModal
          payment={editingPlannedPayment}
          accounts={household.accounts}
          categories={household.categories}
          activeMonth={selectedMonth}
          onClose={() => {
            setShowPlannedPaymentModal(false);
            setEditingPlannedPayment(null);
          }}
          onSave={async (paymentData) => {
            if (editingPlannedPayment) {
              await handleUpdatePlannedPayment(editingPlannedPayment.id, paymentData);
            } else {
              await handleCreatePlannedPayment(paymentData);
            }
          }}
        />
      )}

      {/* Month Import / Cloning Modal */}
      {household && (
        <MonthImportModal
          isOpen={showMonthImportModal}
          onClose={() => setShowMonthImportModal(false)}
          activeMonth={selectedMonth}
          availableMonths={availableMonths}
          plannedPayments={household.plannedPayments || []}
          accounts={household.accounts}
          categories={household.categories}
          onImport={handleImportMonth}
        />
      )}

      {/* Backup and Restore Modal */}
      <BackupRestoreModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        isOwner={session?.role === 'owner'}
        expectedVersion={household?.version ?? 0}
        onSuccess={() => {
          loadData();
        }}
      />

      {/* Acceptance Tests Modal */}
      {!import.meta.env.PROD && (
        <AcceptanceTestsModal
          isOpen={showTestsModal}
          onClose={() => setShowTestsModal(false)}
        />
      )}

      {/* Optimistic Concurrency Conflict Modal */}
      <ConflictResolutionModal
        isOpen={conflictServerVersion !== null}
        serverVersion={conflictServerVersion || undefined}
        onClose={() => setConflictServerVersion(null)}
        onRefresh={() => {
          setConflictServerVersion(null);
          loadData();
        }}
      />
    </div>
  );
}
