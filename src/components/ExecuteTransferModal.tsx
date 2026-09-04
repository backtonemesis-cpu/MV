import React, { useMemo, useState } from 'react';
import { X, ArrowRight, AlertCircle } from 'lucide-react';
import { Account, AccountFundingRequirement, HouseholdMember } from '../types';
import { householdPersonOptions } from '../utils/householdPeople';
import { accountDisplayLabel, accountDisplayLabelWithBalance } from '../utils/accountLabels';
import { formatPence, parseToPence } from '../utils/currency';

interface ExecuteTransferModalProps {
  fundingRequirement: AccountFundingRequirement;
  availableSourceAccounts: Account[];
  members: HouseholdMember[];
  defaultSourceAccountId?: string;
  onClose: () => void;
  onExecute: (payload: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountPence: number;
    description: string;
    date: string;
    payer: string;
  }) => Promise<void>;
}

export const ExecuteTransferModal: React.FC<ExecuteTransferModalProps> = ({
  fundingRequirement,
  availableSourceAccounts,
  members,
  defaultSourceAccountId,
  onClose,
  onExecute,
}) => {
  const targetAccount = fundingRequirement.account;

  const eligibleSources = useMemo(
    () =>
      availableSourceAccounts.filter(
        (account) =>
          account.isActive !== false &&
          account.type !== 'credit' &&
          account.id !== targetAccount.id &&
          account.currentBalancePence > 0
      ),
    [availableSourceAccounts, targetAccount.id]
  );

  const initialSource = eligibleSources.find((account) => account.id === defaultSourceAccountId);

  const [sourceAccountId, setSourceAccountId] = useState<string>(initialSource?.id || '');
  const [amountStr, setAmountStr] = useState<string>(
    (fundingRequirement.transferRequiredPence / 100).toFixed(2)
  );
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>(
    `Transfer Plan: Fund ${accountDisplayLabel(targetAccount)}`
  );
  const [payer, setPayer] = useState<string>(initialSource?.ownerPerson || 'Joint');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSourceAccount = eligibleSources.find((account) => account.id === sourceAccountId);
  const personOptions = householdPersonOptions(members, [
    payer,
    selectedSourceAccount?.ownerPerson,
    targetAccount.ownerPerson,
  ]);
  const enteredPence = parseToPence(amountStr);

  const handleSourceChange = (accountId: string) => {
    setSourceAccountId(accountId);
    const source = eligibleSources.find((account) => account.id === accountId);
    if (source?.ownerPerson) setPayer(source.ownerPerson);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedSourceAccount) {
      setError('Please select the account that will fund this transfer.');
      return;
    }
    if (enteredPence <= 0) {
      setError('Transfer amount must be greater than £0.00.');
      return;
    }
    if (enteredPence > selectedSourceAccount.currentBalancePence) {
      setError('The selected funding account does not have enough available balance.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onExecute({
        sourceAccountId: selectedSourceAccount.id,
        destinationAccountId: targetAccount.id,
        amountPence: enteredPence,
        description,
        date,
        payer,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to execute transfer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-xs">
      <div className="bg-surface rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-muted">
        <div className="flex items-center justify-between px-6 py-4 border-b border-muted bg-surface-muted">
          <div>
            <h3 className="text-base font-semibold text-main">Transfer Funds</h3>
            <p className="mt-0.5 text-xs text-muted">
              {accountDisplayLabel(targetAccount)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted text-subtle hover:text-muted hover:bg-surface-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-4 bg-warning-soft border-b border-warning">
          <div className="flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-warning uppercase tracking-wide">
                Needs Funding
              </span>
              <div className="text-xs text-muted mt-1">
                Balance: {formatPence(targetAccount.currentBalancePence)} · Unpaid bills:{' '}
                {formatPence(fundingRequirement.totalSelectedPaymentsPence)}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-warning">Required</span>
              <div className="text-lg font-bold text-warning">
                {formatPence(fundingRequirement.transferRequiredPence)}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-danger-soft border border-danger rounded-lg flex items-start gap-2 text-danger text-xs">
              <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-surface-muted rounded-lg border border-muted items-center">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Funding account</label>
              <select
                value={sourceAccountId}
                onChange={(event) => handleSourceChange(event.target.value)}
                className="w-full text-xs font-medium border border-muted rounded-md p-2 bg-surface focus:ring-1 focus:ring-muted focus:outline-none"
                required
              >
                <option value="">Select funding account</option>
                {eligibleSources.map((account) => (
                  <option key={account.id} value={account.id}>
                    {accountDisplayLabelWithBalance(account, formatPence)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">Destination</label>
              <div className="p-2 border border-muted bg-surface rounded-md text-xs font-semibold text-main">
                {accountDisplayLabel(targetAccount)}
              </div>
            </div>
          </div>

          {eligibleSources.length === 0 && (
            <div className="text-xs text-danger">
              No active non-credit account with a positive balance is available to fund this transfer.
            </div>
          )}

          {selectedSourceAccount && (
            <div className="text-xs text-muted flex justify-between gap-3 px-1">
              <span>Available: {formatPence(selectedSourceAccount.currentBalancePence)}</span>
              {selectedSourceAccount.currentBalancePence < enteredPence && (
                <span className="text-danger font-medium">Amount exceeds available balance</span>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-muted text-subtle font-medium">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amountStr}
                  onChange={(event) => setAmountStr(event.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-sm font-semibold border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">Transfer Date</label>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-muted mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">By</label>
              <select
                value={payer}
                onChange={(event) => setPayer(event.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-muted rounded-md bg-surface focus:ring-1 focus:ring-muted focus:outline-none"
              >
                {personOptions.map((person) => (
                  <option key={person} value={person}>
                    {person}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
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
                !selectedSourceAccount ||
                enteredPence <= 0 ||
                enteredPence > selectedSourceAccount.currentBalancePence
              }
              className="px-4 py-2 text-xs font-medium text-on-accent bg-surface hover:bg-surface-muted rounded-md shadow-xs disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {isSubmitting ? 'Transferring...' : 'Transfer'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
