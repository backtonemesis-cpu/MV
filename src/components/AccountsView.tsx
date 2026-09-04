import React, { useEffect, useMemo, useState } from 'react';
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
import { JOINT_ACCOUNT_OWNER_ID } from '../types';
import type { Account, SavingsGoal, UserRole, AccountType, Transaction, HouseholdMember } from '../types';
import {
  calculateSavingsGoalAllocationIntegrity,
  formatPence,
  parseToPence,
} from '../utils/currency';

interface AccountsViewProps {
  accounts: Account[];
  savingsGoals: SavingsGoal[];
  transactions: Transaction[];
  members: HouseholdMember[];
  userRole: UserRole;
  onCreateAccount: (data: Partial<Account>) => Promise<void>;
  onUpdateAccount: (id: string, data: Partial<Account> & { reconciledBalancePence?: number }) => Promise<void>;
  onReconcileAccount: (id: string, reconciledBalancePence: number, reconciliationDate: string) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
  onCreateSavingsGoal: (data: Partial<SavingsGoal>) => Promise<void>;
  onUpdateSavingsGoal: (id: string, data: Partial<SavingsGoal>) => Promise<void>;
  onDeleteSavingsGoal: (id: string) => Promise<void>;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  savingsGoals,
  transactions,
  members,
  userRole,
  onCreateAccount,
  onUpdateAccount,
  onReconcileAccount,
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
  const [accOwnerMemberId, setAccOwnerMemberId] = useState('');
  const [accBalanceStr, setAccBalanceStr] = useState('');
  const [accNotes, setAccNotes] = useState('');

  // Edit Account form state
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AccountType>('current');
  const [editOwnerMemberId, setEditOwnerMemberId] = useState('');
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

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (showActivityModal) {
        setShowActivityModal(false);
      } else if (showReconcileModal) {
        setShowReconcileModal(false);
      } else if (showEditGoalModal) {
        setShowEditGoalModal(false);
        setSelectedGoal(null);
      } else if (showGoalModal) {
        setShowGoalModal(false);
      } else if (showEditModal) {
        setShowEditModal(false);
        setSelectedAccount(null);
      } else if (showAccModal) {
        setShowAccModal(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [
    showAccModal,
    showActivityModal,
    showEditGoalModal,
    showEditModal,
    showGoalModal,
    showReconcileModal,
  ]);

  const canEdit = userRole === 'owner' || userRole === 'editor';
  const ownerOptions = useMemo(
    () => [
      { id: JOINT_ACCOUNT_OWNER_ID, name: 'Joint' },
      ...members
        .filter((member) => member.role !== 'removed')
        .map((member) => ({ id: member.id, name: member.name })),
    ],
    [members]
  );

  const editOwnerOptions = useMemo(() => {
    const options = [...ownerOptions];
    const currentOwnerId = selectedAccount?.ownerMemberId;
    if (
      currentOwnerId &&
      currentOwnerId !== JOINT_ACCOUNT_OWNER_ID &&
      !options.some((option) => option.id === currentOwnerId)
    ) {
      const removedMember = members.find((member) => member.id === currentOwnerId);
      if (removedMember) {
        options.push({ id: removedMember.id, name: `${removedMember.name} (removed)` });
      }
    }
    return options;
  }, [members, ownerOptions, selectedAccount]);

  // Filter accounts
  const displayedAccounts = useMemo(() => {
    return accounts.filter((a) => (showArchived ? true : a.isActive !== false));
  }, [accounts, showArchived]);

  // Group accounts by financial role. Joint current accounts belong with current accounts,
  // while cash is treated as a liquid savings asset.
  const currentAccounts = useMemo(
    () => displayedAccounts.filter((account) => account.type === 'current' || account.type === 'joint'),
    [displayedAccounts]
  );

  const savingsAccounts = useMemo(
    () => displayedAccounts.filter((account) => account.type === 'savings' || account.type === 'cash'),
    [displayedAccounts]
  );

  const creditAccounts = useMemo(
    () => displayedAccounts.filter((account) => account.type === 'credit'),
    [displayedAccounts]
  );

  const goalIntegrityById = useMemo(() => {
    const rows = calculateSavingsGoalAllocationIntegrity(accounts, savingsGoals);
    return new Map(rows.map((row) => [row.goalId, row]));
  }, [accounts, savingsGoals]);

  // Account creation
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) return;
    if (!accOwnerMemberId) {
      setError('Account owner is required. Choose a household member or Joint.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      const pence = parseToPence(accBalanceStr);
      await onCreateAccount({
        name: accName.trim(),
        type: accType,
        ownerMemberId: accOwnerMemberId,
        startingBalancePence: pence,
        notes: accNotes.trim() || undefined,
      });
      setAccName('');
      setAccOwnerMemberId('');
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
    const resolvedOwnerId =
      acc.ownerMemberId ||
      (acc.ownerPerson?.trim().toLowerCase() === 'joint'
        ? JOINT_ACCOUNT_OWNER_ID
        : members.find(
            (member) =>
              member.name.trim().toLowerCase() === acc.ownerPerson?.trim().toLowerCase()
          )?.id) ||
      '';
    setEditOwnerMemberId(resolvedOwnerId);
    setEditNotes(acc.notes || '');
    setEditIsActive(acc.isActive !== false);
    setError(null);
    setShowEditModal(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !editName.trim()) return;
    if (!editOwnerMemberId) {
      setError('Account owner is required. Choose a household member or Joint.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      await onUpdateAccount(selectedAccount.id, {
        name: editName.trim(),
        type: editType,
        ownerMemberId: editOwnerMemberId,
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
      await onReconcileAccount(selectedAccount.id, pence, reconcileDate);
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

  const renderAccountCard = (acc: Account) => {
    const isArchived = acc.isActive === false;
    const isCredit = acc.type === 'credit';
    const ownerLabel =
      acc.ownerMemberId === JOINT_ACCOUNT_OWNER_ID
        ? 'Joint'
        : members.find((member) => member.id === acc.ownerMemberId)?.name ||
          acc.ownerPerson ||
          'Unassigned';
    const balancePence = isCredit
      ? acc.currentBalancePence !== 0
        ? Math.max(0, -acc.currentBalancePence)
        : (acc.balanceOwedPence ?? 0)
      : acc.currentBalancePence;

    return (
      <article
        key={acc.id}
        className={`mv-card bg-surface border border-muted rounded-2xl p-5 flex flex-col justify-between min-h-[200px] transition-all hover:border-strong/60 ${
          isArchived ? 'opacity-70' : ''
        }`}
      >
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-accent">
              {isCredit ? (
                <CreditCard className="h-5 w-5" />
              ) : acc.type === 'savings' || acc.type === 'cash' ? (
                <PiggyBank className="h-5 w-5" />
              ) : (
                <Landmark className="h-5 w-5" />
              )}
            </div>

            <div className="flex min-w-0 flex-wrap justify-end gap-1.5">
              <span className="rounded-full border border-muted bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                {acc.type}
              </span>
              <span className="rounded-full border border-muted bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                {ownerLabel}
              </span>
              {isArchived && (
                <span className="rounded-full border border-warning bg-warning-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning">
                  Archived
                </span>
              )}
            </div>
          </div>

          <h3 className="mt-3 text-base font-bold text-main">{acc.name}</h3>

          {acc.notes && (
            <p className="text-xs text-subtle font-normal tracking-wide line-clamp-2 mt-1 mb-4 opacity-60">
              {acc.notes}
            </p>
          )}

          {acc.reconciledAt && (
            <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                Reconciled {new Date(acc.reconciledAt).toLocaleDateString('en-GB')}
                {acc.reconciliationDate && ` · ${acc.reconciliationDate}`}
              </span>
            </div>
          )}
        </div>

        <div className="mt-5 border-t border-muted pt-4">
          <span className="text-[11px] font-medium text-muted">
            {isCredit ? 'Owed' : 'Balance'}
          </span>

          <div className="text-2xl font-extrabold text-main font-mono tracking-tight tabular-nums mt-0.5">
            {formatPence(balancePence)}
          </div>

          {isCredit && acc.creditLimitPence !== undefined && acc.creditLimitPence > 0 && (
            <div className="mv-private-value mt-1 text-[11px] text-subtle">
              Limit {formatPence(acc.creditLimitPence)} · Available{' '}
              {formatPence(Math.max(0, acc.creditLimitPence - balancePence))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-muted pt-3">
            <button
              type="button"
              onClick={() => openActivityModal(acc)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted transition hover:text-main"
            >
              <History className="h-3.5 w-3.5" />
              Activity
            </button>

            {canEdit && (
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => openReconcileModal(acc)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-muted bg-surface-muted px-2.5 text-[11px] font-semibold text-muted transition-all hover:border-strong hover:text-accent active:scale-[0.97]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reconcile
                </button>
                <button
                  type="button"
                  onClick={() => openEditModal(acc)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-muted bg-surface-muted px-2.5 text-[11px] font-semibold text-main transition-all hover:border-strong active:scale-[0.97]"
                >
                  <Edit2 className="h-3.5 w-3.5 text-accent" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDeactivate(acc)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-danger bg-danger-soft px-2.5 text-[11px] font-semibold text-danger transition-all hover:opacity-80 active:scale-[0.97]"
                >
                  <Archive className="h-3.5 w-3.5" />
                  {isArchived ? 'Delete' : 'Archive'}
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
    );
  };

  const renderAccountSection = (
    title: string,
    groupedAccounts: Account[],
    emptyLabel: string
  ) => (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight text-main">{title}</h2>
        <span className="rounded-full border border-muted bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-muted">
          {groupedAccounts.length}
        </span>
      </div>

      {groupedAccounts.length === 0 ? (
        <div className="mb-8 rounded-2xl border border-dashed border-muted bg-surface-muted px-5 py-8 text-center text-sm text-subtle">
          {emptyLabel}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {groupedAccounts.map((account) => renderAccountCard(account))}
        </div>
      )}
    </section>
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Accounts Workspace */}
      <div>
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight text-main">Accounts</h1>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setShowAccModal(true);
                }}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent shadow-sm transition-all hover:brightness-95 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Add Account
              </button>
            )}

            <label className="inline-flex h-10 items-center gap-2 rounded-xl border border-muted bg-surface-muted px-3.5 text-sm font-medium text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-muted text-accent focus:ring-accent"
              />
              Show Archived
            </label>
          </div>
        </div>

        {renderAccountSection(
          '💳 Current Accounts',
          currentAccounts,
          'No current accounts to display.'
        )}

        {renderAccountSection(
          '💰 Savings & Liquid Assets',
          savingsAccounts,
          'No savings or cash accounts to display.'
        )}

        {renderAccountSection(
          '🚨 Credit Cards & Liabilities',
          creditAccounts,
          'No credit accounts to display.'
        )}
      </div>

      {/* Savings Pots Section */}
      <section className="pt-1">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-main">Savings Pots</h2>
            <p className="mt-0.5 text-xs text-muted">
              Goals linked to your savings and liquid accounts.
            </p>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowGoalModal(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-muted bg-surface px-3.5 text-sm font-semibold text-main transition-all hover:bg-surface-muted active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 text-accent" />
              Add Pot
            </button>
          )}
        </div>

        {savingsGoals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-muted bg-surface-muted px-6 py-12 text-center">
            <PiggyBank className="mx-auto h-5 w-5 text-subtle" />
            <p className="mt-2 text-sm font-medium text-muted">No savings pots</p>
            <p className="mt-1 text-xs text-subtle">
              Add a goal when you want to track money toward a specific target.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savingsGoals.map((goal) => {
              const percent =
                goal.targetPence > 0
                  ? Math.min(100, Math.round((goal.currentPence / goal.targetPence) * 100))
                  : 100;
              const linkedAccount = accounts.find((account) => account.id === goal.accountId);
              const integrity = goalIntegrityById.get(goal.id);

              return (
                <article
                  key={goal.id}
                  className="mv-card rounded-2xl border border-muted bg-surface p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-main">{goal.name}</h3>
                      <span className="text-xs text-subtle">
                        Stored in {linkedAccount?.name || 'Account'}
                      </span>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-mono text-lg font-extrabold tracking-tight tabular-nums text-main">
                        {formatPence(goal.currentPence)}
                      </div>
                      <span className="mv-private-value text-[11px] text-subtle">
                        Target {formatPence(goal.targetPence)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-2 rounded-full bg-accent transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                    <span>{percent}% funded</span>
                    {goal.targetDate && <span>{goal.targetDate}</span>}
                  </div>
                  {integrity?.isOverallocated && (
                    <div className="mt-3 rounded-lg border border-danger bg-danger-soft px-3 py-2 text-[11px] leading-4 text-danger">
                      Recorded allocation exceeds the linked account balance by {formatPence(integrity.overallocatedPence)}.
                    </div>
                  )}

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
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL: Add Account */}
      {showAccModal && (
        <div className="mv-modal-backdrop">
          <div className="mv-modal-card mv-account-modal">
            <div className="mv-modal-header">
              <h3 className="text-base font-bold text-main">
                Add Account
              </h3>
              <button
                onClick={() => setShowAccModal(false)}
                className="mv-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAccountSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="mv-modal-scroll-body space-y-3">
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
                  autoFocus
                  type="text"
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="Account name"
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                />
              </div>

              <div className="mv-modal-grid-2">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Owner
                  </label>
                  <select
                    value={accOwnerMemberId}
                    onChange={(e) => setAccOwnerMemberId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                    required
                  >
                    <option value="" disabled>
                      Select owner
                    </option>
                    {ownerOptions.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name}
                      </option>
                    ))}
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

              </div>
              <div className="mv-modal-fixed-actions">
                <button
                  type="button"
                  onClick={() => setShowAccModal(false)}
                  className="mv-account-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mv-account-primary"
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
        <div className="mv-modal-backdrop">
          <div className="mv-modal-card mv-account-modal">
            <div className="mv-modal-header">
              <h3 className="text-base font-bold text-main">
                Edit {selectedAccount.name}
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="mv-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="mv-modal-scroll-body space-y-3">
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
                  autoFocus
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                />
              </div>

              <div className="mv-modal-grid-2">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Owner
                  </label>
                  <select
                    value={editOwnerMemberId}
                    onChange={(e) => setEditOwnerMemberId(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                    required
                  >
                    <option value="" disabled>
                      Select owner
                    </option>
                    {editOwnerOptions.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name}
                      </option>
                    ))}
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
                <label className="mv-account-toggle">
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

              </div>
              <div className="mv-modal-fixed-actions">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="mv-account-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mv-account-primary"
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
        <div className="mv-modal-backdrop">
          <div className="mv-modal-card">
            <div className="mv-modal-header">
              <h3 className="text-base font-bold text-main">
                Reconcile
              </h3>
              <button
                onClick={() => setShowReconcileModal(false)}
                className="mv-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReconcileSubmit} className="mv-modal-form">
              {error && (
                <div className="p-3 bg-danger-soft border border-danger rounded-xl text-danger text-xs">
                  {error}
                </div>
              )}

              <div className="mv-modal-grid-2">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">
                    Statement Date
                  </label>
                  <input
                    autoFocus
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
                      <span>{diffPence === 0 ? 'Match:' : 'Adjustment on confirm:'}</span>
                      <span
                        className={
                          diffPence === 0
                            ? 'text-success'
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

              <div className="mv-modal-actions">
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
        <div className="mv-modal-backdrop">
          <div className="mv-modal-card mv-modal-wide flex flex-col">
            <div className="mv-modal-header">
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
                className="mv-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mv-modal-body flex-1 overflow-y-auto space-y-1">
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

            <div className="mv-modal-actions px-3 pb-3">
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
        <div className="mv-modal-backdrop">
          <div className="mv-modal-card">
            <div className="mv-modal-header">
              <h3 className="text-base font-bold text-main">
                Create Savings Pot / Goal
              </h3>
              <button
                onClick={() => setShowGoalModal(false)}
                className="mv-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGoalSubmit} className="mv-modal-form">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Goal Name
                </label>
                <input
                  autoFocus
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

              <div className="mv-modal-grid-2">
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

              <div className="mv-modal-actions">
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
        <div className="mv-modal-backdrop">
          <div className="mv-modal-card">
            <div className="mv-modal-header">
              <h3 className="text-base font-bold text-main">Edit Savings Pot</h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditGoalModal(false);
                  setSelectedGoal(null);
                }}
                className="mv-modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditGoalSubmit} className="mv-modal-form">
              {error && (
                <div className="p-3 bg-danger-soft border border-danger rounded-xl text-danger text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted mb-1">Goal Name</label>
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

              <div className="mv-modal-grid-2">
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
