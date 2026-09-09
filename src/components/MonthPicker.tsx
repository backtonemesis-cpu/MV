import React, { forwardRef, useRef } from 'react';

type MonthPickerDisplayFormat = 'native' | 'short-uk';

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
  id?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  displayFormat?: MonthPickerDisplayFormat;
}

export const formatMonthShortUk = (value: string): string => {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return '';

  return new Intl.DateTimeFormat('en-GB', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
};

export const MonthPicker = forwardRef<HTMLInputElement, MonthPickerProps>(
  (
    {
      value,
      onChange,
      id,
      ariaLabel = 'Select month',
      autoFocus = false,
      disabled = false,
      className = '',
      inputClassName = '',
      displayFormat = 'native',
    },
    forwardedRef
  ) => {
    const inputRef = useRef<HTMLInputElement | null>(null);
    const shortDisplayValue = displayFormat === 'short-uk' ? formatMonthShortUk(value) : '';

    const setInputRef = (node: HTMLInputElement | null) => {
      inputRef.current = node;

      if (typeof forwardedRef === 'function') {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    };

    const openPicker = () => {
      if (disabled) return;

      const input = inputRef.current;
      if (!input) return;

      input.focus({ preventScroll: true });

      try {
        input.showPicker?.();
      } catch {
        // Browsers without programmatic picker support still receive focus
        // and retain their native calendar indicator as a fallback.
      }
    };

    return (
      <span
        className={`mv-month-picker ${displayFormat === 'short-uk' ? 'has-short-uk-display' : ''} ${className}`.trim()}
        onClick={openPicker}
        data-disabled={disabled ? 'true' : 'false'}
        data-display-format={displayFormat}
      >
        <input
          ref={setInputRef}
          id={id}
          type="month"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'ArrowDown') {
              event.preventDefault();
              openPicker();
            }
          }}
          aria-label={ariaLabel}
          autoFocus={autoFocus}
          disabled={disabled}
          className={`mv-month-picker-input ${inputClassName}`.trim()}
        />
        {displayFormat === 'short-uk' && shortDisplayValue && (
          <span className="mv-month-picker-short-display" aria-hidden="true">
            {shortDisplayValue}
          </span>
        )}
      </span>
    );
  }
);

MonthPicker.displayName = 'MonthPicker';
