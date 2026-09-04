import React, { useEffect, useState } from 'react';
import { X, ArrowRight, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { Account, AccountFundingRequirement, HouseholdMember } from '../types';
import { formatPence, parseToPence } from '../utils/currency';

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
  defaultSourceAccountId,
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

  const rememberedSource = eligibleSources.find(
    (account) => account.id === defaultSourceAccountId
  );

  const [allocations, setAllocations] = useState<AllocationDraft[]>([
    {
      id: 'allocation-1',
      sourceAccountId: rememberedSource?.id || '',
      amountStr: (requiredPence / 100).toFixed(2),
    },
  ]);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>(
    `Transfer Plan: Fund ${targetAccount.name}`
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

  const usedSourceIds = new Set(
    allocations.map((allocation) => allocation.sourceAccountId).filter(Boolean)
  );

  const ownerNames = Array.from(
    new Set(
      allocations
        .map((allocation) =>
          eligibleSources.find((account) => account.id === allocation.sourceAccountId)
        )
        .map((account) => account?.ownerPerson)
        .filter((value): value is string => Boolean(value))
    )
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
      setError('Please add at least one funding account.');
      return;
    }

    const parsedAllocations = allocations.map((allocation) => ({
      sourceAccountId: allocation.sourceAccountId,
      amountPence: parseToPence(allocation.amountStr || '0'),
    }));

    if (parsedAllocations.some((allocation) => !allocation.sourceAccountId)) {
      setError('Please select an account for every funding allocation.');
      return;
    }

    const uniqueSources = new Set(parsedAllocations.map((allocation) => allocation.sourceAccountId));
    if (uniqueSources.size !== parsedAllocations.length) {
      setError('Use each funding account only once. Adjust its amount instead of adding it twice.');
      return;
    }

    if (parsedAllocations.some((allocation) => allocation.amountPence <= 0)) {
      setError('Every funding allocation must be greater than £0.00.');
      return;
    }

    for (const allocation of parsedAllocations) {
      const source = eligibleSources.find(
        (account) => account.id === allocation.sourceAccountId
      );
      if (!source) {
        setError('One of the selected funding accounts is no longer available.');
        return;
      }
      if (allocation.amountPence > source.currentBalancePence) {
        setError(
          `${source.name} (${source.ownerPerson || source.type}) does not have enough available balance.`
        );
        return;
      }
    }

    if (allocatedTotalPence !== requiredPence) {
      setError(
        remainingPence > 0
          ? `Allocate another ${formatPence(remainingPence)} so the funding total matches the amount required.`
          : `Allocations exceed the amount required by ${formatPence(Math.abs(remainingPence))}.`
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
        description,
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
        {/* Modal Header */}
        <div className="mv-modal-header">
          <div>
            <h3 className="text-base font-semibold text-main">Transfer Funds</h3>
          </div>
          <button
            onClick={onClose}
            className="mv-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transfer Context Card — original visual structure retained */}
        <div className="mv-modal-section mx-3 mt-3 bg-warning-soft border-warning">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-warning uppercase tracking-wide">
                Needs Funding
              </span>
              <div className="text-sm font-semibold text-main mt-0.5">
                {targetAccount.name} ({targetAccount.ownerPerson || targetAccount.type})
              </div>
              <div className="text-xs text-muted mt-0.5">
                Balance: {formatPence(targetAccount.currentBalancePence)} · Bills:{' '}
                {formatPence(fundingRequirement.totalSelectedPaymentsPence)}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-warning">Required</span>
              <div className="text-lg font-bold text-warning">
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

          {/* Funding allocations: one source works as before; add rows only when needed. */}
          <div className="mv-modal-section space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-main">Funding account</div>
              </div>
              {allocations.length < eligibleSources.length && (
                <button
                  type="button"
                  onClick={addAllocation}
                  className="shrink-0 px-2.5 py-1.5 text-[11px] font-semibold text-muted bg-surface border border-muted rounded-lg hover:bg-surface-muted transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  Add account
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
                    <div className="grid grid-cols-[minmax(0,1fr)_120px_auto] gap-2 items-end">
                      <div>
                        <label className="block text-[11px] font-medium text-muted mb-1">
                          {index === 0 ? 'From Account' : `Funding Account ${index + 1}`}
                        </label>
                        <select
                          autoFocus={index === 0}
                          value={allocation.sourceAccountId}
                          onChange={(e) =>
                            updateAllocation(allocation.id, {
                              sourceAccountId: e.target.value,
                            })
                          }
                          className="w-full text-xs font-medium border border-muted rounded-md p-2 bg-surface focus:ring-1 focus:ring-muted focus:outline-none"
                        >
                          <option value="">Select account</option>
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
                                {account.name} ({account.ownerPerson || account.type}) ·{' '}
                                {formatPence(account.currentBalancePence)}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-muted mb-1">
                          Amount
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-2 text-xs text-subtle">£</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={allocation.amountStr}
                            onChange={(e) =>
                              updateAllocation(allocation.id, {
                                amountStr: e.target.value,
                              })
                            }
                            className="w-full pl-6 pr-2 py-1.5 text-xs font-semibold border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="pb-0.5">
                        {allocations.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeAllocation(allocation.id)}
                            className="p-2 rounded-md text-subtle hover:text-danger hover:bg-danger-soft transition-colors"
                            title="Remove funding account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="w-[30px]" />
                        )}
                      </div>
                    </div>

                    {source && (
                      <div className="mt-1.5 flex justify-between gap-2 text-[10px] text-subtle">
                        <span>
                          Available: {formatPence(source.currentBalancePence)} · By:{' '}
                          {source.ownerPerson || 'Joint'}
                        </span>
                        {allocationPence > source.currentBalancePence && (
                          <span className="text-danger font-medium">Exceeds balance</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1 text-xs">
              <span className="text-muted">
                To: <span className="font-semibold text-main">{targetAccount.name} ({targetAccount.ownerPerson || targetAccount.type})</span>
              </span>
              <div className="text-right">
                <div className="font-semibold text-main">
                  Allocated: {formatPence(allocatedTotalPence)}
                </div>
                <div
                  className={
                    remainingPence === 0
                      ? 'text-success'
                      : remainingPence > 0
                        ? 'text-warning'
                        : 'text-danger'
                  }
                >
                  {remainingPence === 0
                    ? 'Fully allocated'
                    : remainingPence > 0
                      ? `Remaining: ${formatPence(remainingPence)}`
                      : `Over: ${formatPence(Math.abs(remainingPence))}`}
                </div>
              </div>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Transfer Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
              required
            />
          </div>

          {/* Description & Person — same compact visual footprint; attribution is derived safely. */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">By</label>
              <div className="w-full min-h-[30px] px-2 py-1.5 text-xs border border-muted rounded-md bg-surface-muted text-main">
                {ownerNames.length > 0 ? ownerNames.join(' + ') : 'From account'}
              </div>
            </div>
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
              disabled={
                isSubmitting ||
                allocations.length === 0 ||
                allocatedTotalPence !== requiredPence ||
                allocations.some((allocation) => !allocation.sourceAccountId)
              }
              className="inline-flex items-center gap-1.5 bg-accent text-on-accent font-semibold disabled:opacity-50"
            >
              {isSubmitting ? 'Recording...' : 'Transfer'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
