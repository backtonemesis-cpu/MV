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
import { formatMonthLabel } from '../utils/transferPlan';

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

  const filterInputClassName = 'finance-filter-control';

  return (
    <div className="finance-workspace space-y-5 pb-16">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-bold leading-8 tracking-tight text-main">Activity</h1>
          <p className="mt-0.5 text-[12px] font-normal text-subtle">
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
        className="finance-panel p-3 sm:p-4"
        aria-label="Activity filters"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="relative block min-w-0">
            <span className="sr-only">Search transactions</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
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
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <select
              value={filterBySelectedMonth && selectedMonth ? 'selected-month' : 'all'}
              onChange={(event) => setFilterBySelectedMonth(event.target.value === 'selected-month')}
              className={`${filterInputClassName} appearance-none pl-9 pr-9`}
              disabled={!selectedMonth}
            >
              {selectedMonth && (
                <option value="selected-month">{formatMonthLabel(selectedMonth)}</option>
              )}
              <option value="all">All dates</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
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
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
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
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
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
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          </label>
        </div>
      </section>

      <section
        className="finance-panel overflow-hidden"
        aria-label="Activity transactions"
      >
        <div className="hidden items-center justify-between border-b border-muted px-4 py-2.5 sm:flex">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Transaction
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
            Amount
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-4">
            <div className="flex min-h-[150px] flex-col items-center justify-center rounded-lg border border-dashed border-muted bg-surface-muted p-8 text-center">
              <Search className="h-5 w-5 text-subtle" />
              <p className="mt-2 text-sm font-medium text-muted">No matching transactions</p>
              <p className="mt-1 text-[11px] font-normal text-subtle">
                Adjust the filters or add a new transaction.
              </p>

              {canEdit && (
                <button
                  type="button"
                  onClick={onAddTransaction}
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-muted bg-surface-muted px-3 text-xs font-semibold text-main transition-colors hover:bg-surface-muted"
                >
                  <Plus className="h-3.5 w-3.5 text-accent" />
                  Add transaction
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-px bg-surface p-1.5">
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
                ? 'finance-status-positive'
                : isNegative
                ? 'finance-status-negative'
                : 'finance-status-neutral';

              return (
                <article
                  key={tx.id}
                  tabIndex={canEdit ? 0 : undefined}
                  onClick={(event) => {
                    if (!canEdit) return;
                    if ((event.target as HTMLElement).closest('button, input, a, select, textarea')) return;
                    onEditTransaction(tx);
                  }}
                  onKeyDown={(event) => {
                    if (!canEdit || event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onEditTransaction(tx);
                    }
                  }}
                  className={`finance-row finance-ledger-row group ${canEdit ? 'is-clickable' : ''}`}
                >
                  <div className="finance-row-left">
                    <div
                      className="finance-leading-icon"
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

                    <div className="finance-row-copy">
                      <div className="finance-row-titleline">
                        <h2 className="finance-row-title">
                          {tx.description}
                        </h2>
                        <span
                          className={statusClassName}
                        >
                          {classification}
                        </span>
                      </div>

                      <div className="finance-metadata-line">
                        <span>{tx.date}</span>
                        <span className="text-subtle" aria-hidden="true">·</span>
                        <span>{categoryName}</span>
                        <span className="text-subtle" aria-hidden="true">·</span>
                        <span>
                          {accountName}
                          {targetName ? ` → ${targetName}` : ''}
                        </span>
                        <span className="text-subtle" aria-hidden="true">·</span>
                        <span>{tx.payer}</span>
                      </div>

                    </div>
                  </div>

                  <div className="finance-row-side">
                    <div className="finance-amount-block">
                      <div
                        className={`finance-amount ${
                          isNegative ? 'is-negative' : isPositive ? 'is-positive' : 'is-neutral'
                        }`}
                      >
                        {isNegative ? '-' : '+'}
                        {formatPence(tx.amountPence)}
                      </div>
                      <div className="finance-amount-detail is-placeholder">Amount</div>
                    </div>

                    {canEdit && (
                      <div className="finance-row-actions flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); onEditTransaction(tx); }}
                          className="finance-action-button"
                          title="Edit transaction"
                          aria-label={`Edit ${tx.description}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (window.confirm(`Delete transaction "${tx.description}"?`)) {
                              onDeleteTransaction(tx.id);
                            }
                          }}
                          className="finance-action-button is-danger"
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
