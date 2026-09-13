import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Layers,
  Plus,
} from 'lucide-react';
import type {
  HouseholdData,
  NavTab,
  PlannedIncome,
  UserRole,
} from '../types';
import { MonthPicker } from './MonthPicker';
import {
  calculateLiquidFundsPence,
  calculateMonthlySurplus,
  calculateSavingsPosition,
  formatPence,
  isPlannedPaymentEffectivelyPaid,
} from '../utils/currency';
import { generateTransferPlan } from '../utils/transferPlan';
import { accountIdentityLabel } from '../utils/accountDisplay';
import {
  assessDashboardIntegrity,
  classifyDashboardAccountState,
} from '../utils/dashboardState';
import {
  formatDateKeyUk,
  formatMonthKeyUk,
  localDateInputValue,
} from '../utils/dateInput';
import {
  isRolloverIncomeDuplicate,
  isRolloverPaymentDuplicate,
} from '../utils/monthRolloverIdentity';

const UNIFIED_ADD_SESSION_KEY = 'mv-unified-add-launcher';

interface DashboardProps {
  household: HouseholdData;
  userRole: UserRole;
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  onOpenMonthImport: () => void;
  onOpenAddTransaction: () => void;
  onNavigateToTab: (tab: NavTab) => void;
}

type TemporalMode = 'past' | 'current' | 'future';

type DashboardEvent = {
  id: string;
  kind: 'bill' | 'income';
  date: string;
  title: string;
  amountPence: number;
};

function nextMonthKey(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return '';
  let year = Number.parseInt(match[1], 10);
  let monthNumber = Number.parseInt(match[2], 10) + 1;
  if (monthNumber > 12) {
    monthNumber = 1;
    year += 1;
  }
  return `${year}-${String(monthNumber).padStart(2, '0')}`;
}

function prepareLabel(sourceMonth: string, targetMonth: string): string {
  const full = formatMonthKeyUk(targetMonth);
  return sourceMonth.slice(0, 4) === targetMonth.slice(0, 4)
    ? `Prepare ${full.replace(/\s+\d{4}$/, '')}`
    : `Prepare ${full}`;
}

function incomeOutstandingPence(income: PlannedIncome): number {
  return Math.max(
    0,
    income.expectedAmountPence - (income.actualAmountPence ?? 0)
  );
}

function incomeIsFulfilled(income: PlannedIncome): boolean {
  if (income.status === 'received') return true;
  return incomeOutstandingPence(income) === 0;
}

function eventSort(a: DashboardEvent, b: DashboardEvent): number {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) return byDate;
  if (a.kind !== b.kind) return a.kind === 'bill' ? -1 : 1;
  return a.id.localeCompare(b.id);
}

export const Dashboard: React.FC<DashboardProps> = ({
  household,
  userRole,
  selectedMonth,
  onSelectMonth,
  onOpenMonthImport,
  onOpenAddTransaction,
  onNavigateToTab,
}) => {
  const [todayKey, setTodayKey] = useState(() => localDateInputValue());

  useEffect(() => {
    const refreshToday = () => setTodayKey(localDateInputValue());
    refreshToday();
    const intervalId = window.setInterval(refreshToday, 60_000);
    window.addEventListener('focus', refreshToday);
    document.addEventListener('visibilitychange', refreshToday);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshToday);
      document.removeEventListener('visibilitychange', refreshToday);
    };
  }, [selectedMonth]);

  const currentMonth = todayKey.slice(0, 7);
  const temporalMode: TemporalMode =
    selectedMonth < currentMonth
      ? 'past'
      : selectedMonth > currentMonth
        ? 'future'
        : 'current';

  const visibleMonthLabel = formatMonthKeyUk(selectedMonth);
  const accountState = useMemo(
    () => classifyDashboardAccountState(household),
    [household]
  );
  const integrity = useMemo(
    () => assessDashboardIntegrity(household, selectedMonth),
    [household, selectedMonth]
  );
  const suppressFinancialCalculations =
    integrity.isCritical || accountState === 'first_setup';

  const monthPlannedPayments = useMemo(
    () =>
      (household.plannedPayments || []).filter(
        (payment) => payment.month === selectedMonth
      ),
    [household.plannedPayments, selectedMonth]
  );
  const monthPlannedIncomes = useMemo(
    () =>
      (household.plannedIncomes || []).filter(
        (income) => income.month === selectedMonth
      ),
    [household.plannedIncomes, selectedMonth]
  );

  const surplusCalculation = useMemo(
    () =>
      suppressFinancialCalculations
        ? null
        : calculateMonthlySurplus(
            household.transactions,
            household.plannedPayments || [],
            selectedMonth,
            household.plannedIncomes || []
          ),
    [
      household.transactions,
      household.plannedPayments,
      household.plannedIncomes,
      selectedMonth,
      suppressFinancialCalculations,
    ]
  );
  const savingsPosition = useMemo(
    () =>
      suppressFinancialCalculations
        ? null
        : calculateSavingsPosition(
            household.accounts,
            household.transactions,
            household.plannedPayments || [],
            selectedMonth,
            household.plannedIncomes || []
          ),
    [
      household.accounts,
      household.transactions,
      household.plannedPayments,
      household.plannedIncomes,
      selectedMonth,
      suppressFinancialCalculations,
    ]
  );

  const totalLiquidBalancePence = useMemo(
    () =>
      suppressFinancialCalculations
        ? null
        : calculateLiquidFundsPence(household.accounts),
    [household.accounts, suppressFinancialCalculations]
  );

  const paidBillCount = useMemo(
    () =>
      suppressFinancialCalculations
        ? 0
        : monthPlannedPayments.filter((payment) =>
            isPlannedPaymentEffectivelyPaid(payment, household.transactions)
          ).length,
    [
      household.transactions,
      monthPlannedPayments,
      suppressFinancialCalculations,
    ]
  );

  const transferPlanSnapshot = useMemo(() => {
    if (suppressFinancialCalculations) return [];
    const plan = generateTransferPlan(
      household.accounts,
      household.plannedPayments || [],
      selectedMonth,
      household.transactions
    );
    return plan.accountsNeedingFunding.map((requirement) => ({
      accountId: requirement.account.id,
      accountLabel: accountIdentityLabel(requirement.account),
      deficitPence: requirement.transferRequiredPence,
    }));
  }, [
    household.accounts,
    household.plannedPayments,
    household.transactions,
    selectedMonth,
    suppressFinancialCalculations,
  ]);

  const upcomingEvents = useMemo(() => {
    if (suppressFinancialCalculations || temporalMode === 'past') {
      return [] as DashboardEvent[];
    }

    const events: DashboardEvent[] = [];
    for (const payment of monthPlannedPayments) {
      if (
        payment.dueDate &&
        payment.dueDate >= todayKey &&
        !isPlannedPaymentEffectivelyPaid(payment, household.transactions)
      ) {
        events.push({
          id: payment.id,
          kind: 'bill',
          date: payment.dueDate,
          title: payment.name,
          amountPence: payment.amountPence,
        });
      }
    }

    for (const income of monthPlannedIncomes) {
      if (
        income.expectedDate &&
        income.expectedDate >= todayKey &&
        !incomeIsFulfilled(income)
      ) {
        events.push({
          id: income.id,
          kind: 'income',
          date: income.expectedDate,
          title: income.name,
          amountPence: incomeOutstandingPence(income),
        });
      }
    }

    return events.sort(eventSort).slice(0, 2);
  }, [
    household.transactions,
    monthPlannedIncomes,
    monthPlannedPayments,
    suppressFinancialCalculations,
    temporalMode,
    todayKey,
  ]);

  const attentionEvents = useMemo(() => {
    if (suppressFinancialCalculations) return [] as DashboardEvent[];
    const events: DashboardEvent[] = [];

    for (const payment of monthPlannedPayments) {
      if (
        payment.dueDate &&
        payment.dueDate < todayKey &&
        !isPlannedPaymentEffectivelyPaid(payment, household.transactions)
      ) {
        events.push({
          id: payment.id,
          kind: 'bill',
          date: payment.dueDate,
          title: payment.name,
          amountPence: payment.amountPence,
        });
      }
    }

    for (const income of monthPlannedIncomes) {
      if (
        income.expectedDate &&
        income.expectedDate < todayKey &&
        !incomeIsFulfilled(income)
      ) {
        events.push({
          id: income.id,
          kind: 'income',
          date: income.expectedDate,
          title: income.name,
          amountPence: incomeOutstandingPence(income),
        });
      }
    }

    return events.sort(eventSort);
  }, [
    household.transactions,
    monthPlannedIncomes,
    monthPlannedPayments,
    suppressFinancialCalculations,
    todayKey,
  ]);

  const targetMonth = nextMonthKey(selectedMonth);
  const canEdit = userRole === 'owner' || userRole === 'editor';
  const canPrepare = useMemo(() => {
    if (
      suppressFinancialCalculations ||
      !canEdit ||
      !targetMonth ||
      targetMonth < currentMonth
    ) {
      return false;
    }

    const targetPayments = (household.plannedPayments || []).filter(
      (payment) => payment.month === targetMonth
    );
    const targetIncomes = (household.plannedIncomes || []).filter(
      (income) => income.month === targetMonth
    );

    const hasEligiblePayment = monthPlannedPayments.some(
      (payment) =>
        payment.isRecurring === true &&
        !targetPayments.some((candidate) =>
          isRolloverPaymentDuplicate(payment, candidate, targetMonth)
        )
    );
    const hasEligibleIncome = monthPlannedIncomes.some(
      (income) =>
        !targetIncomes.some((candidate) =>
          isRolloverIncomeDuplicate(income, candidate, targetMonth)
        )
    );

    return hasEligiblePayment || hasEligibleIncome;
  }, [
    canEdit,
    currentMonth,
    household.plannedIncomes,
    household.plannedPayments,
    monthPlannedIncomes,
    monthPlannedPayments,
    suppressFinancialCalculations,
    targetMonth,
  ]);

  const openUnifiedAdd = () => {
    window.sessionStorage.setItem(UNIFIED_ADD_SESSION_KEY, '1');
    onOpenAddTransaction();
  };

  const actionControls = canEdit && !suppressFinancialCalculations ? (
    <div
      className="mv-dashboard-page-actions"
      role="group"
      aria-label="Dashboard actions"
    >
      <button
        type="button"
        onClick={openUnifiedAdd}
        className="mv-dashboard-primary-action"
      >
        <Plus aria-hidden="true" />
        <span>Add</span>
      </button>
      {canPrepare && (
        <button
          type="button"
          onClick={onOpenMonthImport}
          className="mv-dashboard-secondary-action"
          title={`Prepare ${formatMonthKeyUk(targetMonth)} from ${visibleMonthLabel}`}
          aria-label={`Prepare ${formatMonthKeyUk(targetMonth)} from ${visibleMonthLabel}`}
        >
          <Layers aria-hidden="true" />
          <span>{prepareLabel(selectedMonth, targetMonth)}</span>
        </button>
      )}
    </div>
  ) : null;

  const monthControl = (
    <div className="mv-dashboard-month-control">
      <span className="mv-dashboard-eyebrow">Selected month</span>
      <MonthPicker
        value={selectedMonth}
        onChange={onSelectMonth}
        ariaLabel="Dashboard selected month"
        className="mv-dashboard-month-picker"
      />
    </div>
  );

  if (integrity.isCritical) {
    const primaryIssue =
      integrity.issues[0]?.message ||
      'Dashboard financial data could not be verified safely.';

    return (
      <div className="mv-dashboard-workspace mv-dashboard-v431">
        <div className="mv-dashboard-command-row">
          {monthControl}
          <div className="mv-dashboard-actions-pc" />
        </div>

        <section
          className="mv-dashboard-critical-integrity"
          role="alert"
          aria-labelledby="dashboard-integrity-title"
        >
          <div className="mv-dashboard-section-heading">
            <div>
              <span className="mv-dashboard-eyebrow">Financial integrity</span>
              <h1 id="dashboard-integrity-title">Dashboard totals unavailable</h1>
            </div>
            <AlertTriangle aria-hidden="true" />
          </div>
          <p>{primaryIssue}</p>
          {integrity.issues.length > 1 && (
            <p>
              {integrity.issues.length - 1} additional integrity issue
              {integrity.issues.length === 2 ? '' : 's'} also requires review.
            </p>
          )}
          <p>
            Headline money is hidden until Penny can establish the underlying
            financial data safely.
          </p>
          <button
            type="button"
            onClick={() => onNavigateToTab('settings')}
            className="mv-dashboard-inline-action"
          >
            Review data
          </button>
        </section>
      </div>
    );
  }

  if (accountState === 'first_setup') {
    return (
      <div className="mv-dashboard-workspace mv-dashboard-v431">
        <div className="mv-dashboard-command-row">
          {monthControl}
          <div className="mv-dashboard-actions-pc" />
        </div>

        <section
          className="mv-dashboard-setup-state"
          aria-labelledby="dashboard-setup-title"
        >
          <span className="mv-dashboard-eyebrow">First setup</span>
          <h1 id="dashboard-setup-title">No accounts yet</h1>
          <p>Set up an account before recording household money.</p>
          {canEdit && (
            <button
              type="button"
              onClick={() => onNavigateToTab('accounts')}
              className="mv-dashboard-primary-action"
            >
              Open Accounts
            </button>
          )}
        </section>
      </div>
    );
  }

  const dashboardSurplus = surplusCalculation!;
  const dashboardSavings = savingsPosition!;
  const dashboardLiquidBalance = totalLiquidBalancePence!;

  const billsStatus =
    monthPlannedPayments.length === 0
      ? 'No bills'
      : temporalMode === 'future'
        ? 'Planned'
        : dashboardSurplus.fixedBillsUnpaidPence > 0
          ? 'Outstanding'
          : paidBillCount === monthPlannedPayments.length
            ? 'All paid'
            : `${monthPlannedPayments.length} bills`;

  const incomeValue =
    temporalMode === 'future'
      ? dashboardSurplus.expectedIncomePence
      : dashboardSurplus.actualIncomeReceivedPence;

  return (
    <div className="mv-dashboard-workspace mv-dashboard-v431">
      <div className="mv-dashboard-command-row">
        {monthControl}
        <div className="mv-dashboard-actions-pc">{actionControls}</div>
      </div>

      <section
        className="mv-dashboard-financial-frame"
        aria-label="Financial summary"
      >
        <div className="mv-dashboard-horizons">
          <article className="mv-dashboard-horizon mv-dashboard-selected-month">
            <span className="mv-dashboard-eyebrow">Selected month</span>
            <h1>{visibleMonthLabel}</h1>
            <div className="mv-dashboard-anchor-label">Available surplus</div>
            {temporalMode === 'future' ? (
              <>
                <div className="mv-dashboard-anchor-state">Not started</div>
                <p className="mv-dashboard-support">
                  Performance starts when activity is actually received or recorded.
                </p>
              </>
            ) : (
              <>
                <div
                  className={`mv-dashboard-anchor-value mv-dashboard-private-money mv-private-value tabular-nums ${
                    dashboardSurplus.availableSurplusPence > 0
                      ? 'finance-semantic-positive'
                      : dashboardSurplus.availableSurplusPence < 0
                        ? 'finance-semantic-negative'
                        : ''
                  }`}
                >
                  {formatPence(dashboardSurplus.availableSurplusPence)}
                </div>
                <div className="mv-dashboard-value-state">
                  {dashboardSurplus.availableSurplusPence > 0
                    ? 'Positive'
                    : dashboardSurplus.availableSurplusPence < 0
                      ? 'Negative'
                      : 'Balanced'}
                </div>
              </>
            )}

            {dashboardSurplus.refundsPence !== 0 && (
              <div className="mv-dashboard-refunds">
                <span>Refunds &amp; credits</span>
                <span className="mv-dashboard-private-money mv-private-value tabular-nums">
                  {dashboardSurplus.refundsPence > 0 ? '+' : ''}
                  {formatPence(dashboardSurplus.refundsPence)}
                </span>
              </div>
            )}

            <details className="mv-dashboard-calculation-help">
              <summary>How this is calculated</summary>
              <p>
                Received income + refunds/credits − all fixed bills for the selected
                month − other spending. Fixed bills are reserved whether paid or
                outstanding.
              </p>
            </details>
          </article>

          <article className="mv-dashboard-horizon mv-dashboard-current-position">
            <span className="mv-dashboard-eyebrow">Current</span>
            <h2>Current cash &amp; savings</h2>
            {accountState === 'liquid' ? (
              <>
                <div className="mv-dashboard-anchor-value mv-dashboard-private-money mv-private-value tabular-nums">
                  {formatPence(dashboardLiquidBalance)}
                </div>
                <div className="mv-dashboard-current-component">
                  <span className="mv-dashboard-private-money mv-private-value tabular-nums">
                    {formatPence(dashboardSavings.currentSavingsPence)}
                  </span>
                  <span>in savings &amp; cash accounts</span>
                </div>
                {dashboardLiquidBalance < 0 && (
                  <div className="mv-dashboard-current-adverse">
                    Current cash &amp; savings is below £0.00
                  </div>
                )}
                <details className="mv-dashboard-calculation-help">
                  <summary>What is included</summary>
                  <p>
                    Active current, joint, savings and cash balances. Negative
                    current or joint balances reduce the total. Credit accounts are
                    excluded.
                  </p>
                </details>
              </>
            ) : accountState === 'credit_only' ? (
              <div className="mv-dashboard-structural-state">
                <div className="mv-dashboard-anchor-value mv-dashboard-private-money mv-private-value tabular-nums">
                  {formatPence(dashboardLiquidBalance)}
                </div>
                <strong>No active cash/savings accounts</strong>
                <span>Active credit accounts are excluded from this liquid total.</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onNavigateToTab('accounts')}
                    className="mv-dashboard-inline-action"
                  >
                    Open Accounts
                  </button>
                )}
              </div>
            ) : (
              <div className="mv-dashboard-structural-state">
                <strong>No active accounts</strong>
                <span>
                  Historical selected-month information remains available, but
                  Penny has no active account for the current cash position.
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onNavigateToTab('accounts')}
                    className="mv-dashboard-inline-action"
                  >
                    Open Accounts
                  </button>
                )}
              </div>
            )}
          </article>
        </div>

        <div
          className="mv-dashboard-movement-layer"
          aria-label="Selected month movement"
        >
          <article className="mv-dashboard-movement">
            <span className="mv-dashboard-movement-label">Income</span>
            <div
              className={`mv-dashboard-movement-value mv-dashboard-private-money mv-private-value tabular-nums ${
                temporalMode === 'future' ? '' : 'finance-semantic-positive'
              }`}
            >
              {formatPence(incomeValue)}
            </div>
            <span className="mv-dashboard-movement-note">
              {temporalMode === 'future' ? 'Expected' : 'Received'}
            </span>
          </article>

          <article className="mv-dashboard-movement">
            <span className="mv-dashboard-movement-label">Spending</span>
            <div
              className={`mv-dashboard-movement-value mv-dashboard-private-money mv-private-value tabular-nums ${
                temporalMode === 'future' ? '' : 'finance-semantic-negative'
              }`}
            >
              {formatPence(dashboardSurplus.grossOtherSpendingPence)}
            </div>
            <span className="mv-dashboard-movement-note">
              {temporalMode === 'future'
                ? 'Recorded · excludes bills, transfers & repayments'
                : 'Excludes bills, transfers & repayments'}
            </span>
          </article>

          <article className="mv-dashboard-movement">
            <span className="mv-dashboard-movement-label">Bills</span>
            <div className="mv-dashboard-movement-value mv-dashboard-private-money mv-private-value tabular-nums">
              {formatPence(dashboardSurplus.fixedBillsTotalPence)}
            </div>
            <span className="mv-dashboard-movement-note">
              {billsStatus === 'Outstanding' ? (
                <>
                  <span className="mv-dashboard-private-money mv-private-value tabular-nums">
                    {formatPence(dashboardSurplus.fixedBillsUnpaidPence)}
                  </span>{' '}
                  outstanding
                </>
              ) : (
                billsStatus
              )}
            </span>
          </article>
        </div>
      </section>

      {attentionEvents.length > 0 && (
        <section
          className="mv-dashboard-conditional mv-dashboard-attention"
          aria-labelledby="dashboard-attention-title"
        >
          <div className="mv-dashboard-section-heading">
            <div>
              <span className="mv-dashboard-eyebrow">Actionable</span>
              <h2 id="dashboard-attention-title">Needs attention</h2>
            </div>
            <AlertTriangle aria-hidden="true" />
          </div>
          <div className="mv-dashboard-event-list">
            {attentionEvents.slice(0, 3).map((event) => (
              <div
                className="mv-dashboard-event"
                key={`${event.kind}-${event.id}`}
              >
                <div className="mv-dashboard-event-copy">
                  <span className="mv-dashboard-event-type">
                    {event.kind === 'bill' ? 'Overdue bill' : 'Late income'}
                  </span>
                  <strong>{event.title}</strong>
                  <span>
                    {formatDateKeyUk(event.date)} ·{' '}
                    <span className="mv-dashboard-private-money mv-private-value tabular-nums">
                      {formatPence(event.amountPence)}
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onNavigateToTab(
                      event.kind === 'bill' ? 'transfer_plan' : 'income'
                    )
                  }
                  className="mv-dashboard-row-action"
                >
                  {event.kind === 'bill' ? 'Review Plan' : 'Open Income'}
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          {attentionEvents.length > 3 && (
            <p className="mv-dashboard-more-count">
              +{attentionEvents.length - 3} more issues across Penny
            </p>
          )}
        </section>
      )}

      {transferPlanSnapshot.length > 0 && (
        <section
          className="mv-dashboard-conditional mv-dashboard-plan"
          aria-labelledby="dashboard-plan-title"
        >
          <div className="mv-dashboard-section-heading">
            <div>
              <span className="mv-dashboard-eyebrow">
                {selectedMonth === currentMonth
                  ? 'Plan funding'
                  : `Plan funding · ${visibleMonthLabel} bills · current balances`}
              </span>
              <h2 id="dashboard-plan-title">Funding to review</h2>
            </div>
          </div>
          <div className="mv-dashboard-plan-summary">
            {transferPlanSnapshot.slice(0, 3).map((item) => (
              <div className="mv-dashboard-plan-row" key={item.accountId}>
                <span>{item.accountLabel}</span>
                <span className="mv-dashboard-private-money mv-private-value tabular-nums">
                  {formatPence(item.deficitPence)}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab('transfer_plan')}
            className="mv-dashboard-inline-action"
          >
            Review Plan
          </button>
        </section>
      )}

      <div className="mv-dashboard-actions-phone">{actionControls}</div>

      {upcomingEvents.length > 0 && (
        <section
          className="mv-dashboard-conditional mv-dashboard-upcoming"
          aria-labelledby="dashboard-upcoming-title"
        >
          <div className="mv-dashboard-section-heading">
            <div>
              <span className="mv-dashboard-eyebrow">Next</span>
              <h2 id="dashboard-upcoming-title">Upcoming</h2>
            </div>
            <CalendarDays aria-hidden="true" />
          </div>
          <div className="mv-dashboard-event-list">
            {upcomingEvents.map((event) => (
              <div
                className="mv-dashboard-event"
                key={`${event.kind}-${event.id}`}
              >
                <div className="mv-dashboard-event-copy">
                  <span className="mv-dashboard-event-type">
                    {event.date === todayKey ? 'Today' : formatDateKeyUk(event.date)}
                    {' · '}
                    {event.kind === 'bill' ? 'Bill' : 'Income'}
                  </span>
                  <strong>{event.title}</strong>
                  <span className="mv-dashboard-private-money mv-private-value tabular-nums">
                    {formatPence(event.amountPence)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onNavigateToTab(
                      event.kind === 'bill' ? 'transfer_plan' : 'income'
                    )
                  }
                  className="mv-dashboard-row-action"
                >
                  {event.kind === 'bill' ? 'Review Plan' : 'Open Income'}
                  <ChevronRight aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
