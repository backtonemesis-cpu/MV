import { createCategoryEligibility } from '../utils/categoryEligibility';
import type { CategoryGroup } from '../types';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  Edit2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type {
  Account,
  Category,
  PlannedIncome,
  Payer,
  HouseholdMember,
  Transaction,
  UserRole,
} from '../types';
import { formatPence, parseToPence } from '../utils/currency';
import { householdPersonOptions } from '../utils/householdPeople';
import { accountIdentityLabel, accountOptionLabel } from '../utils/accountDisplay';
import { localDateInputValue } from '../utils/dateInput';
import { MonthPicker } from './MonthPicker';
import { useModalAccessibility } from '../utils/modalAccessibility';
import { MoneyInput } from './MoneyInput';
import { ConfirmActionDialog } from './ConfirmActionDialog';

interface IncomeViewProps {
  incomes: PlannedIncome[];
  accounts: Account[];
  categories: Category[];
  categoryGroups: CategoryGroup[];
  transactions: Transaction[];
  members: HouseholdMember[];
  selectedMonth: string;
  userRole: UserRole;
  onSelectMonth: (month: string) => void;
  onCreateIncome: (data: Partial<PlannedIncome>) => Promise<void>;
  onUpdateIncome: (id: string, data: Partial<PlannedIncome>) => Promise<void>;
  onDeleteIncome: (id: string) => Promise<void>;
  onMarkIncomeReceived: (
    id: string,
    payload: { actualAmountPence?: number; actualDate?: string; accountId?: string }
  ) => Promise<void>;
}

function incomeMonthLabel(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${month}-01T12:00:00`));
}

export const IncomeView: React.FC<IncomeViewProps> = ({
  incomes,
  accounts,
  categories,
  categoryGroups,
  transactions,
  members,
  selectedMonth,
  userRole,
  onSelectMonth,
  onCreateIncome,
  onUpdateIncome,
  onDeleteIncome,
  onMarkIncomeReceived,
}) => {
  const canEdit = userRole === 'owner' || userRole === 'editor';

  const [showEditModal, setShowEditModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState<PlannedIncome | null>(null);
  const [pendingIncomeDeletion, setPendingIncomeDeletion] = useState<PlannedIncome | null>(null);

  const [name, setName] = useState('');
  const [expectedAmount, setExpectedAmount] = useState('');
  const [sourcePerson, setSourcePerson] = useState<Payer | ''>('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [actualAmount, setActualAmount] = useState('');
  const [actualDate, setActualDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anyModalOpen = showEditModal || showReceiveModal;
  const closeActiveModal = () => {
    if (showReceiveModal) {
      setShowReceiveModal(false);
      setSelectedIncome(null);
    } else if (showEditModal) {
      setShowEditModal(false);
      setSelectedIncome(null);
    }
  };
  const dialogLabel = showReceiveModal ? 'Record income received' : 'Edit expected income';
  const dialogRef = useModalAccessibility<HTMLDivElement>(anyModalOpen, closeActiveModal);

  const personOptions = useMemo(
    () => householdPersonOptions(members, sourcePerson ? [sourcePerson] : []),
    [members, sourcePerson]
  );

  const incomeCategories = useMemo(
    () =>
      createCategoryEligibility(categoryGroups).getTransactionCategoryOptions(
        categories,
        'income',
        selectedIncome?.categoryId ? [selectedIncome.categoryId] : []
      ),
    [categories, categoryGroups, selectedIncome]
  );

  const monthIncomes = useMemo(
    () =>
      incomes
        .filter((income) => income.month === selectedMonth)
        .sort((a, b) => (a.expectedDate || '').localeCompare(b.expectedDate || '')),
    [incomes, selectedMonth]
  );

  const monthExpectedPence = useMemo(
    () => monthIncomes.reduce((sum, income) => sum + income.expectedAmountPence, 0),
    [monthIncomes]
  );

  const monthReceivedPence = useMemo(
    () =>
      monthIncomes.reduce(
        (sum, income) => sum + (income.actualAmountPence ?? 0),
        0
      ),
    [monthIncomes]
  );

  const monthOutstandingPence = Math.max(0, monthExpectedPence - monthReceivedPence);

  const monthFullyReceivedCount = useMemo(
    () => monthIncomes.filter((income) => income.status === 'received').length,
    [monthIncomes]
  );

  const monthRemainingCount = Math.max(0, monthIncomes.length - monthFullyReceivedCount);
  const visibleMonthLabel = incomeMonthLabel(selectedMonth);

  const incomeDateGroups = useMemo(() => {
    const groups = new Map<string, PlannedIncome[]>();

    for (const income of monthIncomes) {
      const key = income.expectedDate || 'date-tbc';
      const existing = groups.get(key) || [];
      existing.push(income);
      groups.set(key, existing);
    }

    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      label:
        date === 'date-tbc'
          ? 'DATE TBC'
          : new Intl.DateTimeFormat('en-GB', {
              day: '2-digit',
              month: 'long',
            })
              .format(new Date(`${date}T12:00:00`))
              .toUpperCase(),
      items,
    }));
  }, [monthIncomes]);

  const linkedTransactionFor = (income: PlannedIncome) => {
    const linkedId = income.actualTransactionId || income.linkedTransactionId;
    return linkedId ? transactions.find((tx) => tx.id === linkedId) : undefined;
  };

  const resetForm = () => {
    setSelectedIncome(null);
    setName('');
    setExpectedAmount('');
    setSourcePerson('');
    setAccountId('');
    setCategoryId('');
    setExpectedDate('');
    setActualAmount('');
    setActualDate('');
    setNotes('');
    setError(null);
  };

  const openCreate = () => {
    resetForm();
    setShowEditModal(true);
  };

  const openEdit = (income: PlannedIncome) => {
    const linkedTx = linkedTransactionFor(income);
    setSelectedIncome(income);
    setName(income.name);
    setExpectedAmount((income.expectedAmountPence / 100).toFixed(2));
    setSourcePerson(income.sourcePerson);
    setAccountId(income.accountId);
    setCategoryId(income.categoryId || linkedTx?.categoryId || '');
    setExpectedDate(income.expectedDate || '');
    setActualAmount(
      income.actualAmountPence !== undefined
        ? (income.actualAmountPence / 100).toFixed(2)
        : linkedTx
        ? (linkedTx.amountPence / 100).toFixed(2)
        : ''
    );
    setActualDate(income.actualDate || income.receivedDate || linkedTx?.date || '');
    setNotes(income.notes || '');
    setError(null);
    setShowEditModal(true);
  };

  const openReceive = (income: PlannedIncome) => {
    setSelectedIncome(income);
    const remainingPence = Math.max(
      0,
      income.expectedAmountPence - (income.actualAmountPence ?? 0)
    );
    setActualAmount(remainingPence > 0 ? (remainingPence / 100).toFixed(2) : '');
    setActualDate(localDateInputValue());
    const plannedAccount = accounts.find(
      (account) => account.id === income.accountId && account.isActive !== false
    );
    setAccountId(plannedAccount?.id || '');
    setError(null);
    setShowReceiveModal(true);
  };

  const saveIncome = async (event: React.FormEvent) => {
    event.preventDefault();
    const expectedAmountPence = parseToPence(expectedAmount);
    if (!name.trim()) {
      setError('Income name is required.');
      return;
    }
    if (expectedAmountPence < 0) {
      setError('Expected income must not be negative.');
      return;
    }
    if (!sourcePerson) {
      setError('Choose who receives this income.');
      return;
    }
    if (!accountId) {
      setError('Choose the receiving account.');
      return;
    }

    if (
      !createCategoryEligibility(categoryGroups).isTransactionCategorySelectionAllowed(
        categories,
        'income',
        categoryId,
        selectedIncome?.categoryId ? [selectedIncome.categoryId] : []
      )
    ) {
      setError('Choose an income category.');
      return;
    }

    const payload: Partial<PlannedIncome> = {
      name: name.trim(),
      expectedAmountPence,
      month: selectedIncome?.month || selectedMonth,
      sourcePerson: sourcePerson as Payer,
      accountId,
      categoryId,
      expectedDate: expectedDate || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      setIsSubmitting(true);
      setError(null);
      if (selectedIncome) {
        await onUpdateIncome(selectedIncome.id, payload);
      } else {
        await onCreateIncome(payload);
      }
      setShowEditModal(false);
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save income.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const markReceived = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedIncome) return;
    const actualAmountPence = parseToPence(actualAmount);
    if (actualAmountPence <= 0) {
      setError('Enter the amount actually received.');
      return;
    }
    if (!actualDate) {
      setError('Choose the received date.');
      return;
    }
    if (!accountId) {
      setError('Choose the account that received the income.');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      await onMarkIncomeReceived(selectedIncome.id, {
        actualAmountPence,
        actualDate: actualDate || undefined,
        accountId,
      });
      setShowReceiveModal(false);
      setSelectedIncome(null);
    } catch (err: any) {
      setError(err.message || 'Failed to record received income.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestRemoveIncome = (income: PlannedIncome) => {
    if (income.actualTransactionId || income.linkedTransactionId) return;
    setError(null);
    setPendingIncomeDeletion(income);
  };

  const removeIncome = async (income: PlannedIncome): Promise<boolean> => {
    if (income.actualTransactionId || income.linkedTransactionId) return false;

    try {
      setError(null);
      await onDeleteIncome(income.id);
      return true;
    } catch (err: any) {
      setError(err.message || 'Failed to delete income.');
      return false;
    }
  };

  const inputClassName =
    'w-full h-11 rounded-xl border border-muted bg-surface-muted px-3.5 text-sm text-main focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-all';

  return (
    <div className="finance-workspace space-y-5 pb-16">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-[24px] font-bold leading-8 tracking-tight text-main">Income & Wages</h1>

        <div className="flex items-center gap-2">
          <MonthPicker
            value={selectedMonth}
            onChange={onSelectMonth}
            ariaLabel="Income month"
          />

          {canEdit && (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent transition-all hover:brightness-95 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Add Income
            </button>
          )}
        </div>
      </header>

      <section
        className="mv-income-summary-grid grid grid-cols-3 gap-2 sm:grid-cols-3"
        aria-label="Income summary"
      >
        <article className="finance-summary-card p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Expected
          </span>
          <div className="mt-2 font-mono text-[18px] font-semibold leading-6 tabular-nums text-main">
            {formatPence(monthExpectedPence)}
          </div>
          <p className="mt-1 text-[11px] font-normal text-subtle">
            {monthIncomes.length} source{monthIncomes.length === 1 ? '' : 's'}
          </p>
        </article>

        <article className="finance-summary-card p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Received
          </span>
          <div className="finance-semantic-positive mt-2 font-mono text-[18px] font-semibold leading-6 tabular-nums">
            {formatPence(monthReceivedPence)}
          </div>
          <p className="mt-1 text-[11px] font-normal text-subtle">
            {monthFullyReceivedCount}/{monthIncomes.length} received
          </p>
        </article>

        <article className="finance-summary-card p-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Outstanding
          </span>
          <div className="finance-semantic-negative mt-2 font-mono text-[18px] font-semibold leading-6 tabular-nums">
            {formatPence(monthOutstandingPence)}
          </div>
          <p className="mt-1 text-[11px] font-normal text-subtle">
            {monthRemainingCount} remaining
          </p>
        </article>
      </section>

      <section
        className="finance-panel p-3 sm:p-4"
        aria-labelledby="income-schedule-title"
      >
        <header className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
              Income schedule
            </div>
            <h2
              id="income-schedule-title"
              className="mt-0.5 text-[14px] font-semibold text-main"
            >
              {visibleMonthLabel} · {monthIncomes.length} source{monthIncomes.length === 1 ? '' : 's'}
            </h2>
          </div>
        </header>

        {monthIncomes.length === 0 ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-muted bg-surface-muted p-8 text-center">
            <Banknote className="h-5 w-5 text-subtle" />
            <p className="mt-2 text-sm font-medium text-muted">No income sources for {visibleMonthLabel}</p>
            {canEdit && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-muted bg-surface px-3 text-xs font-semibold text-main transition-colors hover:bg-surface-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Income
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {incomeDateGroups.map((group) => (
              <div key={group.date} className="space-y-2">
                <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                  {group.label}
                </div>
                <div className="space-y-2">
                  {group.items.map((income) => {
                    const linkedTx = linkedTransactionFor(income);
                    const received = income.status === 'received';
                    const account = accounts.find((item) => item.id === income.accountId);
                    return (
                      <article key={income.id} className="finance-row flex items-center gap-3 p-3">
                        <div className="finance-leading-icon">
                          {received ? (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          ) : (
                            <Banknote className="h-4 w-4" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <h3 className="truncate text-[13px] font-semibold text-main">{income.name}</h3>
                            <span className={received ? 'finance-status-positive' : 'finance-status-neutral'}>
                              {received ? 'Received' : 'Expected'}
                            </span>
                          </div>
                          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-subtle">
                            <span>{income.sourcePerson}</span>
                            <span>•</span>
                            <span className="truncate">{account ? accountIdentityLabel(account) : 'Account unavailable'}</span>
                            {linkedTx && (
                              <>
                                <span>•</span>
                                <span>Recorded {new Intl.DateTimeFormat('en-GB').format(new Date(`${linkedTx.date}T12:00:00`))}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <div className="text-right">
                            <div className="font-mono text-sm font-semibold tabular-nums text-main">
                              {formatPence(received ? income.actualAmountPence ?? income.expectedAmountPence : income.expectedAmountPence)}
                            </div>
                            {!received && income.expectedDate && (
                              <div className="mt-0.5 text-[10px] text-subtle">
                                {new Intl.DateTimeFormat('en-GB').format(new Date(`${income.expectedDate}T12:00:00`))}
                              </div>
                            )}
                          </div>

                          {canEdit && (
                            <div className="finance-row-actions flex items-center gap-1">
                              {!received && (
                                <button
                                  type="button"
                                  onClick={() => openReceive(income)}
                                  className="finance-receive-button"
                                  aria-label={`Record ${income.name} received`}
                                >
                                  Received
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEdit(income)}
                                className="finance-action-button"
                                aria-label={`Edit ${income.name}`}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              {!income.actualTransactionId && !income.linkedTransactionId && (
                                <button
                                  type="button"
                                  onClick={() => requestRemoveIncome(income)}
                                  className="finance-action-button is-danger"
                                  aria-label={`Delete ${income.name}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {anyModalOpen && (
        <div className="mv-modal-backdrop">
          <div
            ref={dialogRef}
            className="mv-modal-card mv-income-modal"
            role="dialog"
            aria-modal="true"
            aria-label={dialogLabel}
            tabIndex={-1}
          >
            <div className="mv-modal-header">
              <h2>{dialogLabel}</h2>
              <button type="button" onClick={closeActiveModal} className="mv-modal-close" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            {showEditModal && (
              <form onSubmit={saveIncome} className="mv-modal-form">
                {error && <div className="mv-modal-error" role="alert">{error}</div>}

                <label>
                  Income name
                  <input value={name} onChange={(event) => setName(event.target.value)} className={inputClassName} />
                </label>

                <label>
                  Expected amount
                  <MoneyInput
                    value={expectedAmount}
                    onChange={(event) => setExpectedAmount(event.target.value)}
                    className={inputClassName}
                    type="text"
                    inputMode="decimal"
                    aria-label="Expected amount"
                  />
                </label>

                <label>
                  Received by
                  <select
                    value={sourcePerson}
                    onChange={(event) => setSourcePerson(event.target.value as Payer)}
                    className={inputClassName}
                    required
                  >
                    <option value="">Choose person</option>
                    {personOptions.map((person) => (
                      <option key={person.value} value={person.value}>{person.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Account
                  <select
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                    className={inputClassName}
                    required
                  >
                    <option value="">Choose account</option>
                    {accounts.filter((account) => account.isActive !== false).map((account) => (
                      <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Category
                  <select
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className={inputClassName}
                    required
                  >
                    <option value="">Choose category</option>
                    {incomeCategories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Expected date
                  <input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} className={inputClassName} />
                </label>

                <label>
                  Notes
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClassName} rows={3} />
                </label>

                <div className="mv-modal-actions">
                  <button type="button" onClick={closeActiveModal}>Cancel</button>
                  <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Save'}</button>
                </div>
              </form>
            )}

            {showReceiveModal && selectedIncome && (
              <form onSubmit={markReceived} className="mv-modal-form">
                {error && <div className="mv-modal-error" role="alert">{error}</div>}

                <label>
                  Amount received
                  <MoneyInput
                    value={actualAmount}
                    onChange={(event) => setActualAmount(event.target.value)}
                    className={inputClassName}
                    type="text"
                    inputMode="decimal"
                    aria-label="Amount received"
                  />
                </label>

                <label>
                  Received date
                  <input type="date" value={actualDate} onChange={(event) => setActualDate(event.target.value)} className={inputClassName} required />
                </label>

                <label>
                  Receiving account
                  <select
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                    className={inputClassName}
                    required
                  >
                    <option value="">Choose account</option>
                    {accounts.filter((account) => account.isActive !== false).map((account) => (
                      <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>
                    ))}
                  </select>
                </label>

                <div className="mv-modal-actions">
                  <button type="button" onClick={closeActiveModal}>Cancel</button>
                  <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : 'Record received'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <ConfirmActionDialog
        isOpen={Boolean(pendingIncomeDeletion)}
        title="Delete expected income?"
        message={pendingIncomeDeletion ? `Delete ${pendingIncomeDeletion.name}?` : ''}
        confirmLabel="Delete income"
        tone="danger"
        onCancel={() => setPendingIncomeDeletion(null)}
        onConfirm={async () => {
          if (!pendingIncomeDeletion) return false;
          const removed = await removeIncome(pendingIncomeDeletion);
          if (removed) setPendingIncomeDeletion(null);
          return removed;
        }}
      />
    </div>
  );
};
