import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  onRefresh: () => void;
  onClose: () => void;
  serverVersion?: number;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  onRefresh,
  onClose,
  serverVersion,
}) => {
  if (!isOpen) return null;

  return (
    <div className="mv-modal-backdrop">
      <div className="mv-modal-card mv-modal-body text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-warning-soft text-warning flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div>
          <h2 className="text-base font-bold text-main">
            Data Changed
          </h2>
          <p className="text-xs text-muted text-subtle mt-1.5">Reload before saving again.</p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-xs font-semibold text-muted hover:bg-surface-muted rounded-xl transition"
          >
            Close
          </button>
          <button
            onClick={onRefresh}
            className="flex-1 py-2 bg-accent hover:bg-success-soft text-on-accent text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload
          </button>
        </div>
      </div>
    </div>
  );
};
