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
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            Household Activity & Ledger
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {filteredTransactions.length} of {transactions.length} records • exact integer penny accuracy
          </p>
        </div>

        {canEdit && (
          <button
            id="tx-list-add-btn"
            onClick={onAddTransaction}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 text-white font-semibold text-xs hover:bg-emerald-800 active:scale-95 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Transaction
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-neutral-800 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search transactions, merchants, notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {selectedMonth && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 px-3 py-2 bg-neutral-50 dark:bg-neutral-850 rounded-xl border border-neutral-200 dark:border-neutral-700 shrink-0 cursor-pointer">
              <input
                type="checkbox"
                checked={filterBySelectedMonth}
                onChange={(e) => setFilterBySelectedMonth(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-neutral-300 dark:border-neutral-700"
              />
              <span>Only {selectedMonth}</span>
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {/* Payer Filter */}
          <select
            value={selectedPayer}
            onChange={(e) => setSelectedPayer(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-850"
          >
            <option value="all">All Payers</option>
            <option value="Joint">Joint</option>
            <option value="Marius">Marius</option>
            <option value="Vesta">Vesta</option>
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-850"
          >
            <option value="all">All Classifications</option>
            <option value="expense">Living Expenses</option>
            <option value="income">Income / Salary Inflows</option>
            <option value="transfer">Internal Transfers</option>
            <option value="repayment">Card Repayments</option>
            <option value="refund">Refunds & Credits</option>
            <option value="savings">Savings Contributions</option>
          </select>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="col-span-2 sm:col-span-1 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-850"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transaction Table / Card List */}
      <div className="bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              No transactions match the selected filters
            </p>
            <p className="text-xs text-neutral-400 mt-1">Try clearing filters or adding a new transaction.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-700/60">
            {filteredTransactions.map((tx) => {
              const isNegative = tx.type === 'expense' || tx.type === 'repayment';
              const accountName = accountsMap.get(tx.accountId) || 'Account';
              const targetName = tx.targetAccountId ? accountsMap.get(tx.targetAccountId) : null;
              const categoryName = categoriesMap.get(tx.categoryId) || 'General';

              return (
                <div
                  key={tx.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-50/80 dark:hover:bg-neutral-750 transition"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        tx.isSavings
                          ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                          : tx.isTransfer
                          ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300'
                          : tx.type === 'income'
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                          : tx.isRefund
                          ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300'
                          : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
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
                        <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                          {tx.description}
                        </span>
                        {tx.isSavings && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                            Savings Transfer
                          </span>
                        )}
                        {tx.isTransfer && !tx.isSavings && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300">
                            Internal Transfer
                          </span>
                        )}
                        {tx.isRepayment && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                            Card Repayment
                          </span>
                        )}
                        {tx.isRefund && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300">
                            Refund / Credit
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-1 flex-wrap">
                        <span>{tx.date}</span>
                        <span>•</span>
                        <span className="font-semibold text-neutral-700 dark:text-neutral-300">
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
                              ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                              : tx.payer === 'Marius'
                              ? 'bg-blue-50 dark:bg-blue-950 text-blue-800 dark:text-blue-300'
                              : 'bg-purple-50 dark:bg-purple-950 text-purple-800 dark:text-purple-300'
                          }`}
                        >
                          {tx.payer}
                        </span>
                      </div>

                      {tx.notes && (
                        <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1 italic">
                          {tx.notes}
                        </p>
                      )}

                      {tx.splits && tx.splits.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {tx.splits.map((s, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-600"
                            >
                              <span className="font-medium">
                                {categoriesMap.get(s.categoryId) || 'Category'}:
                              </span>
                              <span className="font-bold">{formatPence(s.amountPence)}</span>
                              {s.notes && <span className="text-neutral-400">({s.notes})</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100 dark:border-neutral-700">
                    <div
                      className={`text-base font-black ${
                        isNegative
                          ? 'text-neutral-900 dark:text-neutral-100'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {isNegative ? '-' : '+'}{formatPence(tx.amountPence)}
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEditTransaction(tx)}
                          className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition"
                          title="Edit transaction"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete transaction "${tx.description}"?`)) {
                              onDeleteTransaction(tx.id);
                            }
                          }}
                          className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                          title="Delete transaction"
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
