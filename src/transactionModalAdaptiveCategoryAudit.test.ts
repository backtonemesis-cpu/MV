import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const modal = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/TransactionModal.tsx'),
  'utf8'
);

describe('TransactionModal adaptive category selectors', () => {
  it('routes unified Bill categories through the adaptive field without changing bill eligibility validation', () => {
    expect(modal).toContain('id="unified-bill-category"');
    expect(modal).toContain('categories={billCategoryOptions}');
    expect(modal).toContain('categoryGroups={categoryGroups}');
    expect(modal).toContain('onValueChange={setCategoryId}');
    expect(modal).toContain('isBillCategorySelectionAllowed(categories, categoryId)');
    expect(modal).not.toMatch(/<select[^>]*id="unified-bill-category"/);
  });

  it('routes the main transaction category through authoritative type-scoped options and validation', () => {
    expect(modal).toContain('const transactionCategoryOptions = getTransactionCategoryOptions(');
    expect(modal).toContain('id="transaction-category"');
    expect(modal).toContain('categories={transactionCategoryOptions}');
    expect(modal).toContain('onValueChange={setCategoryId}');
    expect(modal).toContain('isTransactionCategorySelectionAllowed(categories, type, categoryId, preservedHistoricalCategoryIds)');
    expect(modal).not.toMatch(/<select[^>]*id="transaction-category"/);
  });

  it('routes split categories through the same authoritative eligibility source and preserves historical split ids', () => {
    expect(modal).toContain('id={`transaction-split-category-${idx}`}');
    expect(modal).toContain('categories={getTransactionCategoryOptions(');
    expect(modal).toContain('initialTransaction?.type === type && splitRow.originalCategoryId');
    expect(modal).toContain('? [splitRow.originalCategoryId]');
    expect(modal).toContain("handleUpdateSplitRow(idx, 'categoryId', value)");
    expect(modal).toContain('isTransactionCategorySelectionAllowed(');
    expect(modal).toContain('item.originalCategoryId');
  });

  it('preserves exact category ids in transaction and split writes', () => {
    expect(modal).toContain('categoryId: isTransfer ? undefined : categoryId || undefined');
    expect(modal).toContain('categoryId: item.categoryId');
    expect(modal).toContain('splits: finalSplits');
  });

  it('does not change account, date, amount, repayment or submit semantics', () => {
    expect(modal).toContain('id="transaction-date"');
    expect(modal).toContain('<MoneyInput');
    expect(modal).toContain('setAccountId(nextAccountId)');
    expect(modal).toContain('repaymentAmountBlocked');
    expect(modal).toContain('await onSave({');
    expect(modal).toContain('await onSaveBill({');
  });
});
