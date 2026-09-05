import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Plus, Trash2, Split } from 'lucide-react';
import { Transaction, Account, Category, Payer, TransactionType, TransactionSplit, HouseholdMember } from '../types';
import { householdPersonOptions } from '../utils/householdPeople';
import { formatPence, parseToPence } from '../utils/currency';
import { accountOptionLabel } from '../utils/accountDisplay';
import { localDateInputValue } from '../utils/dateInput';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (txData: Partial<Transaction>) => Promise<void>;
  initialTransaction?: Transaction | null;
  accounts: Account[];
  categories: Category[];
  members: HouseholdMember[];
  isSubmitting: boolean;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTransaction,
  accounts,
  categories,
  members,
  isSubmitting,
}) => {
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [type, setType] = useState<TransactionType | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [payer, setPayer] = useState<Payer | ''>('');
  const [date, setDate] = useState(localDateInputValue());
  const [notes, setNotes] = useState('');
  const [isTransfer, setIsTransfer] = useState(false);
  const [isRepayment, setIsRepayment] = useState(false);
  const [isSavings, setIsSavings] = useState(false);
  const [isRefund, setIsRefund] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Split transaction state
  const [isSplitEnabled, setIsSplitEnabled] = useState(false);
  const [splits, setSplits] = useState<{ categoryId: string; amountStr: string; notes?: string }[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (initialTransaction) {
      setDescription(initialTransaction.description);
      setAmountStr((initialTransaction.amountPence / 100).toFixed(2));
      setType(initialTransaction.type);
      setCategoryId(initialTransaction.categoryId);
      setAccountId(initialTransaction.accountId);
      setTargetAccountId(initialTransaction.targetAccountId || '');
      setPayer(initialTransaction.payer);
      setDate(initialTransaction.date);
      setNotes(initialTransaction.notes || '');
      setIsTransfer(initialTransaction.isTransfer);
      setIsRepayment(initialTransaction.isRepayment);
      setIsSavings(initialTransaction.isSavings);
      setIsRefund(initialTransaction.isRefund);

      if (initialTransaction.splits && initialTransaction.splits.length > 0) {
        setIsSplitEnabled(true);
        setSplits(
          initialTransaction.splits.map((s) => ({
            categoryId: s.categoryId,
            amountStr: (s.amountPence / 100).toFixed(2),
            notes: s.notes || '',
          }))
        );
      } else {
        setIsSplitEnabled(false);
        setSplits([]);
      }
    } else {
      setDescription('');
      setAmountStr('');
      setType('');
      setCategoryId('');
      setAccountId('');
      setTargetAccountId('');
      setPayer('');
      setDate(localDateInputValue());
      setNotes('');
      setIsTransfer(false);
      setIsRepayment(false);
      setIsSavings(false);
      setIsRefund(false);
      setIsSplitEnabled(false);
      setSplits([]);
    }
    setError(null);
  }, [initialTransaction, isOpen, accounts, categories]);

  const personOptions = householdPersonOptions(
    members,
    [payer, initialTransaction?.payer].filter(
      (value): value is Payer => Boolean(value)
    )
  );

  if (!isOpen) return null;

  // Handle Type change
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'transfer') {
      setIsTransfer(true);
      setIsRepayment(false);
      setIsRefund(false);
      setIsSplitEnabled(false);
    } else if (newType === 'repayment') {
      setIsRepayment(true);
      setIsTransfer(false);
      setIsRefund(false);
      setIsSplitEnabled(false);
    } else if (newType === 'refund') {
      setIsRefund(true);
      setIsTransfer(false);
      setIsRepayment(false);
    } else {
      setIsTransfer(false);
      setIsRepayment(false);
      setIsRefund(false);
    }
  };

  const handleAddSplitRow = () => {
    setSplits((prev) => [...prev, { categoryId: '', amountStr: '', notes: '' }]);
  };

  const handleRemoveSplitRow = (idx: number) => {
    setSplits((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateSplitRow = (
    idx: number,
    field: 'categoryId' | 'amountStr' | 'notes',
    value: string
  ) => {
    setSplits((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!type) {
      setError('Choose the transaction type.');
      return;
    }

    const pence = parseToPence(amountStr);
    if (pence <= 0) {
      setError('Please enter a valid amount greater than £0.00');
      return;
    }

    if (!description.trim()) {
      setError('Please enter a description for the transaction');
      return;
    }

    if (!accountId) {
      setError(isTransfer ? 'Choose the source account.' : 'Choose the account.');
      return;
    }

    if (!isTransfer && !payer) {
      setError(type === 'income' || type === 'refund' ? 'Choose who received it.' : 'Choose who paid it.');
      return;
    }

    if (!isTransfer && !isSplitEnabled && !categoryId) {
      setError('Choose a category.');
      return;
    }

    if (isTransfer && (!targetAccountId || targetAccountId === accountId)) {
      setError('For transfers, select a destination account distinct from the source account.');
      return;
    }

    let finalSplits: TransactionSplit[] | undefined = undefined;

    if (isSplitEnabled && !isTransfer && !isRepayment) {
      if (splits.length === 0) {
        setError('Please add at least one split item or disable category splitting');
        return;
      }

      let splitSumPence = 0;
      const formattedSplits: TransactionSplit[] = [];

      for (let i = 0; i < splits.length; i++) {
        const item = splits[i];
        const itemPence = parseToPence(item.amountStr);
        if (itemPence <= 0) {
          setError(`Split item #${i + 1} must have an amount greater than £0.00`);
          return;
        }
        if (!item.categoryId) {
          setError(`Split item #${i + 1} must have a category selected`);
          return;
        }
        splitSumPence += itemPence;
        formattedSplits.push({
          id: 'split-' + Date.now() + '-' + i,
          categoryId: item.categoryId,
          amountPence: itemPence,
          notes: item.notes?.trim() || undefined,
        });
      }

      if (splitSumPence !== pence) {
        setError(
          `Sum of split items (${formatPence(splitSumPence)}) must exactly equal the total transaction amount (${formatPence(pence)})`
        );
        return;
      }

      finalSplits = formattedSplits;
    }

    const sourceAccount = accounts.find((account) => account.id === accountId);
    const resolvedPayer: Payer = isTransfer
      ? sourceAccount?.ownerPerson || 'Joint'
      : (payer as Payer);

    try {
      await onSave({
        description: description.trim(),
        amountPence: pence,
        type: type as TransactionType,
        categoryId: isTransfer ? undefined : categoryId || undefined,
        accountId,
        targetAccountId: isTransfer || isRepayment ? targetAccountId : undefined,
        payer: resolvedPayer,
        date,
        notes: notes.trim(),
        isTransfer,
        isRepayment,
        isSavings,
        isRefund,
        splits: finalSplits,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction');
    }
  };

  const totalPence = parseToPence(amountStr);
  const currentSplitsTotalPence = splits.reduce(
    (sum, s) => sum + parseToPence(s.amountStr),
    0
  );
  const remainingSplitPence = totalPence - currentSplitsTotalPence;

  return (
    <div className="mv-modal-backdrop">
      <div className="mv-modal-card mv-transaction-modal">
        <div className="mv-modal-header">
          <h2 className="text-base font-bold text-main">
            {initialTransaction ? 'Edit Transaction' : 'New Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="mv-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="mv-modal-scroll-body mv-transaction-body">
          {error && (
            <div className="p-3 bg-danger-soft border border-danger rounded-xl text-xs text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Selector Tabs */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1.5">
              Type
            </label>
            <div className="mv-transaction-type-tabs">
              {(['expense', 'income', 'transfer', 'refund'] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  className={`mv-transaction-type-tab ${type === t ? 'is-active' : ''}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Amount & Date */}
          <div className="mv-modal-grid-2">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-bold text-muted text-subtle">
                  £
                </span>
                <input
                  autoFocus
                  type="text"
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="mv-money-input-with-prefix mv-transaction-control w-full font-semibold tabular-nums"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mv-transaction-control w-full"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Description
            </label>
            <input
              type="text"
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mv-transaction-control w-full"
              required
            />
          </div>

          {/* Person is a deliberate fact for income/expense/refund. Transfers derive owner from source account. */}
          {!isTransfer && (
            <div>
              <label className="block text-xs font-semibold text-muted mb-1.5">
                {type === 'income' || type === 'refund' ? 'Received by' : 'Paid by'}
              </label>
              <div className="flex flex-wrap gap-2">
                {personOptions.map((person) => (
                  <button
                    type="button"
                    key={person}
                    onClick={() => setPayer(person)}
                    className={`mv-transaction-selector-pill ${payer === person ? 'is-active' : ''}`}
                  >
                    {person}
                  </button>
                ))}
              </div>
              {!payer && (
                <div className="mt-1 text-[10px] text-subtle">
                  Select a household member.
                </div>
              )}
            </div>
          )}

          <div className="mv-transaction-dynamic">
          {/* Account Selection */}
          <div className="mv-modal-grid-2">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1">
                {isTransfer ? 'From Account' : 'Account'}
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="mv-transaction-control w-full"
                required
              >
                <option value="">
                  {isTransfer ? 'Select source account' : 'Select account'}
                </option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {accountOptionLabel(acc)}
                  </option>
                ))}
              </select>
            </div>

            {isTransfer && (
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  To Account
                </label>
                <select
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="mv-transaction-control w-full"
                >
                  <option value="">Select account</option>
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {accountOptionLabel(acc)}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {!isTransfer && !isSplitEnabled && (
              <div>
                <label className="block text-xs font-semibold text-muted mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mv-transaction-control w-full"
                  required
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} ({cat.group})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Category Split Option for Expenses & Refunds */}
          {!isTransfer && !isRepayment && (
            <div className="pt-2 border-t border-muted">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!isSplitEnabled && splits.length === 0) {
                      handleAddSplitRow();
                    }
                    setIsSplitEnabled(!isSplitEnabled);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-success hover:text-success"
                >
                  <Split className="w-3.5 h-3.5" />
                  <span>{isSplitEnabled ? 'Remove Splits' : 'Split Categories'}</span>
                </button>

                {isSplitEnabled && (
                  <span
                    className={`text-xs font-bold ${
                      remainingSplitPence === 0
                        ? 'text-success'
                        : remainingSplitPence > 0
                        ? 'text-warning'
                        : 'text-danger'
                    }`}
                  >
                    {remainingSplitPence === 0
                      ? 'Splits balanced'
                      : remainingSplitPence > 0
                      ? `${formatPence(remainingSplitPence)} remaining`
                      : `Over by ${formatPence(Math.abs(remainingSplitPence))}`}
                  </span>
                )}
              </div>

              {isSplitEnabled && (
                <div className="mv-transaction-splits space-y-2">
                  {splits.map((splitRow, idx) => (
                    <div key={idx} className="mv-hscroll items-center">
                      <select
                        value={splitRow.categoryId}
                        onChange={(e) => handleUpdateSplitRow(idx, 'categoryId', e.target.value)}
                        className="mv-transaction-control flex-1"
                        required
                      >
                        <option value="">Select category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>

                      <div className="relative w-36">
                        <span className="absolute left-2 top-1.5 text-xs text-muted text-subtle">£</span>
                        <input
                          type="text"
                          placeholder="0.00"
                          value={splitRow.amountStr}
                          onChange={(e) => handleUpdateSplitRow(idx, 'amountStr', e.target.value)}
                          className="mv-money-input-with-prefix mv-transaction-control w-full font-semibold tabular-nums"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSplitRow(idx)}
                        className="p-1 text-muted text-subtle hover:text-danger transition"
                        title="Remove split"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddSplitRow}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-success mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Split
                  </button>
                </div>
              )}
            </div>
          )}
          </div>

          {/* Financial Options */}
          <div className="mv-integrity-flags">
            <span className="mv-integrity-title">
              Integrity Flags
            </span>

            <label className="mv-integrity-flag">
              <input
                type="checkbox"
                checked={isRepayment}
                onChange={(e) => setIsRepayment(e.target.checked)}
                className="w-4 h-4 text-success rounded border-muted focus:ring-accent"
              />
              <span>Card repayment</span>
            </label>

            <label className="mv-integrity-flag">
              <input
                type="checkbox"
                checked={isSavings}
                onChange={(e) => setIsSavings(e.target.checked)}
                className="w-4 h-4 text-success rounded border-muted focus:ring-accent"
              />
              <span>Savings</span>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-muted mb-1">
              Notes
            </label>
            <input
              type="text"
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mv-transaction-control w-full"
            />
          </div>

          </div>

          {/* Footer Actions */}
          <div className="mv-modal-fixed-actions">
            <button
              type="button"
              onClick={onClose}
              className="mv-transaction-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="mv-transaction-primary"
            >
              {isSubmitting
                ? 'Saving...'
                : initialTransaction
                ? 'Update Transaction'
                : 'Record Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
