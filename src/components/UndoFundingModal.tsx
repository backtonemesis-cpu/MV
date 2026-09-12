import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, RotateCcw, X } from 'lucide-react';
import type {
  Account,
  TransferPlanFundingMutationExpectation,
} from '../types';
import type { TransferPlanAccountModel } from '../utils/transferPlanViewModel';
import { accountIdentityLabel } from '../utils/accountDisplay';
import { formatPence } from '../utils/currency';
import { useModalAccessibility } from '../utils/modalAccessibility';

interface UndoFundingModalProps {
  model: TransferPlanAccountModel;
  accounts: Account[];
  month: string;
  onClose: () => void;
  onConfirm: (
    destinationAccountId: string,
    month: string,
    expectedBatch: TransferPlanFundingMutationExpectation
  ) => Promise<void>;
}

export const UndoFundingModal: React.FC<UndoFundingModalProps> = ({
  model,
  accounts,
  month,
  onClose,
  onConfirm,
}) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useModalAccessibility<HTMLElement>(true, onClose);
  const latestFundingBatch = model.latestFundingBatch;

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  if (!latestFundingBatch) return null;

  const sourceLabels = latestFundingBatch.sourceAccountIds.map((id) => {
    const account = accountsById.get(id);
    return account ? accountIdentityLabel(account) : `Missing account · ${id}`;
  });

  const expectedBatch = latestFundingBatch.expectedUndoBatch;

  const handleConfirm = async () => {
    try {
      setSaving(true);
      setError(null);
      await onConfirm(
        model.requirement.account.id,
        month,
        expectedBatch
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to undo Transfer Plan funding.');
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
        aria-labelledby="undo-funding-title"
        tabIndex={-1}
      >
        <div className="mv-modal-header">
          <div>
            <h3 id="undo-funding-title" className="text-base font-bold text-main">
              Undo funding
            </h3>
            <p className="mt-0.5 text-[11px] text-subtle">
              This reverses only the exact reviewed Transfer Plan funding batch.
              Paid/Unpaid status and linked Activity expenses are unchanged.
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
            <div className="mt-1 flex items-start gap-2 text-xs text-main">
              <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <div className="min-w-0">
                <div className="font-semibold">
                  {sourceLabels.join(' + ')}
                </div>
                <div className="mt-0.5 text-subtle">
                  → {accountIdentityLabel(model.requirement.account)}
                </div>
              </div>
              <div className="mv-private-value ml-auto shrink-0 font-mono text-sm font-bold tabular-nums text-main">
                {formatPence(latestFundingBatch.totalPence)}
              </div>
            </div>
          </div>

          {model.requirement.paidPayments.length > 0 && (
            <div className="rounded-lg border border-warning bg-warning-soft px-3 py-2 text-xs text-warning">
              {model.requirement.paidPayments.length} recorded bill payment
              {model.requirement.paidPayments.length === 1 ? '' : 's'} will remain
              recorded with their linked Activity expenses. This action reverses
              funding only, so the resulting account/funding position may change.
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
              {saving ? 'Working…' : 'Undo funding'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
