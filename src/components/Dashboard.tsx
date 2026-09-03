import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Repeat,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Layers,
  ArrowLeftRight,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { HouseholdData, UserRole, NavTab } from '../types';
import {
  formatPence,
  calculateFinancialSummary,
  calculateMonthlySurplus,
} from '../utils/currency';

interface DashboardProps {
  household: HouseholdData;
  userRole: UserRole;
  selectedMonth: string;
  availableMonths: string[];
  onSelectMonth: (month: string) => void;
  onOpenMonthImport: () => void;
  onOpenAddTransaction: () => void;
  onOpenPlannedPaymentModal: () => void;
  onNavigateToTab: (tab: NavTab) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  household,
  userRole,
  selectedMonth,
  availableMonths,
  onSelectMonth,
  onOpenMonthImport,
  onOpenAddTransaction,
  onOpenPlannedPaymentModal,
  onNavigateToTab,
}) => {
  // Filter transactions for the selected month
  const monthTransactions = useMemo(() => {
    return household.transactions.filter((tx) => tx.date.startsWith(selectedMonth));
  }, [household.transactions, selectedMonth]);

  // Filter planned payments for the selected month
  const monthPlannedPayments = useMemo(() => {
    return (household.plannedPayments || []).filter((p) => p.month === selectedMonth);
  }, [household.plannedPayments, selectedMonth]);

  // Financial summary for the month
  const monthSummary = useMemo(() => {
    return calculateFinancialSummary(monthTransactions);
  }, [monthTransactions]);

  // Total household liquid funds across active accounts
  const totalLiquidBalancePence = useMemo(() => {
    return household.accounts
      .filter((a) => a.isActive !== false)
      .reduce((acc, a) => acc + a.currentBalancePence, 0);
  }, [household.accounts]);

  // Available Surplus calculation
  const surplusCalculation = useMemo(() => {
    return calculateMonthlySurplus(
      household.transactions,
      household.plannedPayments || [],
      selectedMonth,
      household.plannedIncomes || []
    );
  }, [household.transactions, household.plannedPayments, household.plannedIncomes, selectedMonth]);

  // Spending attribution by payer for the month
  const { mariusSpendPence, vestaSpendPence, jointSpendPence } = useMemo(() => {
    let m = 0;
    let v = 0;
    let j = 0;
    monthTransactions.forEach((tx) => {
      if (tx.type === 'expense' && !tx.isTransfer && !tx.isRepayment) {
        if (tx.payer === 'Marius') m += tx.amountPence;
        else if (tx.payer === 'Vesta') v += tx.amountPence;
        else j += tx.amountPence;
      }
    });
    return { mariusSpendPence: m, vestaSpendPence: v, jointSpendPence: j };
  }, [monthTransactions]);

  // Transfer Plan deficit calculation for quick snapshot
  const transferPlanSnapshot = useMemo(() => {
    const accountMap = new Map(household.accounts.map((a) => [a.id, a]));
    const deficits: { accountName: string; owner: string; deficitPence: number; totalCommitmentPence: number }[] = [];

    const grouped = new Map<string, number>();
    monthPlannedPayments
      .filter((p) => p.includeInTransferPlan && p.status !== 'paid')
      .forEach((p) => {
        grouped.set(p.accountId, (grouped.get(p.accountId) || 0) + p.amountPence);
      });

    grouped.forEach((totalCommitment, accId) => {
      const acc = accountMap.get(accId);
      const balance = acc ? acc.currentBalancePence : 0;
      const deficit = Math.max(0, totalCommitment - balance);
      if (acc && deficit > 0) {
        deficits.push({
          accountName: acc.name,
          owner: acc.ownerPerson || 'Joint',
          deficitPence: deficit,
          totalCommitmentPence: totalCommitment,
        });
      }
    });

    return deficits;
  }, [household.accounts, monthPlannedPayments]);

  const canEdit = userRole === 'owner' || userRole === 'editor';

  return (
    <div className="space-y-6 pb-12">
      {/* Month Period Selector Header */}
      <div className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                Active Period:
              </span>
              <select
                value={selectedMonth}
                onChange={(e) => onSelectMonth(e.target.value)}
                className="font-black text-sm bg-neutral-100 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 px-2.5 py-1 rounded-lg border border-neutral-300 dark:border-neutral-600 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <button
                onClick={onOpenMonthImport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 text-xs font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-750 transition shadow-xs"
              >
                <Layers className="w-3.5 h-3.5 text-neutral-500" />
                New Month / Copy Bills
              </button>
              <button
                onClick={onOpenPlannedPaymentModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Bill
              </button>
            </>
          )}
        </div>
      </div>

      {/* Primary Financial Banner: Available Surplus & Total Balance */}
      <div className="bg-gradient-to-br from-emerald-800 to-teal-900 dark:from-emerald-950 dark:to-teal-950 rounded-2xl p-6 text-white shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
                Available Household Surplus ({selectedMonth})
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
              {formatPence(surplusCalculation.availableSurplusPence)}
            </h1>
            <p className="text-xs text-emerald-100/80 mt-1">
              Total Liquid Funds Across Accounts: {formatPence(totalLiquidBalancePence)} • Concurrency rev #{household.version}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="dashboard-open-transfer-plan-btn"
              onClick={() => onNavigateToTab('transfer_plan')}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm border border-emerald-600/80 shadow-xs transition"
            >
              <ArrowLeftRight className="w-4 h-4 text-emerald-200" />
              Transfer Plan
            </button>
            {canEdit && (
              <button
                id="dashboard-add-tx-btn"
                onClick={onOpenAddTransaction}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-100 text-emerald-900 font-semibold text-xs sm:text-sm shadow-xs hover:bg-emerald-50 active:scale-95 transition"
              >
                <Plus className="w-4 h-4 text-emerald-700" />
                Add Transaction
              </button>
            )}
          </div>
        </div>

        {/* Financial Flow Tiles (Filtered by selectedMonth) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-emerald-700/60">
          <div className="bg-emerald-900/40 dark:bg-emerald-900/60 p-3 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs text-emerald-200 font-medium">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-300" />
              Actual Inflow
            </div>
            <div className="text-base sm:text-lg font-bold mt-1 text-white">
              {formatPence(surplusCalculation.actualIncomeReceivedPence)}
            </div>
            <div className="text-[10px] text-emerald-200/90 mt-0.5">
              {surplusCalculation.expectedIncomePence > 0
                ? `Expected: ${formatPence(surplusCalculation.expectedIncomePence)}`
                : surplusCalculation.refundsPence > 0
                ? `+${formatPence(surplusCalculation.refundsPence)} refunds`
                : 'Received this month'}
            </div>
          </div>

          <div className="bg-emerald-900/40 dark:bg-emerald-900/60 p-3 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs text-emerald-200 font-medium">
              <TrendingDown className="w-3.5 h-3.5 text-rose-300" />
              Gross Living Spend
            </div>
            <div className="text-base sm:text-lg font-bold mt-1 text-white">
              {formatPence(surplusCalculation.grossOtherSpendingPence)}
            </div>
            <div className="text-[10px] text-emerald-200/80 mt-0.5">
              excludes transfers
            </div>
          </div>

          <div className="bg-emerald-900/40 dark:bg-emerald-900/60 p-3 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs text-emerald-200 font-medium">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              Fixed Bills Remaining
            </div>
            <div className="text-base sm:text-lg font-bold mt-1 text-white">
              {formatPence(surplusCalculation.fixedBillsUnpaidPence)}
            </div>
            <div className="text-[10px] text-emerald-200/80 mt-0.5">
              {surplusCalculation.fixedBillsTotalPence > 0
                ? `${formatPence(surplusCalculation.fixedBillsTotalPence)} total`
                : 'None'}
            </div>
          </div>

          <div className="bg-emerald-900/40 dark:bg-emerald-900/60 p-3 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs text-emerald-200 font-medium">
              <PiggyBank className="w-3.5 h-3.5 text-cyan-300" />
              Saved / Transferred
            </div>
            <div className="text-base sm:text-lg font-bold mt-1 text-white">
              {formatPence(monthSummary.savingsTransfersPence)}
            </div>
            <div className="text-[10px] text-emerald-200/80 mt-0.5">
              non-spending
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Plan Alert Banner (If accounts need funding for upcoming bills) */}
      {transferPlanSnapshot.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Action Required: {transferPlanSnapshot.length} Account(s) Require Funding
              </h3>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                {transferPlanSnapshot.map((d) => `${d.accountName} needs ${formatPence(d.deficitPence)}`).join(' • ')}
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('transfer_plan')}
            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-semibold shrink-0 transition"
          >
            Review Transfer Plan
          </button>
        </div>
      )}

      {/* Grid: Spending Attribution & Authoritative Accounts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Payer Attribution Card */}
        <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {selectedMonth} Spending Attribution
            </h2>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Marius & Vesta</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-neutral-700 dark:text-neutral-300">Joint Spend</span>
                <span className="text-neutral-900 dark:text-neutral-100">{formatPence(jointSpendPence)}</span>
              </div>
              <div className="w-full bg-neutral-100 dark:bg-neutral-700 rounded-full h-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${monthSummary.grossExpensesPence > 0 ? Math.min(100, (jointSpendPence / monthSummary.grossExpensesPence) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-neutral-700 dark:text-neutral-300">Marius Individual</span>
                <span className="text-neutral-900 dark:text-neutral-100">{formatPence(mariusSpendPence)}</span>
              </div>
              <div className="w-full bg-neutral-100 dark:bg-neutral-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${monthSummary.grossExpensesPence > 0 ? Math.min(100, (mariusSpendPence / monthSummary.grossExpensesPence) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-neutral-700 dark:text-neutral-300">Vesta Individual</span>
                <span className="text-neutral-900 dark:text-neutral-100">{formatPence(vestaSpendPence)}</span>
              </div>
              <div className="w-full bg-neutral-100 dark:bg-neutral-700 rounded-full h-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${monthSummary.grossExpensesPence > 0 ? Math.min(100, (vestaSpendPence / monthSummary.grossExpensesPence) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-700 text-[11px] text-neutral-500 dark:text-neutral-400">
            Internal transfers and credit repayments are strictly excluded from living expenses.
          </div>
        </div>

        {/* Account Balances Preview */}
        <div className="md:col-span-2 bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Authoritative Accounts
            </h2>
            <button
              onClick={() => onNavigateToTab('accounts')}
              className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
            >
              View All ({household.accounts.length})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {household.accounts
              .filter((a) => a.isActive !== false)
              .slice(0, 4)
              .map((acc) => (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-850 border border-neutral-200 dark:border-neutral-750 hover:border-neutral-300 dark:hover:border-neutral-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      {acc.name}
                    </span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
                      {acc.ownerPerson || acc.type}
                    </span>
                  </div>
                  <div className="text-lg sm:text-xl font-black text-neutral-900 dark:text-neutral-100 mt-2">
                    {formatPence(acc.currentBalancePence)}
                  </div>
                  {acc.notes && (
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-1">
                      {acc.notes}
                    </p>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Planned Commitments for this Month */}
      <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {selectedMonth} Planned Bills & Commitments ({monthPlannedPayments.length})
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Recurring payments and direct debits tracked for this period
            </p>
          </div>
          <button
            onClick={() => onNavigateToTab('transfer_plan')}
            className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
          >
            Review in Transfer Plan
          </button>
        </div>

        {monthPlannedPayments.length === 0 ? (
          <div className="p-6 text-center text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-850 rounded-xl">
            No bills registered for {selectedMonth} yet. Use "New Month / Copy Bills" to roll forward recurring bills!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {monthPlannedPayments.slice(0, 6).map((payment) => (
              <div
                key={payment.id}
                className="p-3 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-200 dark:border-neutral-750 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    {payment.name}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                    Due: {payment.dueDate || 'Day 1'} • {payment.responsiblePerson}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-neutral-900 dark:text-neutral-100">
                    {formatPence(payment.amountPence)}
                  </div>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                      payment.status === 'paid'
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {payment.status === 'paid' ? 'PAID' : 'DUE'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions Preview */}
      <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            {selectedMonth} Recent Activity
          </h2>
          <button
            onClick={() => onNavigateToTab('activity')}
            className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
          >
            All Activity ({monthTransactions.length})
          </button>
        </div>

        {monthTransactions.length === 0 ? (
          <div className="p-6 text-center text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-850 rounded-xl">
            No transactions recorded in {selectedMonth} yet.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60">
            {monthTransactions.slice(0, 5).map((tx) => {
              const isNegative = tx.type === 'expense' || tx.type === 'repayment';
              return (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        tx.isTransfer
                          ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300'
                          : tx.type === 'income'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {tx.isTransfer ? (
                        <Repeat className="w-4 h-4" />
                      ) : tx.type === 'income' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {tx.description}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">{tx.payer}</span>
                        {tx.isTransfer && (
                          <span className="px-1.5 py-0.2 bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 rounded font-semibold text-[10px]">
                            Transfer
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`text-sm font-bold ${
                      isNegative
                        ? 'text-neutral-900 dark:text-neutral-100'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {isNegative ? '-' : '+'}{formatPence(tx.amountPence)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
