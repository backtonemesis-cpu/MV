const MONEY_RE = /^-?\d+(?:\.\d{1,2})?$/;

export function parseMoneyToPence(value) {
  if (Number.isSafeInteger(value)) return value;
  if (typeof value !== 'string') throw new TypeError('Money must be supplied as a decimal string or integer pence.');
  const input = value.trim();
  if (!MONEY_RE.test(input)) throw new TypeError(`Invalid money value: ${value}`);
  const negative = input.startsWith('-');
  const unsigned = negative ? input.slice(1) : input;
  const [pounds, pennies = ''] = unsigned.split('.');
  const result = (Number(pounds) * 100) + Number(pennies.padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) throw new RangeError('Money value exceeds safe integer range.');
  return negative ? -result : result;
}

export function formatPence(pence) {
  assertPence(pence, { allowNegative: true });
  const sign = pence < 0 ? '-' : '';
  const absolute = Math.abs(pence);
  return `${sign}£${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

export function assertPence(value, { allowNegative = false } = {}) {
  if (!Number.isSafeInteger(value)) throw new TypeError('Money values must be safe integer pence.');
  if (!allowNegative && value < 0) throw new RangeError('Money values cannot be negative.');
  return value;
}

export function calculateSurplusPence({
  actualIncomePence = 0,
  refundsPence = 0,
  fixedBillsPence = 0,
  grossSpendingPence = 0,
} = {}) {
  [actualIncomePence, refundsPence, fixedBillsPence, grossSpendingPence]
    .forEach((value) => assertPence(value));
  return actualIncomePence + refundsPence - fixedBillsPence - grossSpendingPence;
}

export function aggregateMonthlyLedger(entries = []) {
  const totals = {
    expectedIncomePence: 0,
    actualIncomePence: 0,
    fixedBillsPence: 0,
    grossSpendingPence: 0,
    refundsPence: 0,
  };

  for (const entry of entries) {
    const amountPence = assertPence(entry.amountPence ?? 0);

    switch (entry.kind) {
      case 'income':
        if (entry.status === 'expected') totals.expectedIncomePence += amountPence;
        if (entry.status === 'received') totals.actualIncomePence += amountPence;
        break;
      case 'fixed-bill':
        totals.fixedBillsPence += amountPence;
        break;
      case 'spending':
        totals.grossSpendingPence += amountPence;
        break;
      case 'refund':
        totals.refundsPence += amountPence;
        break;
      case 'internal-transfer':
      case 'savings-transfer':
      case 'card-repayment':
        break;
      default:
        throw new TypeError(`Unknown ledger kind: ${entry.kind}`);
    }
  }

  return {
    ...totals,
    availableSurplusPence: calculateSurplusPence(totals),
  };
}
