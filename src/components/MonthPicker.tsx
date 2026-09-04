import React, { forwardRef, useRef } from 'react';
import { CalendarDays } from 'lucide-react';

interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
  id?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}

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
    },
    forwardedRef
  ) => {
    const inputRef = useRef<HTMLInputElement | null>(null);

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
        className={`mv-month-picker ${className}`}
        onClick={openPicker}
        data-disabled={disabled ? 'true' : 'false'}
      >
        <CalendarDays className="mv-month-picker-icon" aria-hidden="true" />
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
          className="mv-month-picker-input"
        />
      </span>
    );
  }
);

MonthPicker.displayName = 'MonthPicker';
