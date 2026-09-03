import type { Firestore } from 'firebase-admin/firestore';
import type { Payer, TransactionType, ValidationError } from '../../src/types';
import { HOUSEHOLD_ID } from './contracts';

export interface RuntimeValidationResult {
  errors: Array<{ field: string; message: string }>;
  sanitized?: any;
}

const VALID_TRANSACTION_TYPES: TransactionType[] = [
  'expense',
  'income',
  'transfer',
  'repayment',
  'refund',
];
const VALID_PAYERS: Payer[] = ['Marius', 'Vesta', 'Joint'];

async function documentExists(
  db: Firestore,
  collection: 'accounts' | 'categories',
  id: string
): Promise<boolean> {
  const snapshot = await db
    .collection('households')
    .doc(HOUSEHOLD_ID)
    .collection(collection)
    .doc(id)
    .get();
  return snapshot.exists;
}

export async function validateFirestoreTransactionInput(
  db: Firestore,
  body: any
): Promise<RuntimeValidationResult> {
  const errors: Array<{ field: string; message: string }> = [];

  if (!body.type || !VALID_TRANSACTION_TYPES.includes(body.type)) {
    errors.push({
      field: 'type',
      message: `Transaction type is required and must be one of: ${VALID_TRANSACTION_TYPES.join(', ')}`,
    });
  }

  if (
    body.amountPence === undefined ||
    body.amountPence === null ||
    typeof body.amountPence !== 'number' ||
    !Number.isInteger(body.amountPence) ||
    body.amountPence <= 0
  ) {
    errors.push({
      field: 'amountPence',
      message: 'Amount is required and must be a positive integer in pence',
    });
  }

  if (
    !body.date ||
    typeof body.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.date)
  ) {
    errors.push({
      field: 'date',
      message: 'Transaction date is required in YYYY-MM-DD format',
    });
  }

  if (
    !body.description ||
    typeof body.description !== 'string' ||
    body.description.trim().length === 0
  ) {
    errors.push({
      field: 'description',
      message: 'Description is required and cannot be empty',
    });
  }

  if (!body.payer || !VALID_PAYERS.includes(body.payer)) {
    errors.push({
      field: 'payer',
      message: `Payer is required and must be explicitly specified as one of: ${VALID_PAYERS.join(', ')}`,
    });
  }

  if (!body.accountId || typeof body.accountId !== 'string') {
    errors.push({ field: 'accountId', message: 'Account is required' });
  } else if (!(await documentExists(db, 'accounts', body.accountId))) {
    errors.push({
      field: 'accountId',
      message: `Referenced account '${body.accountId}' does not exist`,
    });
  }

  const isTransfer = body.type === 'transfer' || Boolean(body.isTransfer);

  if (!isTransfer) {
    if (!body.categoryId || typeof body.categoryId !== 'string') {
      errors.push({
        field: 'categoryId',
        message:
          'Category is required for expenses, income, refunds, and repayments',
      });
    } else if (!(await documentExists(db, 'categories', body.categoryId))) {
      errors.push({
        field: 'categoryId',
        message: `Referenced category '${body.categoryId}' does not exist`,
      });
    }
  }

  if (isTransfer) {
    if (!body.targetAccountId || typeof body.targetAccountId !== 'string') {
      errors.push({
        field: 'targetAccountId',
        message:
          'Destination account (targetAccountId) is required for transfers',
      });
    } else if (body.targetAccountId === body.accountId) {
      errors.push({
        field: 'targetAccountId',
        message:
          'Source and destination accounts for a transfer must be distinct',
      });
    } else if (
      !(await documentExists(db, 'accounts', body.targetAccountId))
    ) {
      errors.push({
        field: 'targetAccountId',
        message: `Destination account '${body.targetAccountId}' does not exist`,
      });
    }
  }

  if (Array.isArray(body.splits) && body.splits.length > 0) {
    let splitTotal = 0;
    for (let index = 0; index < body.splits.length; index += 1) {
      const split = body.splits[index];
      if (
        !split.amountPence ||
        !Number.isInteger(split.amountPence) ||
        split.amountPence <= 0
      ) {
        errors.push({
          field: `splits[${index}].amountPence`,
          message: `Split #${index + 1} must have a positive integer amount in pence`,
        });
      } else {
        splitTotal += split.amountPence;
      }

      if (!split.categoryId) {
        errors.push({
          field: `splits[${index}].categoryId`,
          message: `Split #${index + 1} must specify a valid category`,
        });
      } else if (
        !(await documentExists(db, 'categories', split.categoryId))
      ) {
        errors.push({
          field: `splits[${index}].categoryId`,
          message: `Referenced category '${split.categoryId}' does not exist`,
        });
      }
    }

    if (body.amountPence && splitTotal !== body.amountPence) {
      errors.push({
        field: 'splits',
        message: `Sum of splits (${splitTotal}p) does not match total transaction amount (${body.amountPence}p)`,
      });
    }
  }

  if (errors.length > 0) return { errors };

  return {
    errors: [],
    sanitized: {
      date: body.date.trim(),
      description: body.description.trim(),
      amountPence: body.amountPence,
      type: body.type,
      categoryId: isTransfer
        ? body.categoryId || 'cat-transfer'
        : body.categoryId,
      accountId: body.accountId,
      targetAccountId: isTransfer ? body.targetAccountId : undefined,
      payer: body.payer,
      notes: body.notes ? String(body.notes).trim() : undefined,
      isTransfer,
      isRepayment: body.type === 'repayment' || Boolean(body.isRepayment),
      isSavings: Boolean(body.isSavings),
      isRefund: body.type === 'refund' || Boolean(body.isRefund),
      originalTransactionId: body.originalTransactionId || undefined,
      plannedPaymentId: body.plannedPaymentId || undefined,
      plannedIncomeId: body.plannedIncomeId || undefined,
      splits: Array.isArray(body.splits)
        ? body.splits.map((split: any, index: number) => ({
            id:
              split.id ||
              `split-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
            categoryId: split.categoryId,
            amountPence: split.amountPence,
            payer: split.payer,
            notes: split.notes,
          }))
        : undefined,
    },
  };
}

export function validateRuntimeAccountInput(body: any): RuntimeValidationResult {
  const errors: Array<{ field: string; message: string }> = [];
  const validTypes = ['current', 'joint', 'savings', 'credit', 'cash'];
  const validPayers: Payer[] = ['Marius', 'Vesta', 'Joint'];

  if (
    !body.name ||
    typeof body.name !== 'string' ||
    body.name.trim().length === 0
  ) {
    errors.push({ field: 'name', message: 'Account name is required' });
  }

  if (!body.type || !validTypes.includes(body.type)) {
    errors.push({
      field: 'type',
      message: `Account type must be one of: ${validTypes.join(', ')}`,
    });
  }

  if (!body.ownerPerson || !validPayers.includes(body.ownerPerson)) {
    errors.push({
      field: 'ownerPerson',
      message: `Account owner must be one of: ${validPayers.join(', ')}`,
    });
  }

  if (
    body.startingBalancePence === undefined ||
    !Number.isInteger(body.startingBalancePence)
  ) {
    errors.push({
      field: 'startingBalancePence',
      message: 'Starting balance must be an integer in pence',
    });
  }

  if (errors.length > 0) return { errors };

  return {
    errors: [],
    sanitized: {
      name: body.name.trim(),
      type: body.type,
      ownerPerson: body.ownerPerson,
      startingBalancePence: body.startingBalancePence,
      creditLimitPence: Number.isInteger(body.creditLimitPence)
        ? body.creditLimitPence
        : undefined,
      notes: body.notes ? String(body.notes).trim() : undefined,
    },
  };
}

export async function validateSavingsGoalAccountReferences(
  db: Firestore,
  accountId: unknown,
  linkedAccountId: unknown
): Promise<Array<{ field: string; message: string }>> {
  const errors: Array<{ field: string; message: string }> = [];

  if (!accountId || typeof accountId !== 'string') {
    errors.push({ field: 'accountId', message: 'accountId is required' });
  } else if (!(await documentExists(db, 'accounts', accountId))) {
    errors.push({
      field: 'accountId',
      message: `Referenced account '${accountId}' does not exist`,
    });
  }

  if (
    linkedAccountId &&
    typeof linkedAccountId === 'string' &&
    !(await documentExists(db, 'accounts', linkedAccountId))
  ) {
    errors.push({
      field: 'linkedAccountId',
      message: `Referenced linked account '${linkedAccountId}' does not exist`,
    });
  }

  return errors;
}
