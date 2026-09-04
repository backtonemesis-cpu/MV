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
    <div className="mv-modal-backdrop">
      <div className="mv-modal-card mv-modal-wide flex flex-col">
        {/* Header */}
        <div className="mv-modal-header shrink-0">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-success" />
            <div>
              <h2 className="text-base font-bold text-main">
                Automated Acceptance Criteria Verification
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="mv-modal-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="mv-modal-body overflow-y-auto space-y-3">
          {summary && (
            <div className="p-4 rounded-xl bg-success-soft border border-success flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-success">
                  Acceptance Test Suite Status
                </span>
                <div className="text-xl font-black text-success mt-0.5">
                  {summary.passed} / {summary.total} Passed ({summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 100}%)
                </div>
              </div>
              <button
                onClick={executeSuite}
                disabled={isRunning}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-on-accent rounded-lg text-xs font-semibold hover:bg-success-soft transition disabled:opacity-50"
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
            <div className="p-3 bg-danger-soft border border-danger rounded-xl text-xs text-danger flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Test items list */}
          <div className="space-y-2">
            {results.map((test) => (
              <div
                key={test.id}
                className="p-3 rounded-xl border border-muted bg-surface-muted hover:bg-surface transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {test.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-bold text-main">
                        {test.id}. {test.name}
                      </div>
                      <p className="text-[11px] text-muted mt-0.5">{test.description}</p>
                      <p className="text-[10px] text-muted text-subtle font-mono mt-1">{test.details}</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                      test.passed
                        ? 'bg-success-soft text-success'
                        : 'bg-danger-soft text-danger'
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
