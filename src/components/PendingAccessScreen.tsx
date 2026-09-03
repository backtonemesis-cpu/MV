import React from 'react';
import { signOut } from 'firebase/auth';
import { Clock, ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { auth } from '../firebase';
import { clearAuthToken } from '../utils/api';

interface PendingAccessScreenProps {
  userEmail: string;
  onSwitchToOwner: () => void;
}

export const PendingAccessScreen: React.FC<PendingAccessScreenProps> = ({
  userEmail,
  onSwitchToOwner,
}) => {
  const canSimulateIdentity = import.meta.env.DEV;

  const handleSignOut = async () => {
    clearAuthToken();
    await signOut(auth);
    window.location.reload();
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-3xl p-8 border border-neutral-200 dark:border-neutral-800 shadow-lg text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center mx-auto shadow-xs">
          <Clock className="w-8 h-8" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-900">
            Pending Household Approval
          </span>
          <h1 className="text-xl font-black text-neutral-900 dark:text-neutral-100 mt-3">
            Access Pending Authorization
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 leading-relaxed">
            Your account <code className="text-neutral-800 dark:text-neutral-200 font-semibold">{userEmail}</code> is authenticated, but new household accounts start as <strong>Pending</strong>.
          </p>
        </div>

        <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 text-left text-xs text-neutral-600 dark:text-neutral-300 space-y-2">
          <div className="flex items-center gap-2 font-bold text-neutral-800 dark:text-neutral-200">
            <ShieldAlert className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            Security Rule Enforcement
          </div>
          <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal">
            No household financial records, account balances, transactions, or budgets are transmitted until the Household Owner approves your role as Editor or View-only.
          </p>
        </div>

        {canSimulateIdentity ? (
          <button
            onClick={onSwitchToOwner}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Switch Back to Marius (Development)
          </button>
        ) : (
          <button
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        )}
      </div>
    </div>
  );
};
