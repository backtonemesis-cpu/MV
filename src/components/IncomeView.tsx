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
import { formatMonthKeyUk, localDateInputValue } from '../utils/dateInput';
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
    () => createCategoryEligibility(categoryGroups).getTransactionCategoryOptions(categories, 'income', selectedIncome?.categoryId ? [selectedIncome.categoryId] : []),
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
  const visibleMonthLabel = formatMonthKeyUk(selectedMonth);

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
    setActualAmount(
      remainingPence > 0 ? (remainingPence / 100).toFixed(2) : ''
    );
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

    if (!createCategoryEligibility(categoryGroups).isTransactionCategorySelectionAllowed(categories, 'income', categoryId, selectedIncome?.categoryId ? [selectedIncome.categoryId] : [])) {
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
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-muted bg-surface px-3 text-xs font-semibold text-main hover:bg-surface-muted"
              >
                <Plus className="h-3.5 w-3.5" />
                Add income
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {incomeDateGroups.map((group) => (
              <div key={group.date}>
                <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-subtle">
                  {group.label}
                </div>
                <div className="overflow-hidden rounded-lg border border-muted bg-table">
                  <div className="divide-y divide-muted">
                    {group.items.map((income) => {
                      const linkedTx = linkedTransactionFor(income);
                      const category = categories.find((candidate) => candidate.id === income.categoryId);
                      const account = accounts.find((candidate) => candidate.id === income.accountId);
                      const receivedPence = income.actualAmountPence ?? 0;
                      const remainingPence = Math.max(0, income.expectedAmountPence - receivedPence);
                      const isFullyReceived = income.status === 'received';
                      const isPartReceived = receivedPence > 0 && !isFullyReceived;
                      const statusLabel = isFullyReceived
                        ? 'Received'
                        : isPartReceived
                        ? 'Part received'
                        : 'Expected';

                      return (
                        <div
                          key={income.id}
                          className={`flex min-h-[58px] items-center gap-3 px-3 py-2.5 transition-colors ${
                            canEdit ? 'cursor-pointer hover:bg-surface-muted' : ''
                          }`}
                          onClick={canEdit ? () => openEdit(income) : undefined}
                          role={canEdit ? 'button' : undefined}
                          tabIndex={canEdit ? 0 : undefined}
                          onKeyDown={
                            canEdit
                              ? (event) => {
                                  if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    openEdit(income);
                                  }
                                }
                              : undefined
                          }
                        >
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${
                              isFullyReceived
                                ? 'bg-success-soft text-success'
                                : isPartReceived
                                ? 'bg-warning-soft text-warning'
                                : 'bg-surface-muted text-muted'
                            }`}
                          >
                            {isFullyReceived ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Banknote className="h-4 w-4" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm font-semibold text-main">
                                {income.name}
                              </span>
                              <span
                                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] ${
                                  isFullyReceived
                                    ? 'bg-success-soft text-success'
                                    : isPartReceived
                                    ? 'bg-warning-soft text-warning'
                                    : 'bg-surface-muted text-muted'
                                }`}
                              >
                                {statusLabel}
                              </span>
                            </div>
                            <div className="mt-0.5 truncate text-[11px] text-subtle">
                              {income.sourcePerson}
                              {category ? ` · ${category.name}` : ''}
                              {account ? ` · ${accountIdentityLabel(account)}` : ''}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="font-mono text-sm font-semibold tabular-nums text-main">
                              {formatPence(isFullyReceived || isPartReceived ? receivedPence : income.expectedAmountPence)}
                            </div>
                            {isPartReceived && (
                              <div className="mt-0.5 text-[10px] text-subtle">
                                of {formatPence(income.expectedAmountPence)}
                              </div>
                            )}
                          </div>

                          {canEdit && !isFullyReceived && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openReceive(income);
                              }}
                              className="inline-flex h-8 shrink-0 items-center rounded-md border border-success/30 bg-success-soft px-2.5 text-[11px] font-semibold text-success hover:brightness-95"
                            >
                              {isPartReceived ? 'Add receipt' : 'Receive'}
                            </button>
                          )}

                          {canEdit && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openEdit(income);
                              }}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-main"
                              aria-label={`Edit ${income.name}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}

                          {canEdit && !linkedTx && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                requestRemoveIncome(income);
                              }}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-danger hover:bg-danger-soft"
                              aria-label={`Delete ${income.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {(showEditModal || showReceiveModal) && (
        <div
          ref={dialogRef}
          className="mv-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label={dialogLabel}
        >
          <div className="mv-modal-card w-full max-w-[540px] overflow-hidden rounded-xl border border-muted bg-surface shadow-2xl">
            <div className="mv-modal-header flex items-center justify-between border-b border-muted px-5 py-4">
              <h2 className="text-base font-semibold text-main">
                {showReceiveModal ? 'Record income received' : selectedIncome ? 'Edit expected income' : 'Add expected income'}
              </h2>
              <button
                type="button"
                onClick={closeActiveModal}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-main"
                aria-label="Close income dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {showEditModal && (
              <form onSubmit={saveIncome} className="mv-modal-form">
                <div className="mv-modal-scroll-body grid gap-4 p-5 sm:grid-cols-2">
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-main">Income name</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClassName}
                      placeholder="e.g. Salary"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-main">Expected amount</span>
                    <MoneyInput
                      value={expectedAmount}
                      onChange={setExpectedAmount}
                      className={inputClassName}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-main">Expected date</span>
                    <input
                      type="date"
                      value={expectedDate}
                      onChange={(e) => setExpectedDate(e.target.value)}
                      className={inputClassName}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-main">Received by</span>
                    <select
                      value={sourcePerson}
                      onChange={(e) => setSourcePerson(e.target.value as Payer | '')}
                      className={inputClassName}
                    >
                      <option value="">Choose person</option>
                      {personOptions.map((person) => (
                        <option key={person} value={person}>
                          {person}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-main">Receiving account</span>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className={inputClassName}
                    >
                      <option value="">Choose account</option>
                      {accounts
                        .filter((account) => account.isActive !== false || account.id === accountId)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {accountOptionLabel(account)}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-main">Category</span>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className={inputClassName}
                    >
                      <option value="">Choose income category</option>
                      {incomeCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-main">Notes</span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className={`${inputClassName} h-auto py-2.5`}
                    />
                  </label>

                  {selectedIncome && linkedTransactionFor(selectedIncome) && (
                    <div className="sm:col-span-2 rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-xs leading-5 text-warning">
                      Receipt evidence is linked. Edit expected details here; received amount/date/account remain controlled by the linked activity record.
                    </div>
                  )}

                  {error && (
                    <div className="sm:col-span-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
                      {error}
                    </div>
                  )}
                </div>

                <div className="mv-modal-actions flex items-center justify-end gap-2 border-t border-muted bg-surface-muted px-5 py-3">
                  <button
                    type="button"
                    onClick={closeActiveModal}
                    className="h-9 rounded-md border border-muted bg-surface px-3 text-xs font-semibold text-main"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-9 rounded-md bg-accent px-4 text-xs font-semibold text-on-accent disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving…' : selectedIncome ? 'Save changes' : 'Add income'}
                  </button>
                </div>
              </form>
            )}

            {showReceiveModal && selectedIncome && (
              <form onSubmit={markReceived} className="mv-modal-form">
                <div className="mv-modal-scroll-body grid gap-4 p-5 sm:grid-cols-2">
                  <div className="sm:col-span-2 rounded-md border border-muted bg-surface-muted px-3 py-2 text-xs text-muted">
                    {selectedIncome.name} · expected {formatPence(selectedIncome.expectedAmountPence)}
                    {(selectedIncome.actualAmountPence ?? 0) > 0 && (
                      <> · already received {formatPence(selectedIncome.actualAmountPence ?? 0)}</>
                    )}
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-main">Amount received</span>
                    <MoneyInput
                      value={actualAmount}
                      onChange={setActualAmount}
                      className={inputClassName}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-main">Date received</span>
                    <input
                      type="date"
                      value={actualDate}
                      onChange={(e) => setActualDate(e.target.value)}
                      className={inputClassName}
                    />
                  </label>

                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-xs font-medium text-main">Receiving account</span>
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      className={inputClassName}
                    >
                      <option value="">Choose account</option>
                      {accounts
                        .filter((account) => account.isActive !== false || account.id === accountId)
                        .map((account) => (
                          <option key={account.id} value={account.id}>
                            {accountOptionLabel(account)}
                          </option>
                        ))}
                    </select>
                  </label>

                  {error && (
                    <div className="sm:col-span-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
                      {error}
                    </div>
                  )}
                </div>

                <div className="mv-modal-actions flex items-center justify-end gap-2 border-t border-muted bg-surface-muted px-5 py-3">
                  <button
                    type="button"
                    onClick={closeActiveModal}
                    className="h-9 rounded-md border border-muted bg-surface px-3 text-xs font-semibold text-main"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-9 rounded-md bg-success px-4 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {isSubmitting ? 'Recording…' : 'Record received'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      <ConfirmActionDialog
        open={Boolean(pendingIncomeDeletion)}
        title="Delete expected income?"
        description={
          pendingIncomeDeletion
            ? `Delete “${pendingIncomeDeletion.name}”? This removes the planned income only.`
            : ''
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        busy={isSubmitting}
        error={error}
        onCancel={() => setPendingIncomeDeletion(null)}
        onConfirm={async () => {
          if (!pendingIncomeDeletion) return;
          setIsSubmitting(true);
          try {
            const deleted = await removeIncome(pendingIncomeDeletion);
            if (deleted) setPendingIncomeDeletion(null);
          } finally {
            setIsSubmitting(false);
          }
        }}
      />
    </div>
  );
};
