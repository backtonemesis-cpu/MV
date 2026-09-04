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
    <div className="space-y-5 pb-12">
      {/* Active Period + Primary Month Actions */}
      <section className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3.5 sm:p-4 shadow-[0_4px_12px_-8px_rgba(15,23,42,0.18)]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <Calendar className="w-[18px] h-[18px]" />
            </div>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-slate-600 dark:text-neutral-300 whitespace-nowrap">
                Active Period
              </span>
              <select
                value={selectedMonth}
                onChange={(e) => onSelectMonth(e.target.value)}
                className="h-10 min-w-[118px] px-3 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-sm font-semibold text-slate-950 dark:text-white focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:outline-none"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {canEdit && (
            <div className="grid grid-cols-2 gap-2 w-full lg:w-auto">
              <button
                onClick={onOpenMonthImport}
                className="h-10 inline-flex items-center justify-center gap-2 px-3.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-700 dark:text-neutral-200 text-[13px] font-semibold whitespace-nowrap hover:bg-slate-50 dark:hover:bg-neutral-800 transition"
              >
                <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-neutral-400" />
                New Month / Copy Bills
              </button>
              <button
                onClick={onOpenPlannedPaymentModal}
                className="h-10 inline-flex items-center justify-center gap-2 px-3.5 rounded-xl border border-emerald-700 bg-emerald-700 text-white text-[13px] font-semibold whitespace-nowrap hover:bg-emerald-800 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Bill
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Available Household Surplus Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-emerald-800 to-teal-900 dark:from-emerald-950 dark:to-teal-950 p-6 sm:p-7 text-white shadow-[0_10px_26px_-16px_rgba(6,78,59,0.65)]">
        <div>
          <div className="text-xs sm:text-sm font-semibold tracking-wide text-emerald-100/90">
            Available Household Surplus ({selectedMonth})
          </div>
          <h1 className="mt-2 text-4xl sm:text-5xl font-black tracking-[-0.03em] leading-none">
            {formatPence(surplusCalculation.availableSurplusPence)}
          </h1>
          <p className="mt-3 text-[13px] leading-5 text-emerald-100/80">
            Liquid funds: {formatPence(totalLiquidBalancePence)}
          </p>
        </div>
      </section>

      {/* Primary Home Actions */}
      <div className={`grid gap-3 ${canEdit ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <button
          id="dashboard-open-transfer-plan-btn"
          onClick={() => onNavigateToTab('transfer_plan')}
          className="min-h-[52px] inline-flex items-center justify-center gap-2 px-3.5 py-3.5 rounded-xl bg-white dark:bg-neutral-900 text-slate-900 dark:text-white font-semibold text-sm border border-[#e2e8f0] dark:border-neutral-700 shadow-[0_2px_6px_-3px_rgba(15,23,42,0.18)] hover:bg-slate-50 dark:hover:bg-neutral-800 transition"
        >
          <ArrowLeftRight className="w-4 h-4 text-slate-600 dark:text-neutral-300" />
          Transfer Plan
        </button>
        {canEdit && (
          <button
            id="dashboard-add-tx-btn"
            onClick={onOpenAddTransaction}
            className="min-h-[52px] inline-flex items-center justify-center gap-2 px-3.5 py-3.5 rounded-xl bg-white dark:bg-neutral-900 text-slate-900 dark:text-white font-semibold text-sm border border-[#e2e8f0] dark:border-neutral-700 shadow-[0_2px_6px_-3px_rgba(15,23,42,0.18)] hover:bg-slate-50 dark:hover:bg-neutral-800 transition"
          >
            <Plus className="w-4 h-4 text-slate-600 dark:text-neutral-300" />
            Add Transaction
          </button>
        )}
      </div>

      {/* Financial Flow Sub-Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <article className="relative min-w-0 overflow-hidden rounded-2xl bg-emerald-900 dark:bg-emerald-950 p-4 text-white shadow-[0_4px_10px_-7px_rgba(6,78,59,0.6)]">
          <div className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-emerald-200" />
          </div>
          <div className="pr-10 text-[13px] font-medium leading-5 text-emerald-100 whitespace-nowrap overflow-hidden text-ellipsis">
            Actual Inflow
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight whitespace-nowrap">
            {formatPence(surplusCalculation.actualIncomeReceivedPence)}
          </div>
          <div className="mt-1 text-[11px] leading-4 text-emerald-100/70 min-h-4">
            {surplusCalculation.expectedIncomePence > 0
              ? `Expected: ${formatPence(surplusCalculation.expectedIncomePence)}`
              : surplusCalculation.refundsPence > 0
              ? `+${formatPence(surplusCalculation.refundsPence)} refunds`
              : 'Received this month'}
          </div>
        </article>

        <article className="relative min-w-0 overflow-hidden rounded-2xl bg-emerald-900 dark:bg-emerald-950 p-4 text-white shadow-[0_4px_10px_-7px_rgba(6,78,59,0.6)]">
          <div className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-rose-300/15 flex items-center justify-center">
            <TrendingDown className="w-4 h-4 text-rose-200" />
          </div>
          <div className="pr-10 text-[13px] font-medium leading-5 text-emerald-100 whitespace-nowrap overflow-hidden text-ellipsis">
            Gross Living Spend
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight whitespace-nowrap">
            {formatPence(surplusCalculation.grossOtherSpendingPence)}
          </div>
          <div className="mt-1 text-[11px] leading-4 text-emerald-100/70">
            Excludes transfers
          </div>
        </article>

        <article className="relative min-w-0 overflow-hidden rounded-2xl bg-emerald-900 dark:bg-emerald-950 p-4 text-white shadow-[0_4px_10px_-7px_rgba(6,78,59,0.6)]">
          <div className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-amber-300/15 flex items-center justify-center">
            <Clock className="w-4 h-4 text-amber-200" />
          </div>
          <div className="pr-10 text-[13px] font-medium leading-5 text-emerald-100 whitespace-nowrap overflow-hidden text-ellipsis">
            Fixed Bills
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight whitespace-nowrap">
            {formatPence(surplusCalculation.fixedBillsUnpaidPence)}
          </div>
          <div className="mt-1 text-[11px] leading-4 text-emerald-100/70 min-h-4">
            {surplusCalculation.fixedBillsTotalPence > 0
              ? `${formatPence(surplusCalculation.fixedBillsTotalPence)} total`
              : 'None remaining'}
          </div>
        </article>

        <article className="relative min-w-0 overflow-hidden rounded-2xl bg-emerald-900 dark:bg-emerald-950 p-4 text-white shadow-[0_4px_10px_-7px_rgba(6,78,59,0.6)]">
          <div className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-cyan-300/15 flex items-center justify-center">
            <PiggyBank className="w-4 h-4 text-cyan-200" />
          </div>
          <div className="pr-10 text-[13px] font-medium leading-5 text-emerald-100 whitespace-nowrap overflow-hidden text-ellipsis">
            Saved
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold tracking-tight whitespace-nowrap">
            {formatPence(monthSummary.savingsTransfersPence)}
          </div>
          <div className="mt-1 text-[11px] leading-4 text-emerald-100/70">
            Non-spending transfer
          </div>
        </article>
      </section>

      {/* Transfer Plan Alert Banner (If accounts need funding for upcoming bills) */}
      {transferPlanSnapshot.length > 0 && (
        <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/70 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Funding required
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Payer Attribution Card */}
        <section className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-[0_4px_12px_-8px_rgba(15,23,42,0.18)]">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h2 className="text-sm font-bold text-slate-950 dark:text-white">
                {selectedMonth} Spending Attribution
              </h2>
              <p className="hidden"></p>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 text-xs font-medium text-blue-800 dark:text-blue-200">
              Marius & Vesta
            </span>
          </div>

          <div className="mt-2">
            <div className="flex items-center justify-between gap-4 py-3.5">
              <span className="text-sm font-medium text-slate-600 dark:text-neutral-300">
                Joint Spend
              </span>
              <span className="text-sm font-bold text-slate-950 dark:text-white whitespace-nowrap">
                {formatPence(jointSpendPence)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 py-3.5">
              <span className="text-sm font-medium text-slate-600 dark:text-neutral-300">
                Marius Individual
              </span>
              <span className="text-sm font-bold text-slate-950 dark:text-white whitespace-nowrap">
                {formatPence(mariusSpendPence)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-4 py-3.5">
              <span className="text-sm font-medium text-slate-600 dark:text-neutral-300">
                Vesta Individual
              </span>
              <span className="text-sm font-bold text-slate-950 dark:text-white whitespace-nowrap">
                {formatPence(vestaSpendPence)}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-[#f8fafc] dark:bg-neutral-800/70 px-4 py-3 text-[13px] leading-5 text-[#64748b] dark:text-neutral-400">
            Internal transfers and credit repayments are strictly excluded from living expenses.
          </div>
        </section>

        {/* Account Balances Preview */}
        <div className="md:col-span-2 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-[0_4px_12px_-8px_rgba(15,23,42,0.18)]">
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
                  className="p-3.5 rounded-xl bg-[#f8fafc] dark:bg-neutral-800/70 border border-slate-100 dark:border-neutral-800 hover:border-slate-200 dark:hover:border-neutral-700 transition"
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
      <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-[0_4px_12px_-8px_rgba(15,23,42,0.18)]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              {selectedMonth} Planned Bills & Commitments ({monthPlannedPayments.length})
            </h2>
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
            No bills for {selectedMonth}.
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
      <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-[0_4px_12px_-8px_rgba(15,23,42,0.18)]">
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
            No transactions for {selectedMonth}.
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
