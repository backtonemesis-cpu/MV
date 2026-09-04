import React, { useState } from 'react';
import { X, Calendar, User, Landmark, Tag, CheckSquare, AlertCircle } from 'lucide-react';
import { PlannedPayment, Account, Category, Payer, HouseholdMember } from '../types';
import { householdPersonOptions } from '../utils/householdPeople';
import { parseToPence } from '../utils/currency';
import { accountDisplayLabel } from '../utils/accountLabels';

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
  const [accountId, setAccountId] = useState(payment?.accountId || accounts[0]?.id || '');
  const [responsiblePerson, setResponsiblePerson] = useState<Payer>(
    payment?.responsiblePerson || 'Joint'
  );
  const [dueDate, setDueDate] = useState(payment?.dueDate || '');
  const [categoryId, setCategoryId] = useState(payment?.categoryId || categories[0]?.id || 'cat-housing');
  const hasRecordedTransaction = Boolean(payment?.actualTransactionId);
  const [status, setStatus] = useState<'unpaid' | 'paid'>(
    hasRecordedTransaction ? 'paid' : payment?.status || 'unpaid'
  );
  const [includeInTransferPlan, setIncludeInTransferPlan] = useState<boolean>(
    payment?.includeInTransferPlan !== undefined ? payment.includeInTransferPlan : true
  );
  const [notes, setNotes] = useState(payment?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const personOptions = householdPersonOptions(members, [responsiblePerson]);

  // When account changes, default responsible person to account owner if available
  const handleAccountChange = (newAccId: string) => {
    setAccountId(newAccId);
    const selectedAcc = accounts.find((a) => a.id === newAccId);
    if (selectedAcc?.ownerPerson) {
      setResponsiblePerson(selectedAcc.ownerPerson);
    }
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
      setError('Please choose a payment account.');
      return;
    }
    if (!month.trim()) {
      setError('Billing month is required (e.g. 2026-09).');
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
        responsiblePerson,
        dueDate: dueDate || undefined,
        categoryId: categoryId || undefined,
        status,
        includeInTransferPlan,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay backdrop-blur-xs">
      <div className="bg-surface rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-muted">
        <div className="flex items-center justify-between px-6 py-4 border-b border-muted bg-surface-muted">
          <div>
            <h3 className="text-base font-semibold text-main">
              {isEditing ? 'Edit Bill' : 'Add Bill'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted text-subtle hover:text-muted hover:bg-surface-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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
              type="text"
              placeholder="Bill name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
              required
            />
          </div>

          {/* Amount & Month */}
          <div className="grid grid-cols-2 gap-3">
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
              <input
                type="text"
                placeholder="2026-09"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                pattern="^\d{4}-\d{2}$"
                title="Format: YYYY-MM (e.g. 2026-09)"
                className="w-full px-3 py-1.5 text-sm border border-muted rounded-md focus:ring-1 focus:ring-muted focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Payment Account & Responsible */}
          <div className="grid grid-cols-2 gap-3">
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
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {accountDisplayLabel(acc)}
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
                onChange={(e) => setResponsiblePerson(e.target.value as Payer)}
                className="w-full text-xs font-medium border border-muted rounded-md p-2 bg-surface focus:ring-1 focus:ring-muted focus:outline-none"
              >
                {personOptions.map((person) => (
                  <option key={person} value={person}>
                    {person}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date & Category */}
          <div className="grid grid-cols-2 gap-3">
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
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status & Plan Inclusion (Separate Concepts) */}
          <div className="p-3 bg-surface-muted rounded-lg border border-muted space-y-3">
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
                <span className="text-xs font-medium text-main">Payment Status</span>
              </div>
              <div className="text-right">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'unpaid' | 'paid')}
                  disabled={hasRecordedTransaction}
                  className="text-xs font-medium border border-muted rounded-md px-2.5 py-1 bg-surface focus:ring-1 focus:ring-muted focus:outline-none disabled:opacity-70"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                </select>
                {hasRecordedTransaction && (
                  <p className="mt-1 max-w-[220px] text-[10px] leading-4 text-muted">
                    Locked as paid because an actual transaction is linked.
                  </p>
                )}
              </div>
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
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-on-accent bg-surface hover:bg-surface-muted rounded-md shadow-xs disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving...' : isEditing ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
