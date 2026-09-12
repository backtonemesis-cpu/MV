import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const api = fs.readFileSync(
  path.resolve(process.cwd(), 'src/utils/api.ts'),
  'utf8'
);

describe('GA-TP-002 live funding routing', () => {
  it('routes Transfer Plan allocations through the atomic attribution writer', () => {
    expect(api).toContain(
      "import { executeAttributedTransferPlanAllocations } from './transferPlanFundingStore';"
    );
    expect(api).toContain(
      'return executeAttributedTransferPlanAllocations(transfer, expectedVersion);'
    );
    expect(api).not.toContain('executeLocalTransferAllocations,');
    expect(api).not.toContain(
      'return executeLocalTransferAllocations(transfer, expectedVersion);'
    );
  });
});
