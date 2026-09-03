import React, { useState, useMemo } from 'react';
import { PiggyBank, Plus, ArrowUpRight, CheckCircle2, Target, Calendar, Landmark, X, AlertCircle } from 'lucide-react';
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
    <div className="space-y-8 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Household Savings & Reserve Pots
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Dedicated capital allocations (tracked distinctly from living expenditures)
          </p>
        </div>

        {canEdit && (
          <button
            onClick={() => {
              setError(null);
              setGoalName('');
              setGoalTargetStr('');
              setGoalCurrentStr('');
              setShowGoalModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Add Savings Pot
          </button>
        )}
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Total Allocated Savings
          </span>
          <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-1">
            {formatPence(totalSavedPence)}
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 block">
            Target: {formatPence(totalTargetPence)} ({overallPercent}%)
          </span>
        </div>

        <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            {selectedMonth} Contributions
          </span>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
            {formatPence(monthSavingsTotalPence)}
          </div>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 block font-medium">
            Excluded from living expenses
          </span>
        </div>

        <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs">
          <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
            Active Savings Goals
          </span>
          <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-1">
            {savingsGoals.length} Pots
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 block">
            Held in designated savings accounts
          </span>
        </div>
      </div>

      {/* Savings Pots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {savingsGoals.map((goal) => {
          const percent =
            goal.targetPence > 0
              ? Math.min(100, Math.round((goal.currentPence / goal.targetPence) * 100))
              : 100;
          const linkedAccount = accounts.find((a) => a.id === goal.accountId);

          return (
            <div
              key={goal.id}
              className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                      <PiggyBank className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                        {goal.name}
                      </h3>
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        Stored in {linkedAccount?.name || 'Account'}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-black text-neutral-900 dark:text-neutral-100">
                    {percent}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-neutral-100 dark:bg-neutral-700 rounded-full h-2.5 mt-5">
                  <div
                    className="bg-emerald-600 dark:bg-emerald-500 h-2.5 rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-xs mt-3">
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">Saved: </span>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {formatPence(goal.currentPence)}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 dark:text-neutral-400">Target: </span>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100">
                      {formatPence(goal.targetPence)}
                    </span>
                  </div>
                </div>

                {goal.targetDate && (
                  <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 mt-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Target Date: {goal.targetDate}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-700 flex items-center justify-between">
                <button
                  onClick={() => openTransferModal(goal)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 transition"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  Transfer into Pot
                </button>

                {canEdit && (
                  <button
                    onClick={() => openEditGoal(goal)}
                    className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition"
                  >
                    Edit Pot
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Month Savings Ledger */}
      <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs">
        <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          {selectedMonth} Savings Movements
        </h2>
        {monthSavingsTxs.length === 0 ? (
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            No savings contributions recorded for {selectedMonth} yet. Use "Transfer into Pot" to allocate funds.
          </p>
        ) : (
          <div className="space-y-2">
            {monthSavingsTxs.map((tx) => (
              <div
                key={tx.id}
                className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-100 dark:border-neutral-700/60 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    {tx.description}
                  </span>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {tx.date} • Payer: {tx.payer} • Excluded from Living Spend
                  </div>
                </div>
                <div className="font-black text-emerald-700 dark:text-emerald-400">
                  +{formatPence(tx.amountPence)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: Transfer into Savings */}
      {showTransferModal && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Transfer into: {selectedGoal.name}
              </h3>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="mt-4 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-800 dark:text-rose-300 text-xs">
                  {error}
                </div>
              )}

              <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                Moves money from a current account into the designated savings account. This is strictly non-spending and will not inflate living expenses.
              </p>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Source Account (From)
                </label>
                <select
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Amount (£)
                  </label>
                  <input
                    type="text"
                    value={transferAmountStr}
                    onChange={(e) => setTransferAmountStr(e.target.value)}
                    placeholder="e.g. 250.00"
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Payer / Contributor
                  </label>
                  <select
                    value={transferPayer}
                    onChange={(e) => setTransferPayer(e.target.value as Payer)}
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Joint">Joint</option>
                    <option value="Marius">Marius</option>
                    <option value="Vesta">Vesta</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Transferring...' : 'Confirm Savings Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Goal */}
      {showEditGoalModal && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-neutral-200 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Edit Savings Pot: {selectedGoal.name}
              </h3>
              <button
                onClick={() => setShowEditGoalModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditGoalSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Pot Name
                </label>
                <input
                  type="text"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Current (£)
                  </label>
                  <input
                    type="text"
                    value={goalCurrentStr}
                    onChange={(e) => setGoalCurrentStr(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                    Target (£)
                  </label>
                  <input
                    type="text"
                    value={goalTargetStr}
                    onChange={(e) => setGoalTargetStr(e.target.value)}
                    className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  Target Date (Optional)
                </label>
                <input
                  type="date"
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditGoalModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Update Pot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
