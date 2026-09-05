import React, { useEffect, useState } from 'react';
import { X, ArrowRight, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Account, AccountFundingRequirement, HouseholdMember } from '../types';
import { formatPence, parseToPence } from '../utils/currency';
import {
  accountIdentityLabel,
  accountOptionLabel,
  accountOwnerLabel,
  accountTypeLabel,
} from '../utils/accountDisplay';
import { localDateInputValue } from '../utils/dateInput';

interface ExecuteTransferModalProps {
  fundingRequirement: AccountFundingRequirement;
  availableSourceAccounts: Account[];
  members: HouseholdMember[];
  defaultSourceAccountId?: string;
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
  defaultSourceAccountId: _defaultSourceAccountId,
  onClose,
  onExecute,
}) => {
  const targetAccount = fundingRequirement.account;
  const requiredPence = fundingRequirement.transferRequiredPence;

  const eligibleSources = availableSourceAccounts.filter(
    (account) =>
      account.isActive !== false &&
      account.type !== 'credit' &&
      account.id !== targetAccount.id &&
      account.currentBalancePence > 0
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
  const [description, setDescription] = useState<string>(
    `Fund ${targetAccount.name} ${accountTypeLabel(targetAccount.type)} · ${accountOwnerLabel(
      targetAccount
    )}`
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

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
    setAllocations((current) => [
      ...current,
      {
        id: `allocation-${Date.now()}-${current.length + 1}`,
        sourceAccountId: '',
        amountStr: '',
      },
    ]);
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
      const source = eligibleSources.find(
        (account) => account.id === allocation.sourceAccountId
      );
      if (!source) {
        setError('One selected source account is no longer available.');
        return;
      }
      if (allocation.amountPence > source.currentBalancePence) {
        setError(
          `${accountIdentityLabel(source)} does not have enough available balance.`
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
        description: description.trim(),
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
    <div className="mv-modal-backdrop">
      <div className="mv-modal-card">
        <div className="mv-modal-header">
          <div>
            <h3 className="text-base font-semibold text-main">Record Funding Transfer</h3>
          </div>
          <button onClick={onClose} className="mv-modal-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mv-modal-section mx-3 mt-3 bg-warning-soft border-warning">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="text-xs font-medium text-warning uppercase tracking-wide">
                Needs funding
              </span>
              <div className="mt-0.5 text-sm font-semibold text-main">
                {accountIdentityLabel(targetAccount)}
              </div>
              <div className="mv-private-value mt-0.5 text-xs text-muted">
                Balance {formatPence(targetAccount.currentBalancePence)} · Selected bills{' '}
                {formatPence(fundingRequirement.totalSelectedPaymentsPence)}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-xs font-medium text-warning">Required</span>
              <div className="mv-private-value text-lg font-bold text-warning">
                {formatPence(requiredPence)}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mv-modal-form">
          {error && (
            <div className="p-3 bg-danger-soft border border-danger rounded-lg flex items-start gap-2 text-danger text-xs">
              <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="mv-modal-section space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-main">Funding sources</div>
              {allocations.length < eligibleSources.length && (
                <button
                  type="button"
                  onClick={addAllocation}
                  className="shrink-0 px-2.5 py-1.5 text-[11px] font-semibold text-muted bg-surface border border-muted rounded-lg hover:bg-surface-muted transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add source
                </button>
              )}
            </div>

            <div className="space-y-2">
              {allocations.map((allocation, index) => {
                const source = eligibleSources.find(
                  (account) => account.id === allocation.sourceAccountId
                );
                const allocationPence = parseToPence(allocation.amountStr || '0');

                return (
                  <div key={allocation.id} className="rounded-lg border border-muted bg-surface p-2.5">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(150px,180px)_auto] sm:items-end">
                      <div className="min-w-0">
                        <label className="block text-[11px] font-medium text-muted mb-1">
                          {index === 0 ? 'Source account' : `Source account ${index + 1}`}
                        </label>
                        <select
                          autoFocus={index === 0}
                          value={allocation.sourceAccountId}
                          onChange={(e) =>
                            updateAllocation(allocation.id, {
                              sourceAccountId: e.target.value,
                            })
                          }
                          className="w-full min-w-0 text-xs font-medium border border-muted rounded-md p-2 bg-surface focus:ring-1 focus:ring-muted focus:outline-none"
                          required
                        >
                          <option value="">Select source account</option>
                          {eligibleSources.map((account) => {
                            const usedElsewhere =
                              usedSourceIds.has(account.id) &&
                              account.id !== allocation.sourceAccountId;
                            return (
                              <option
                                key={account.id}
                                value={account.id}
                                disabled={usedElsewhere}
                              >
                                {accountOptionLabel(account)}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="min-w-0">
                        <label className="block text-[11px] font-medium text-muted mb-1">
                          Amount
                        </label>
                        <div className="relative min-w-0">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-subtle">
                            £
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={allocation.amountStr}
                            onChange={(e) =>
                              updateAllocation(allocation.id, {
                                amountStr: e.target.value,
                              })
                            }
                            className="mv-money-input-with-prefix w-full min-w-0 text-xs font-semibold tabular-nums border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
                            aria-label={`Funding amount from source account ${index + 1}`}
                          />
                        </div>
                      </div>

                      <div className="flex items-end justify-end sm:pb-0.5">
                        {allocations.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeAllocation(allocation.id)}
                            className="p-2 rounded-md text-subtle hover:text-danger hover:bg-danger-soft transition-colors"
                            title="Remove source"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="hidden w-[30px] sm:block" />
                        )}
                      </div>
                    </div>

                    {source ? (
                      <div className="mt-2 flex flex-col gap-1 text-[10px] text-subtle sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <span className="font-medium text-main">{accountIdentityLabel(source)}</span>
                          <span className="mx-1.5">→</span>
                          <span className="font-medium text-main">{accountIdentityLabel(targetAccount)}</span>
                        </div>
                        <div className="mv-private-value shrink-0">
                          Available {formatPence(source.currentBalancePence)}
                          {allocationPence > source.currentBalancePence && (
                            <span className="ml-2 text-danger font-medium">Exceeds balance</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-[10px] text-subtle">
                        Choose the account the money will come from.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 pt-1 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-1.5 text-muted">
                <span>To</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-subtle" />
                <span className="font-semibold text-main">
                  {accountIdentityLabel(targetAccount)}
                </span>
              </div>
              <div className="mv-private-value text-left sm:text-right">
                <div className="font-semibold text-main">
                  Allocated {formatPence(allocatedTotalPence)} of {formatPence(requiredPence)}
                </div>
                <div
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
                    ? 'Choose source account'
                    : remainingPence === 0
                      ? 'Ready to record'
                      : remainingPence > 0
                        ? `${formatPence(remainingPence)} remaining`
                        : `${formatPence(Math.abs(remainingPence))} over`}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Transfer date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Transfer note</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
              required
            />
          </div>

          <div className="mv-modal-actions">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-muted hover:bg-surface-muted rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isFullyAllocated}
              className="inline-flex items-center gap-1.5 bg-accent text-on-accent font-semibold disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : 'Record transfer'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
