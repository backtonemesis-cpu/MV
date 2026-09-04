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
} from '../types';
import { formatPence } from '../utils/currency';
import { generateTransferPlan, formatMonthLabel } from '../utils/transferPlan';
import { ExecuteTransferModal } from './ExecuteTransferModal';
import { PlannedPaymentModal } from './PlannedPaymentModal';

interface TransferPlanViewProps {
  accounts: Account[];
  categories: Category[];
  plannedPayments: PlannedPayment[];
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
    if (isViewOnly) return;
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
        onlyUnpaid: true,
      });
    } catch (err: any) {
      console.error('Failed to bulk include unpaid', err);
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-neutral-900 tracking-tight">Monthly Transfer Plan</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-neutral-100 text-neutral-800 border border-neutral-200">
              {formatMonthLabel(selectedMonth)}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-1 max-w-2xl">
            Calculates the exact amount of money that needs to be transferred into each payment account
            so your selected upcoming household bills are fully funded at the start of the month.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg p-1 shadow-2xs">
            <Calendar className="w-4 h-4 text-neutral-400 ml-2" />
            <select
              id="transfer-plan-month-select"
              value={selectedMonth}
              onChange={(e) => handleSelectMonth(e.target.value)}
              className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 bg-transparent pr-3 py-1 focus:outline-none cursor-pointer"
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
              className="px-3 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-750 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
              title="Copy recurring bills into a new month"
            >
              <Layers className="w-3.5 h-3.5 text-neutral-500" />
              <span>Copy Bills</span>
            </button>
          )}

          {!isViewOnly && (
            <button
              id="add-planned-payment-button"
              onClick={() => setIsAddingPayment(true)}
              className="px-3 py-2 text-xs font-medium text-white bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Bill / Payment</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Summary Metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <article
          id="stat-transfer-required"
          className="min-w-0 rounded-2xl border border-[#f1f5f9] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)]"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium leading-5 text-[#64748b] dark:text-neutral-400">
              Total Transfer Required
            </span>
            <ArrowLeftRight
              className={`w-4 h-4 shrink-0 ${
                plan.totalTransferRequiredPence > 0 ? 'text-amber-500' : 'text-emerald-600'
              }`}
            />
          </div>
          <div
            className={`mt-2 text-2xl font-bold tracking-tight ${
              plan.totalTransferRequiredPence > 0
                ? 'text-amber-950 dark:text-amber-200'
                : 'text-slate-950 dark:text-white'
            }`}
          >
            {formatPence(plan.totalTransferRequiredPence)}
          </div>
          <p className="mt-1 text-sm leading-5 text-[#64748b] dark:text-neutral-400">
            {plan.accountsNeedingFunding.length > 0
              ? `${plan.accountsNeedingFunding.length} account${
                  plan.accountsNeedingFunding.length !== 1 ? 's' : ''
                } need funding`
              : 'All accounts sufficiently funded'}
          </p>
        </article>

        <article className="min-w-0 rounded-2xl border border-[#f1f5f9] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium leading-5 text-[#64748b] dark:text-neutral-400">
              Payments in Plan
            </span>
            <Layers className="w-4 h-4 shrink-0 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            {formatPence(plan.totalSelectedPaymentsPence)}
          </div>
          <p className="mt-1 text-sm leading-5 text-[#64748b] dark:text-neutral-400">
            {plan.totalSelectedPaymentsCount} payment
            {plan.totalSelectedPaymentsCount !== 1 ? 's' : ''} selected
          </p>
        </article>

        <article className="min-w-0 rounded-2xl border border-[#f1f5f9] dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium leading-5 text-[#64748b] dark:text-neutral-400">
              Accounts Requiring Funds
            </span>
            <AlertCircle
              className={`w-4 h-4 shrink-0 ${
                plan.accountsNeedingFunding.length > 0 ? 'text-amber-500' : 'text-slate-400'
              }`}
            />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
            {plan.accountsNeedingFunding.length}
          </div>
          <p className="mt-1 text-sm leading-5 text-[#64748b] dark:text-neutral-400">
            {plan.accountsFullyFunded.length} fully funded
          </p>
        </article>

        <article className="min-w-0 rounded-2xl border border-[#f1f5f9] dark:border-neutral-800 bg-blue-50/70 dark:bg-blue-950/20 p-4 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium leading-5 text-blue-800 dark:text-blue-200">
              Transfer Safety Rule
            </span>
            <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-300" />
          </div>
          <div className="mt-2 text-sm font-semibold leading-5 text-blue-950 dark:text-blue-100">
            Internal transfers are not spending
          </div>
          <p className="mt-1 text-sm leading-5 text-blue-800/80 dark:text-blue-200/80">
            Funding moves do not change household income or gross spending.
          </p>
        </article>
      </section>

      {/* SECTION 1: Account Funding Requirements (The Primary Purpose) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              1. Account Funding Analysis ({formatMonthLabel(selectedMonth)})
            </h2>
            <p className="text-xs text-neutral-500">
              Exact calculations showing which accounts need funding, available balances, and exact required transfers.
            </p>
          </div>
        </div>

        {/* Accounts Needing Funding First */}
        {plan.accountsNeedingFunding.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300 px-1">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Accounts Requiring Transfer ({plan.accountsNeedingFunding.length})</span>
            </div>

            {plan.accountsNeedingFunding.map((req) => (
              <div
                key={req.account.id}
                id={`funding-card-${req.account.id}`}
                className="bg-white dark:bg-neutral-900 rounded-2xl border border-[#f1f5f9] dark:border-neutral-800 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)] overflow-hidden"
              >
                {/* Account Card Header */}
                <div className="p-4 sm:p-5 bg-white dark:bg-neutral-900 border-b border-[#f1f5f9] dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-neutral-900">{req.account.name}</h3>
                      {req.account.ownerPerson && (
                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                          {req.account.ownerPerson}
                        </span>
                      )}
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300 capitalize">
                        {req.account.type}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-600 mt-1">
                      {req.selectedPayments.length} upcoming bill
                      {req.selectedPayments.length !== 1 ? 's' : ''} selected for this account
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs font-medium text-amber-800 uppercase tracking-wider block">
                        Transfer Required
                      </span>
                      <span className="text-xl font-extrabold text-amber-950">
                        {formatPence(req.transferRequiredPence)}
                      </span>
                    </div>

                    {!isViewOnly && (
                      <button
                        id={`btn-transfer-${req.account.id}`}
                        onClick={() => setFundingAccountToTransfer(req)}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                      >
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Transfer Funds</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 4-Column Exact Financial Breakdown per Handoff Specification */}
                <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-neutral-200 bg-white border-b border-neutral-100 text-xs">
                  <div className="p-4">
                    <span className="text-neutral-500 font-medium block">Current / Reconciled Balance</span>
                    <span className="text-sm font-bold text-neutral-900 mt-1 block">
                      {formatPence(req.currentBalancePence)}
                    </span>
                  </div>

                  <div className="p-4">
                    <span className="text-neutral-500 font-medium block">Payments Selected for Plan</span>
                    <span className="text-sm font-bold text-neutral-900 mt-1 block">
                      {formatPence(req.totalSelectedPaymentsPence)}
                    </span>
                  </div>

                  <div className="p-4">
                    <span className="text-neutral-500 font-medium block">Amount Already Available</span>
                    <span className="text-sm font-bold text-neutral-900 mt-1 block">
                      {formatPence(req.amountAvailablePence)}
                    </span>
                  </div>

                  <div className="p-4 bg-amber-50/30">
                    <span className="text-amber-800 font-semibold block">Exact Transfer Required</span>
                    <span className="text-sm font-extrabold text-amber-900 mt-1 block">
                      {formatPence(req.transferRequiredPence)}
                    </span>
                  </div>
                </div>

                {/* Selected upcoming payments that create this requirement */}
                <div className="p-4 bg-slate-50/70 dark:bg-neutral-950/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-neutral-700">
                      Selected upcoming payments creating this funding requirement:
                    </span>
                    <button
                      onClick={() => toggleAccountExpand(req.account.id)}
                      className="text-xs text-neutral-500 hover:text-neutral-800 flex items-center gap-1 transition-colors"
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
                          className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-neutral-200 text-xs hover:border-neutral-300 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={p.includeInTransferPlan}
                              onChange={() => handleTogglePaymentInPlan(p)}
                              disabled={isViewOnly}
                              title="Include or exclude from Transfer Plan"
                              className="w-4 h-4 text-neutral-900 rounded border-neutral-300 focus:ring-neutral-900 cursor-pointer"
                            />
                            <div>
                              <span className="font-semibold text-neutral-900">{p.name}</span>
                              <span className="text-neutral-500 ml-2">
                                Due: {p.dueDate || 'Flexible'} · Responsible: {p.responsiblePerson}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {p.status === 'paid' ? (
                              <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Paid (Fulfilled)
                              </span>
                            ) : req.fundedPayments?.some((fp) => fp.id === p.id) ? (
                              <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800">
                                Funded by Cash
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                                Needs Transfer
                              </span>
                            )}
                            <span className={`font-bold ${p.status === 'paid' ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}>
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
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300 px-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Accounts Fully Funded — No Transfer Required ({plan.accountsFullyFunded.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {plan.accountsFullyFunded.map((req) => (
              <article
                key={req.account.id}
                id={`funding-card-${req.account.id}`}
                className="bg-white dark:bg-neutral-900 rounded-2xl border border-[#f1f5f9] dark:border-neutral-800 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)] overflow-hidden"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold tracking-tight text-slate-950 dark:text-white">
                          {req.account.name}
                        </h3>
                        {req.account.ownerPerson && (
                          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                            {req.account.ownerPerson}
                          </span>
                        )}
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300 capitalize">
                          {req.account.type}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full bg-[#e6f4ea] text-[#137333] dark:bg-emerald-950/60 dark:text-emerald-200">
                        Covered
                      </span>
                      <div className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-neutral-400">
                        No transfer required
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="text-xs font-medium text-slate-500 dark:text-neutral-400">
                      Current balance
                    </div>
                    <div className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">
                      {formatPence(req.currentBalancePence)}
                    </div>

                    <div className="mt-3 rounded-xl bg-[#f8fafc] dark:bg-neutral-800/70 px-3.5 py-2.5 text-[13px] font-medium text-[#64748b] dark:text-neutral-300">
                      Available: {formatPence(req.amountAvailablePence)} <span aria-hidden="true">•</span> Bills:{' '}
                      {formatPence(req.totalSelectedPaymentsPence)} <span aria-hidden="true">•</span>{' '}
                      {req.selectedPayments.length} selected
                    </div>
                  </div>

                  <div className="mt-5">
                    {req.selectedPayments.length > 0 ? (
                      <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-950/40 px-4 py-2">
                        <div className="divide-y divide-slate-200/80 dark:divide-neutral-800">
                          {req.selectedPayments.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={p.includeInTransferPlan}
                                  onChange={() => handleTogglePaymentInPlan(p)}
                                  disabled={isViewOnly}
                                  className="w-3.5 h-3.5 text-neutral-900 rounded border-neutral-300 focus:ring-neutral-900 cursor-pointer"
                                />
                                <span className="font-semibold text-slate-800 dark:text-neutral-200 truncate">
                                  {p.name}
                                </span>
                              </div>
                              <span className="font-bold text-slate-950 dark:text-white shrink-0">
                                {formatPence(p.amountPence)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 dark:border-neutral-700 bg-[#f8fafc] dark:bg-neutral-800/60 px-4 py-4 text-center">
                        <span className="text-[13px] font-medium text-[#64748b] dark:text-neutral-400">
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
      <div className="space-y-3 pt-5 border-t border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              2. Household Scheduled Payments for {formatMonthLabel(selectedMonth)}
            </h2>
            <p className="mt-1 text-sm leading-5 text-[#64748b] dark:text-neutral-400">
              Select which payments feed the transfer calculation. Paid status and plan inclusion remain separate.
            </p>
          </div>

          {!isViewOnly && (
            <div className="max-w-full overflow-x-auto">
              <div className="inline-flex min-w-max items-center gap-1 rounded-full border border-[#f1f5f9] dark:border-neutral-800 bg-[#f8fafc] dark:bg-neutral-900 p-1">
                <button
                  onClick={handleBulkIncludeUnpaid}
                  className="px-3.5 py-1.5 text-[13px] font-medium text-slate-700 dark:text-neutral-200 rounded-full hover:bg-white dark:hover:bg-neutral-800 hover:shadow-sm transition-all"
                >
                  Include All Unpaid
                </button>
                <button
                  onClick={handleBulkSelectAll}
                  className="px-3.5 py-1.5 text-[13px] font-medium text-slate-700 dark:text-neutral-200 rounded-full hover:bg-white dark:hover:bg-neutral-800 hover:shadow-sm transition-all"
                >
                  Select All
                </button>
                <button
                  onClick={handleBulkDeselectAll}
                  className="px-3.5 py-1.5 text-[13px] font-medium text-slate-700 dark:text-neutral-200 rounded-full hover:bg-white dark:hover:bg-neutral-800 hover:shadow-sm transition-all"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Payments Table */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-[#f1f5f9] dark:border-neutral-800 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-neutral-800 bg-slate-50/70 dark:bg-neutral-950/40 text-[12px] font-normal text-[#64748b] dark:text-neutral-400">
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
              <tbody className="divide-y divide-neutral-100">
                {monthPayments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-neutral-400 italic">
                      No scheduled payments recorded for {formatMonthLabel(selectedMonth)}.
                    </td>
                  </tr>
                ) : (
                  monthPayments.map((payment) => {
                    const acc = accounts.find((a) => a.id === payment.accountId);
                    return (
                      <tr
                        key={payment.id}
                        className={`hover:bg-neutral-50/70 transition-colors ${
                          payment.includeInTransferPlan ? 'bg-white' : 'bg-neutral-50/40 opacity-70'
                        }`}
                      >
                        {/* Checkbox for Plan Inclusion */}
                        <td className="py-2.5 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={payment.includeInTransferPlan}
                            onChange={() => handleTogglePaymentInPlan(payment)}
                            disabled={isViewOnly}
                            title="Toggle inclusion in Transfer Plan"
                            className="w-4 h-4 text-neutral-900 rounded border-neutral-300 focus:ring-neutral-900 cursor-pointer"
                          />
                        </td>

                        {/* Name & Notes */}
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-neutral-900">{payment.name}</div>
                          {payment.notes && (
                            <div className="text-2xs text-neutral-400 mt-0.5 truncate max-w-xs">
                              {payment.notes}
                            </div>
                          )}
                        </td>

                        {/* Payment Account */}
                        <td className="py-2.5 px-4">
                          <span className="font-medium text-neutral-800">
                            {acc ? acc.name : payment.accountId}
                          </span>
                        </td>

                        {/* Responsible Person */}
                        <td className="py-2.5 px-4">
                          <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                            {payment.responsiblePerson}
                          </span>
                        </td>

                        {/* Due Date */}
                        <td className="py-2.5 px-4 text-neutral-600">
                          {payment.dueDate || 'Flexible'}
                        </td>

                        {/* Amount in Exact Pence */}
                        <td className="py-2.5 px-4 text-right font-bold text-neutral-900">
                          {formatPence(payment.amountPence)}
                        </td>

                        {/* Paid / Unpaid Status Toggle */}
                        <td className="py-2.5 px-4 text-center">
                          <button
                            onClick={() => handleTogglePaymentStatus(payment)}
                            disabled={isViewOnly}
                            title="Click to toggle Paid/Unpaid"
                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                              payment.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200'
                                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200'
                            }`}
                          >
                            {payment.status}
                          </button>
                        </td>

                        {/* Edit / Delete Actions */}
                        {!isViewOnly && (
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditingPayment(payment)}
                                className="p-1 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                                title="Edit payment details"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDeletePlannedPayment(payment.id)}
                                className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Delete payment"
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
