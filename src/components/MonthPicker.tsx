import React, { forwardRef } from 'react';
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
    ref
  ) => (
    <span className={`mv-month-picker ${className}`}>
      <CalendarDays className="mv-month-picker-icon" aria-hidden="true" />
      <input
        ref={ref}
        id={id}
        type="month"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        disabled={disabled}
        className="mv-month-picker-input"
      />
    </span>
  )
);

MonthPicker.displayName = 'MonthPicker';
