import type {
  Account,
  Transaction,
  TransferPlanFundingMutationExpectation,
} from '../types';
import { loadLocalHousehold, mutateLocalHousehold } from '../localStore';
import { getLatestReversibleFundingEvidence } from './transferPlanFundingCompatibility';
import { undoAttributedTransferPlanBatchFunding } from './transferPlanFundingReversalStore';

function adjustAnchoredBalanceForReversal(
  account: Account,
  deltaPence: number,
  transferDate: string
): void {
  if (
    account.reconciliationDate &&
    Number.isSafeInteger(account.reconciledBalancePence) &&
    transferDate <= account.reconciliationDate
  ) {
    account.reconciledBalancePence = account.reconciledBalancePence! + deltaPence;
  }
}

function sameIds(actual: string[], expected: string[]): boolean {
  const actualSorted = [...actual].sort();
  const expectedSorted = [...expected].sort();
  return (
    actualSorted.length === expectedSorted.length &&
    actualSorted.every((id, index) => id === expectedSorted[index])
  );
}

function expectationChangedError(): Error {
  return new Error(
    'Transfer Plan funding changed after the confirmation was opened. Refresh and review the current funding before trying again. Nothing was changed.'
  );
}

function assertExpectedAttributedBatch(
  expected: TransferPlanFundingMutationExpectation,
  destinationAccountId: string,
  record: {
    id: string;
    destinationAccountId: string;
    expectedTransferTotalPence: number;
    sourceLegs: Array<{ transactionId: string }>;
  }
): void {
  const same =
    expected.batchKey === record.id &&
    expected.destinationAccountId === destinationAccountId &&
    record.destinationAccountId === destinationAccountId &&
    expected.totalPence === record.expectedTransferTotalPence &&
    sameIds(
      record.sourceLegs.map((share) => share.transactionId),
      expected.transactionIds
    );
  if (!same) throw expectationChangedError();
}

function assertExpectedLegacyBatch(
  expected: TransferPlanFundingMutationExpectation,
  destinationAccountId: string,
  batch: {
    batchKey: string;
    destinationAccountId: string;
    totalPence: number;
    transactions: Transaction[];
  }
): void {
  const same =
    expected.batchKey === batch.batchKey &&
    expected.destinationAccountId === destinationAccountId &&
    batch.destinationAccountId === destinationAccountId &&
    expected.totalPence === batch.totalPence &&
    sameIds(
      batch.transactions.map((transaction) => transaction.id),
      expected.transactionIds
    );
  if (!same) throw expectationChangedError();
}

function undoExactLegacyFundingBatch(
  destinationAccountId: string,
  expectedVersion: number,
  month: string,
  batch: {
    batchKey: string;
    destinationAccountId: string;
    totalPence: number;
    transactions: Transaction[];
  }
): {
  undoneTransactions: Transaction[];
  reversedPence: number;
  mode: 'legacy';
  version: number;
} {
  const targetTransactions = batch.transactions;
  const targetIds = new Set(targetTransactions.map((transaction) => transaction.id));

  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'transfer_plan_funding_undone',
      entityType: 'account',
      entityId: destinationAccountId,
      summary: `Undid legacy Transfer Plan funding for destination account in ${month}`,
      details: {
        compatibilityMode: 'legacy_exact_batch',
        batchKey: batch.batchKey,
      },
    },
    (state) => {
      const destination = state.accounts.find(
        (account) => account.id === destinationAccountId
      );
      if (!destination) throw new Error('Destination account is unavailable.');

      const actualTransactions = state.transactions.filter((transaction) =>
        targetIds.has(transaction.id)
      );
      if (
        actualTransactions.length !== targetTransactions.length ||
        !sameIds(
          actualTransactions.map((transaction) => transaction.id),
          targetTransactions.map((transaction) => transaction.id)
        )
      ) {
        throw new Error(
          'Transfer Plan funding changed before it could be undone. Refresh and try again. Nothing was changed.'
        );
      }

      let destinationTotalPence = 0;
      for (const transaction of actualTransactions) {
        if (
          transaction.targetAccountId !== destinationAccountId ||
          transaction.type !== 'transfer' ||
          !transaction.isTransfer ||
          transaction.metadata?.transferPlanFundingReversal === true
        ) {
          throw new Error(
            'Legacy Transfer Plan funding evidence is no longer safe to reverse. Nothing was changed.'
          );
        }
        const source = state.accounts.find(
          (account) => account.id === transaction.accountId
        );
        if (!source) throw new Error('A funding source account is unavailable.');

        adjustAnchoredBalanceForReversal(
          source,
          transaction.amountPence,
          transaction.date
        );
        destinationTotalPence += transaction.amountPence;
        if (!Number.isSafeInteger(destinationTotalPence)) {
          throw new Error('Funding reversal total exceeds safe integer pence.');
        }
      }

      if (destinationTotalPence !== batch.totalPence) {
        throw new Error(
          'Legacy Transfer Plan funding amount changed before it could be undone. Nothing was changed.'
        );
      }

      adjustAnchoredBalanceForReversal(
        destination,
        -destinationTotalPence,
        actualTransactions[0].date
      );
      state.transactions = state.transactions.filter(
        (transaction) => !targetIds.has(transaction.id)
      );

      return actualTransactions;
    }
  );

  return {
    undoneTransactions: result.value,
    reversedPence: batch.totalPence,
    mode: 'legacy',
    version: result.state.version,
  };
}

export function undoCompatibleTransferPlanFunding(
  destinationAccountId: string,
  month: string,
  expectedVersion: number,
  expectedBatch?: TransferPlanFundingMutationExpectation
): {
  undoneTransactions: Transaction[];
  reversedPence: number;
  mode: 'attributed' | 'legacy';
  fundingRecordId?: string;
  version: number;
} {
  if (!destinationAccountId.trim()) {
    throw new Error('Destination account ID is required.');
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('Transfer Plan month must use YYYY-MM format.');
  }

  const current = loadLocalHousehold();
  const evidence = getLatestReversibleFundingEvidence(
    current.transferPlanFundingRecords,
    current.transactions,
    destinationAccountId,
    month
  );
  if (!evidence) {
    throw new Error(
      `No active Transfer Plan funding is available to undo for this account in ${month}. Nothing was changed.`
    );
  }

  if (evidence.kind === 'attributed') {
    if (expectedBatch) {
      assertExpectedAttributedBatch(
        expectedBatch,
        destinationAccountId,
        evidence.activeRecord.record
      );
    }
    const reversed = undoAttributedTransferPlanBatchFunding(
      destinationAccountId,
      month,
      expectedVersion
    );
    return {
      undoneTransactions: reversed.reversalTransactions,
      reversedPence: reversed.reversedPence,
      mode: 'attributed',
      fundingRecordId: reversed.fundingRecordId,
      version: reversed.version,
    };
  }

  if (expectedBatch) {
    assertExpectedLegacyBatch(
      expectedBatch,
      destinationAccountId,
      evidence.batch
    );
  }
  return undoExactLegacyFundingBatch(
    destinationAccountId,
    expectedVersion,
    month,
    evidence.batch
  );
}
