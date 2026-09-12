import React, { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { PlannedPayment } from '../types';
import { formatPence } from '../utils/currency';
import { useModalAccessibility } from '../utils/modalAccessibility';

interface UndoBillFundingModalProps {
  payment: PlannedPayment;
  activeFundingPence: number;
  onClose: () => void;
  onConfirm: (plannedPaymentId: string) => Promise<void>;
}

export const UndoBillFundingModal: React.FC<UndoBillFundingModalProps> = ({
  payment,
  activeFundingPence,
  onClose,
  onConfirm,
}) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalAccessibility<HTMLElement>(true, onClose);

  const handleConfirm = async () => {
    try {
      setSaving(true);
      setError(null);
      await onConfirm(payment.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to undo bill funding.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mv-modal-backdrop">
      <section
        ref={dialogRef}
        className="mv-modal-card max-w-[520px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="undo-bill-funding-title"
        tabIndex={-1}
      >
        <div className="mv-modal-header">
          <div>
            <h3 id="undo-bill-funding-title" className="text-base font-bold text-main">
              Undo bill funding
            </h3>
            <p className="mt-0.5 text-[11px] text-subtle">
              Reverse only the latest exact Transfer Plan funding attributed to this bill.
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

          <div className="rounded-lg border border-muted bg-surface-muted px-3 py-3">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-subtle">
              Funding to reverse
            </div>
            <div className="mt-1 flex items-center justify-between gap-3">
              <div className="min-w-0 truncate text-xs font-semibold text-main">
                {payment.name}
              </div>
              <div className="mv-private-value shrink-0 font-mono text-sm font-bold tabular-nums text-main">
                {formatPence(activeFundingPence)}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-warning bg-warning-soft px-3 py-2 text-xs text-warning">
            Paid/Unpaid status, Transfer Plan inclusion and linked Activity payment evidence are unchanged.
            The destination account may become underfunded or negative after the exact funding reversal.
          </div>

          {payment.status === 'paid' && (
            <div className="rounded-lg border border-muted bg-surface-muted px-3 py-2 text-xs text-subtle">
              This bill is already paid. Its recorded payment will remain recorded after funding is undone.
            </div>
          )}

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
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-danger px-4 py-2 text-xs font-semibold text-danger disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {saving ? 'Working…' : `Undo funding ${formatPence(activeFundingPence)}`}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
