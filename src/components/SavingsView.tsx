import React, { useEffect, useMemo, useState } from 'react';
import { PiggyBank, Plus, ArrowUpRight, Calendar, X, Trash2 } from 'lucide-react';
import {
  SavingsGoal,
  Account,
  Transaction,
  UserRole,
  Payer,
  PlannedPayment,
  PlannedIncome,
  HouseholdMember,
} from '../types';
import {
  calculateSavingsPosition,
  calculateSavingsGoalAllocationIntegrity,
  formatPence,
  parseToPence,
} from '../utils/currency';
import { householdPersonOptions } from '../utils/householdPeople';

interface SavingsViewProps {
  savingsGoals: SavingsGoal[];
  accounts: Account[];
  transactions: Transaction[];
  plannedPayments: PlannedPayment[];
  plannedIncomes: PlannedIncome[];
  members: HouseholdMember[];
  selectedMonth: string;
  userRole: UserRole;
  onCreateSavingsGoal: (data: Partial<SavingsGoal>) => Promise<void>;
  onUpdateSavingsGoal: (id: string, data: Partial<SavingsGoal>) => Promise<void>;
  onDeleteSavingsGoal: (id: string) => Promise<void>;
  onExecuteTransfer: (payload: {
    goalId: string;
    sourceAccountId: string;
    amountPence: number;
    payer?: Payer;
  }) => Promise<void>;
}

export const SavingsView: React.FC<SavingsViewProps> = ({
  savingsGoals,
  accounts,
  transactions,
  plannedPayments,
  plannedIncomes,
  members,
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
  const [sourceAccountId, setSourceAccountId] = useState(
    accounts.find((a) => a.isActive !== false && a.type === 'current')?.id ||
      accounts.find((a) => a.isActive !== false && a.type !== 'credit')?.id ||
      ''
  );
  const [transferAmountStr, setTransferAmountStr] = useState('');
  const [transferPayer, setTransferPayer] = useState<Payer>('Joint');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (showTransferModal) {
        setShowTransferModal(false);
      } else if (showEditGoalModal) {
        setShowEditGoalModal(false);
        setSelectedGoal(null);
      } else if (showGoalModal) {
        setShowGoalModal(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showEditGoalModal, showGoalModal, showTransferModal]);

  const canEdit = userRole === 'owner' || userRole === 'editor';
  const personOptions = useMemo(
    () => householdPersonOptions(members, [transferPayer]),
    [members, transferPayer]
  );

  const savingsAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.isActive !== false &&
          (account.type === 'savings' || account.type === 'cash')
      ),
    [accounts]
  );

  const savingsAccountIds = useMemo(
    () => new Set(savingsAccounts.map((account) => account.id)),
    [savingsAccounts]
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
    return transactions.filter((tx) => {
      if (
        !tx.date.startsWith(selectedMonth) ||
        tx.type !== 'transfer' ||
        !tx.isTransfer ||
        !tx.targetAccountId
      ) {
        return false;
      }

      const sourceIsSavings = savingsAccountIds.has(tx.accountId);
      const targetIsSavings = savingsAccountIds.has(tx.targetAccountId);
      return sourceIsSavings !== targetIsSavings;
    });
  }, [transactions, selectedMonth, savingsAccountIds]);

  const goalAllocatedPence = useMemo(() => {
    return savingsGoals.reduce((sum, goal) => sum + goal.currentPence, 0);
  }, [savingsGoals]);

  const totalTargetPence = useMemo(() => {
    return savingsGoals.reduce((sum, goal) => sum + goal.targetPence, 0);
  }, [savingsGoals]);

  const goalIntegrityById = useMemo(() => {
    const rows = calculateSavingsGoalAllocationIntegrity(accounts, savingsGoals);
    return new Map(rows.map((row) => [row.goalId, row]));
  }, [accounts, savingsGoals]);

  const totalOverallocatedPence = useMemo(
    () =>
      Array.from(goalIntegrityById.values()).reduce(
        (sum, row) => sum + row.overallocatedPence,
        0
      ),
    [goalIntegrityById]
  );

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
      await onExecuteTransfer({
        goalId: selectedGoal.id,
        sourceAccountId,
        amountPence: pence,
        payer: transferPayer,
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
      <section className="mv-card mv-edge-safe rounded-2xl border border-muted bg-surface p-3 sm:p-4 space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="min-w-0 rounded-[14px] border border-muted bg-surface p-4 shadow-sm">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted">
              Savings Account Balances
            </h2>
            <div className="mt-2 font-mono text-xl sm:text-2xl font-semibold tracking-tight tabular-nums text-main whitespace-nowrap">
              {formatPence(savingsPosition.currentSavingsPence)}
            </div>
            <span className="mt-1 block text-[11px] leading-4 text-subtle">
              Savings and Cash accounts only
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
              Net Savings Movement
            </h2>
            <div
              className={`mt-2 font-mono text-xl sm:text-2xl font-semibold tracking-tight tabular-nums whitespace-nowrap ${
                savingsPosition.savingsTransfersPence > 0
                  ? 'text-success'
                  : savingsPosition.savingsTransfersPence < 0
                  ? 'text-danger'
                  : 'text-main'
              }`}
            >
              {formatPence(savingsPosition.savingsTransfersPence)}
            </div>
            <span className="mt-1 block text-[11px] leading-4 text-subtle">
              net movement into Savings/Cash
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
                No active Savings or Cash accounts are configured.
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
              Recorded allocations {formatPence(goalAllocatedPence)} of {formatPence(totalTargetPence)}
              {totalTargetPence > 0 ? ` · ${overallPercent}%` : ''}
            </p>
            {totalOverallocatedPence > 0 && (
              <p className="mt-1 text-[11px] font-semibold text-danger">
                Allocation integrity warning: {formatPence(totalOverallocatedPence)} exceeds linked account funds.
              </p>
            )}
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
                const integrity = goalIntegrityById.get(goal.id);

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
                          <span className="block text-muted">recorded allocation</span>
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
                      {integrity?.isOverallocated && (
                        <div className="mt-2 rounded-lg border border-danger bg-danger-soft px-2.5 py-2 text-[11px] leading-4 text-danger">
                          Linked account holds {formatPence(integrity.accountBalancePence)}; recorded allocations exceed it by {formatPence(integrity.overallocatedPence)}.
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
                  {(() => {
                    const sourceIsSavings = savingsAccountIds.has(tx.accountId);
                    const targetIsSavings = tx.targetAccountId
                      ? savingsAccountIds.has(tx.targetAccountId)
                      : false;
                    const isIncoming = !sourceIsSavings && targetIsSavings;
                    const isOutgoing = sourceIsSavings && !targetIsSavings;
                    const sign = isIncoming ? '+' : isOutgoing ? '-' : '';
                    const tone = isIncoming
                      ? 'text-success'
                      : isOutgoing
                      ? 'text-danger'
                      : 'text-muted';

                    return (
                      <div className={`shrink-0 font-semibold whitespace-nowrap ${tone}`}>
                        {sign}{formatPence(tx.amountPence)}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* MODAL: Add Savings Pot */}
      {showGoalModal && (
        <div className="mv-modal-backdrop">
          <div className="mv-modal-card">
            <div className="mv-modal-header">
              <div>
                <h3 className="text-base font-bold text-main">Add Savings Pot</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGoalModal(false)}
                className="mv-modal-close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGoalSubmit} className="mv-modal-form">
              {error && (
                <div className="rounded-xl border border-danger bg-danger-soft p-3 text-xs text-danger">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Pot Name</label>
                <input
                  autoFocus
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

              <div className="mv-modal-grid-2">
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

              <div className="mv-modal-actions">
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
        <div className="mv-modal-backdrop">
          <div className="mv-modal-card">
            <div className="mv-modal-header">
              <h3 className="text-base font-bold text-main">
                Transfer to {selectedGoal.name}
              </h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="mv-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="mv-modal-form">
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
                    .filter(
                      (a) =>
                        a.isActive !== false &&
                        a.type !== 'credit' &&
                        a.id !== selectedGoal.accountId
                    )
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatPence(acc.currentBalancePence)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="mv-modal-grid-2">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Amount (£)
                  </label>
                  <input
                    autoFocus
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
                    {personOptions.map((person) => (
                      <option key={person} value={person}>
                        {person}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mv-modal-actions">
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
        <div className="mv-modal-backdrop">
          <div className="mv-modal-card">
            <div className="mv-modal-header">
              <h3 className="text-base font-bold text-main">
                Edit {selectedGoal.name}
              </h3>
              <button
                onClick={() => setShowEditGoalModal(false)}
                className="mv-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditGoalSubmit} className="mv-modal-form">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Pot Name
                </label>
                <input
                  autoFocus
                  type="text"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                />
              </div>

              <div className="mv-modal-grid-2">
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

              <div className="mv-modal-actions justify-between">
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
