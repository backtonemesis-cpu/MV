import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Play,
  ShieldAlert,
  Loader2,
  FileCheck2,
} from 'lucide-react';
import { runAcceptanceTests } from '../utils/api';
import { TestResult } from '../types';

interface AcceptanceTestsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AcceptanceTestsModal: React.FC<AcceptanceTestsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<{ total: number; passed: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const executeSuite = async () => {
    try {
      setIsRunning(true);
      setError(null);
      const data = await runAcceptanceTests();
      setResults(data.results);
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message || 'Failed to execute test suite');
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      executeSuite();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Automated Acceptance Criteria Verification
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Automated verification of production requirements from GOOGLE_HANDOFF.md
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {summary && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                  Acceptance Test Suite Status
                </span>
                <div className="text-xl font-black text-emerald-800 dark:text-emerald-200 mt-0.5">
                  {summary.passed} / {summary.total} Passed ({summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 100}%)
                </div>
              </div>
              <button
                onClick={executeSuite}
                disabled={isRunning}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-semibold hover:bg-emerald-800 transition disabled:opacity-50"
              >
                {isRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                Re-run Suite
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Test items list */}
          <div className="space-y-2">
            {results.map((test) => (
              <div
                key={test.id}
                className="p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850 hover:bg-white dark:hover:bg-neutral-800 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {test.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {test.id}. {test.name}
                      </div>
                      <p className="text-[11px] text-neutral-600 dark:text-neutral-300 mt-0.5">{test.description}</p>
                      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 font-mono mt-1">{test.details}</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      test.passed
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                    }`}
                  >
                    {test.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
