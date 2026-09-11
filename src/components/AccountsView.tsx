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
  formatPence,
  parseHumanPoundsToPence,
  parseToPence,
} from '../utils/currency';
import { localDateInputValue } from '../utils/dateInput';
import { accountIdentityLabel } from '../utils/accountDisplay';
import { useModalAccessibility } from '../utils/modalAccessibility';
import type { AccountPermanentDeleteEligibility } from '../utils/accountDeletion';
import { MoneyInput } from './MoneyInput';
import { ConfirmActionDialog } from './ConfirmActionDialog';

interface AccountsViewProps {
  accounts: Account[];
  savingsGoals: SavingsGoal[];
  transactions: Transaction[];
  members: HouseholdMember[];
  userRole: UserRole;
  onCreateAccount: (data: Partial<Account>) => Promise<void>;
  onUpdateAccount: (id: string, data: Partial<Account> & { reconciledBalancePence?: number }) => Promise<void>;
  onReconcileAccount: (id: string, reconciledBalancePence: number, reconciliationDate: string) => Promise<void>;
  accountDeleteEligibility: Record<string, AccountPermanentDeleteEligibility>;
  onArchiveAccount: (id: string) => Promise<void>;
  onReactivateAccount: (id: string) => Promise<void>;
  onPermanentDeleteAccount: (id: string) => Promise<void>;
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
  accountDeleteEligibility,
  onArchiveAccount,
  onReactivateAccount,
  onPermanentDeleteAccount,
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
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [showArchiveAccountModal, setShowArchiveAccountModal] = useState(false);

  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<Account | null>(null);
  const [archiveAccountTarget, setArchiveAccountTarget] = useState<Account | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
  const [pendingGoalDeletion, setPendingGoalDeletion] = useState<{
    goal: SavingsGoal;
    returnToEdit: boolean;
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  // New Account form state
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<AccountType | ''>('');
  const [accOwnerMemberId, setAccOwnerMemberId] = useState('');
  const [accBalanceStr, setAccBalanceStr] = useState('');
  const [accNotes, setAccNotes] = useState('');

  // Edit Account form state
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState<AccountType>('current');
  const [editOwnerMemberId, setEditOwnerMemberId] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Reconcile form state
  const [reconcileBalanceStr, setReconcileBalanceStr] = useState('');
  const [reconcileDate, setReconcileDate] = useState(localDateInputValue());

  // New Goal form state
  const [goalName, setGoalName] = useState('');
  const [goalTargetStr, setGoalTargetStr] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [goalMonthlyPlanStr, setGoalMonthlyPlanStr] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anyModalOpen =
    showAccModal ||
    showEditModal ||
    showReconcileModal ||
    showActivityModal ||
    showGoalModal ||
    showEditGoalModal ||
    showDeleteAccountModal ||
    showArchiveAccountModal;
  const closeActiveModal = () => {
    if (showArchiveAccountModal) {
      setShowArchiveAccountModal(false);
      setArchiveAccountTarget(null);
    } else if (showDeleteAccountModal) {
      setShowDeleteAccountModal(false);
      setDeleteAccountTarget(null);
    } else if (showActivityModal) setShowActivityModal(false);
    else if (showReconcileModal) setShowReconcileModal(false);
    else if (showEditGoalModal) {
      setShowEditGoalModal(false);
      setSelectedGoal(null);
    } else if (showGoalModal) setShowGoalModal(false);
    else if (showEditModal) {
      setShowEditModal(false);
      setSelectedAccount(null);
    } else if (showAccModal) setShowAccModal(false);
  };
  const dialogLabel = showArchiveAccountModal
    ? 'Archive account'
    : showDeleteAccountModal
    ? 'Permanently delete account'
    : showActivityModal
    ? 'Account activity'
    : showReconcileModal
    ? 'Reconcile account'
    : showEditGoalModal
    ? 'Edit savings goal'
    : showGoalModal
    ? 'Add savings goal'
    : showEditModal
    ? 'Edit account'
    : 'Add account';
  const dialogRef = useModalAccessibility<HTMLDivElement>(anyModalOpen, closeActiveModal);

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

  const displayedAccounts = useMemo(() => {
    return accounts.filter((a) => (showArchived ? true : a.isActive !== false));
  }, [accounts, showArchived]);

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

  const totalSavingsPence = useMemo(
    () =>
      accounts
        .filter(
          (account) =>
            account.isActive !== false &&
            (account.type === 'savings' || account.type === 'cash')
        )
        .reduce((sum, account) => sum + account.currentBalancePence, 0),
    [accounts]
  );

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) {
      setError('Enter an account name.');
      return;
    }
    if (!accOwnerMemberId) {
      setError('Choose the account owner.');
      return;
    }
    if (!accType) {
      setError('Choose the account type.');
      return;
    }
    const enteredPence = parseHumanPoundsToPence(accBalanceStr);
    if (enteredPence === null) {
      setError('Enter a valid starting balance in pounds and pence.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      const startingBalancePence =
        accType === 'credit' ? -Math.abs(enteredPence) : enteredPence;
      await onCreateAccount({
        name: accName.trim(),
        type: accType as AccountType,
        ownerMemberId: accOwnerMemberId,
        startingBalancePence,
        notes: accNotes.trim() || undefined,
      });
      setAccName('');
      setAccType('');
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
    setError(null);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    if (!editName.trim()) {
      setError('Enter an account name.');
      return;
    }
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
      });
      setShowEditModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to update account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReconcileModal = (acc: Account) => {
    setSelectedAccount(acc);
    const shownBalancePence =
      acc.type === 'credit'
        ? Math.max(0, -acc.currentBalancePence)
        : acc.currentBalancePence;
    setReconcileBalanceStr((shownBalancePence / 100).toFixed(2));
    setReconcileDate(acc.reconciliationDate || localDateInputValue());
    setError(null);
    setShowReconcileModal(true);
  };

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    if (!reconcileDate) {
      setError('Choose the statement date.');
      return;
    }
    const enteredPence = parseHumanPoundsToPence(reconcileBalanceStr);
    if (enteredPence === null) {
      setError('Enter a valid statement balance in pounds and pence.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      const reconciledBalancePence =
        selectedAccount.type === 'credit'
          ? -Math.abs(enteredPence)
          : enteredPence;
      await onReconcileAccount(
        selectedAccount.id,
        reconciledBalancePence,
        reconcileDate
      );
      setShowReconcileModal(false);
    } catch (err: any) {
      setError(err.message || 'Failed to reconcile balance');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openActivityModal = (acc: Account) => {
    setSelectedAccount(acc);
    setShowActivityModal(true);
  };

  const openArchiveDialog = (acc: Account) => {
    setArchiveAccountTarget(acc);
    setError(null);
    setShowArchiveAccountModal(true);
  };

  const handleArchiveConfirmed = async () => {
    if (!archiveAccountTarget || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onArchiveAccount(archiveAccountTarget.id);
      setShowArchiveAccountModal(false);
      setArchiveAccountTarget(null);
    } catch (err: any) {
      setError(err.message || 'Failed to archive account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivate = async (acc: Account) => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onReactivateAccount(acc.id);
    } catch (err: any) {
      setError(err.message || 'Failed to reactivate account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openPermanentDeleteDialog = (acc: Account) => {
    const eligibility = accountDeleteEligibility[acc.id];
    if (!eligibility?.canDeletePermanently) {
      setError('This account has financial history and must be archived.');
      return;
    }
    setError(null);
    setDeleteAccountTarget(acc);
    setShowDeleteAccountModal(true);
  };

  const handlePermanentDelete = async () => {
    if (!deleteAccountTarget || isSubmitting) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onPermanentDeleteAccount(deleteAccountTarget.id);
      setShowDeleteAccountModal(false);
      setDeleteAccountTarget(null);
    } catch (err: any) {
      setError(err.message || 'Permanent account deletion was blocked.');
      setShowDeleteAccountModal(false);
      setDeleteAccountTarget(null);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const requestDeleteGoal = (goal: SavingsGoal, returnToEdit = false) => {
    if (returnToEdit) setShowEditGoalModal(false);
    setError(null);
    setPendingGoalDeletion({ goal, returnToEdit });
  };

  const handleDeleteGoal = async (goal: SavingsGoal): Promise<boolean> => {
    try {
      setError(null);
      await onDeleteSavingsGoal(goal.id);
      if (selectedGoal?.id === goal.id) {
        setSelectedGoal(null);
        setShowEditGoalModal(false);
      }
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete savings pot');
      return false;
    }
  };

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
                Reconciled{' '}
                {acc.reconciliationDate
                  ? new Date(`${acc.reconciliationDate}T00:00:00`).toLocaleDateString('en-GB')
                  : new Date(acc.reconciledAt).toLocaleDateString('en-GB')}
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
                {isArchived ? (
                  <button
                    type="button"
                    onClick={() => handleReactivate(acc)}
                    disabled={isSubmitting}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-success bg-success-soft px-2.5 text-[11px] font-semibold text-success transition-all hover:opacity-80 active:scale-[0.97] disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reactivate
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => openArchiveDialog(acc)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-danger bg-danger-soft px-2.5 text-[11px] font-semibold text-danger transition-all hover:opacity-80 active:scale-[0.97]"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    Archive
                  </button>
                )}
                {accountDeleteEligibility[acc.id]?.canDeletePermanently && (
                  <button
                    type="button"
                    onClick={() => openPermanentDeleteDialog(acc)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-danger bg-danger-soft px-2.5 text-[11px] font-semibold text-danger transition-all hover:opacity-80 active:scale-[0.97]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete permanently
                  </button>
                )}
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
      <div>
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight text-main">Accounts</h1>

          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setAccName('');
                  setAccType('');
                  setAccOwnerMemberId('');
                  setAccBalanceStr('');
                  setAccNotes('');
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

      <section className="pt-1">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-main">Savings Goals</h2>
            <p className="mt-0.5 text-xs text-muted">
              Household targets based on all Savings + Cash balances.
            </p>
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => setShowGoalModal(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-muted bg-surface px-3.5 text-sm font-semibold text-main transition-all hover:bg-surface-muted active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 text-accent" />
              Add Goal
            </button>
          )}
        </div>

        {savingsGoals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-muted bg-surface-muted px-6 py-12 text-center">
            <PiggyBank className="mx-auto h-5 w-5 text-subtle" />
            <p className="mt-2 text-sm font-medium text-muted">No savings goals</p>
            <p className="mt-1 text-xs text-subtle">
              Add a target to track household savings progress.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {savingsGoals.map((goal) => {
              const rawPercent =
                goal.targetPence > 0 ? (totalSavingsPence / goal.targetPence) * 100 : 100;
              const percent = Math.round(rawPercent * 10) / 10;
              const progressBarPercent = Math.min(100, Math.max(0, rawPercent));
              const remainingPence = Math.max(0, goal.targetPence - totalSavingsPence);

              return (
                <article
                  key={goal.id}
                  className="mv-card rounded-2xl border border-muted bg-surface p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-bold text-main">{goal.name}</h3>
                      <span className="text-xs text-subtle">
                        Household savings goal
                      </span>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-mono text-lg font-extrabold tracking-tight tabular-nums text-main">
                        {formatPence(totalSavingsPence)}
                      </div>
                      <span className="mv-private-value text-[11px] text-subtle">
                        Target {formatPence(goal.targetPence)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-2 rounded-full bg-accent transition-all"
                      style={{ width: `${progressBarPercent}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                    <span>{percent}% complete</span>
                    {goal.targetDate && <span>{goal.targetDate}</span>}
                  </div>
                  <div className="mt-2 text-[11px] text-subtle">
                    {remainingPence > 0
                      ? `${formatPence(remainingPence)} remaining`
                      : 'Goal achieved'}
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
                        onClick={() => requestDeleteGoal(goal)}
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

      {showArchiveAccountModal && archiveAccountTarget && (
        <div className="mv-modal-backdrop">
          <div
            ref={dialogRef}
            className="mv-modal-card mv-account-modal"
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            tabIndex={-1}
          >
            <div className="mv-modal-header">
              <h3 className="text-base font-bold text-danger">Archive account</h3>
              <button
                type="button"
                onClick={() => {
                  setShowArchiveAccountModal(false);
                  setArchiveAccountTarget(null);
                }}
                className="mv-modal-close"
                aria-label="Cancel account archive"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mv-modal-body space-y-3">
              {error && (
                <div role="alert" className="p-3 bg-danger-soft border border-danger rounded-xl text-danger text-xs">
                  {error}
                </div>
              )}
              <p className="text-sm text-main">
                Archive this account? Existing financial history and references will be preserved.
              </p>

              <div className="rounded-lg border border-muted bg-surface-muted p-3">
                <div className="text-sm font-bold text-main">
                  {accountIdentityLabel(archiveAccountTarget)}
                </div>
                <div className="mt-1 text-xs text-muted">
                  {archiveAccountTarget.type === 'credit' ? 'Owed' : 'Balance'}{' '}
                  {formatPence(
                    archiveAccountTarget.type === 'credit'
                      ? archiveAccountTarget.currentBalancePence !== 0
                        ? Math.max(0, -archiveAccountTarget.currentBalancePence)
                        : (archiveAccountTarget.balanceOwedPence ?? 0)
                      : archiveAccountTarget.currentBalancePence
                  )}
                </div>
              </div>

              <p className="text-xs text-muted">
                Archived accounts are hidden from active lists and blocked from new financial activity until reactivated.
              </p>
            </div>

            <div className="mv-modal-fixed-actions">
              <button
                type="button"
                onClick={() => {
                  setShowArchiveAccountModal(false);
                  setArchiveAccountTarget(null);
                }}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-lg border border-muted bg-surface-muted px-4 text-sm font-semibold text-main transition-all hover:bg-surface disabled:opacity-50"
                data-modal-initial-focus
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleArchiveConfirmed}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-danger bg-danger-soft px-4 text-sm font-semibold text-danger transition-all hover:opacity-80 disabled:opacity-50"
              >
                <Archive className="h-4 w-4" />
                {isSubmitting ? 'Archiving…' : 'Archive account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteAccountModal && deleteAccountTarget && (
        <div className="mv-modal-backdrop">
          <div
            ref={dialogRef}
            className="mv-modal-card mv-account-modal"
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            tabIndex={-1}
          >
            <div className="mv-modal-header">
              <h3 className="text-base font-bold text-danger">Delete permanently</h3>
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteAccountTarget(null);
                }}
                className="mv-modal-close"
                aria-label="Cancel permanent account deletion"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mv-modal-body space-y-3">
              <p className="text-sm text-main">
                This permanently removes only this unused account record. It cannot be undone.
              </p>
              <div className="rounded-lg border border-muted bg-surface-muted p-3 text-sm text-main">
                <div className="font-bold">{deleteAccountTarget.name}</div>
                <div className="mt-1 text-xs text-muted">
                  {deleteAccountTarget.type} · {
                    deleteAccountTarget.ownerMemberId === JOINT_ACCOUNT_OWNER_ID
                      ? 'Joint'
                      : members.find((member) => member.id === deleteAccountTarget.ownerMemberId)?.name ||
                        deleteAccountTarget.ownerPerson ||
                        'Unassigned'
                  }
                </div>
              </div>
              {accountDeleteEligibility[deleteAccountTarget.id]?.isolatedSetupBalancePence !== 0 && (
                <p className="text-xs font-semibold text-warning">
                  This mistaken account still contains an isolated setup balance of{' '}
                  {formatPence(accountDeleteEligibility[deleteAccountTarget.id].isolatedSetupBalancePence)}.
                  Deleting the account will remove that setup balance because no linked financial evidence exists.
                </p>
              )}
              <p className="text-xs text-muted">
                Penny will re-check that the account still has no financial history or references immediately before deletion.
              </p>
            </div>

            <div className="mv-modal-fixed-actions">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAccountModal(false);
                  setDeleteAccountTarget(null);
                }}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center rounded-lg border border-muted bg-surface-muted px-4 text-sm font-semibold text-main transition-all hover:bg-surface disabled:opacity-50"
                data-modal-initial-focus
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                disabled={isSubmitting}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-danger bg-danger-soft px-4 text-sm font-semibold text-danger transition-all hover:opacity-80 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {isSubmitting ? 'Deleting…' : 'Delete permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAccModal && (
        <div className="mv-modal-backdrop">
          <div
            ref={dialogRef}
            className="mv-modal-card mv-account-modal"
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            tabIndex={-1}
          >
            <div className="mv-modal-header">
              <h3 className="text-base font-bold text-main">
                Add Account
              </h3>
              <button
                type="button"
                onClick={() => setShowAccModal(false)}
                className="mv-modal-close"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAccountSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="mv-modal-scroll-body space-y-3">
              {error && (
                <div role="alert" className="p-3 bg-danger-soft border border-danger rounded-xl text-danger text-xs">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="account-create-name" className="block text-xs font-semibold text-muted mb-1">
                  Account Name *
                </label>
                <input
                  id="account-create-name"
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
                  <label htmlFor="account-create-owner" className="block text-xs font-semibold text-muted mb-1">
                    Owner *
                  </label>
                  <select
                    id="account-create-owner"
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
                  <label htmlFor="account-create-type" className="block text-xs font-semibold text-muted mb-1">
                    Type *
                  </label>
                  <select
                    id="account-create-type"
                    value={accType}
                    onChange={(e) => setAccType(e.target.value as AccountType | '')}
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                    required
                  >
                    <option value="" disabled>Select account type</option>
                    <option value="current">Current Account</option>
                    <option value="savings">Savings Account</option>
                    <option value="cash">Cash</option>
                    <option value="credit">Credit Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="account-create-balance" className="block text-xs font-semibold text-muted mb-1">
                  {accType === 'credit' ? 'Starting balance owed (£) *' : 'Starting balance (£) *'}
                </label>
                <MoneyInput
                  id="account-create-balance"
                  type="text"
                  value={accBalanceStr}
                  onChange={(e) => setAccBalanceStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  inputMode="decimal"
                  aria-label={accType === 'credit' ? 'Starting balance owed in pounds sterling' : 'Starting balance in pounds sterling'}
                  required
                />
              </div>

              <div>
                <label htmlFor="account-create-notes" className="block text-xs font-semibold text-muted mb-1">
                  Notes
                </label>
                <textarea
                  id="account-create-notes"
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

      {showEditModal && selectedAccount && (
        <div className="mv-modal-backdrop">
          <div
            ref={dialogRef}
            className="mv-modal-card mv-account-modal"
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            tabIndex={-1}
          >
            <div className="mv-modal-header">
              <h3 className="text-base font-bold text-main">
                Edit {selectedAccount.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="mv-modal-close"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="mv-modal-scroll-body space-y-3">
              {error && (
                <div role="alert" className="p-3 bg-danger-soft border border-danger rounded-xl text-danger text-xs">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="account-edit-name" className="block text-xs font-semibold text-muted mb-1">
                  Account Name *
                </label>
                <input
                  id="account-edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                />
              </div>

              <div className="mv-modal-grid-2">
                <div>
                  <label htmlFor="account-edit-owner" className="block text-xs font-semibold text-muted mb-1">
                    Owner *
                  </label>
                  <select
                    id="account-edit-owner"
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
                  <label htmlFor="account-edit-type" className="block text-xs font-semibold text-muted mb-1">
                    Type *
                  </label>
                  <select
                    id="account-edit-type"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as AccountType)}
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                    required
                  >
                    <option value="current">Current Account</option>
                    <option value="savings">Savings Account</option>
                    <option value="cash">Cash</option>
                    <option value="credit">Credit Card</option>
                    {selectedAccount.type === 'joint' && (
                      <option value="joint">Joint Current (legacy)</option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <div className="block text-xs font-semibold text-muted mb-1">
                  Status
                </div>
                <div className="inline-flex items-center rounded-lg border border-muted bg-surface-muted px-3 py-2 text-xs font-semibold text-main">
                  {selectedAccount.isActive === false ? 'Archived' : 'Active'}
                </div>
              </div>

              <div>
                <label htmlFor="account-edit-notes" className="block text-xs font-semibold text-muted mb-1">
                  Notes
                </label>
                <textarea
                  id="account-edit-notes"
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

      {showReconcileModal && selectedAccount && (
        <div className="mv-modal-backdrop">
          <div
            ref={dialogRef}
            className="mv-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            tabIndex={-1}
          >
            <div className="mv-modal-header">
              <h3 className="text-base font-bold text-main">
                Reconcile
              </h3>
              <button
                type="button"
                onClick={() => setShowReconcileModal(false)}
                className="mv-modal-close"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReconcileSubmit} className="mv-modal-form">
              {error && (
                <div role="alert" className="p-3 bg-danger-soft border border-danger rounded-xl text-danger text-xs">
                  {error}
                </div>
              )}

              <div className="mv-modal-grid-2">
                <div>
                  <label htmlFor="account-reconcile-date" className="block text-xs font-semibold text-muted mb-1">
                    Statement Date *
                  </label>
                  <input
                    id="account-reconcile-date"
                    type="date"
                    value={reconcileDate}
                    onChange={(e) => setReconcileDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="account-reconcile-balance" className="block text-xs font-semibold text-muted mb-1">
                    {selectedAccount.type === 'credit' ? 'Statement balance owed (£) *' : 'Statement balance (£) *'}
                  </label>
                  <MoneyInput
                    id="account-reconcile-balance"
                    type="text"
                    value={reconcileBalanceStr}
                    onChange={(e) => setReconcileBalanceStr(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-sm text-main focus:ring-2 focus:ring-accent focus:outline-none"
                    inputMode="decimal"
                    aria-label={selectedAccount.type === 'credit' ? 'Statement balance owed in pounds sterling' : 'Statement balance in pounds sterling'}
                    required
                  />
                </div>
              </div>

              {(() => {
                const enteredPence = parseHumanPoundsToPence(reconcileBalanceStr);
                const currentShownPence =
                  selectedAccount.type === 'credit'
                    ? Math.max(0, -selectedAccount.currentBalancePence)
                    : selectedAccount.currentBalancePence;
                const targetShownPence =
                  enteredPence === null
                    ? null
                    : selectedAccount.type === 'credit'
                      ? Math.abs(enteredPence)
                      : enteredPence;
                const diffPence =
                  targetShownPence === null ? null : targetShownPence - currentShownPence;
                return (
                  <div className="p-3 bg-surface-muted rounded-xl border border-muted text-xs space-y-1.5">
                    <div className="flex justify-between text-muted text-subtle">
                      <span>{selectedAccount.type === 'credit' ? 'Current owed' : 'Current'}</span>
                      <span className="font-semibold text-main">
                        {formatPence(currentShownPence)}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted text-subtle">
                      <span>{selectedAccount.type === 'credit' ? 'Statement owed' : 'Statement'}</span>
                      <span className="font-semibold text-main">
                        {targetShownPence === null ? '—' : formatPence(targetShownPence)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-muted font-bold">
                      <span>
                        {diffPence === null
                          ? 'Match:'
                          : diffPence === 0
                            ? 'Match:'
                            : 'Adjustment on confirm:'}
                      </span>
                      <span
                        className={
                          diffPence === null
                            ? 'text-warning'
                            : diffPence === 0
                              ? 'text-success'
                              : 'text-warning'
                        }
                      >
                        {diffPence === null
                          ? 'Enter a valid balance'
                          : diffPence === 0
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

      {showActivityModal && selectedAccount && (
        <div className="mv-modal-backdrop">
          <div
            ref={dialogRef}
            className="mv-modal-card mv-modal-wide flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            tabIndex={-1}
          >
            <div className="mv-modal-header">
              <div>
                <h3 className="text-base font-bold text-main">
                  {accountIdentityLabel(selectedAccount)} Activity
                </h3>
                <p className="text-xs text-muted text-subtle">
                  {formatPence(selectedAccount.currentBalancePence)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowActivityModal(false)}
                className="mv-modal-close"
                aria-label="Close dialog"
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
                  const isTransfer = tx.type === 'transfer' && tx.isTransfer;
                  const isPositive = tx.type === 'income' || tx.type === 'refund' || tx.isRefund;
                  const isNegative = tx.type === 'expense' || tx.type === 'repayment';
                  const isIncomingTransfer =
                    isTransfer && tx.targetAccountId === selectedAccount.id;

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
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-soft text-accent font-medium">
                            {tx.payer}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted text-subtle mt-0.5">
                          {tx.date}
                        </div>
                      </div>

                      <div
                        className={`text-xs font-black ${
                          isPositive
                            ? 'text-success'
                            : isNegative
                              ? 'text-danger'
                              : 'text-main'
                        }`}
                      >
                        {isTransfer
                          ? isIncomingTransfer
                            ? '← '
                            : '→ '
                          : isPositive
                            ? '+'
                            : isNegative
                              ? '-'
                              : ''}
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

      {showGoalModal && (
        <div className="mv-modal-backdrop">
          <div
            ref={dialogRef}
            className="mv-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            tabIndex={-1}
          >
            <div className="mv-modal-header">
              <h3 className="text-base font-bold text-main">
                Create Savings Goal
              </h3>
              <button
                type="button"
                onClick={() => setShowGoalModal(false)}
                className="mv-modal-close"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGoalSubmit} className="mv-modal-form">
              <div>
                <label htmlFor="accounts-goal-create-name" className="block text-xs font-semibold text-muted mb-1">
                  Goal Name
                </label>
                <input
                  id="accounts-goal-create-name"
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
                <label htmlFor="accounts-goal-create-target" className="block text-xs font-semibold text-muted mb-1">
                  Target (£)
                </label>
                <MoneyInput
                  id="accounts-goal-create-target"
                  type="text"
                  value={goalTargetStr}
                  onChange={(e) => setGoalTargetStr(e.target.value)}
                  placeholder="20000.00"
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  inputMode="decimal"
                  aria-label="Savings goal target in pounds sterling"
                  required
                />
              </div>

              <div>
                <label htmlFor="accounts-goal-create-monthly-plan" className="block text-xs font-semibold text-muted mb-1">
                  Monthly Saving Plan (£) <span className="font-normal text-subtle">optional</span>
                </label>
                <MoneyInput
                  id="accounts-goal-create-monthly-plan"
                  type="text"
                  value={goalMonthlyPlanStr}
                  onChange={(e) => setGoalMonthlyPlanStr(e.target.value)}
                  placeholder="e.g. 500.00"
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  inputMode="decimal"
                  aria-label="Monthly savings plan in pounds sterling"
                />
              </div>

              <div>
                <label htmlFor="accounts-goal-create-date" className="block text-xs font-semibold text-muted mb-1">
                  Target Date (Optional)
                </label>
                <input
                  id="accounts-goal-create-date"
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
                  {isSubmitting ? 'Saving...' : 'Save Goal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditGoalModal && selectedGoal && (
        <div className="mv-modal-backdrop">
          <div
            ref={dialogRef}
            className="mv-modal-card"
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            tabIndex={-1}
          >
            <div className="mv-modal-header">
              <h3 className="text-base font-bold text-main">Edit Savings Goal</h3>
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
                <div className="mv-savings-warning-banner">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="accounts-goal-edit-name" className="block text-xs font-semibold text-muted mb-1">Goal Name</label>
                <input
                  id="accounts-goal-edit-name"
                  autoFocus
                  type="text"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="accounts-goal-edit-target" className="block text-xs font-semibold text-muted mb-1">Target (£)</label>
                <MoneyInput
                  id="accounts-goal-edit-target"
                  type="text"
                  value={goalTargetStr}
                  onChange={(e) => setGoalTargetStr(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  inputMode="decimal"
                  aria-label="Savings goal target in pounds sterling"
                  required
                />
              </div>

              <div>
                <label htmlFor="accounts-goal-edit-monthly-plan" className="block text-xs font-semibold text-muted mb-1">
                  Monthly Saving Plan (£) <span className="font-normal text-subtle">optional</span>
                </label>
                <MoneyInput
                  id="accounts-goal-edit-monthly-plan"
                  type="text"
                  value={goalMonthlyPlanStr}
                  onChange={(e) => setGoalMonthlyPlanStr(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                  placeholder="e.g. 500.00"
                  inputMode="decimal"
                  aria-label="Monthly savings plan in pounds sterling"
                />
              </div>

              <div>
                <label htmlFor="accounts-goal-edit-date" className="block text-xs font-semibold text-muted mb-1">Target Date</label>
                <input
                  id="accounts-goal-edit-date"
                  type="date"
                  value={goalDate}
                  onChange={(e) => setGoalDate(e.target.value)}
                  className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main focus:ring-2 focus:ring-accent focus:outline-none"
                />
              </div>

              <div className="mv-modal-actions justify-between">
                <button
                  type="button"
                  onClick={() => selectedGoal && requestDeleteGoal(selectedGoal, true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-danger bg-danger-soft px-4 py-2 text-xs font-semibold text-danger transition-all hover:opacity-80 active:scale-[0.98]"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Goal
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

      {pendingGoalDeletion && (
        <ConfirmActionDialog
          title="Delete savings goal?"
          description={
            <>
              Delete savings pot <strong>“{pendingGoalDeletion.goal.name}”</strong>? This removes
              the goal only and does not delete account transactions.
            </>
          }
          confirmLabel="Delete goal"
          busy={isSubmitting}
          error={error}
          onCancel={() => {
            const pending = pendingGoalDeletion;
            setPendingGoalDeletion(null);
            setError(null);
            if (pending.returnToEdit) {
              setSelectedGoal(pending.goal);
              setShowEditGoalModal(true);
            }
          }}
          onConfirm={async () => {
            if (isSubmitting) return;
            const pending = pendingGoalDeletion;
            if (!pending) return;
            setIsSubmitting(true);
            const deleted = await handleDeleteGoal(pending.goal);
            setIsSubmitting(false);
            if (deleted) setPendingGoalDeletion(null);
          }}
        />
      )}
    </div>
  );
};
