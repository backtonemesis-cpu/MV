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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
      <div className="mv-surface bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border mv-border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 mv-surface-muted bg-neutral-50 dark:bg-neutral-850">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold mv-text text-neutral-900 dark:text-neutral-100">
                Copy Bills to Month
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg mv-text-muted text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-2 text-rose-800 dark:text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Month Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                From Month
              </label>
              <select
                value={sourceMonth}
                onChange={(e) => setSourceMonth(e.target.value)}
                className="w-full px-3 py-2 mv-surface bg-white dark:bg-neutral-800 border mv-border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs mv-text text-neutral-900 dark:text-neutral-100 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m} ({plannedPayments.filter((p) => p.month === m).length} bills)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                To Month
              </label>
              <input
                type="text"
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value.trim())}
                placeholder="YYYY-MM"
                pattern="\d{4}-\d{2}"
                className="w-full px-3 py-2 mv-surface bg-white dark:bg-neutral-800 border mv-border border-neutral-300 dark:border-neutral-700 rounded-xl text-xs mv-text text-neutral-900 dark:text-neutral-100 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Integrity Guarantees Banner */}
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span className="text-[11px]">Copied bills reset to <strong>Unpaid</strong>; duplicates are skipped.</span>
          </div>

          {/* Bills Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200">
                Bills ({selectedPaymentIds.size}/{sourcePayments.length})
              </span>
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                {selectedPaymentIds.size === sourcePayments.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {sourcePayments.length === 0 ? (
              <div className="p-4 text-center text-xs mv-text-muted text-neutral-500 dark:text-neutral-400 mv-surface-muted bg-neutral-50 dark:bg-neutral-800 rounded-xl border mv-border border-neutral-200 dark:border-neutral-700">
                No bills in {sourceMonth}.
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
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
                      className={`p-3 rounded-xl border transition-colors flex items-center justify-between cursor-pointer ${
                        isDup
                          ? 'mv-surface-muted bg-neutral-50 dark:bg-neutral-850 mv-border border-neutral-200 dark:border-neutral-800 opacity-60 cursor-not-allowed'
                          : isChecked
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                          : 'mv-surface bg-white dark:bg-neutral-800 mv-border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-750'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isDup}
                          onChange={() => handleTogglePayment(payment.id)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 mv-border border-neutral-300 dark:border-neutral-600"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold mv-text text-neutral-900 dark:text-neutral-100">
                              {payment.name}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 font-medium">
                              {payment.responsiblePerson}
                            </span>
                            {isDup && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-medium">
                                Already in {targetMonth}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] mv-text-muted text-neutral-500 dark:text-neutral-400 mt-0.5">
                            {acc?.name || 'Account'} • Due {payment.dueDate ? payment.dueDate.split('-')[2] : 'Day 1'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-black mv-text text-neutral-900 dark:text-neutral-100">
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
          <div className="mv-hscroll pt-3 border-t border-neutral-100 dark:border-neutral-800 items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 whitespace-nowrap px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedPaymentIds.size === 0}
              className="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50 transition"
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
