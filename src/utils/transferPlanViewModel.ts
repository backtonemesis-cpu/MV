import type {
  AccountFundingRequirement,
  Transaction,
  TransferPlanFundingMutationExpectation,
  TransferPlanFundingRecord,
  TransferPlanSummary,
} from '../types';
import {
  getActiveAttributedFundingRecords,
  getTrulyLegacyFundingBatches,
} from './transferPlanFundingCompatibility';
import type { TransferPlanFundingBatch } from './transferPlanFunding';

export type TransferPlanLifecycle =
  | 'needs_funding'
  | 'funded'
  | 'covered'
  | 'paid';

export interface TransferPlanDisplayFundingBatch {
  kind: 'attributed' | TransferPlanFundingBatch['kind'];
  batchKey: string;
  destinationAccountId: string;
  createdAt: string;
  /** Active reversible amount shown in the current Transfer Plan UI. */
  totalPence: number;
  /** Immutable original batch amount retained for audit/confirmation identity. */
  originalTotalPence: number;
  sourceAccountIds: string[];
  allocations: Array<{
    sourceAccountId: string;
    amountPence: number;
  }>;
  /** Original funding transactions remain the immutable batch identity. */
  transactions: Transaction[];
  expectedUndoBatch: TransferPlanFundingMutationExpectation;
  fundingRecordId?: string;
}

export interface TransferPlanAccountModel {
  requirement: AccountFundingRequirement;
  lifecycle: TransferPlanLifecycle;
  fundingBatches: TransferPlanDisplayFundingBatch[];
  latestFundingBatch?: TransferPlanDisplayFundingBatch;
  fundingTotalPence: number;
}

export interface TransferPlanLifecycleGroups {
  needsFunding: TransferPlanAccountModel[];
  funded: TransferPlanAccountModel[];
  covered: TransferPlanAccountModel[];
  paid: TransferPlanAccountModel[];
}

function metadataString(
  transaction: Transaction,
  key: string
): string | undefined {
  const value = transaction.metadata?.[key];
  return typeof value === 'string' ? value : undefined;
}

function classifyLifecycle(
  requirement: AccountFundingRequirement,
  fundingBatches: TransferPlanDisplayFundingBatch[]
): TransferPlanLifecycle {
  // Payment completion is a separate final state. Funding history may still
  // exist and remains visible/auditable on a Paid card.
  if (requirement.unpaidPayments.length === 0) return 'paid';

  // Current cash sufficiency wins over historical funding. If money has since
  // left the destination account, the card must surface the new shortfall even
  // though earlier funding remains in the audit trail.
  if (requirement.transferRequiredPence > 0) return 'needs_funding';

  // A zero shortfall backed by active recognised Transfer Plan funding is
  // Funded by Transfer. Fully reversed attributed funding is historical only
  // and therefore does not make the current position "funded".
  if (fundingBatches.length > 0) return 'funded';

  return 'covered';
}

function legacyDisplayBatch(
  batch: TransferPlanFundingBatch
): TransferPlanDisplayFundingBatch {
  return {
    ...batch,
    originalTotalPence: batch.totalPence,
    expectedUndoBatch: {
      batchKey: batch.batchKey,
      destinationAccountId: batch.destinationAccountId,
      totalPence: batch.totalPence,
      transactionIds: batch.transactions.map((transaction) => transaction.id),
    },
  };
}

function attributedDisplayBatch(
  active: ReturnType<typeof getActiveAttributedFundingRecords>[number],
  transactionsById: Map<string, Transaction>
): TransferPlanDisplayFundingBatch {
  const activeByTransactionId = new Map<string, number>();
  const addShare = (transactionId: string, amountPence: number) => {
    if (amountPence <= 0) return;
    const next = (activeByTransactionId.get(transactionId) || 0) + amountPence;
    if (!Number.isSafeInteger(next)) {
      throw new Error('Active Transfer Plan funding exceeds safe integer pence.');
    }
    activeByTransactionId.set(transactionId, next);
  };

  for (const bill of active.bills) {
    for (const share of bill.sourceShares) {
      addShare(share.transactionId, share.activePence);
    }
  }
  for (const share of active.deficit?.sourceShares || []) {
    addShare(share.transactionId, share.activePence);
  }

  const allocations = active.record.sourceLegs
    .map((leg) => ({
      sourceAccountId: leg.sourceAccountId,
      amountPence: activeByTransactionId.get(leg.transactionId) || 0,
    }))
    .filter((allocation) => allocation.amountPence > 0);
  const originalTransactions = active.record.sourceLegs.map((leg) => {
    const transaction = transactionsById.get(leg.transactionId);
    if (!transaction) {
      throw new Error('Attributed Transfer Plan funding is missing its original transaction.');
    }
    return transaction;
  });

  return {
    kind: 'attributed',
    batchKey: active.record.id,
    destinationAccountId: active.record.destinationAccountId,
    createdAt: active.record.createdAt,
    totalPence: active.activePence,
    originalTotalPence: active.record.expectedTransferTotalPence,
    sourceAccountIds: Array.from(
      new Set(allocations.map((allocation) => allocation.sourceAccountId))
    ),
    allocations,
    transactions: originalTransactions,
    expectedUndoBatch: {
      batchKey: active.record.id,
      destinationAccountId: active.record.destinationAccountId,
      totalPence: active.record.expectedTransferTotalPence,
      transactionIds: active.record.sourceLegs.map((leg) => leg.transactionId),
    },
    fundingRecordId: active.record.id,
  };
}

function transactionLinkedAttributedDisplayBatches(
  transactions: Transaction[],
  month: string
): TransferPlanDisplayFundingBatch[] {
  const grouped = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    if (transaction.metadata?.transferPlanFundingReversal === true) continue;
    const recordId = metadataString(transaction, 'transferPlanFundingRecordId');
    if (!recordId) continue;
    const recordMonth = metadataString(transaction, 'transferPlanMonth');
    if (recordMonth !== month) continue;

    const validOriginal =
      transaction.type === 'transfer' &&
      transaction.isTransfer === true &&
      Boolean(transaction.targetAccountId) &&
      metadataString(transaction, 'transferBatchId') === recordId &&
      Number.isSafeInteger(transaction.amountPence) &&
      transaction.amountPence > 0;
    if (!validOriginal) {
      throw new Error(
        'Attributed Transfer Plan transaction metadata is inconsistent; funding cannot be displayed safely.'
      );
    }
    grouped.set(recordId, [
      ...(grouped.get(recordId) || []),
      transaction,
    ]);
  }

  const result: TransferPlanDisplayFundingBatch[] = [];
  for (const [recordId, originalTransactions] of grouped) {
    const destinationAccountId = originalTransactions[0].targetAccountId!;
    if (
      originalTransactions.some(
        (transaction) => transaction.targetAccountId !== destinationAccountId
      )
    ) {
      throw new Error(
        'Attributed Transfer Plan batch has inconsistent destinations; funding cannot be displayed safely.'
      );
    }

    const originalsById = new Map(
      originalTransactions.map((transaction) => [transaction.id, transaction])
    );
    const reversedByOriginalId = new Map<string, number>();

    for (const reversal of transactions) {
      if (
        reversal.metadata?.transferPlanFundingReversal !== true ||
        metadataString(reversal, 'transferPlanFundingRecordId') !== recordId
      ) {
        continue;
      }
      const originalId = metadataString(
        reversal,
        'originalFundingTransactionId'
      );
      const original = originalId ? originalsById.get(originalId) : undefined;
      const validReversal =
        Boolean(original) &&
        reversal.type === 'transfer' &&
        reversal.isTransfer === true &&
        reversal.accountId === destinationAccountId &&
        reversal.targetAccountId === original!.accountId &&
        Number.isSafeInteger(reversal.amountPence) &&
        reversal.amountPence > 0 &&
        (reversal.originalTransactionId === undefined ||
          reversal.originalTransactionId === originalId);
      if (!validReversal || !originalId || !original) {
        throw new Error(
          'Attributed Transfer Plan reversal linkage is inconsistent; funding cannot be displayed safely.'
        );
      }

      const nextReversed =
        (reversedByOriginalId.get(originalId) || 0) + reversal.amountPence;
      if (
        !Number.isSafeInteger(nextReversed) ||
        nextReversed > original.amountPence
      ) {
        throw new Error(
          'Attributed Transfer Plan reversal exceeds original funding; funding cannot be displayed safely.'
        );
      }
      reversedByOriginalId.set(originalId, nextReversed);
    }

    let originalTotalPence = 0;
    let activeTotalPence = 0;
    const activeBySource = new Map<string, number>();

    for (const original of originalTransactions) {
      originalTotalPence += original.amountPence;
      const activePence =
        original.amountPence - (reversedByOriginalId.get(original.id) || 0);
      activeTotalPence += activePence;
      if (
        !Number.isSafeInteger(originalTotalPence) ||
        !Number.isSafeInteger(activeTotalPence)
      ) {
        throw new Error('Transfer Plan funding exceeds safe integer pence.');
      }
      if (activePence <= 0) continue;
      const nextSourceTotal =
        (activeBySource.get(original.accountId) || 0) + activePence;
      if (!Number.isSafeInteger(nextSourceTotal)) {
        throw new Error('Transfer Plan source funding exceeds safe integer pence.');
      }
      activeBySource.set(original.accountId, nextSourceTotal);
    }

    if (activeTotalPence <= 0) continue;

    const allocations = Array.from(activeBySource.entries()).map(
      ([sourceAccountId, amountPence]) => ({ sourceAccountId, amountPence })
    );
    const createdAt = originalTransactions.reduce(
      (latest, transaction) =>
        (transaction.createdAt || transaction.date) > latest
          ? transaction.createdAt || transaction.date
          : latest,
      ''
    );

    result.push({
      kind: 'attributed',
      batchKey: recordId,
      destinationAccountId,
      createdAt,
      totalPence: activeTotalPence,
      originalTotalPence,
      sourceAccountIds: allocations.map(
        (allocation) => allocation.sourceAccountId
      ),
      allocations,
      transactions: originalTransactions,
      expectedUndoBatch: {
        batchKey: recordId,
        destinationAccountId,
        totalPence: originalTotalPence,
        transactionIds: originalTransactions.map(
          (transaction) => transaction.id
        ),
      },
      fundingRecordId: recordId,
    });
  }

  return result;
}

export function buildTransferPlanAccountModels(
  plan: TransferPlanSummary,
  transactions: Transaction[],
  month: string,
  fundingRecords?: TransferPlanFundingRecord[]
): TransferPlanAccountModel[] {
  const transactionsById = new Map(
    transactions.map((transaction) => [transaction.id, transaction])
  );
  const attributedBatches =
    fundingRecords === undefined
      ? transactionLinkedAttributedDisplayBatches(transactions, month)
      : getActiveAttributedFundingRecords(fundingRecords, transactions, month).map(
          (active) => attributedDisplayBatch(active, transactionsById)
        );
  const legacyTransactions =
    fundingRecords === undefined
      ? transactions.filter(
          (transaction) =>
            !metadataString(transaction, 'transferPlanFundingRecordId')
        )
      : transactions;
  const allBatches: TransferPlanDisplayFundingBatch[] = [
    ...attributedBatches,
    ...getTrulyLegacyFundingBatches(
      fundingRecords,
      legacyTransactions,
      month
    ).map(legacyDisplayBatch),
  ].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) ||
      b.batchKey.localeCompare(a.batchKey)
  );

  const batchesByDestination = new Map<
    string,
    TransferPlanDisplayFundingBatch[]
  >();
  for (const batch of allBatches) {
    const current = batchesByDestination.get(batch.destinationAccountId) || [];
    current.push(batch);
    batchesByDestination.set(batch.destinationAccountId, current);
  }

  const requirements = [
    ...plan.accountsNeedingFunding,
    ...plan.accountsFullyFunded,
  ];

  return requirements.map((requirement) => {
    const fundingBatches =
      batchesByDestination.get(requirement.account.id) || [];

    return {
      requirement,
      lifecycle: classifyLifecycle(requirement, fundingBatches),
      fundingBatches,
      latestFundingBatch: fundingBatches[0],
      fundingTotalPence: fundingBatches.reduce(
        (sum, batch) => sum + batch.totalPence,
        0
      ),
    };
  });
}

export function groupTransferPlanAccountModels(
  models: TransferPlanAccountModel[]
): TransferPlanLifecycleGroups {
  return {
    needsFunding: models.filter((model) => model.lifecycle === 'needs_funding'),
    funded: models.filter((model) => model.lifecycle === 'funded'),
    covered: models.filter((model) => model.lifecycle === 'covered'),
    paid: models.filter((model) => model.lifecycle === 'paid'),
  };
}
