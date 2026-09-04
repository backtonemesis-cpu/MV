import React, { useState } from 'react';
import {
  X,
  Download,
  Upload,
  ShieldCheck,
  AlertCircle,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import { fetchBackup, preflightRestore, restoreBackup } from '../utils/api';

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
      a.download = `mv_household_backup_${new Date().toISOString().split('T')[0]}.json`;
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
      <div className="mv-modal-card">
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

        <div className="mv-modal-body space-y-3 overflow-y-auto">
          {error && (
            <div className="p-3 bg-danger-soft border border-danger rounded-xl text-xs text-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-danger" />
              <span>{error}</span>
            </div>
          )}

          {/* Export Section */}
          <div className="bg-surface-muted p-4 rounded-xl border border-muted">
            <h3 className="text-xs font-bold text-main uppercase tracking-wider mb-1">
              Backup
            </h3>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-surface text-on-accent rounded-xl text-xs font-semibold hover:bg-surface-muted transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Generating...' : 'Download Backup'}
            </button>
          </div>

          {/* Restore Section (Owner Only) */}
          <div className="border-t border-muted pt-5">
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
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-muted text-subtle file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-success-soft file:text-success hover:file:bg-success-soft"
                />

                <textarea
                  placeholder="Paste backup JSON"
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  className="w-full h-24 p-2 text-[11px] font-mono rounded-xl border border-muted"
                />

                <button
                  onClick={handleRestore}
                  disabled={isImporting || !importJson.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-on-accent rounded-xl text-xs font-semibold hover:bg-success-soft transition disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {isImporting ? 'Restoring...' : 'Restore Backup'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
