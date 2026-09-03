import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFinancialRecord } from '../src/records.js';

test('valid record keeps integer pence and normalized optional values', () => {
  const record = validateFinancialRecord({
    kind: 'spending',
    monthKey: '2026-09',
    amountPence: 4560,
    description: ' Tesco ',
    category: ' Groceries ',
  });
  assert.equal(record.amountPence, 4560);
  assert.equal(record.description, 'Tesco');
  assert.equal(record.category, 'Groceries');
});

test('rejects floating-point money and malformed months', () => {
  assert.throws(() => validateFinancialRecord({
    kind: 'spending', monthKey: '2026-9', amountPence: 12.34, description: 'Bad',
  }));
});
