import React, { useState, useMemo } from 'react';
import { PiggyBank, Plus, ArrowUpRight, Calendar, X, Trash2 } from 'lucide-react';
import {
  SavingsGoal,
  Account,
  Transaction,
  UserRole,
  Payer,
  PlannedPayment,
  PlannedIncome,
} from '../types';
import {
  calculateSavingsPosition,
  formatPence,
  parseToPence,
} from '../utils/currency';

interface SavingsViewProps {
  savingsGoals: SavingsGoal[];
  accounts: Account[];
  transactions: Transaction[];
  plannedPayments: PlannedPayment[];
  plannedIncomes: PlannedIncome[];
  selectedMonth: string;
  userRole: UserRole;
  onCreateSavingsGoal: (data: Partial<SavingsGoal>) => Promise<void>;
  onUpdateSavingsGoal: (id: string, data: Partial<SavingsGoal>) => Promise<void>;
  onDeleteSavingsGoal: (id: string) => Promise<void>;
  onExecuteTransfer: (payload: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountPence: number;
    description?: string;
    payer?: Payer;
    isSavings?: boolean;
  }) => Promise<void>;
}

export const SavingsView: React.FC<SavingsViewProps> = ({
  savingsGoals,
  accounts,
  transactions,
  plannedPayments,
  plannedIncomes,
  selectedMonth,
  userRole,
  onCreateSavingsGoal,
  onUpdateSavingsGoal,
  onDeleteSavingsGoal,
  onExecuteTransfer,
}) => {
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditGoalModal, setShowEditGoalModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);

  // New Goal form state
  const [goalName, setGoalName] = useState('');
  const [goalTargetStr, setGoalTargetStr] = useState('');
  const [goalCurrentStr, setGoalCurrentStr] = useState('');
  const [goalAccountId, setGoalAccountId] = useState(
    accounts.find((a) => a.isActive !== false && (a.type === 'savings' || a.type === 'cash'))?.id || ''
  );
  const [goalDate, setGoalDate] = useState('');

  // Quick savings transfer state
  const [sourceAccountId, setSourceAccountId] = useState(accounts.find((a) => a.type === 'current')?.id || accounts[0]?.id || '');
  const [transferAmountStr, setTransferAmountStr] = useState('');
  const [transferPayer, setTransferPayer] = useState<Payer>('Joint');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = userRole === 'owner' || userRole === 'editor';

  const savingsAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.isActive !== false &&
          (account.type === 'savings' || account.type === 'cash')
      ),
    [accounts]
  );

  // Authoritative savings position. Goals are allocations only; they do not define total savings.
  const savingsPosition = useMemo(
    () =>
      calculateSavingsPosition(
        accounts,
        transactions,
        plannedPayments,
        selectedMonth,
        plannedIncomes
      ),
    [accounts, transactions, plannedPayments, plannedIncomes, selectedMonth]
  );

  const monthSavingsTxs = useMemo(() => {
    return transactions.filter((tx) => tx.isSavings && tx.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const goalAllocatedPence = useMemo(() => {
    return savingsGoals.reduce((sum, goal) => sum + goal.currentPence, 0);
  }, [savingsGoals]);

  const totalTargetPence = useMemo(() => {
    return savingsGoals.reduce((sum, goal) => sum + goal.targetPence, 0);
  }, [savingsGoals]);

  const overallPercent =
    totalTargetPence > 0
      ? Math.min(100, Math.round((goalAllocatedPence / totalTargetPence) * 100))
      : 0;

  // Handle Create Goal
  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim() || !goalAccountId) return;
    try {
      setIsSubmitting(true);
      setError(null);
      const targetPence = parseToPence(goalTargetStr);
      const currentPence = parseToPence(goalCurrentStr);
      await onCreateSavingsGoal({
        name: goalName.trim(),
        targetPence,
        currentPence,
        accountId: goalAccountId,
        targetDate: goalDate || undefined,
      });
      setGoalName('');
      setGoalTargetStr('');
      setGoalCurrentStr('');
      setShowGoalModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create savings goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Goal
  const openEditGoal = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    setGoalName(goal.name);
    setGoalTargetStr((goal.targetPence / 100).toFixed(2));
    setGoalCurrentStr((goal.currentPence / 100).toFixed(2));
    setGoalAccountId(goal.accountId);
    setGoalDate(goal.targetDate || '');
    setError(null);
    setShowEditGoalModal(true);
  };

  // Handle Edit Goal
  const handleEditGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !goalName.trim()) return;
    try {
      setIsSubmitting(true);
      setError(null);
      const targetPence = parseToPence(goalTargetStr);
      const currentPence = parseToPence(goalCurrentStr);
      await onUpdateSavingsGoal(selectedGoal.id, {
        name: goalName.trim(),
        targetPence,
        currentPence,
        accountId: goalAccountId,
        targetDate: goalDate || undefined,
      });
      setShowEditGoalModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update savings goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGoal = async (goal: SavingsGoal) => {
    if (!confirm(`Delete savings pot "${goal.name}"? This removes the goal only and does not delete any account transactions.`)) {
      return;
    }

    try {
      setError(null);
      await onDeleteSavingsGoal(goal.id);
      if (selectedGoal?.id === goal.id) {
        setSelectedGoal(null);
        setShowEditGoalModal(false);
        setShowTransferModal(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete savings pot');
    }
  };

  // Open Transfer Modal for specific goal
  const openTransferModal = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    setTransferAmountStr('');
    setError(null);
    setShowTransferModal(true);
  };

  // Handle Transfer into Savings
  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    const pence = parseToPence(transferAmountStr);
    if (pence <= 0) {
      setError('Please enter a valid transfer amount greater than £0.00');
      return;
    }
    if (sourceAccountId === selectedGoal.accountId) {
      setError('Source account must be distinct from destination savings account.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      // Execute transfer with isSavings flag (non-spending)
      await onExecuteTransfer({
        sourceAccountId,
        destinationAccountId: selectedGoal.accountId,
        amountPence: pence,
        description: `Savings Contribution: ${selectedGoal.name}`,
        payer: transferPayer,
        isSavings: true,
      });

      // Update the goal's currentPence
      await onUpdateSavingsGoal(selectedGoal.id, {
        currentPence: selectedGoal.currentPence + pence,
      });

      setShowTransferModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to execute savings contribution');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="w-full whitespace-nowrap text-xl font-bold text-main">
          Savings
        </h1>

        {canEdit && (
          <div className="mt-3">
            <button
              disabled={savingsAccounts.length === 0}
              onClick={() => {
                setError(null);
                setGoalName('');
                setGoalTargetStr('');
                setGoalCurrentStr('');
                setGoalDate('');
                setGoalAccountId(savingsAccounts[0]?.id || '');
                setShowGoalModal(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-on-accent shadow-sm transition-all hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Pot
            </button>
          </div>
        )}
      </div>

      {/* Savings Summary, Goals & Movements */}
      <section className="mv-edge-safe rounded-2xl border border-muted bg-surface p-3 sm:p-4 space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="min-w-0 rounded-[14px] border border-muted bg-surface p-4 shadow-sm">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted">
              Current Savings
            </h2>
            <div className="mt-2 font-mono text-xl sm:text-2xl font-semibold tracking-tight tabular-nums text-main whitespace-nowrap">
              {formatPence(savingsPosition.currentSavingsPence)}
            </div>
            <span className="mt-1 block text-[11px] leading-4 text-subtle">
              confirmed savings / liquid balances
            </span>
          </article>

          <article className="min-w-0 rounded-[14px] border border-muted bg-surface p-4 shadow-sm">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted">
              Saved This Month
            </h2>
            <div
              className={`mt-2 font-mono text-xl sm:text-2xl font-semibold tracking-tight tabular-nums whitespace-nowrap ${
                savingsPosition.savedThisMonthPence >= 0 ? 'text-success' : 'text-danger'
              }`}
            >
              {formatPence(savingsPosition.savedThisMonthPence)}
            </div>
            <span className="mt-1 block text-[11px] leading-4 text-subtle">
              income + refunds − bills − spending
            </span>
          </article>

          <article className="min-w-0 rounded-[14px] border border-muted bg-accent-soft p-4 shadow-sm">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted">
              Projected End Savings
            </h2>
            <div className="mt-2 font-mono text-xl sm:text-2xl font-semibold tracking-tight tabular-nums text-main whitespace-nowrap">
              {formatPence(savingsPosition.projectedEndSavingsPence)}
            </div>
            <span className="mt-1 block text-[11px] leading-4 text-subtle">
              current savings + monthly saved
            </span>
          </article>

          <article className="min-w-0 rounded-[14px] border border-muted bg-surface p-4 shadow-sm">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted">
              Moved To Savings
            </h2>
            <div className="mt-2 font-mono text-xl sm:text-2xl font-semibold tracking-tight tabular-nums text-main whitespace-nowrap">
              {formatPence(savingsPosition.savingsTransfersPence)}
            </div>
            <span className="mt-1 block text-[11px] leading-4 text-subtle">
              actual savings transfer movements
            </span>
          </article>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold leading-5 text-main">
              Savings Balance Breakdown
            </h2>
            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-muted">
              {savingsPosition.savingsAccounts.length} account{savingsPosition.savingsAccounts.length === 1 ? '' : 's'}
            </span>
          </div>

          {savingsPosition.savingsAccounts.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-muted bg-surface-muted px-4 py-6 text-left">
              <p className="text-[13px] font-medium leading-5 text-subtle">
                No savings or liquid-balance accounts are configured.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-[14px] border border-muted bg-table">
              <div className="divide-y divide-muted">
                {savingsPosition.savingsAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-main">
                        {account.name}
                      </span>
                      <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-subtle">
                        {account.type === 'cash' ? 'Cash' : 'Savings account'}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold tracking-tight tabular-nums text-main">
                      {formatPence(account.currentBalancePence)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[15px] font-semibold leading-5 text-main">
              Active Savings Goals
            </h2>
            <p className="text-[11px] text-subtle">
              Allocated to goals {formatPence(goalAllocatedPence)} of {formatPence(totalTargetPence)}
              {totalTargetPence > 0 ? ` · ${overallPercent}%` : ''}
            </p>
          </div>

          {savingsGoals.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-muted bg-surface-muted px-4 py-6 text-left">
              <p className="text-[13px] font-medium leading-5 text-subtle">
                No active savings goals
              </p>
            </div>
          ) : (
            <div className="mv-fluid-card-grid">
              {savingsGoals.map((goal) => {
                const percent =
                  goal.targetPence > 0
                    ? Math.min(100, Math.round((goal.currentPence / goal.targetPence) * 100))
                    : 100;
                const linkedAccount = accounts.find((a) => a.id === goal.accountId);

                return (
                  <article
                    key={goal.id}
                    className="min-w-0 rounded-[14px] border border-muted bg-surface p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)] flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="w-9 h-9 shrink-0 rounded-xl bg-success-soft text-success flex items-center justify-center">
                            <PiggyBank className="w-4.5 h-4.5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-[15px] font-semibold leading-5 text-main break-words">
                              {goal.name}
                            </h3>
                            <span className="mt-0.5 block text-[12px] font-normal leading-4 text-muted break-words">
                              {linkedAccount?.name || 'Account'}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 text-[13px] font-semibold text-muted">
                          {percent}%
                        </span>
                      </div>

                      <div className="w-full bg-surface-muted rounded-full h-2 mt-4 overflow-hidden">
                        <div
                          className="bg-accent h-2 rounded-full transition-all"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3 mt-3 text-[12px]">
                        <div className="min-w-0">
                          <span className="block text-muted">saved</span>
                          <span className="block mt-0.5 font-semibold text-main whitespace-nowrap">
                            {formatPence(goal.currentPence)}
                          </span>
                        </div>
                        <div className="min-w-0 text-right">
                          <span className="block text-muted">target</span>
                          <span className="block mt-0.5 font-semibold text-main whitespace-nowrap">
                            {formatPence(goal.targetPence)}
                          </span>
                        </div>
                      </div>

                      {goal.targetDate && (
                        <div className="flex items-center gap-1.5 text-[11px] text-muted mt-2">
                          <Calendar className="w-3.5 h-3.5 shrink-0" />
                          <span className="break-words">{goal.targetDate}</span>
                        </div>
                      )}
                    </div>

                    <div className="mv-hscroll mt-4 pt-3 border-t border-muted">
                      <button
                        onClick={() => openTransferModal(goal)}
                        className="shrink-0 whitespace-nowrap inline-flex items-center gap-1 rounded-full bg-success-soft px-3 py-1.5 text-[13px] font-semibold text-success"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        Transfer
                      </button>

                      {canEdit && (
                        <>
                          <button
                            onClick={() => openEditGoal(goal)}
                            className="shrink-0 whitespace-nowrap rounded-full bg-surface-muted px-3 py-1.5 text-[13px] font-medium text-muted transition-all hover:bg-surface active:scale-[0.98]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteGoal(goal)}
                            className="shrink-0 whitespace-nowrap inline-flex items-center gap-1 rounded-full bg-danger-soft px-3 py-1.5 text-[13px] font-medium text-danger transition-all hover:opacity-80 active:scale-[0.98]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <h2 className="text-[15px] font-semibold leading-5 text-main">
              Savings Movements
            </h2>
            <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-medium text-muted">
              {selectedMonth}
            </span>
          </div>

          {monthSavingsTxs.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-muted bg-surface-muted px-4 py-6 text-left">
              <p className="text-[13px] font-medium leading-5 text-subtle">
                No savings movements for {selectedMonth}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {monthSavingsTxs.map((tx) => (
                <div
                  key={tx.id}
                  className="min-w-0 rounded-[14px] border border-muted bg-surface px-4 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <span className="block text-[13px] font-semibold text-main break-words">
                      {tx.description}
                    </span>
                    <div className="text-[11px] text-muted mt-0.5">
                      {tx.date} · {tx.payer}
                    </div>
                  </div>
                  <div className="shrink-0 font-semibold text-success whitespace-nowrap">
                    +{formatPence(tx.amountPence)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* MODAL: Add Savings Pot */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-muted bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-muted pb-3">
              <div>
                <h3 className="text-base font-bold text-main">Add Savings Pot</h3>
                <p className="mt-0.5 text-xs text-muted">
                  Link goals only to a Savings or Cash account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowGoalModal(false)}
                className="rounded-lg p-1.5 text-muted transition hover:bg-surface-muted hover:text-main"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGoalSubmit} className="mt-4 space-y-4">
              {error && (
                <div className="rounded-xl border border-danger bg-danger-soft p-3 text-xs text-danger">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Pot Name</label>
                <input
                  type="text"
                  value={goalName}
                  onChange={(event) => setGoalName(event.target.value)}
                  className="h-11 w-full rounded-xl border border-muted bg-surface-muted px-3.5 text-sm text-main focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
                  placeholder="e.g. Emergency Fund"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Savings Account</label>
                <select
                  value={goalAccountId}
                  onChange={(event) => setGoalAccountId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-muted bg-surface-muted px-3.5 text-sm text-main focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
                  required
                >
                  {savingsAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({formatPence(account.currentBalancePence)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">Current (£)</label>
                  <input
                    value={goalCurrentStr}
                    onChange={(event) => setGoalCurrentStr(event.target.value)}
                    className="h-11 w-full rounded-xl border border-muted bg-surface-muted px-3.5 text-sm text-main focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">Target (£)</label>
                  <input
                    value={goalTargetStr}
                    onChange={(event) => setGoalTargetStr(event.target.value)}
                    className="h-11 w-full rounded-xl border border-muted bg-surface-muted px-3.5 text-sm text-main focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Target Date</label>
                <input
                  type="date"
                  value={goalDate}
                  onChange={(event) => setGoalDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-muted bg-surface-muted px-3.5 text-sm text-main focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-muted pt-4">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="h-10 rounded-xl px-4 text-xs font-semibold text-muted transition hover:bg-surface-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || savingsAccounts.length === 0}
                  className="h-10 rounded-xl bg-accent px-4 text-xs font-semibold text-on-accent transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Pot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Transfer into Savings */}
      {showTransferModal && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-xs">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-muted p-6">
            <div className="flex items-center justify-between pb-3 border-b border-muted">
              <h3 className="text-base font-bold text-main">
                Transfer to {selectedGoal.name}
              </h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-1 rounded-lg text-muted text-subtle hover:text-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="mt-4 space-y-4">
              {error && (
                <div className="p-3 bg-danger-soft border border-danger rounded-xl text-danger text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  From Account
                </label>
                <select
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                >
                  {accounts
                    .filter((a) => a.isActive !== false && a.id !== selectedGoal.accountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatPence(acc.currentBalancePence)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Amount (£)
                  </label>
                  <input
                    type="text"
                    value={transferAmountStr}
                    onChange={(e) => setTransferAmountStr(e.target.value)}
                    placeholder="e.g. 250.00"
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main font-bold focus:ring-2 focus:ring-accent focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    By
                  </label>
                  <select
                    value={transferPayer}
                    onChange={(e) => setTransferPayer(e.target.value as Payer)}
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  >
                    <option value="Joint">Joint</option>
                    <option value="Marius">Marius</option>
                    <option value="Vesta">Vesta</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-muted flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-accent hover:bg-success-soft text-on-accent rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Transferring...' : 'Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Goal */}
      {showEditGoalModal && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-xs">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-muted p-6">
            <div className="flex items-center justify-between pb-3 border-b border-muted">
              <h3 className="text-base font-bold text-main">
                Edit {selectedGoal.name}
              </h3>
              <button
                onClick={() => setShowEditGoalModal(false)}
                className="p-1 rounded-lg text-muted text-subtle hover:text-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditGoalSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Pot Name
                </label>
                <input
                  type="text"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Current (£)
                  </label>
                  <input
                    type="text"
                    value={goalCurrentStr}
                    onChange={(e) => setGoalCurrentStr(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Target (£)
                  </label>
                  <input
                    type="text"
                    value={goalTargetStr}
                    onChange={(e) => setGoalTargetStr(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Savings Account
                </label>
                <select
                  value={goalAccountId}
                  onChange={(e) => setGoalAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-muted border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent-soft focus:border-accent focus:outline-none"
                  required
                >
                  {savingsAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({formatPence(account.currentBalancePence)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Target Date
                </label>
                <input
                  type="date"
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-muted flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleDeleteGoal(selectedGoal)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-danger bg-danger-soft px-4 py-2 text-xs font-semibold text-danger transition-all hover:opacity-80 active:scale-[0.98]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Pot
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditGoalModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-accent text-on-accent rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {isSubmitting ? 'Saving...' : 'Update Pot'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
