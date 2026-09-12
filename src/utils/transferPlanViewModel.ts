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

export function buildTransferPlanAccountModels(
  plan: TransferPlanSummary,
  transactions: Transaction[],
  month: string,
  fundingRecords?: TransferPlanFundingRecord[]
): TransferPlanAccountModel[] {
  const transactionsById = new Map(
    transactions.map((transaction) => [transaction.id, transaction])
  );
  const allBatches: TransferPlanDisplayFundingBatch[] = [
    ...getActiveAttributedFundingRecords(fundingRecords, transactions, month).map(
      (active) => attributedDisplayBatch(active, transactionsById)
    ),
    ...getTrulyLegacyFundingBatches(fundingRecords, transactions, month).map(
      legacyDisplayBatch
    ),
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
