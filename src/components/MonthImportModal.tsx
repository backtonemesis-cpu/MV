import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Layers, X } from 'lucide-react';
import { Account, PlannedIncome, PlannedPayment } from '../types';
import { formatPence } from '../utils/currency';
import { localDateInputValue } from '../utils/dateInput';
import { MonthPicker } from './MonthPicker';

interface MonthImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMonth: string;
  plannedPayments: PlannedPayment[];
  plannedIncomes: PlannedIncome[];
  accounts: Account[];
  onImport: (params: {
    sourceMonth: string;
    targetMonth: string;
    paymentIds: string[];
    incomeIds: string[];
  }) => Promise<void>;
}

function nextMonth(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return '';
  const [yearText, monthText] = month.split('-');
  let year = Number.parseInt(yearText, 10);
  let monthNumber = Number.parseInt(monthText, 10) + 1;

  if (monthNumber > 12) {
    monthNumber = 1;
    year += 1;
  }

  return `${year}-${String(monthNumber).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return month || 'Target Month';
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${month}-01T12:00:00`));
}

function dayLabel(date: string | undefined, prefix: string): string {
  if (!date || date.length < 10) return 'Flexible';
  const day = Number.parseInt(date.slice(8, 10), 10);
  return Number.isFinite(day) ? `${prefix} Day ${day}` : 'Flexible';
}

export const MonthImportModal: React.FC<MonthImportModalProps> = ({
  isOpen,
  onClose,
  activeMonth,
  plannedPayments,
  plannedIncomes,
  accounts,
  onImport,
}) => {
  const sourceMonthRef = useRef<HTMLInputElement>(null);

  const [sourceMonth, setSourceMonth] = useState(activeMonth);
  const [targetMonth, setTargetMonth] = useState(nextMonth(activeMonth));
  const [includeIncomes, setIncludeIncomes] = useState(true);
  const [includePayments, setIncludePayments] = useState(true);
  const [selectedIncomeIds, setSelectedIncomeIds] = useState<Set<string>>(new Set());
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  const sourcePayments = useMemo(
    () => plannedPayments.filter((payment) => payment.month === sourceMonth),
    [plannedPayments, sourceMonth]
  );

  const sourceIncomes = useMemo(
    () => plannedIncomes.filter((income) => income.month === sourceMonth),
    [plannedIncomes, sourceMonth]
  );

  const targetPayments = useMemo(
    () => plannedPayments.filter((payment) => payment.month === targetMonth),
    [plannedPayments, targetMonth]
  );

  const targetIncomes = useMemo(
    () => plannedIncomes.filter((income) => income.month === targetMonth),
    [plannedIncomes, targetMonth]
  );

  const duplicatePaymentIds = useMemo(() => {
    const duplicates = new Set<string>();

    for (const payment of sourcePayments) {
      const copiedFromId = String(payment.metadata?.copiedFromId || payment.id);
      const name = payment.name.trim().toLowerCase();

      const exists = targetPayments.some(
        (candidate) =>
          String(candidate.metadata?.copiedFromId || '') === copiedFromId ||
          (
            candidate.name.trim().toLowerCase() === name &&
            candidate.accountId === payment.accountId &&
            candidate.amountPence === payment.amountPence &&
            candidate.responsiblePerson === payment.responsiblePerson
          )
      );

      if (exists) duplicates.add(payment.id);
    }

    return duplicates;
  }, [sourcePayments, targetPayments]);

  const duplicateIncomeIds = useMemo(() => {
    const duplicates = new Set<string>();

    for (const income of sourceIncomes) {
      const copiedFromId = String(income.metadata?.copiedFromId || income.id);
      const name = income.name.trim().toLowerCase();

      const exists = targetIncomes.some(
        (candidate) =>
          String(candidate.metadata?.copiedFromId || '') === copiedFromId ||
          (
            candidate.name.trim().toLowerCase() === name &&
            candidate.accountId === income.accountId &&
            candidate.expectedAmountPence === income.expectedAmountPence &&
            candidate.sourcePerson === income.sourcePerson
          )
      );

      if (exists) duplicates.add(income.id);
    }

    return duplicates;
  }, [sourceIncomes, targetIncomes]);

  useEffect(() => {
    if (!isOpen) return;

    const source = activeMonth || localDateInputValue().slice(0, 7);
    setSourceMonth(source);
    setTargetMonth(nextMonth(source));
    setIncludeIncomes(true);
    setIncludePayments(true);
    setError(null);

    const frame = requestAnimationFrame(() => sourceMonthRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [activeMonth, isOpen]);

  useEffect(() => {
    setSelectedPaymentIds(
      new Set(
        sourcePayments
          .filter(
            (payment) =>
              payment.isRecurring === true &&
              !duplicatePaymentIds.has(payment.id)
          )
          .map((payment) => payment.id)
      )
    );

    setSelectedIncomeIds(
      new Set(
        sourceIncomes
          .filter((income) => !duplicateIncomeIds.has(income.id))
          .map((income) => income.id)
      )
    );

    setError(null);
  }, [
    duplicateIncomeIds,
    duplicatePaymentIds,
    sourceIncomes,
    sourcePayments,
    targetMonth,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const toggleIncome = (id: string) => {
    if (!includeIncomes || duplicateIncomeIds.has(id)) return;

    setSelectedIncomeIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePayment = (id: string) => {
    if (!includePayments || duplicatePaymentIds.has(id)) return;

    setSelectedPaymentIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleIncomeScopeChange = (checked: boolean) => {
    setIncludeIncomes(checked);
    if (checked && selectedIncomeIds.size === 0) {
      setSelectedIncomeIds(
        new Set(
          sourceIncomes
            .filter((income) => !duplicateIncomeIds.has(income.id))
            .map((income) => income.id)
        )
      );
    }
  };

  const handlePaymentScopeChange = (checked: boolean) => {
    setIncludePayments(checked);
    if (checked && selectedPaymentIds.size === 0) {
      setSelectedPaymentIds(
        new Set(
          sourcePayments
            .filter(
              (payment) =>
                payment.isRecurring === true &&
                !duplicatePaymentIds.has(payment.id)
            )
            .map((payment) => payment.id)
        )
      );
    }
  };

  const selectedIncomeCount = includeIncomes ? selectedIncomeIds.size : 0;
  const selectedPaymentCount = includePayments ? selectedPaymentIds.size : 0;
  const selectedItemCount = selectedIncomeCount + selectedPaymentCount;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!/^\d{4}-\d{2}$/.test(sourceMonth) || !/^\d{4}-\d{2}$/.test(targetMonth)) {
      setError('Choose a valid source month and target month.');
      return;
    }

    if (sourceMonth === targetMonth) {
      setError('Target month must be different from the source month.');
      return;
    }

    if (selectedItemCount === 0) {
      setError('Select at least one income or bill to prepare.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await onImport({
        sourceMonth,
        targetMonth,
        paymentIds: includePayments ? Array.from(selectedPaymentIds) : [],
        incomeIds: includeIncomes ? Array.from(selectedIncomeIds) : [],
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to prepare the target month.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mv-modal-backdrop">
      <div className="mv-modal-card mv-modal-wide mv-rollover-modal">
        <div className="mv-modal-header">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-success-soft text-success">
              <Layers className="h-3.5 w-3.5" />
            </div>
            <h2>Prepare Next Month</h2>
          </div>

          <button type="button" onClick={onClose} className="mv-modal-close" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mv-modal-form mv-rollover-form"
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            if (event.target instanceof HTMLButtonElement) return;
            event.preventDefault();
            event.currentTarget.requestSubmit();
          }}
        >
          <div className="mv-rollover-controls">
            <div className="mv-modal-grid-2">
              <label>
                From Month
                <MonthPicker
                  ref={sourceMonthRef}
                  value={sourceMonth}
                  onChange={setSourceMonth}
                  ariaLabel="Source month"
                  className="is-fluid"
                />
              </label>

              <label>
                Target Month
                <MonthPicker
                  value={targetMonth}
                  onChange={setTargetMonth}
                  ariaLabel="Target month"
                  className="is-fluid"
                />
              </label>
            </div>

            <div className="mv-rollover-scopes">
              <label className="mv-rollover-scope">
                <input
                  type="checkbox"
                  checked={includeIncomes}
                  onChange={(event) => handleIncomeScopeChange(event.target.checked)}
                />
                <span>Rollover Expected Income &amp; Wages</span>
              </label>

              <label className="mv-rollover-scope">
                <input
                  type="checkbox"
                  checked={includePayments}
                  onChange={(event) => handlePaymentScopeChange(event.target.checked)}
                />
                <span>Rollover Planned Household Bills</span>
              </label>
            </div>

            {error && (
              <div className="mv-rollover-error">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="mv-rollover-scroll">
            <section className={includeIncomes ? '' : 'is-scope-disabled'}>
              <div className="mv-rollover-section-header">
                <span>Expected Income ({sourceIncomes.length} items)</span>
                <span>{selectedIncomeCount} selected</span>
              </div>

              {sourceIncomes.length === 0 ? (
                <div className="mv-rollover-empty">No expected income in {monthLabel(sourceMonth)}.</div>
              ) : (
                sourceIncomes.map((income) => {
                  const account = accountMap.get(income.accountId);
                  const duplicate = duplicateIncomeIds.has(income.id);
                  const checked = selectedIncomeIds.has(income.id);
                  const disabled = !includeIncomes || duplicate;

                  return (
                    <label
                      key={income.id}
                      className={`mv-rollover-row ${disabled ? 'is-disabled' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleIncome(income.id)}
                      />

                      <span className="mv-rollover-row-main">
                        <span className="mv-rollover-title">{income.name}</span>
                        <span className="mv-rollover-meta">
                          {income.sourcePerson} • {account?.name || 'Account'} • {dayLabel(income.expectedDate, 'Expected')}
                          {duplicate ? ' • Exists' : ''}
                        </span>
                      </span>

                      <span className="mv-rollover-row-side">
                        <span className="mv-rollover-amount">{formatPence(income.expectedAmountPence)}</span>
                        <span className="mv-rollover-pill mv-rollover-pill-expected">Expected</span>
                      </span>
                    </label>
                  );
                })
              )}
            </section>

            <section className={includePayments ? '' : 'is-scope-disabled'}>
              <div className="mv-rollover-section-header">
                <span>Planned Bills ({sourcePayments.length} items)</span>
                <span>{selectedPaymentCount} selected</span>
              </div>

              {sourcePayments.length === 0 ? (
                <div className="mv-rollover-empty">No planned bills in {monthLabel(sourceMonth)}.</div>
              ) : (
                sourcePayments.map((payment) => {
                  const account = accountMap.get(payment.accountId);
                  const duplicate = duplicatePaymentIds.has(payment.id);
                  const checked = selectedPaymentIds.has(payment.id);
                  const disabled = !includePayments || duplicate;

                  return (
                    <label
                      key={payment.id}
                      className={`mv-rollover-row ${disabled ? 'is-disabled' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => togglePayment(payment.id)}
                      />

                      <span className="mv-rollover-row-main">
                        <span className="mv-rollover-title">
                          {payment.name}
                          {payment.isRecurring === true && (
                            <span className="mv-rollover-recurring-tag">Recurring</span>
                          )}
                        </span>
                        <span className="mv-rollover-meta">
                          {payment.responsiblePerson} • {account?.name || 'Account'} • {dayLabel(payment.dueDate, 'Due')}
                          {duplicate ? ' • Exists' : ''}
                        </span>
                      </span>

                      <span className="mv-rollover-row-side">
                        <span className="mv-rollover-amount">{formatPence(payment.amountPence)}</span>
                        <span className="mv-rollover-pill mv-rollover-pill-unpaid">Unpaid</span>
                      </span>
                    </label>
                  );
                })
              )}
            </section>
          </div>

          <div className="mv-rollover-footer">
            <button type="button" onClick={onClose} className="mv-rollover-cancel">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedItemCount === 0}
              className="mv-rollover-submit"
            >
              {isSubmitting
                ? 'Preparing…'
                : `Prepare ${monthLabel(targetMonth)} (${selectedItemCount} Items)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
