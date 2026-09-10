import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, X } from 'lucide-react';
import type { Account, TransactionType } from '../types';
import { formatPence } from '../utils/currency';
import { accountIdentityLabel, accountOptionLabel } from '../utils/accountDisplay';

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
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedAccount = options.find((account) => account.id === value);

  const closePicker = () => {
    setIsPickerOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  useEffect(() => {
    if (!isPickerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closePicker();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPickerOpen]);

  const chooseAccount = (account: Account) => {
    onChange(account.id);
    closePicker();
  };

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-muted mb-1">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`mv-transaction-control mv-transaction-account-select w-full ${value ? '' : 'is-placeholder'}`.trim()}
        aria-required={required ? 'true' : undefined}
      >
        <option value="">{placeholder}</option>
        {options.map((account) => (
          <option key={account.id} value={account.id}>
            {accountOptionLabel(account)}
          </option>
        ))}
      </select>

      <button
        ref={triggerRef}
        type="button"
        className={`mv-mobile-account-trigger ${selectedAccount ? '' : 'is-placeholder'}`.trim()}
        onClick={() => setIsPickerOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={isPickerOpen}
        aria-label={`${label.replace(/\s*\*$/, '')} selector`}
      >
        <span data-mv-value-primary>
          {selectedAccount ? accountIdentityLabel(selectedAccount) : placeholder}
        </span>
        <ChevronDown aria-hidden="true" />
      </button>

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

      {isPickerOpen && (
        <div
          className="mv-mobile-account-picker-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closePicker();
          }}
        >
          <div
            className="mv-mobile-account-picker"
            role="dialog"
            aria-modal="true"
            aria-label={label.replace(/\s*\*$/, '')}
          >
            <div className="mv-mobile-account-picker-header">
              <span>{label.replace(/\s*\*$/, '')}</span>
              <button
                type="button"
                onClick={closePicker}
                aria-label={`Close ${label.replace(/\s*\*$/, '')} selector`}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <div
              className="mv-mobile-account-picker-list"
              role="listbox"
              aria-label={label.replace(/\s*\*$/, '')}
            >
              {options.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  role="option"
                  aria-selected={account.id === value}
                  className="mv-mobile-account-picker-option"
                  onClick={() => chooseAccount(account)}
                >
                  <span className="mv-mobile-account-picker-identity" data-mv-value-primary>
                    {accountIdentityLabel(account)}
                  </span>
                  <span className="mv-mobile-account-picker-balance">
                    {formatPence(account.currentBalancePence)}
                  </span>
                </button>
              ))}
            </div>
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
