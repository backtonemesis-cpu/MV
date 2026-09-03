import React from 'react';
import { Clock, ShieldAlert, ArrowLeft } from 'lucide-react';

interface PendingAccessScreenProps {
  userEmail: string;
  onSwitchToOwner: () => void;
}

export const PendingAccessScreen: React.FC<PendingAccessScreenProps> = ({
  userEmail,
  onSwitchToOwner,
}) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-neutral-200 shadow-lg text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-xs">
          <Clock className="w-8 h-8" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
            Pending Household Approval
          </span>
          <h1 className="text-xl font-black text-neutral-900 mt-3">
            Access Pending Authorization
          </h1>
          <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
            Your account <code className="text-neutral-800 font-semibold">{userEmail}</code> is authenticated, but per household security policies, new accounts start as <strong>Pending</strong>.
          </p>
        </div>

        <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-4 text-left text-xs text-neutral-600 space-y-2">
          <div className="flex items-center gap-2 font-bold text-neutral-800">
            <ShieldAlert className="w-4 h-4 text-emerald-700" />
            Security Rule Enforcement
          </div>
          <p className="text-[11px] text-neutral-500 leading-normal">
            No household financial records, account balances, transactions, or budgets are transmitted until Marius (<code>backtonemesis@gmail.com</code>) approves your role as Household Editor or View-Only.
          </p>
        </div>

        <button
          onClick={onSwitchToOwner}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Switch Back to Marius (Owner) to Approve
        </button>
      </div>
    </div>
  );
};
