import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/TransactionModal.tsx'),
  'utf8'
);
const sharedUi = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/UnifiedAddUi.tsx'),
  'utf8'
);
const categorySelect = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/CategorySelect.tsx'),
  'utf8'
);

describe('Activity Edit Transaction submenu audit contract', () => {
  it('preloads existing transaction facts without forcing focus and preserves historical attribution when the account is unchanged', () => {
    expect(source).toContain('setDescription(initialTransaction.description)');
    expect(source).toContain('setAmountStr((initialTransaction.amountPence / 100).toFixed(2))');
    expect(source).toContain('setCategoryId(initialTransaction.categoryId)');
    expect(source).toContain('setAccountId(initialTransaction.accountId)');
    expect(source).toContain('initialTransaction && initialTransaction.accountId === accountId');
    expect(source).toContain('? initialTransaction.payer');
    expect(source).toContain(': resolveAccountOwnerPayer(sourceAccount, members)');
    expect(source).not.toContain('setPayer(initialTransaction.payer)');
    expect(source).not.toContain('autoFocus');
  });

  it('seeds category splitting from the current category and amount instead of a blank reallocation', () => {
    expect(source).toContain('setSplits([');
    expect(source).toContain('categoryId,');
    expect(source).toContain('amountStr,');
    expect(source).toContain('originalCategoryId:');
    expect(source).not.toContain('if (!isSplitEnabled && splits.length === 0) {\n                      handleAddSplitRow();');
  });

  it('keeps split status exact and penny-safe', () => {
    expect(source).toContain('const totalPence = parseToPence(amountStr)');
    expect(source).toContain('const currentSplitsTotalPence = splits.reduce(');
    expect(source).toContain('const remainingSplitPence = totalPence - currentSplitsTotalPence');
    expect(source).toContain('splitSumPence !== pence');
  });

  it('filters category choices by transaction type and validates again on submit', () => {
    expect(source).toContain('getTransactionCategoryOptions(');
    expect(source).toContain('isTransactionCategorySelectionAllowed(');
    expect(source).toContain('Choose a category that matches the transaction type.');
    expect(source).toContain('must use a category that matches the transaction type');
  });

  it('preserves only existing historical category references when editing', () => {
    expect(source).toContain('initialTransaction && initialTransaction.type === type');
    expect(source).toContain('originalCategoryId: s.categoryId');
    expect(source).toContain('splitRow.originalCategoryId');
  });

  it('associates standard field labels and the transaction type selector accessibly without a redundant person selector', () => {
    for (const id of [
      'transaction-amount',
      'transaction-date',
      'transaction-description',
      'transaction-category',
      'transaction-notes',
    ]) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }
    expect(source).toContain('id="transaction-account"');
    expect(source).toContain('<UnifiedAddAccountField');
    expect(sharedUi).toContain('htmlFor={id}');
    expect(sharedUi).toContain('id={id}');
    expect(sharedUi).toContain('ariaLabelledBy={labelId}');
    expect(source).toContain('<UnifiedAddTypeTabs');
    expect(sharedUi).toContain('role="group" aria-labelledby={labelId}');
    expect(sharedUi).toContain('aria-pressed={activeType === type}');
    expect(source).not.toContain('transaction-person-label');
    expect(source).not.toContain('aria-pressed={payer === person}');
    expect(source).toContain('ariaLabel={`Split ${idx + 1} category`}');
    expect(categorySelect).toContain('aria-label={ariaLabel}');
  });

  it('keeps monetary entry numeric-only and spinner-free', () => {
    const blocks = source.match(/<MoneyInput[\s\S]*?\/>/g) ?? [];
    expect(blocks).toHaveLength(3);
    expect(blocks.every((block) => block.includes('type="text"'))).toBe(true);
    expect(blocks.every((block) => block.includes('inputMode="decimal"'))).toBe(true);
    expect(blocks.every((block) => !block.includes('type="number"'))).toBe(true);
    expect(source).toContain('Amount (£)');
  });
});
