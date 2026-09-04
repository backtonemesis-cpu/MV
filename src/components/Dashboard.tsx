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
  Landmark,
  CreditCard,
  Banknote,
} from 'lucide-react';
import { HouseholdData, UserRole, NavTab, Account } from '../types';
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

function AccountIcon({ account }: { account: Account }) {
  if (account.type === 'savings') return <PiggyBank className="h-4 w-4" />;
  if (account.type === 'credit') return <CreditCard className="h-4 w-4" />;
  if (account.type === 'cash') return <Banknote className="h-4 w-4" />;
  return <Landmark className="h-4 w-4" />;
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
  const monthTransactions = useMemo(() => {
    return household.transactions.filter((tx) => tx.date.startsWith(selectedMonth));
  }, [household.transactions, selectedMonth]);

  const monthPlannedPayments = useMemo(() => {
    return (household.plannedPayments || []).filter((p) => p.month === selectedMonth);
  }, [household.plannedPayments, selectedMonth]);

  const monthSummary = useMemo(() => {
    return calculateFinancialSummary(monthTransactions);
  }, [monthTransactions]);

  const totalLiquidBalancePence = useMemo(() => {
    return household.accounts
      .filter((a) => a.isActive !== false)
      .reduce((acc, a) => acc + a.currentBalancePence, 0);
  }, [household.accounts]);

  const surplusCalculation = useMemo(() => {
    return calculateMonthlySurplus(
      household.transactions,
      household.plannedPayments || [],
      selectedMonth,
      household.plannedIncomes || []
    );
  }, [household.transactions, household.plannedPayments, household.plannedIncomes, selectedMonth]);

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

  const attributedSpendTotalPence = mariusSpendPence + vestaSpendPence + jointSpendPence;

  const transferPlanSnapshot = useMemo(() => {
    const accountMap = new Map(household.accounts.map((a) => [a.id, a]));
    const deficits: {
      accountName: string;
      owner: string;
      deficitPence: number;
      totalCommitmentPence: number;
    }[] = [];

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

  const attributionRows = [
    { label: 'Joint', value: jointSpendPence },
    { label: 'Marius', value: mariusSpendPence },
    { label: 'Vesta', value: vestaSpendPence },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Period control */}
      <section className="rounded-2xl border border-slate-800/60 bg-[#0D121F] p-4 shadow-[0_16px_45px_-32px_rgba(2,6,23,0.85)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)] ring-1 ring-white/5">
              <Calendar className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Active period
              </div>
              <select
                value={selectedMonth}
                onChange={(e) => onSelectMonth(e.target.value)}
                className="mt-1 h-9 min-w-[150px] rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-light)]"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="hidden text-xs text-slate-500 sm:block">
            Household overview
          </div>
        </div>
      </section>

      {/* Surplus hero */}
      <section className="relative overflow-hidden rounded-[24px] border border-slate-800/70 bg-gradient-to-br from-zinc-900 via-slate-950 to-[#070B13] p-6 shadow-[0_28px_80px_-38px_rgba(2,6,23,0.95)] sm:p-8">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--primary)]" />
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[var(--primary)] opacity-[0.14] blur-3xl"
          aria-hidden="true"
        />

        <div className="relative z-10">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            Available Household Surplus
          </div>

          <div className="mt-3 font-mono text-4xl font-semibold tracking-[-0.04em] text-white tabular-nums sm:text-5xl">
            {formatPence(surplusCalculation.availableSurplusPence)}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>Liquid funds {formatPence(totalLiquidBalancePence)}</span>
            <span className="h-1 w-1 rounded-full bg-[var(--primary)]" />
            <span>{selectedMonth}</span>
          </div>
        </div>
      </section>

      {/* Primary actions */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          id="dashboard-open-transfer-plan-btn"
          onClick={() => onNavigateToTab('transfer_plan')}
          className="group flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border border-slate-800/70 bg-[#0D121F] px-4 text-sm font-semibold text-slate-100 shadow-[0_12px_30px_-24px_rgba(2,6,23,0.9)] transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:scale-[0.98]"
        >
          <ArrowLeftRight className="h-4 w-4 text-[var(--primary)] transition-transform group-hover:scale-110" />
          Transfer Plan
        </button>

        {canEdit && (
          <>
            <button
              id="dashboard-add-tx-btn"
              onClick={onOpenAddTransaction}
              className="group flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border border-slate-800/70 bg-[#0D121F] px-4 text-sm font-semibold text-slate-100 shadow-[0_12px_30px_-24px_rgba(2,6,23,0.9)] transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 text-[var(--primary)] transition-transform group-hover:scale-110" />
              Add Transaction
            </button>

            <button
              onClick={onOpenPlannedPaymentModal}
              className="group flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border border-slate-800/70 bg-[#0D121F] px-4 text-sm font-semibold text-slate-100 shadow-[0_12px_30px_-24px_rgba(2,6,23,0.9)] transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 text-[var(--primary)] transition-transform group-hover:scale-110" />
              Add Bill
            </button>

            <button
              onClick={onOpenMonthImport}
              className="group flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border border-slate-800/70 bg-[#0D121F] px-4 text-sm font-semibold text-slate-100 shadow-[0_12px_30px_-24px_rgba(2,6,23,0.9)] transition-all hover:-translate-y-0.5 hover:bg-slate-800 active:scale-[0.98]"
            >
              <Layers className="h-4 w-4 text-[var(--primary)] transition-transform group-hover:scale-110" />
              Copy Bills
            </button>
          </>
        )}
      </section>

      {/* Metric cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Actual Inflow',
            value: surplusCalculation.actualIncomeReceivedPence,
            note:
              surplusCalculation.expectedIncomePence > 0
                ? `Expected ${formatPence(surplusCalculation.expectedIncomePence)}`
                : surplusCalculation.refundsPence > 0
                ? `+${formatPence(surplusCalculation.refundsPence)} refunds`
                : 'Received',
            icon: TrendingUp,
          },
          {
            label: 'Gross Living Spend',
            value: surplusCalculation.grossOtherSpendingPence,
            note: 'Excludes transfers',
            icon: TrendingDown,
          },
          {
            label: 'Fixed Bills',
            value: surplusCalculation.fixedBillsUnpaidPence,
            note:
              surplusCalculation.fixedBillsTotalPence > 0
                ? `${formatPence(surplusCalculation.fixedBillsTotalPence)} total`
                : 'None remaining',
            icon: Clock,
          },
          {
            label: 'Saved',
            value: monthSummary.savingsTransfersPence,
            note: 'Non-spending transfer',
            icon: PiggyBank,
          },
        ].map((metric) => {
          const Icon = metric.icon;

          return (
            <article
              key={metric.label}
              className="relative min-w-0 overflow-hidden rounded-2xl border border-slate-800/60 bg-[#0D121F] p-4 shadow-[0_16px_40px_-30px_rgba(2,6,23,0.95)]"
            >
              <div className="absolute inset-x-0 top-0 h-[2px] bg-[var(--primary)] opacity-75" />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {metric.label}
                </div>

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)] ring-1 ring-white/5">
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-5 truncate font-mono text-xl font-semibold tracking-tight text-slate-50 tabular-nums sm:text-2xl">
                {formatPence(metric.value)}
              </div>

              <div className="mt-1.5 truncate text-[11px] text-slate-500">
                {metric.note}
              </div>
            </article>
          );
        })}
      </section>

      {/* Funding warning */}
      {transferPlanSnapshot.length > 0 && (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-300">
                <AlertCircle className="h-4 w-4" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-100">Funding required</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {transferPlanSnapshot
                    .map((d) => `${d.accountName} needs ${formatPence(d.deficitPence)}`)
                    .join(' • ')}
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateToTab('transfer_plan')}
              className="shrink-0 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200 transition-all hover:bg-amber-400/15 active:scale-[0.98]"
            >
              Review Plan
            </button>
          </div>
        </section>
      )}

      {/* Attribution + Accounts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        {/* Spending attribution */}
        <section className="rounded-2xl border border-slate-800/60 bg-[#0D121F] p-5 shadow-[0_18px_45px_-34px_rgba(2,6,23,0.95)] lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Spending attribution
              </div>
              <h2 className="mt-1 text-base font-semibold text-slate-100">{selectedMonth}</h2>
            </div>

            <span className="rounded-full border border-slate-800 bg-slate-900/70 px-2.5 py-1 text-[11px] font-medium text-slate-400">
              Household
            </span>
          </div>

          <div className="mt-4 divide-y divide-slate-800/40">
            {attributionRows.map((row) => {
              const percent =
                attributedSpendTotalPence > 0
                  ? Math.round((row.value / attributedSpendTotalPence) * 100)
                  : 0;

              return (
                <div key={row.label} className="py-4 first:pt-2 last:pb-0">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-slate-300">{row.label}</span>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-slate-100 tabular-nums">
                        {formatPence(row.value)}
                      </div>
                      <div className="mt-0.5 text-[10px] font-medium text-slate-500">{percent}%</div>
                    </div>
                  </div>

                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-800/70">
                    <div
                      className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Accounts */}
        <section className="rounded-2xl border border-slate-800/60 bg-[#0D121F] p-5 shadow-[0_18px_45px_-34px_rgba(2,6,23,0.95)] lg:col-span-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Accounts
              </div>
              <h2 className="mt-1 text-base font-semibold text-slate-100">
                Authoritative Accounts
              </h2>
            </div>

            <button
              onClick={() => onNavigateToTab('accounts')}
              className="text-xs font-semibold text-[var(--primary)] transition-opacity hover:opacity-80"
            >
              View All
            </button>
          </div>

          {household.accounts.filter((a) => a.isActive !== false).length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-800/80 bg-slate-900/20 p-8 text-center">
              <Landmark className="mx-auto h-5 w-5 text-slate-600" />
              <p className="mt-2 text-sm text-slate-500">No active accounts</p>
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-800/40">
              {household.accounts
                .filter((a) => a.isActive !== false)
                .slice(0, 5)
                .map((acc) => (
                  <div key={acc.id} className="flex items-center gap-3 py-3.5 first:pt-1 last:pb-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)] ring-1 ring-white/5">
                      <AccountIcon account={acc} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-200">{acc.name}</div>
                      <div className="mt-0.5 text-[11px] capitalize text-slate-500">
                        {acc.ownerPerson || 'Joint'} · {acc.type}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="font-mono text-sm font-semibold tracking-tight text-slate-100 tabular-nums">
                        {formatPence(acc.currentBalancePence)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>

      {/* Bills */}
      <section className="rounded-2xl border border-slate-800/60 bg-[#0D121F] p-5 shadow-[0_18px_45px_-34px_rgba(2,6,23,0.95)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Bills
            </div>
            <h2 className="mt-1 text-base font-semibold text-slate-100">
              {selectedMonth} · {monthPlannedPayments.length}
            </h2>
          </div>

          <button
            onClick={() => onNavigateToTab('transfer_plan')}
            className="text-xs font-semibold text-[var(--primary)] transition-opacity hover:opacity-80"
          >
            View Plan
          </button>
        </div>

        {monthPlannedPayments.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-800/80 bg-slate-900/20 p-8 text-center">
            <p className="text-sm text-slate-500">No bills for {selectedMonth}</p>

            {canEdit && (
              <button
                onClick={onOpenPlannedPaymentModal}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-transparent px-3 py-2 text-xs font-semibold text-slate-300 transition-all hover:border-[var(--primary)] hover:text-[var(--primary)] active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Bill
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {monthPlannedPayments.slice(0, 6).map((payment) => (
              <div
                key={payment.id}
                className="flex min-w-0 items-center justify-between gap-4 rounded-xl border border-slate-800/50 bg-slate-950/35 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-200">{payment.name}</div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {payment.dueDate || 'Flexible'} · {payment.responsiblePerson}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-semibold text-slate-100 tabular-nums">
                    {formatPence(payment.amountPence)}
                  </div>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                      payment.status === 'paid'
                        ? 'bg-emerald-400/10 text-emerald-300'
                        : 'bg-amber-400/10 text-amber-300'
                    }`}
                  >
                    {payment.status === 'paid' ? 'Paid' : 'Due'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Activity */}
      <section className="rounded-2xl border border-slate-800/60 bg-[#0D121F] p-5 shadow-[0_18px_45px_-34px_rgba(2,6,23,0.95)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Activity
            </div>
            <h2 className="mt-1 text-base font-semibold text-slate-100">Recent Activity</h2>
          </div>

          <button
            onClick={() => onNavigateToTab('activity')}
            className="text-xs font-semibold text-[var(--primary)] transition-opacity hover:opacity-80"
          >
            View All
          </button>
        </div>

        {monthTransactions.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-800/80 bg-slate-900/20 p-8 text-center">
            <p className="text-sm text-slate-500">No transactions for {selectedMonth}</p>

            {canEdit && (
              <button
                onClick={onOpenAddTransaction}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-transparent px-3 py-2 text-xs font-semibold text-slate-300 transition-all hover:border-[var(--primary)] hover:text-[var(--primary)] active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" />
                Log Transaction
              </button>
            )}
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-800/40">
            {monthTransactions.slice(0, 5).map((tx) => {
              const isNegative = tx.type === 'expense' || tx.type === 'repayment';

              return (
                <div key={tx.id} className="flex items-center justify-between gap-4 py-3.5 first:pt-1 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-slate-400 ring-1 ring-slate-800/70">
                      {tx.isTransfer ? (
                        <Repeat className="h-4 w-4" />
                      ) : tx.type === 'income' ? (
                        <ArrowDownLeft className="h-4 w-4 text-emerald-300" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-200">{tx.description}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{tx.date}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-700" />
                        <span>{tx.payer}</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`shrink-0 font-mono text-sm font-semibold tabular-nums ${
                      isNegative ? 'text-slate-100' : 'text-emerald-300'
                    }`}
                  >
                    {isNegative ? '-' : '+'}
                    {formatPence(tx.amountPence)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
