import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useModalAccessibility } from '../utils/modalAccessibility';

interface ConfirmActionDialogProps {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  onClose?: () => void;
  open?: boolean;
  busy?: boolean;
  danger?: boolean;
  ariaLabel?: string;
  error?: string | null;
}

export const ConfirmActionDialog: React.FC<ConfirmActionDialogProps> = ({
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  onClose,
  open = true,
  busy = false,
  danger = true,
  ariaLabel,
  error,
}) => {
  const [internalError, setInternalError] = useState<string | null>(null);
  const cancel = onCancel ?? onClose ?? (() => {});
  const dialogRef = useModalAccessibility<HTMLElement>(open, cancel);
  const titleId = 'mv-confirm-action-title';
  const descriptionId = 'mv-confirm-action-description';
  const visibleError = error || internalError;

  if (!open) return null;

  const handleConfirm = async () => {
    try {
      setInternalError(null);
      await onConfirm();
    } catch (err: any) {
      setInternalError(err?.message || 'The action could not be completed.');
    }
  };

  return (
    <div className="mv-modal-backdrop">
      <section
        ref={dialogRef}
        className="mv-modal-card max-w-[520px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-label={ariaLabel}
        tabIndex={-1}
      >
        <div className="mv-modal-header">
          <div className="flex min-w-0 items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
            <h2 id={titleId} className="text-base font-bold text-main">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="mv-modal-close"
            aria-label="Close confirmation"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mv-modal-form">
          <div
            id={descriptionId}
            className="rounded-lg border border-danger bg-danger-soft px-3 py-3 text-xs leading-5 text-main"
          >
            {description}
          </div>

          {visibleError && (
            <div
              role="alert"
              className="rounded-lg border border-danger bg-danger-soft px-3 py-3 text-xs leading-5 text-danger"
            >
              {visibleError}
            </div>
          )}

          <div className="mv-modal-actions">
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              data-modal-initial-focus
              className="min-h-11 px-4 py-2 text-xs font-semibold text-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={busy}
              className={
                danger
                  ? 'inline-flex min-h-11 items-center justify-center rounded-lg border border-danger bg-danger-soft px-4 py-2 text-xs font-semibold text-danger disabled:opacity-50'
                  : 'inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-on-accent disabled:opacity-50'
              }
            >
              {busy ? 'Working…' : confirmLabel}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
