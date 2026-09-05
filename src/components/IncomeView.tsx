import React, { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Edit2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { JOINT_ACCOUNT_OWNER_ID } from '../types';
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
import { accountOptionLabel } from '../utils/accountDisplay';
import { MonthPicker } from './MonthPicker';

interface IncomeViewProps {
  incomes: PlannedIncome[];
  accounts: Account[];
  categories: Category[];
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

export const IncomeView: React.FC<IncomeViewProps> = ({
  incomes,
  accounts,
  categories,
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

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      if (showReceiveModal) {
        setShowReceiveModal(false);
        setSelectedIncome(null);
      } else if (showEditModal) {
        setShowEditModal(false);
        setSelectedIncome(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showEditModal, showReceiveModal]);

  const personOptions = useMemo(
    () => householdPersonOptions(members, sourcePerson ? [sourcePerson] : []),
    [members, sourcePerson]
  );

  const incomeCategories = useMemo(
    () => categories.filter((category) => category.group === 'Income'),
    [categories]
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
    () =>
      monthIncomes.filter(
        (income) =>
          Boolean(income.actualTransactionId || income.linkedTransactionId) ||
          income.status === 'received'
      ).length,
    [monthIncomes]
  );

  const monthRemainingCount = Math.max(0, monthIncomes.length - monthFullyReceivedCount);

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
    setActualAmount('');
    setActualDate('');
    setAccountId('');
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

    const payload: Partial<PlannedIncome> = {
      name: name.trim(),
      expectedAmountPence,
      month: selectedIncome?.month || selectedMonth,
      sourcePerson: sourcePerson as Payer,
      accountId,
      categoryId: categoryId || undefined,
      expectedDate: expectedDate || undefined,
      notes: notes.trim() || undefined,
    };

    if (selectedIncome?.actualTransactionId || selectedIncome?.linkedTransactionId) {
      payload.actualAmountPence = parseToPence(actualAmount);
      payload.actualDate = actualDate || undefined;
      payload.receivedDate = actualDate || undefined;
      payload.status =
        payload.actualAmountPence < expectedAmountPence ? 'partial' : 'received';
    }

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

  const removeIncome = async (income: PlannedIncome) => {
    if (income.actualTransactionId || income.linkedTransactionId) return;
    if (!window.confirm(`Delete expected income "${income.name}"?`)) return;

    try {
      setError(null);
      await onDeleteIncome(income.id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete income.');
    }
  };

  const inputClassName =
    'w-full h-11 rounded-xl border border-muted bg-surface-muted px-3.5 text-sm text-main focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-all';

  return (
    <div className="finance-workspace space-y-5 pb-16">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold leading-8 tracking-tight text-main">Income & Wages</h1>
          <p className="mt-0.5 text-[12px] font-normal text-subtle">
            Expected and received household income for the active month.
          </p>
        </div>

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
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
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
            {monthIncomes.length} income source{monthIncomes.length === 1 ? '' : 's'}
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
            {monthFullyReceivedCount} of {monthIncomes.length} received
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
            {monthRemainingCount} payment{monthRemainingCount === 1 ? '' : 's'} remaining
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
              {selectedMonth} · {monthIncomes.length} source{monthIncomes.length === 1 ? '' : 's'}
            </h2>
          </div>
        </header>

        {monthIncomes.length === 0 ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed border-muted bg-surface-muted p-8 text-center">
            <Banknote className="h-5 w-5 text-subtle" />
            <p className="mt-2 text-sm font-medium text-muted">No income sources for {selectedMonth}</p>
            {canEdit && (
              <button
                type="button"
                onClick={openCreate}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-muted bg-surface px-3 text-xs font-semibold text-main transition-colors hover:bg-surface-muted"
              >
                <Plus className="h-3.5 w-3.5 text-accent" />
                Add income
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {incomeDateGroups.map((group) => (
              <div key={group.date}>
                <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                  {group.label}
                </div>

                <div className="mt-2 space-y-px">
                  {group.items.map((income) => {
                    const linkedTx = linkedTransactionFor(income);
                    const received =
                      Boolean(income.actualTransactionId || income.linkedTransactionId) ||
                      income.status === 'received' ||
                      income.status === 'partial';
                    const categoryName =
                      categories.find(
                        (category) => category.id === (income.categoryId || linkedTx?.categoryId)
                      )?.name || 'Income';
                    const targetAccount = accounts.find((account) => account.id === income.accountId);
                    const targetOwnerName = targetAccount
                      ? targetAccount.ownerMemberId === JOINT_ACCOUNT_OWNER_ID
                        ? 'Joint'
                        : members.find((member) => member.id === targetAccount.ownerMemberId)?.name ||
                          targetAccount.ownerPerson
                      : undefined;
                    const accountName = targetAccount
                      ? `${targetAccount.name}${targetOwnerName ? ` (${targetOwnerName})` : ''}`
                      : 'Account';
                    const statusLabel =
                      income.status === 'partial' ? 'Partial' : received ? 'Received' : 'Expected';
                    const statusClassName =
                      income.status === 'partial'
                        ? 'finance-status-neutral'
                        : received
                        ? 'finance-status-positive'
                        : 'finance-status-accent';
                    const shownAmountPence =
                      income.actualAmountPence ?? linkedTx?.amountPence ?? income.expectedAmountPence;
                    const showExpectedComparison =
                      received && shownAmountPence !== income.expectedAmountPence;

                    return (
                      <article
                        key={income.id}
                        tabIndex={canEdit ? 0 : undefined}
                        onClick={(event) => {
                          if (!canEdit) return;
                          if ((event.target as HTMLElement).closest('button, input, a, select, textarea')) return;
                          openEdit(income);
                        }}
                        onKeyDown={(event) => {
                          if (!canEdit || event.target !== event.currentTarget) return;
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            openEdit(income);
                          }
                        }}
                        className={`finance-row finance-ledger-row group ${canEdit ? 'is-clickable' : ''}`}
                      >
                        <div className="finance-row-left">
                          <div className="finance-leading-icon">
                            <Banknote className="h-4 w-4" aria-hidden="true" />
                          </div>

                          <div className="finance-row-copy">
                            <div className="finance-row-titleline">
                              <h3 className="finance-row-title" title={income.name}>
                                {income.name}
                              </h3>

                              <span
                                className={`${statusClassName} finance-income-status`}
                              >
                                {statusLabel}
                              </span>
                            </div>

                            <div className="finance-metadata-line">
                              <span className="finance-metadata-token">{income.sourcePerson}</span>
                              <span className="finance-metadata-separator text-subtle" aria-hidden="true">·</span>
                              <span className="finance-metadata-token">{categoryName}</span>
                              <span className="finance-metadata-separator text-subtle" aria-hidden="true">·</span>
                              <span className="finance-metadata-token is-account">{accountName}</span>
                            </div>

                          </div>
                        </div>

                        <div className="finance-row-side">
                          <div className="finance-amount-block">
                            <div className="finance-amount is-positive">
                              {formatPence(shownAmountPence)}
                            </div>
                            <div
                              className={`finance-amount-detail ${showExpectedComparison ? '' : 'is-placeholder'}`}
                            >
                              {showExpectedComparison
                                ? `Expected ${formatPence(income.expectedAmountPence)}`
                                : 'Expected —'}
                            </div>
                          </div>

                          {canEdit && (
                            <div className="flex items-center gap-1">
                              {!received && (
                                <button
                                  type="button"
                                  onClick={(event) => { event.stopPropagation(); openReceive(income); }}
                                  className="finance-receive-button"
                                  title="Mark received"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Receive
                                </button>
                              )}

                              <div className="finance-row-actions flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(event) => { event.stopPropagation(); openEdit(income); }}
                                  className="finance-action-button"
                                  title="Edit income"
                                  aria-label={`Edit ${income.name}`}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>

                                {!received && (
                                  <button
                                    type="button"
                                    onClick={(event) => { event.stopPropagation(); removeIncome(income); }}
                                    className="finance-action-button is-danger"
                                    title="Delete expected income"
                                    aria-label={`Delete ${income.name}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
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

      {showEditModal && (
        <div className="mv-modal-backdrop">
          <div className="mv-modal-card mv-income-modal">
            <header className="mv-modal-header">
              <h2 className="text-base font-bold text-main">
                {selectedIncome ? 'Edit Income' : 'Add Income'}
              </h2>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="mv-modal-close"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <form onSubmit={saveIncome} className="flex min-h-0 flex-1 flex-col">
              <div className="mv-modal-scroll-body space-y-3">
              {error && (
                <div className="rounded-xl border border-danger bg-danger-soft p-3 text-xs text-danger">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Income source</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Marius salary"
                  className={inputClassName}
                  required
                />
              </div>

              <div className="mv-modal-grid-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">Expected amount (£)</label>
                  <input
                    value={expectedAmount}
                    onChange={(event) => setExpectedAmount(event.target.value)}
                    className={inputClassName}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">Expected date</label>
                  <input
                    type="date"
                    value={expectedDate}
                    onChange={(event) => setExpectedDate(event.target.value)}
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">Received by</label>
                  <select
                    value={sourcePerson}
                    onChange={(event) => setSourcePerson(event.target.value as Payer | '')}
                    className={inputClassName}
                    required
                  >
                    <option value="">Select person</option>
                    {personOptions.map((person) => (
                      <option key={person} value={person}>
                        {person}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">Account</label>
                  <select
                    value={accountId}
                    onChange={(event) => setAccountId(event.target.value)}
                    className={inputClassName}
                    required
                  >
                    <option value="">Select receiving account</option>
                    {accounts
                      .filter((account) => account.isActive !== false)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {accountOptionLabel(account)}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-muted">Category</label>
                  <select
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className={inputClassName}
                  >
                    <option value="">Select category (optional)</option>
                    {incomeCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedIncome &&
                (selectedIncome.actualTransactionId || selectedIncome.linkedTransactionId) && (
                  <div className="mv-modal-section">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
                      Received amount
                    </div>
                    <div className="mv-modal-grid-2">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted">Actual amount (£)</label>
                        <input
                          value={actualAmount}
                          onChange={(event) => setActualAmount(event.target.value)}
                          className={inputClassName}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted">Actual date</label>
                        <input
                          type="date"
                          value={actualDate}
                          onChange={(event) => setActualDate(event.target.value)}
                          className={inputClassName}
                        />
                      </div>
                    </div>
                  </div>
                )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Notes</label>
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className={inputClassName}
                  placeholder="Optional"
                />
              </div>

              </div>

              <div className="mv-modal-fixed-actions">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="mv-income-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mv-income-primary"
                >
                  {isSubmitting ? 'Saving...' : selectedIncome ? 'Save Changes' : 'Add Income'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReceiveModal && selectedIncome && (
        <div className="mv-modal-backdrop">
          <div className="mv-modal-card mv-income-modal">
            <div className="mv-modal-header">
              <div>
                <h2 className="text-base font-bold text-main">Record Income Received</h2>
                <p className="mt-0.5 text-xs text-muted">{selectedIncome.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="mv-modal-close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={markReceived} className="flex min-h-0 flex-1 flex-col">
              <div className="mv-modal-scroll-body space-y-3">
              {error && (
                <div className="rounded-xl border border-danger bg-danger-soft p-3 text-xs text-danger">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Actual amount (£)</label>
                <input
                  autoFocus
                  value={actualAmount}
                  onChange={(event) => setActualAmount(event.target.value)}
                  className={inputClassName}
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Received date</label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                  <input
                    type="date"
                    value={actualDate}
                    onChange={(event) => setActualDate(event.target.value)}
                    className={`${inputClassName} pl-10`}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Receiving account</label>
                <select
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  className={inputClassName}
                  required
                >
                  <option value="">Select receiving account</option>
                  {accounts
                    .filter((account) => account.isActive !== false)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {accountOptionLabel(account)}
                      </option>
                    ))}
                </select>
              </div>

              </div>

              <div className="mv-modal-fixed-actions">
                <button
                  type="button"
                  onClick={() => setShowReceiveModal(false)}
                  className="mv-income-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mv-income-primary inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isSubmitting ? 'Recording...' : 'Record Received'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
