import React, { useState, useMemo } from 'react';
import { X, Calendar, ArrowRight, CheckCircle2, AlertCircle, Copy, Layers } from 'lucide-react';
import { PlannedPayment, Account, Category } from '../types';
import { formatPence } from '../utils/currency';

interface MonthImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableMonths: string[];
  activeMonth: string;
  plannedPayments: PlannedPayment[];
  accounts: Account[];
  categories: Category[];
  onImport: (params: { sourceMonth: string; targetMonth: string; paymentIds: string[] }) => Promise<void>;
}

export const MonthImportModal: React.FC<MonthImportModalProps> = ({
  isOpen,
  onClose,
  availableMonths,
  activeMonth,
  plannedPayments,
  accounts,
  categories,
  onImport,
}) => {
  // Derive default target month by taking activeMonth and adding 1 month
  const defaultTargetMonth = useMemo(() => {
    if (!activeMonth || !activeMonth.includes('-')) return '2026-10';
    const [yearStr, monthStr] = activeMonth.split('-');
    let y = parseInt(yearStr, 10);
    let m = parseInt(monthStr, 10);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    return `${y}-${m.toString().padStart(2, '0')}`;
  }, [activeMonth]);

  const [sourceMonth, setSourceMonth] = useState<string>(activeMonth || availableMonths[0] || '2026-09');
  const [targetMonth, setTargetMonth] = useState<string>(defaultTargetMonth);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available source payments
  const sourcePayments = useMemo(() => {
    return plannedPayments.filter((p) => p.month === sourceMonth);
  }, [plannedPayments, sourceMonth]);

  // Existing target payments for duplicate check
  const existingTargetPayments = useMemo(() => {
    return plannedPayments.filter((p) => p.month === targetMonth);
  }, [plannedPayments, targetMonth]);

  // When source month changes, default all valid non-duplicates as selected
  React.useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    const nonDuplicates = sourcePayments
      .filter((src) => {
        return !existingTargetPayments.some(
          (t) =>
            t.name.toLowerCase() === src.name.toLowerCase() &&
            t.amountPence === src.amountPence &&
            t.accountId === src.accountId
        );
      })
      .map((p) => p.id);
    setSelectedPaymentIds(new Set(nonDuplicates));
    setError(null);
  }, [sourceMonth, targetMonth, sourcePayments, existingTargetPayments]);

  if (!isOpen) return null;

  const handleToggleSelectAll = () => {
    if (selectedPaymentIds.size === sourcePayments.length) {
      setSelectedPaymentIds(new Set());
    } else {
      setSelectedPaymentIds(new Set(sourcePayments.map((p) => p.id)));
    }
  };

  const handleTogglePayment = (id: string) => {
    const next = new Set(selectedPaymentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedPaymentIds(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceMonth || !targetMonth) {
      setError('Please provide valid source and target months (YYYY-MM).');
      return;
    }
    if (sourceMonth === targetMonth) {
      setError('Target month must be distinct from source month.');
      return;
    }
    if (selectedPaymentIds.size === 0) {
      setError('Please select at least one planned payment to copy.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onImport({
        sourceMonth,
        targetMonth,
        paymentIds: Array.from(selectedPaymentIds),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to import month.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  return (
    <div className="mv-modal-backdrop">
      <div className="mv-modal-card mv-modal-wide flex flex-col">
        {/* Header */}
        <div className="mv-modal-header">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-success-soft text-success flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-main">
                Copy Bills to Month
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mv-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mv-modal-form flex-1">
          {error && (
            <div className="p-3 bg-danger-soft border border-danger rounded-xl flex items-start gap-2 text-danger text-xs">
              <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Month Selectors */}
          <div className="mv-modal-grid-2">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                From Month
              </label>
              <select
                autoFocus
                value={sourceMonth}
                onChange={(e) => setSourceMonth(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main font-medium focus:ring-2 focus:ring-accent focus:outline-none"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m} ({plannedPayments.filter((p) => p.month === m).length} bills)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                To Month
              </label>
              <input
                type="text"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value.trim())}
                placeholder="YYYY-MM"
                pattern="\d{4}-\d{2}"
                className="w-full px-3 py-2 bg-surface border border-muted rounded-xl text-xs text-main font-medium focus:ring-2 focus:ring-accent focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Integrity Guarantees Banner */}
          <div className="p-3 bg-success-soft border border-success rounded-xl text-xs text-success flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
            <span className="text-[11px]">Copied bills reset to <strong>Unpaid</strong>; duplicates are skipped.</span>
          </div>

          {/* Bills Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-main">
                Bills ({selectedPaymentIds.size}/{sourcePayments.length})
              </span>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-xs font-semibold text-success hover:underline"
              >
                {selectedPaymentIds.size === sourcePayments.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {sourcePayments.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted text-subtle bg-surface-muted rounded-xl border border-muted">
                No bills in {sourceMonth}.
              </div>
            ) : (
              <div className="mv-modal-list">
                {sourcePayments.map((payment) => {
                  const acc = accountMap.get(payment.accountId);
                  const isDup = existingTargetPayments.some(
                    (t) =>
                      t.name.toLowerCase() === payment.name.toLowerCase() &&
                      t.amountPence === payment.amountPence &&
                      t.accountId === payment.accountId
                  );
                  const isChecked = selectedPaymentIds.has(payment.id);

                  return (
                    <div
                      key={payment.id}
                      onClick={() => !isDup && handleTogglePayment(payment.id)}
                      className={`mv-modal-list-row border transition-colors flex items-center justify-between cursor-pointer ${
                        isDup
                          ? 'bg-surface-muted border-muted opacity-60 cursor-not-allowed'
                          : isChecked
                          ? 'bg-success-soft border-success'
                          : 'bg-surface border-muted hover:bg-surface-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isDup}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => handleTogglePayment(payment.id)}
                          className="w-4 h-4 rounded text-success focus:ring-accent border-muted"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-main">
                              {payment.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-muted text-muted font-medium">
                              {payment.responsiblePerson}
                            </span>
                            {isDup && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning-soft text-warning font-medium">
                                Already in {targetMonth}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted text-subtle mt-0.5">
                            {acc?.name || 'Account'} • Due {payment.dueDate ? payment.dueDate.split('-')[2] : 'Day 1'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-black text-main">
                          {formatPence(payment.amountPence)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="mv-modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 whitespace-nowrap px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-muted rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedPaymentIds.size === 0}
              className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 px-4 py-2 bg-accent hover:bg-success-soft text-on-accent rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition"
            >
              <Copy className="w-3.5 h-3.5" />
              {isSubmitting ? 'Importing...' : `Copy ${selectedPaymentIds.size} Bills`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
