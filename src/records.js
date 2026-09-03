import { assertPence } from './calculations.js';

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const RECORD_KINDS = new Set([
  'income',
  'fixed-bill',
  'spending',
  'refund',
  'internal-transfer',
  'savings-transfer',
  'card-repayment',
]);

export function assertMonthKey(monthKey) {
  if (typeof monthKey !== 'string' || !MONTH_KEY_RE.test(monthKey)) {
    throw new TypeError('monthKey must use YYYY-MM format.');
  }
  return monthKey;
}

export function validateFinancialRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new TypeError('Record must be an object.');
  if (!RECORD_KINDS.has(record.kind)) throw new TypeError(`Unsupported record kind: ${record.kind}`);
  assertMonthKey(record.monthKey);
  assertPence(record.amountPence);
  if (typeof record.description !== 'string' || !record.description.trim()) throw new TypeError('description is required.');

  if (record.kind === 'income' && !['expected', 'received'].includes(record.status)) {
    throw new TypeError('Income status must be expected or received.');
  }

  return {
    kind: record.kind,
    monthKey: record.monthKey,
    amountPence: record.amountPence,
    description: record.description.trim(),
    status: record.status ?? null,
    category: typeof record.category === 'string' && record.category.trim() ? record.category.trim() : null,
    accountId: typeof record.accountId === 'string' && record.accountId.trim() ? record.accountId.trim() : null,
    personId: typeof record.personId === 'string' && record.personId.trim() ? record.personId.trim() : null,
    exactDate: typeof record.exactDate === 'string' && record.exactDate.trim() ? record.exactDate.trim() : null,
    notes: typeof record.notes === 'string' && record.notes.trim() ? record.notes.trim() : null,
  };
}
