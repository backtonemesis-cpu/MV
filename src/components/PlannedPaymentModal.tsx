import React, { useRef, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { PlannedPayment, Account, Category, Payer, HouseholdMember, TransactionType } from '../types';
import { householdPersonOptions } from '../utils/householdPeople';
import { parseToPence } from '../utils/currency';
import { accountOptionLabel } from '../utils/accountDisplay';
import { createCategoryEligibility } from '../utils/categoryEligibility';
import type { CategoryGroup } from '../types';
import { MonthPicker } from './MonthPicker';
import { useModalAccessibility } from '../utils/modalAccessibility';
import { MoneyInput } from './MoneyInput';

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
  const [month, setMonth] = useState(payment?.month || activeMonth || '2026-09');
  const [accountId, setAccountId] = useState(payment?.accountId || '');
  const [responsiblePerson, setResponsiblePerson] = useState<Payer | ''>(payment?.responsiblePerson || '');
  const [dueDate, setDueDate] = useState(payment?.dueDate || '');
  const [categoryId, setCategoryId] = useState(payment?.categoryId || '');
  const [includeInTransferPlan, setIncludeInTransferPlan] = useState<boolean>(payment?.includeInTransferPlan === true);
  const [isRecurring, setIsRecurring] = useState<boolean>(payment?.isRecurring === true);
  const [notes, setNotes] = useState(payment?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const personOptions = householdPersonOptions(members, responsiblePerson ? [responsiblePerson] : []);
  const paymentAccountOptions = accounts.filter((account) => account.isActive !== false || account.id === payment?.accountId);
  const billCategoryOptions = getBillCategoryOptions(categories, payment?.categoryId);

  const clearUnifiedState = () => {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(UNIFIED_BILL_SESSION_KEY);
  };
  const closeModal = () => { clearUnifiedState(); onClose(); };
  const dialogRef = useModalAccessibility<HTMLDivElement>(true, closeModal);

  const switchToTransactionType = (type: TransactionType) => {
    clearUnifiedState();
    onClose();
    window.dispatchEvent(new CustomEvent(SWITCH_UNIFIED_TYPE_EVENT, { detail: { type } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Payment / Bill name is required.'); return; }
    const pence = parseToPence(amountStr);
    if (pence <= 0) { setError('Please enter a valid amount in pounds and pence.'); return; }
    if (!accountId) { setError('Choose the account that will pay this bill.'); return; }
    if (!responsiblePerson) { setError('Choose the responsible person.'); return; }
    if (!month.trim()) { setError('Billing month is required.'); return; }
    if (!isBillCategorySelectionAllowed(categories, categoryId, payment?.categoryId)) {
      setError('Choose a spending category that is valid for bills.'); return;
    }

    try {
      setIsSubmitting(true); setError(null);
      await onSave({
        name: name.trim(), amountPence: pence, month: month.trim(), accountId,
        responsiblePerson: responsiblePerson as Payer, dueDate: dueDate || undefined,
        categoryId: categoryId || undefined, includeInTransferPlan, isRecurring,
        notes: notes.trim() || undefined,
      });
      clearUnifiedState();
      onClose();
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

        <form onSubmit={handleSubmit} className="mv-modal-form mv-add-bill-form">
          <div className="mv-add-bill-scroll">
            {error && <div className="p-3 bg-danger-soft border border-danger rounded-lg flex items-start gap-2 text-danger text-xs" role="alert"><AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" /><span>{error}</span></div>}
            {isUnifiedAdd && (
              <div>
                <div id="planned-payment-type-label" className="block text-xs font-semibold text-muted mb-1.5">What would you like to add?</div>
                <div className="mv-transaction-type-tabs" role="group" aria-labelledby="planned-payment-type-label">
                  {(['expense', 'income', 'transfer', 'refund', 'repayment'] as const).map((type) => (
                    <button key={type} type="button" onClick={() => switchToTransactionType(type)} className="mv-transaction-type-tab" aria-label={`Add ${type}`} aria-pressed="false">{type}</button>
                  ))}
                  <button type="button" className="mv-transaction-type-tab is-active" aria-label="Add bill" aria-pressed="true">bill</button>
                </div>
              </div>
            )}

            <div><label htmlFor="planned-payment-name" className="block text-xs font-medium text-muted mb-1">Name *</label><input ref={nameInputRef} id="planned-payment-name" type="text" placeholder="Bill name" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none" required /></div>
            <div className="mv-modal-grid-2">
              <div><label htmlFor="planned-payment-amount" className="block text-xs font-medium text-muted mb-1">Amount (£) *</label><MoneyInput id="planned-payment-amount" type="text" inputMode="decimal" placeholder="0.00" value={amountStr} onChange={(e) => setAmountStr(e.target.value)} className="w-full text-sm border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none" aria-label="Bill amount in pounds sterling" required /></div>
              <div><label htmlFor="planned-payment-month" className="block text-xs font-medium text-muted mb-1">Month *</label><MonthPicker id="planned-payment-month" value={month} onChange={setMonth} ariaLabel="Billing month" className="is-fluid" /></div>
            </div>

            <div className="mv-modal-grid-2">
              <div><label htmlFor="planned-payment-account" className="block text-xs font-medium text-muted mb-1">Payment Account *</label><select id="planned-payment-account" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full text-xs font-medium border border-muted rounded-md p-2 bg-surface focus:ring-1 focus:ring-muted focus:outline-none" required><option value="">Select payment account</option>{paymentAccountOptions.map((acc) => (
                <option key={acc.id} value={acc.id}>{accountOptionLabel(acc)}</option>
              ))}</select></div>
              <div><label htmlFor="planned-payment-person" className="block text-xs font-medium text-muted mb-1">Responsible Person *</label><select id="planned-payment-person" value={responsiblePerson} onChange={(e) => setResponsiblePerson(e.target.value as Payer | '')} className="w-full text-xs font-medium border border-muted rounded-md p-2 bg-surface focus:ring-1 focus:ring-muted focus:outline-none" required><option value="">Select person</option>{personOptions.map((person) => <option key={person} value={person}>{person}</option>)}</select></div>
            </div>

            <div className="mv-modal-grid-2">
              <div><label htmlFor="planned-payment-due-date" className="block text-xs font-medium text-muted mb-1">Due Date</label><input id="planned-payment-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none" /></div>
              <div><label htmlFor="planned-payment-category" className="block text-xs font-medium text-muted mb-1">Category</label><select id="planned-payment-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full text-xs font-medium border border-muted rounded-md p-2 bg-surface focus:ring-1 focus:ring-muted focus:outline-none"><option value="">Select category</option>{billCategoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}</select></div>
            </div>

            <div className="mv-modal-section space-y-2">
              <div className="flex items-center justify-between"><label htmlFor="modal-include-plan-toggle" className="text-xs font-medium text-main cursor-pointer">Include in Transfer Plan</label><input type="checkbox" id="modal-include-plan-toggle" checked={includeInTransferPlan} onChange={(e) => setIncludeInTransferPlan(e.target.checked)} className="w-4 h-4 text-main rounded border-muted focus:ring-muted cursor-pointer" /></div>
              <div className="flex items-center justify-between pt-2 border-t border-muted"><label htmlFor="modal-recurring-toggle" className="text-xs font-medium text-main cursor-pointer">Recurring Monthly</label><input type="checkbox" id="modal-recurring-toggle" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="w-4 h-4 text-main rounded border-muted focus:ring-muted cursor-pointer" /></div>
            </div>
            <div><label htmlFor="planned-payment-notes" className="block text-xs font-medium text-muted mb-1">Notes</label><textarea id="planned-payment-notes" rows={2} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none" /></div>
          </div>

          <div className="mv-modal-fixed-actions mv-add-bill-actions">
            <button type="button" onClick={closeModal} className="mv-transaction-secondary">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="mv-transaction-primary disabled:opacity-50">{isSubmitting ? 'Saving...' : isEditing ? 'Save Bill' : isUnifiedAdd ? 'Record Bill' : 'Add Bill'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};
