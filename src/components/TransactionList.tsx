import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  ChevronDown,
  Edit2,
  PiggyBank,
  Plus,
  Repeat,
  Search,
  Trash2,
} from 'lucide-react';
import { Account, Category, Transaction, UserRole, HouseholdMember } from '../types';
import { householdPersonOptions } from '../utils/householdPeople';
import { formatPence } from '../utils/currency';

interface TransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  members: HouseholdMember[];
  userRole: UserRole;
  selectedMonth?: string;
  onAddTransaction: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  accounts,
  categories,
  members,
  userRole,
  selectedMonth,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [search, setSearch] = useState('');
  const [selectedPayer, setSelectedPayer] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filterBySelectedMonth, setFilterBySelectedMonth] = useState(true);

  const canEdit = userRole === 'owner' || userRole === 'editor';

  const accountsMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts]
  );

  const categoriesMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories]
  );

  const payerOptions = useMemo(
    () => householdPersonOptions(members, transactions.map((transaction) => transaction.payer)),
    [members, transactions]
  );

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterBySelectedMonth && selectedMonth && !tx.date.startsWith(selectedMonth)) {
        return false;
      }

      if (search.trim()) {
        const query = search.trim().toLowerCase();
        const descriptionMatch = tx.description.toLowerCase().includes(query);
        const categoryMatch = (categoriesMap.get(tx.categoryId) || '')
          .toLowerCase()
          .includes(query);
        const accountMatch = (accountsMap.get(tx.accountId) || '')
          .toLowerCase()
          .includes(query);
        const noteMatch = (tx.notes || '').toLowerCase().includes(query);

        if (!descriptionMatch && !categoryMatch && !accountMatch && !noteMatch) {
          return false;
        }
      }

      if (selectedPayer !== 'all' && tx.payer !== selectedPayer) {
        return false;
      }

      if (selectedType !== 'all') {
        if (selectedType === 'transfer' && !tx.isTransfer) return false;
        if (
          selectedType === 'expense' &&
          (tx.type !== 'expense' || tx.isTransfer || tx.isRepayment)
        ) {
          return false;
        }
        if (selectedType === 'income' && tx.type !== 'income') return false;
        if (selectedType === 'repayment' && !tx.isRepayment) return false;
        if (selectedType === 'refund' && !tx.isRefund && tx.type !== 'refund') return false;
        if (selectedType === 'savings' && !tx.isSavings) return false;
      }

      if (selectedCategory !== 'all' && tx.categoryId !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [
    accountsMap,
    categoriesMap,
    filterBySelectedMonth,
    search,
    selectedCategory,
    selectedMonth,
    selectedPayer,
    selectedType,
    transactions,
  ]);

  const filterInputClassName =
    'h-10 w-full rounded-md border border-[rgba(255,255,255,0.06)] bg-[#1F2937] px-3 text-[12px] font-medium text-[#F9FAFB] outline-none transition-colors placeholder:text-[#6B7280] focus:border-[#2E374A] focus:bg-[#374151]';

  return (
    <div className="space-y-5 bg-[#0B0F19] pb-16 text-white">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold leading-8 tracking-tight text-white">Activity</h1>
          <p className="mt-0.5 text-[12px] font-normal text-[#9CA3AF]">
            {filteredTransactions.length} of {transactions.length} transactions
          </p>
        </div>

        {canEdit && (
          <button
            id="tx-list-add-btn"
            type="button"
            onClick={onAddTransaction}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-accent px-4 text-sm font-semibold text-on-accent transition-all hover:brightness-95 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        )}
      </header>

      <section
        className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827] p-3 sm:p-4"
        aria-label="Activity filters"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="relative block min-w-0">
            <span className="sr-only">Search transactions</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="search"
              placeholder="Search transactions"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${filterInputClassName} pl-9`}
            />
          </label>

          <label className="relative block min-w-0">
            <span className="sr-only">Date filter</span>
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
            <select
              value={filterBySelectedMonth && selectedMonth ? 'selected-month' : 'all'}
              onChange={(event) => setFilterBySelectedMonth(event.target.value === 'selected-month')}
              className={`${filterInputClassName} appearance-none pl-9 pr-9`}
              disabled={!selectedMonth}
            >
              {selectedMonth && <option value="selected-month">{selectedMonth}</option>}
              <option value="all">All dates</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
          </label>

          <label className="relative block min-w-0">
            <span className="sr-only">Payer filter</span>
            <select
              value={selectedPayer}
              onChange={(event) => setSelectedPayer(event.target.value)}
              className={`${filterInputClassName} appearance-none pr-9`}
            >
              <option value="all">All payers</option>
              {payerOptions.map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
          </label>

          <label className="relative block min-w-0">
            <span className="sr-only">Classification filter</span>
            <select
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
              className={`${filterInputClassName} appearance-none pr-9`}
            >
              <option value="all">All classifications</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="transfer">Transfers</option>
              <option value="repayment">Repayments</option>
              <option value="refund">Refunds</option>
              <option value="savings">Savings</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
          </label>

          <label className="relative block min-w-0">
            <span className="sr-only">Category filter</span>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className={`${filterInputClassName} appearance-none pr-9`}
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
          </label>
        </div>
      </section>

      <section
        className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#111827]"
        aria-label="Activity transactions"
      >
        <div className="hidden items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-2.5 sm:flex">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
            Transaction
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
            Amount
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-4">
            <div className="flex min-h-[150px] flex-col items-center justify-center rounded-lg border border-dashed border-[rgba(255,255,255,0.06)] bg-[#1F2937] p-8 text-center">
              <Search className="h-5 w-5 text-[#6B7280]" />
              <p className="mt-2 text-sm font-medium text-[#9CA3AF]">No matching transactions</p>
              <p className="mt-1 text-[11px] font-normal text-[#6B7280]">
                Adjust the filters or add a new transaction.
              </p>

              {canEdit && (
                <button
                  type="button"
                  onClick={onAddTransaction}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.06)] bg-[#1F2937] px-3 text-xs font-semibold text-[#F9FAFB] transition-colors hover:bg-[#374151]"
                >
                  <Plus className="h-3.5 w-3.5 text-accent" />
                  Add transaction
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-px bg-[#111827] p-1.5">
            {filteredTransactions.map((tx) => {
              const isNegative = tx.type === 'expense' || tx.type === 'repayment';
              const isPositive = tx.type === 'income' || tx.isRefund || tx.type === 'refund';
              const accountName = accountsMap.get(tx.accountId) || 'Account';
              const targetName = tx.targetAccountId
                ? accountsMap.get(tx.targetAccountId) || 'Account'
                : null;
              const categoryName = categoriesMap.get(tx.categoryId) || 'General';

              const classification = tx.isSavings
                ? 'Savings'
                : tx.isTransfer
                ? 'Transfer'
                : tx.isRepayment
                ? 'Repayment'
                : tx.isRefund || tx.type === 'refund'
                ? 'Refund'
                : tx.type === 'income'
                ? 'Income'
                : 'Expense';

              const statusClassName = isPositive
                ? 'border-[rgba(34,197,94,0.20)] bg-[rgba(34,197,94,0.10)] text-[#4ADE80]'
                : isNegative
                ? 'border-[rgba(239,68,68,0.20)] bg-[rgba(239,68,68,0.10)] text-[#F87171]'
                : 'border-[rgba(255,255,255,0.06)] bg-[#111827] text-[#9CA3AF]';

              return (
                <article
                  key={tx.id}
                  className="group flex items-center justify-between gap-3 rounded-lg border border-transparent bg-[#1F2937] px-3 py-3 transition-colors hover:border-[#2E374A] hover:bg-[#374151] sm:px-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#111827] text-[#9CA3AF]"
                      aria-hidden="true"
                    >
                      {tx.isSavings ? (
                        <PiggyBank className="h-4 w-4" />
                      ) : tx.isTransfer ? (
                        <Repeat className="h-4 w-4" />
                      ) : isPositive ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h2 className="truncate text-[14px] font-semibold leading-5 text-[#F9FAFB] sm:text-[15px]">
                          {tx.description}
                        </h2>
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] ${statusClassName}`}
                        >
                          {classification}
                        </span>
                      </div>

                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] font-normal text-[#9CA3AF]">
                        <span>{tx.date}</span>
                        <span className="text-[#6B7280]" aria-hidden="true">·</span>
                        <span>{categoryName}</span>
                        <span className="text-[#6B7280]" aria-hidden="true">·</span>
                        <span>
                          {accountName}
                          {targetName ? ` → ${targetName}` : ''}
                        </span>
                        <span className="text-[#6B7280]" aria-hidden="true">·</span>
                        <span>{tx.payer}</span>
                      </div>

                      {tx.notes && (
                        <p className="mt-0.5 max-w-[650px] truncate text-[11px] font-normal text-[#6B7280]">
                          {tx.notes}
                        </p>
                      )}

                      {tx.splits && tx.splits.length > 0 && (
                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#6B7280]">
                          {tx.splits.map((split) => (
                            <span key={split.id}>
                              {categoriesMap.get(split.categoryId) || 'Category'} ·{' '}
                              {formatPence(split.amountPence)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <div className="min-w-[96px] text-right font-mono text-[16px] font-semibold leading-5 tabular-nums text-white sm:text-[18px]">
                      {isNegative ? '-' : '+'}
                      {formatPence(tx.amountPence)}
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1 opacity-70 transition-opacity sm:opacity-40 sm:group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => onEditTransaction(tx)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2E374A] text-[#9CA3AF] transition-colors hover:text-white active:scale-[0.96]"
                          title="Edit transaction"
                          aria-label={`Edit ${tx.description}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Delete transaction "${tx.description}"?`)) {
                              onDeleteTransaction(tx.id);
                            }
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2E374A] text-[#9CA3AF] transition-colors hover:text-[#F87171] active:scale-[0.96]"
                          title="Delete transaction"
                          aria-label={`Delete ${tx.description}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
