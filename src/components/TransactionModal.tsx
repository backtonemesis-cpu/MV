import React, { useState, useEffect, useRef } from 'react';
import { X, AlertCircle, CheckCircle2, Plus, Trash2, Split, ChevronDown } from 'lucide-react';
import { Transaction, Account, Category, Payer, TransactionType, TransactionSplit, HouseholdMember } from '../types';
import { formatPence, parseToPence } from '../utils/currency';
import { accountIdentityLabel, accountOptionLabel } from '../utils/accountDisplay';
import { resolveAccountOwnerPayer } from '../utils/accountOwner';
import { localDateInputValue } from '../utils/dateInput';
import { useModalAccessibility } from '../utils/modalAccessibility';
import { MoneyInput } from './MoneyInput';
import { createCategoryEligibility } from '../utils/categoryEligibility';
import type { CategoryGroup } from '../types';

const UNIFIED_ADD_SESSION_KEY = 'mv-unified-add-launcher';
const OPEN_BILL_EVENT = 'mv:open-planned-payment';

type MobileAccountPicker = 'source' | 'target' | null;

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
  const { getTransactionCategoryOptions, isTransactionCategorySelectionAllowed } = createCategoryEligibility(categoryGroups);
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
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mobileAccountPicker, setMobileAccountPicker] = useState<MobileAccountPicker>(null);
  const sourcePickerTriggerRef = useRef<HTMLButtonElement>(null);
  const targetPickerTriggerRef = useRef<HTMLButtonElement>(null);

  const isUnifiedAddLauncher =
    !initialTransaction &&
    typeof window !== 'undefined' &&
    window.sessionStorage.getItem(UNIFIED_ADD_SESSION_KEY) === '1';

  const clearUnifiedAddState = () => {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(UNIFIED_ADD_SESSION_KEY);
  };
  const closeModal = () => { clearUnifiedAddState(); setMobileAccountPicker(null); onClose(); };
  const openBillWorkflow = () => {
    clearUnifiedAddState();
    setMobileAccountPicker(null);
    onClose();
    window.dispatchEvent(new CustomEvent(OPEN_BILL_EVENT));
  };

  const [isSplitEnabled, setIsSplitEnabled] = useState(false);
  const [splits, setSplits] = useState<
    { categoryId: string; amountStr: string; notes?: string; originalCategoryId?: string }[]
  >([]);

  const resetForNextTransaction = (nextType: TransactionType) => {
    setDescription('');
    setAmountStr('');
    setType(nextType);
    setCategoryId('');
    setAccountId('');
    setTargetAccountId('');
    setDate(localDateInputValue());
    setNotes('');
    setIsTransfer(nextType === 'transfer');
    setIsRepayment(nextType === 'repayment');
    setIsSavings(false);
    setIsRefund(nextType === 'refund');
    setIsSplitEnabled(false);
    setSplits([]);
    setError(null);
    setMobileAccountPicker(null);
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
      setIsSplitEnabled(false);
      setSplits([]);
    }
    setError(null);
    setSuccessMessage(null);
    setMobileAccountPicker(null);
  }, [initialTransaction, isOpen, accounts, categories]);

  useEffect(() => {
    if (!isOpen) clearUnifiedAddState();
  }, [isOpen]);

  useEffect(() => {
    if (!mobileAccountPicker) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      const picker = mobileAccountPicker;
      setMobileAccountPicker(null);
      window.requestAnimationFrame(() => {
        (picker === 'source' ? sourcePickerTriggerRef : targetPickerTriggerRef).current?.focus();
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileAccountPicker]);

  const dialogRef = useModalAccessibility<HTMLDivElement>(isOpen, closeModal);
  const preservedHistoricalCategoryIds =
    initialTransaction && initialTransaction.type === type
      ? [initialTransaction.categoryId].filter(Boolean)
      : [];
  const transactionCategoryOptions = getTransactionCategoryOptions(categories, type, preservedHistoricalCategoryIds);
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const selectedTargetAccount = accounts.find((account) => account.id === targetAccountId);
  const sourceAccountOptions = accounts.filter(
    (acc) => (acc.isActive !== false || acc.id === accountId) && (!isRepayment || acc.type !== 'credit')
  );
  const targetAccountOptions = accounts.filter(
    (a) => a.id !== accountId &&
      (a.isActive !== false || a.id === targetAccountId) &&
      (!isRepayment || a.type === 'credit')
  );
  const totalPence = parseToPence(amountStr);
  const repaymentDebtPence = isRepayment && selectedTargetAccount?.type === 'credit'
    ? Math.max(0, -selectedTargetAccount.currentBalancePence)
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
    totalPence > Math.max(0, selectedAccount.currentBalancePence)
  );
  const repaymentExceedsCurrentVisibleBalance = Boolean(
    isRepayment &&
    totalPence > 0 &&
    (selectedAccount?.type === 'current' || selectedAccount?.type === 'joint') &&
    totalPence > Math.max(0, selectedAccount.currentBalancePence)
  );
  const repaymentAmountBlocked = repaymentExceedsDebt || repaymentExceedsNonOverdraftSource;

  if (!isOpen) return null;

  const closeMobileAccountPicker = () => {
    const picker = mobileAccountPicker;
    setMobileAccountPicker(null);
    window.requestAnimationFrame(() => {
      (picker === 'target' ? targetPickerTriggerRef : sourcePickerTriggerRef).current?.focus();
    });
  };

  const chooseMobileAccount = (account: Account) => {
    if (mobileAccountPicker === 'source') {
      setAccountId(account.id);
      if (targetAccountId === account.id) setTargetAccountId('');
    } else if (mobileAccountPicker === 'target') {
      setTargetAccountId(account.id);
    }
    closeMobileAccountPicker();
  };

  const handleTypeChange = (newType: TransactionType) => {
    setSuccessMessage(null);
    setMobileAccountPicker(null);

    if (!initialTransaction && type && newType !== type) {
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
    }

    setType(newType);

    if (initialTransaction) {
      const preservedForNewType = initialTransaction.type === newType ? [initialTransaction.categoryId].filter(Boolean) : [];
      if (categoryId && !isTransactionCategorySelectionAllowed(categories, newType, categoryId, preservedForNewType)) {
        setCategoryId('');
      }
      setSplits((previous) => previous.map((row) => {
        const preservedSplit = initialTransaction.type === newType && row.originalCategoryId ? [row.originalCategoryId] : [];
        return row.categoryId && !isTransactionCategorySelectionAllowed(categories, newType, row.categoryId, preservedSplit)
          ? { ...row, categoryId: '' }
          : row;
      }));
    }

    if (newType === 'transfer') {
      setIsTransfer(true); setIsRepayment(false); setIsRefund(false); setIsSplitEnabled(false);
    } else if (newType === 'repayment') {
      setIsRepayment(true); setIsTransfer(false); setIsRefund(false); setIsSplitEnabled(false);
    } else if (newType === 'refund') {
      setIsRefund(true); setIsTransfer(false); setIsRepayment(false);
    } else {
      setIsTransfer(false); setIsRepayment(false); setIsRefund(false);
    }
    if (newType !== 'transfer' && newType !== 'repayment') setTargetAccountId('');
  };

  const handleAddSplitRow = () => setSplits((prev) => [...prev, { categoryId: '', amountStr: '', notes: '' }]);
  const handleRemoveSplitRow = (idx: number) => setSplits((prev) => prev.filter((_, i) => i !== idx));
  const handleUpdateSplitRow = (idx: number, field: 'categoryId' | 'amountStr' | 'notes', value: string) => {
    setSplits((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    if (!type) { setError('Choose the transaction type.'); return; }
    const pence = parseToPence(amountStr);
    if (pence <= 0) { setError('Please enter a valid amount greater than £0.00'); return; }
    if (!description.trim()) { setError('Please enter a description for the transaction'); return; }
    if (!accountId) { setError(isTransfer ? 'Choose the source account.' : isRepayment ? 'Choose the paying account.' : 'Choose the account.'); return; }
    if (!isTransfer && !isSplitEnabled && !categoryId) { setError('Choose a category.'); return; }
    if (!isTransfer && !isSplitEnabled && !isTransactionCategorySelectionAllowed(categories, type, categoryId, preservedHistoricalCategoryIds)) {
      setError('Choose a category that matches the transaction type.'); return;
    }
    if (isTransfer && (!targetAccountId || targetAccountId === accountId)) {
      setError('For transfers, select a destination account distinct from the source account.'); return;
    }
    if (isRepayment) {
      const sourceAccount = accounts.find((account) => account.id === accountId);
      const creditAccount = accounts.find((account) => account.id === targetAccountId);
      if (!targetAccountId || targetAccountId === accountId) { setError('Choose the credit card being repaid.'); return; }
      if (sourceAccount?.type === 'credit') { setError('Card repayments must be funded from a cash-capable account.'); return; }
      if (!creditAccount || creditAccount.type !== 'credit') { setError('Card repayment destination must be a credit account.'); return; }
      const outstandingDebtPence = Math.max(0, -creditAccount.currentBalancePence);
      if (pence > outstandingDebtPence) {
        setError(`Repayment cannot exceed the credit card balance of ${formatPence(outstandingDebtPence)}.`);
        return;
      }
      if (
        sourceAccount?.type !== 'current' &&
        sourceAccount?.type !== 'joint' &&
        pence > Math.max(0, sourceAccount?.currentBalancePence || 0)
      ) {
        setError(`Repayment cannot exceed the available ${sourceAccount?.type || 'source'} account balance of ${formatPence(Math.max(0, sourceAccount?.currentBalancePence || 0))}.`);
        return;
      }
    }

    let finalSplits: TransactionSplit[] | undefined;
    if (isSplitEnabled && !isTransfer && !isRepayment) {
      if (splits.length === 0) { setError('Please add at least one split item or disable category splitting'); return; }
      let splitSumPence = 0;
      const formattedSplits: TransactionSplit[] = [];
      for (let i = 0; i < splits.length; i++) {
        const item = splits[i];
        const itemPence = parseToPence(item.amountStr);
        if (itemPence <= 0) { setError(`Split item #${i + 1} must have an amount greater than £0.00`); return; }
        if (!item.categoryId) { setError(`Split item #${i + 1} must have a category selected`); return; }
        if (!isTransactionCategorySelectionAllowed(categories, type, item.categoryId, initialTransaction?.type === type && item.originalCategoryId ? [item.originalCategoryId] : [])) {
          setError(`Split item #${i + 1} must use a category that matches the transaction type`); return;
        }
        splitSumPence += itemPence;
        formattedSplits.push({ id: 'split-' + Date.now() + '-' + i, categoryId: item.categoryId, amountPence: itemPence, notes: item.notes?.trim() || undefined });
      }
      if (splitSumPence !== pence) {
        setError(`Sum of split items (${formatPence(splitSumPence)}) must exactly equal the total transaction amount (${formatPence(pence)})`); return;
      }
      finalSplits = formattedSplits;
    }

    const sourceAccount = accounts.find((account) => account.id === accountId);
    const resolvedPayer: Payer | null = initialTransaction && initialTransaction.accountId === accountId
      ? initialTransaction.payer
      : resolveAccountOwnerPayer(sourceAccount, members);
    if (!resolvedPayer) {
      setError('The selected account has no valid owner. Review the account before recording this transaction.');
      return;
    }
    const recordedType = type as TransactionType;

    try {
      await onSave({
        description: description.trim(), amountPence: pence,
        type: isRepayment ? 'repayment' : recordedType,
        categoryId: isTransfer ? undefined : categoryId || undefined,
        accountId,
        targetAccountId: isTransfer || isRepayment ? targetAccountId : undefined,
        payer: resolvedPayer,
        date, notes: notes.trim(), isTransfer, isRepayment, isSavings, isRefund,
        splits: finalSplits,
      });
      if (isUnifiedAddLauncher && !initialTransaction) {
        resetForNextTransaction(recordedType);
        const successLabel: Record<TransactionType, string> = {
          expense: 'Expense', income: 'Income', transfer: 'Transfer', refund: 'Refund', repayment: 'Repayment',
        };
        setSuccessMessage(`${successLabel[recordedType]} recorded. Ready for another entry.`);
        window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('.mv-modal-scroll-body')?.scrollTo({ top: 0 }));
      } else {
        closeModal();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save transaction');
    }
  };

  const currentSplitsTotalPence = splits.reduce((sum, split) => sum + parseToPence(split.amountStr), 0);
  const remainingSplitPence = totalPence - currentSplitsTotalPence;
  const activeMobilePickerOptions = mobileAccountPicker === 'target' ? targetAccountOptions : sourceAccountOptions;
  const activeMobilePickerValue = mobileAccountPicker === 'target' ? targetAccountId : accountId;
  const activeMobilePickerTitle = mobileAccountPicker === 'target'
    ? (isRepayment ? 'Credit card being repaid' : 'To Account')
    : (isTransfer ? 'From Account' : isRepayment ? 'Pay from account' : 'Account');

  return (
    <div className="mv-modal-backdrop">
      <div ref={dialogRef} className="mv-modal-card mv-transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title" tabIndex={-1}>
        <div className="mv-modal-header">
          <h2 id="transaction-modal-title" className="text-base font-bold text-main">{initialTransaction ? 'Edit Transaction' : 'New Transaction'}</h2>
          <button type="button" onClick={closeModal} className="mv-modal-close" aria-label="Close transaction dialog"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
          <div className="mv-modal-scroll-body mv-transaction-body">
          {error && <div className="p-3 bg-danger-soft border border-danger rounded-xl text-xs text-danger flex items-center gap-2" role="alert"><AlertCircle className="w-4 h-4 shrink-0 text-danger" /><span>{error}</span></div>}
          {successMessage && <div className="p-3 bg-success-soft border border-success rounded-xl text-xs text-success flex items-center gap-2" role="status" aria-live="polite"><CheckCircle2 className="w-4 h-4 shrink-0 text-success" /><span>{successMessage}</span></div>}

          <div>
            <div id="transaction-type-label" className="block text-xs font-semibold text-muted mb-1.5">{isUnifiedAddLauncher ? 'What would you like to add?' : 'Type'}</div>
            <div className="mv-transaction-type-tabs" role="group" aria-labelledby="transaction-type-label">
              {(['expense', 'income', 'transfer', 'refund', 'repayment'] as const).map((t) => (
                <button type="button" key={t} onClick={() => handleTypeChange(t)} className={`mv-transaction-type-tab ${type === t ? 'is-active' : ''}`} aria-pressed={type === t} aria-label={`Add ${t}`}>{t}</button>
              ))}
              {isUnifiedAddLauncher && <button type="button" onClick={openBillWorkflow} className="mv-transaction-type-tab" aria-label="Add bill" aria-pressed="false">bill</button>}
            </div>
          </div>

          <div className="mv-modal-grid-2">
            <div>
              <label htmlFor="transaction-amount" className="block text-xs font-semibold text-muted mb-1">Amount (£)</label>
              <MoneyInput id="transaction-amount" type="text" inputMode="decimal" placeholder="0.00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} className="mv-transaction-control w-full" aria-label="Transaction amount in pounds sterling" required />
              {repaymentExceedsDebt && repaymentDebtPence !== null && (
                <div className="mv-repayment-amount-message is-danger" role="alert">Repayment exceeds the credit card balance of {formatPence(repaymentDebtPence)}.</div>
              )}
              {repaymentExceedsNonOverdraftSource && selectedAccount && (
                <div className="mv-repayment-amount-message is-danger" role="alert">Repayment exceeds the available {selectedAccount.type} account balance of {formatPence(Math.max(0, selectedAccount.currentBalancePence))}.</div>
              )}
              {repaymentExceedsCurrentVisibleBalance && selectedAccount && (
                <div className="mv-repayment-amount-message is-warning" role="status">Repayment exceeds the displayed current-account balance of {formatPence(Math.max(0, selectedAccount.currentBalancePence))}. Check the available overdraft before recording.</div>
              )}
            </div>
            <div><label htmlFor="transaction-date" className="block text-xs font-semibold text-muted mb-1">Date</label><input id="transaction-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mv-transaction-control w-full" required /></div>
          </div>

          <div><label htmlFor="transaction-description" className="block text-xs font-semibold text-muted mb-1">Description</label><input id="transaction-description" type="text" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="mv-transaction-control w-full" required /></div>

          <div className="mv-transaction-dynamic">
          <div className="mv-modal-grid-2">
            <div>
              <label htmlFor="transaction-account" className="block text-xs font-semibold text-muted mb-1">{isTransfer ? 'From Account' : isRepayment ? 'Pay from account' : 'Account'}</label>
              <select id="transaction-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="mv-transaction-control mv-transaction-account-select w-full" aria-required="true">
                <option value="">{isTransfer ? 'Select source account' : isRepayment ? 'Select paying account' : 'Select account'}</option>
                {sourceAccountOptions.map((acc) => <option key={acc.id} value={acc.id}>{accountOptionLabel(acc)}</option>)}
              </select>
              <button ref={sourcePickerTriggerRef} type="button" className="mv-mobile-account-trigger" onClick={() => setMobileAccountPicker('source')} aria-haspopup="listbox" aria-expanded={mobileAccountPicker === 'source'} aria-label={`${isTransfer ? 'From Account' : isRepayment ? 'Pay from account' : 'Account'} selector`}>
                <span>{selectedAccount ? accountIdentityLabel(selectedAccount) : ''}</span><ChevronDown aria-hidden="true" />
              </button>
              {selectedAccount && <div className="mv-selected-account-summary" aria-live="polite" aria-label={`Selected account ${accountIdentityLabel(selectedAccount)}, balance ${formatPence(selectedAccount.currentBalancePence)}`}><div className="mv-selected-account-balance">Balance: {formatPence(selectedAccount.currentBalancePence)}</div></div>}
            </div>

            {(isTransfer || isRepayment) && (
              <div>
                <label htmlFor="transaction-target-account" className="block text-xs font-semibold text-muted mb-1">{isRepayment ? 'Credit card being repaid' : 'To Account'}</label>
                <select id="transaction-target-account" value={targetAccountId} onChange={(e) => setTargetAccountId(e.target.value)} className="mv-transaction-control mv-transaction-account-select w-full" aria-required="true">
                  <option value="">{isRepayment ? 'Select credit card' : 'Select account'}</option>
                  {targetAccountOptions.map((acc) => <option key={acc.id} value={acc.id}>{accountOptionLabel(acc)}</option>)}
                </select>
                <button ref={targetPickerTriggerRef} type="button" className="mv-mobile-account-trigger" onClick={() => setMobileAccountPicker('target')} aria-haspopup="listbox" aria-expanded={mobileAccountPicker === 'target'} aria-label={`${isRepayment ? 'Credit card being repaid' : 'To Account'} selector`}>
                  <span>{selectedTargetAccount ? accountIdentityLabel(selectedTargetAccount) : ''}</span><ChevronDown aria-hidden="true" />
                </button>
                {selectedTargetAccount && <div className="mv-selected-account-summary" aria-live="polite" aria-label={`Selected destination account ${accountIdentityLabel(selectedTargetAccount)}, balance ${formatPence(selectedTargetAccount.currentBalancePence)}`}><div className="mv-selected-account-balance">Balance: {formatPence(selectedTargetAccount.currentBalancePence)}</div></div>}
              </div>
            )}

            {!isTransfer && !isSplitEnabled && (
              <div><label htmlFor="transaction-category" className="block text-xs font-semibold text-muted mb-1">Category</label><select id="transaction-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="mv-transaction-control w-full" required><option value="">Select category</option>{transactionCategoryOptions.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></div>
            )}
          </div>

          {isRepayment && selectedAccount && selectedTargetAccount && (
            <div className="mv-repayment-flow-summary" aria-live="polite">
              <span className="text-xs font-semibold text-muted">Repayment path</span>
              <span className="text-xs font-bold text-main">{accountIdentityLabel(selectedAccount)} → {accountIdentityLabel(selectedTargetAccount)}</span>
            </div>
          )}

          {!isTransfer && !isRepayment && (
            <div className="pt-2 border-t border-muted">
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => { if (!isSplitEnabled && splits.length === 0) { setSplits([{ categoryId, originalCategoryId: initialTransaction?.type === type ? initialTransaction.categoryId : undefined, amountStr, notes: '' }]); } setIsSplitEnabled(!isSplitEnabled); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-success hover:text-success" aria-expanded={isSplitEnabled}><Split className="w-3.5 h-3.5" /><span>{isSplitEnabled ? 'Remove Splits' : 'Split Categories'}</span></button>
                {isSplitEnabled && <span className={`text-xs font-bold ${remainingSplitPence === 0 ? 'text-success' : remainingSplitPence > 0 ? 'text-warning' : 'text-danger'}`}>{remainingSplitPence === 0 ? 'Splits balanced' : remainingSplitPence > 0 ? `${formatPence(remainingSplitPence)} remaining` : `Over by ${formatPence(Math.abs(remainingSplitPence))}`}</span>}
              </div>
              {isSplitEnabled && (
                <div className="mv-transaction-splits space-y-2">
                  <div className="flex justify-end pr-7 text-[10px] font-semibold text-muted"><span className="w-36">Amount (£)</span></div>
                  {splits.map((splitRow, idx) => (
                    <div key={idx} className="mv-hscroll items-center">
                      <select aria-label={`Split ${idx + 1} category`} value={splitRow.categoryId} onChange={(e) => handleUpdateSplitRow(idx, 'categoryId', e.target.value)} className="mv-transaction-control flex-1" required><option value="">Select category</option>{getTransactionCategoryOptions(categories, type, initialTransaction?.type === type && splitRow.originalCategoryId ? [splitRow.originalCategoryId] : []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                      <MoneyInput wrapperClassName="w-36" type="text" inputMode="decimal" placeholder="0.00" value={splitRow.amountStr} onChange={(e) => handleUpdateSplitRow(idx, 'amountStr', e.target.value)} className="mv-transaction-control w-full" aria-label={`Split ${idx + 1} amount in pounds sterling`} />
                      <button type="button" onClick={() => handleRemoveSplitRow(idx)} className="p-1 text-muted text-subtle hover:text-danger transition" title="Remove split"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={handleAddSplitRow} className="inline-flex items-center gap-1 text-xs font-semibold text-success mt-1"><Plus className="w-3.5 h-3.5" />Add Split</button>
                </div>
              )}
            </div>
          )}
          </div>

          <div><label htmlFor="transaction-notes" className="block text-xs font-semibold text-muted mb-1">Notes</label><input id="transaction-notes" type="text" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mv-transaction-control w-full" /></div>
          </div>

          <div className="mv-modal-fixed-actions">
            <button type="button" onClick={closeModal} className="mv-transaction-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting || repaymentAmountBlocked} className="mv-transaction-primary">{isSubmitting ? 'Saving...' : initialTransaction ? 'Update Transaction' : 'Record Transaction'}</button>
          </div>
        </form>

        {mobileAccountPicker && (
          <div className="mv-mobile-account-picker-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) closeMobileAccountPicker(); }}>
            <div className="mv-mobile-account-picker" role="dialog" aria-modal="true" aria-label={activeMobilePickerTitle}>
              <div className="mv-mobile-account-picker-header">
                <span>{activeMobilePickerTitle}</span>
                <button type="button" onClick={closeMobileAccountPicker} aria-label={`Close ${activeMobilePickerTitle} selector`}><X aria-hidden="true" /></button>
              </div>
              <div className="mv-mobile-account-picker-list" role="listbox" aria-label={activeMobilePickerTitle}>
                {activeMobilePickerOptions.map((account) => (
                  <button key={account.id} type="button" role="option" aria-selected={account.id === activeMobilePickerValue} className="mv-mobile-account-picker-option" onClick={() => chooseMobileAccount(account)}>
                    <span className="mv-mobile-account-picker-identity">{accountIdentityLabel(account)}</span>
                    <span className="mv-mobile-account-picker-balance">{formatPence(account.currentBalancePence)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};