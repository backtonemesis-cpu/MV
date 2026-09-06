import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, RotateCcw, X } from 'lucide-react';
import type { Account, Category, PlannedPayment, Transaction } from '../types';
import { accountIdentityLabel } from '../utils/accountDisplay';
import { formatPence } from '../utils/currency';
import { localDateInputValue } from '../utils/dateInput';
import { useModalAccessibility } from '../utils/modalAccessibility';

interface BulkPaymentStatusModalProps {
  mode: 'mark' | 'undo';
  payments: PlannedPayment[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  onClose: () => void;
  onMarkPaid: (payments: PlannedPayment[], actualDate: string) => Promise<void>;
  onUndoPaid: (payments: PlannedPayment[]) => Promise<void>;
}

function isExactPaymentEvidence(
  transaction: Transaction,
  payment: PlannedPayment
): boolean {
  return (
    transaction.id === payment.actualTransactionId &&
    transaction.plannedPaymentId === payment.id &&
    transaction.type === 'expense' &&
    !transaction.isTransfer &&
    !transaction.isRepayment &&
    !transaction.isSavings &&
    !transaction.isRefund
  );
}

export const BulkPaymentStatusModal: React.FC<BulkPaymentStatusModalProps> = ({
  mode,
  payments,
  accounts,
  categories,
  transactions,
  onClose,
  onMarkPaid,
  onUndoPaid,
}) => {
  const [date, setDate] = useState(localDateInputValue());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalAccessibility<HTMLElement>(true, onClose);

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const undoEvidenceByPaymentId = useMemo(() => {
    const evidence = new Map<string, Transaction | undefined>();

    for (const payment of payments) {
      const references = transactions.filter(
        (transaction) => transaction.plannedPaymentId === payment.id
      );
      const exact =
        references.length === 1 &&
        payment.actualTransactionId &&
        isExactPaymentEvidence(references[0], payment)
          ? references[0]
          : undefined;
      evidence.set(payment.id, exact);
    }

    return evidence;
  }, [payments, transactions]);

  const hasUnsafeUndoEvidence =
    mode === 'undo' &&
    payments.some((payment) => !undoEvidenceByPaymentId.get(payment.id));

  const totalPence = payments.reduce((sum, payment) => {
    if (mode === 'undo') {
      return sum + (undoEvidenceByPaymentId.get(payment.id)?.amountPence ?? 0);
    }
    return sum + payment.amountPence;
  }, 0);

  const title =
    mode === 'mark'
      ? payments.length === 1
        ? 'Mark paid'
        : `Mark ${payments.length} bills paid`
      : `Undo ${payments.length} payment${payments.length === 1 ? '' : 's'}`;

  const handleConfirm = async () => {
    if (payments.length === 0) return;
    if (hasUnsafeUndoEvidence) {
      setError(
        'One or more linked Activity expenses are missing, duplicated, or mismatched. Nothing was changed.'
      );
      return;
    }
    if (mode === 'mark' && !date) {
      setError('Payment date is required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      if (mode === 'mark') {
        await onMarkPaid(payments, date);
      } else {
        await onUndoPaid(payments);
      }
      onClose();
    } catch (err: any) {
      setError(
        err.message ||
          (mode === 'mark'
            ? 'Failed to record payments.'
            : 'Failed to undo payments.')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mv-modal-backdrop">
      <section
        ref={dialogRef}
        className="mv-modal-card max-w-[560px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-payment-title"
        tabIndex={-1}
      >
        <div className="mv-modal-header">
          <div>
            <h3 id="bulk-payment-title" className="text-base font-bold text-main">
              {title}
            </h3>
            <p className="mt-0.5 text-[11px] text-subtle">
              {mode === 'mark'
                ? 'Funding is unchanged. Linked Activity expenses will be created.'
                : 'Only the exact linked Activity expenses will be removed. Funding is unchanged.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mv-modal-close"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mv-modal-form">
          {error && (
            <div
              className="rounded-lg border border-danger bg-danger-soft px-3 py-2 text-xs text-danger"
              role="alert"
            >
              {error}
            </div>
          )}

          {hasUnsafeUndoEvidence && (
            <div
              className="flex items-start gap-2 rounded-lg border border-danger bg-danger-soft px-3 py-2 text-xs text-danger"
              role="alert"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Undo is blocked because exact reciprocal Activity evidence cannot
                be proved for every selected bill.
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-muted bg-surface-muted px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-subtle">
                Bills
              </div>
              <div className="mt-0.5 text-sm font-bold text-main">
                {payments.length}
              </div>
            </div>
            <div className="rounded-lg border border-muted bg-surface-muted px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-wide text-subtle">
                Total
              </div>
              <div className="mv-private-value mt-0.5 font-mono text-sm font-bold tabular-nums text-main">
                {formatPence(totalPence)}
              </div>
            </div>
          </div>

          {mode === 'mark' && (
            <div>
              <label
                htmlFor="bulk-payment-date"
                className="mb-1 block text-xs font-semibold text-muted"
              >
                Payment date
              </label>
              <input
                id="bulk-payment-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-lg border border-muted bg-surface px-3 py-2 text-xs text-main"
                required
              />
              <p className="mt-1 text-[10px] text-subtle">
                Planned amounts and assigned payment accounts are already set. Change only the payment date if needed.
              </p>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto rounded-lg border border-muted">
            {payments.map((payment) => {
              const evidence =
                mode === 'undo'
                  ? undoEvidenceByPaymentId.get(payment.id)
                  : undefined;
              const accountId =
                mode === 'undo' ? evidence?.accountId : payment.accountId;
              const account = accountId ? accountsById.get(accountId) : undefined;
              const amountPence =
                mode === 'undo' ? evidence?.amountPence : payment.amountPence;
              const rowUnsafe = mode === 'undo' && !evidence;

              return (
                <div
                  key={payment.id}
                  className="flex items-start justify-between gap-3 border-b border-muted px-3 py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-main">
                      {payment.name}
                    </div>
                    <div
                      className={`mt-0.5 text-[10px] ${
                        rowUnsafe ? 'text-danger' : 'text-subtle'
                      }`}
                    >
                      {rowUnsafe
                        ? 'Exact linked Activity evidence unavailable'
                        : account
                          ? accountIdentityLabel(account)
                          : 'Payment account unavailable'}
                    </div>
                    {!rowUnsafe && (
                      <div className="mt-0.5 text-[10px] text-subtle">
                        {payment.responsiblePerson}
                        {payment.categoryId && categoriesById.get(payment.categoryId)
                          ? ` · ${categoriesById.get(payment.categoryId)}`
                          : ''}
                      </div>
                    )}
                    {mode === 'undo' && evidence && (
                      <div className="mt-0.5 text-[10px] text-subtle">
                        Paid {evidence.date}
                      </div>
                    )}
                  </div>
                  <div className="mv-private-value shrink-0 font-mono text-xs font-bold tabular-nums text-main">
                    {amountPence === undefined ? '—' : formatPence(amountPence)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mv-modal-actions">
            <button
              type="button"
              onClick={onClose}
              data-modal-initial-focus
              className="min-h-11 px-4 py-2 text-xs font-semibold text-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={
                saving ||
                payments.length === 0 ||
                hasUnsafeUndoEvidence
              }
              className={
                mode === 'mark'
                  ? 'inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-xs font-semibold text-on-accent disabled:opacity-50'
                  : 'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-danger px-4 py-2 text-xs font-semibold text-danger disabled:opacity-50'
              }
            >
              {mode === 'mark' ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              {saving
                ? 'Working…'
                : mode === 'mark'
                  ? 'Mark paid'
                  : 'Undo payments'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
