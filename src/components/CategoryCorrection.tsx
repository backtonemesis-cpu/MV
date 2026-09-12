import React, { useEffect, useRef, useState } from 'react';
import type { HouseholdData } from '../types';
import { categoryScope } from '../categories/validation';
import {
  executeReclassification,
  previewReclassification,
  type ReclassificationCommand,
} from '../categories/reclassification';
import { useModalAccessibility } from '../utils/modalAccessibility';
import { CategorySelect } from './CategorySelect';

const button =
  'min-h-11 px-3 border border-muted rounded-md text-sm text-main disabled:opacity-50';
const field =
  'w-full min-h-11 rounded-md border border-muted bg-surface px-3 text-main';

export function CategoryCorrection({
  household,
  onChanged,
}: {
  household: HouseholdData;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [command, setCommand] = useState<ReclassificationCommand>({
    action: 'merge',
    sourceId: '',
    destinationId: '',
  });
  const [review, setReview] = useState<{
    preview: ReturnType<typeof previewReclassification>;
    version: number;
  } | null>(null);
  const reviewRef = useRef<HTMLDivElement>(null);

  const close = () => {
    if (!busy) {
      setOpen(false);
      setReview(null);
      setError('');
    }
  };
  const ref = useModalAccessibility<HTMLDivElement>(open, close);
  const update = (next: Partial<ReclassificationCommand>) => {
    setCommand({ ...command, ...next });
    setReview(null);
    setError('');
  };

  useEffect(() => {
    if (!review) return;
    const frame = window.requestAnimationFrame(() =>
      reviewRef.current?.focus({ preventScroll: true })
    );
    return () => window.cancelAnimationFrame(frame);
  }, [review]);

  const source = household.categories.find(
    (category) => category.id === command.sourceId
  );
  const candidates = household.categories.filter(
    (category) =>
      !category.supersededById &&
      (!category.isSystem ||
        (command.action === 'recategorise' &&
          category.systemRole !== 'internal-transfer'))
  );
  const destinations = household.categories.filter(
    (category) =>
      !category.isArchived &&
      !category.isSystem &&
      category.id !== command.sourceId &&
      source &&
      categoryScope(household, category) === categoryScope(household, source)
  );

  return (
    <>
      <button
        className={button}
        onClick={() => {
          setError('');
          setReview(null);
          setOpen(true);
        }}
      >
        Merge / bulk correction
      </button>
      {open && (
        <div className="mv-modal-backdrop">
          <div
            ref={ref}
            className="mv-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-correction-title"
            tabIndex={-1}
          >
            <div className="mv-modal-header">
              <h2
                id="category-correction-title"
                className="font-semibold text-main"
              >
                Category correction
              </h2>
              <button className={button} onClick={close} disabled={busy}>
                Close
              </button>
            </div>
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={async (event) => {
                event.preventDefault();
                setError('');
                if (!review) {
                  try {
                    setReview({
                      preview: previewReclassification(household, command),
                      version: household.version,
                    });
                  } catch (caught) {
                    setError((caught as Error).message);
                  }
                  return;
                }
                setBusy(true);
                try {
                  executeReclassification(command, review.version);
                  await onChanged();
                  setOpen(false);
                  setReview(null);
                } catch (caught) {
                  setError((caught as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div className="mv-modal-body space-y-3">
                <label className="block text-sm">
                  Operation
                  <select
                    className={field}
                    value={command.action}
                    onChange={(event) =>
                      update({
                        action: event.target.value as 'merge' | 'recategorise',
                        sourceId: '',
                        destinationId: '',
                        monthKey: undefined,
                      })
                    }
                  >
                    <option value="merge">Merge categories and retire source</option>
                    <option value="recategorise">Bulk recategorise records</option>
                  </select>
                </label>

                <div>
                  <label htmlFor="category-correction-source" className="block text-sm">
                    From category
                  </label>
                  <CategorySelect
                    id="category-correction-source"
                    value={command.sourceId}
                    categories={candidates}
                    categoryGroups={household.categoryGroups}
                    onValueChange={(value) =>
                      update({ sourceId: value, destinationId: '' })
                    }
                    ariaLabel="From category"
                    placeholder="Choose source"
                    getCategoryLabel={(category) =>
                      `${category.name}${category.isArchived ? ' (archived)' : ''}`
                    }
                    required
                    className={field}
                  />
                </div>

                <div>
                  <label
                    htmlFor="category-correction-destination"
                    className="block text-sm"
                  >
                    To category
                  </label>
                  <CategorySelect
                    id="category-correction-destination"
                    value={command.destinationId}
                    categories={destinations}
                    categoryGroups={household.categoryGroups}
                    onValueChange={(value) => update({ destinationId: value })}
                    ariaLabel="To category"
                    placeholder="Choose destination"
                    required
                    className={field}
                  />
                </div>

                {command.action === 'recategorise' && (
                  <label className="block text-sm">
                    Month (leave blank for all)
                    <input
                      type="month"
                      className={field}
                      value={command.monthKey ?? ''}
                      onChange={(event) =>
                        update({ monthKey: event.target.value || undefined })
                      }
                    />
                  </label>
                )}

                {command.action === 'merge' && (
                  <label className="block text-sm">
                    If both categories have a budget in the same month
                    <select
                      className={field}
                      value={command.budgetConflictPolicy ?? ''}
                      onChange={(event) =>
                        update({
                          budgetConflictPolicy: (event.target.value ||
                            undefined) as ReclassificationCommand['budgetConflictPolicy'],
                        })
                      }
                    >
                      <option value="">Choose if a conflict is found</option>
                      <option value="sum">Add both budgets</option>
                      <option value="keep-destination">Keep destination budget</option>
                      <option value="keep-source">Keep source budget</option>
                    </select>
                  </label>
                )}

                {review && (
                  <div
                    ref={reviewRef}
                    tabIndex={-1}
                    className="rounded-lg border border-muted p-3 text-sm text-main"
                    role="status"
                    aria-label="Category correction preview"
                  >
                    <p>
                      {source?.name} →{' '}
                      {
                        household.categories.find(
                          (category) => category.id === command.destinationId
                        )?.name
                      }
                    </p>
                    <p>
                      {review.preview.total} references:{' '}
                      {review.preview.transactions.length} transactions,{' '}
                      {review.preview.splits.length} splits,{' '}
                      {review.preview.bills.length} bills,{' '}
                      {review.preview.incomes.length} income plans,{' '}
                      {review.preview.budgets.length} budgets.
                    </p>
                    {!!review.preview.budgetConflicts.length && (
                      <p>
                        Budget conflicts:{' '}
                        {review.preview.budgetConflicts.join(', ')}.
                      </p>
                    )}
                    <p className="mt-2">
                      Linked planned records and payment evidence are included
                      together, even across months. Amounts, dates, accounts and
                      payment links stay unchanged.
                    </p>
                  </div>
                )}
                {error && (
                  <p role="alert" className="text-danger text-sm">
                    {error}
                  </p>
                )}
              </div>
              <div className="mv-modal-footer flex gap-2 justify-end">
                <button
                  type="button"
                  className={button}
                  onClick={close}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button className={button} disabled={busy}>
                  {busy
                    ? 'Saving…'
                    : review
                      ? 'Confirm correction'
                      : 'Preview changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
