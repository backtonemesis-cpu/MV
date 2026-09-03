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
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* View Header with Month Filter & Quick Context */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-neutral-200 pb-5">
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

      {/* Summary KPI Cards: Mathematical & High-Contrast */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Transfer Required */}
        <div
          id="stat-transfer-required"
          className={`p-4 rounded-xl border transition-all ${
            plan.totalTransferRequiredPence > 0
              ? 'bg-amber-50/70 border-amber-200'
              : 'bg-emerald-50/70 border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                plan.totalTransferRequiredPence > 0 ? 'text-amber-800' : 'text-emerald-800'
              }`}
            >
              Total Transfer Required
            </span>
            <ArrowLeftRight
              className={`w-4 h-4 ${
                plan.totalTransferRequiredPence > 0 ? 'text-amber-600' : 'text-emerald-600'
              }`}
            />
          </div>
          <div
            className={`text-2xl font-bold mt-2 tracking-tight ${
              plan.totalTransferRequiredPence > 0 ? 'text-amber-950' : 'text-emerald-950'
            }`}
          >
            {formatPence(plan.totalTransferRequiredPence)}
          </div>
          <p className="text-xs text-neutral-600 mt-1">
            {plan.accountsNeedingFunding.length > 0
              ? `Required across ${plan.accountsNeedingFunding.length} account${
                  plan.accountsNeedingFunding.length > 1 ? 's' : ''
                }`
              : 'All accounts already have sufficient funds'}
          </p>
        </div>

        {/* Selected Payments to Fund */}
        <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Payments in Plan
            </span>
            <Layers className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 mt-2 tracking-tight">
            {formatPence(plan.totalSelectedPaymentsPence)}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            {plan.totalSelectedPaymentsCount} payment
            {plan.totalSelectedPaymentsCount !== 1 ? 's' : ''} selected across all accounts
          </p>
        </div>

        {/* Accounts Needing Funding */}
        <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Accounts Requiring Funds
            </span>
            <AlertCircle
              className={`w-4 h-4 ${
                plan.accountsNeedingFunding.length > 0 ? 'text-amber-500' : 'text-neutral-400'
              }`}
            />
          </div>
          <div className="text-2xl font-bold text-neutral-900 mt-2 tracking-tight">
            {plan.accountsNeedingFunding.length}
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            {plan.accountsFullyFunded.length} account
            {plan.accountsFullyFunded.length !== 1 ? 's' : ''} already fully funded
          </p>
        </div>

        {/* Transfer Integrity Rule */}
        <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/70 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-600 uppercase tracking-wider">
              Integrity Rule
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-sm font-semibold text-neutral-900 mt-2">
            Non-Spending Internal Transfers
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Funding movements between accounts do not alter gross household spending or income.
          </p>
        </div>
      </div>

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
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wider px-1">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span>Accounts Requiring Transfer ({plan.accountsNeedingFunding.length})</span>
            </div>

            {plan.accountsNeedingFunding.map((req) => (
              <div
                key={req.account.id}
                id={`funding-card-${req.account.id}`}
                className="bg-white rounded-xl border-2 border-amber-300 shadow-xs overflow-hidden"
              >
                {/* Account Card Header */}
                <div className="p-5 bg-amber-50/40 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-bold text-neutral-900">{req.account.name}</h3>
                      {req.account.ownerPerson && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-neutral-200 text-neutral-800">
                          {req.account.ownerPerson}
                        </span>
                      )}
                      <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-white border border-neutral-300 text-neutral-600 capitalize">
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
                <div className="p-4 bg-neutral-50/50">
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

                          <div className="flex items-center gap-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-wider ${
                                p.status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-neutral-100 text-neutral-700'
                              }`}
                            >
                              {p.status}
                            </span>
                            <span className="font-bold text-neutral-900">{formatPence(p.amountPence)}</span>
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
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-wider px-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Accounts Fully Funded — No Transfer Required ({plan.accountsFullyFunded.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plan.accountsFullyFunded.map((req) => (
              <div
                key={req.account.id}
                id={`funding-card-${req.account.id}`}
                className="bg-white rounded-xl border border-neutral-200 shadow-2xs overflow-hidden"
              >
                <div className="p-4 bg-emerald-50/40 border-b border-emerald-100 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-neutral-900">{req.account.name}</h3>
                      {req.account.ownerPerson && (
                        <span className="px-2 py-0.5 text-2xs font-semibold rounded bg-neutral-200 text-neutral-800">
                          {req.account.ownerPerson}
                        </span>
                      )}
                    </div>
                    <p className="text-2xs text-neutral-500 mt-0.5">
                      Current balance: {formatPence(req.currentBalancePence)} · Bills:{' '}
                      {formatPence(req.totalSelectedPaymentsPence)} ({req.selectedPayments.length} selected)
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      £0.00 (Covered)
                    </span>
                  </div>
                </div>

                {/* Sub-list of payments */}
                <div className="p-3 bg-neutral-50/40 text-xs">
                  {req.selectedPayments.length > 0 ? (
                    <div className="space-y-1">
                      {req.selectedPayments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between py-1 text-2xs text-neutral-600">
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={p.includeInTransferPlan}
                              onChange={() => handleTogglePaymentInPlan(p)}
                              disabled={isViewOnly}
                              className="w-3.5 h-3.5 text-neutral-900 rounded border-neutral-300 focus:ring-neutral-900 cursor-pointer"
                            />
                            <span className="font-medium text-neutral-800 truncate">{p.name}</span>
                          </div>
                          <span className="font-semibold text-neutral-900 ml-2">{formatPence(p.amountPence)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-2xs text-neutral-400 italic">No payments selected for this account</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2: Upcoming Scheduled Payments Roster & Inclusion Controls */}
      <div className="space-y-4 pt-6 border-t border-neutral-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-neutral-900">
              2. Household Scheduled Payments for {formatMonthLabel(selectedMonth)}
            </h2>
            <p className="text-xs text-neutral-500">
              Check or uncheck individual items to include or exclude them from the Transfer Plan calculation.
              Paid/Unpaid and Transfer Plan inclusion are separate controls.
            </p>
          </div>

          {!isViewOnly && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleBulkIncludeUnpaid}
                className="px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md transition-colors"
              >
                Include All Unpaid
              </button>
              <button
                onClick={handleBulkSelectAll}
                className="px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md transition-colors"
              >
                Select All
              </button>
              <button
                onClick={handleBulkDeselectAll}
                className="px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-md transition-colors"
              >
                Deselect All
              </button>
            </div>
          )}
        </div>

        {/* Payments Table */}
        <div className="bg-white rounded-xl border border-neutral-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-600 font-semibold uppercase tracking-wider text-2xs">
                  <th className="py-3 px-4 w-12 text-center">In Plan?</th>
                  <th className="py-3 px-4">Payment / Bill</th>
                  <th className="py-3 px-4">Payment Account</th>
                  <th className="py-3 px-4">Responsible</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  {!isViewOnly && <th className="py-3 px-4 text-right">Actions</th>}
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
                        <td className="py-3 px-4 text-center">
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
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-900">{payment.name}</div>
                          {payment.notes && (
                            <div className="text-2xs text-neutral-400 mt-0.5 truncate max-w-xs">
                              {payment.notes}
                            </div>
                          )}
                        </td>

                        {/* Payment Account */}
                        <td className="py-3 px-4">
                          <span className="font-medium text-neutral-800">
                            {acc ? acc.name : payment.accountId}
                          </span>
                        </td>

                        {/* Responsible Person */}
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 text-2xs font-semibold rounded-md bg-neutral-100 text-neutral-700 border border-neutral-200">
                            {payment.responsiblePerson}
                          </span>
                        </td>

                        {/* Due Date */}
                        <td className="py-3 px-4 text-neutral-600">
                          {payment.dueDate || 'Flexible'}
                        </td>

                        {/* Amount in Exact Pence */}
                        <td className="py-3 px-4 text-right font-bold text-neutral-900">
                          {formatPence(payment.amountPence)}
                        </td>

                        {/* Paid / Unpaid Status Toggle */}
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleTogglePaymentStatus(payment)}
                            disabled={isViewOnly}
                            title="Click to toggle Paid/Unpaid"
                            className={`px-2 py-0.5 rounded-full text-2xs font-semibold uppercase tracking-wider transition-colors ${
                              payment.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            }`}
                          >
                            {payment.status}
                          </button>
                        </td>

                        {/* Edit / Delete Actions */}
                        {!isViewOnly && (
                          <td className="py-3 px-4 text-right">
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
