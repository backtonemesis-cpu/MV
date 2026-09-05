import React, { useEffect, useRef, useState } from 'react';
import { X, Calendar, User, Landmark, Tag, CheckSquare, AlertCircle } from 'lucide-react';
import { PlannedPayment, Account, Category, Payer, HouseholdMember } from '../types';
import { householdPersonOptions } from '../utils/householdPeople';
import { parseToPence } from '../utils/currency';
import { accountOptionLabel } from '../utils/accountDisplay';
import { MonthPicker } from './MonthPicker';

interface PlannedPaymentModalProps {
  payment?: PlannedPayment | null;
  accounts: Account[];
  categories: Category[];
  members: HouseholdMember[];
  activeMonth: string;
  onClose: () => void;
  onSave: (paymentData: Partial<PlannedPayment>) => Promise<void>;
}

export const PlannedPaymentModal: React.FC<PlannedPaymentModalProps> = ({
  payment,
  accounts,
  categories,
  members,
  activeMonth,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(payment);

  const [name, setName] = useState(payment?.name || '');
  const [amountStr, setAmountStr] = useState(
    payment ? (payment.amountPence / 100).toFixed(2) : ''
  );
  const [month, setMonth] = useState(payment?.month || activeMonth || '2026-09');
  const [accountId, setAccountId] = useState(payment?.accountId || '');
  const [responsiblePerson, setResponsiblePerson] = useState<Payer | ''>(
    payment?.responsiblePerson || ''
  );
  const [dueDate, setDueDate] = useState(payment?.dueDate || '');
  const [categoryId, setCategoryId] = useState(payment?.categoryId || '');
  const [includeInTransferPlan, setIncludeInTransferPlan] = useState<boolean>(
    payment?.includeInTransferPlan === true
  );
  const [isRecurring, setIsRecurring] = useState<boolean>(payment?.isRecurring === true);
  const [notes, setNotes] = useState(payment?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const personOptions = householdPersonOptions(
    members,
    responsiblePerson ? [responsiblePerson] : []
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => nameInputRef.current?.focus());
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleAccountChange = (newAccId: string) => {
    setAccountId(newAccId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Payment / Bill name is required.');
      return;
    }
    const pence = parseToPence(amountStr);
    if (pence <= 0) {
      setError('Please enter a valid amount in pounds and pence (e.g. 349.79).');
      return;
    }
    if (!accountId) {
      setError('Choose the account that will pay this bill.');
      return;
    }
    if (!responsiblePerson) {
      setError('Choose the responsible person.');
      return;
    }
    if (!month.trim()) {
      setError('Billing month is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave({
        name: name.trim(),
        amountPence: pence,
        month: month.trim(),
        accountId,
        responsiblePerson: responsiblePerson as Payer,
        dueDate: dueDate || undefined,
        categoryId: categoryId || undefined,
        includeInTransferPlan,
        isRecurring,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save scheduled payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mv-modal-backdrop">
      <div className="mv-modal-card">
        <div className="mv-modal-header">
          <div>
            <h3 className="text-base font-semibold text-main">
              {isEditing ? 'Edit Bill' : 'Add Bill'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="mv-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mv-modal-form">
          {error && (
            <div className="p-3 bg-danger-soft border border-danger rounded-lg flex items-start gap-2 text-danger text-xs">
              <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Payment Name */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Name *
            </label>
            <input
              ref={nameInputRef}
              type="text"
              placeholder="Bill name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
              required
            />
          </div>

          {/* Amount & Month */}
          <div className="mv-modal-grid-2">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Amount *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-muted text-subtle font-medium">£</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="349.79"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-sm font-semibold border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Month *
              </label>
              <MonthPicker
                value={month}
                onChange={setMonth}
                ariaLabel="Billing month"
                className="is-fluid"
              />
            </div>
          </div>

          {/* Payment Account & Responsible */}
          <div className="mv-modal-grid-2">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Payment Account *
              </label>
              <select
                value={accountId}
                onChange={(e) => handleAccountChange(e.target.value)}
                className="w-full text-xs font-medium border border-muted rounded-md p-2 bg-surface focus:ring-1 focus:ring-muted focus:outline-none"
                required
              >
                <option value="">Select payment account</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {accountOptionLabel(acc)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Responsible Person
              </label>
              <select
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value as Payer | '')}
                className="w-full text-xs font-medium border border-muted rounded-md p-2 bg-surface focus:ring-1 focus:ring-muted focus:outline-none"
                required
              >
                <option value="">Select person</option>
                {personOptions.map((person) => (
                  <option key={person} value={person}>
                    {person}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date & Category */}
          <div className="mv-modal-grid-2">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full text-xs font-medium border border-muted rounded-md p-2 bg-surface focus:ring-1 focus:ring-muted focus:outline-none"
              >
                <option value="">Select category (optional)</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Transfer-plan and recurrence settings. Paid state is derived from linked actual payment evidence. */}
          <div className="mv-modal-section space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-main">Include in Transfer Plan</span>
              </div>
              <input
                type="checkbox"
                id="modal-include-plan-toggle"
                checked={includeInTransferPlan}
                onChange={(e) => setIncludeInTransferPlan(e.target.checked)}
                className="w-4 h-4 text-main rounded border-muted focus:ring-muted cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-muted">
              <div>
                <span className="text-xs font-medium text-main">Recurring Monthly</span>
              </div>
              <input
                type="checkbox"
                id="modal-recurring-toggle"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="w-4 h-4 text-main rounded border-muted focus:ring-muted cursor-pointer"
              />
            </div>

          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
            />
          </div>

          {/* Actions */}
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
              disabled={isSubmitting}
              className="bg-accent text-on-accent font-semibold disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
