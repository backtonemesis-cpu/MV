import type { Transaction } from '../types';

export interface TransferPlanFundingBatch {
  kind: 'transfer_plan' | 'legacy_incoming';
  batchKey: string;
  destinationAccountId: string;
  createdAt: string;
  totalPence: number;
  sourceAccountIds: string[];
  allocations: Array<{
    sourceAccountId: string;
    amountPence: number;
  }>;
  transactions: Transaction[];
}

export function getTransferPlanFundingMonth(transaction: Transaction): string {
  return (
    (transaction.metadata?.transferPlanMonth as string | undefined) ||
    transaction.date.slice(0, 7)
  );
}

export function isTransferPlanFundingTransaction(transaction: Transaction): boolean {
  if (
    transaction.type !== 'transfer' ||
    !transaction.isTransfer ||
    !transaction.targetAccountId
  ) {
    return false;
  }

  return (
    Boolean(transaction.metadata?.transferBatchId) ||
    Boolean(transaction.metadata?.transferPlanMonth) ||
    transaction.description.startsWith('Transfer Plan:')
  );
}

export function getTransferPlanFundingBatches(
  transactions: Transaction[],
  month?: string
): TransferPlanFundingBatch[] {
  const candidates = transactions.filter(
    (transaction) =>
      isTransferPlanFundingTransaction(transaction) &&
      (!month || getTransferPlanFundingMonth(transaction) === month)
  );

  const grouped = new Map<string, Transaction[]>();

  for (const transaction of candidates) {
    const destinationAccountId = transaction.targetAccountId!;
    const transferBatchId = transaction.metadata?.transferBatchId as string | undefined;
    const batchKey = transferBatchId || transaction.id;
    const key = `${destinationAccountId}::${batchKey}`;
    grouped.set(key, [...(grouped.get(key) || []), transaction]);
  }

  return Array.from(grouped.entries())
    .map(([key, batchTransactions]) => {
      const destinationAccountId = batchTransactions[0].targetAccountId!;
      const batchKey = key.slice(key.indexOf('::') + 2);
      const createdAt = batchTransactions.reduce(
        (latest, transaction) =>
          (transaction.createdAt || transaction.date) > latest
            ? transaction.createdAt || transaction.date
            : latest,
        ''
      );

      return {
        kind: 'transfer_plan' as const,
        batchKey,
        destinationAccountId,
        createdAt,
        totalPence: batchTransactions.reduce(
          (sum, transaction) => sum + transaction.amountPence,
          0
        ),
        sourceAccountIds: Array.from(
          new Set(batchTransactions.map((transaction) => transaction.accountId))
        ),
        allocations: batchTransactions.map((transaction) => ({
          sourceAccountId: transaction.accountId,
          amountPence: transaction.amountPence,
        })),
        transactions: batchTransactions,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLegacyIncomingFundingBatches(
  transactions: Transaction[],
  month?: string
): TransferPlanFundingBatch[] {
  return transactions
    .filter((transaction) => {
      if (
        transaction.type !== 'transfer' ||
        !transaction.isTransfer ||
        !transaction.targetAccountId ||
        isTransferPlanFundingTransaction(transaction)
      ) {
        return false;
      }

      return !month || transaction.date.slice(0, 7) === month;
    })
    .map((transaction) => ({
      kind: 'legacy_incoming' as const,
      batchKey: transaction.id,
      destinationAccountId: transaction.targetAccountId!,
      createdAt: transaction.createdAt || transaction.date,
      totalPence: transaction.amountPence,
      sourceAccountIds: [transaction.accountId],
      allocations: [
        {
          sourceAccountId: transaction.accountId,
          amountPence: transaction.amountPence,
        },
      ],
      transactions: [transaction],
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLatestTransferPlanFundingByDestination(
  transactions: Transaction[],
  month?: string,
  includeLegacyIncoming = false
): Map<string, TransferPlanFundingBatch> {
  const result = new Map<string, TransferPlanFundingBatch>();

  for (const batch of getTransferPlanFundingBatches(transactions, month)) {
    if (!result.has(batch.destinationAccountId)) {
      result.set(batch.destinationAccountId, batch);
    }
  }

  if (includeLegacyIncoming) {
    for (const batch of getLegacyIncomingFundingBatches(transactions, month)) {
      // A tagged/recognised Transfer Plan batch always wins. Legacy incoming
      // transfers are only a compatibility fallback for older test data.
      if (!result.has(batch.destinationAccountId)) {
        result.set(batch.destinationAccountId, batch);
      }
    }
  }

  return result;
}

export function findLatestTransferPlanFundingBatch(
  transactions: Transaction[],
  destinationAccountId: string,
  month?: string,
  includeLegacyIncoming = false
): TransferPlanFundingBatch | undefined {
  return getLatestTransferPlanFundingByDestination(
    transactions,
    month,
    includeLegacyIncoming
  ).get(destinationAccountId);
}
