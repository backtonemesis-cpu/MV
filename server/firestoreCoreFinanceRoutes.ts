import { Router, type Request, type Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { requireWrite } from './auth';
import { broadcastHouseholdUpdate } from './events';
import {
  FirestoreCoreMutationStore,
  type AccountMutationInput,
  type SavingsGoalMutationInput,
  type TransactionMutationInput,
} from './storage/coreMutations';
import { FirestoreEdgeMutationStore } from './storage/edgeMutations';
import { FirestoreHouseholdStore } from './storage/firestoreStore';
import {
  validateFirestoreTransactionInput,
  validateRuntimeAccountInput,
  validateSavingsGoalAccountReferences,
} from './storage/firestoreValidation';

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

function savingsInput(id: string, body: any): SavingsGoalMutationInput {
  return {
    id,
    name: String(body.name || '').trim(),
    targetPence: Number(body.targetPence),
    currentPence: Number.isInteger(body.currentPence) ? body.currentPence : 0,
    targetDate: body.targetDate ? String(body.targetDate) : undefined,
    accountId: String(body.accountId || ''),
    linkedAccountId: body.linkedAccountId
      ? String(body.linkedAccountId)
      : undefined,
  };
}

function validateSavingsShape(body: any): Array<{ field: string; message: string }> {
  const errors: Array<{ field: string; message: string }> = [];
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Valid name is required' });
  }
  if (!Number.isInteger(body.targetPence) || body.targetPence <= 0) {
    errors.push({
      field: 'targetPence',
      message: 'targetPence must be a positive integer in pence',
    });
  }
  if (
    body.currentPence !== undefined &&
    (!Number.isInteger(body.currentPence) || body.currentPence < 0)
  ) {
    errors.push({
      field: 'currentPence',
      message: 'currentPence must be a non-negative integer in pence',
    });
  }
  return errors;
}

export function createFirestoreCoreFinanceRouter(options: {
  db: Firestore;
  store: FirestoreHouseholdStore;
  core: FirestoreCoreMutationStore;
  edge: FirestoreEdgeMutationStore;
}) {
  const router = Router();
  const { db, store, core, edge } = options;

  router.post('/transactions', requireWrite, async (req, res) => {
    try {
      const validation = await validateFirestoreTransactionInput(db, req.body);
      if (validation.errors.length > 0) {
        return res
          .status(400)
          .json({ error: 'Validation failed', details: validation.errors });
      }

      const txId = makeId('tx');
      const input: TransactionMutationInput = {
        id: txId,
        ...validation.sanitized,
        idempotencyKey: req.body.idempotencyKey
          ? String(req.body.idempotencyKey).trim()
          : undefined,
        taxYear: req.body.taxYear ? String(req.body.taxYear).trim() : undefined,
        metadata:
          req.body.metadata && typeof req.body.metadata === 'object'
            ? req.body.metadata
            : undefined,
      };

      const result = await edge.createTransactionIdempotent(
        actor(req, req.body.expectedVersion),
        input
      );

      if (result.value.duplicatePrevented) {
        const data = await store.getHouseholdData();
        const existing = data.transactions.find(
          (tx) => tx.id === result.value.id
        );
        return res.status(200).json({
          transaction: existing,
          duplicatePrevented: true,
          version: result.version,
        });
      }

      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.status(201).json({
        id: result.value.id,
        version: result.version,
      });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to create transaction');
    }
  });

  router.put('/transactions/:id', requireWrite, async (req, res) => {
    try {
      const validation = await validateFirestoreTransactionInput(db, req.body);
      if (validation.errors.length > 0) {
        return res
          .status(400)
          .json({ error: 'Validation failed', details: validation.errors });
      }

      const input: TransactionMutationInput = {
        id: req.params.id,
        ...validation.sanitized,
      };
      const result = await core.updateTransaction(
        actor(req, req.body.expectedVersion),
        input
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({ id: result.value.id, version: result.version });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to update transaction');
    }
  });

  router.delete('/transactions/:id', requireWrite, async (req, res) => {
    try {
      const result = await core.deleteTransaction(
        actor(req, req.body?.expectedVersion),
        req.params.id
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({ success: true, version: result.version });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to delete transaction');
    }
  });

  router.post('/accounts', requireWrite, async (req, res) => {
    try {
      const validation = validateRuntimeAccountInput(req.body);
      if (validation.errors.length > 0) {
        return res
          .status(400)
          .json({ error: 'Validation failed', details: validation.errors });
      }

      const accountId = makeId('acc');
      const input: AccountMutationInput = {
        id: accountId,
        ...validation.sanitized,
      };
      const result = await core.createAccount(
        actor(req, req.body.expectedVersion),
        input
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.status(201).json({
        id: result.value.id,
        version: result.version,
      });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to create account');
    }
  });

  router.put('/accounts/:id', requireWrite, async (req, res) => {
    try {
      const validation = validateRuntimeAccountInput(req.body);
      if (validation.errors.length > 0) {
        return res
          .status(400)
          .json({ error: 'Validation failed', details: validation.errors });
      }

      const input: AccountMutationInput = {
        id: req.params.id,
        ...validation.sanitized,
      };
      const result = await core.updateAccount(
        actor(req, req.body.expectedVersion),
        input
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({ id: result.value.id, version: result.version });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to update account');
    }
  });

  router.delete('/accounts/:id', requireWrite, async (req, res) => {
    try {
      const result = await edge.archiveOrDeleteAccount(
        actor(req, req.body?.expectedVersion),
        req.params.id
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({
        success: true,
        archived: result.value.archived,
        version: result.version,
      });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to archive account');
    }
  });

  router.post('/accounts/:id/reconcile', requireWrite, async (req, res) => {
    const { reconciledBalancePence, reconciliationDate, expectedVersion } =
      req.body;

    if (
      !Number.isInteger(reconciledBalancePence) ||
      !reconciliationDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(reconciliationDate)
    ) {
      return res.status(400).json({
        error:
          'Valid integer reconciledBalancePence and reconciliationDate (YYYY-MM-DD) required',
      });
    }

    try {
      const result = await core.reconcileAccount(
        actor(req, expectedVersion),
        req.params.id,
        reconciledBalancePence,
        reconciliationDate
      );
      const data = await store.getHouseholdData();
      const account = data.accounts.find((item) => item.id === req.params.id);
      if (!account) {
        return res
          .status(500)
          .json({ error: 'Reconciled account could not be read back' });
      }

      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({
        success: true,
        accountId: req.params.id,
        reconciledBalancePence,
        reconciliationDate,
        calculatedCurrentBalancePence: account.currentBalancePence,
        version: result.version,
      });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to reconcile account');
    }
  });

  router.post('/savings-goals', requireWrite, async (req, res) => {
    const shapeErrors = validateSavingsShape(req.body);
    const referenceErrors = await validateSavingsGoalAccountReferences(
      db,
      req.body.accountId,
      req.body.linkedAccountId
    );
    const errors = [...shapeErrors, ...referenceErrors];
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    try {
      const id = makeId('sav');
      const result = await core.createSavingsGoal(
        actor(req, req.body.expectedVersion),
        savingsInput(id, req.body)
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.status(201).json({ id: result.value.id, version: result.version });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to create savings goal');
    }
  });

  router.put('/savings-goals/:id', requireWrite, async (req, res) => {
    const shapeErrors = validateSavingsShape(req.body);
    const referenceErrors = await validateSavingsGoalAccountReferences(
      db,
      req.body.accountId,
      req.body.linkedAccountId
    );
    const errors = [...shapeErrors, ...referenceErrors];
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }

    try {
      const result = await core.updateSavingsGoal(
        actor(req, req.body.expectedVersion),
        savingsInput(req.params.id, req.body)
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({ id: result.value.id, version: result.version });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to update savings goal');
    }
  });

  router.delete('/savings-goals/:id', requireWrite, async (req, res) => {
    try {
      const result = await core.deleteSavingsGoal(
        actor(req, req.body?.expectedVersion),
        req.params.id
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json({ success: true, version: result.version });
    } catch (err: any) {
      return sendMutationError(res, err, 'Failed to delete savings goal');
    }
  });

  return router;
}
