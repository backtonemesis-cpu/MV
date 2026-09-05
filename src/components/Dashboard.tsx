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
import { MonthPicker } from './MonthPicker';
import {
  formatPence,
  calculateMonthlySurplus,
  calculateSavingsPosition,
  calculateTransferredFromSavingsPence,
  calculateLiquidFundsPence,
} from '../utils/currency';
import { generateTransferPlan } from '../utils/transferPlan';
import { accountIdentityLabel, accountOwnerLabel, accountTypeLabel } from '../utils/accountDisplay';

interface DashboardProps {
  household: HouseholdData;
  userRole: UserRole;
  selectedMonth: string;
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

  const totalLiquidBalancePence = useMemo(
    () => calculateLiquidFundsPence(household.accounts),
    [household.accounts]
  );

  const surplusCalculation = useMemo(() => {
    return calculateMonthlySurplus(
      household.transactions,
      household.plannedPayments || [],
      selectedMonth,
      household.plannedIncomes || []
    );
  }, [household.transactions, household.plannedPayments, household.plannedIncomes, selectedMonth]);

  const savingsPosition = useMemo(() => {
    return calculateSavingsPosition(
      household.accounts,
      household.transactions,
      household.plannedPayments || [],
      selectedMonth,
      household.plannedIncomes || []
    );
  }, [
    household.accounts,
    household.transactions,
    household.plannedPayments,
    household.plannedIncomes,
    selectedMonth,
  ]);


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

    return {
      mariusSpendPence: m,
      vestaSpendPence: v,
      jointSpendPence: j,
    };
  }, [monthTransactions]);

  const attributedSpendTotalPence = mariusSpendPence + vestaSpendPence + jointSpendPence;

  const transferPlanSnapshot = useMemo(() => {
    const plan = generateTransferPlan(
      household.accounts,
      household.plannedPayments || [],
      selectedMonth,
      household.transactions
    );

    return plan.accountsNeedingFunding.map((requirement) => ({
      accountLabel: accountIdentityLabel(requirement.account),
      deficitPence: requirement.transferRequiredPence,
      totalCommitmentPence: requirement.totalSelectedPaymentsPence,
    }));
  }, [
    household.accounts,
    household.plannedPayments,
    household.transactions,
    selectedMonth,
  ]);

  const transferredFromSavingsPence = useMemo(
    () =>
      calculateTransferredFromSavingsPence(
        household.accounts,
        household.transactions,
        selectedMonth
      ),
    [household.accounts, household.transactions, selectedMonth]
  );

  const canEdit = userRole === 'owner' || userRole === 'editor';

  const attributionRows = [
    { label: 'Joint', value: jointSpendPence },
    { label: 'Marius', value: mariusSpendPence },
    { label: 'Vesta', value: vestaSpendPence },
  ];

  const metricCards = [
    {
      label: 'Actual Inflow',
      value: surplusCalculation.actualIncomeReceivedPence,
      note:
        surplusCalculation.expectedIncomePence > 0
          ? `Expected ${formatPence(surplusCalculation.expectedIncomePence)}`
          : surplusCalculation.refundsPence > 0
          ? `+${formatPence(surplusCalculation.refundsPence)} refunds`
          : 'Received this month',
      icon: TrendingUp,
      valueClassName: 'text-success',
    },
    {
      label: 'Gross Living Spend',
      value: surplusCalculation.grossOtherSpendingPence,
      note: 'Excludes transfers',
      icon: TrendingDown,
      valueClassName: 'text-danger',
    },
    {
      label: 'Fixed Bills',
      value: surplusCalculation.fixedBillsTotalPence,
      note:
        surplusCalculation.fixedBillsTotalPence > 0
          ? surplusCalculation.fixedBillsUnpaidPence > 0
            ? `${formatPence(surplusCalculation.fixedBillsUnpaidPence)} outstanding`
            : 'All scheduled bills recorded'
          : 'No scheduled bills',
      icon: Clock,
      valueClassName: 'text-danger',
    },
    {
      label: 'Transferred From Savings',
      value: transferredFromSavingsPence,
      note: 'Moved to fund other accounts',
      icon: PiggyBank,
      valueClassName: 'text-main',
    },
  ];

  const activeAccounts = household.accounts.filter((account) => account.isActive !== false);

  return (
    <div className="mv-dashboard-workspace bg-app space-y-6 pb-16 text-main">
      {/* Active period */}
      <section className="mv-card mv-dashboard-period-card rounded-2xl border border-muted bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Calendar className="h-[18px] w-[18px]" />
            </div>

            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Active period
              </div>

              <MonthPicker
                value={selectedMonth}
                onChange={onSelectMonth}
                ariaLabel="Dashboard month"
                className="mt-1 min-w-[170px]"
              />
            </div>
          </div>

          <div className="hidden text-xs text-muted sm:block">Household overview</div>
        </div>
      </section>

      {/* Household surplus */}
      <section className="mv-dashboard-surplus-card relative overflow-hidden rounded-[24px] border border-muted bg-surface p-6 shadow-lg sm:p-8">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-accent" />

        <div className="relative">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Available Household Surplus
          </div>

          <div
            className={`mt-3 font-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl ${
              surplusCalculation.availableSurplusPence > 0
                ? 'text-success'
                : surplusCalculation.availableSurplusPence < 0
                  ? 'text-danger'
                  : 'text-main'
            }`}
          >
            {formatPence(surplusCalculation.availableSurplusPence)}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="mv-private-value">Liquid funds {formatPence(totalLiquidBalancePence)}</span>
            <span className="h-1 w-1 rounded-full bg-accent" />
            <span>{selectedMonth}</span>
          </div>
        </div>
      </section>

      {/* Primary actions */}
      <section className="mv-dashboard-actions grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          id="dashboard-open-transfer-plan-btn"
          onClick={() => onNavigateToTab('transfer_plan')}
          className="group flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border border-muted bg-surface px-4 text-sm font-semibold text-main shadow-sm transition-all hover:bg-surface-muted active:scale-[0.98]"
        >
          <ArrowLeftRight className="h-4 w-4 text-accent transition-transform group-hover:scale-110" />
          Transfer Plan
        </button>

        {canEdit && (
          <>
            <button
              id="dashboard-add-tx-btn"
              onClick={onOpenAddTransaction}
              className="group flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border border-muted bg-surface px-4 text-sm font-semibold text-main shadow-sm transition-all hover:bg-surface-muted active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 text-accent transition-transform group-hover:scale-110" />
              Add Transaction
            </button>

            <button
              onClick={onOpenPlannedPaymentModal}
              className="group flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border border-muted bg-surface px-4 text-sm font-semibold text-main shadow-sm transition-all hover:bg-surface-muted active:scale-[0.98]"
            >
              <Plus className="h-4 w-4 text-accent transition-transform group-hover:scale-110" />
              Add Bill
            </button>

            <button
              onClick={onOpenMonthImport}
              className="group flex min-h-[58px] items-center justify-center gap-2 rounded-2xl border border-muted bg-surface px-4 text-sm font-semibold text-main shadow-sm transition-all hover:bg-surface-muted active:scale-[0.98]"
            >
              <Layers className="h-4 w-4 text-accent transition-transform group-hover:scale-110" />
              Prepare Next Month
            </button>
          </>
        )}
      </section>

      {/* Financial metrics */}
      <section className="mv-dashboard-metrics grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon;

          return (
            <article
              key={metric.label}
              className="mv-card mv-dashboard-metric-card relative min-w-0 overflow-hidden rounded-xl border border-muted bg-surface p-3 shadow-sm"
            >
              <div className="absolute inset-x-0 top-0 h-[2px] bg-accent" />

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {metric.label}
                </div>

                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>

              <div
                className={`mv-dashboard-metric-value mt-3 truncate font-mono text-lg font-semibold tracking-tight tabular-nums sm:text-xl ${metric.valueClassName}`}
              >
                {formatPence(metric.value)}
              </div>

              <div className="mv-private-value mv-dashboard-metric-note mt-1 truncate text-[10px] text-subtle">{metric.note}</div>
            </article>
          );
        })}
      </section>

      {/* Funding warning */}
      {transferPlanSnapshot.length > 0 && (
        <section className="rounded-2xl border border-strong bg-accent-soft p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-accent">
                <AlertCircle className="h-4 w-4" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-main">Funding required</h3>
                <p className="mv-private-value mt-1 text-xs leading-5 text-muted">
                  {transferPlanSnapshot
                    .map((item) => `${item.accountLabel} needs ${formatPence(item.deficitPence)}`)
                    .join(' • ')}
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateToTab('transfer_plan')}
              className="shrink-0 rounded-xl border border-muted bg-surface px-3 py-2 text-xs font-semibold text-main transition-all hover:bg-surface-muted active:scale-[0.98]"
            >
              Review Plan
            </button>
          </div>
        </section>
      )}

      {/* Spending attribution + Accounts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <section className="overflow-hidden rounded-2xl border border-muted bg-table shadow-sm lg:col-span-2">
          <header className="flex items-center justify-between gap-3 border-b border-muted bg-table-header px-5 py-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Spending Attribution
              </span>
              <h2 className="text-base font-semibold text-main">{selectedMonth}</h2>
            </div>

            <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-medium text-muted">
              Household
            </span>
          </header>

          <div className="divide-y divide-muted bg-table px-3">
            {attributionRows.map((row) => {
              const percent =
                attributedSpendTotalPence > 0
                  ? Math.round((row.value / attributedSpendTotalPence) * 100)
                  : 0;

              return (
                <div key={row.label} className="px-2 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-main">{row.label}</span>

                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold tracking-tight text-main tabular-nums">
                        {formatPence(row.value)}
                      </div>
                      <div className="mt-0.5 text-[10px] font-medium text-muted">{percent}%</div>
                    </div>
                  </div>

                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-muted bg-table shadow-sm lg:col-span-3">
          <header className="flex items-center justify-between gap-3 border-b border-muted bg-table-header px-5 py-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                Accounts
              </span>
              <h2 className="text-base font-semibold text-main">Authoritative Accounts</h2>
            </div>

            <button
              onClick={() => onNavigateToTab('accounts')}
              className="text-xs font-semibold text-accent transition-all hover:opacity-80 active:scale-[0.98]"
            >
              View All
            </button>
          </header>

          {activeAccounts.length === 0 ? (
            <div className="flex min-h-[176px] flex-col items-center justify-center bg-table p-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Landmark className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm text-muted">No active accounts</p>
            </div>
          ) : (
            <div className="divide-y divide-muted bg-table px-5">
              {activeAccounts.slice(0, 5).map((account) => (
                <div key={account.id} className="flex items-center gap-3 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                    <AccountIcon account={account} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-main">{account.name}</div>
                    <div className="mt-0.5 text-[11px] capitalize text-subtle">
                      {accountTypeLabel(account.type)} · {accountOwnerLabel(account)}
                    </div>
                  </div>

                  <div className="shrink-0 font-mono text-sm font-semibold tracking-tight text-main tabular-nums">
                    {formatPence(account.currentBalancePence)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Bills */}
      <section className="overflow-hidden rounded-2xl border border-muted bg-table shadow-sm">
        <header className="flex items-center justify-between gap-3 border-b border-muted bg-table-header px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Bills
            </span>
            <h2 className="text-base font-semibold text-main">
              {selectedMonth} • {monthPlannedPayments.length} bill
              {monthPlannedPayments.length === 1 ? '' : 's'}
            </h2>
          </div>

          <button
            onClick={() => onNavigateToTab('transfer_plan')}
            className="text-xs font-semibold text-accent transition-all hover:opacity-80 active:scale-[0.98]"
          >
            View Plan
          </button>
        </header>

        {monthPlannedPayments.length === 0 ? (
          <div className="bg-table p-5">
            <div className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border border-dashed border-muted bg-surface-muted p-8 text-center">
              <p className="text-sm text-muted">No bills for {selectedMonth}</p>

              {canEdit && (
                <button
                  onClick={onOpenPlannedPaymentModal}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-muted bg-surface px-3 py-2 text-xs font-semibold text-main transition-all hover:bg-surface-muted active:scale-[0.98]"
                >
                  <Plus className="h-3.5 w-3.5 text-accent" />
                  Add Bill
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-muted bg-table px-5">
            {monthPlannedPayments.slice(0, 6).map((payment) => (
              <div key={payment.id} className="flex min-w-0 items-center justify-between gap-4 py-3.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-main">{payment.name}</div>
                  <div className="mt-1 text-[11px] text-subtle">
                    {payment.dueDate || 'Flexible'} · {payment.responsiblePerson}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-semibold tracking-tight text-main tabular-nums">
                    {formatPence(payment.amountPence)}
                  </div>

                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
                      payment.status === 'paid'
                        ? 'bg-accent-soft text-accent'
                        : 'bg-surface-muted text-muted'
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

      {/* Recent activity */}
      <section className="overflow-hidden rounded-2xl border border-muted bg-table shadow-sm">
        <header className="flex items-center justify-between gap-3 border-b border-muted bg-table-header px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
              Activity
            </span>
            <h2 className="text-base font-semibold text-main">
              {selectedMonth} • {monthTransactions.length} transaction
              {monthTransactions.length === 1 ? '' : 's'}
            </h2>
          </div>

          <button
            onClick={() => onNavigateToTab('activity')}
            className="text-xs font-semibold text-accent transition-all hover:opacity-80 active:scale-[0.98]"
          >
            View All
          </button>
        </header>

        {monthTransactions.length === 0 ? (
          <div className="bg-table p-5">
            <div className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border border-dashed border-muted bg-surface-muted p-8 text-center">
              <p className="text-sm text-muted">No transactions for {selectedMonth}</p>

              {canEdit && (
                <button
                  onClick={onOpenAddTransaction}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-muted bg-surface px-3 py-2 text-xs font-semibold text-main transition-all hover:bg-surface-muted active:scale-[0.98]"
                >
                  <Plus className="h-3.5 w-3.5 text-accent" />
                  Log Transaction
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-muted bg-table px-5">
            {monthTransactions.slice(0, 5).map((tx) => {
              const isNegative = tx.type === 'expense' || tx.type === 'repayment';

              return (
                <div key={tx.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        tx.isTransfer || tx.type === 'income'
                          ? 'bg-accent-soft text-accent'
                          : 'bg-surface-muted text-muted'
                      }`}
                    >
                      {tx.isTransfer ? (
                        <Repeat className="h-4 w-4" />
                      ) : tx.type === 'income' ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-main">{tx.description}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-subtle">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span>{tx.payer}</span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`shrink-0 font-mono text-sm font-semibold tracking-tight tabular-nums ${
                      isNegative ? 'finance-semantic-negative' : 'finance-semantic-positive'
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
