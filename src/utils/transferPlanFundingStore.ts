import type { Account, PlannedPayment, Transaction, TransferPlanFundingRecord } from '../types';
import { LOCAL_OWNER, mutateLocalHousehold } from '../localStore';
import { calculateAccountFunding } from './transferPlan';
import { buildTransferPlanFundingRecord } from './transferPlanFundingAttribution';

export interface AttributedTransferPlanAllocationPayload {
  destinationAccountId: string;
  expectedTotalPence: number;
  allocations: Array<{
    sourceAccountId: string;
    amountPence: number;
  }>;
  description?: string;
  date?: string;
  month: string;
}

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

function isSafePence(value: unknown): value is number {
  return Number.isSafeInteger(value);
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

export function executeAttributedTransferPlanAllocations(
  payload: AttributedTransferPlanAllocationPayload,
  expectedVersion: number
): {
  transactions: Transaction[];
  fundingRecord: TransferPlanFundingRecord;
  version: number;
} {
  if (!Array.isArray(payload.allocations) || payload.allocations.length === 0) {
    throw new Error('At least one funding allocation is required.');
  }
  if (!isSafePence(payload.expectedTotalPence) || payload.expectedTotalPence <= 0) {
    throw new Error('Required transfer total must be exact positive integer pence.');
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(payload.month)) {
    throw new Error('Transfer Plan month must use YYYY-MM format.');
  }

  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'transfer_plan_funded',
      entityType: 'account',
      entityId: payload.destinationAccountId,
      summary: `Transfer Plan funding allocated across ${payload.allocations.length} source account${
        payload.allocations.length === 1 ? '' : 's'
      } with exact bill attribution`,
    },
    (state) => {
      const destination = state.accounts.find(
        (account) => account.id === payload.destinationAccountId
      );
      if (!destination || destination.isActive === false) {
        throw new Error('Destination account is unavailable.');
      }

      const planMonthPayments = state.plannedPayments.filter(
        (payment) => payment.month === payload.month
      );
      const selectedUnpaidPayments: PlannedPayment[] = planMonthPayments.filter(
        (payment) =>
          payment.accountId === destination.id &&
          payment.status === 'unpaid' &&
          payment.includeInTransferPlan === true
      );
      const currentRequirement = calculateAccountFunding(
        destination,
        planMonthPayments,
        state.transactions
      );
      if (currentRequirement.transferRequiredPence !== payload.expectedTotalPence) {
        throw new Error(
          `Transfer Plan funding changed before submission. Current requirement is ${currentRequirement.transferRequiredPence} pence; refresh the plan before funding.`
        );
      }

      const category = state.categories.find((item) => item.id === 'cat-transfer');
      if (!category) throw new Error('Internal Transfer category is missing.');

      const seenSources = new Set<string>();
      let allocatedTotalPence = 0;
      const validated = payload.allocations.map((allocation) => {
        if (seenSources.has(allocation.sourceAccountId)) {
          throw new Error('Each funding account can only appear once in an allocation.');
        }
        seenSources.add(allocation.sourceAccountId);

        if (allocation.sourceAccountId === payload.destinationAccountId) {
          throw new Error('A funding source cannot be the same as the destination account.');
        }
        if (!isSafePence(allocation.amountPence) || allocation.amountPence <= 0) {
          throw new Error('Every funding allocation must be exact positive integer pence.');
        }

        const source = state.accounts.find(
          (account) => account.id === allocation.sourceAccountId
        );
        if (!source || source.isActive === false) {
          throw new Error('One of the funding source accounts is unavailable.');
        }
        if (source.type === 'credit') {
          throw new Error('Credit accounts cannot be used as Transfer Plan funding sources.');
        }

        const reservedPlanPence = calculateAccountFunding(
          source,
          planMonthPayments,
          state.transactions
        ).totalUnpaidSelectedPaymentsPence;
        const safeToMovePence = Math.max(
          0,
          source.currentBalancePence - reservedPlanPence
        );
        if (safeToMovePence < allocation.amountPence) {
          throw new Error(
            `${source.name} has only ${safeToMovePence} pence safe to move after its own selected unpaid bills.`
          );
        }

        allocatedTotalPence += allocation.amountPence;
        if (!Number.isSafeInteger(allocatedTotalPence)) {
          throw new Error('Funding allocation total exceeds safe integer pence.');
        }
        return { source, amountPence: allocation.amountPence };
      });

      if (allocatedTotalPence !== payload.expectedTotalPence) {
        throw new Error(
          `Funding allocations must total exactly ${payload.expectedTotalPence} pence.`
        );
      }

      const batchId = createId('transfer-batch');
      const createdAt = new Date().toISOString();
      const date = payload.date || localTodayDateKey();
      const transactionDrafts = validated.map(({ source, amountPence }, index) => ({
        id: createId('tx'),
        source,
        amountPence,
        allocationIndex: index,
      }));

      const fundingRecord = buildTransferPlanFundingRecord({
        id: batchId,
        month: payload.month,
        destinationAccountId: destination.id,
        destinationBalanceBeforePence: destination.currentBalancePence,
        expectedTransferTotalPence: payload.expectedTotalPence,
        sourceLegs: transactionDrafts.map(({ id, source, amountPence }) => ({
          transactionId: id,
          sourceAccountId: source.id,
          amountPence,
        })),
        selectedUnpaidPayments,
        createdAt,
        createdBy: LOCAL_OWNER.email,
      });

      for (const { source, amountPence } of validated) {
        const draftSource = state.accounts.find((account) => account.id === source.id)!;
        adjustAnchoredBalanceForNewTransfer(draftSource, -amountPence, date);
      }
      adjustAnchoredBalanceForNewTransfer(destination, allocatedTotalPence, date);

      const transactions: Transaction[] = transactionDrafts.map(
        ({ id, source, amountPence, allocationIndex }) => ({
          id,
          date,
          description:
            payload.description || `Transfer Plan: Fund ${destination.name}`,
          amountPence,
          type: 'transfer',
          categoryId: category.id,
          accountId: source.id,
          targetAccountId: destination.id,
          payer: source.ownerPerson || 'Joint',
          isTransfer: true,
          isRepayment: false,
          isSavings: false,
          isRefund: false,
          metadata: {
            transferBatchId: batchId,
            transferPlanMonth: payload.month,
            allocationIndex,
            allocationCount: validated.length,
            transferPlanFundingRecordId: fundingRecord.id,
          },
          createdAt,
          createdBy: LOCAL_OWNER.email,
        })
      );

      state.transactions.unshift(...transactions);
      state.transferPlanFundingRecords = [
        fundingRecord,
        ...(state.transferPlanFundingRecords || []),
      ];

      return { transactions, fundingRecord };
    }
  );

  return { ...result.value, version: result.state.version };
}
