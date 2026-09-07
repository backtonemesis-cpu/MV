import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Plus, Trash2, Split } from 'lucide-react';
import { Transaction, Account, Category, Payer, TransactionType, TransactionSplit, HouseholdMember } from '../types';
import { householdPersonOptions } from '../utils/householdPeople';
import { formatPence, parseToPence } from '../utils/currency';
import { accountOptionLabel } from '../utils/accountDisplay';
import { localDateInputValue } from '../utils/dateInput';
import { useModalAccessibility } from '../utils/modalAccessibility';
import { MoneyInput } from './MoneyInput';
import { createCategoryEligibility } from '../utils/categoryEligibility';
import type { CategoryGroup } from '../types';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (txData: Partial<Transaction>) => Promise<void>;
  initialTransaction?: Transaction | null;
  accounts: Account[];
  categories: Category[];
  categoryGroups: CategoryGroup[];
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
  categoryGroups,
  members,
  isSubmitting,
}) => {
  const { getBillCategoryOptions, isBillCategorySelectionAllowed, getTransactionCategoryOptions, isTransactionCategorySelectionAllowed } = createCategoryEligibility(categoryGroups);
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
  const [splits, setSplits] = useState<
    { categoryId: string; amountStr: string; notes?: string; originalCategoryId?: string }[]
  >([]);

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
            originalCategoryId: s.categoryId,
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

  const dialogRef = useModalAccessibility<HTMLDivElement>(isOpen, onClose);

  const personOptions = householdPersonOptions(
    members,
    [payer, initialTransaction?.payer].filter(
      (value): value is Payer => Boolean(value)
    )
  );
  const preservedHistoricalCategoryIds =
    initialTransaction && initialTransaction.type === type
      ? [initialTransaction.categoryId].filter(Boolean)
      : [];
  const transactionCategoryOptions = getTransactionCategoryOptions(
    categories,
    type,
    preservedHistoricalCategoryIds
  );

  if (!isOpen) return null;

  // Handle Type change
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    const preservedForNewType =
      initialTransaction?.type === newType
        ? [initialTransaction.categoryId].filter(Boolean)
        : [];
    if (
      categoryId &&
      !isTransactionCategorySelectionAllowed(
        categories,
        newType,
        categoryId,
        preservedForNewType
      )
    ) {
      setCategoryId('');
    }
    setSplits((previous) =>
      previous.map((row) => {
        const preservedSplit =
          initialTransaction?.type === newType && row.originalCategoryId
            ? [row.originalCategoryId]
            : [];
        return row.categoryId &&
          !isTransactionCategorySelectionAllowed(
            categories,
            newType,
            row.categoryId,
            preservedSplit
          )
          ? { ...row, categoryId: '' }
          : row;
      })
    );
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

    if (newType !== 'transfer' && newType !== 'repayment') {
      setTargetAccountId('');
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
    if (
      !isTransfer &&
      !isSplitEnabled &&
      !isTransactionCategorySelectionAllowed(
        categories,
        type,
        categoryId,
        preservedHistoricalCategoryIds
      )
    ) {
      setError('Choose a category that matches the transaction type.');
      return;
    }

    if (isTransfer && (!targetAccountId || targetAccountId === accountId)) {
      setError('For transfers, select a destination account distinct from the source account.');
      return;
    }

    if (isRepayment) {
      const sourceAccount = accounts.find((account) => account.id === accountId);
      const creditAccount = accounts.find((account) => account.id === targetAccountId);
      if (!targetAccountId || targetAccountId === accountId) {
        setError('Choose the credit account being repaid.');
        return;
      }
      if (sourceAccount?.type === 'credit') {
        setError('Card repayments must be funded from a cash-capable account.');
        return;
      }
      if (!creditAccount || creditAccount.type !== 'credit') {
        setError('Card repayment destination must be a credit account.');
        return;
      }
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
        if (
          !isTransactionCategorySelectionAllowed(
            categories,
            type,
            item.categoryId,
            initialTransaction?.type === type && item.originalCategoryId
              ? [item.originalCategoryId]
              : []
          )
        ) {
          setError(`Split item #${i + 1} must use a category that matches the transaction type`);
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
        type: isRepayment ? 'repayment' : (type as TransactionType),
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
      <div
        ref={dialogRef}
        className="mv-modal-card mv-transaction-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-modal-title"
        tabIndex={-1}
      >
        <div className="mv-modal-header">
          <h2 id="transaction-modal-title" className="text-base font-bold text-main">
            {initialTransaction ? 'Edit Transaction' : 'New Transaction'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="mv-modal-close"
            aria-label="Close transaction dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="mv-modal-scroll-body mv-transaction-body">
          {error && (
            <div className="p-3 bg-danger-soft border border-danger rounded-xl text-xs text-danger flex items-center gap-2" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
              <span>{error}</span>
            </div>
          )}

          {/* Type Selector Tabs */}
          <div>
            <div id="transaction-type-label" className="block text-xs font-semibold text-muted mb-1.5">
              Type
            </div>
            <div className="mv-transaction-type-tabs" role="group" aria-labelledby="transaction-type-label">
              {(['expense', 'income', 'transfer', 'repayment', 'refund'] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => handleTypeChange(t)}
                  className={`mv-transaction-type-tab ${type === t ? 'is-active' : ''}`}
                  aria-pressed={type === t}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Amount & Date */}
          <div className="mv-modal-grid-2">
            <div>
              <label htmlFor="transaction-amount" className="block text-xs font-semibold text-muted mb-1">
                Amount (£)
              </label>
              <MoneyInput
                id="transaction-amount"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                className="mv-transaction-control w-full"
                aria-label="Transaction amount in pounds sterling"
                required
              />
            </div>

            <div>
              <label htmlFor="transaction-date" className="block text-xs font-semibold text-muted mb-1">
                Date
              </label>
              <input
                id="transaction-date"
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
            <label htmlFor="transaction-description" className="block text-xs font-semibold text-muted mb-1">
              Description
            </label>
            <input
              id="transaction-description"
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
              <div id="transaction-person-label" className="block text-xs font-semibold text-muted mb-1.5">
                {type === 'income' || type === 'refund' ? 'Received by' : 'Paid by'}
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="transaction-person-label">
                {personOptions.map((person) => (
                  <button
                    type="button"
                    key={person}
                    onClick={() => setPayer(person)}
                    className={`mv-transaction-selector-pill ${payer === person ? 'is-active' : ''}`}
                    aria-pressed={payer === person}
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
              <label htmlFor="transaction-account" className="block text-xs font-semibold text-muted mb-1">
                {isTransfer ? 'From Account' : isRepayment ? 'Paid from account' : 'Account'}
              </label>
              <select
                id="transaction-account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="mv-transaction-control w-full"
                required
              >
                <option value="">
                  {isTransfer ? 'Select source account' : isRepayment ? 'Select paying account' : 'Select account'}
                </option>
                {accounts
                  .filter(
                    (acc) =>
                      (acc.isActive !== false || acc.id === accountId) &&
                      (!isRepayment || acc.type !== 'credit')
                  )
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {accountOptionLabel(acc)}
                    </option>
                  ))}
              </select>
            </div>

            {(isTransfer || isRepayment) && (
              <div>
                <label htmlFor="transaction-target-account" className="block text-xs font-semibold text-muted mb-1">
                  {isRepayment ? 'Credit account' : 'To Account'}
                </label>
                <select
                  id="transaction-target-account"
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="mv-transaction-control w-full"
                  required
                >
                  <option value="">
                    {isRepayment ? 'Select credit account' : 'Select account'}
                  </option>
                  {accounts
                    .filter(
                      (a) =>
                        a.id !== accountId &&
                        (a.isActive !== false || a.id === targetAccountId) &&
                        (!isRepayment || a.type === 'credit')
                    )
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
                <label htmlFor="transaction-category" className="block text-xs font-semibold text-muted mb-1">
                  Category
                </label>
                <select
                  id="transaction-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="mv-transaction-control w-full"
                  required
                >
                  <option value="">Select category</option>
                  {transactionCategoryOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
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
                      setSplits([
                        {
                          categoryId,
                          originalCategoryId:
                            initialTransaction?.type === type
                              ? initialTransaction.categoryId
                              : undefined,
                          amountStr,
                          notes: '',
                        },
                      ]);
                    }
                    setIsSplitEnabled(!isSplitEnabled);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-success hover:text-success"
                  aria-expanded={isSplitEnabled}
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
                  <div className="flex justify-end pr-7 text-[10px] font-semibold text-muted">
                    <span className="w-36">Amount (£)</span>
                  </div>
                  {splits.map((splitRow, idx) => (
                    <div key={idx} className="mv-hscroll items-center">
                      <select
                        aria-label={`Split ${idx + 1} category`}
                        value={splitRow.categoryId}
                        onChange={(e) => handleUpdateSplitRow(idx, 'categoryId', e.target.value)}
                        className="mv-transaction-control flex-1"
                        required
                      >
                        <option value="">Select category</option>
                        {getTransactionCategoryOptions(
                          categories,
                          type,
                          initialTransaction?.type === type && splitRow.originalCategoryId
                            ? [splitRow.originalCategoryId]
                            : []
                        ).map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>

                      <MoneyInput
                        wrapperClassName="w-36"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={splitRow.amountStr}
                        onChange={(e) => handleUpdateSplitRow(idx, 'amountStr', e.target.value)}
                        className="mv-transaction-control w-full"
                        aria-label={`Split ${idx + 1} amount in pounds sterling`}
                      />

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

          {/* Repayment is an explicit type. Savings classification is derived from transfer accounts. */}

          {/* Notes */}
          <div>
<label htmlFor="transaction-notes" className="block text-xs font-semibold text-muted mb-1">
              Notes
            </label>
            <input
              id="transaction-notes"
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
