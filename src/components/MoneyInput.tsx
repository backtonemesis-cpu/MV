import React, { forwardRef } from 'react';

interface MoneyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  wrapperClassName?: string;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ wrapperClassName = '', className = '', ...inputProps }, ref) => (
    <div className={`mv-money-input-shell ${wrapperClassName}`.trim()}>
      <input
        {...inputProps}
        ref={ref}
        className={`mv-money-input-control ${className}`.trim()}
      />
    </div>
  )
);

MoneyInput.displayName = 'MoneyInput';
