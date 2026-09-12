import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const api = fs.readFileSync(
  path.resolve(process.cwd(), 'src/utils/api.ts'),
  'utf8'
);

describe('GA-TP-002 Transfer Plan funding API routing', () => {
  it('routes attributed Record Funding and compatible card Undo Funding through their proven stores', () => {
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
  });
});
