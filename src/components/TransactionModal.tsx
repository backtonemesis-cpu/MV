import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, Split } from 'lucide-react';
import {
  Transaction,
  Account,
  Category,
  Payer,
  TransactionType,
  TransactionSplit,
  HouseholdMember,
  PlannedPayment,
} from '../types';
import { formatPence, parseToPence } from '../utils/currency';
import { accountIdentityLabel } from '../utils/accountDisplay';
import { resolveAccountOwnerPayer } from '../utils/accountOwner';
import { localDateInputValue } from '../utils/dateInput';
import { useModalAccessibility } from '../utils/modalAccessibility';
import { MoneyInput } from './MoneyInput';
import { MonthPicker } from './MonthPicker';
import { createCategoryEligibility } from '../utils/categoryEligibility';
import type { CategoryGroup } from '../types';
import {
  UnifiedAddAccountField,
  UnifiedAddFooter,
  UnifiedAddStatusMessage,
  UnifiedAddTypeTabs,
  type UnifiedAddChoice,
} from './UnifiedAddUi';

const UNIFIED_ADD_SESSION_KEY = 'mv-unified-add-launcher';

function repaymentAffectsCurrentBalance(account: Account, transaction: Transaction | null | undefined): boolean {
  if (!transaction || (!transaction.isRepayment && transaction.type !== 'repayment')) return false;
  if (transaction.date > localDateInputValue()) return false;
  const hasReconciliation =
    Boolean(account.reconciliationDate) && Number.isSafeInteger(account.reconciledBalancePence);
  return !hasReconciliation || transaction.date > account.reconciliationDate!;
}

function repaymentDebtBeforeEditPence(
  account: Account,
  initialTransaction: Transaction | null | undefined
): number {
  const sameTarget = Boolean(
    initialTransaction &&
    (initialTransaction.isRepayment || initialTransaction.type === 'repayment') &&
    initialTransaction.targetAccountId === account.id
  );
  const restoredPence =
    sameTarget && repaymentAffectsCurrentBalance(account, initialTransaction)
      ? initialTransaction!.amountPence
      : 0;
  const debtBeforeEditPence = Math.max(0, -(account.currentBalancePence - restoredPence));
  return sameTarget && initialTransaction
    ? Math.max(debtBeforeEditPence, initialTransaction.amountPence)
    : debtBeforeEditPence;
}

function repaymentSourceBalanceBeforeEditPence(
  account: Account,
  initialTransaction: Transaction | null | undefined
): number {
  const sameSource = Boolean(
    initialTransaction &&
    (initialTransaction.isRepayment || initialTransaction.type === 'repayment') &&
    initialTransaction.accountId === account.id
  );
  const restoredPence =
    sameSource && repaymentAffectsCurrentBalance(account, initialTransaction)
      ? initialTransaction!.amountPence
      : 0;
  const balanceBeforeEditPence = Math.max(0, account.currentBalancePence + restoredPence);
  return sameSource && initialTransaction
    ? Math.max(balanceBeforeEditPence, initialTransaction.amountPence)
    : balanceBeforeEditPence;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (txData: Partial<Transaction>) => Promise<void>;
  onSaveBill?: (paymentData: Partial<PlannedPayment>) => Promise<void>;
  initialTransaction?: Transaction | null;
  accounts: Account[];
  categories: Category[];
  categoryGroups: CategoryGroup[];
  members: HouseholdMember[];
  activeMonth?: string;
  isSubmitting: boolean;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onSaveBill,
  initialTransaction,
  accounts,
  categories,
  categoryGroups,
  members,
  activeMonth = '2026-09',
  isSubmitting,
}) => {
  const {
    getTransactionCategoryOptions,
    isTransactionCategorySelectionAllowed,
    getBillCategoryOptions,
    isBillCategorySelectionAllowed,
  } = createCategoryEligibility(categoryGroups);

  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [type, setType] = useState<TransactionType | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [date, setDate] = useState(localDateInputValue());
  const [notes, setNotes] = useState('');
  const [isTransfer, setIsTransfer] = useState(false);
  const [isRepayment, setIsRepayment] = useState(false);
  const [isSavings, setIsSavings] = useState(false);
  const [isRefund, setIsRefund] = useState(false);
  const [isBillEntry, setIsBillEntry] = useState(false);
  const [billMonth, setBillMonth] = useState(activeMonth);
  const [billDueDate, setBillDueDate] = useState('');
  const [billIncludeInTransferPlan, setBillIncludeInTransferPlan] = useState(false);
  const [billIsRecurring, setBillIsRecurring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isSplitEnabled, setIsSplitEnabled] = useState(false);
  const [splits, setSplits] = useState<
    { categoryId: string; amountStr: string; notes?: string; originalCategoryId?: string }[]
  >([]);

  const isUnifiedAddLauncher =
    !initialTransaction &&
    typeof window !== 'undefined' &&
    window.sessionStorage.getItem(UNIFIED_ADD_SESSION_KEY) === '1';

  const clearUnifiedAddState = () => {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(UNIFIED_ADD_SESSION_KEY);
  };
  const closeModal = () => {
    clearUnifiedAddState();
    onClose();
  };

  const clearSharedDraft = () => {
    setDescription('');
    setAmountStr('');
    setCategoryId('');
    setAccountId('');
    setTargetAccountId('');
    setNotes('');
    setIsSavings(false);
    setIsSplitEnabled(false);
    setSplits([]);
    setError(null);
  };

  const clearBillOnlyDraft = () => {
    setBillMonth(activeMonth || '2026-09');
    setBillDueDate('');
    setBillIncludeInTransferPlan(false);
    setBillIsRecurring(false);
  };

  const resetForNextTransaction = (nextType: TransactionType) => {
    clearSharedDraft();
    clearBillOnlyDraft();
    setType(nextType);
    setDate(localDateInputValue());
    setIsBillEntry(false);
    setIsTransfer(nextType === 'transfer');
    setIsRepayment(nextType === 'repayment');
    setIsRefund(nextType === 'refund');
  };

  const resetForNextBill = () => {
    clearSharedDraft();
    clearBillOnlyDraft();
    setType('');
    setIsBillEntry(true);
    setIsTransfer(false);
    setIsRepayment(false);
    setIsRefund(false);
  };

  useEffect(() => {
    if (initialTransaction) {
      setDescription(initialTransaction.description);
      setAmountStr((initialTransaction.amountPence / 100).toFixed(2));
      setType(initialTransaction.type);
      setCategoryId(initialTransaction.categoryId);
      setAccountId(initialTransaction.accountId);
      setTargetAccountId(initialTransaction.targetAccountId || '');
      setDate(initialTransaction.date);
      setNotes(initialTransaction.notes || '');
      setIsTransfer(initialTransaction.isTransfer);
      setIsRepayment(initialTransaction.isRepayment);
      setIsSavings(initialTransaction.isSavings);
      setIsRefund(initialTransaction.isRefund);
      setIsBillEntry(false);
      if (initialTransaction.splits && initialTransaction.splits.length > 0) {
        setIsSplitEnabled(true);
        setSplits(initialTransaction.splits.map((s) => ({
          categoryId: s.categoryId,
          originalCategoryId: s.categoryId,
          amountStr: (s.amountPence / 100).toFixed(2),
          notes: s.notes || '',
        })));
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
      setDate(localDateInputValue());
      setNotes('');
      setIsTransfer(false);
      setIsRepayment(false);
      setIsSavings(false);
      setIsRefund(false);
      setIsBillEntry(false);
      setBillMonth(activeMonth || '2026-09');
      setBillDueDate('');
      setBillIncludeInTransferPlan(false);
      setBillIsRecurring(false);
      setIsSplitEnabled(false);
      setSplits([]);
    }
    setError(null);
    setSuccessMessage(null);
  }, [initialTransaction, isOpen, accounts, categories, activeMonth]);

  useEffect(() => {
    if (!isOpen) clearUnifiedAddState();
  }, [isOpen]);

  const dialogRef = useModalAccessibility<HTMLDivElement>(isOpen, closeModal);
  const preservedHistoricalCategoryIds =
    initialTransaction && initialTransaction.type === type
      ? [initialTransaction.categoryId].filter(Boolean)
      : [];
  const transactionCategoryOptions = getTransactionCategoryOptions(
    categories,
    type,
    preservedHistoricalCategoryIds
  );
  const billCategoryOptions = getBillCategoryOptions(categories);
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const selectedTargetAccount = accounts.find((account) => account.id === targetAccountId);
  const sourceAccountOptions = accounts.filter(
    (acc) => (acc.isActive !== false || acc.id === accountId) && (!isRepayment || acc.type !== 'credit')
  );
  const billAccountOptions = accounts.filter((account) => account.isActive !== false);
  const targetAccountOptions = accounts.filter(
    (a) =>
      a.id !== accountId &&
      (a.isActive !== false || a.id === targetAccountId) &&
      (!isRepayment || a.type === 'credit')
  );

  const totalPence = parseToPence(amountStr);
  const repaymentDebtPence = isRepayment && selectedTargetAccount?.type === 'credit'
    ? repaymentDebtBeforeEditPence(selectedTargetAccount, initialTransaction)
    : null;
  const repaymentSourceBalancePence = selectedAccount
    ? repaymentSourceBalanceBeforeEditPence(selectedAccount, initialTransaction)
    : null;
  const repaymentExceedsDebt = Boolean(
    isRepayment && totalPence > 0 && repaymentDebtPence !== null && totalPence > repaymentDebtPence
  );
  const repaymentExceedsNonOverdraftSource = Boolean(
    isRepayment &&
    totalPence > 0 &&
    selectedAccount &&
    selectedAccount.type !== 'current' &&
    selectedAccount.type !== 'joint' &&
    selectedAccount.type !== 'credit' &&
    repaymentSourceBalancePence !== null &&
    totalPence > repaymentSourceBalancePence
  );
  const repaymentExceedsCurrentVisibleBalance = Boolean(
    isRepayment &&
    totalPence > 0 &&
    (selectedAccount?.type === 'current' || selectedAccount?.type === 'joint') &&
    repaymentSourceBalancePence !== null &&
    totalPence > repaymentSourceBalancePence
  );
  const repaymentAmountBlocked = repaymentExceedsDebt || repaymentExceedsNonOverdraftSource;

  if (!isOpen) return null;

  const applyTransactionFlags = (newType: TransactionType) => {
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
    if (newType !== 'transfer' && newType !== 'repayment') setTargetAccountId('');
  };

  const handleTypeChange = (newType: TransactionType) => {
    setSuccessMessage(null);

    if (!initialTransaction && (isBillEntry || (type && newType !== type))) {
      clearSharedDraft();
      clearBillOnlyDraft();
    }

    setIsBillEntry(false);
    setType(newType);

    if (initialTransaction) {
      const preservedForNewType =
        initialTransaction.type === newType ? [initialTransaction.categoryId].filter(Boolean) : [];
      if (
        categoryId &&
        !isTransactionCategorySelectionAllowed(categories, newType, categoryId, preservedForNewType)
      ) {
        setCategoryId('');
      }
      setSplits((previous) =>
        previous.map((row) => {
          const preservedSplit =
            initialTransaction.type === newType && row.originalCategoryId
              ? [row.originalCategoryId]
              : [];
          return row.categoryId &&
            !isTransactionCategorySelectionAllowed(categories, newType, row.categoryId, preservedSplit)
            ? { ...row, categoryId: '' }
            : row;
        })
      );
    }

    applyTransactionFlags(newType);
  };

  const handleUnifiedChoiceChange = (choice: UnifiedAddChoice) => {
    if (choice === 'bill') {
      if (!isUnifiedAddLauncher || initialTransaction) return;
      setSuccessMessage(null);
      if (!isBillEntry) clearSharedDraft();
      clearBillOnlyDraft();
      setType('');
      setIsBillEntry(true);
      setIsTransfer(false);
      setIsRepayment(false);
      setIsRefund(false);
      setIsSplitEnabled(false);
      return;
    }
    handleTypeChange(choice);
  };

  const handleAddSplitRow = () =>
    setSplits((previous) => [...previous, { categoryId: '', amountStr: '', notes: '' }]);
  const handleRemoveSplitRow = (index: number) =>
    setSplits((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  const handleUpdateSplitRow = (
    index: number,
    field: 'categoryId' | 'amountStr' | 'notes',
    value: string
  ) => {
    setSplits((previous) =>
      previous.map((row, itemIndex) => (itemIndex === index ? { ...row, [field]: value } : row))
    );
  };

  const handleBillSubmit = async () => {
    const pence = parseToPence(amountStr);
    if (pence <= 0) {
      setError('Please enter a valid amount greater than £0.00');
      return;
    }
    if (!billMonth.trim()) {
      setError('Billing month is required.');
      return;
    }
    if (!description.trim()) {
      setError('Bill name is required.');
      return;
    }
    if (!accountId) {
      setError('Choose the account that will pay this bill.');
      return;
    }
    if (!isBillCategorySelectionAllowed(categories, categoryId)) {
      setError('Choose a spending category that is valid for bills.');
      return;
    }
    const paymentAccount = accounts.find((account) => account.id === accountId);
    const responsiblePerson = resolveAccountOwnerPayer(paymentAccount, members);
    if (!responsiblePerson) {
      setError('The selected payment account has no valid owner. Review the account before recording this bill.');
      return;
    }
    if (!onSaveBill) {
      setError('Bill recording is unavailable from this form.');
      return;
    }

    try {
      await onSaveBill({
        name: description.trim(),
        amountPence: pence,
        month: billMonth.trim(),
        accountId,
        responsiblePerson,
        dueDate: billDueDate || undefined,
        categoryId: categoryId || undefined,
        includeInTransferPlan: billIncludeInTransferPlan,
        isRecurring: billIsRecurring,
        notes: notes.trim() || undefined,
      });
      resetForNextBill();
      setSuccessMessage('Bill recorded. Ready for another entry.');
      window.requestAnimationFrame(() =>
        dialogRef.current?.querySelector<HTMLElement>('.mv-modal-scroll-body')?.scrollTo({ top: 0 })
      );
    } catch (err: any) {
      setError(err.message || 'Failed to save scheduled payment');
    }
  };

  const handleTransactionSubmit = async () => {
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
      setError(
        isTransfer
          ? 'Choose the source account.'
          : isRepayment
            ? 'Choose the paying account.'
            : 'Choose the account.'
      );
      return;
    }
    if (!isTransfer && !isSplitEnabled && !categoryId) {
      setError('Choose a category.');
      return;
    }
    if (
      !isTransfer &&
      !isSplitEnabled &&
      !isTransactionCategorySelectionAllowed(categories, type, categoryId, preservedHistoricalCategoryIds)
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
        setError('Choose the credit card being repaid.');
        return;
      }
      if (!sourceAccount) {
        setError('Choose the paying account.');
        return;
      }
      if (sourceAccount.type === 'credit') {
        setError('Card repayments must be funded from a cash-capable account.');
        return;
      }
      if (!creditAccount || creditAccount.type !== 'credit') {
        setError('Card repayment destination must be a credit account.');
        return;
      }
      const outstandingDebtPence = repaymentDebtBeforeEditPence(creditAccount, initialTransaction);
      if (pence > outstandingDebtPence) {
        setError(`Repayment exceeds card balance (${formatPence(outstandingDebtPence)}).`);
        return;
      }
      const sourceBalancePence = repaymentSourceBalanceBeforeEditPence(sourceAccount, initialTransaction);
      if (
        sourceAccount?.type !== 'current' &&
        sourceAccount?.type !== 'joint' &&
        pence > sourceBalancePence
      ) {
        setError(`Repayment exceeds ${sourceAccount?.type || 'source'} balance (${formatPence(sourceBalancePence)}).`);
        return;
      }
    }

    let finalSplits: TransactionSplit[] | undefined;
    if (isSplitEnabled && !isTransfer && !isRepayment) {
      if (splits.length === 0) {
        setError('Please add at least one split item or disable category splitting');
        return;
      }
      let splitSumPence = 0;
      const formattedSplits: TransactionSplit[] = [];
      for (let index = 0; index < splits.length; index += 1) {
        const item = splits[index];
        const itemPence = parseToPence(item.amountStr);
        if (itemPence <= 0) {
          setError(`Split item #${index + 1} must have an amount greater than £0.00`);
          return;
        }
        if (!item.categoryId) {
          setError(`Split item #${index + 1} must have a category selected`);
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
          setError(`Split item #${index + 1} must use a category that matches the transaction type`);
          return;
        }
        splitSumPence += itemPence;
        formattedSplits.push({
          id: 'split-' + Date.now() + '-' + index,
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
    const resolvedPayer: Payer | null =
      initialTransaction && initialTransaction.accountId === accountId
        ? initialTransaction.payer
        : resolveAccountOwnerPayer(sourceAccount, members);
    if (!resolvedPayer) {
      setError('The selected account has no valid owner. Review the account before recording this transaction.');
      return;
    }
    const recordedType = type as TransactionType;

    try {
      await onSave({
        description: description.trim(),
        amountPence: pence,
        type: isRepayment ? 'repayment' : recordedType,
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
      if (isUnifiedAddLauncher && !initialTransaction) {
        resetForNextTransaction(recordedType);
        const successLabel: Record<TransactionType, string> = {
          expense: 'Expense',
          income: 'Income',
          transfer: 'Transfer',
          refund: 'Refund',
          repayment: 'Repayment',
        };
        setSuccessMessage(`${successLabel[recordedType]} recorded. Ready for another entry.`);
        window.requestAnimationFrame(() =>
          dialogRef.current?.querySelector<HTMLElement>('.mv-modal-scroll-body')?.scrollTo({ top: 0 })
        );
      } else {
        closeModal();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);
    if (isBillEntry) {
      await handleBillSubmit();
      return;
    }
    await handleTransactionSubmit();
  };

  const currentSplitsTotalPence = splits.reduce(
    (sum, split) => sum + parseToPence(split.amountStr),
    0
  );
  const remainingSplitPence = totalPence - currentSplitsTotalPence;
  const activeChoice: UnifiedAddChoice | null = isBillEntry
    ? 'bill'
    : (type || null) as UnifiedAddChoice | null;

  return (
    <div className="mv-modal-backdrop">
      <div
        ref={dialogRef}
        className="mv-modal-card mv-transaction-modal"
        data-active-add-type={isBillEntry ? 'bill' : type || undefined}
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
            onClick={closeModal}
            className="mv-modal-close"
            aria-label="Close transaction dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="mv-modal-scroll-body mv-transaction-body">
            {error && <UnifiedAddStatusMessage variant="error">{error}</UnifiedAddStatusMessage>}
            {successMessage && (
              <UnifiedAddStatusMessage variant="success">{successMessage}</UnifiedAddStatusMessage>
            )}

            <UnifiedAddTypeTabs
              activeType={activeChoice}
              onSelect={handleUnifiedChoiceChange}
              labelId="transaction-type-label"
              prompt={isUnifiedAddLauncher ? 'What would you like to add?' : 'Type'}
            />

            {isBillEntry ? (
              <>
                <div className="mv-modal-grid-2">
                  <div>
                    <label
                      htmlFor="unified-bill-amount"
                      className="block text-xs font-semibold text-muted mb-1"
                    >
                      Amount (£)
                    </label>
                    <MoneyInput
                      id="unified-bill-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amountStr}
                      onChange={(event) => setAmountStr(event.target.value)}
                      className="mv-transaction-control w-full"
                      aria-label="Bill amount in pounds sterling"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="unified-bill-month"
                      className="block text-xs font-semibold text-muted mb-1"
                    >
                      Month
                    </label>
                    <MonthPicker
                      id="unified-bill-month"
                      value={billMonth}
                      onChange={setBillMonth}
                      ariaLabel="Billing month"
                      className="is-fluid mv-unified-add-month"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="unified-bill-name"
                    className="block text-xs font-semibold text-muted mb-1"
                  >
                    Name
                  </label>
                  <input
                    id="unified-bill-name"
                    type="text"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="mv-transaction-control w-full"
                    required
                  />
                </div>

                <div className="mv-transaction-dynamic mv-unified-add-field-stack">
                  <div className="mv-modal-grid-2">
                    <UnifiedAddAccountField
                      id="unified-bill-account"
                      label="Payment Account"
                      value={accountId}
                      options={billAccountOptions}
                      onChange={setAccountId}
                      placeholder="Select payment account"
                    />
                    <div>
                      <label
                        htmlFor="unified-bill-category"
                        className="block text-xs font-semibold text-muted mb-1"
                      >
                        Category
                      </label>
                      <select
                        id="unified-bill-category"
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="mv-transaction-control w-full"
                        required
                      >
                        <option value="">Select category</option>
                        {billCategoryOptions.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="unified-bill-due-date"
                      className="block text-xs font-semibold text-muted mb-1"
                    >
                      Due Date
                    </label>
                    <input
                      id="unified-bill-due-date"
                      type="date"
                      value={billDueDate}
                      onChange={(event) => setBillDueDate(event.target.value)}
                      className="mv-transaction-control w-full"
                    />
                  </div>

                  <div className="mv-unified-bill-options" aria-label="Bill options">
                    <label className="mv-unified-bill-option" htmlFor="unified-bill-transfer-plan">
                      <span>Include in Transfer Plan</span>
                      <input
                        id="unified-bill-transfer-plan"
                        type="checkbox"
                        checked={billIncludeInTransferPlan}
                        onChange={(event) => setBillIncludeInTransferPlan(event.target.checked)}
                      />
                    </label>
                    <label className="mv-unified-bill-option" htmlFor="unified-bill-recurring">
                      <span>Recurring Monthly</span>
                      <input
                        id="unified-bill-recurring"
                        type="checkbox"
                        checked={billIsRecurring}
                        onChange={(event) => setBillIsRecurring(event.target.checked)}
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="unified-bill-notes"
                    className="block text-xs font-semibold text-muted mb-1"
                  >
                    Notes
                  </label>
                  <input
                    id="unified-bill-notes"
                    type="text"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="mv-transaction-control w-full"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="mv-modal-grid-2">
                  <div>
                    <label
                      htmlFor="transaction-amount"
                      className="block text-xs font-semibold text-muted mb-1"
                    >
                      Amount (£)
                    </label>
                    <MoneyInput
                      id="transaction-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amountStr}
                      onChange={(event) => setAmountStr(event.target.value)}
                      className="mv-transaction-control w-full"
                      aria-label="Transaction amount in pounds sterling"
                      required
                    />
                    {repaymentExceedsDebt && repaymentDebtPence !== null && (
                      <UnifiedAddStatusMessage variant="error" className="mv-repayment-amount-message">
                        Repayment exceeds card balance ({formatPence(repaymentDebtPence)}).
                      </UnifiedAddStatusMessage>
                    )}
                    {repaymentExceedsNonOverdraftSource && selectedAccount && (
                      <UnifiedAddStatusMessage variant="error" className="mv-repayment-amount-message">
                        Repayment exceeds {selectedAccount.type} balance (
                        {formatPence(repaymentSourceBalancePence || 0)}).
                      </UnifiedAddStatusMessage>
                    )}
                    {repaymentExceedsCurrentVisibleBalance && selectedAccount && (
                      <UnifiedAddStatusMessage variant="warning" className="mv-repayment-amount-message">
                        Exceeds current balance ({formatPence(repaymentSourceBalancePence || 0)}). Check overdraft.
                      </UnifiedAddStatusMessage>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="transaction-date"
                      className="block text-xs font-semibold text-muted mb-1"
                    >
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

                <div>
                  <label
                    htmlFor="transaction-description"
                    className="block text-xs font-semibold text-muted mb-1"
                  >
                    Description
                  </label>
                  <input
                    id="transaction-description"
                    type="text"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="mv-transaction-control w-full"
                    required
                  />
                </div>

                <div className="mv-transaction-dynamic">
                  <div className="mv-modal-grid-2">
                    <UnifiedAddAccountField
                      id="transaction-account"
                      label={isTransfer ? 'From Account' : isRepayment ? 'Pay From Account' : 'Account'}
                      value={accountId}
                      options={sourceAccountOptions}
                      onChange={(nextAccountId) => {
                        setAccountId(nextAccountId);
                        if (targetAccountId === nextAccountId) setTargetAccountId('');
                      }}
                      placeholder={
                        isTransfer
                          ? 'Select source account'
                          : isRepayment
                            ? 'Select paying account'
                            : 'Select account'
                      }
                    />

                    {(isTransfer || isRepayment) && (
                      <UnifiedAddAccountField
                        id="transaction-target-account"
                        label={isRepayment ? 'Credit Card Being Repaid' : 'To Account'}
                        value={targetAccountId}
                        options={targetAccountOptions}
                        onChange={setTargetAccountId}
                        placeholder={isRepayment ? 'Select credit card' : 'Select account'}
                        summaryAriaPrefix="Selected destination account"
                      />
                    )}

                    {!isTransfer && !isSplitEnabled && (
                      <div>
                        <label
                          htmlFor="transaction-category"
                          className="block text-xs font-semibold text-muted mb-1"
                        >
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

                  {isRepayment && selectedAccount && selectedTargetAccount && (
                    <div className="mv-repayment-flow-summary" aria-live="polite">
                      <span className="text-xs font-semibold text-muted">Repayment path</span>
                      <span className="text-xs font-bold text-main">
                        {accountIdentityLabel(selectedAccount)} → {accountIdentityLabel(selectedTargetAccount)}
                      </span>
                    </div>
                  )}

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
                                onChange={(event) =>
                                  handleUpdateSplitRow(idx, 'categoryId', event.target.value)
                                }
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
                                ).map((category) => (
                                  <option key={category.id} value={category.id}>
                                    {category.name}
                                  </option>
                                ))}
                              </select>
                              <MoneyInput
                                wrapperClassName="w-36"
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={splitRow.amountStr}
                                onChange={(event) =>
                                  handleUpdateSplitRow(idx, 'amountStr', event.target.value)
                                }
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

                <div>
                  <label
                    htmlFor="transaction-notes"
                    className="block text-xs font-semibold text-muted mb-1"
                  >
                    Notes
                  </label>
                  <input
                    id="transaction-notes"
                    type="text"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    className="mv-transaction-control w-full"
                  />
                </div>
              </>
            )}
          </div>

          <UnifiedAddFooter
            onCancel={closeModal}
            submitLabel={
              isBillEntry
                ? 'Record Bill'
                : initialTransaction
                  ? 'Update Transaction'
                  : 'Record Transaction'
            }
            submitting={isSubmitting}
            disabled={!isBillEntry && repaymentAmountBlocked}
          />
        </form>
      </div>
    </div>
  );
};
