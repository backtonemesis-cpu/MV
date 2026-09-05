import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Download,
  ShieldCheck,
  AlertCircle,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import { fetchBackup, preflightRestore, restoreBackup } from '../utils/api';
import { localDateInputValue } from '../utils/dateInput';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOwner: boolean;
  expectedVersion: number;
  onSuccess: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  isOwner,
  expectedVersion,
  onSuccess,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importJson, setImportJson] = useState<string>('');
  const [restoreComplete, setRestoreComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => fileInputRef.current?.focus());
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);
      const backupData = await fetchBackup();

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mv_household_backup_${localDateInputValue()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Failed to export backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJson(content);
    };
    reader.readAsText(file);
  };

  const handleRestore = async () => {
    if (!importJson.trim()) {
      setError('Please provide or upload a backup JSON payload.');
      return;
    }

    try {
      setIsImporting(true);
      setError(null);
      const parsed = JSON.parse(importJson);

      const preflight = await preflightRestore(parsed);
      if (!preflight.valid) {
        throw new Error('Backup preflight did not pass.');
      }
      await restoreBackup(parsed, expectedVersion);
      setRestoreComplete(true);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to restore backup');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="mv-modal-backdrop">
      <div className="mv-modal-card mv-backup-modal">
        <div className="mv-modal-header">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-success" />
            <h2 className="text-base font-bold text-main">Backup & Restore</h2>
          </div>
          <button
            onClick={onClose}
            className="mv-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mv-modal-scroll-body">
          {error && (
            <div className="p-3 bg-danger-soft border border-danger rounded-xl text-xs text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
              <span>{error}</span>
            </div>
          )}

          {/* Export Section */}
          <section className="mv-backup-section">
            <h3 className="text-xs font-bold text-main uppercase tracking-wider mb-1">
              Backup
            </h3>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="mv-backup-secondary inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Generating...' : 'Download Backup'}
            </button>
          </section>

          {/* Restore Section (Owner Only) */}
          <section className="mv-backup-section">
            <h3 className="text-xs font-bold text-main uppercase tracking-wider mb-1">
              Restore
            </h3>
            <p className="text-xs text-muted text-subtle mb-3">Restoring replaces local data.</p>

            {!isOwner ? (
              <div className="p-3 bg-surface-muted rounded-xl text-xs text-muted">
                Owner only.
              </div>
            ) : restoreComplete ? (
              <div className="bg-success-soft border border-success rounded-xl p-4 text-xs text-success space-y-2">
                <div className="flex items-center gap-2 font-bold text-success">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  Local Backup Restored
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="block w-full"
                />

                <textarea
                  placeholder="Paste backup JSON"
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  className="w-full font-mono"
                />


              </div>
            )}
          </section>
        </div>

        <div className="mv-modal-fixed-actions">
          <button type="button" onClick={onClose} className="mv-backup-secondary">
            Close
          </button>
          {isOwner && !restoreComplete && (
            <button
              type="button"
              onClick={handleRestore}
              disabled={isImporting || !importJson.trim()}
              className="mv-backup-primary"
            >
              {isImporting ? 'Restoring…' : 'Restore Backup'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
