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
  reconcileAccount,
  deleteAccount,
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal,
  createPlannedPayment,
  updatePlannedPayment,
  deletePlannedPayment,
  createPlannedIncome,
  updatePlannedIncome,
  deletePlannedIncome,
  markIncomeReceived,
  bulkTogglePlannedPayments,
  executeTransferPlanTransfer,
  executeTransferPlanAllocations,
  undoTransferPlanFunding,
  createHouseholdMember,
  updateHouseholdMember,
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
  PlannedIncome,
  UserRole,
  NavTab,
  Payer,
  UserPreferences,
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
import { IncomeView } from './components/IncomeView';
import { SettingsView } from './components/SettingsView';
import { BudgetView } from './components/BudgetView';
import { AuditLogView } from './components/AuditLogView';
import { BackupRestoreModal } from './components/BackupRestoreModal';
import { AcceptanceTestsModal } from './components/AcceptanceTestsModal';
import { ConflictResolutionModal } from './components/ConflictResolutionModal';
import { Loader2, AlertCircle } from 'lucide-react';
import { applyThemePreferences, readStoredUserPreferences } from './themeEngine';

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
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(readStoredUserPreferences);

  // Build a complete month list instead of limiting the picker to months that already contain data.
  // Always include the current calendar year and next year, plus any years already present in household data.
  const availableMonths = useMemo(() => {
    const years = new Set<number>();
    const now = new Date();
    const currentYear = now.getFullYear();

    years.add(currentYear);
    years.add(currentYear + 1);

    const selectedYear = Number.parseInt(selectedMonth.slice(0, 4), 10);
    if (Number.isFinite(selectedYear)) {
      years.add(selectedYear);
    }

    if (household) {
      household.transactions.forEach((tx) => {
        if (tx.date && tx.date.length >= 7) {
          const year = Number.parseInt(tx.date.slice(0, 4), 10);
          if (Number.isFinite(year)) years.add(year);
        }
      });

      (household.plannedPayments || []).forEach((p) => {
        if (p.month && p.month.length >= 7) {
          const year = Number.parseInt(p.month.slice(0, 4), 10);
          if (Number.isFinite(year)) years.add(year);
        }
      });
    }

    return Array.from(years)
      .sort((a, b) => a - b)
      .flatMap((year) =>
        Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`)
      );
  }, [household, selectedMonth]);

  // Token-based theme engine: base mode and accent are independent.
  useEffect(() => {
    applyThemePreferences(userPreferences);
  }, [userPreferences]);

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

  const handleReconcileAccount = async (
    id: string,
    reconciledBalancePence: number,
    reconciliationDate: string
  ) => {
    if (!household) return;
    try {
      await reconcileAccount(
        id,
        reconciledBalancePence,
        reconciliationDate,
        household.version
      );
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to reconcile account');
      }
      throw err;
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

  // Delete Savings Goal
  const handleDeleteSavingsGoal = async (id: string) => {
    if (!household) return;
    try {
      await deleteSavingsGoal(id, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to delete savings goal');
        throw err;
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
    status?: 'paid' | 'unpaid';
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

  const handleExecuteTransferAllocations = async (payload: {
    destinationAccountId: string;
    expectedTotalPence: number;
    allocations: Array<{
      sourceAccountId: string;
      amountPence: number;
    }>;
    description: string;
    date: string;
  }) => {
    if (!household) return;
    try {
      setIsSubmitting(true);
      await executeTransferPlanAllocations({
        ...payload,
        expectedVersion: household.version,
      });
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to execute Transfer Plan allocations');
      }
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndoTransferPlanFunding = async (destinationAccountId: string) => {
    if (!household) return;
    try {
      setIsSubmitting(true);
      await undoTransferPlanFunding(destinationAccountId, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to undo Transfer Plan funding');
      }
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Planned Income / Wages Handlers
  const handleCreatePlannedIncome = async (data: Partial<PlannedIncome>) => {
    if (!household) return;
    try {
      setIsSubmitting(true);
      await createPlannedIncome(data, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to create income');
      }
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePlannedIncome = async (id: string, data: Partial<PlannedIncome>) => {
    if (!household) return;
    try {
      setIsSubmitting(true);
      await updatePlannedIncome(id, data, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to update income');
      }
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlannedIncome = async (id: string) => {
    if (!household) return;
    try {
      await deletePlannedIncome(id, household.version);
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to delete income');
      }
      throw err;
    }
  };

  const handleMarkIncomeReceived = async (
    id: string,
    payload: { actualAmountPence?: number; actualDate?: string; accountId?: string }
  ) => {
    if (!household) return;
    try {
      setIsSubmitting(true);
      await markIncomeReceived(id, { ...payload, expectedVersion: household.version });
      await loadData();
    } catch (err: any) {
      if (err.status === 409) {
        setConflictServerVersion(err.serverVersion || household.version + 1);
      } else {
        setError(err.message || 'Failed to record received income');
      }
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  // Member Management Handlers
  const handleCreateHouseholdMember = async (data: {
    name: string;
    email?: string;
    role?: 'editor' | 'view_only' | 'pending';
  }) => {
    try {
      if (!household) return;
      await createHouseholdMember(data, household.version);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to add household member');
      throw err;
    }
  };

  const handleUpdateHouseholdMember = async (
    memberId: string,
    data: { name?: string; email?: string }
  ) => {
    try {
      if (!household) return;
      await updateHouseholdMember(memberId, data, household.version);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update household member');
      throw err;
    }
  };

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

  const pendingMembersCount = household
    ? household.members.filter((m) => m.role === 'pending').length
    : 0;

  return (
    <div className="min-h-screen bg-app text-main flex flex-col font-sans transition-colors">
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
      <main className="flex-1 min-w-0 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-20 sm:pb-8">
        {/* Error notification banner if any */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-danger-soft border border-danger text-danger text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-danger shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-xs font-semibold underline transition-opacity hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !household && (
          <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
            <Loader2 className="text-accent w-8 h-8 animate-spin" />
            <span className="text-muted text-xs font-medium">
              Loading...
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
                transactions={household.transactions}
                members={household.members}
                userRole={session.role}
                currentVersion={household.version}
                selectedMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
                onOpenMonthImport={() => setShowMonthImportModal(true)}
                onCreatePlannedPayment={handleCreatePlannedPayment}
                onUpdatePlannedPayment={handleUpdatePlannedPayment}
                onDeletePlannedPayment={handleDeletePlannedPayment}
                onBulkTogglePlannedPayments={handleBulkTogglePlannedPayments}
                onExecuteTransfer={handleExecuteTransferAllocations}
                onUndoFunding={handleUndoTransferPlanFunding}
              />
            )}

            {(activeTab === 'activity' || (activeTab as any) === 'transactions') && (
              <TransactionList
                transactions={household.transactions}
                accounts={household.accounts}
                categories={household.categories}
                members={household.members}
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
                members={household.members}
                userRole={session.role}
                onCreateAccount={handleCreateAccount}
                onUpdateAccount={handleUpdateAccount}
                onReconcileAccount={handleReconcileAccount}
                onDeleteAccount={handleDeleteAccount}
                onCreateSavingsGoal={handleCreateSavingsGoal}
                onUpdateSavingsGoal={handleUpdateSavingsGoal}
                onDeleteSavingsGoal={handleDeleteSavingsGoal}
              />
            )}

            {activeTab === 'income' && (
              <IncomeView
                incomes={household.plannedIncomes || []}
                accounts={household.accounts}
                categories={household.categories}
                transactions={household.transactions}
                members={household.members}
                selectedMonth={selectedMonth}
                availableMonths={availableMonths}
                userRole={session.role}
                onSelectMonth={setSelectedMonth}
                onCreateIncome={handleCreatePlannedIncome}
                onUpdateIncome={handleUpdatePlannedIncome}
                onDeleteIncome={handleDeletePlannedIncome}
                onMarkIncomeReceived={handleMarkIncomeReceived}
              />
            )}

            {activeTab === 'savings' && (
              <SavingsView
                savingsGoals={household.savingsGoals}
                accounts={household.accounts}
                transactions={household.transactions}
                plannedPayments={household.plannedPayments || []}
                plannedIncomes={household.plannedIncomes || []}
                members={household.members}
                selectedMonth={selectedMonth}
                userRole={session.role}
                onCreateSavingsGoal={handleCreateSavingsGoal}
                onUpdateSavingsGoal={handleUpdateSavingsGoal}
                onDeleteSavingsGoal={handleDeleteSavingsGoal}
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
                  setUserPreferences((prev) => ({ ...prev, ...prefs }));
                }}
                onSaveAppearance={async () => {
                  const saved = await saveUserPreferences(userPreferences);
                  setUserPreferences(saved);
                  localStorage.setItem('mv-theme-mode', saved.theme);
                }}
                onCreateMember={handleCreateHouseholdMember}
                onUpdateMember={handleUpdateHouseholdMember}
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
          members={household.members}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Planned Bill / Payment Modal */}
      {household && showPlannedPaymentModal && (
        <PlannedPaymentModal
          payment={editingPlannedPayment}
          accounts={household.accounts}
          categories={household.categories}
          members={household.members}
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
