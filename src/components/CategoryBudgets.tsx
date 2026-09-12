import React, { useState } from 'react';
import type { HouseholdData } from '../types';
import { setMonthlyCategoryBudget } from '../categories/budgets';
import { createCategoryEligibility } from '../utils/categoryEligibility';
import {
  parseToPence,
  formatPence,
  formatPenceToPoundsInput,
} from '../utils/currency';
import { localDateInputValue } from '../utils/dateInput';
import { MonthPicker } from './MonthPicker';
import { MoneyInput } from './MoneyInput';
import { CategorySelect } from './CategorySelect';
import { useModalAccessibility } from '../utils/modalAccessibility';

const button =
  'min-h-11 px-3 border border-muted rounded-md text-sm text-main disabled:opacity-50';
const categoryClass =
  'w-full min-h-11 border border-muted rounded-md bg-surface px-3';

export function CategoryBudgets({
  household,
  onChanged,
}: {
  household: HouseholdData;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(localDateInputValue().slice(0, 7));
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(household.version);

  const close = () => {
    if (!busy) setOpen(false);
  };
  const ref = useModalAccessibility<HTMLDivElement>(open, close);
  const existing = household.monthlyCategoryBudgets.filter(
    (budget) => budget.monthKey === month
  );
  const budgetCategories = createCategoryEligibility(
    household.categoryGroups
  ).getBillCategoryOptions(household.categories);

  const choose = (id: string, period = month) => {
    setCategoryId(id);
    setAmount(
      formatPenceToPoundsInput(
        household.monthlyCategoryBudgets.find(
          (budget) => budget.monthKey === period && budget.categoryId === id
        )?.budgetAmountPence ?? 0
      )
    );
    setVersion(household.version);
  };

  return (
    <>
      <button
        className={button}
        onClick={() => {
          setVersion(household.version);
          setError('');
          setOpen(true);
        }}
      >
        Monthly category budgets
      </button>
      {open && (
        <div className="mv-modal-backdrop">
          <div
            ref={ref}
            className="mv-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-budgets-title"
            tabIndex={-1}
          >
            <div className="mv-modal-header">
              <h2
                id="category-budgets-title"
                className="text-main font-semibold"
              >
                Monthly category budgets
              </h2>
              <button className={button} disabled={busy} onClick={close}>
                Close
              </button>
            </div>
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={async (event) => {
                event.preventDefault();
                setError('');
                setBusy(true);
                try {
                  if (!categoryId) throw new Error('Choose a category.');
                  if (!amount.trim()) throw new Error('Enter a budget amount.');
                  setMonthlyCategoryBudget(
                    month,
                    categoryId,
                    parseToPence(amount),
                    version
                  );
                  await onChanged();
                  setOpen(false);
                } catch (caught) {
                  setError((caught as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="mv-modal-body space-y-3">
                <MonthPicker
                  ariaLabel="Category budget month"
                  value={month}
                  onChange={(value) => {
                    setMonth(value);
                    choose(categoryId, value);
                  }}
                />
                <div>
                  <label htmlFor="category-budget-category" className="block text-sm">
                    Category
                  </label>
                  <CategorySelect
                    id="category-budget-category"
                    value={categoryId}
                    categories={budgetCategories}
                    categoryGroups={household.categoryGroups}
                    onValueChange={choose}
                    ariaLabel="Budget category"
                    placeholder="Choose category"
                    required
                    className={categoryClass}
                  />
                </div>
                <label className="block text-sm">
                  Budget (£)
                  <MoneyInput
                    aria-label="Category budget amount"
                    required
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </label>
                <p className="text-sm text-muted">
                  This changes {month} only. Other months retain their budgets.
                </p>
                {!!existing.length && (
                  <ul className="space-y-1 text-sm">
                    {existing.map((budget) => (
                      <li
                        key={budget.categoryId}
                        className="flex justify-between gap-3"
                      >
                        <span>
                          {household.categories.find(
                            (category) => category.id === budget.categoryId
                          )?.name ?? 'Invalid category'}
                        </span>
                        <span>{formatPence(budget.budgetAmountPence)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {error && (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                )}
              </div>
              <div className="mv-modal-footer flex gap-2 justify-end">
                <button
                  className={button}
                  type="button"
                  disabled={busy}
                  onClick={close}
                >
                  Cancel
                </button>
                <button className={button} disabled={busy}>
                  {busy ? 'Saving…' : 'Save budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
