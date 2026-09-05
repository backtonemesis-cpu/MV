import React, { useEffect, useState } from 'react';
import { X, ArrowRight, AlertCircle, Plus, Trash2, ChevronDown } from 'lucide-react';
import { Account, AccountFundingRequirement, HouseholdMember } from '../types';
import { formatPence, parseToPence } from '../utils/currency';
import {
  accountIdentityLabel,
  accountOwnerLabel,
  accountTypeLabel,
} from '../utils/accountDisplay';
import { localDateInputValue } from '../utils/dateInput';

interface ExecuteTransferModalProps {
  fundingRequirement: AccountFundingRequirement;
  availableSourceAccounts: Account[];
  members: HouseholdMember[];
  reservedPlanPenceByAccountId: Record<string, number>;
  onClose: () => void;
  onExecute: (payload: {
    destinationAccountId: string;
    expectedTotalPence: number;
    allocations: Array<{
      sourceAccountId: string;
      amountPence: number;
    }>;
    description: string;
    date: string;
  }) => Promise<void>;
}

interface AllocationDraft {
  id: string;
  sourceAccountId: string;
  amountStr: string;
}

export const ExecuteTransferModal: React.FC<ExecuteTransferModalProps> = ({
  fundingRequirement,
  availableSourceAccounts,
  members: _members,
  reservedPlanPenceByAccountId,
  onClose,
  onExecute,
}) => {
  const targetAccount = fundingRequirement.account;
  const requiredPence = fundingRequirement.transferRequiredPence;

  const safeToMovePence = (account: Account): number =>
    Math.max(
      0,
      account.currentBalancePence - (reservedPlanPenceByAccountId[account.id] || 0)
    );

  // Show every active household account except the destination so the user can
  // understand the whole funding picture. Accounts that are not valid cash
  // sources remain visible with a reason instead of silently disappearing.
  const sourceAccounts = availableSourceAccounts.filter(
    (account) => account.isActive !== false && account.id !== targetAccount.id
  );

  const selectableSourceAccounts = sourceAccounts.filter(
    (account) => account.type !== 'credit' && safeToMovePence(account) > 0
  );

  // A funding source is a deliberate user choice. Do not preselect one.
  const [allocations, setAllocations] = useState<AllocationDraft[]>([
    {
      id: 'allocation-1',
      sourceAccountId: '',
      amountStr: (requiredPence / 100).toFixed(2),
    },
  ]);
  const [date, setDate] = useState<string>(localDateInputValue());
  const defaultDescription = `Fund ${targetAccount.name} ${accountTypeLabel(
    targetAccount.type
  )} · ${accountOwnerLabel(targetAccount)}`;
  const [description, setDescription] = useState<string>(defaultDescription);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSourcePickerId, setOpenSourcePickerId] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();

      if (openSourcePickerId) {
        setOpenSourcePickerId(null);
        return;
      }

      onClose();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest('[data-funding-source-picker]')) {
        setOpenSourcePickerId(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose, openSourcePickerId]);

  const allocatedTotalPence = allocations.reduce(
    (sum, allocation) => sum + parseToPence(allocation.amountStr || '0'),
    0
  );
  const remainingPence = requiredPence - allocatedTotalPence;
  const hasSelectedSources =
    allocations.length > 0 && allocations.every((allocation) => Boolean(allocation.sourceAccountId));
  const isFullyAllocated = hasSelectedSources && allocatedTotalPence === requiredPence;

  const usedSourceIds = new Set(
    allocations.map((allocation) => allocation.sourceAccountId).filter(Boolean)
  );

  const sourceDisabledReason = (account: Account, currentAllocationId: string): string | null => {
    if (account.type === 'credit') {
      return 'Credit/liability account — not a cash funding source';
    }

    const safePence = safeToMovePence(account);
    if (safePence <= 0) {
      return 'No safe-to-move balance';
    }

    const currentAllocation = allocations.find(
      (allocation) => allocation.id === currentAllocationId
    );
    const usedElsewhere =
      usedSourceIds.has(account.id) &&
      currentAllocation?.sourceAccountId !== account.id;

    if (usedElsewhere) {
      return 'Already selected in another source row';
    }

    return null;
  };

  const canAddAnotherSource = selectableSourceAccounts.some(
    (account) => !usedSourceIds.has(account.id)
  );

  const updateAllocation = (
    id: string,
    patch: Partial<Pick<AllocationDraft, 'sourceAccountId' | 'amountStr'>>
  ) => {
    setAllocations((current) =>
      current.map((allocation) =>
        allocation.id === id ? { ...allocation, ...patch } : allocation
      )
    );
  };

  const addAllocation = () => {
    setAllocations((current) => {
      const currentTotalPence = current.reduce(
        (sum, allocation) => sum + parseToPence(allocation.amountStr || '0'),
        0
      );
      const amountRemainingPence = Math.max(0, requiredPence - currentTotalPence);

      return [
        ...current,
        {
          id: `allocation-${Date.now()}-${current.length + 1}`,
          sourceAccountId: '',
          amountStr:
            amountRemainingPence > 0 ? (amountRemainingPence / 100).toFixed(2) : '',
        },
      ];
    });
  };

  const removeAllocation = (id: string) => {
    setAllocations((current) => current.filter((allocation) => allocation.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (allocations.length === 0) {
      setError('Add at least one funding source.');
      return;
    }

    const parsedAllocations = allocations.map((allocation) => ({
      sourceAccountId: allocation.sourceAccountId,
      amountPence: parseToPence(allocation.amountStr || '0'),
    }));

    if (parsedAllocations.some((allocation) => !allocation.sourceAccountId)) {
      setError('Choose a source account for every funding amount.');
      return;
    }

    const uniqueSources = new Set(parsedAllocations.map((allocation) => allocation.sourceAccountId));
    if (uniqueSources.size !== parsedAllocations.length) {
      setError('Use each source account once. Change its amount instead of adding it twice.');
      return;
    }

    if (parsedAllocations.some((allocation) => allocation.amountPence <= 0)) {
      setError('Every funding amount must be greater than £0.00.');
      return;
    }

    for (const allocation of parsedAllocations) {
      const source = selectableSourceAccounts.find(
        (account) => account.id === allocation.sourceAccountId
      );
      if (!source) {
        setError('One selected source account is no longer available.');
        return;
      }
      const safePence = safeToMovePence(source);
      if (allocation.amountPence > safePence) {
        setError(
          `${accountIdentityLabel(source)} has only ${formatPence(
            safePence
          )} safe to move after its own selected bills.`
        );
        return;
      }
    }

    if (allocatedTotalPence !== requiredPence) {
      setError(
        remainingPence > 0
          ? `Allocate another ${formatPence(remainingPence)}.`
          : `Reduce allocations by ${formatPence(Math.abs(remainingPence))}.`
      );
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onExecute({
        destinationAccountId: targetAccount.id,
        expectedTotalPence: requiredPence,
        allocations: parsedAllocations,
        description: description.trim() || defaultDescription,
        date,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record Transfer Plan funding');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mv-modal-backdrop mv-funding-modal-backdrop">
      <div
        className="mv-modal-card mv-modal-wide mv-funding-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="funding-modal-title"
        aria-describedby="funding-modal-summary"
      >
        <div className="mv-modal-header mv-funding-modal-header">
          <div className="min-w-0">
            <h3 id="funding-modal-title" className="text-base font-semibold text-main">
              Record funding transfer
            </h3>
            <p className="mv-funding-modal-kicker">
              Choose the source account and record the exact transfer.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mv-modal-close"
            aria-label="Close funding transfer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mv-modal-form mv-funding-modal-form">
          <div className="mv-funding-modal-scroll">
            <div
              id="funding-modal-summary"
              className="mv-modal-section mv-funding-modal-summary bg-warning-soft border-warning"
            >
              <div className="mv-funding-summary-grid">
                <div className="min-w-0">
                  <span className="text-xs font-medium text-warning uppercase tracking-wide">
                    Needs funding
                  </span>
                  <div className="mt-1 text-base font-semibold text-main">
                    {accountIdentityLabel(targetAccount)}
                  </div>
                  <div className="mv-private-value mt-1 text-sm text-muted">
                    Current balance {formatPence(targetAccount.currentBalancePence)}
                  </div>
                </div>

                <div className="mv-funding-summary-stat">
                  <span className="text-xs font-medium text-muted">Selected bills</span>
                  <strong className="mv-private-value">
                    {formatPence(fundingRequirement.totalSelectedPaymentsPence)}
                  </strong>
                </div>

                <div className="mv-funding-summary-stat is-required">
                  <span className="text-xs font-medium text-warning">Transfer required</span>
                  <strong className="mv-private-value text-warning">
                    {formatPence(requiredPence)}
                  </strong>
                </div>
              </div>
            </div>

            {error && (
              <div
                className="mv-funding-modal-error bg-danger-soft border border-danger text-danger"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <section className="mv-modal-section mv-funding-sources-section">
              <div className="mv-funding-section-header">
                <div>
                  <h4 className="mv-funding-section-title">Funding sources</h4>
                  <p className="mv-funding-section-help">
                    Choose where the money comes from. Safe-to-move balances already protect other selected bills.
                  </p>
                </div>
                {canAddAnotherSource && (
                  <button
                    type="button"
                    onClick={addAllocation}
                    className="mv-funding-add-source"
                  >
                    <Plus className="w-4 h-4" />
                    Add another source
                  </button>
                )}
              </div>

              {selectableSourceAccounts.length === 0 && (
                <div className="mv-funding-empty-state">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>No eligible account currently has money that is safe to move.</span>
                </div>
              )}

              <div className="mv-funding-allocation-list">
                {allocations.map((allocation, index) => {
                  const source = sourceAccounts.find(
                    (account) => account.id === allocation.sourceAccountId
                  );
                  const allocationPence = parseToPence(allocation.amountStr || '0');

                  return (
                    <div key={allocation.id} className="mv-funding-allocation-card">
                      <div className="mv-funding-allocation-grid">
                        <div className="min-w-0">
                          <label htmlFor={`funding-source-${allocation.id}`}>
                            {index === 0 ? 'Money from' : `Money from ${index + 1}`}
                          </label>
                          <div
                            className="mv-funding-source-picker"
                            data-funding-source-picker
                          >
                            <button
                              id={`funding-source-${allocation.id}`}
                              type="button"
                              autoFocus={index === 0}
                              className="mv-funding-source-trigger"
                              aria-haspopup="listbox"
                              aria-expanded={openSourcePickerId === allocation.id}
                              onClick={() =>
                                setOpenSourcePickerId((current) =>
                                  current === allocation.id ? null : allocation.id
                                )
                              }
                            >
                              <span className="mv-funding-source-trigger-copy">
                                <strong>
                                  {source ? accountIdentityLabel(source) : 'Choose account'}
                                </strong>
                                <span>
                                  {source
                                    ? `Safe to move ${formatPence(safeToMovePence(source))}`
                                    : `${sourceAccounts.length} account${sourceAccounts.length === 1 ? '' : 's'} available`}
                                </span>
                              </span>
                              <ChevronDown className="h-4 w-4 shrink-0" />
                            </button>

                            {openSourcePickerId === allocation.id && (
                              <div
                                className="mv-funding-source-menu"
                                role="listbox"
                                aria-labelledby={`funding-source-${allocation.id}`}
                              >
                                {sourceAccounts.map((account) => {
                                  const disabledReason = sourceDisabledReason(
                                    account,
                                    allocation.id
                                  );
                                  const isSelected =
                                    allocation.sourceAccountId === account.id;

                                  return (
                                    <button
                                      key={account.id}
                                      type="button"
                                      role="option"
                                      aria-selected={isSelected}
                                      disabled={Boolean(disabledReason)}
                                      className="mv-funding-source-option"
                                      onClick={() => {
                                        updateAllocation(allocation.id, {
                                          sourceAccountId: account.id,
                                        });
                                        setOpenSourcePickerId(null);
                                        setError(null);
                                      }}
                                    >
                                      <span className="mv-funding-source-option-copy">
                                        <strong>{accountIdentityLabel(account)}</strong>
                                        <span
                                          className={
                                            disabledReason
                                              ? 'text-subtle'
                                              : 'finance-semantic-positive'
                                          }
                                        >
                                          {disabledReason ||
                                            `Safe to move ${formatPence(safeToMovePence(account))}`}
                                        </span>
                                      </span>
                                      {isSelected && (
                                        <span className="mv-funding-source-selected">Selected</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <label htmlFor={`funding-amount-${allocation.id}`}>Amount</label>
                          <div className="mv-funding-money-field">
                            <span className="mv-money-prefix">£</span>
                            <input
                              id={`funding-amount-${allocation.id}`}
                              type="text"
                              inputMode="decimal"
                              value={allocation.amountStr}
                              onChange={(e) =>
                                updateAllocation(allocation.id, {
                                  amountStr: e.target.value,
                                })
                              }
                              className="mv-money-input-with-prefix"
                              aria-label={`Funding amount from source account ${index + 1}`}
                            />
                          </div>
                        </div>

                        <div className="mv-funding-allocation-actions">
                          {allocations.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeAllocation(allocation.id)}
                              className="mv-funding-remove-source"
                              title="Remove source"
                              aria-label={`Remove funding source ${index + 1}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {source ? (
                        <div className="mv-private-value mv-funding-source-detail">
                          <span>
                            Safe to move <strong>{formatPence(safeToMovePence(source))}</strong>
                          </span>
                          {(reservedPlanPenceByAccountId[source.id] || 0) > 0 && (
                            <span>
                              Balance {formatPence(source.currentBalancePence)} · Reserved{' '}
                              {formatPence(reservedPlanPenceByAccountId[source.id] || 0)}
                            </span>
                          )}
                          {allocationPence > safeToMovePence(source) && (
                            <span className="text-danger font-semibold">Exceeds safe amount</span>
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="mv-funding-allocation-summary">
                <span className="mv-funding-summary-label">Allocation</span>
                <div className="mv-private-value mv-funding-allocation-status">
                  <span>
                    {hasSelectedSources
                      ? `${formatPence(allocatedTotalPence)} of ${formatPence(requiredPence)}`
                      : `Required ${formatPence(requiredPence)}`}
                  </span>
                  <strong
                    className={
                      !hasSelectedSources
                        ? 'text-muted'
                        : remainingPence === 0
                          ? 'text-success'
                          : remainingPence > 0
                            ? 'text-warning'
                            : 'text-danger'
                    }
                  >
                    {!hasSelectedSources
                      ? 'Choose a source account'
                      : remainingPence === 0
                        ? 'Ready to record'
                        : remainingPence > 0
                          ? `${formatPence(remainingPence)} remaining`
                          : `${formatPence(Math.abs(remainingPence))} over allocated`}
                  </strong>
                </div>
              </div>
            </section>

            <section className="mv-funding-details-grid" aria-label="Transfer details">
              <div>
                <label htmlFor="funding-transfer-date">Transfer date</label>
                <input
                  id="funding-transfer-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label htmlFor="funding-transfer-note">
                  Transfer note <span className="mv-funding-optional">(optional)</span>
                </label>
                <input
                  id="funding-transfer-note"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={defaultDescription}
                />
              </div>
            </section>
          </div>

          <div className="mv-modal-actions mv-funding-modal-actions">
            <div className="mv-funding-footer-status" aria-live="polite">
              {!hasSelectedSources
                ? 'Choose a funding source'
                : remainingPence === 0
                  ? 'Ready to record'
                  : remainingPence > 0
                    ? `${formatPence(remainingPence)} left to allocate`
                    : `${formatPence(Math.abs(remainingPence))} over allocated`}
            </div>

            <div className="mv-funding-footer-buttons">
              <button
                type="button"
                onClick={onClose}
                className="mv-funding-cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isFullyAllocated}
                className="mv-funding-submit"
              >
                {isSubmitting ? 'Recording…' : 'Record transfer'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
