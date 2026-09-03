import { Router, type Request, type Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import type { Payer } from '../src/types';
import { requireWrite } from './auth';
import { broadcastHouseholdUpdate } from './events';
import {
  FirestoreCoreMutationStore,
  type PlannedIncomeMutationInput,
  type PlannedPaymentMutationInput,
} from './storage/coreMutations';
import { FirestoreEdgeMutationStore } from './storage/edgeMutations';
import { FirestoreHouseholdStore } from './storage/firestoreStore';
import {
  firestoreAccountExists,
  validateFirestorePlannedIncomeInput,
  validateFirestorePlannedPaymentInput,
} from './storage/firestoreValidation';

const VALID_PAYERS: Payer[] = ['Marius', 'Vesta', 'Joint'];

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
    (lower.includes('not found') || lower.includes('does not exist') ? 404 : 400);

  return res.status(status).json({
    error: message,
    serverVersion: err?.serverVersion,
  });
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function validMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

export function createFirestorePlannedFinanceRouter(options: {
  db: Firestore;
  store: FirestoreHouseholdStore;
  core: FirestoreCoreMutationStore;
  edge: FirestoreEdgeMutationStore;
}) {
  const router = Router();
  const { db, store, core, edge } = options;

  router.post('/planned-payments', requireWrite, async (req, res) => {
    try {
      const validation = await validateFirestorePlannedPaymentInput(db, req.body);
      if (validation.errors.length > 0) {
        return res
          .status(400)
          .json({ error: 'Validation failed', details: validation.errors });
      }

      const paymentId = makeId('bill');
      const input: PlannedPaymentMutationInput = {
        id: paymentId,
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
        return res
          .status(400)
          .json({ error: 'Validation failed', details: validation.errors });
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
      const data = await store.getHouseholdData();
      const payment = data.plannedPayments.find(
        (item) => item.id === req.params.id
      );
      if (!payment) {
        return res.status(404).json({ error: 'Planned payment not found' });
      }

      const actualAmountPence =
        Number.isInteger(req.body.actualAmountPence) &&
        req.body.actualAmountPence > 0
          ? req.body.actualAmountPence
          : payment.amountPence;
      const actualDate = validDate(req.body.actualDate)
        ? req.body.actualDate
        : new Date().toISOString().slice(0, 10);
      const accountId = req.body.accountId
        ? String(req.body.accountId)
        : payment.accountId;

      if (!(await firestoreAccountExists(db, accountId))) {
        return res.status(400).json({ error: 'Payment account does not exist' });
      }

      const actualTransactionId = makeId('tx');
      const result = await core.payPlannedPayment(
        actor(req, req.body.expectedVersion),
        req.params.id,
        {
          actualTransactionId,
          actualAmountPence,
          actualDate,
          accountId,
        }
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
    const { month, include, onlyUnpaid, paymentIds, expectedVersion } = req.body;

    if (typeof include !== 'boolean') {
      return res.status(400).json({ error: 'include must be a boolean' });
    }
    if (month && !validMonth(month)) {
      return res.status(400).json({ error: 'month must be YYYY-MM when supplied' });
    }
    if (
      paymentIds !== undefined &&
      (!Array.isArray(paymentIds) ||
        paymentIds.some((id: unknown) => typeof id !== 'string'))
    ) {
      return res.status(400).json({ error: 'paymentIds must be an array of IDs' });
    }

    try {
      const result = await edge.bulkTogglePlannedPayments(
        actor(req, expectedVersion),
        {
          month,
          include,
          onlyUnpaid: Boolean(onlyUnpaid),
          paymentIds,
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
      !Number.isInteger(amountPence) ||
      amountPence <= 0
    ) {
      return res.status(400).json({
        error: 'Valid source, destination, and positive amount in pence required',
      });
    }
    if (sourceAccountId === destinationAccountId) {
      return res
        .status(400)
        .json({ error: 'Source and destination accounts must be distinct' });
    }
    if (date && !validDate(date)) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD when supplied' });
    }
    if (payer && !VALID_PAYERS.includes(payer)) {
      return res.status(400).json({ error: 'Invalid payer' });
    }

    try {
      const data = await store.getHouseholdData();
      const source = data.accounts.find((item) => item.id === sourceAccountId);
      const destination = data.accounts.find(
        (item) => item.id === destinationAccountId
      );
      if (!source || !destination) {
        return res
          .status(400)
          .json({ error: 'Source or destination account not found' });
      }

      const transactionId = makeId('tx');
      const result = await core.executeTransfer(
        actor(req, expectedVersion),
        {
          id: transactionId,
          sourceAccountId,
          destinationAccountId,
          amountPence,
          description:
            typeof description === 'string' && description.trim()
              ? description.trim()
              : `Transfer Plan: ${source.name} → ${destination.name}`,
          date: validDate(date)
            ? date
            : new Date().toISOString().slice(0, 10),
          payer: payer || source.ownerPerson || 'Joint',
        }
      );

      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({
        success: true,
        transactionId,
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
        return res
          .status(400)
          .json({ error: 'Validation failed', details: validation.errors });
      }

      const incomeId = makeId('inc');
      const input: PlannedIncomeMutationInput = {
        id: incomeId,
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
        return res
          .status(400)
          .json({ error: 'Validation failed', details: validation.errors });
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
      const data = await store.getHouseholdData();
      const income = data.plannedIncomes?.find(
        (item) => item.id === req.params.id
      );
      if (!income) {
        return res.status(404).json({ error: 'Planned income not found' });
      }

      const actualAmountPence =
        Number.isInteger(req.body.actualAmountPence) &&
        req.body.actualAmountPence > 0
          ? req.body.actualAmountPence
          : income.expectedAmountPence;
      const actualDate = validDate(req.body.actualDate)
        ? req.body.actualDate
        : new Date().toISOString().slice(0, 10);
      const accountId = req.body.accountId
        ? String(req.body.accountId)
        : income.accountId;

      if (!(await firestoreAccountExists(db, accountId))) {
        return res.status(400).json({ error: 'Receiving account does not exist' });
      }

      const actualTransactionId = makeId('tx');
      const result = await core.receivePlannedIncome(
        actor(req, req.body.expectedVersion),
        req.params.id,
        {
          actualTransactionId,
          actualAmountPence,
          actualDate,
          accountId,
        }
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

    if (!validMonth(sourceMonth) || !validMonth(targetMonth)) {
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
