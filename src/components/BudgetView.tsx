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
import { MonthPicker } from './MonthPicker';

interface BudgetViewProps {
  categories: Category[];
  transactions: Transaction[];
  plannedIncomes?: PlannedIncome[];
  plannedPayments?: PlannedPayment[];
  selectedMonth?: string;
  onSelectMonth?: (month: string) => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({
  categories,
  transactions,
  plannedIncomes = [],
  plannedPayments = [],
  selectedMonth: propSelectedMonth,
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
      <div className="bg-surface p-4 rounded-2xl border border-muted shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-success-soft text-success flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted text-subtle uppercase tracking-wider">
              Period
            </span>
            <MonthPicker
              value={activeMonth}
              onChange={handleMonthChange}
              ariaLabel="Budget month"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-muted">
          <span>{monthTransactions.length} transactions</span>
          <span>•</span>
          <span>{monthPlannedPayments.length} bills</span>
        </div>
      </div>

      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Planned vs Actual Income */}
        <div className="p-5 rounded-2xl bg-surface border border-muted shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted text-subtle uppercase tracking-wider">
              Income ({activeMonth})
            </span>
            <TrendingUp className="w-4 h-4 text-success" />
          </div>
          <div className="text-2xl font-black text-main mt-2">
            {formatPence(actualIncomePence)}
          </div>
          <div className="text-xs text-muted text-subtle mt-1">
            {totalExpectedIncomePence > 0
              ? `Expected: ${formatPence(totalExpectedIncomePence)}`
              : 'Actual income received'}
          </div>
        </div>

        {/* Total Budgeted Envelopes */}
        <div className="p-5 rounded-2xl bg-surface border border-muted shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted text-subtle uppercase tracking-wider">
              Budget
            </span>
            <Layers className="w-4 h-4 text-accent" />
          </div>
          <div className="text-2xl font-black text-main mt-2">
            {formatPence(totalBudgetedPence)}
          </div>
          <div className="text-xs text-muted text-subtle mt-1">
            {categories.filter((c) => c.group !== 'Income').length} categories
          </div>
        </div>

        {/* Total Actual Living Spend */}
        <div className="p-5 rounded-2xl bg-surface border border-muted shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted text-subtle uppercase tracking-wider">
              Living Spend
            </span>
            <Clock className="w-4 h-4 text-warning" />
          </div>
          <div
            className={`text-2xl font-black mt-2 ${
              totalActualLivingPence > totalBudgetedPence
                ? 'text-danger'
                : 'text-success'
            }`}
          >
            {formatPence(totalActualLivingPence)}
          </div>
          <div className="text-xs text-muted text-subtle mt-1">
            {totalBudgetedPence >= totalActualLivingPence
              ? `${formatPence(totalBudgetedPence - totalActualLivingPence)} under envelope`
              : `Over by ${formatPence(totalActualLivingPence - totalBudgetedPence)}`}
          </div>
        </div>
      </div>

      {/* Planned Income Envelopes Section */}
      {monthPlannedIncomes.length > 0 && (
        <div className="bg-surface p-5 rounded-2xl border border-muted shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-main uppercase tracking-wider">
                Planned Income
              </h2>
            </div>
            <span className="text-xs font-bold text-success">
              Total Expected: {formatPence(totalExpectedIncomePence)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {monthPlannedIncomes.map((inc) => (
              <div
                key={inc.id}
                className="p-3.5 rounded-xl bg-surface-muted border border-muted"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-main">
                    {inc.name}
                  </span>
                  <span className="text-xs font-extrabold text-success">
                    {formatPence(inc.expectedAmountPence)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[11px] text-muted text-subtle">
                  <span className="px-1.5 py-0.2 rounded bg-surface-muted text-main font-medium">
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
            className="bg-surface p-5 rounded-2xl border border-muted shadow-xs"
          >
            <h2 className="text-sm font-bold text-main uppercase tracking-wider mb-4">
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
                    className="p-3.5 rounded-xl bg-surface-muted border border-muted"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-main">
                        {cat.name}
                      </span>
                      <div className="text-xs">
                        <span
                          className={`font-bold ${
                            isOver
                              ? 'text-danger'
                              : 'text-main'
                          }`}
                        >
                          {formatPence(spent)}
                        </span>
                        <span className="text-muted text-subtle">
                          {' '}
                          / {formatPence(budget)}
                        </span>
                      </div>
                    </div>

                    <div className="w-full bg-surface-muted rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full ${
                          isOver ? 'bg-danger-soft' : percent > 85 ? 'bg-warning-soft' : 'bg-accent'
                        }`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-muted text-subtle mt-1.5">
                      <span>{percent}% used</span>
                      {isOver ? (
                        <span className="text-danger font-bold">
                          Over by {formatPence(spent - budget)}
                        </span>
                      ) : (
                        <span className="text-success font-medium">
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
