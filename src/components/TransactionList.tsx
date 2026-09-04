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
    'w-full bg-surface border border-muted text-main rounded-xl px-3.5 h-11 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft transition-all';

  return (
    <div className="bg-app space-y-5 pb-16 text-main">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold tracking-tight text-main">Activity</h1>
          <p className="text-xs text-muted">
            {filteredTransactions.length} of {transactions.length} transactions
          </p>
        </div>

        {canEdit && (
          <button
            id="tx-list-add-btn"
            type="button"
            onClick={onAddTransaction}
            className="bg-accent text-on-accent font-semibold text-sm px-4 h-10 rounded-xl flex items-center justify-center gap-1.5 transition-all hover:brightness-95 active:scale-[0.97] shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        )}
      </header>

      <section className="rounded-2xl border border-muted bg-surface p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-6">
          <label className="relative block min-w-0">
            <span className="sr-only">Search transactions</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <input
              type="search"
              placeholder="Search transactions"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={`${filterInputClassName} pl-10`}
            />
          </label>

          <label className="relative block min-w-0">
            <span className="sr-only">Date filter</span>
            <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <select
              value={filterBySelectedMonth && selectedMonth ? 'selected-month' : 'all'}
              onChange={(event) => setFilterBySelectedMonth(event.target.value === 'selected-month')}
              className={`${filterInputClassName} appearance-none pl-10 pr-9`}
              disabled={!selectedMonth}
            >
              {selectedMonth && <option value="selected-month">{selectedMonth}</option>}
              <option value="all">All dates</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
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
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
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
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
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
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          </label>
        </div>

        <div className="overflow-hidden rounded-2xl border border-muted bg-surface shadow-sm">
          <div className="hidden items-center justify-between border-b border-muted bg-table-header px-5 py-2.5 sm:flex">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Transaction
            </div>
            <div className="min-w-[100px] text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Amount
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="bg-table p-5">
              <div className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border border-dashed border-muted bg-surface-muted p-8 text-center">
                <Search className="h-5 w-5 text-subtle" />
                <p className="mt-2 text-sm font-medium text-muted">No matching transactions</p>
                <p className="mt-1 text-xs text-subtle">
                  Adjust the filters or add a new transaction.
                </p>

                {canEdit && (
                  <button
                    type="button"
                    onClick={onAddTransaction}
                    className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl border border-muted bg-surface px-3 text-xs font-semibold text-main transition-all hover:bg-surface-muted active:scale-[0.98]"
                  >
                    <Plus className="h-3.5 w-3.5 text-accent" />
                    Add transaction
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-muted bg-table">
              {filteredTransactions.map((tx) => {
                const isNegative = tx.type === 'expense' || tx.type === 'repayment';
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

                const iconClassName =
                  tx.isSavings ||
                  tx.isTransfer ||
                  tx.type === 'income' ||
                  tx.isRefund ||
                  tx.type === 'refund'
                    ? 'bg-accent-soft text-accent'
                    : 'bg-surface-muted text-muted';

                return (
                  <article
                    key={tx.id}
                    className="bg-table py-3 px-5 flex items-center justify-between gap-4 hover:bg-surface-muted/30 transition-all"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
                        aria-hidden="true"
                      >
                        {tx.isSavings ? (
                          <PiggyBank className="h-4 w-4" />
                        ) : tx.isTransfer ? (
                          <Repeat className="h-4 w-4" />
                        ) : tx.type === 'income' || tx.isRefund || tx.type === 'refund' ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <h2 className="truncate text-sm font-semibold text-main">
                            {tx.description}
                          </h2>

                          <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
                            {classification}
                          </span>
                        </div>

                        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-surface-muted rounded text-[10px] font-medium border border-muted/40 text-muted">
                            {tx.date}
                          </span>

                          <span className="px-1.5 py-0.5 bg-surface-muted rounded text-[10px] font-medium border border-muted/40 text-muted">
                            {categoryName}
                          </span>

                          <span className="px-1.5 py-0.5 bg-surface-muted rounded text-[10px] font-medium border border-muted/40 text-muted">
                            {accountName}
                            {targetName ? ` → ${targetName}` : ''}
                          </span>

                          <span className="px-1.5 py-0.5 bg-surface-muted rounded text-[10px] font-medium border border-muted/40 text-muted">
                            {tx.payer}
                          </span>
                        </div>

                        {tx.notes && (
                          <span className="text-[10px] text-subtle font-normal italic tracking-wide mt-1 max-w-[550px] opacity-50 truncate block">
                            {tx.notes}
                          </span>
                        )}

                        {tx.splits && tx.splits.length > 0 && (
                          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                            {tx.splits.map((split) => (
                              <span
                                key={split.id}
                                className="px-1.5 py-0.5 bg-surface-muted rounded text-[10px] font-medium border border-muted/40 text-muted"
                              >
                                {categoriesMap.get(split.categoryId) || 'Category'} ·{' '}
                                {formatPence(split.amountPence)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <div className="font-mono tracking-tight tabular-nums font-semibold text-base text-main text-right min-w-[100px]">
                        {isNegative ? '-' : '+'}
                        {formatPence(tx.amountPence)}
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onEditTransaction(tx)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-muted bg-surface text-muted transition-all hover:bg-surface-muted hover:text-main active:scale-[0.96]"
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
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-muted bg-surface text-subtle transition-all hover:bg-surface-muted hover:text-main active:scale-[0.96]"
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
        </div>
      </section>
    </div>
  );
};
