import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const modal = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/UndoFundingModal.tsx'),
  'utf8'
);

describe('GA-TP-002 Undo Funding confirmation fingerprint', () => {
  it('displays active funding but submits immutable original batch identity', () => {
    expect(modal).toContain(
      'const expectedBatch = latestFundingBatch.expectedUndoBatch;'
    );
    expect(modal).toContain(
      '{formatPence(latestFundingBatch.totalPence)}'
    );
    expect(modal).not.toContain(
      'totalPence: latestFundingBatch.totalPence'
    );
    expect(modal).not.toContain(
      'transactionIds: latestFundingBatch.transactions.map'
    );
  });
});
