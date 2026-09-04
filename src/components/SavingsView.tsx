import React, { useState, useMemo } from 'react';
import { PiggyBank, Plus, ArrowUpRight, CheckCircle2, Target, Calendar, Landmark, X, AlertCircle, Trash2 } from 'lucide-react';
import { SavingsGoal, Account, Transaction, UserRole, Payer } from '../types';
import { formatPence, parseToPence } from '../utils/currency';

interface SavingsViewProps {
  savingsGoals: SavingsGoal[];
  accounts: Account[];
  transactions: Transaction[];
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
  const [goalAccountId, setGoalAccountId] = useState(accounts.find((a) => a.type === 'savings')?.id || accounts[0]?.id || '');
  const [goalDate, setGoalDate] = useState('');

  // Quick savings transfer state
  const [sourceAccountId, setSourceAccountId] = useState(accounts.find((a) => a.type === 'current')?.id || accounts[0]?.id || '');
  const [transferAmountStr, setTransferAmountStr] = useState('');
  const [transferPayer, setTransferPayer] = useState<Payer>('Joint');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = userRole === 'owner' || userRole === 'editor';

  // Savings movements for the selected month
  const monthSavingsTxs = useMemo(() => {
    return transactions.filter((t) => t.isSavings && t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const monthSavingsTotalPence = useMemo(() => {
    return monthSavingsTxs.reduce((sum, t) => sum + t.amountPence, 0);
  }, [monthSavingsTxs]);

  const totalSavedPence = useMemo(() => {
    return savingsGoals.reduce((sum, g) => sum + g.currentPence, 0);
  }, [savingsGoals]);

  const totalTargetPence = useMemo(() => {
    return savingsGoals.reduce((sum, g) => sum + g.targetPence, 0);
  }, [savingsGoals]);

  const overallPercent = totalTargetPence > 0 ? Math.min(100, Math.round((totalSavedPence / totalTargetPence) * 100)) : 100;

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
              onClick={() => {
                setError(null);
                setGoalName('');
                setGoalTargetStr('');
                setGoalCurrentStr('');
                setShowGoalModal(true);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-on-accent shadow-[0_2px_5px_-3px_rgba(15,23,42,0.25)] hover:bg-success-soft transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Pot
            </button>
          </div>
        )}
      </div>

      {/* Savings Summary, Goals & Movements */}
      <section className="mv-edge-safe rounded-2xl border border-muted bg-surface p-3 sm:p-4 space-y-5">
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3">
          <article className="min-w-0 rounded-[14px] border border-muted bg-surface p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)]">
            <h2 className="text-[15px] font-semibold leading-5 text-main">
              Total Savings
            </h2>
            <div className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-main whitespace-nowrap">
              {formatPence(totalSavedPence)}
            </div>
            <span className="mt-1 block text-[12px] font-normal leading-4 text-muted">
              target {formatPence(totalTargetPence)} · {overallPercent}%
            </span>
          </article>

          <article className="min-w-0 rounded-[14px] border border-muted bg-surface p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)]">
            <h2 className="text-[15px] font-semibold leading-5 text-main">
              {selectedMonth} Contributions
            </h2>
            <div className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight text-success whitespace-nowrap">
              {formatPence(monthSavingsTotalPence)}
            </div>
            <span className="mt-1 block text-[12px] font-normal leading-4 text-muted">
              excluded from living spend
            </span>
          </article>
        </div>

        <div className="space-y-3">
          <h2 className="text-[15px] font-semibold leading-5 text-main">
            Active Savings Goals
          </h2>

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
