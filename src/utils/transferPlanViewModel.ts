import type {
  AccountFundingRequirement,
  Transaction,
  TransferPlanSummary,
} from '../types';
import {
  getLegacyIncomingFundingBatches,
  getTransferPlanFundingBatches,
  type TransferPlanFundingBatch,
} from './transferPlanFunding';

export type TransferPlanLifecycle =
  | 'needs_funding'
  | 'funded'
  | 'covered'
  | 'paid';

export interface TransferPlanAccountModel {
  requirement: AccountFundingRequirement;
  lifecycle: TransferPlanLifecycle;
  fundingBatches: TransferPlanFundingBatch[];
  latestFundingBatch?: TransferPlanFundingBatch;
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
  fundingBatches: TransferPlanFundingBatch[]
): TransferPlanLifecycle {
  // Payment completion is a separate final state. Funding history may still
  // exist and remains visible/auditable on a Paid card.
  if (requirement.unpaidPayments.length === 0) return 'paid';

  // Current cash sufficiency wins over historical funding. If money has since
  // left the destination account, the card must surface the new shortfall even
  // though earlier funding remains in the audit trail.
  if (requirement.transferRequiredPence > 0) return 'needs_funding';

  // A zero shortfall backed by a recognised Transfer Plan funding record is
  // Funded by Transfer. Without such a record the bills are merely covered by
  // the account's existing balance.
  if (fundingBatches.length > 0) return 'funded';

  return 'covered';
}

export function buildTransferPlanAccountModels(
  plan: TransferPlanSummary,
  transactions: Transaction[],
  month: string
): TransferPlanAccountModel[] {
  const allBatches = [
    ...getTransferPlanFundingBatches(transactions, month),
    ...getLegacyIncomingFundingBatches(transactions, month),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const batchesByDestination = new Map<string, TransferPlanFundingBatch[]>();
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
