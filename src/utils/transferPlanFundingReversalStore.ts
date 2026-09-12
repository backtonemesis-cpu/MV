import type { Account, Transaction } from '../types';
import { LOCAL_OWNER, mutateLocalHousehold } from '../localStore';
import {
  findLatestActiveAttributedFundingBatch,
  findLatestActiveBillFunding,
  type ActiveTransferPlanFundingRecord,
  type ActiveTransferPlanFundingShare,
} from './transferPlanFundingReversal';

function createId(prefix: string): string {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function localTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function adjustAnchoredBalanceForNewTransfer(
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

interface ReversalPurpose {
  plannedPaymentId?: string;
  paymentNameSnapshot?: string;
  sourceShare: ActiveTransferPlanFundingShare;
}

function createReversalTransactions(
  state: Parameters<Parameters<typeof mutateLocalHousehold>[2]>[0],
  activeRecord: ActiveTransferPlanFundingRecord,
  purposes: ReversalPurpose[],
  scope: 'bill' | 'batch'
): { transactions: Transaction[]; reversedPence: number } {
  const destination = state.accounts.find(
    (account) => account.id === activeRecord.record.destinationAccountId
  );
  if (!destination) throw new Error('Funding destination account is unavailable.');

  const category = state.categories.find((item) => item.id === 'cat-transfer');
  if (!category) throw new Error('Internal Transfer category is missing.');

  const prepared = purposes
    .filter((purpose) => purpose.sourceShare.activePence > 0)
    .map((purpose) => {
      const source = state.accounts.find(
        (account) => account.id === purpose.sourceShare.sourceAccountId
      );
      if (!source) throw new Error('An original funding source account is unavailable.');
      return { ...purpose, source };
    });
  if (prepared.length === 0) {
    throw new Error('No active attributed funding remains to undo.');
  }

  const date = localTodayDateKey();
  const createdAt = new Date().toISOString();
  let reversedPence = 0;
  const transactions: Transaction[] = prepared.map((purpose) => {
    const amountPence = purpose.sourceShare.activePence;
    reversedPence += amountPence;
    if (!Number.isSafeInteger(reversedPence)) {
      throw new Error('Funding reversal total exceeds safe integer pence.');
    }
    return {
      id: createId('tx'),
      date,
      description: purpose.plannedPaymentId
        ? `Undo funding: ${purpose.paymentNameSnapshot || purpose.plannedPaymentId}`
        : 'Undo Transfer Plan funding',
      amountPence,
      type: 'transfer',
      categoryId: category.id,
      accountId: destination.id,
      targetAccountId: purpose.source.id,
      payer: destination.ownerPerson || 'Joint',
      isTransfer: true,
      isRepayment: false,
      isSavings: false,
      isRefund: false,
      originalTransactionId: purpose.sourceShare.transactionId,
      metadata: {
        transferPlanFundingReversal: true,
        transferPlanFundingRecordId: activeRecord.record.id,
        transferPlanPaymentId: purpose.plannedPaymentId,
        originalFundingTransactionId: purpose.sourceShare.transactionId,
        reversalScope: scope,
      },
      createdAt,
      createdBy: LOCAL_OWNER.email,
    };
  });

  for (const transaction of transactions) {
    const source = state.accounts.find(
      (account) => account.id === transaction.targetAccountId
    )!;
    adjustAnchoredBalanceForNewTransfer(
      destination,
      -transaction.amountPence,
      transaction.date
    );
    adjustAnchoredBalanceForNewTransfer(
      source,
      transaction.amountPence,
      transaction.date
    );
  }
  state.transactions.unshift(...transactions);

  return { transactions, reversedPence };
}

export function undoAttributedTransferPlanBillFunding(
  plannedPaymentId: string,
  expectedVersion: number
): {
  reversalTransactions: Transaction[];
  fundingRecordId: string;
  reversedPence: number;
  version: number;
} {
  if (!plannedPaymentId.trim()) throw new Error('Planned payment ID is required.');

  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'transfer_plan_bill_funding_undone',
      entityType: 'planned_payment',
      entityId: plannedPaymentId,
      summary: 'Exact Transfer Plan bill funding reversed',
    },
    (state) => {
      const latest = findLatestActiveBillFunding(
        state.transferPlanFundingRecords,
        state.transactions,
        plannedPaymentId
      );
      if (!latest) {
        throw new Error(
          'No active exact bill-level funding attribution is available to undo. Nothing was changed.'
        );
      }

      const purposes: ReversalPurpose[] = latest.bill.sourceShares
        .filter((share) => share.activePence > 0)
        .map((sourceShare) => ({
          plannedPaymentId,
          paymentNameSnapshot: latest.bill.original.paymentNameSnapshot,
          sourceShare,
        }));
      const reversal = createReversalTransactions(
        state,
        latest.activeRecord,
        purposes,
        'bill'
      );
      return {
        reversalTransactions: reversal.transactions,
        fundingRecordId: latest.activeRecord.record.id,
        reversedPence: reversal.reversedPence,
      };
    }
  );

  return { ...result.value, version: result.state.version };
}

export function undoAttributedTransferPlanBatchFunding(
  destinationAccountId: string,
  month: string,
  expectedVersion: number
): {
  reversalTransactions: Transaction[];
  fundingRecordId: string;
  reversedPence: number;
  version: number;
} {
  if (!destinationAccountId.trim()) throw new Error('Destination account ID is required.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error('Transfer Plan month must use YYYY-MM format.');
  }

  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'transfer_plan_funding_undone',
      entityType: 'account',
      entityId: destinationAccountId,
      summary: `Undid remaining attributed Transfer Plan funding for ${month}`,
    },
    (state) => {
      const activeRecord = findLatestActiveAttributedFundingBatch(
        state.transferPlanFundingRecords,
        state.transactions,
        destinationAccountId,
        month
      );
      if (!activeRecord) {
        throw new Error(
          `No active exact attributed Transfer Plan funding is available to undo for this account in ${month}. Nothing was changed.`
        );
      }

      const purposes: ReversalPurpose[] = [];
      for (const bill of activeRecord.bills) {
        for (const sourceShare of bill.sourceShares) {
          if (sourceShare.activePence <= 0) continue;
          purposes.push({
            plannedPaymentId: bill.plannedPaymentId,
            paymentNameSnapshot: bill.original.paymentNameSnapshot,
            sourceShare,
          });
        }
      }
      for (const sourceShare of activeRecord.deficit?.sourceShares || []) {
        if (sourceShare.activePence <= 0) continue;
        purposes.push({ sourceShare });
      }

      const reversal = createReversalTransactions(
        state,
        activeRecord,
        purposes,
        'batch'
      );
      return {
        reversalTransactions: reversal.transactions,
        fundingRecordId: activeRecord.record.id,
        reversedPence: reversal.reversedPence,
      };
    }
  );

  return { ...result.value, version: result.state.version };
}
