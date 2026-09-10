import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { Account, TransactionType } from '../types';
import { formatPence } from '../utils/currency';
import { accountIdentityLabel } from '../utils/accountDisplay';
import { MVSelect, type MVSelectOption } from './MVSelect';

export type UnifiedAddChoice = TransactionType | 'bill';

const UNIFIED_ADD_CHOICES: UnifiedAddChoice[] = [
  'expense',
  'income',
  'transfer',
  'refund',
  'repayment',
  'bill',
];

interface UnifiedAddTypeTabsProps {
  activeType?: UnifiedAddChoice | null;
  onSelect: (type: UnifiedAddChoice) => void;
  labelId: string;
  prompt: string;
}

export const UnifiedAddTypeTabs: React.FC<UnifiedAddTypeTabsProps> = ({
  activeType,
  onSelect,
  labelId,
  prompt,
}) => (
  <div>
    <div id={labelId} className="block text-xs font-semibold text-muted mb-1.5">
      {prompt}
    </div>
    <div className="mv-transaction-type-tabs" role="group" aria-labelledby={labelId}>
      {UNIFIED_ADD_CHOICES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          className={`mv-transaction-type-tab ${activeType === type ? 'is-active' : ''}`}
          aria-label={`Add ${type}`}
          aria-pressed={activeType === type}
        >
          {type}
        </button>
      ))}
    </div>
  </div>
);

interface UnifiedAddAccountFieldProps {
  id: string;
  label: string;
  value: string;
  options: Account[];
  onChange: (accountId: string) => void;
  placeholder?: string;
  required?: boolean;
  summaryAriaPrefix?: string;
}

export const UnifiedAddAccountField: React.FC<UnifiedAddAccountFieldProps> = ({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = 'Select account',
  required = true,
  summaryAriaPrefix = 'Selected account',
}) => {
  const selectedAccount = options.find((account) => account.id === value);
  const selectOptions: MVSelectOption[] = options.map((account) => ({
    value: account.id,
    label: accountIdentityLabel(account),
    trailing: formatPence(account.currentBalancePence),
  }));
  const labelId = `${id}-label`;

  return (
    <div>
      <label id={labelId} htmlFor={id} className="block text-xs font-semibold text-muted mb-1">
        {label}
      </label>
      <MVSelect
        id={id}
        value={value}
        options={selectOptions}
        onValueChange={onChange}
        placeholder={placeholder}
        emptyMessage="No accounts available"
        ariaLabelledBy={labelId}
        required={required}
        className="mv-transaction-control"
      />

      {selectedAccount && (
        <div
          className="mv-selected-account-summary"
          aria-live="polite"
          aria-label={`${summaryAriaPrefix} ${accountIdentityLabel(selectedAccount)}, balance ${formatPence(selectedAccount.currentBalancePence)}`}
        >
          <div className="mv-selected-account-balance">
            Balance: {formatPence(selectedAccount.currentBalancePence)}
          </div>
        </div>
      )}
    </div>
  );
};

type UnifiedAddStatusVariant = 'error' | 'success' | 'warning';

interface UnifiedAddStatusMessageProps {
  variant: UnifiedAddStatusVariant;
  children: React.ReactNode;
  className?: string;
}

export const UnifiedAddStatusMessage: React.FC<UnifiedAddStatusMessageProps> = ({
  variant,
  children,
  className = '',
}) => {
  const Icon = variant === 'success' ? CheckCircle2 : AlertCircle;
  const role = variant === 'error' ? 'alert' : 'status';

  return (
    <div
      className={`mv-unified-add-status is-${variant} ${className}`.trim()}
      role={role}
      aria-live={variant === 'error' ? undefined : 'polite'}
    >
      <Icon aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
};

interface UnifiedAddFooterProps {
  onCancel: () => void;
  submitLabel: string;
  submitting?: boolean;
  disabled?: boolean;
  className?: string;
}

export const UnifiedAddFooter: React.FC<UnifiedAddFooterProps> = ({
  onCancel,
  submitLabel,
  submitting = false,
  disabled = false,
  className = '',
}) => (
  <div className={`mv-modal-fixed-actions mv-unified-add-footer ${className}`.trim()}>
    <button type="button" onClick={onCancel} className="mv-transaction-secondary">
      Cancel
    </button>
    <button
      type="submit"
      disabled={submitting || disabled}
      className="mv-transaction-primary disabled:opacity-50"
    >
      {submitting ? 'Saving...' : submitLabel}
    </button>
  </div>
);
