import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateMonthlyLedger,
  calculateSurplusPence,
  formatPence,
  parseMoneyToPence,
} from '../src/calculations.js';

test('money parsing preserves exact pennies without binary floating point arithmetic', () => {
  assert.equal(parseMoneyToPence('1714.02'), 171402);
  assert.equal(parseMoneyToPence('0.10'), 10);
  assert.equal(parseMoneyToPence('12.3'), 1230);
  assert.equal(formatPence(171402), '£1714.02');
});

test('available surplus follows the MV formula in integer pence', () => {
  assert.equal(calculateSurplusPence({
    actualIncomePence: 300000,
    refundsPence: 5000,
    fixedBillsPence: 120000,
    grossSpendingPence: 80000,
  }), 105000);
});

test('internal, savings and card repayment movements do not double count income or spending', () => {
  const totals = aggregateMonthlyLedger([
    { kind: 'income', status: 'received', amountPence: 250000 },
    { kind: 'fixed-bill', amountPence: 100000 },
    { kind: 'spending', amountPence: 30000 },
    { kind: 'refund', amountPence: 2500 },
    { kind: 'internal-transfer', amountPence: 50000 },
    { kind: 'savings-transfer', amountPence: 60000 },
    { kind: 'card-repayment', amountPence: 30000 },
  ]);

  assert.deepEqual(totals, {
    expectedIncomePence: 0,
    actualIncomePence: 250000,
    fixedBillsPence: 100000,
    grossSpendingPence: 30000,
    refundsPence: 2500,
    availableSurplusPence: 122500,
  });
});

test('expected income is visible but does not inflate actual available surplus', () => {
  const totals = aggregateMonthlyLedger([
    { kind: 'income', status: 'expected', amountPence: 100000 },
  ]);
  assert.equal(totals.expectedIncomePence, 100000);
  assert.equal(totals.actualIncomePence, 0);
  assert.equal(totals.availableSurplusPence, 0);
});
