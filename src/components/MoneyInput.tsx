import React, { forwardRef } from 'react';

interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode'> {
  wrapperClassName?: string;
  type?: 'text';
  inputMode?: 'decimal';
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ wrapperClassName = '', className = '', ...inputProps }, ref) => (
    <div className={`mv-money-input-shell ${wrapperClassName}`.trim()}>
      <input
        {...inputProps}
        type="text"
        inputMode="decimal"
        ref={ref}
        className={`mv-money-input-control ${className}`.trim()}
      />
    </div>
  )
);

MoneyInput.displayName = 'MoneyInput';
