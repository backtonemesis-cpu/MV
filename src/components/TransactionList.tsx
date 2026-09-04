import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Repeat,
  Trash2,
  Edit2,
  Calendar,
  CreditCard,
  CheckCircle,
  PiggyBank,
  ChevronDown,
} from 'lucide-react';
import { Transaction, Account, Category, UserRole } from '../types';
import { formatPence } from '../utils/currency';

interface TransactionListProps {
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
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
  userRole,
  selectedMonth,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [search, setSearch] = useState('');
  const [selectedPayer, setSelectedPayer] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterBySelectedMonth, setFilterBySelectedMonth] = useState<boolean>(true);

  const canEdit = userRole === 'owner' || userRole === 'editor';

  const accountsMap = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a.name]));
  }, [accounts]);

  const categoriesMap = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c.name]));
  }, [categories]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Month filter
      if (filterBySelectedMonth && selectedMonth && !tx.date.startsWith(selectedMonth)) {
        return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const descMatch = tx.description.toLowerCase().includes(q);
        const catMatch = (categoriesMap.get(tx.categoryId) || '').toLowerCase().includes(q);
        const notesMatch = (tx.notes || '').toLowerCase().includes(q);
        if (!descMatch && !catMatch && !notesMatch) return false;
      }

      // Payer filter
      if (selectedPayer !== 'all' && tx.payer !== selectedPayer) {
        return false;
      }

      // Type filter
      if (selectedType !== 'all') {
        if (selectedType === 'transfer' && !tx.isTransfer) return false;
        if (selectedType === 'expense' && (tx.type !== 'expense' || tx.isTransfer || tx.isRepayment)) return false;
        if (selectedType === 'income' && tx.type !== 'income') return false;
        if (selectedType === 'repayment' && !tx.isRepayment) return false;
        if (selectedType === 'refund' && (!tx.isRefund && tx.type !== 'refund')) return false;
        if (selectedType === 'savings' && !tx.isSavings) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && tx.categoryId !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [
    transactions,
    search,
    selectedPayer,
    selectedType,
    selectedCategory,
    filterBySelectedMonth,
    selectedMonth,
    categoriesMap,
  ]);

  return (
    <div className="space-y-4 pb-12">
      {/* Header with Search and Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-main">
            Activity
          </h1>
        </div>

        {canEdit && (
          <button
            id="tx-list-add-btn"
            onClick={onAddTransaction}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-accent text-on-accent font-semibold text-xs hover:bg-success-soft active:scale-95 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        )}
      </div>

      {/* Search + Compact Filter Chips */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-subtle absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search transactions"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-[13px] rounded-xl border-0 bg-surface-muted text-main placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {selectedMonth && (
            <label className="inline-flex min-w-0 h-9 items-center gap-2 rounded-xl bg-surface-muted px-3 text-[12px] font-medium text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={filterBySelectedMonth}
                onChange={(e) => setFilterBySelectedMonth(e.target.checked)}
                className="w-3.5 h-3.5 shrink-0 rounded text-success focus:ring-accent border-muted"
              />
              <Calendar className="w-3.5 h-3.5 shrink-0 text-subtle" />
              <span className="truncate">{selectedMonth}</span>
            </label>
          )}

          <div className="relative min-w-0">
            <select
              value={selectedPayer}
              onChange={(e) => setSelectedPayer(e.target.value)}
              className="w-full h-9 min-w-0 appearance-none rounded-xl border-0 bg-surface-muted pl-3 pr-7 text-[12px] font-medium text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All Payers</option>
              <option value="Joint">Joint</option>
              <option value="Marius">Marius</option>
              <option value="Vesta">Vesta</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          </div>

          <div className="relative min-w-0">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full h-9 min-w-0 appearance-none rounded-xl border-0 bg-surface-muted pl-3 pr-7 text-[12px] font-medium text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All Classifications</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
              <option value="transfer">Transfers</option>
              <option value="repayment">Repayments</option>
              <option value="refund">Refunds</option>
              <option value="savings">Savings</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          </div>

          <div className="relative min-w-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-9 min-w-0 appearance-none rounded-xl border-0 bg-surface-muted pl-3 pr-7 text-[12px] font-medium text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          </div>
        </div>
      </div>

      {/* Transaction Table / Card List */}
      <div className="bg-surface rounded-2xl border border-muted shadow-xs overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="m-4 rounded-[14px] border border-dashed border-muted bg-surface-muted px-4 py-10 text-center">
            <p className="text-[13px] font-medium text-subtle">
              No matching transactions
            </p>
          </div>
        ) : (
          <div className="divide-y divide-muted">
            {filteredTransactions.map((tx) => {
              const isNegative = tx.type === 'expense' || tx.type === 'repayment';
              const accountName = accountsMap.get(tx.accountId) || 'Account';
              const targetName = tx.targetAccountId ? accountsMap.get(tx.targetAccountId) : null;
              const categoryName = categoriesMap.get(tx.categoryId) || 'General';

              return (
                <div
                  key={tx.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface-muted transition"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        tx.isSavings
                          ? 'bg-warning-soft text-warning'
                          : tx.isTransfer
                          ? 'bg-accent-soft text-accent'
                          : tx.type === 'income'
                          ? 'bg-success-soft text-success'
                          : tx.isRefund
                          ? 'bg-accent-soft text-accent'
                          : 'bg-surface-muted text-muted'
                      }`}
                    >
                      {tx.isSavings ? (
                        <PiggyBank className="w-4 h-4" />
                      ) : tx.isTransfer ? (
                        <Repeat className="w-4 h-4" />
                      ) : tx.type === 'income' ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-main">
                          {tx.description}
                        </span>
                        {tx.isSavings && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-warning-soft text-warning">
                            Savings
                          </span>
                        )}
                        {tx.isTransfer && !tx.isSavings && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent-soft text-accent">
                            Transfer
                          </span>
                        )}
                        {tx.isRepayment && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent-soft text-accent">
                            Repayment
                          </span>
                        )}
                        {tx.isRefund && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-accent-soft text-accent">
                            Refund
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted text-main0 mt-1 flex-wrap">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="font-semibold text-muted">
                          {categoryName}
                        </span>
                        <span>•</span>
                        <span>
                          {accountName}
                          {targetName && ` → ${targetName}`}
                        </span>
                        <span>•</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            tx.payer === 'Joint'
                              ? 'bg-success-soft text-success'
                              : tx.payer === 'Marius'
                              ? 'bg-accent-soft text-accent'
                              : 'bg-accent-soft text-accent'
                          }`}
                        >
                          {tx.payer}
                        </span>
                      </div>

                      {tx.notes && (
                        <p className="text-[11px] text-muted text-subtle mt-1 italic">
                          {tx.notes}
                        </p>
                      )}

                      {tx.splits && tx.splits.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {tx.splits.map((s, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-surface-muted text-muted border border-muted"
                            >
                              <span className="font-medium">
                                {categoriesMap.get(s.categoryId) || 'Category'}:
                              </span>
                              <span className="font-bold">{formatPence(s.amountPence)}</span>
                              {s.notes && <span className="text-muted text-subtle">({s.notes})</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-muted">
                    <div
                      className={`text-base font-black ${
                        isNegative
                          ? 'text-main'
                          : 'text-success'
                      }`}
                    >
                      {isNegative ? '-' : '+'}{formatPence(tx.amountPence)}
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEditTransaction(tx)}
                          className="p-1.5 text-muted text-subtle hover:text-muted hover:bg-surface-muted rounded-lg transition"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete transaction "${tx.description}"?`)) {
                              onDeleteTransaction(tx.id);
                            }
                          }}
                          className="p-1.5 text-muted text-subtle hover:text-danger hover:bg-danger-soft rounded-lg transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
