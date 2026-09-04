import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  Plus,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Edit2,
  Trash2,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import {
  Account,
  Category,
  PlannedPayment,
  UserRole,
  AccountFundingRequirement,
  HouseholdMember,
} from '../types';
import { formatPence } from '../utils/currency';
import { generateTransferPlan, formatMonthLabel } from '../utils/transferPlan';
import { ExecuteTransferModal } from './ExecuteTransferModal';
import { PlannedPaymentModal } from './PlannedPaymentModal';

interface TransferPlanViewProps {
  accounts: Account[];
  categories: Category[];
  plannedPayments: PlannedPayment[];
  members: HouseholdMember[];
  userRole: UserRole;
  currentVersion: number;
  selectedMonth?: string;
  onSelectMonth?: (month: string) => void;
  onOpenMonthImport?: () => void;
  onCreatePlannedPayment: (data: Partial<PlannedPayment>) => Promise<void>;
  onUpdatePlannedPayment: (id: string, data: Partial<PlannedPayment>) => Promise<void>;
  onDeletePlannedPayment: (id: string) => Promise<void>;
  onBulkTogglePlannedPayments: (params: {
    month?: string;
    include: boolean;
    onlyUnpaid?: boolean;
    status?: 'paid' | 'unpaid';
    paymentIds?: string[];
  }) => Promise<void>;
  onExecuteTransfer: (payload: {
    sourceAccountId: string;
    destinationAccountId: string;
    amountPence: number;
    description: string;
    date: string;
    payer: string;
  }) => Promise<void>;
}

export const TransferPlanView: React.FC<TransferPlanViewProps> = ({
  accounts,
  categories,
  plannedPayments,
  members,
  userRole,
  currentVersion,
  selectedMonth: propSelectedMonth,
  onSelectMonth: propOnSelectMonth,
  onOpenMonthImport,
  onCreatePlannedPayment,
  onUpdatePlannedPayment,
  onDeletePlannedPayment,
  onBulkTogglePlannedPayments,
  onExecuteTransfer,
}) => {
  const isViewOnly = userRole === 'view_only';

  // Available billing months derived from payments, defaulting to current '2026-09'
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    monthsSet.add('2026-09');
    monthsSet.add('2026-10');
    for (const p of plannedPayments) {
      if (p.month) monthsSet.add(p.month);
    }
    return Array.from(monthsSet).sort();
  }, [plannedPayments]);

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
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [expandedAccountIds, setExpandedAccountIds] = useState<Record<string, boolean>>({
    'acc-marius-current': true,
    'acc-joint-current': true,
    'acc-vesta-current': true,
  });

  // Generate authoritative Transfer Plan with exact integer-pence math
  const plan = useMemo(() => {
    return generateTransferPlan(accounts, plannedPayments, selectedMonth);
  }, [accounts, plannedPayments, selectedMonth]);

  // Filtered payments for the selected month
  const monthPayments = useMemo(() => {
    return plannedPayments.filter((p) => p.month === selectedMonth);
  }, [plannedPayments, selectedMonth]);

  const isPaymentPaid = (payment: PlannedPayment) =>
    payment.status === 'paid' || Boolean(payment.actualTransactionId);

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

  const handleTogglePaymentStatus = async (payment: PlannedPayment) => {
    if (isViewOnly || payment.actualTransactionId) return;
    const newStatus = payment.status === 'unpaid' ? 'paid' : 'unpaid';
    try {
      await onUpdatePlannedPayment(payment.id, {
        status: newStatus,
      });
    } catch (err: any) {
      console.error('Failed to toggle status', err);
    }
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
          <div className="col-span-2 flex min-w-0 items-center gap-1.5 bg-surface border border-muted rounded-xl p-1 shadow-2xs">
            <Calendar className="w-4 h-4 shrink-0 text-muted text-subtle ml-2" />
            <select
              id="transfer-plan-month-select"
              value={selectedMonth}
              onChange={(e) => handleSelectMonth(e.target.value)}
              className="w-full min-w-0 text-xs font-semibold text-main bg-transparent pr-3 py-1 focus:outline-none cursor-pointer"
            >
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </div>

          {onOpenMonthImport && !isViewOnly && (
            <button
              onClick={onOpenMonthImport}
              className="min-w-0 px-3 py-2 text-xs font-medium text-muted bg-surface border border-muted hover:bg-surface-muted rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-colors"
              title="Copy bills"
            >
              <Layers className="w-3.5 h-3.5 shrink-0 text-muted text-subtle" />
              <span>Copy Bills</span>
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
          className="min-w-0 rounded-2xl border border-muted bg-surface p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)]"
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
            className={`mt-2 text-2xl font-bold tracking-tight ${
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
              : 'All accounts sufficiently funded'}
          </p>
        </article>

        <article className="min-w-0 rounded-2xl border border-muted bg-surface p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium leading-5 text-muted">
              Payments in Plan
            </span>
            <Layers className="w-4 h-4 shrink-0 text-subtle" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-main">
            {formatPence(plan.totalSelectedPaymentsPence)}
          </div>
          <p className="mt-1 text-sm leading-5 text-muted">
            {plan.totalSelectedPaymentsCount} unpaid payment
            {plan.totalSelectedPaymentsCount !== 1 ? 's' : ''} selected
          </p>
        </article>

        <article className="min-w-0 rounded-2xl border border-muted bg-surface p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)]">
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
          <div className="mt-2 text-2xl font-bold tracking-tight text-main">
            {plan.accountsNeedingFunding.length}
          </div>
          <p className="mt-1 text-sm leading-5 text-muted">
            {plan.accountsFullyFunded.length} fully funded
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
                className="bg-surface rounded-2xl border border-muted shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)] overflow-hidden"
              >
                {/* Account Card Header */}
                <div className="p-4 sm:p-5 bg-surface border-b border-muted flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-main">{req.account.name}</h3>
                      {req.account.ownerPerson && (
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-accent-soft text-accent">
                          {req.account.ownerPerson}
                        </span>
                      )}
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-surface-muted text-muted capitalize">
                        {req.account.type}
                      </span>
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {req.selectedPayments.length} selected
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-medium text-warning uppercase tracking-wider block">
                        Transfer Required
                      </span>
                      <span className="text-xl font-extrabold text-warning">
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
                        <span>Transfer Funds</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 4-Column Exact Financial Breakdown per Handoff Specification */}
                <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-muted bg-surface border-b border-muted text-xs">
                  <div className="p-4">
                    <span className="text-muted text-subtle font-medium block">Balance</span>
                    <span className="text-sm font-bold text-main mt-1 block">
                      {formatPence(req.currentBalancePence)}
                    </span>
                  </div>

                  <div className="p-4">
                    <span className="text-muted text-subtle font-medium block">Selected Bills</span>
                    <span className="text-sm font-bold text-main mt-1 block">
                      {formatPence(req.totalSelectedPaymentsPence)}
                    </span>
                  </div>

                  <div className="p-4">
                    <span className="text-muted text-subtle font-medium block">Available</span>
                    <span className="text-sm font-bold text-main mt-1 block">
                      {formatPence(req.amountAvailablePence)}
                    </span>
                  </div>

                  <div className="p-4 bg-warning-soft">
                    <span className="text-warning font-semibold block">Transfer Required</span>
                    <span className="text-sm font-extrabold text-warning mt-1 block">
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
                            {p.status === 'paid' ? (
                              <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-success-soft text-success flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Paid
                              </span>
                            ) : req.fundedPayments?.some((fp) => fp.id === p.id) ? (
                              <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-accent-soft text-accent">
                                Funded
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-warning-soft text-warning">
                                Needs funds
                              </span>
                            )}
                            <span className={`font-bold ${p.status === 'paid' ? 'text-muted text-subtle line-through' : 'text-main'}`}>
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

        {/* Fully Funded Accounts (Transfer Required = £0.00) */}
        <div className="space-y-4 pt-2">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-[14px] font-semibold leading-5 text-success">
            <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
            <span className="whitespace-nowrap">Accounts Fully Funded ({plan.accountsFullyFunded.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {plan.accountsFullyFunded.map((req) => (
              <article
                key={req.account.id}
                id={`funding-card-${req.account.id}`}
                className="bg-surface rounded-2xl border border-muted shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)] overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold tracking-tight text-main">
                          {req.account.name}
                        </h3>
                        {req.account.ownerPerson && (
                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-accent-soft text-accent">
                            {req.account.ownerPerson}
                          </span>
                        )}
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-surface-muted text-muted capitalize">
                          {req.account.type}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-success-soft text-success">
                        Covered
                      </span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-xs font-medium text-muted text-subtle">
                      Current balance
                    </div>
                    <div className="mt-1 text-2xl font-extrabold tracking-tight text-main">
                      {formatPence(req.currentBalancePence)}
                    </div>

                    <div className="mt-3 rounded-xl bg-surface-muted px-3.5 py-2.5 text-[13px] font-medium text-muted">
                      Available: {formatPence(req.amountAvailablePence)} <span aria-hidden="true">•</span> Bills:{' '}
                      {formatPence(req.totalSelectedPaymentsPence)} <span aria-hidden="true">•</span>{' '}
                      {req.selectedPayments.length} selected
                    </div>
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
                              <span className="font-bold text-main shrink-0">
                                {formatPence(p.amountPence)}
                              </span>
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
            ))}
          </div>
        </div>
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
        <div className="bg-surface rounded-2xl border border-muted shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
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
                              {acc ? `${acc.name} (${acc.ownerPerson || acc.type})` : payment.accountId} · {payment.dueDate || 'Flexible'}
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

                      <button
                        onClick={() => handleTogglePaymentStatus(payment)}
                        disabled={isViewOnly || Boolean(payment.actualTransactionId)}
                        title={payment.actualTransactionId ? 'Paid status is locked by a recorded transaction' : 'Status'}
                        className={`min-w-0 rounded-xl px-2.5 py-2 text-[12px] font-medium transition-colors capitalize ${
                          isPaymentPaid(payment)
                            ? 'bg-success-soft text-success hover:bg-success-soft'
                            : 'bg-warning-soft text-warning hover:bg-warning-soft'
                        }`}
                      >
                        {isPaymentPaid(payment) ? 'paid' : 'unpaid'}
                      </button>
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
                            {acc ? `${acc.name} (${acc.ownerPerson || acc.type})` : payment.accountId}
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
                          <button
                            onClick={() => handleTogglePaymentStatus(payment)}
                            disabled={isViewOnly}
                            title="Status"
                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                              payment.status === 'paid'
                                ? 'bg-success-soft text-success hover:bg-success-soft'
                                : 'bg-warning-soft text-warning hover:bg-warning-soft'
                            }`}
                          >
                            {isPaymentPaid(payment) ? 'paid' : 'unpaid'}
                          </button>
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
          onClose={() => setFundingAccountToTransfer(null)}
          onExecute={onExecuteTransfer}
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
