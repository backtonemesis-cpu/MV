import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Layers,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Category, Transaction, PlannedIncome, PlannedPayment } from '../types';
import { formatPence } from '../utils/currency';

interface BudgetViewProps {
  categories: Category[];
  transactions: Transaction[];
  plannedIncomes?: PlannedIncome[];
  plannedPayments?: PlannedPayment[];
  selectedMonth?: string;
  availableMonths?: string[];
  onSelectMonth?: (month: string) => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({
  categories,
  transactions,
  plannedIncomes = [],
  plannedPayments = [],
  selectedMonth: propSelectedMonth,
  availableMonths = ['2026-09', '2026-10'],
  onSelectMonth,
}) => {
  const [internalSelectedMonth, setInternalSelectedMonth] = useState('2026-09');
  const activeMonth = propSelectedMonth || internalSelectedMonth;

  const handleMonthChange = (month: string) => {
    if (onSelectMonth) {
      onSelectMonth(month);
    } else {
      setInternalSelectedMonth(month);
    }
  };

  // Filter transactions for the selected month
  const monthTransactions = useMemo(() => {
    return transactions.filter((tx) => tx.date.startsWith(activeMonth));
  }, [transactions, activeMonth]);

  // Planned incomes for the month
  const monthPlannedIncomes = useMemo(() => {
    return plannedIncomes.filter((i) => i.month === activeMonth);
  }, [plannedIncomes, activeMonth]);

  // Planned payments for the month
  const monthPlannedPayments = useMemo(() => {
    return plannedPayments.filter((p) => p.month === activeMonth);
  }, [plannedPayments, activeMonth]);

  // Received this month
  const actualIncomePence = useMemo(() => {
    return monthTransactions
      .filter((tx) => tx.type === 'income' && !tx.isTransfer && !tx.isSavings)
      .reduce((sum, tx) => sum + tx.amountPence, 0);
  }, [monthTransactions]);

  const totalExpectedIncomePence = useMemo(() => {
    return monthPlannedIncomes.reduce((sum, i) => sum + i.expectedAmountPence, 0);
  }, [monthPlannedIncomes]);

  // Calculate spending per category (accounting for splits and refunds)
  const categorySpendMap = useMemo(() => {
    const map = new Map<string, number>();

    monthTransactions.forEach((tx) => {
      // Non-spending transfers, repayments, and savings don't count toward living budget
      if (tx.isTransfer || tx.isRepayment || tx.isSavings) return;

      if (tx.type === 'expense') {
        if (tx.splits && tx.splits.length > 0) {
          // Attribute by split category
          tx.splits.forEach((split) => {
            const current = map.get(split.categoryId) || 0;
            map.set(split.categoryId, current + split.amountPence);
          });
        } else {
          const current = map.get(tx.categoryId) || 0;
          map.set(tx.categoryId, current + tx.amountPence);
        }
      } else if (tx.type === 'refund' || tx.isRefund) {
        // Refunds restore available budget in that category
        const current = map.get(tx.categoryId) || 0;
        map.set(tx.categoryId, Math.max(0, current - tx.amountPence));
      }
    });

    return map;
  }, [monthTransactions]);

  // Group categories excluding Income
  const groupedCategories = useMemo(() => {
    const groups: { [key: string]: Category[] } = {};
    categories.forEach((cat) => {
      if (cat.group === 'Income') return;
      if (!groups[cat.group]) groups[cat.group] = [];
      groups[cat.group].push(cat);
    });
    return groups;
  }, [categories]);

  const totalBudgetedPence = useMemo(() => {
    return categories
      .filter((c) => c.group !== 'Income')
      .reduce((sum, c) => sum + c.monthlyBudgetPence, 0);
  }, [categories]);

  const totalActualLivingPence = useMemo(() => {
    return Array.from(categorySpendMap.values()).reduce((sum, v) => sum + v, 0);
  }, [categorySpendMap]);

  return (
    <div className="space-y-6 pb-12">
      {/* Month Period Selector Header */}
      <div className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Period
            </span>
            <select
              value={activeMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
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

        <div className="flex items-center gap-4 text-xs font-medium text-neutral-600 dark:text-neutral-300">
          <span>{monthTransactions.length} transactions</span>
          <span>•</span>
          <span>{monthPlannedPayments.length} bills</span>
        </div>
      </div>

      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Planned vs Actual Income */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Income ({activeMonth})
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-2">
            {formatPence(actualIncomePence)}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {totalExpectedIncomePence > 0
              ? `Expected: ${formatPence(totalExpectedIncomePence)}`
              : 'Actual income received'}
          </div>
        </div>

        {/* Total Budgeted Envelopes */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Budget
            </span>
            <Layers className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-black text-neutral-900 dark:text-neutral-100 mt-2">
            {formatPence(totalBudgetedPence)}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {categories.filter((c) => c.group !== 'Income').length} categories
          </div>
        </div>

        {/* Total Actual Living Spend */}
        <div className="p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
              Living Spend
            </span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div
            className={`text-2xl font-black mt-2 ${
              totalActualLivingPence > totalBudgetedPence
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {formatPence(totalActualLivingPence)}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {totalBudgetedPence >= totalActualLivingPence
              ? `${formatPence(totalBudgetedPence - totalActualLivingPence)} under envelope`
              : `Over by ${formatPence(totalActualLivingPence - totalBudgetedPence)}`}
          </div>
        </div>
      </div>

      {/* Planned Income Envelopes Section */}
      {monthPlannedIncomes.length > 0 && (
        <div className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">
                Planned Income
              </h2>
            </div>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
              Total Expected: {formatPence(totalExpectedIncomePence)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthPlannedIncomes.map((inc) => (
              <div
                key={inc.id}
                className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-750 border border-neutral-200 dark:border-neutral-700"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    {inc.name}
                  </span>
                  <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                    {formatPence(inc.expectedAmountPence)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                  <span className="px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium">
                    {inc.sourcePerson}
                  </span>
                  {inc.expectedDate && <span>Expected: {inc.expectedDate}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grouped Category Envelopes */}
      <div className="space-y-6">
        {Object.entries(groupedCategories).map(([groupName, cats]) => (
          <div
            key={groupName}
            className="bg-white dark:bg-neutral-800 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs"
          >
            <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-wider mb-4">
              {groupName}
            </h2>

            <div className="space-y-4">
              {cats.map((cat) => {
                const spent = categorySpendMap.get(cat.id) || 0;
                const budget = cat.monthlyBudgetPence;
                const percent = budget > 0 ? Math.round((spent / budget) * 100) : 0;
                const isOver = budget > 0 && spent > budget;

                return (
                  <div
                    key={cat.id}
                    className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-750 border border-neutral-100 dark:border-neutral-700"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {cat.name}
                      </span>
                      <div className="text-xs">
                        <span
                          className={`font-bold ${
                            isOver
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-neutral-900 dark:text-neutral-100'
                          }`}
                        >
                          {formatPence(spent)}
                        </span>
                        <span className="text-neutral-500 dark:text-neutral-400">
                          {' '}
                          / {formatPence(budget)}
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full ${
                          isOver ? 'bg-rose-500' : percent > 85 ? 'bg-amber-500' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-neutral-500 dark:text-neutral-400 mt-1.5">
                      <span>{percent}% used</span>
                      {isOver ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">
                          Over by {formatPence(spent - budget)}
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                          {formatPence(budget - spent)} remaining
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
