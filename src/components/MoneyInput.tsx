import React, { forwardRef } from 'react';

interface MoneyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ wrapperClassName = '', className = '', ...inputProps }, ref) => (
    <div className={`mv-money-input-shell ${wrapperClassName}`.trim()}>
      <span className="mv-money-prefix" aria-hidden="true">
        £
      </span>
      <input
        {...inputProps}
        ref={ref}
        className={`mv-money-input-control ${className}`.trim()}
      />
    </div>
  )
);

MoneyInput.displayName = 'MoneyInput';
