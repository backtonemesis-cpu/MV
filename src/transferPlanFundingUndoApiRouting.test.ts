import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const api = fs.readFileSync(
  path.resolve(process.cwd(), 'src/utils/api.ts'),
  'utf8'
);

describe('GA-TP-002 unified Undo Funding API routing', () => {
  it('routes card Undo Funding through the attributed/legacy compatibility layer', () => {
    expect(api).toContain(
      "import { undoCompatibleTransferPlanFunding } from './transferPlanFundingUndoCompatibilityStore';"
    );
    expect(api).toContain(
      'return undoCompatibleTransferPlanFunding(\n    destinationAccountId,\n    month,\n    expectedVersion,\n    expectedBatch\n  );'
    );
    expect(api).not.toContain('undoLatestLocalTransferPlanFunding,');
    expect(api).not.toContain(
      'return undoLatestLocalTransferPlanFunding(\n    destinationAccountId,\n    expectedVersion,\n    month,\n    expectedBatch\n  );'
    );
    expect(api).toContain('return executeLocalTransferAllocations(transfer, expectedVersion);');
  });
});
