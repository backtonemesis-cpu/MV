import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  Plus,
  CheckCircle2,
  AlertCircle,
    Layers,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Edit2,
  Trash2,
  HelpCircle,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import {
  Account,
  Category,
  PlannedPayment,
  UserRole,
  AccountFundingRequirement,
  HouseholdMember,
  Transaction,
} from '../types';
import { formatPence } from '../utils/currency';
import { generateTransferPlan, formatMonthLabel } from '../utils/transferPlan';
import { getLatestTransferPlanFundingByDestination } from '../utils/transferPlanFunding';
import {
  accountIdentityLabel,
  accountOwnerLabel,
  accountTypeLabel,
} from '../utils/accountDisplay';
import { ExecuteTransferModal } from './ExecuteTransferModal';
import { PlannedPaymentModal } from './PlannedPaymentModal';
import { MonthPicker } from './MonthPicker';
import { MarkPaymentPaidModal } from './MarkPaymentPaidModal';

interface TransferPlanViewProps {
  accounts: Account[];
  categories: Category[];
  plannedPayments: PlannedPayment[];
  transactions: Transaction[];
  members: HouseholdMember[];
  userRole: UserRole;
  currentVersion: number;
  selectedMonth?: string;
  onSelectMonth?: (month: string) => void;
  onOpenMonthImport?: () => void;
  onCreatePlannedPayment: (data: Partial<PlannedPayment>) => Promise<void>;
  onUpdatePlannedPayment: (id: string, data: Partial<PlannedPayment>) => Promise<void>;
  onDeletePlannedPayment: (id: string) => Promise<void>;
  onMarkPaymentPaid: (
    id: string,
    payload: {
      actualAmountPence: number;
      actualDate: string;
      accountId: string;
    }
  ) => Promise<void>;
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

export const TransferPlanView: React.FC<TransferPlanViewProps> = ({
  accounts,
  categories,
  plannedPayments,
  transactions,
  members,
  userRole,
  currentVersion,
  selectedMonth: propSelectedMonth,
  onSelectMonth: propOnSelectMonth,
  onOpenMonthImport,
  onCreatePlannedPayment,
  onUpdatePlannedPayment,
  onDeletePlannedPayment,
  onMarkPaymentPaid,
  onBulkTogglePlannedPayments,
  onExecuteTransfer,
  onUndoFunding,
}) => {
  const isViewOnly = userRole === 'view_only';

  const [internalSelectedMonth, setInternalSelectedMonth] = useState<string>('2026-09');
  const selectedMonth = propSelectedMonth || internalSelectedMonth;
  const handleSelectMonth = (month: string) => {
    if (propOnSelectMonth) {
      propOnSelectMonth(month);
    } else {
      setInternalSelectedMonth(month);
    }
  };

  const [fundingAccountToTransfer, setFundingAccountToTransfer] =
    useState<AccountFundingRequirement | null>(null);
  const [editingPayment, setEditingPayment] = useState<PlannedPayment | null>(null);
  const [markingPayment, setMarkingPayment] = useState<PlannedPayment | null>(null);
  const [undoingFundingAccountId, setUndoingFundingAccountId] = useState<string | null>(null);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [expandedAccountIds, setExpandedAccountIds] = useState<Record<string, boolean>>({
    'acc-marius-current': true,
    'acc-joint-current': true,
    'acc-vesta-current': true,
  });

  // Generate authoritative Transfer Plan with exact integer-pence math
  const plan = useMemo(() => {
    return generateTransferPlan(accounts, plannedPayments, selectedMonth, transactions);
  }, [accounts, plannedPayments, selectedMonth, transactions]);

  // Filtered payments for the selected month
  const monthPayments = useMemo(() => {
    return plannedPayments.filter((p) => p.month === selectedMonth);
  }, [plannedPayments, selectedMonth]);

  const selectedPlanPayments = useMemo(
    () => monthPayments.filter((payment) => payment.includeInTransferPlan),
    [monthPayments]
  );
  const selectedPlanTotalPence = useMemo(
    () => selectedPlanPayments.reduce((sum, payment) => sum + payment.amountPence, 0),
    [selectedPlanPayments]
  );
  const selectedPlanPaidCount = useMemo(
    () => selectedPlanPayments.filter((payment) => payment.status === 'paid').length,
    [selectedPlanPayments]
  );
  const selectedPlanUnpaidCount = selectedPlanPayments.length - selectedPlanPaidCount;
  const reservedPlanPenceByAccountId = useMemo(
    () =>
      Object.fromEntries(
        [...plan.accountsNeedingFunding, ...plan.accountsFullyFunded].map(
          (requirement) => [
            requirement.account.id,
            requirement.totalUnpaidSelectedPaymentsPence,
          ]
        )
      ) as Record<string, number>,
    [plan.accountsNeedingFunding, plan.accountsFullyFunded]
  );

  // Payment status shown inside Transfer Plan is the explicit Plan status.
  // A linked Activity transaction must not silently remove a bill from funding.
  const isPaymentPaid = (payment: PlannedPayment) => payment.status === 'paid';

  const latestFundingBatchByDestination = useMemo(
    () =>
      getLatestTransferPlanFundingByDestination(
        transactions,
        selectedMonth,
        true
      ),
    [transactions, selectedMonth]
  );

  const fundedAccountRequirements = useMemo(
    () =>
      plan.accountsFullyFunded.filter((requirement) =>
        latestFundingBatchByDestination.has(requirement.account.id)
      ),
    [plan.accountsFullyFunded, latestFundingBatchByDestination]
  );

  const coveredAccountRequirements = useMemo(
    () =>
      plan.accountsFullyFunded.filter(
        (requirement) =>
          !latestFundingBatchByDestination.has(requirement.account.id) &&
          requirement.unpaidPayments.length > 0
      ),
    [plan.accountsFullyFunded, latestFundingBatchByDestination]
  );

  const completedAccountRequirements = useMemo(
    () =>
      plan.accountsFullyFunded.filter(
        (requirement) =>
          !latestFundingBatchByDestination.has(requirement.account.id) &&
          requirement.unpaidPayments.length === 0
      ),
    [plan.accountsFullyFunded, latestFundingBatchByDestination]
  );

  const planAccountCount =
    plan.accountsNeedingFunding.length +
    fundedAccountRequirements.length +
    coveredAccountRequirements.length +
    completedAccountRequirements.length;

  const handleUndoFunding = async (account: Account) => {
    if (isViewOnly) return;

    const funding = latestFundingBatchByDestination.get(account.id);
    if (!funding) return;

    const sourceNames = funding.sourceAccountIds
      .map((accountId) => accounts.find((candidate) => candidate.id === accountId))
      .filter((candidate): candidate is Account => Boolean(candidate))
      .map((candidate) => accountIdentityLabel(candidate))
      .join(' + ');

    const fundingLabel =
      funding.kind === 'legacy_incoming'
        ? 'legacy incoming funding transfer'
        : 'Transfer Plan funding';

    const confirmed = window.confirm(
      `Undo the latest ${formatPence(funding.totalPence)} ${fundingLabel} for ${accountIdentityLabel(account)}${sourceNames ? ` from ${sourceNames}` : ''}? The money will be returned to the original funding account(s).`
    );
    if (!confirmed) return;

    try {
      setUndoingFundingAccountId(account.id);
      await onUndoFunding(account.id, selectedMonth);
    } catch (err: any) {
      window.alert(err.message || 'Failed to undo Transfer Plan funding.');
    } finally {
      setUndoingFundingAccountId(null);
    }
  };

  const toggleAccountExpand = (accountId: string) => {
    setExpandedAccountIds((prev) => ({
      ...prev,
      [accountId]: !prev[accountId],
    }));
  };

  const handleTogglePaymentInPlan = async (payment: PlannedPayment) => {
    if (isViewOnly) return;
    try {
      await onUpdatePlannedPayment(payment.id, {
        includeInTransferPlan: !payment.includeInTransferPlan,
      });
    } catch (err: any) {
      console.error('Failed to toggle plan inclusion', err);
    }
  };

  const handlePaymentStatusAction = async (payment: PlannedPayment) => {
    if (isViewOnly || payment.status === 'paid') return;

    // If legacy/imported data already has actual evidence, synchronise the
    // display status without creating a duplicate expense.
    if (payment.actualTransactionId) {
      try {
        await onUpdatePlannedPayment(payment.id, { status: 'paid' });
      } catch (err: any) {
        window.alert(err.message || 'Failed to synchronise bill status.');
      }
      return;
    }

    setMarkingPayment(payment);
  };

  const handleBulkIncludeUnpaid = async () => {
    if (isViewOnly) return;
    try {
      await onBulkTogglePlannedPayments({
        month: selectedMonth,
        include: true,
        status: 'unpaid',
      });
    } catch (err: any) {
      console.error('Failed to bulk include unpaid', err);
    }
  };

  const handleBulkIncludePaid = async () => {
    if (isViewOnly) return;
    try {
      await onBulkTogglePlannedPayments({
        month: selectedMonth,
        include: true,
        status: 'paid',
      });
    } catch (err: any) {
      console.error('Failed to bulk include paid', err);
    }
  };

  const handleBulkDeselectAll = async () => {
    if (isViewOnly) return;
    try {
      await onBulkTogglePlannedPayments({
        month: selectedMonth,
        include: false,
      });
    } catch (err: any) {
      console.error('Failed to bulk deselect', err);
    }
  };

  const handleBulkSelectAll = async () => {
    if (isViewOnly) return;
    try {
      await onBulkTogglePlannedPayments({
        month: selectedMonth,
        include: true,
      });
    } catch (err: any) {
      console.error('Failed to bulk select all', err);
    }
  };

  const renderReadyAccountCard = (req: AccountFundingRequirement) => (
    <article
                    key={req.account.id}
                    id={`funding-card-${req.account.id}`}
                    className="mv-card bg-surface rounded-2xl border border-muted shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)] overflow-hidden"
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
                            Bills paid from
                          </div>
                          <h3 className="mt-1 text-base font-bold tracking-tight text-main">
                            {req.account.name}
                          </h3>
                          <div className="mt-0.5 text-xs text-muted">
                            {accountTypeLabel(req.account.type)} · {accountOwnerLabel(req.account)}
                          </div>
                        </div>
    
                        <div className="shrink-0 flex items-center gap-2">
                          <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-success-soft text-success">
                            {latestFundingBatchByDestination.has(req.account.id)
                              ? latestFundingBatchByDestination.get(req.account.id)!.kind ===
                                'legacy_incoming'
                                ? 'Funded · Legacy'
                                : 'Funded'
                              : req.unpaidPayments.length === 0
                                ? 'Paid / Complete'
                                : 'Covered'}
                          </span>
                          {!isViewOnly && latestFundingBatchByDestination.has(req.account.id) && (
                            <button
                              type="button"
                              onClick={() => handleUndoFunding(req.account)}
                              disabled={undoingFundingAccountId === req.account.id}
                              title="Undo the latest incoming funding transfer and return the money to the original source account(s)"
                              className="inline-flex items-center gap-1 rounded-lg border border-muted bg-surface-muted px-2.5 py-1 text-[11px] font-semibold text-muted transition hover:border-strong hover:text-main disabled:opacity-50"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              {undoingFundingAccountId === req.account.id ? 'Undoing...' : 'Undo Funding'}
                            </button>
                          )}
                        </div>
                      </div>
    
                      <div className="mt-5">
                        <div className="text-xs font-medium text-subtle">
                          {latestFundingBatchByDestination.has(req.account.id)
                            ? 'Balance after funding'
                            : 'Current balance'}
                        </div>
                        <div className="mt-1 text-2xl font-extrabold tracking-tight text-main">
                          {formatPence(req.currentBalancePence)}
                        </div>
    
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <div className="rounded-xl bg-surface-muted px-3.5 py-2.5">
                            <div className="text-[11px] font-medium text-subtle">Selected bills</div>
                            <div className="mt-0.5 text-[13px] font-bold text-main">
                              {formatPence(
                                req.selectedPayments.reduce(
                                  (sum, payment) => sum + payment.amountPence,
                                  0
                                )
                              )}
                            </div>
                          </div>
                          <div className="rounded-xl bg-surface-muted px-3.5 py-2.5">
                            <div className="text-[11px] font-medium text-subtle">
                              Left after unpaid bills
                            </div>
                            <div className="mt-0.5 text-[13px] font-bold text-main">
                              {formatPence(
                                Math.max(
                                  0,
                                  req.amountAvailablePence - req.totalUnpaidSelectedPaymentsPence
                                )
                              )}
                            </div>
                          </div>
                          <div className="col-span-2 sm:col-span-1 rounded-xl bg-surface-muted px-3.5 py-2.5">
                            <div className="text-[11px] font-medium text-subtle">Bills selected</div>
                            <div className="mt-0.5 text-[13px] font-bold text-main">
                              {req.selectedPayments.length}
                            </div>
                          </div>
                        </div>
    
                        {latestFundingBatchByDestination.has(req.account.id) ? (
                          <div className="mt-3 rounded-xl border border-muted bg-surface px-3.5 py-2.5">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-subtle">
                              {latestFundingBatchByDestination.get(req.account.id)!.kind ===
                              'legacy_incoming'
                                ? 'Legacy funding received'
                                : 'Funding received'}
                            </div>
                            <div className="mt-1.5 divide-y divide-muted">
                              {latestFundingBatchByDestination
                                .get(req.account.id)!
                                .allocations.map((allocation, index) => {
                                  const sourceAccount = accounts.find(
                                    (account) => account.id === allocation.sourceAccountId
                                  );
                                  const sourceName = sourceAccount?.name || 'Unknown account';
                                  const fundingBatch = latestFundingBatchByDestination.get(
                                    req.account.id
                                  )!;
                                  const sourceOwner =
                                    sourceAccount?.ownerPerson ||
                                    fundingBatch.transactions[index]?.payer ||
                                    'Owner not recorded';
                                  const sourceType = sourceAccount
                                    ? `${sourceAccount.type.charAt(0).toUpperCase()}${sourceAccount.type.slice(1)} account`
                                    : '';
    
                                  return (
                                    <div
                                      key={`${allocation.sourceAccountId}-${index}`}
                                      className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                                    >
                                      <div className="min-w-0">
                                        <div className="text-[12px] font-semibold text-main">
                                          From {sourceName}
                                        </div>
                                        <div className="text-[11px] text-subtle">
                                          {sourceOwner}{sourceType ? ` · ${sourceType}` : ''}
                                        </div>
                                      </div>
                                      <div className="shrink-0 text-[13px] font-bold text-main">
                                        {formatPence(allocation.amountPence)}
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 rounded-xl border border-muted bg-surface px-3.5 py-2.5 text-[12px] text-muted">
                            {req.unpaidPayments.length === 0
                              ? 'All selected bills are recorded as paid. No new Transfer Plan funding is required.'
                              : 'Covered by the existing account balance. No Transfer Plan funding transfer was recorded, so there is nothing to undo.'}
                          </div>
                        )}
                      </div>
    
                      <div className="mt-5">
                        {req.selectedPayments.length > 0 ? (
                          <div className="rounded-xl border border-muted bg-surface-muted px-4 py-2">
                            <div className="divide-y divide-muted">
                              {req.selectedPayments.map((p) => (
                                <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={p.includeInTransferPlan}
                                      onChange={() => handleTogglePaymentInPlan(p)}
                                      disabled={isViewOnly}
                                      className="w-3.5 h-3.5 text-main rounded border-muted focus:ring-muted cursor-pointer"
                                    />
                                    <span className="font-semibold text-main truncate">
                                      {p.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span
                                      className={
                                        p.status === 'paid'
                                          ? 'text-[10px] font-semibold uppercase tracking-wider text-success'
                                          : 'text-[10px] font-semibold uppercase tracking-wider text-muted'
                                      }
                                    >
                                      {p.status === 'paid' ? 'Paid' : 'Unpaid'}
                                    </span>
                                    <span
                                      className={
                                        latestFundingBatchByDestination.has(req.account.id)
                                          ? 'text-[10px] font-semibold uppercase tracking-wider text-accent'
                                          : 'text-[10px] font-semibold uppercase tracking-wider text-muted'
                                      }
                                    >
                                      {latestFundingBatchByDestination.has(req.account.id)
                                        ? 'Funded'
                                        : p.status === 'paid'
                                          ? 'Complete'
                                          : 'Covered'}
                                    </span>
                                    <span className="font-bold text-main">
                                      {formatPence(p.amountPence)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-muted bg-surface-muted px-4 py-4 text-center">
                            <span className="text-[13px] font-medium text-muted">
                              No payments selected for this account
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* View Header with Month Filter & Quick Context */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-muted pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-main tracking-tight">Plan</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-surface-muted text-main border border-muted">
              {formatMonthLabel(selectedMonth)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:min-w-[360px]">
          {/* Month Selector */}
          <div className="col-span-2">
            <MonthPicker
              id="transfer-plan-month-select"
              value={selectedMonth}
              onChange={handleSelectMonth}
              ariaLabel="Transfer plan month"
              className="is-fluid"
            />
          </div>

          {onOpenMonthImport && !isViewOnly && (
            <button
              onClick={onOpenMonthImport}
              className="min-w-0 px-3 py-2 text-xs font-medium text-muted bg-surface border border-muted hover:bg-surface-muted rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors"
              title="Prepare next month"
            >
              <Layers className="w-3.5 h-3.5 shrink-0 text-muted text-subtle" />
              <span>Prepare Next Month</span>
            </button>
          )}

          {!isViewOnly && (
            <button
              id="add-planned-payment-button"
              onClick={() => setIsAddingPayment(true)}
              className="min-w-0 px-3 py-2 text-xs font-medium text-on-accent bg-surface hover:bg-surface-muted rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Add Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Summary Metrics */}
      <section className="grid grid-cols-[repeat(2,minmax(0,1fr))] lg:grid-cols-4 gap-3">
        <article
          id="stat-transfer-required"
          className="mv-card min-w-0 rounded-2xl border border-muted bg-surface p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium leading-5 text-muted">
              Transfer Required
            </span>
            <ArrowLeftRight
              className={`w-4 h-4 shrink-0 ${
                plan.totalTransferRequiredPence > 0 ? 'text-warning' : 'text-success'
              }`}
            />
          </div>
          <div
            className={`mv-private-value mt-2 text-2xl font-bold tracking-tight ${
              plan.totalTransferRequiredPence > 0
                ? 'text-warning'
                : 'text-main'
            }`}
          >
            {formatPence(plan.totalTransferRequiredPence)}
          </div>
          <p className="mt-1 text-sm leading-5 text-muted">
            {plan.accountsNeedingFunding.length > 0
              ? `${plan.accountsNeedingFunding.length} account${
                  plan.accountsNeedingFunding.length !== 1 ? 's' : ''
                } need funding`
              : planAccountCount > 0
                ? 'No new funding required'
                : 'No selected accounts to fund'}
          </p>
        </article>

        <article className="mv-card min-w-0 rounded-2xl border border-muted bg-surface p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium leading-5 text-muted">
              Payments in Plan
            </span>
            <Layers className="w-4 h-4 shrink-0 text-subtle" />
          </div>
          <div className="mv-private-value mt-2 text-2xl font-bold tracking-tight text-main">
            {formatPence(selectedPlanTotalPence)}
          </div>
          <p className="mt-1 text-sm leading-5 text-muted">
            {selectedPlanPayments.length} selected · {selectedPlanUnpaidCount} unpaid · {selectedPlanPaidCount} paid
          </p>
        </article>

        <article className="mv-card min-w-0 rounded-2xl border border-muted bg-surface p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium leading-5 text-muted">
              Accounts
            </span>
            <AlertCircle
              className={`w-4 h-4 shrink-0 ${
                plan.accountsNeedingFunding.length > 0 ? 'text-warning' : 'text-subtle'
              }`}
            />
          </div>
          <div className="mv-private-value mt-2 text-2xl font-bold tracking-tight text-main">
            {planAccountCount}
          </div>
          <p className="mt-1 text-sm leading-5 text-muted">
            {plan.accountsNeedingFunding.length} need funding · {fundedAccountRequirements.length} funded · {coveredAccountRequirements.length} covered · {completedAccountRequirements.length} complete
          </p>
        </article>

      </section>

      {/* SECTION 1: Account Funding Requirements (The Primary Purpose) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-main">
              Account Funding
            </h2>
          </div>
        </div>

        {/* Accounts Needing Funding First */}
        {plan.accountsNeedingFunding.length > 0 && (
          <div className="space-y-4">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-warning-soft px-3 py-1.5 text-[14px] font-semibold leading-5 text-warning">
              <AlertCircle className="w-3.5 h-3.5 text-warning shrink-0" />
              <span className="whitespace-nowrap">Needs Funding ({plan.accountsNeedingFunding.length})</span>
            </div>

            {plan.accountsNeedingFunding.map((req) => (
              <div
                key={req.account.id}
                id={`funding-card-${req.account.id}`}
                className="mv-card bg-surface rounded-2xl border border-muted shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)] overflow-hidden"
              >
                {/* Account Card Header */}
                <div className="p-4 sm:p-5 bg-surface border-b border-muted flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-main">{req.account.name}</h3>
                    <div className="mt-0.5 text-xs text-muted">
                      {accountTypeLabel(req.account.type)} · {accountOwnerLabel(req.account)}
                    </div>
                    <div className="text-xs text-subtle mt-1">
                      {req.selectedPayments.length} selected bill{req.selectedPayments.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-medium text-warning uppercase tracking-wider block">
                        Transfer Required
                      </span>
                      <span className="mv-private-value text-xl font-extrabold text-warning">
                        {formatPence(req.transferRequiredPence)}
                      </span>
                    </div>

                    {!isViewOnly && (
                      <button
                        id={`btn-transfer-${req.account.id}`}
                        onClick={() => setFundingAccountToTransfer(req)}
                        className="px-3.5 py-2 text-xs font-semibold text-on-accent bg-surface hover:bg-surface-muted rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Record Funding</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 4-Column Exact Financial Breakdown per Handoff Specification */}
                <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-muted bg-surface border-b border-muted text-xs">
                  <div className="p-4">
                    <span className="text-muted text-subtle font-medium block">Balance</span>
                    <span className="mv-private-value text-sm font-bold text-main mt-1 block">
                      {formatPence(req.currentBalancePence)}
                    </span>
                  </div>

                  <div className="p-4">
                    <span className="text-muted text-subtle font-medium block">Selected Bills</span>
                    <span className="mv-private-value text-sm font-bold text-main mt-1 block">
                      {formatPence(req.totalSelectedPaymentsPence)}
                    </span>
                  </div>

                  <div className="p-4">
                    <span className="text-muted text-subtle font-medium block">Available</span>
                    <span className="mv-private-value text-sm font-bold text-main mt-1 block">
                      {formatPence(req.amountAvailablePence)}
                    </span>
                  </div>

                  <div className="p-4 bg-warning-soft">
                    <span className="text-warning font-semibold block">Transfer Required</span>
                    <span className="mv-private-value text-sm font-extrabold text-warning mt-1 block">
                      {formatPence(req.transferRequiredPence)}
                    </span>
                  </div>
                </div>

                {/* Selected upcoming payments that create this requirement */}
                <div className="p-4 bg-surface-muted">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted">
                      Selected payments
                    </span>
                    <button
                      onClick={() => toggleAccountExpand(req.account.id)}
                      className="text-xs text-muted text-subtle hover:text-main flex items-center gap-1 transition-colors"
                    >
                      {expandedAccountIds[req.account.id] ? (
                        <>
                          <span>Collapse</span>
                          <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          <span>Expand ({req.selectedPayments.length})</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>

                  {expandedAccountIds[req.account.id] && (
                    <div className="space-y-1.5 mt-2">
                      {req.selectedPayments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between px-3 py-2 bg-surface rounded-lg border border-muted text-xs hover:border-muted transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={p.includeInTransferPlan}
                              onChange={() => handleTogglePaymentInPlan(p)}
                              disabled={isViewOnly}
                              title="In plan"
                              className="w-4 h-4 text-main rounded border-muted focus:ring-muted cursor-pointer"
                            />
                            <div>
                              <span className="font-semibold text-main">{p.name}</span>
                              <span className="text-muted text-subtle ml-2">
                                Due: {p.dueDate || 'Flexible'} · Responsible: {p.responsiblePerson}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider ${
                                p.status === 'paid'
                                  ? 'bg-success-soft text-success'
                                  : 'bg-surface-muted text-muted'
                              }`}
                            >
                              {p.status === 'paid' ? 'Paid' : 'Unpaid'}
                            </span>
                            {req.fundedPayments?.some((fp) => fp.id === p.id) ? (
                              <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-accent-soft text-accent">
                                Covered
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-warning-soft text-warning">
                                Needs funds
                              </span>
                            )}
                            <span className="mv-private-value font-bold text-main">
                              {formatPence(p.amountPence)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Completed funding is kept separate from simple balance coverage. */}
        {fundedAccountRequirements.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-[14px] font-semibold leading-5 text-success">
              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
              <span className="whitespace-nowrap">
                Funded by Transfer ({fundedAccountRequirements.length})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {fundedAccountRequirements.map(renderReadyAccountCard)}
            </div>
          </div>
        )}

        {coveredAccountRequirements.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-[14px] font-semibold leading-5 text-success">
              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
              <span className="whitespace-nowrap">
                Covered by Existing Balance ({coveredAccountRequirements.length})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {coveredAccountRequirements.map(renderReadyAccountCard)}
            </div>
          </div>
        )}

        {completedAccountRequirements.length > 0 && (
          <div className="space-y-4 pt-2">
            <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-[14px] font-semibold leading-5 text-success">
              <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
              <span className="whitespace-nowrap">
                Paid / Complete ({completedAccountRequirements.length})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {completedAccountRequirements.map(renderReadyAccountCard)}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Upcoming Scheduled Payments Roster & Inclusion Controls */}
      <div className="space-y-3 pt-5 border-t border-muted">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-main">
              Bills · {formatMonthLabel(selectedMonth)}
            </h2>
          </div>

          {!isViewOnly && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
              <button
                onClick={handleBulkIncludeUnpaid}
                className="min-w-0 px-3 py-2 text-[12px] font-medium text-muted rounded-xl bg-surface-muted border border-muted hover:bg-surface hover:shadow-sm transition-all"
              >
                Select Unpaid
              </button>
              <button
                onClick={handleBulkIncludePaid}
                className="min-w-0 px-3 py-2 text-[12px] font-medium text-muted rounded-xl bg-surface-muted border border-muted hover:bg-surface hover:shadow-sm transition-all"
              >
                Select Paid
              </button>
              <button
                onClick={handleBulkSelectAll}
                className="min-w-0 px-3 py-2 text-[12px] font-medium text-muted rounded-xl bg-surface-muted border border-muted hover:bg-surface hover:shadow-sm transition-all"
              >
                Select All
              </button>
              <button
                onClick={handleBulkDeselectAll}
                className="min-w-0 px-3 py-2 text-[12px] font-medium text-muted rounded-xl bg-surface-muted border border-muted hover:bg-surface hover:shadow-sm transition-all"
              >
                Deselect All
              </button>
            </div>
          )}
        </div>

        {/* Payments */}
        <div className="mv-card bg-surface rounded-2xl border border-muted shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
          {/* Mobile / tablet cards: everything visible without horizontal scrolling */}
          <div className="lg:hidden divide-y divide-muted">
            {monthPayments.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-subtle">
                No scheduled payments for {formatMonthLabel(selectedMonth)}
              </div>
            ) : (
              monthPayments.map((payment) => {
                const acc = accounts.find((a) => a.id === payment.accountId);
                return (
                  <article
                    key={payment.id}
                    className={`p-4 ${payment.includeInTransferPlan ? 'bg-surface' : 'bg-surface-muted'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={payment.includeInTransferPlan}
                            onChange={() => handleTogglePaymentInPlan(payment)}
                            disabled={isViewOnly}
                            title="In plan"
                            className="mt-0.5 w-4 h-4 shrink-0 text-main rounded border-muted focus:ring-muted cursor-pointer"
                          />
                          <div className="min-w-0">
                            <h3 className="text-[13px] font-semibold leading-5 text-main break-words">
                              {payment.name}
                            </h3>
                            <div className="mt-1 text-[11px] leading-4 text-muted break-words">
                              {acc ? accountIdentityLabel(acc) : payment.accountId} · {payment.dueDate || 'Flexible'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[13px] font-bold text-main whitespace-nowrap">
                          {formatPence(payment.amountPence)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <span className="inline-flex min-w-0 items-center justify-center rounded-xl bg-accent-soft px-2.5 py-2 text-[12px] font-medium text-accent">
                        {payment.responsiblePerson}
                      </span>

                      {isPaymentPaid(payment) ? (
                        <span
                          title={
                            payment.actualTransactionId
                              ? 'Payment recorded in Activity'
                              : 'Paid status recorded'
                          }
                          className="min-w-0 rounded-xl bg-success-soft px-2.5 py-2 text-center text-[12px] font-medium text-success capitalize"
                        >
                          paid
                        </span>
                      ) : (
                        <button
                          onClick={() => handlePaymentStatusAction(payment)}
                          disabled={isViewOnly}
                          title="Record payment"
                          className="min-w-0 rounded-xl bg-warning-soft px-2.5 py-2 text-[12px] font-medium text-warning transition-colors hover:bg-warning-soft capitalize"
                        >
                          unpaid
                        </button>
                      )}
                    </div>

                    {payment.notes && (
                      <div className="mt-3 text-[11px] leading-4 text-subtle break-words">
                        {payment.notes}
                      </div>
                    )}

                    {!isViewOnly && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setEditingPayment(payment)}
                          className="rounded-xl bg-surface-muted px-3 py-2 text-[12px] font-medium text-muted"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => onDeletePlannedPayment(payment.id)}
                          className="rounded-xl bg-danger-soft px-3 py-2 text-[12px] font-medium text-danger"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden lg:block">
<table className="bg-table text-main border-muted w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-muted bg-surface-muted text-[12px] font-normal text-muted">
                  <th className="pt-3 pb-4 px-4 w-12 text-center whitespace-nowrap">In Plan?</th>
                  <th className="pt-3 pb-4 px-4 whitespace-nowrap">Payment / Bill</th>
                  <th className="pt-3 pb-4 px-4 whitespace-nowrap">Payment Account</th>
                  <th className="pt-3 pb-4 px-4 whitespace-nowrap">Responsible</th>
                  <th className="pt-3 pb-4 px-4 whitespace-nowrap">Due Date</th>
                  <th className="pt-3 pb-4 px-4 text-right whitespace-nowrap">Amount</th>
                  <th className="pt-3 pb-4 px-4 text-center whitespace-nowrap">Status</th>
                  {!isViewOnly && <th className="pt-3 pb-4 px-4 text-right whitespace-nowrap">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {monthPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted text-subtle italic">
                      No scheduled payments recorded for {formatMonthLabel(selectedMonth)}.
                    </td>
                  </tr>
                ) : (
                  monthPayments.map((payment) => {
                    const acc = accounts.find((a) => a.id === payment.accountId);
                    return (
                      <tr
                        key={payment.id}
                        className={`hover:bg-surface-muted transition-colors ${
                          payment.includeInTransferPlan ? 'bg-surface' : 'bg-surface-muted opacity-70'
                        }`}
                      >
                        {/* Checkbox for Plan Inclusion */}
                        <td className="py-2.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={payment.includeInTransferPlan}
                            onChange={() => handleTogglePaymentInPlan(payment)}
                            disabled={isViewOnly}
                            title="In plan"
                            className="w-4 h-4 text-main rounded border-muted focus:ring-muted cursor-pointer"
                          />
                        </td>

                        {/* Name & Notes */}
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-main">{payment.name}</div>
                          {payment.notes && (
                            <div className="text-2xs text-muted text-subtle mt-0.5 truncate max-w-xs">
                              {payment.notes}
                            </div>
                          )}
                        </td>

                        {/* Payment Account */}
                        <td className="py-2.5 px-4">
                          <span className="font-medium text-main">
                            {acc ? accountIdentityLabel(acc) : payment.accountId}
                          </span>
                        </td>

                        {/* Responsible Person */}
                        <td className="py-2.5 px-4">
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-accent-soft text-accent">
                            {payment.responsiblePerson}
                          </span>
                        </td>

                        {/* Due Date */}
                        <td className="py-2.5 px-4 text-muted">
                          {payment.dueDate || 'Flexible'}
                        </td>

                        {/* Amount in Exact Pence */}
                        <td className="py-2.5 px-4 text-right font-bold text-main">
                          {formatPence(payment.amountPence)}
                        </td>

                        {/* Paid / Unpaid Status Toggle */}
                        <td className="py-2.5 px-4 text-center">
                          {isPaymentPaid(payment) ? (
                            <span
                              title={
                                payment.actualTransactionId
                                  ? 'Payment recorded in Activity'
                                  : 'Paid status recorded'
                              }
                              className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-success-soft text-success"
                            >
                              paid
                            </span>
                          ) : (
                            <button
                              onClick={() => handlePaymentStatusAction(payment)}
                              disabled={isViewOnly}
                              title="Record payment"
                              className="px-2.5 py-1 rounded-full text-xs font-medium transition-colors bg-warning-soft text-warning hover:bg-warning-soft"
                            >
                              unpaid
                            </button>
                          )}
                        </td>

                        {/* Edit / Delete Actions */}
                        {!isViewOnly && (
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditingPayment(payment)}
                                className="p-1 rounded text-muted text-subtle hover:text-muted hover:bg-surface-muted transition-colors"
                                title="Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeletePlannedPayment(payment.id)}
                                className="p-1 rounded text-muted text-subtle hover:text-danger hover:bg-danger-soft transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Execute Transfer Modal */}
      {fundingAccountToTransfer && (
        <ExecuteTransferModal
          fundingRequirement={fundingAccountToTransfer}
          availableSourceAccounts={accounts}
          members={members}
          reservedPlanPenceByAccountId={reservedPlanPenceByAccountId}
          onClose={() => setFundingAccountToTransfer(null)}
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
          onConfirm={(payload) => onMarkPaymentPaid(markingPayment.id, payload)}
        />
      )}

      {/* Planned Payment Modal (Add or Edit) */}
      {(isAddingPayment || editingPayment) && (
        <PlannedPaymentModal
          payment={editingPayment}
          accounts={accounts}
          categories={categories}
          members={members}
          activeMonth={selectedMonth}
          onClose={() => {
            setIsAddingPayment(false);
            setEditingPayment(null);
          }}
          onSave={async (data) => {
            if (editingPayment) {
              await onUpdatePlannedPayment(editingPayment.id, data);
            } else {
              await onCreatePlannedPayment(data);
            }
          }}
        />
      )}
    </div>
  );
};
