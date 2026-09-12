import React, { useRef, useState } from 'react';
import { X } from 'lucide-react';
import { PlannedPayment, Account, Category, HouseholdMember, TransactionType } from '../types';
import { parseToPence } from '../utils/currency';
import { resolveAccountOwnerPayer } from '../utils/accountOwner';
import { createCategoryEligibility } from '../utils/categoryEligibility';
import { localMonthInputValue } from '../utils/dateInput';
import type { CategoryGroup } from '../types';
import { MonthPicker } from './MonthPicker';
import { useModalAccessibility } from '../utils/modalAccessibility';
import { MoneyInput } from './MoneyInput';
import { CategorySelect } from './CategorySelect';
import {
  UnifiedAddAccountField,
  UnifiedAddFooter,
  UnifiedAddStatusMessage,
  UnifiedAddTypeTabs,
} from './UnifiedAddUi';

const UNIFIED_BILL_SESSION_KEY = 'mv-unified-add-bill';
const SWITCH_UNIFIED_TYPE_EVENT = 'mv:switch-unified-add-type';

interface PlannedPaymentModalProps {
  payment?: PlannedPayment | null;
  accounts: Account[];
  categories: Category[];
  categoryGroups: CategoryGroup[];
  members: HouseholdMember[];
  activeMonth: string;
  onClose: () => void;
  onSave: (paymentData: Partial<PlannedPayment>) => Promise<void>;
}

export const PlannedPaymentModal: React.FC<PlannedPaymentModalProps> = ({
  payment, accounts, categories, categoryGroups, members, activeMonth, onClose, onSave,
}) => {
  const { getBillCategoryOptions, isBillCategorySelectionAllowed } = createCategoryEligibility(categoryGroups);
  const isEditing = Boolean(payment);
  const isUnifiedAdd = !payment && typeof window !== 'undefined' && window.sessionStorage.getItem(UNIFIED_BILL_SESSION_KEY) === '1';

  const [name, setName] = useState(payment?.name || '');
  const [amountStr, setAmountStr] = useState(payment ? (payment.amountPence / 100).toFixed(2) : '');
  const [month, setMonth] = useState(payment?.month || activeMonth || localMonthInputValue());
  const [accountId, setAccountId] = useState(payment?.accountId || '');
  const [dueDate, setDueDate] = useState(payment?.dueDate || '');
  const [categoryId, setCategoryId] = useState(payment?.categoryId || '');
  const [includeInTransferPlan, setIncludeInTransferPlan] = useState<boolean>(payment?.includeInTransferPlan === true);
  const [isRecurring, setIsRecurring] = useState<boolean>(payment?.isRecurring === true);
  const [notes, setNotes] = useState(payment?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const paymentAccountOptions = accounts.filter((account) => account.isActive !== false || account.id === payment?.accountId);
  const billCategoryOptions = getBillCategoryOptions(categories, payment?.categoryId);

  const clearUnifiedState = () => {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(UNIFIED_BILL_SESSION_KEY);
  };
  const closeModal = () => { clearUnifiedState(); onClose(); };
  const dialogRef = useModalAccessibility<HTMLDivElement>(true, closeModal);

  const resetForNextBill = () => {
    setName('');
    setAmountStr('');
    setMonth(activeMonth || localMonthInputValue());
    setAccountId('');
    setDueDate('');
    setCategoryId('');
    setIncludeInTransferPlan(false);
    setIsRecurring(false);
    setNotes('');
    setError(null);
  };

  const switchToTransactionType = (type: TransactionType) => {
    setSuccessMessage(null);
    clearUnifiedState();
    onClose();
    window.dispatchEvent(new CustomEvent(SWITCH_UNIFIED_TYPE_EVENT, { detail: { type } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    if (!name.trim()) { setError('Payment / Bill name is required.'); return; }
    const pence = parseToPence(amountStr);
    if (pence <= 0) { setError('Please enter a valid amount in pounds and pence.'); return; }
    if (!accountId) { setError('Choose the account that will pay this bill.'); return; }
    if (!month.trim()) { setError('Billing month is required.'); return; }
    if (!isBillCategorySelectionAllowed(categories, categoryId, payment?.categoryId)) {
      setError('Choose a spending category that is valid for bills.'); return;
    }

    const selectedAccount = accounts.find((account) => account.id === accountId);
    const responsiblePerson =
      payment && payment.accountId === accountId
        ? payment.responsiblePerson
        : resolveAccountOwnerPayer(selectedAccount, members);
    if (!responsiblePerson) {
      setError('The selected payment account has no valid owner. Review the account before recording this bill.');
      return;
    }

    try {
      setIsSubmitting(true); setError(null);
      await onSave({
        name: name.trim(), amountPence: pence, month: month.trim(), accountId,
        responsiblePerson, dueDate: dueDate || undefined,
        categoryId: categoryId || undefined, includeInTransferPlan, isRecurring,
        notes: notes.trim() || undefined,
      });

      if (isUnifiedAdd && !isEditing) {
        resetForNextBill();
        setSuccessMessage('Bill recorded. Ready for another entry.');
        window.requestAnimationFrame(() => {
          dialogRef.current?.querySelector<HTMLElement>('.mv-add-bill-scroll')?.scrollTo({ top: 0 });
        });
      } else {
        clearUnifiedState();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save scheduled payment');
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="mv-modal-backdrop">
      <div ref={dialogRef} className="mv-modal-card mv-add-bill-modal" data-unified-add={isUnifiedAdd ? 'true' : undefined} role="dialog" aria-modal="true" aria-labelledby="planned-payment-title" tabIndex={-1}>
        <div className="mv-modal-header">
          <h3 id="planned-payment-title" className="text-base font-semibold text-main">{isEditing ? 'Edit Bill' : isUnifiedAdd ? 'New Transaction' : 'Add Bill'}</h3>
          <button type="button" onClick={closeModal} className="mv-modal-close" aria-label="Close bill dialog"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="mv-modal-form mv-add-bill-form flex min-h-0 flex-1 flex-col" noValidate>
          <div className="mv-add-bill-scroll mv-modal-scroll-body mv-transaction-body">
            {error && <UnifiedAddStatusMessage variant="error">{error}</UnifiedAddStatusMessage>}
            {successMessage && <UnifiedAddStatusMessage variant="success">{successMessage}</UnifiedAddStatusMessage>}
            {isUnifiedAdd && (
              <UnifiedAddTypeTabs
                activeType="bill"
                onSelect={(choice) => {
                  if (choice !== 'bill') switchToTransactionType(choice);
                }}
                labelId="planned-payment-type-label"
                prompt="What would you like to add?"
              />
            )}

            <div><label htmlFor="planned-payment-name" className="block text-xs font-semibold text-muted mb-1">Name *</label><input ref={nameInputRef} id="planned-payment-name" type="text" placeholder="Bill name" value={name} onChange={(e) => setName(e.target.value)} className="mv-transaction-control w-full" required /></div>
            <div className="mv-modal-grid-2">
              <div><label htmlFor="planned-payment-amount" className="block text-xs font-semibold text-muted mb-1">Amount (£) *</label><MoneyInput id="planned-payment-amount" type="text" inputMode="decimal" placeholder="0.00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} className="mv-transaction-control w-full" aria-label="Bill amount in pounds sterling" required /></div>
              <div><label htmlFor="planned-payment-month" className="block text-xs font-semibold text-muted mb-1">Month *</label><MonthPicker id="planned-payment-month" value={month} onChange={setMonth} ariaLabel="Billing month" className="is-fluid" /></div>
            </div>

            <UnifiedAddAccountField
              id="planned-payment-account"
              label="Payment Account *"
              value={accountId}
              options={paymentAccountOptions}
              onChange={setAccountId}
              placeholder="Select payment account"
            />

            <div className="mv-modal-grid-2">
              <div><label htmlFor="planned-payment-due-date" className="block text-xs font-semibold text-muted mb-1">Due Date</label><input id="planned-payment-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mv-transaction-control w-full" /></div>
              <div>
                <label htmlFor="planned-payment-category" className="block text-xs font-semibold text-muted mb-1">Category</label>
                <CategorySelect
                  id="planned-payment-category"
                  value={categoryId}
                  categories={billCategoryOptions}
                  categoryGroups={categoryGroups}
                  onValueChange={setCategoryId}
                  ariaLabel="Bill category"
                  placeholder="Select category"
                  required
                  className="mv-transaction-control w-full"
                />
              </div>
            </div>

            <div className="mv-modal-section space-y-2">
              <div className="flex items-center justify-between"><label htmlFor="modal-include-plan-toggle" className="text-xs font-medium text-main cursor-pointer">Include in Transfer Plan</label><input type="checkbox" id="modal-include-plan-toggle" checked={includeInTransferPlan} onChange={(e) => setIncludeInTransferPlan(e.target.checked)} className="w-4 h-4 text-main rounded border-muted focus:ring-muted cursor-pointer" /></div>
              <div className="flex items-center justify-between pt-2 border-t border-muted"><label htmlFor="modal-recurring-toggle" className="text-xs font-medium text-main cursor-pointer">Recurring Monthly</label><input type="checkbox" id="modal-recurring-toggle" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="w-4 h-4 text-main rounded border-muted focus:ring-muted cursor-pointer" /></div>
            </div>
            <div><label htmlFor="planned-payment-notes" className="block text-xs font-semibold text-muted mb-1">Notes</label><textarea id="planned-payment-notes" rows={2} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mv-transaction-control w-full" /></div>
          </div>

          <UnifiedAddFooter
            onCancel={closeModal}
            submitLabel={isEditing ? 'Save Bill' : isUnifiedAdd ? 'Record Bill' : 'Add Bill'}
            submitting={isSubmitting}
            className="mv-add-bill-actions"
          />
        </form>
      </div>
    </div>
  );
};