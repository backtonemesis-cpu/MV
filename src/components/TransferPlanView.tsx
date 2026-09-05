import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Layers,
  RotateCcw,
  Square,
} from 'lucide-react';
import type {
  Account,
  Category,
  HouseholdMember,
  PlannedPayment,
  Transaction,
  UserRole,
} from '../types';
import { formatPence } from '../utils/currency';
import { formatMonthLabel, generateTransferPlan } from '../utils/transferPlan';
import {
  accountIdentityLabel,
} from '../utils/accountDisplay';
import {
  buildTransferPlanAccountModels,
  groupTransferPlanAccountModels,
  type TransferPlanAccountModel,
  type TransferPlanLifecycle,
} from '../utils/transferPlanViewModel';
import { ExecuteTransferModal } from './ExecuteTransferModal';
import { MarkPaymentPaidModal } from './MarkPaymentPaidModal';
import { MonthPicker } from './MonthPicker';

interface TransferPlanViewProps {
  accounts: Account[];
  categories: Category[];
  plannedPayments: PlannedPayment[];
  transactions: Transaction[];
  members: HouseholdMember[];
  userRole: UserRole;
  selectedMonth?: string;
  onSelectMonth?: (month: string) => void;
  onOpenMonthImport?: () => void;
  onUpdatePlannedPayment: (
    id: string,
    data: Partial<PlannedPayment>
  ) => Promise<void>;
  onMarkPaymentPaid: (
    id: string,
    payload: {
      actualAmountPence: number;
      actualDate: string;
      accountId: string;
    }
  ) => Promise<void>;
  onUndoPaymentPaid: (id: string) => Promise<void>;
  onBulkTogglePlannedPayments: (params: {
    month?: string;
    include: boolean;
    onlyUnpaid?: boolean;
    status?: 'paid' | 'unpaid';
    paymentIds?: string[];
  }) => Promise<void>;
  onExecuteTransfer: (payload: {
    destinationAccountId: string;
    expectedTotalPence: number;
    allocations: Array<{
      sourceAccountId: string;
      amountPence: number;
    }>;
    description: string;
    date: string;
    month: string;
  }) => Promise<void>;
  onUndoFunding: (destinationAccountId: string, month: string) => Promise<void>;
}

function formatDueDate(value?: string): string {
  if (!value) return 'No due date';
  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}

function lifecycleMeta(lifecycle: TransferPlanLifecycle): {
  label: string;
  description: string;
  pillClassName: string;
} {
  switch (lifecycle) {
    case 'needs_funding':
      return {
        label: 'Needs Funding',
        description: 'Additional money is required.',
        pillClassName: 'border border-warning/30 bg-warning-soft text-warning',
      };
    case 'funded':
      return {
        label: 'Funded by Transfer',
        description: 'Transfer Plan funding is recorded.',
        pillClassName: 'finance-status-positive border',
      };
    case 'covered':
      return {
        label: 'Covered by Existing Balance',
        description: 'No Transfer Plan funding is required.',
        pillClassName: 'border border-muted bg-surface-muted text-muted',
      };
    case 'paid':
      return {
        label: 'Paid / Complete',
        description: 'All selected bills are recorded as paid.',
        pillClassName: 'finance-status-positive border',
      };
  }
}

export const TransferPlanView: React.FC<TransferPlanViewProps> = ({
  accounts,
  categories,
  plannedPayments,
  transactions,
  members,
  userRole,
  selectedMonth: propSelectedMonth,
  onSelectMonth: propOnSelectMonth,
  onOpenMonthImport,
  onUpdatePlannedPayment,
  onMarkPaymentPaid,
  onUndoPaymentPaid,
  onBulkTogglePlannedPayments,
  onExecuteTransfer,
  onUndoFunding,
}) => {
  const isViewOnly = userRole === 'view_only';

  const [internalSelectedMonth, setInternalSelectedMonth] =
    useState<string>('2026-09');
  const selectedMonth = propSelectedMonth || internalSelectedMonth;

  const [fundingModel, setFundingModel] =
    useState<TransferPlanAccountModel | null>(null);
  const [markingPayment, setMarkingPayment] =
    useState<PlannedPayment | null>(null);
  const [expandedAccountIds, setExpandedAccountIds] =
    useState<Record<string, boolean>>({});
  const [undoingFundingAccountId, setUndoingFundingAccountId] =
    useState<string | null>(null);
  const [undoingPaymentId, setUndoingPaymentId] =
    useState<string | null>(null);
  const [selectionBusyId, setSelectionBusyId] =
    useState<string | null>(null);
  const [bulkSelectionBusy, setBulkSelectionBusy] = useState(false);

  const handleSelectMonth = (month: string) => {
    if (propOnSelectMonth) propOnSelectMonth(month);
    else setInternalSelectedMonth(month);
  };

  const plan = useMemo(
    () =>
      generateTransferPlan(
        accounts,
        plannedPayments,
        selectedMonth,
        transactions
      ),
    [accounts, plannedPayments, selectedMonth, transactions]
  );

  const accountModels = useMemo(
    () =>
      buildTransferPlanAccountModels(
        plan,
        transactions,
        selectedMonth
      ),
    [plan, transactions, selectedMonth]
  );

  const groups = useMemo(
    () => groupTransferPlanAccountModels(accountModels),
    [accountModels]
  );

  const monthPayments = useMemo(
    () =>
      plannedPayments
        .filter((payment) => payment.month === selectedMonth)
        .sort((a, b) => {
          const dateA = a.dueDate || '9999-99-99';
          const dateB = b.dueDate || '9999-99-99';
          const byDate = dateA.localeCompare(dateB);
          return byDate || a.name.localeCompare(b.name);
        }),
    [plannedPayments, selectedMonth]
  );

  const selectedPayments = useMemo(
    () => monthPayments.filter((payment) => payment.includeInTransferPlan),
    [monthPayments]
  );

  const selectedPaidCount = useMemo(
    () => selectedPayments.filter((payment) => payment.status === 'paid').length,
    [selectedPayments]
  );

  const selectedUnpaidCount = selectedPayments.length - selectedPaidCount;

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const reservedPlanPenceByAccountId = useMemo(
    () =>
      Object.fromEntries(
        accountModels.map((model) => [
          model.requirement.account.id,
          model.requirement.totalUnpaidSelectedPaymentsPence,
        ])
      ) as Record<string, number>,
    [accountModels]
  );

  const toggleAccountExpand = (accountId: string) => {
    setExpandedAccountIds((current) => ({
      ...current,
      [accountId]: !current[accountId],
    }));
  };

  const handleTogglePaymentInPlan = async (payment: PlannedPayment) => {
    if (isViewOnly) return;
    try {
      setSelectionBusyId(payment.id);
      await onUpdatePlannedPayment(payment.id, {
        includeInTransferPlan: !payment.includeInTransferPlan,
      });
    } catch (error: any) {
      window.alert(error.message || 'Failed to update Transfer Plan selection.');
    } finally {
      setSelectionBusyId(null);
    }
  };

  const handleBulkSelection = async (include: boolean) => {
    if (isViewOnly) return;
    try {
      setBulkSelectionBusy(true);
      await onBulkTogglePlannedPayments({
        month: selectedMonth,
        include,
      });
    } catch (error: any) {
      window.alert(error.message || 'Failed to update Transfer Plan selection.');
    } finally {
      setBulkSelectionBusy(false);
    }
  };

  const handlePaymentStatusAction = async (payment: PlannedPayment) => {
    if (isViewOnly) return;

    if (payment.status !== 'paid') {
      setMarkingPayment(payment);
      return;
    }

    const account = accountsById.get(payment.accountId);
    const accountLabel = account
      ? accountIdentityLabel(account)
      : 'the recorded payment account';

    const confirmed = window.confirm(
      `Undo recorded payment for ${payment.name} (${formatPence(
        payment.actualAmountPence ?? payment.amountPence
      )}) from ${accountLabel}? This will remove the linked Activity expense and return the bill to Unpaid. Funding records are not changed.`
    );
    if (!confirmed) return;

    try {
      setUndoingPaymentId(payment.id);
      if (payment.actualTransactionId) {
        await onUndoPaymentPaid(payment.id);
      } else {
        // Compatibility for legacy paid rows that pre-date linked Activity
        // evidence. New paid rows always use the linked payment workflow.
        await onUpdatePlannedPayment(payment.id, { status: 'unpaid' });
      }
    } catch (error: any) {
      window.alert(error.message || 'Failed to undo recorded payment.');
    } finally {
      setUndoingPaymentId(null);
    }
  };

  const handleUndoFunding = async (model: TransferPlanAccountModel) => {
    if (isViewOnly || !model.latestFundingBatch) return;

    const { requirement, latestFundingBatch } = model;
    const sourceNames = latestFundingBatch.sourceAccountIds
      .map((id) => accountsById.get(id))
      .filter((account): account is Account => Boolean(account))
      .map((account) => accountIdentityLabel(account))
      .join(' + ');

    const paidCount = requirement.paidPayments.length;
    const paidWarning =
      paidCount > 0
        ? ` ${paidCount} recorded bill payment${paidCount === 1 ? '' : 's'} will remain recorded; this action reverses funding only.`
        : '';

    const confirmed = window.confirm(
      `Undo the latest ${formatPence(
        latestFundingBatch.totalPence
      )} funding for ${accountIdentityLabel(requirement.account)}${
        sourceNames ? ` from ${sourceNames}` : ''
      }? The exact latest funding batch will be returned to its original source account(s).${paidWarning}`
    );
    if (!confirmed) return;

    try {
      setUndoingFundingAccountId(requirement.account.id);
      await onUndoFunding(requirement.account.id, selectedMonth);
    } catch (error: any) {
      window.alert(error.message || 'Failed to undo Transfer Plan funding.');
    } finally {
      setUndoingFundingAccountId(null);
    }
  };

  const renderCardPaymentAction = (payment: PlannedPayment) => {
    if (isViewOnly) return null;

    const isPaid = payment.status === 'paid';
    return (
      <button
        type="button"
        onClick={() => handlePaymentStatusAction(payment)}
        disabled={undoingPaymentId === payment.id}
        className={
          isPaid
            ? 'inline-flex min-h-8 items-center justify-center gap-1 rounded-md border border-muted px-2.5 text-[11px] font-semibold text-muted hover:bg-surface-muted disabled:opacity-50'
            : 'inline-flex min-h-8 items-center justify-center gap-1 rounded-md bg-accent px-2.5 text-[11px] font-semibold text-on-accent hover:brightness-95 disabled:opacity-50'
        }
        title={isPaid ? 'Undo recorded payment' : 'Record payment'}
      >
        {isPaid ? (
          <RotateCcw className="h-3.5 w-3.5" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        {isPaid ? 'Undo payment' : 'Record paid'}
      </button>
    );
  };

  const renderFundingHistory = (model: TransferPlanAccountModel) => {
    if (model.fundingBatches.length === 0) return null;

    const destination = model.requirement.account;

    return (
      <div className="mt-3 rounded-lg border border-muted bg-surface-muted p-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-muted" />
            <span className="text-[11px] font-semibold text-main">
              Funding recorded
            </span>
          </div>
          <span className="finance-semantic-positive mv-private-value shrink-0 font-mono text-xs font-bold tabular-nums">
            {formatPence(model.fundingTotalPence)}
          </span>
        </div>

        <div className="mt-2 space-y-1.5">
          {model.fundingBatches.map((batch) => {
            const sources = batch.sourceAccountIds
              .map((id) => accountsById.get(id))
              .filter((account): account is Account => Boolean(account));

            const sourceLabel =
              sources.length > 0
                ? sources.map((account) => accountIdentityLabel(account)).join(' + ')
                : 'Source account unavailable';

            const date = batch.transactions[0]?.date;

            return (
              <div
                key={`${batch.destinationAccountId}-${batch.batchKey}`}
                className="flex flex-col gap-1 border-t border-muted/60 pt-1.5 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-[10px] text-muted">
                  <span className="font-medium text-main">{sourceLabel}</span>
                  <span className="mx-1.5">→</span>
                  <span>{accountIdentityLabel(destination)}</span>
                  {date ? <span className="ml-1.5 text-subtle">· {formatDueDate(date)}</span> : null}
                </div>
                <span className="finance-semantic-positive mv-private-value shrink-0 font-mono text-[11px] font-semibold tabular-nums">
                  {formatPence(batch.totalPence)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const billFundingLabel = (
    model: TransferPlanAccountModel,
    payment: PlannedPayment
  ) => {
    if (payment.status === 'paid') return 'Paid';

    if (model.lifecycle === 'funded') return 'Funding recorded';
    if (model.lifecycle === 'covered') return 'Covered by balance';
    if (model.lifecycle === 'paid') return 'Paid';

    const coveredByBalance = model.requirement.fundedPayments.some(
      (candidate) => candidate.id === payment.id
    );
    return coveredByBalance ? 'Covered by balance' : 'Needs funding';
  };

  const renderCardBills = (model: TransferPlanAccountModel) => {
    const { requirement } = model;
    const payments = [...requirement.selectedPayments].sort((a, b) => {
      const dateA = a.dueDate || '9999-99-99';
      const dateB = b.dueDate || '9999-99-99';
      return dateA.localeCompare(dateB) || a.name.localeCompare(b.name);
    });

    return (
      <div className="mt-3 overflow-hidden rounded-lg border border-muted">
        <div className="flex items-center justify-between gap-3 bg-surface-muted px-3 py-2">
          <div>
            <div className="text-[11px] font-semibold text-main">Bills in this card</div>
            <div className="text-[10px] text-subtle">
              {requirement.selectedPayments.length} selected · {requirement.paidPayments.length} paid · {requirement.unpaidPayments.length} unpaid
            </div>
          </div>
        </div>

        <div className="divide-y divide-muted">
          {payments.map((payment) => {
            const category = payment.categoryId
              ? categoriesById.get(payment.categoryId)
              : undefined;
            const statusLabel = billFundingLabel(model, payment);

            return (
              <div
                key={payment.id}
                className="flex flex-col gap-2 bg-surface px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  {!isViewOnly && (
                    <label className="mt-0.5 flex shrink-0 items-center" title="In Transfer Plan">
                      <input
                        type="checkbox"
                        checked={payment.includeInTransferPlan}
                        onChange={() => handleTogglePaymentInPlan(payment)}
                        disabled={selectionBusyId === payment.id}
                        className="h-4 w-4 rounded border-muted"
                      />
                      <span className="sr-only">In Plan</span>
                    </label>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-main">
                        {payment.name}
                      </span>
                      <span
                        className={
                          payment.status === 'paid'
                            ? 'finance-status-positive rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide'
                            : 'rounded-full border border-muted bg-surface-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted'
                        }
                      >
                        {payment.status === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>

                    <div className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] text-subtle">
                      <span>{formatDueDate(payment.dueDate)}</span>
                      <span>·</span>
                      <span>{payment.responsiblePerson}</span>
                      {category ? (
                        <>
                          <span>·</span>
                          <span>{category}</span>
                        </>
                      ) : null}
                      <span>·</span>
                      <span>{statusLabel}</span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                  <span className="mv-private-value min-w-[82px] text-right font-mono text-xs font-bold tabular-nums text-main">
                    {formatPence(payment.amountPence)}
                  </span>
                  {renderCardPaymentAction(payment)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAccountCard = (model: TransferPlanAccountModel) => {
    const { requirement, lifecycle, latestFundingBatch } = model;
    const account = requirement.account;
    const meta = lifecycleMeta(lifecycle);
    const expanded = expandedAccountIds[account.id] === true;
    const leftAfterUnpaid =
      requirement.currentBalancePence -
      requirement.totalUnpaidSelectedPaymentsPence;

    const stateMetric =
      lifecycle === 'needs_funding'
        ? {
            label: 'Transfer required',
            value: requirement.transferRequiredPence,
            valueClassName: 'text-main',
          }
        : lifecycle === 'funded'
          ? {
              label: 'Funding received',
              value: model.fundingTotalPence,
              valueClassName: 'finance-semantic-positive',
            }
          : lifecycle === 'covered'
            ? {
                label: 'Left after unpaid bills',
                value: leftAfterUnpaid,
                valueClassName: 'text-main',
              }
            : {
                label: 'Unpaid remaining',
                value: 0,
                valueClassName: 'finance-semantic-positive',
              };

    return (
      <article
        key={account.id}
        className="mv-card rounded-xl border border-muted bg-surface p-3.5 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-bold text-main">
                {accountIdentityLabel(account)}
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${meta.pillClassName}`}
              >
                {meta.label}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-subtle">{meta.description}</p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {lifecycle === 'needs_funding' && !isViewOnly && (
              <button
                type="button"
                onClick={() => setFundingModel(model)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[11px] font-semibold text-on-accent hover:brightness-95"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Record transfer
              </button>
            )}

            {latestFundingBatch && !isViewOnly && (
              <button
                type="button"
                onClick={() => handleUndoFunding(model)}
                disabled={undoingFundingAccountId === account.id}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-muted px-3 text-[11px] font-semibold text-muted hover:bg-surface-muted disabled:opacity-50"
                title="Undo all funding for this card and return the money to the original source account(s)"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Undo Funding
              </button>
            )}

            <button
              type="button"
              onClick={() => toggleAccountExpand(account.id)}
              aria-expanded={expanded}
              className="inline-flex min-h-8 items-center gap-1 rounded-md border border-muted px-2.5 text-[11px] font-semibold text-muted hover:bg-surface-muted"
            >
              {expanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {expanded
                ? 'Hide bills'
                : `Show bills (${requirement.selectedPayments.length})`}
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <div className="rounded-lg border border-muted bg-surface-muted px-2.5 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-subtle">
              Current balance
            </div>
            <div className="mv-private-value mt-0.5 font-mono text-sm font-bold tabular-nums text-main">
              {formatPence(requirement.currentBalancePence)}
            </div>
          </div>

          <div className="rounded-lg border border-muted bg-surface-muted px-2.5 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-subtle">
              Selected bills
            </div>
            <div className="mv-private-value mt-0.5 font-mono text-sm font-bold tabular-nums text-main">
              {formatPence(requirement.totalSelectedPaymentsPence)}
            </div>
          </div>

          <div className="rounded-lg border border-muted bg-surface-muted px-2.5 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-subtle">
              Unpaid in plan
            </div>
            <div className="mv-private-value mt-0.5 font-mono text-sm font-bold tabular-nums text-main">
              {formatPence(requirement.totalUnpaidSelectedPaymentsPence)}
            </div>
          </div>

          <div className="rounded-lg border border-muted bg-surface-muted px-2.5 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-wide text-subtle">
              {stateMetric.label}
            </div>
            <div
              className={`mv-private-value mt-0.5 font-mono text-sm font-bold tabular-nums ${stateMetric.valueClassName}`}
            >
              {formatPence(stateMetric.value)}
            </div>
          </div>
        </div>

        {renderFundingHistory(model)}
        {expanded ? renderCardBills(model) : null}
      </article>
    );
  };

  const renderLifecycleSection = (
    title: string,
    models: TransferPlanAccountModel[],
    emptyMessage?: string
  ) => {
    if (models.length === 0) {
      if (!emptyMessage) return null;
      return (
        <section className="finance-panel p-3">
          <div className="text-xs font-semibold text-main">{title}</div>
          <div className="mt-1 text-[10px] text-subtle">{emptyMessage}</div>
        </section>
      );
    }

    return (
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
            {title}
          </h2>
          <span className="rounded-full border border-muted bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-muted">
            {models.length}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {models.map(renderAccountCard)}
        </div>
      </section>
    );
  };

  return (
    <div className="finance-workspace space-y-5 pb-16">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold leading-8 tracking-tight text-main">
            Transfer Plan
          </h1>
          <p className="mt-0.5 text-[12px] text-subtle">
            Position money for selected bills. Funding and payment stay separate.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker
            value={selectedMonth}
            onChange={handleSelectMonth}
            ariaLabel="Transfer Plan month"
            className="min-w-[170px]"
          />
          {onOpenMonthImport && !isViewOnly && (
            <button
              type="button"
              onClick={onOpenMonthImport}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-muted px-3 text-xs font-semibold text-muted hover:bg-surface-muted"
            >
              <Layers className="h-3.5 w-3.5" />
              Prepare month
            </button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="finance-summary-card rounded-xl border border-muted bg-surface p-3">
          <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-subtle">
            Transfer required
          </div>
          <div className="mv-private-value mt-1 font-mono text-xl font-bold tabular-nums text-main">
            {formatPence(plan.totalTransferRequiredPence)}
          </div>
          <div className="mt-0.5 text-[10px] text-subtle">
            {groups.needsFunding.length} account{groups.needsFunding.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="finance-summary-card rounded-xl border border-muted bg-surface p-3">
          <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-subtle">
            Bills in plan
          </div>
          <div className="mt-1 text-xl font-bold text-main">
            {selectedPayments.length}
          </div>
          <div className="mt-0.5 text-[10px] text-subtle">
            {selectedUnpaidCount} unpaid · {selectedPaidCount} paid
          </div>
        </div>

        <div className="finance-summary-card rounded-xl border border-muted bg-surface p-3">
          <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-subtle">
            Funded cards
          </div>
          <div className="mt-1 text-xl font-bold finance-semantic-positive">
            {groups.funded.length}
          </div>
          <div className="mt-0.5 text-[10px] text-subtle">
            {groups.covered.length} covered by balance
          </div>
        </div>

        <div className="finance-summary-card rounded-xl border border-muted bg-surface p-3">
          <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-subtle">
            Complete
          </div>
          <div className="mt-1 text-xl font-bold finance-semantic-positive">
            {groups.paid.length}
          </div>
          <div className="mt-0.5 text-[10px] text-subtle">
            Paid account cards
          </div>
        </div>
      </section>

      {selectedPayments.length === 0 ? (
        <section className="finance-panel p-5">
          <div className="flex min-h-[120px] flex-col items-center justify-center text-center">
            <AlertCircle className="h-5 w-5 text-subtle" />
            <p className="mt-2 text-sm font-semibold text-main">
              No bills selected for {formatMonthLabel(selectedMonth)}
            </p>
            <p className="mt-1 text-[11px] text-subtle">
              Use the bill selection list below to choose what belongs in this Transfer Plan.
            </p>
          </div>
        </section>
      ) : (
        <div className="space-y-5">
          {renderLifecycleSection('Needs Funding', groups.needsFunding)}
          {renderLifecycleSection('Funded by Transfer', groups.funded)}
          {renderLifecycleSection('Covered by Existing Balance', groups.covered)}
          {renderLifecycleSection('Paid / Complete', groups.paid)}
        </div>
      )}

      <section className="finance-panel overflow-hidden" aria-label="Transfer Plan bill selection">
        <div className="flex flex-col gap-2 border-b border-muted px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-main">
                Bills · {formatMonthLabel(selectedMonth)}
              </h2>
              <span className="rounded-full border border-muted bg-surface-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted">
                Selection only
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-subtle">
              Bill details are read-only here. Select only what belongs in the Transfer Plan.
            </p>
          </div>

          {!isViewOnly && monthPayments.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleBulkSelection(true)}
                disabled={bulkSelectionBusy}
                className="inline-flex min-h-8 items-center gap-1 rounded-md border border-muted px-2.5 text-[11px] font-semibold text-muted hover:bg-surface-muted disabled:opacity-50"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Select all
              </button>
              <button
                type="button"
                onClick={() => handleBulkSelection(false)}
                disabled={bulkSelectionBusy}
                className="inline-flex min-h-8 items-center gap-1 rounded-md border border-muted px-2.5 text-[11px] font-semibold text-muted hover:bg-surface-muted disabled:opacity-50"
              >
                <Square className="h-3.5 w-3.5" />
                Clear all
              </button>
            </div>
          )}
        </div>

        {monthPayments.length === 0 ? (
          <div className="p-5 text-center text-xs text-subtle">
            No scheduled bills exist for this month.
          </div>
        ) : (
          <div className="divide-y divide-muted">
            {monthPayments.map((payment) => {
              const account = accountsById.get(payment.accountId);
              const category = payment.categoryId
                ? categoriesById.get(payment.categoryId)
                : undefined;

              return (
                <div
                  key={payment.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-2.5 px-3 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_110px_92px] sm:items-center"
                >
                  <label className="flex items-center" title="Include in Transfer Plan">
                    <input
                      type="checkbox"
                      checked={payment.includeInTransferPlan}
                      onChange={() => handleTogglePaymentInPlan(payment)}
                      disabled={isViewOnly || selectionBusyId === payment.id}
                      className="h-4 w-4 rounded border-muted"
                    />
                    <span className="sr-only">
                      {payment.includeInTransferPlan ? 'In Plan' : 'Not in Plan'}
                    </span>
                  </label>

                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-main">
                      {payment.name}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-1.5 gap-y-0.5 text-[10px] text-subtle">
                      <span>{formatDueDate(payment.dueDate)}</span>
                      <span>·</span>
                      <span>{payment.responsiblePerson}</span>
                      {category ? (
                        <>
                          <span>·</span>
                          <span>{category}</span>
                        </>
                      ) : null}
                      <span>·</span>
                      <span className={account ? '' : 'text-danger'}>
                        {account ? accountIdentityLabel(account) : 'Account missing'}
                      </span>
                    </div>
                  </div>

                  <div className="col-start-2 flex items-center gap-2 sm:col-start-auto sm:justify-end">
                    <span
                      className={
                        payment.status === 'paid'
                          ? 'finance-status-positive rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide'
                          : 'rounded-full border border-muted bg-surface-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted'
                      }
                    >
                      {payment.status === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>

                  <div className="mv-private-value col-start-2 text-left font-mono text-xs font-bold tabular-nums text-main sm:col-start-auto sm:text-right">
                    {formatPence(payment.amountPence)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {fundingModel && (
        <ExecuteTransferModal
          fundingRequirement={fundingModel.requirement}
          availableSourceAccounts={accounts}
          members={members}
          reservedPlanPenceByAccountId={reservedPlanPenceByAccountId}
          onClose={() => setFundingModel(null)}
          onExecute={async (payload) => {
            await onExecuteTransfer({
              ...payload,
              month: selectedMonth,
            });
          }}
        />
      )}

      {markingPayment && (
        <MarkPaymentPaidModal
          payment={markingPayment}
          accounts={accounts}
          onClose={() => setMarkingPayment(null)}
          onConfirm={async (payload) => {
            await onMarkPaymentPaid(markingPayment.id, payload);
          }}
        />
      )}
    </div>
  );
};
