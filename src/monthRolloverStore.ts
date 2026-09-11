import type { PlannedIncome, PlannedPayment } from './types';
import { LOCAL_OWNER, mutateLocalHousehold } from './localStore';
import {
  isRolloverIncomeDuplicate,
  isRolloverPaymentDuplicate,
  shiftRolloverDateToMonth,
} from './utils/monthRolloverIdentity';

function nowIso(): string {
  return new Date().toISOString();
}

function createRolloverId(prefix: 'bill' | 'income'): string {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function importCanonicalLocalMonth(
  params: {
    sourceMonth: string;
    targetMonth: string;
    paymentIds?: string[];
    incomeIds?: string[];
  },
  expectedVersion: number
): {
  imported: number;
  importedPayments: number;
  importedIncomes: number;
  version: number;
} {
  const result = mutateLocalHousehold(
    expectedVersion,
    {
      action: 'month_imported',
      entityType: 'system',
      entityId: params.targetMonth,
      summary: `Prepared ${params.targetMonth} from ${params.sourceMonth}`,
    },
    (state) => {
      const selectedPaymentIds = params.paymentIds ? new Set(params.paymentIds) : null;
      const selectedIncomeIds = params.incomeIds ? new Set(params.incomeIds) : new Set<string>();

      const sourcePayments = state.plannedPayments.filter(
        (payment) =>
          payment.month === params.sourceMonth &&
          (!selectedPaymentIds || selectedPaymentIds.has(payment.id))
      );
      const sourceIncomes = (state.plannedIncomes || []).filter(
        (income) =>
          income.month === params.sourceMonth &&
          selectedIncomeIds.has(income.id)
      );

      let importedPayments = 0;
      let importedIncomes = 0;

      for (const payment of sourcePayments) {
        const exists = state.plannedPayments.some((candidate) =>
          isRolloverPaymentDuplicate(payment, candidate, params.targetMonth)
        );
        if (exists) continue;

        const copiedFromId = String(payment.metadata?.copiedFromId || payment.id);
        const copiedPayment: PlannedPayment = {
          ...payment,
          id: createRolloverId('bill'),
          month: params.targetMonth,
          dueDate: shiftRolloverDateToMonth(payment.dueDate, params.targetMonth),
          status: 'unpaid',
          actualAmountPence: undefined,
          actualDate: undefined,
          actualTransactionId: undefined,
          createdAt: nowIso(),
          createdBy: LOCAL_OWNER.email,
          updatedAt: undefined,
          updatedBy: undefined,
          metadata: { ...(payment.metadata || {}), copiedFromId },
        };
        state.plannedPayments.push(copiedPayment);
        importedPayments += 1;
      }

      const incomes = state.plannedIncomes || [];
      for (const income of sourceIncomes) {
        const exists = incomes.some((candidate) =>
          isRolloverIncomeDuplicate(income, candidate, params.targetMonth)
        );
        if (exists) continue;

        const copiedFromId = String(income.metadata?.copiedFromId || income.id);
        const copiedIncome: PlannedIncome = {
          ...income,
          id: createRolloverId('income'),
          month: params.targetMonth,
          expectedDate: shiftRolloverDateToMonth(income.expectedDate, params.targetMonth),
          status: 'expected',
          actualAmountPence: undefined,
          actualDate: undefined,
          actualTransactionId: undefined,
          linkedTransactionId: undefined,
          receivedDate: undefined,
          createdAt: nowIso(),
          createdBy: LOCAL_OWNER.email,
          updatedAt: undefined,
          updatedBy: undefined,
          metadata: { ...(income.metadata || {}), copiedFromId },
        };
        incomes.push(copiedIncome);
        importedIncomes += 1;
      }

      state.plannedIncomes = incomes;

      return {
        importedPayments,
        importedIncomes,
        imported: importedPayments + importedIncomes,
      };
    }
  );

  return {
    ...result.value,
    version: result.state.version,
  };
}
