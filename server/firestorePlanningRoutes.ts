import { Router, type Request, type Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { requireWrite } from './auth';
import { broadcastHouseholdUpdate } from './events';
import {
  FirestoreCoreMutationStore,
  type PlannedIncomeMutationInput,
  type PlannedPaymentMutationInput,
  type PaymentActualInput,
  type TransferMutationInput,
} from './storage/coreMutations';
import { FirestoreEdgeMutationStore } from './storage/edgeMutations';
import { FirestoreHouseholdStore } from './storage/firestoreStore';
import { HOUSEHOLD_ID } from './storage/contracts';
import {
  validateFirestorePlannedIncomeInput,
  validateFirestorePlannedPaymentInput,
  firestoreAccountExists,
  firestoreCategoryExists,
} from './storage/firestoreValidation';
import type { Payer } from '../src/types';

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function actor(req: Request, expectedVersion: unknown) {
  if (!Number.isSafeInteger(expectedVersion)) {
    const error: any = new Error('expectedVersion is required');
    error.status = 400;
    throw error;
  }
  return {
    expectedVersion: Number(expectedVersion),
    actorEmail: req.user!.email,
    now: new Date().toISOString(),
  };
}

function sendMutationError(res: Response, err: any, fallback: string) {
  const message = err?.message || fallback;
  const lower = String(message).toLowerCase();
  const status =
    err?.status ||
    (lower.includes('not found') ? 404 : 400);
  return res.status(status).json({
    error: message,
    serverVersion: err?.serverVersion,
  });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

const VALID_PAYERS: Payer[] = ['Marius', 'Vesta', 'Joint'];

export function createFirestorePlanningRouter(options: {
  db: Firestore;
  store: FirestoreHouseholdStore;
  core: FirestoreCoreMutationStore;
  edge: FirestoreEdgeMutationStore;
}) {
  const router = Router();
  const { db, store, core, edge } = options;
  const householdRef = db.collection('households').doc(HOUSEHOLD_ID);

  router.post('/planned-payments', requireWrite, async (req, res) => {
    try {
      const validation = await validateFirestorePlannedPaymentInput(db, req.body);
      if (validation.errors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors,
        });
      }

      const id = makeId('bill');
      const input: PlannedPaymentMutationInput = {
        id,
        ...validation.sanitized,
      };
      const result = await core.createPlannedPayment(
        actor(req, req.body.expectedVersion),
        input
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.status(201).json({ id: result.value.id, version: result.version });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to create planned payment');
    }
  });

  router.put('/planned-payments/:id', requireWrite, async (req, res) => {
    try {
      const validation = await validateFirestorePlannedPaymentInput(db, req.body);
      if (validation.errors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors,
        });
      }

      const input: PlannedPaymentMutationInput = {
        id: req.params.id,
        ...validation.sanitized,
      };
      const result = await edge.updatePlannedPayment(
        actor(req, req.body.expectedVersion),
        input
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({ id: result.value.id, version: result.version });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to update planned payment');
    }
  });

  router.delete('/planned-payments/:id', requireWrite, async (req, res) => {
    try {
      const result = await edge.deletePlannedPayment(
        actor(req, req.body?.expectedVersion),
        req.params.id
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({ success: true, version: result.version });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to delete planned payment');
    }
  });

  router.post('/planned-payments/:id/pay', requireWrite, async (req, res) => {
    try {
      const paymentRef = householdRef.collection('plannedPayments').doc(req.params.id);
      const paymentSnapshot = await paymentRef.get();
      if (!paymentSnapshot.exists) {
        return res.status(404).json({ error: 'Planned payment not found' });
      }
      const payment = paymentSnapshot.data() || {};

      if (payment.actualTransactionId) {
        return res.status(409).json({
          error: 'Planned payment is already linked to an actual transaction. Delete or correct the linked transaction first.',
        });
      }

      const actualAmountPence =
        Number.isInteger(req.body.actualAmountPence) && req.body.actualAmountPence > 0
          ? req.body.actualAmountPence
          : Number(payment.amountPence);
      const actualDate = isDate(req.body.actualDate) ? req.body.actualDate : todayIso();
      const accountId = req.body.accountId || payment.accountId;

      if (!accountId || !(await firestoreAccountExists(db, String(accountId)))) {
        return res.status(400).json({ error: 'Payment account does not exist' });
      }

      const categoryId = String(payment.categoryId || 'cat-housing');
      if (!(await firestoreCategoryExists(db, categoryId))) {
        return res.status(400).json({
          error: `Payment category '${categoryId}' does not exist`,
        });
      }

      const actualTransactionId = makeId('tx');
      const actual: PaymentActualInput = {
        actualTransactionId,
        actualAmountPence,
        actualDate,
        accountId: String(accountId),
      };

      const result = await core.payPlannedPayment(
        actor(req, req.body.expectedVersion),
        req.params.id,
        actual
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({
        success: true,
        paymentId: req.params.id,
        actualTransactionId,
        actualAmountPence,
        actualDate,
        version: result.version,
      });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to mark payment as paid');
    }
  });

  router.post('/planned-payments/bulk-toggle', requireWrite, async (req, res) => {
    if (typeof req.body.include !== 'boolean') {
      return res.status(400).json({ error: 'include must be true or false' });
    }
    if (req.body.month && !isMonth(req.body.month)) {
      return res.status(400).json({ error: 'month must use YYYY-MM format' });
    }
    if (
      req.body.paymentIds !== undefined &&
      (!Array.isArray(req.body.paymentIds) ||
        req.body.paymentIds.some((id: unknown) => typeof id !== 'string'))
    ) {
      return res.status(400).json({ error: 'paymentIds must be an array of IDs' });
    }

    try {
      const result = await edge.bulkTogglePlannedPayments(
        actor(req, req.body.expectedVersion),
        {
          month: req.body.month,
          include: req.body.include,
          onlyUnpaid: Boolean(req.body.onlyUnpaid),
          paymentIds: req.body.paymentIds,
        }
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({
        success: true,
        updatedCount: result.value.updatedCount,
        version: result.version,
      });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to update planned payments');
    }
  });

  router.post('/transfer-plan/execute-transfer', requireWrite, async (req, res) => {
    const {
      sourceAccountId,
      destinationAccountId,
      amountPence,
      description,
      date,
      payer,
      expectedVersion,
    } = req.body;

    if (
      !sourceAccountId ||
      !destinationAccountId ||
      sourceAccountId === destinationAccountId ||
      !Number.isInteger(amountPence) ||
      amountPence <= 0
    ) {
      return res.status(400).json({
        error: 'Valid distinct source/destination accounts and positive amount in pence required',
      });
    }

    const [sourceSnapshot, destinationSnapshot] = await Promise.all([
      householdRef.collection('accounts').doc(String(sourceAccountId)).get(),
      householdRef.collection('accounts').doc(String(destinationAccountId)).get(),
    ]);
    if (!sourceSnapshot.exists || !destinationSnapshot.exists) {
      return res.status(400).json({ error: 'Source or destination account not found' });
    }

    const source = sourceSnapshot.data() || {};
    const destination = destinationSnapshot.data() || {};
    const resolvedPayer: Payer =
      payer && VALID_PAYERS.includes(payer)
        ? payer
        : VALID_PAYERS.includes(source.ownerPerson)
          ? source.ownerPerson
          : 'Joint';

    const input: TransferMutationInput = {
      id: makeId('tx'),
      sourceAccountId: String(sourceAccountId),
      destinationAccountId: String(destinationAccountId),
      amountPence,
      description:
        description && String(description).trim()
          ? String(description).trim()
          : `Transfer Plan: ${String(source.name || sourceAccountId)} → ${String(
              destination.name || destinationAccountId
            )}`,
      date: isDate(date) ? date : todayIso(),
      payer: resolvedPayer,
    };

    try {
      const result = await core.executeTransfer(
        actor(req, expectedVersion),
        input
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({
        success: true,
        transactionId: result.value.id,
        version: result.version,
      });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to execute transfer');
    }
  });

  router.post('/planned-incomes', requireWrite, async (req, res) => {
    try {
      const validation = await validateFirestorePlannedIncomeInput(db, req.body);
      if (validation.errors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors,
        });
      }

      const id = makeId('inc');
      const input: PlannedIncomeMutationInput = {
        id,
        ...validation.sanitized,
      };
      const result = await core.createPlannedIncome(
        actor(req, req.body.expectedVersion),
        input
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.status(201).json({ id: result.value.id, version: result.version });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to create planned income');
    }
  });

  router.put('/planned-incomes/:id', requireWrite, async (req, res) => {
    try {
      const validation = await validateFirestorePlannedIncomeInput(db, req.body);
      if (validation.errors.length > 0) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validation.errors,
        });
      }

      const input: PlannedIncomeMutationInput = {
        id: req.params.id,
        ...validation.sanitized,
      };
      const result = await edge.updatePlannedIncome(
        actor(req, req.body.expectedVersion),
        input
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({ id: result.value.id, version: result.version });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to update planned income');
    }
  });

  router.delete('/planned-incomes/:id', requireWrite, async (req, res) => {
    try {
      const result = await edge.deletePlannedIncome(
        actor(req, req.body?.expectedVersion),
        req.params.id
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({ success: true, version: result.version });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to delete planned income');
    }
  });

  router.post('/planned-incomes/:id/receive', requireWrite, async (req, res) => {
    try {
      const incomeRef = householdRef.collection('plannedIncomes').doc(req.params.id);
      const incomeSnapshot = await incomeRef.get();
      if (!incomeSnapshot.exists) {
        return res.status(404).json({ error: 'Planned income not found' });
      }
      const income = incomeSnapshot.data() || {};

      if (income.actualTransactionId) {
        return res.status(409).json({
          error: 'Planned income is already linked to an actual transaction. Delete or correct the linked transaction first.',
        });
      }

      const actualAmountPence =
        Number.isInteger(req.body.actualAmountPence) && req.body.actualAmountPence > 0
          ? req.body.actualAmountPence
          : Number(income.expectedAmountPence);
      const actualDate = isDate(req.body.actualDate) ? req.body.actualDate : todayIso();
      const accountId = req.body.accountId || income.accountId;

      if (!accountId || !(await firestoreAccountExists(db, String(accountId)))) {
        return res.status(400).json({ error: 'Receiving account does not exist' });
      }
      if (!(await firestoreCategoryExists(db, 'cat-salary'))) {
        return res.status(500).json({ error: 'Required salary category configuration is missing' });
      }

      const actualTransactionId = makeId('tx');
      const actual: PaymentActualInput = {
        actualTransactionId,
        actualAmountPence,
        actualDate,
        accountId: String(accountId),
      };

      const result = await core.receivePlannedIncome(
        actor(req, req.body.expectedVersion),
        req.params.id,
        actual
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({
        success: true,
        incomeId: req.params.id,
        actualTransactionId,
        actualAmountPence,
        actualDate,
        version: result.version,
      });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to record income received');
    }
  });

  router.post('/months/import', requireWrite, async (req, res) => {
    const { sourceMonth, targetMonth, paymentIds, expectedVersion } = req.body;
    if (!isMonth(sourceMonth) || !isMonth(targetMonth)) {
      return res.status(400).json({
        error: 'Valid sourceMonth and targetMonth (YYYY-MM) required',
      });
    }
    if (
      paymentIds !== undefined &&
      (!Array.isArray(paymentIds) ||
        paymentIds.some((id: unknown) => typeof id !== 'string'))
    ) {
      return res.status(400).json({ error: 'paymentIds must be an array of IDs' });
    }

    try {
      const result = await edge.importMonth(
        actor(req, expectedVersion),
        {
          sourceMonth,
          targetMonth,
          paymentIds,
        }
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({
        success: true,
        importedCount: result.value.importedCount,
        targetMonth: result.value.targetMonth,
        version: result.version,
      });
    } catch (err: any) {
      return sendMutationError(res, err, 'Month import failed');
    }
  });

  return router;
}
