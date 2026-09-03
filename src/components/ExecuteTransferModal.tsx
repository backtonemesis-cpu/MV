import React, { useState } from 'react';
import { X, ArrowRight, CheckCircle, AlertCircle } from 'lucide-react';
import { Account, AccountFundingRequirement } from '../types';
import { formatPence, parseToPence } from '../utils/currency';

interface ExecuteTransferModalProps {
  fundingRequirement: AccountFundingRequirement;
  availableSourceAccounts: Account[];
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
  onClose,
  onExecute,
}) => {
  const targetAccount = fundingRequirement.account;
  const initialSource = availableSourceAccounts.find((a) => a.id !== targetAccount.id);

  const [sourceAccountId, setSourceAccountId] = useState<string>(initialSource?.id || '');
  const [amountStr, setAmountStr] = useState<string>(
    (fundingRequirement.transferRequiredPence / 100).toFixed(2)
  );
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>(
    `Transfer Plan: Fund ${targetAccount.name}`
  );
  const [payer, setPayer] = useState<string>(targetAccount.ownerPerson || 'Joint');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSourceAccount = availableSourceAccounts.find((a) => a.id === sourceAccountId);
  const enteredPence = parseToPence(amountStr);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceAccountId) {
      setError('Please select a source account to fund from.');
      return;
    }
    if (enteredPence <= 0) {
      setError('Transfer amount must be greater than £0.00.');
      return;
    }
    if (sourceAccountId === targetAccount.id) {
      setError('Source and destination accounts must be distinct.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onExecute({
        sourceAccountId,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-neutral-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 bg-neutral-50">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">Execute Funding Transfer</h3>
            <p className="text-xs text-neutral-500">
              Move funds to cover upcoming scheduled payments
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transfer Context Card */}
        <div className="px-6 py-4 bg-amber-50/60 border-b border-amber-100">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-amber-800 uppercase tracking-wide">
                Destination Deficit
              </span>
              <div className="text-sm font-semibold text-neutral-900 mt-0.5">
                {targetAccount.name}
              </div>
              <div className="text-xs text-neutral-600 mt-0.5">
                Current balance: {formatPence(targetAccount.currentBalancePence)} · Selected bills:{' '}
                {formatPence(fundingRequirement.totalSelectedPaymentsPence)}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-medium text-amber-800">Required</span>
              <div className="text-lg font-bold text-amber-900">
                {formatPence(fundingRequirement.transferRequiredPence)}
              </div>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Transfer Route Visualizer */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-50 rounded-lg border border-neutral-200 items-center">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">From Account</label>
              <select
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
                className="w-full text-xs font-medium border border-neutral-300 rounded-md p-2 bg-white focus:ring-1 focus:ring-neutral-900 focus:outline-none"
              >
                <option value="">Select funding source...</option>
                {availableSourceAccounts
                  .filter((a) => a.id !== targetAccount.id)
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatPence(acc.currentBalancePence)})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">To Account</label>
              <div className="p-2 border border-neutral-200 bg-neutral-100 rounded-md text-xs font-semibold text-neutral-800 truncate">
                {targetAccount.name}
              </div>
            </div>
          </div>

          {selectedSourceAccount && (
            <div className="text-xs text-neutral-500 flex justify-between px-1">
              <span>Source available: {formatPence(selectedSourceAccount.currentBalancePence)}</span>
              {selectedSourceAccount.currentBalancePence < enteredPence && (
                <span className="text-rose-600 font-medium">Warning: Exceeds source balance</span>
              )}
            </div>
          )}

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Amount to Transfer (£)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-neutral-400 font-medium">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-sm font-semibold border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Transfer Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Description & Person */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-neutral-300 rounded-md focus:ring-1 focus:ring-neutral-900 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Authorized By</label>
              <select
                value={payer}
                onChange={(e) => setPayer(e.target.value)}
                className="w-full px-2 py-1.5 text-xs border border-neutral-300 rounded-md bg-white focus:ring-1 focus:ring-neutral-900 focus:outline-none"
              >
                <option value="Marius">Marius</option>
                <option value="Vesta">Vesta</option>
                <option value="Joint">Joint</option>
              </select>
            </div>
          </div>

          {/* Accounting Rule Notice */}
          <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 text-xs text-neutral-600 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-neutral-800">Household Accounting Rule:</span> Internal
              transfers between household accounts do not count as living expenses or gross income.
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !sourceAccountId || enteredPence <= 0}
              className="px-4 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-md shadow-xs disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {isSubmitting ? 'Transferring...' : 'Execute Transfer'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
