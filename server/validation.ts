import { getDb } from './db';
import { TransactionType, Payer, AccountType } from '../src/types';

export interface ValidationError {
  field: string;
  message: string;
}

export function validateTransactionInput(body: any): { errors: ValidationError[]; sanitized?: any } {
  const errors: ValidationError[] = [];

  // Required field: type
  const validTypes: TransactionType[] = ['expense', 'income', 'transfer', 'repayment', 'refund'];
  if (!body.type || !validTypes.includes(body.type)) {
    errors.push({
      field: 'type',
      message: `Transaction type is required and must be one of: ${validTypes.join(', ')}`,
    });
  }

  // Required field: amountPence
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

  // Required field: date (YYYY-MM-DD)
  if (!body.date || typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    errors.push({
      field: 'date',
      message: 'Transaction date is required in YYYY-MM-DD format',
    });
  }

  // Required field: description
  if (!body.description || typeof body.description !== 'string' || body.description.trim().length === 0) {
    errors.push({
      field: 'description',
      message: 'Description is required and cannot be empty',
    });
  }

  // Required field: payer
  const validPayers: Payer[] = ['Marius', 'Vesta', 'Joint'];
  if (!body.payer || !validPayers.includes(body.payer)) {
    errors.push({
      field: 'payer',
      message: `Payer is required and must be explicitly specified as one of: ${validPayers.join(', ')}`,
    });
  }

  // Required field: accountId
  const db = getDb();
  if (!body.accountId || typeof body.accountId !== 'string') {
    errors.push({
      field: 'accountId',
      message: 'Account is required',
    });
  } else {
    const acc = db.prepare('SELECT id, is_active FROM accounts WHERE id = ?').get(body.accountId) as any;
    if (!acc) {
      errors.push({
        field: 'accountId',
        message: `Referenced account '${body.accountId}' does not exist`,
      });
    }
  }

  // Category requirement: required for non-transfers
  const isTransfer = body.type === 'transfer' || Boolean(body.isTransfer);
  if (!isTransfer) {
    if (!body.categoryId || typeof body.categoryId !== 'string') {
      errors.push({
        field: 'categoryId',
        message: 'Category is required for expenses, income, refunds, and repayments',
      });
    } else {
      const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(body.categoryId) as any;
      if (!cat) {
        errors.push({
          field: 'categoryId',
          message: `Referenced category '${body.categoryId}' does not exist`,
        });
      }
    }
  }

  // Transfer validation
  if (isTransfer) {
    if (!body.targetAccountId || typeof body.targetAccountId !== 'string') {
      errors.push({
        field: 'targetAccountId',
        message: 'Destination account (targetAccountId) is required for transfers',
      });
    } else if (body.targetAccountId === body.accountId) {
      errors.push({
        field: 'targetAccountId',
        message: 'Source and destination accounts for a transfer must be distinct',
      });
    } else {
      const targetAcc = db.prepare('SELECT id FROM accounts WHERE id = ?').get(body.targetAccountId) as any;
      if (!targetAcc) {
        errors.push({
          field: 'targetAccountId',
          message: `Destination account '${body.targetAccountId}' does not exist`,
        });
      }
    }
  }

  // Splits validation
  if (Array.isArray(body.splits) && body.splits.length > 0) {
    let splitTotal = 0;
    for (let i = 0; i < body.splits.length; i++) {
      const split = body.splits[i];
      if (!split.amountPence || !Number.isInteger(split.amountPence) || split.amountPence <= 0) {
        errors.push({
          field: `splits[${i}].amountPence`,
          message: `Split #${i + 1} must have a positive integer amount in pence`,
        });
      } else {
        splitTotal += split.amountPence;
      }

      if (!split.categoryId) {
        errors.push({
          field: `splits[${i}].categoryId`,
          message: `Split #${i + 1} must specify a valid category`,
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

  if (errors.length > 0) {
    return { errors };
  }

  // Return strictly whitelisted sanitized payload
  return {
    errors: [],
    sanitized: {
      date: body.date.trim(),
      description: body.description.trim(),
      amountPence: body.amountPence,
      type: body.type,
      categoryId: isTransfer ? (body.categoryId || 'cat-transfer') : body.categoryId,
      accountId: body.accountId,
      targetAccountId: isTransfer ? body.targetAccountId : undefined,
      payer: body.payer,
      notes: body.notes ? String(body.notes).trim() : undefined,
      isTransfer: isTransfer ? 1 : 0,
      isRepayment: body.type === 'repayment' || Boolean(body.isRepayment) ? 1 : 0,
      isSavings: Boolean(body.isSavings) ? 1 : 0,
      isRefund: body.type === 'refund' || Boolean(body.isRefund) ? 1 : 0,
      originalTransactionId: body.originalTransactionId || undefined,
      plannedPaymentId: body.plannedPaymentId || undefined,
      plannedIncomeId: body.plannedIncomeId || undefined,
      splits: Array.isArray(body.splits) ? body.splits : undefined,
    },
  };
}

export function validateAccountInput(body: any): { errors: ValidationError[]; sanitized?: any } {
  const errors: ValidationError[] = [];

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Account name is required' });
  }

  const validTypes: AccountType[] = ['current', 'joint', 'savings', 'credit', 'cash'];
  if (!body.type || !validTypes.includes(body.type)) {
    errors.push({ field: 'type', message: `Account type must be one of: ${validTypes.join(', ')}` });
  }

  const validPayers: Payer[] = ['Marius', 'Vesta', 'Joint'];
  if (!body.ownerPerson || !validPayers.includes(body.ownerPerson)) {
    errors.push({ field: 'ownerPerson', message: `Account owner must be one of: ${validPayers.join(', ')}` });
  }

  if (body.startingBalancePence === undefined || !Number.isInteger(body.startingBalancePence)) {
    errors.push({ field: 'startingBalancePence', message: 'Starting balance must be an integer in pence' });
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    errors: [],
    sanitized: {
      name: body.name.trim(),
      type: body.type,
      ownerPerson: body.ownerPerson,
      startingBalancePence: body.startingBalancePence,
      creditLimitPence: Number.isInteger(body.creditLimitPence) ? body.creditLimitPence : null,
      notes: body.notes ? String(body.notes).trim() : null,
    },
  };
}

export function validatePlannedPaymentInput(body: any): { errors: ValidationError[]; sanitized?: any } {
  const errors: ValidationError[] = [];

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Payment name/obligation is required' });
  }

  if (!body.amountPence || !Number.isInteger(body.amountPence) || body.amountPence <= 0) {
    errors.push({ field: 'amountPence', message: 'Amount must be a positive integer in pence' });
  }

  if (!body.month || !/^\d{4}-\d{2}$/.test(body.month)) {
    errors.push({ field: 'month', message: 'Month is required in YYYY-MM format' });
  }

  const validPayers: Payer[] = ['Marius', 'Vesta', 'Joint'];
  if (!body.responsiblePerson || !validPayers.includes(body.responsiblePerson)) {
    errors.push({ field: 'responsiblePerson', message: `Responsible person must be one of: ${validPayers.join(', ')}` });
  }

  const db = getDb();
  if (!body.accountId || typeof body.accountId !== 'string') {
    errors.push({ field: 'accountId', message: 'Payment account is required' });
  } else {
    const acc = db.prepare('SELECT id FROM accounts WHERE id = ?').get(body.accountId);
    if (!acc) {
      errors.push({ field: 'accountId', message: `Referenced account '${body.accountId}' does not exist` });
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    errors: [],
    sanitized: {
      name: body.name.trim(),
      amountPence: body.amountPence,
      month: body.month,
      responsiblePerson: body.responsiblePerson,
      accountId: body.accountId,
      dueDate: body.dueDate ? String(body.dueDate).trim() : null,
      categoryId: body.categoryId || null,
      status: body.status === 'paid' ? 'paid' : 'unpaid',
      includeInTransferPlan: body.includeInTransferPlan !== false ? 1 : 0,
      notes: body.notes ? String(body.notes).trim() : null,
    },
  };
}

export function validatePlannedIncomeInput(body: any): { errors: ValidationError[]; sanitized?: any } {
  const errors: ValidationError[] = [];

  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Income source name is required' });
  }

  if (!body.expectedAmountPence || !Number.isInteger(body.expectedAmountPence) || body.expectedAmountPence <= 0) {
    errors.push({ field: 'expectedAmountPence', message: 'Expected amount must be a positive integer in pence' });
  }

  if (!body.month || !/^\d{4}-\d{2}$/.test(body.month)) {
    errors.push({ field: 'month', message: 'Month is required in YYYY-MM format' });
  }

  const validPayers: Payer[] = ['Marius', 'Vesta', 'Joint'];
  if (!body.sourcePerson || !validPayers.includes(body.sourcePerson)) {
    errors.push({ field: 'sourcePerson', message: `Source person must be one of: ${validPayers.join(', ')}` });
  }

  const db = getDb();
  if (!body.accountId || typeof body.accountId !== 'string') {
    errors.push({ field: 'accountId', message: 'Receiving account is required' });
  } else {
    const acc = db.prepare('SELECT id FROM accounts WHERE id = ?').get(body.accountId);
    if (!acc) {
      errors.push({ field: 'accountId', message: `Referenced account '${body.accountId}' does not exist` });
    }
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    errors: [],
    sanitized: {
      name: body.name.trim(),
      expectedAmountPence: body.expectedAmountPence,
      month: body.month,
      sourcePerson: body.sourcePerson,
      accountId: body.accountId,
      expectedDate: body.expectedDate ? String(body.expectedDate).trim() : null,
      status: body.status === 'received' ? 'received' : 'expected',
      notes: body.notes ? String(body.notes).trim() : null,
    },
  };
}
