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
import { formatPence } from '../utils/currency';

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
  const [reconciliation, setReconciliation] = useState<any | null>(null);
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
      const res = await restoreBackup(parsed, expectedVersion);
      setReconciliation(res.reconciliation);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to restore backup');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-neutral-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
            <h2 className="text-base font-bold text-neutral-900">Backup & Restore System</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Export Section */}
          <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-200">
            <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider mb-1">
              Export Verified Backup
            </h3>
            <p className="text-xs text-neutral-500 mb-3">
              Generates a validated JSON archive of all accounts, categories, transactions, splits, plans, savings, and audit evidence.
            </p>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-semibold hover:bg-neutral-800 transition disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Generating...' : 'Download Full JSON Archive'}
            </button>
          </div>

          {/* Restore Section (Owner Only) */}
          <div className="border-t border-neutral-200 pt-5">
            <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider mb-1">
              Restore / Migration Import
            </h3>
            <p className="text-xs text-neutral-500 mb-3">
              Validates relationships, exact pence values, reconciled balances, and the current household version before one atomic restore.
            </p>

            {!isOwner ? (
              <div className="p-3 bg-neutral-100 rounded-xl text-xs text-neutral-600">
                Only the Household Owner (Marius) can execute dataset restores.
              </div>
            ) : reconciliation ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Migration & Reconciliation Passed!
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-200">
                  <div>
                    Transactions: {reconciliation.preTransactions} → {reconciliation.postTransactions}
                  </div>
                  <div>
                    Authoritative Balance: {formatPence(reconciliation.postBalancePence)}
                  </div>
                </div>
                <p className="text-[10px] text-emerald-700 mt-1">
                  Full reconciliation record logged in append-only audit trail.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="block w-full text-xs text-neutral-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />

                <textarea
                  placeholder="Or paste backup JSON contents here..."
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  className="w-full h-24 p-2 text-[11px] font-mono rounded-xl border border-neutral-300"
                />

                <button
                  onClick={handleRestore}
                  disabled={isImporting || !importJson.trim()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 text-white rounded-xl text-xs font-semibold hover:bg-emerald-800 transition disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  {isImporting ? 'Reconciling & Restoring...' : 'Validate & Execute Restore'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
