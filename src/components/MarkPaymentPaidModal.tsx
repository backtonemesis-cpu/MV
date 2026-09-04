import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import type { Account, PlannedPayment } from '../types';
import { formatPenceToPoundsInput, parseToPence } from '../utils/currency';

interface MarkPaymentPaidModalProps {
  payment: PlannedPayment;
  accounts: Account[];
  onClose: () => void;
  onConfirm: (payload: {
    actualAmountPence: number;
    actualDate: string;
    accountId: string;
  }) => Promise<void>;
}

export const MarkPaymentPaidModal: React.FC<MarkPaymentPaidModalProps> = ({
  payment,
  accounts,
  onClose,
  onConfirm,
}) => {
  const amountRef = useRef<HTMLInputElement>(null);
  const [amount, setAmount] = useState(
    formatPenceToPoundsInput(payment.actualAmountPence ?? payment.amountPence)
  );
  const [date, setDate] = useState(
    payment.actualDate || payment.dueDate || new Date().toISOString().slice(0, 10)
  );
  const [accountId, setAccountId] = useState(payment.accountId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => amountRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const amountPence = parseToPence(amount);
    if (amountPence < 0) {
      setError('Actual amount must be zero or greater.');
      return;
    }
    if (!date) {
      setError('Actual payment date is required.');
      return;
    }
    if (!accountId) {
      setError('Payment account is required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onConfirm({
        actualAmountPence: amountPence,
        actualDate: date,
        accountId,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to mark bill paid.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mv-modal-backdrop">
      <section className="mv-modal-card" role="dialog" aria-modal="true" aria-label="Mark bill paid">
        <div className="mv-modal-header">
          <div>
            <h3 className="text-base font-bold text-main">Mark Paid</h3>
            <p className="mt-0.5 text-[11px] text-subtle">{payment.name}</p>
          </div>
          <button type="button" onClick={onClose} className="mv-modal-close" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mv-modal-form">
          {error && (
            <div className="rounded-lg border border-danger bg-danger-soft px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}

          <div className="mv-modal-grid-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Actual amount (£)</label>
              <input
                ref={amountRef}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="w-full rounded-lg border border-muted bg-surface px-3 py-2 text-xs text-main"
                inputMode="decimal"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Actual date</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-lg border border-muted bg-surface px-3 py-2 text-xs text-main"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">Paid from</label>
            <select
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              className="w-full rounded-lg border border-muted bg-surface px-3 py-2 text-xs text-main"
              required
            >
              {accounts
                .filter((account) => account.isActive !== false)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {account.ownerPerson || account.type}
                  </option>
                ))}
            </select>
          </div>

          <div className="mv-modal-actions">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-muted">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-success px-4 py-2 text-xs font-semibold text-on-accent disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {saving ? 'Recording…' : 'Record Payment'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
