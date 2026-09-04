import React, { useState, useMemo } from 'react';
import {
  Landmark,
  PiggyBank,
  Plus,
  ArrowRight,
  ShieldCheck,
  Edit2,
  Archive,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  History,
  X,
  CreditCard,
  User,
  Calendar,
  Trash2,
} from 'lucide-react';
import { Account, SavingsGoal, UserRole, AccountType, Payer, Transaction } from '../types';
import { formatPence, parseToPence } from '../utils/currency';

interface AccountsViewProps {
  accounts: Account[];
  savingsGoals: SavingsGoal[];
  transactions: Transaction[];
  userRole: UserRole;
  onCreateAccount: (data: Partial<Account>) => Promise<void>;
  onUpdateAccount: (id: string, data: Partial<Account> & { reconciledBalancePence?: number }) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onCreateSavingsGoal: (data: Partial<SavingsGoal>) => Promise<void>;
  onUpdateSavingsGoal: (id: string, data: Partial<SavingsGoal>) => Promise<void>;
  onDeleteSavingsGoal: (id: string) => Promise<void>;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  savingsGoals,
  transactions,
  userRole,
  onCreateAccount,
  onUpdateAccount,
  onDeleteAccount,
  onCreateSavingsGoal,
  onUpdateSavingsGoal,
  onDeleteSavingsGoal,
}) => {
  const [showAccModal, setShowAccModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showEditGoalModal, setShowEditGoalModal] = useState(false);

  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // New Account form state
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType>('current');
  const [accOwner, setAccOwner] = useState<Payer>('Joint');
  const [accBalanceStr, setAccBalanceStr] = useState('');
  const [accNotes, setAccNotes] = useState('');

  // Edit Account form state
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AccountType>('current');
  const [editOwner, setEditOwner] = useState<Payer>('Joint');
  const [editNotes, setEditNotes] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Reconcile form state
  const [reconcileBalanceStr, setReconcileBalanceStr] = useState('');
  const [reconcileDate, setReconcileDate] = useState(new Date().toISOString().substring(0, 10));

  // New Goal form state
  const [goalName, setGoalName] = useState('');
  const [goalTargetStr, setGoalTargetStr] = useState('');
  const [goalCurrentStr, setGoalCurrentStr] = useState('');
  const [goalAccountId, setGoalAccountId] = useState(accounts[0]?.id || '');
  const [goalDate, setGoalDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = userRole === 'owner' || userRole === 'editor';

  // Filter accounts
  const displayedAccounts = useMemo(() => {
    return accounts.filter((a) => (showArchived ? true : a.isActive !== false));
  }, [accounts, showArchived]);

  // Account creation
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    try {
      setIsSubmitting(true);
      setError(null);
      const pence = parseToPence(accBalanceStr);
      await onCreateAccount({
        name: accName.trim(),
        type: accType,
        ownerPerson: accOwner,
        startingBalancePence: pence,
        notes: accNotes.trim() || undefined,
      });
      setAccName('');
      setAccBalanceStr('');
      setAccNotes('');
      setShowAccModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (acc: Account) => {
    setSelectedAccount(acc);
    setEditName(acc.name);
    setEditType(acc.type);
    setEditOwner(acc.ownerPerson || 'Joint');
    setEditNotes(acc.notes || '');
    setEditIsActive(acc.isActive !== false);
    setError(null);
    setShowEditModal(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !editName.trim()) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onUpdateAccount(selectedAccount.id, {
        name: editName.trim(),
        type: editType,
        ownerPerson: editOwner,
        notes: editNotes.trim() || undefined,
        isActive: editIsActive,
      });
      setShowEditModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update account');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Reconcile Modal
  const openReconcileModal = (acc: Account) => {
    setSelectedAccount(acc);
    setReconcileBalanceStr((acc.currentBalancePence / 100).toFixed(2));
    setReconcileDate(acc.reconciliationDate || new Date().toISOString().substring(0, 10));
    setError(null);
    setShowReconcileModal(true);
  };

  // Handle Reconcile Submit
  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    try {
      setIsSubmitting(true);
      setError(null);
      const pence = parseToPence(reconcileBalanceStr);
      await onUpdateAccount(selectedAccount.id, {
        reconciledBalancePence: pence,
        reconciliationDate: reconcileDate,
      });
      setShowReconcileModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to reconcile balance');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Activity Modal
  const openActivityModal = (acc: Account) => {
    setSelectedAccount(acc);
    setShowActivityModal(true);
  };

  // Handle Deactivate / Delete
  const handleDeactivate = async (acc: Account) => {
    if (!confirm(`Are you sure you want to archive or remove "${acc.name}"? Active references will be safely protected.`)) {
      return;
    }
    try {
      await onDeleteAccount(acc.id);
    } catch (err: any) {
      alert(err.message || 'Failed to archive account');
    }
  };

  // Handle Goal Submit
  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim() || !goalAccountId) return;
    try {
      setIsSubmitting(true);
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

  const handleEditGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal || !goalName.trim() || !goalAccountId) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onUpdateSavingsGoal(selectedGoal.id, {
        name: goalName.trim(),
        targetPence: parseToPence(goalTargetStr),
        currentPence: parseToPence(goalCurrentStr),
        accountId: goalAccountId,
        targetDate: goalDate || undefined,
      });
      setShowEditGoalModal(false);
      setSelectedGoal(null);
    } catch (err: any) {
      setError(err.message || 'Failed to update savings pot');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGoal = async (goal: SavingsGoal) => {
    if (!confirm(`Delete savings pot "${goal.name}"? This removes the goal only and does not delete account transactions.`)) {
      return;
    }
    try {
      setError(null);
      await onDeleteSavingsGoal(goal.id);
      if (selectedGoal?.id === goal.id) {
        setSelectedGoal(null);
        setShowEditGoalModal(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete savings pot');
    }
  };

  // Account activity transactions
  const accountActivityTxs = useMemo(() => {
    if (!selectedAccount) return [];
    return transactions.filter(
      (t) => t.accountId === selectedAccount.id || t.targetAccountId === selectedAccount.id
    );
  }, [transactions, selectedAccount]);

  return (
    <div className="space-y-6 pb-12">
      {/* Accounts Section */}
      <div>
        <div className="mb-4">
          <h1 className="w-full whitespace-nowrap text-xl font-bold text-main">
            Accounts
          </h1>

          <div className="mv-hscroll mv-edge-safe mt-3">
            <div className="flex min-w-max items-center gap-2">
              {canEdit && (
                <button
                  onClick={() => {
                    setError(null);
                    setShowAccModal(true);
                  }}
                  className="inline-flex h-9 shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full bg-accent px-3.5 text-[13px] font-semibold text-on-accent shadow-[0_2px_5px_-3px_rgba(15,23,42,0.25)] hover:bg-success-soft transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Account
                </button>
              )}

              <label className="inline-flex h-9 shrink-0 whitespace-nowrap items-center gap-2 rounded-full bg-surface-muted px-3.5 text-[13px] font-medium text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-success focus:ring-accent border-muted"
                />
                Show Archived
              </label>
            </div>
          </div>
        </div>

        {displayedAccounts.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-muted bg-surface-muted px-4 py-10 text-center text-[13px] font-medium text-subtle">
            No accounts
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedAccounts.map((acc) => {
            const isArchived = acc.isActive === false;
            return (
              <div
                key={acc.id}
                className={`bg-surface p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                  isArchived
                    ? 'border-muted opacity-70 bg-surface-muted'
                    : 'border-muted shadow-xs hover:border-muted'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-xl bg-surface-muted flex items-center justify-center text-muted">
                      {acc.type === 'credit' ? (
                        <CreditCard className="w-5 h-5 text-danger" />
                      ) : acc.type === 'savings' ? (
                        <PiggyBank className="w-5 h-5 text-success" />
                      ) : (
                        <Landmark className="w-5 h-5 text-accent" />
                      )}
                    </div>
                    <div className="mv-hscroll max-w-[70%] items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-surface-muted text-muted border border-muted">
                        {acc.type}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-success-soft text-success border border-success">
                        {acc.ownerPerson || 'Joint'}
                      </span>
                      {isArchived && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-warning-soft text-warning border border-warning">
                          Archived
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-main mt-3">
                    {acc.name}
                  </h3>
                  {acc.notes && (
                    <p className="text-xs text-muted text-subtle mt-1 line-clamp-2">
                      {acc.notes}
                    </p>
                  )}

                  {acc.reconciledAt && (
                    <div className="flex items-center gap-1 text-[11px] text-success mt-2 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        Reconciled {new Date(acc.reconciledAt).toLocaleDateString('en-GB')}
                        {acc.reconciliationDate && ` (As of ${acc.reconciliationDate})`}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-muted">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[11px] text-muted text-subtle font-medium">
                        {acc.type === 'credit' ? 'Owed' : 'Balance'}
                      </span>
                      <div
                        className={`text-2xl font-black mt-0.5 ${
                          acc.type === 'credit'
                            ? 'text-danger'
                            : acc.currentBalancePence < 0
                            ? 'text-danger'
                            : 'text-main'
                        }`}
                      >
                        {acc.type === 'credit'
                          ? formatPence(acc.balanceOwedPence ?? Math.max(0, -acc.currentBalancePence))
                          : formatPence(acc.currentBalancePence)}
                      </div>
                      {acc.creditLimitPence !== undefined && acc.creditLimitPence > 0 && (
                        <div className="text-[11px] text-muted text-subtle mt-1">
                          Limit: {formatPence(acc.creditLimitPence)} · Available:{' '}
                          {formatPence(
                            Math.max(
                              0,
                              acc.creditLimitPence -
                                (acc.balanceOwedPence ?? Math.max(0, -acc.currentBalancePence))
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-muted">
                    <button
                      onClick={() => openActivityModal(acc)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-main transition"
                    >
                      <History className="w-3.5 h-3.5" />
                      Activity
                    </button>

                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openReconcileModal(acc)}
                          title="Reconcile"
                          className="p-1.5 rounded-lg text-muted text-subtle hover:text-success hover:bg-surface-muted transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(acc)}
                          title="Edit"
                          className="p-1.5 rounded-lg text-muted text-subtle hover:text-main hover:bg-surface-muted transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeactivate(acc)}
                          title={isArchived ? 'Delete' : 'Archive'}
                          className="p-1.5 rounded-lg text-muted text-subtle hover:text-danger hover:bg-danger-soft transition"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* Savings Pots Section */}
      <div>
        <div className="mb-4">
          <h2 className="w-full whitespace-nowrap text-lg font-bold text-main">
            Savings Pots
          </h2>

          {canEdit && (
            <div className="mv-hscroll mv-edge-safe mt-3">
              <button
                onClick={() => setShowGoalModal(true)}
                className="inline-flex h-9 shrink-0 whitespace-nowrap items-center gap-1.5 rounded-full bg-surface-muted px-3.5 text-[13px] font-semibold text-muted shadow-[0_2px_5px_-3px_rgba(15,23,42,0.18)] hover:bg-surface-muted transition"
              >
                <Plus className="w-3.5 h-3.5 text-muted text-subtle" />
                Add Pot
              </button>
            </div>
          )}
        </div>

        {savingsGoals.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-muted bg-surface-muted px-4 py-10 text-center text-[13px] font-medium text-subtle">
            No savings pots
          </div>
        ) : (
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
                className="bg-surface p-5 rounded-2xl border border-muted shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-bold text-main">
                      {goal.name}
                    </h3>
                    <span className="text-xs text-muted text-subtle">
                      Stored in {linkedAccount?.name || 'Account'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-main">
                      {formatPence(goal.currentPence)}
                    </div>
                    <span className="text-[11px] text-muted text-subtle">
                      Target: {formatPence(goal.targetPence)}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-surface-muted rounded-full h-2 mt-4">
                  <div
                    className="bg-accent h-2 rounded-full transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] text-muted text-subtle mt-2">
                  <span>{percent}% funded</span>
                  {goal.targetDate && <span>Target: {goal.targetDate}</span>}
                </div>

                {canEdit && (
                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-muted pt-3">
                    <button
                      type="button"
                      onClick={() => openEditGoal(goal)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-muted bg-surface-muted px-3 py-2 text-xs font-semibold text-main transition-all hover:bg-surface active:scale-[0.98]"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-accent" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteGoal(goal)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-danger bg-danger-soft px-3 py-2 text-xs font-semibold text-danger transition-all hover:opacity-80 active:scale-[0.98]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* MODAL: Add Account */}
      {showAccModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-xs">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-muted p-6">
            <div className="flex items-center justify-between pb-3 border-b border-muted">
              <h3 className="text-base font-bold text-main">
                Add Account
              </h3>
              <button
                onClick={() => setShowAccModal(false)}
                className="p-1 rounded-lg text-muted text-subtle hover:text-muted hover:bg-surface-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAccountSubmit} className="mt-4 space-y-4">
              {error && (
                <div className="p-3 bg-danger-soft border border-danger rounded-xl text-danger text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="Account name"
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Owner
                  </label>
                  <select
                    value={accOwner}
                    onChange={(e) => setAccOwner(e.target.value as Payer)}
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  >
                    <option value="Joint">Joint</option>
                    <option value="Marius">Marius</option>
                    <option value="Vesta">Vesta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Type
                  </label>
                  <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value as AccountType)}
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  >
                    <option value="current">Current Account</option>
                    <option value="savings">Savings Account</option>
                    <option value="credit">Credit Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Starting Balance
                </label>
                <input
                  type="text"
                  value={accBalanceStr}
                  onChange={(e) => setAccBalanceStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Notes
                </label>
                <textarea
                  value={accNotes}
                  onChange={(e) => setAccNotes(e.target.value)}
                  placeholder="Notes"
                  rows={2}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-muted flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAccModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-accent hover:bg-success-soft text-on-accent rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Account */}
      {showEditModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-xs">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-muted p-6">
            <div className="flex items-center justify-between pb-3 border-b border-muted">
              <h3 className="text-base font-bold text-main">
                Edit {selectedAccount.name}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 rounded-lg text-muted text-subtle hover:text-muted hover:bg-surface-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
              {error && (
                <div className="p-3 bg-danger-soft border border-danger rounded-xl text-danger text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Account Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Owner
                  </label>
                  <select
                    value={editOwner}
                    onChange={(e) => setEditOwner(e.target.value as Payer)}
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  >
                    <option value="Joint">Joint</option>
                    <option value="Marius">Marius</option>
                    <option value="Vesta">Vesta</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Type
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as AccountType)}
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  >
                    <option value="current">Current Account</option>
                    <option value="savings">Savings Account</option>
                    <option value="credit">Credit Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Status
                </label>
                <label className="flex items-center gap-2 text-xs text-main mt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-success focus:ring-accent border-muted"
                  />
                  <span>Active</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-muted flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-accent hover:bg-success-soft text-on-accent rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Update Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reconcile Balance */}
      {showReconcileModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-xs">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-muted p-6">
            <div className="flex items-center justify-between pb-3 border-b border-muted">
              <h3 className="text-base font-bold text-main">
                Reconcile
              </h3>
              <button
                onClick={() => setShowReconcileModal(false)}
                className="p-1 rounded-lg text-muted text-subtle hover:text-muted hover:bg-surface-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReconcileSubmit} className="mt-4 space-y-4">
              {error && (
                <div className="p-3 bg-danger-soft border border-danger rounded-xl text-danger text-xs">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Statement Date
                  </label>
                  <input
                    type="date"
                    value={reconcileDate}
                    onChange={(e) => setReconcileDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Statement Balance
                  </label>
                  <input
                    type="text"
                    value={reconcileBalanceStr}
                    onChange={(e) => setReconcileBalanceStr(e.target.value)}
                    placeholder="e.g. 2450.00"
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-sm font-bold text-main focus:ring-2 focus:ring-accent focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Real-time Discrepancy Card */}
              {(() => {
                const targetPence = parseToPence(reconcileBalanceStr);
                const diffPence = targetPence - selectedAccount.currentBalancePence;
                return (
                  <div className="p-3 bg-surface-muted rounded-xl border border-muted text-xs space-y-1.5">
                    <div className="flex justify-between text-muted text-subtle">
                      <span>Current</span>
                      <span className="font-semibold text-main">
                        {formatPence(selectedAccount.currentBalancePence)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted text-subtle">
                      <span>Statement</span>
                      <span className="font-semibold text-main">
                        {formatPence(targetPence)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-muted font-bold">
                      <span>Discrepancy:</span>
                      <span
                        className={
                          diffPence === 0
                            ? 'text-success'
                            : diffPence > 0
                            ? 'text-accent'
                            : 'text-warning'
                        }
                      >
                        {diffPence === 0
                          ? 'Exact match (£0.00)'
                          : `${diffPence > 0 ? '+' : ''}${formatPence(diffPence)}`}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="pt-3 border-t border-muted flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-accent hover:bg-success-soft text-on-accent rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Reconcile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Account Activity Ledger */}
      {showActivityModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-xs">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-muted p-6 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-muted">
              <div>
                <h3 className="text-base font-bold text-main">
                  {selectedAccount.name} Activity
                </h3>
                <p className="text-xs text-muted text-subtle">
                  {formatPence(selectedAccount.currentBalancePence)}
                </p>
              </div>
              <button
                onClick={() => setShowActivityModal(false)}
                className="p-1 rounded-lg text-muted text-subtle hover:text-muted hover:bg-surface-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-4 space-y-2 pr-1">
              {accountActivityTxs.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted text-subtle bg-surface-muted rounded-xl">
                  No recorded transactions for this account yet.
                </div>
              ) : (
                accountActivityTxs.map((tx) => {
                  const isIncoming =
                    tx.type === 'income' ||
                    tx.type === 'refund' ||
                    (tx.type === 'transfer' && tx.targetAccountId === selectedAccount.id);

                  return (
                    <div
                      key={tx.id}
                      className="p-3 bg-surface-muted border border-muted rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-main">
                            {tx.description}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-muted text-muted font-medium">
                            {tx.type}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-success-soft text-success font-medium">
                            {tx.payer}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted text-subtle mt-0.5">
                          {tx.date}
                        </div>
                      </div>

                      <div
                        className={`text-xs font-black ${
                          isIncoming
                            ? 'text-success'
                            : 'text-main'
                        }`}
                      >
                        {isIncoming ? '+' : '-'}
                        {formatPence(tx.amountPence)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-muted flex justify-end">
              <button
                onClick={() => setShowActivityModal(false)}
                className="px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Savings Pot */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-xs">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-muted p-6">
            <div className="flex items-center justify-between pb-3 border-b border-muted">
              <h3 className="text-base font-bold text-main">
                Create Savings Pot / Goal
              </h3>
              <button
                onClick={() => setShowGoalModal(false)}
                className="p-1 rounded-lg text-muted text-subtle hover:text-muted hover:bg-surface-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGoalSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Goal Name
                </label>
                <input
                  type="text"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="e.g. House Deposit / Emergency Fund"
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Linked Account
                </label>
                <select
                  value={goalAccountId}
                  onChange={(e) => setGoalAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                >
                  {accounts
                    .filter((a) => a.isActive !== false)
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
                    Current (£)
                  </label>
                  <input
                    type="text"
                    value={goalCurrentStr}
                    onChange={(e) => setGoalCurrentStr(e.target.value)}
                    placeholder="0.00"
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
                    placeholder="10000.00"
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Target Date (Optional)
                </label>
                <input
                  type="date"
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-muted flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-accent hover:bg-success-soft text-on-accent rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Savings Pot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit Savings Pot */}
      {showEditGoalModal && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-xs">
          <div className="bg-surface rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-muted p-6">
            <div className="flex items-center justify-between pb-3 border-b border-muted">
              <h3 className="text-base font-bold text-main">Edit Savings Pot</h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditGoalModal(false);
                  setSelectedGoal(null);
                }}
                className="p-1 rounded-lg text-subtle hover:text-main hover:bg-surface-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditGoalSubmit} className="mt-4 space-y-4">
              {error && (
                <div className="p-3 bg-danger-soft border border-danger rounded-xl text-danger text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Goal Name</label>
                <input
                  type="text"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Linked Account</label>
                <select
                  value={goalAccountId}
                  onChange={(e) => setGoalAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                >
                  {accounts
                    .filter((a) => a.isActive !== false || a.id === selectedGoal.accountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({formatPence(acc.currentBalancePence)})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Current (£)</label>
                  <input
                    type="text"
                    value={goalCurrentStr}
                    onChange={(e) => setGoalCurrentStr(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
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
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Target Date</label>
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
                    onClick={() => {
                      setShowEditGoalModal(false);
                      setSelectedGoal(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-accent text-on-accent rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition-all active:scale-[0.98]"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
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
