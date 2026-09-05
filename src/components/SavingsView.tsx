import React, { useEffect, useMemo, useState } from 'react';
import { PiggyBank, Plus, ArrowUpRight, ArrowRight, Calendar, X, Trash2 } from 'lucide-react';
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
  calculateTransferredFromSavingsPence,
  formatPence,
  parseToPence,
} from '../utils/currency';
import { accountIdentityLabel, accountOptionLabel } from '../utils/accountDisplay';

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
    destinationAccountId: string;
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
  const [goalDate, setGoalDate] = useState('');
  const [goalMonthlyPlanStr, setGoalMonthlyPlanStr] = useState('');

  // Quick savings transfer state. Source and destination are deliberate choices.
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [transferAmountStr, setTransferAmountStr] = useState('');

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

  const transferredFromSavingsPence = useMemo(
    () => calculateTransferredFromSavingsPence(accounts, transactions, selectedMonth),
    [accounts, transactions, selectedMonth]
  );

  // Household savings goals are targets only. Progress is derived from all
  // active Savings + Cash balances, never from an account-specific allocation.
  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim()) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onCreateSavingsGoal({
        name: goalName.trim(),
        targetPence: parseToPence(goalTargetStr),
        currentPence: 0,
        targetDate: goalDate || undefined,
        monthlyPlanPence: parseToPence(goalMonthlyPlanStr) || undefined,
      });
      setGoalName('');
      setGoalTargetStr('');
      setGoalDate('');
      setGoalMonthlyPlanStr('');
      setShowGoalModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create savings goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditGoal = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    setGoalName(goal.name);
    setGoalTargetStr((goal.targetPence / 100).toFixed(2));
    setGoalDate(goal.targetDate || '');
    setGoalMonthlyPlanStr(
      goal.monthlyPlanPence ? (goal.monthlyPlanPence / 100).toFixed(2) : ''
    );
    setError(null);
    setShowEditGoalModal(true);
  };

  const handleEditGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !goalName.trim()) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onUpdateSavingsGoal(selectedGoal.id, {
        name: goalName.trim(),
        targetPence: parseToPence(goalTargetStr),
        targetDate: goalDate || undefined,
        monthlyPlanPence: parseToPence(goalMonthlyPlanStr) || undefined,
      });
      setShowEditGoalModal(false);
      setSelectedGoal(null);
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

  // Open a transfer for this goal, but let the user choose where savings are held.
  const openTransferModal = (goal: SavingsGoal) => {
    setSelectedGoal(goal);
    setTransferAmountStr('');
    setSourceAccountId('');
    setDestinationAccountId('');
    setError(null);
    setShowTransferModal(true);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    const pence = parseToPence(transferAmountStr);
    if (pence <= 0) {
      setError('Please enter a valid transfer amount greater than £0.00');
      return;
    }
    if (!sourceAccountId) {
      setError('Choose the account the money will come from.');
      return;
    }
    if (!destinationAccountId) {
      setError('Choose a Savings or Cash account to receive the money.');
      return;
    }
    if (sourceAccountId === destinationAccountId) {
      setError('Source account must be different from the savings destination.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onExecuteTransfer({
        goalId: selectedGoal.id,
        sourceAccountId,
        destinationAccountId,
        amountPence: pence,
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
              onClick={() => {
                setError(null);
                setGoalName('');
                setGoalTargetStr('');
                setGoalDate('');
                setGoalMonthlyPlanStr('');
                setShowGoalModal(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-on-accent shadow-sm transition-all hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Goal
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
              Projected Total Savings
            </h2>
            <div className="mt-2 font-mono text-xl sm:text-2xl font-semibold tracking-tight tabular-nums text-main whitespace-nowrap">
              {formatPence(savingsPosition.projectedEndSavingsPence)}
            </div>
            <span className="mt-1 block text-[11px] leading-4 text-subtle">
              Current savings + this month's surplus
            </span>
          </article>

          <article className="min-w-0 rounded-[14px] border border-muted bg-surface p-4 shadow-sm">
            <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted">
              Transferred From Savings
            </h2>
            <div
              className={`mt-2 font-mono text-xl sm:text-2xl font-semibold tracking-tight tabular-nums whitespace-nowrap ${
                'text-main'
              }`}
            >
              {formatPence(transferredFromSavingsPence)}
            </div>
            <span className="mt-1 block text-[11px] leading-4 text-subtle">
              Moved to fund other accounts
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
                        {account.type === 'cash' ? 'Cash' : 'Savings'} · {account.ownerPerson || 'Owner not set'}
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
              Progress uses total Savings + Cash balances
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
                const currentPence = savingsPosition.currentSavingsPence;
                const projectedPence = savingsPosition.projectedEndSavingsPence;
                const currentPercentRaw =
                  goal.targetPence > 0 ? (currentPence / goal.targetPence) * 100 : 100;
                const projectedPercentRaw =
                  goal.targetPence > 0 ? (projectedPence / goal.targetPence) * 100 : 100;
                const percent = Math.round(currentPercentRaw * 10) / 10;
                const projectedPercent = Math.round(projectedPercentRaw * 10) / 10;
                const progressBarPercent = Math.min(100, Math.max(0, currentPercentRaw));
                const remainingPence = Math.max(0, goal.targetPence - currentPence);
                const projectedOverPence = Math.max(0, projectedPence - goal.targetPence);
                const financeMonthlyPence = Math.max(0, savingsPosition.savedThisMonthPence);
                const financeMonths =
                  remainingPence === 0
                    ? 0
                    : financeMonthlyPence > 0
                    ? Math.ceil(remainingPence / financeMonthlyPence)
                    : null;
                const planMonthlyPence = goal.monthlyPlanPence || 0;
                const planMonths =
                  remainingPence === 0
                    ? 0
                    : planMonthlyPence > 0
                    ? Math.ceil(remainingPence / planMonthlyPence)
                    : null;
                const selectedYear = Number(selectedMonth.slice(0, 4));
                const selectedMonthNumber = Number(selectedMonth.slice(5, 7));
                const targetYear = goal.targetDate
                  ? Number(goal.targetDate.slice(0, 4))
                  : 0;
                const targetMonthNumber = goal.targetDate
                  ? Number(goal.targetDate.slice(5, 7))
                  : 0;
                const monthsToTarget = goal.targetDate
                  ? Math.max(
                      0,
                      (targetYear - selectedYear) * 12 +
                        (targetMonthNumber - selectedMonthNumber) +
                        1
                    )
                  : 0;
                const requiredMonthlyPence =
                  remainingPence > 0 && monthsToTarget > 0
                    ? Math.ceil(remainingPence / monthsToTarget)
                    : remainingPence === 0
                    ? 0
                    : null;

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
                              Household savings goal
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
                          style={{ width: `${progressBarPercent}%` }}
                        />
                      </div>

                      <div className="mt-3 space-y-2 text-[12px]">
                        <div className="rounded-xl bg-surface-muted px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted">Current progress</span>
                            <span className="font-semibold text-main">{percent}%</span>
                          </div>
                          <div className="mt-1 font-semibold text-main">
                            {formatPence(currentPence)} of {formatPence(goal.targetPence)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-subtle">
                            {remainingPence > 0 ? `${formatPence(remainingPence)} remaining` : 'Goal achieved'}
                          </div>
                        </div>

                        <div className="rounded-xl bg-accent-soft px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted">Projected progress</span>
                            <span className="font-semibold text-main">{projectedPercent}%</span>
                          </div>
                          <div className="mt-1 font-semibold text-main">
                            {formatPence(projectedPence)} of {formatPence(goal.targetPence)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-subtle">
                            {projectedOverPence > 0
                              ? `Projected ${formatPence(projectedOverPence)} above goal`
                              : projectedPence >= goal.targetPence
                              ? 'Projected to reach goal'
                              : 'Based on current monthly position'}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded-xl border border-muted px-3 py-2.5">
                            <span className="block text-muted">Based on my finances</span>
                            <span className="mt-1 block font-semibold text-main">
                              {financeMonths === null
                                ? 'No positive saving rate yet'
                                : financeMonths === 0
                                ? 'Goal achieved'
                                : `${financeMonths} month${financeMonths === 1 ? '' : 's'} at ${formatPence(financeMonthlyPence)}/month`}
                            </span>
                          </div>
                          <div className="rounded-xl border border-muted px-3 py-2.5">
                            <span className="block text-muted">My monthly saving plan</span>
                            <span className="mt-1 block font-semibold text-main">
                              {planMonths === null
                                ? 'Set a monthly amount in Edit'
                                : planMonths === 0
                                ? 'Goal achieved'
                                : `${planMonths} month${planMonths === 1 ? '' : 's'} at ${formatPence(planMonthlyPence)}/month`}
                            </span>
                          </div>
                        </div>

                        {goal.targetDate && (
                          <div className="rounded-xl border border-muted px-3 py-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] text-muted">
                              <Calendar className="w-3.5 h-3.5 shrink-0" />
                              <span>Target {goal.targetDate}</span>
                            </div>
                            <div className="mt-1 text-[12px] font-semibold text-main">
                              {requiredMonthlyPence === null
                                ? 'Target date has passed'
                                : requiredMonthlyPence === 0
                                ? 'Goal achieved'
                                : `Save ${formatPence(requiredMonthlyPence)}/month to reach this date`}
                            </div>
                          </div>
                        )}
                      </div>
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
                    const tone = isIncoming ? 'text-success' : 'text-muted';
                    const direction = isIncoming ? 'in' : isOutgoing ? 'out' : '';

                    return (
                      <div className={`shrink-0 font-semibold whitespace-nowrap ${tone}`}>
                        {formatPence(tx.amountPence)}{direction ? ` ${direction}` : ''}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* MODAL: Add Savings Goal */}
      {showGoalModal && (
        <div className="mv-modal-backdrop">
          <div className="mv-modal-card">
            <div className="mv-modal-header">
              <div>
                <h3 className="text-base font-bold text-main">Add Savings Goal</h3>
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
                <div className="mv-savings-warning-banner">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Goal Name</label>
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
                <label className="mb-1 block text-xs font-semibold text-muted">Target (£)</label>
                <input
                  value={goalTargetStr}
                  onChange={(event) => setGoalTargetStr(event.target.value)}
                  className="h-11 w-full rounded-xl border border-muted bg-surface-muted px-3.5 text-sm text-main focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
                  placeholder="20000.00"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">
                  Monthly Saving Plan (£) <span className="font-normal text-subtle">optional</span>
                </label>
                <input
                  value={goalMonthlyPlanStr}
                  onChange={(event) => setGoalMonthlyPlanStr(event.target.value)}
                  className="h-11 w-full rounded-xl border border-muted bg-surface-muted px-3.5 text-sm text-main focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft"
                  placeholder="e.g. 500.00"
                />
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
                  disabled={isSubmitting}
                  className="h-10 rounded-xl bg-accent px-4 text-xs font-semibold text-on-accent transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Goal'}
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
                Add to Savings · {selectedGoal.name}
              </h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="mv-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="mv-modal-form">
              {error && <div className="mv-savings-warning-banner">{error}</div>}

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Source account
                </label>
                <select
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                >
                  <option value="">Select source account</option>
                  {accounts
                    .filter(
                      (account) =>
                        account.isActive !== false &&
                        account.type !== 'credit' &&
                        account.id !== destinationAccountId
                    )
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {accountOptionLabel(account)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-center text-subtle" aria-hidden="true">
                <ArrowRight className="h-4 w-4" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Savings destination
                </label>
                <select
                  value={destinationAccountId}
                  onChange={(e) => setDestinationAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                >
                  <option value="">Select Savings or Cash account</option>
                  {savingsAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {accountOptionLabel(account)}
                    </option>
                  ))}
                </select>
              </div>

              {sourceAccountId && destinationAccountId && (
                <div className="rounded-xl border border-muted bg-surface-muted px-3 py-2 text-[11px] text-muted">
                  <span className="font-semibold text-main">
                    {accountIdentityLabel(
                      accounts.find((account) => account.id === sourceAccountId)!
                    )}
                  </span>
                  <span className="mx-2 text-subtle">→</span>
                  <span className="font-semibold text-main">
                    {accountIdentityLabel(
                      accounts.find((account) => account.id === destinationAccountId)!
                    )}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Amount
                </label>
                <div className="relative min-w-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-subtle">
                    £
                  </span>
                  <input
                    autoFocus
                    type="text"
                    inputMode="decimal"
                    value={transferAmountStr}
                    onChange={(e) => setTransferAmountStr(e.target.value)}
                    placeholder="250.00"
                    className="mv-money-input-with-prefix w-full min-w-0 bg-surface border border-muted rounded-xl text-xs text-main font-bold tabular-nums focus:ring-2 focus:ring-accent focus:outline-none"
                    required
                  />
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
                  disabled={isSubmitting || !sourceAccountId || !destinationAccountId}
                  className="px-4 py-2 bg-accent hover:bg-success-soft text-on-accent rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Record transfer'}
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

                            <div>
                <label className="block text-xs font-semibold text-muted mb-1">Target (£)</label>
                <input
                  type="text"
                  value={goalTargetStr}
                  onChange={(e) => setGoalTargetStr(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Monthly Saving Plan (£) <span className="font-normal text-subtle">optional</span>
                </label>
                <input
                  type="text"
                  value={goalMonthlyPlanStr}
                  onChange={(e) => setGoalMonthlyPlanStr(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  placeholder="e.g. 500.00"
                />
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
                  Delete Goal
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
                    {isSubmitting ? 'Saving...' : 'Update Goal'}
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
