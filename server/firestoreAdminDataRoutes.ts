import { Router, type Request, type Response } from 'express';
import type { Firestore } from 'firebase-admin/firestore';
import { requireAuth, requireRole } from './auth';
import { broadcastHouseholdUpdate } from './events';
import { FirestoreAdminDataService } from './storage/firestoreAdminData';
import { FirestoreHouseholdStore } from './storage/firestoreStore';

function expectedVersion(body: any): number {
  if (!Number.isSafeInteger(body?.expectedVersion)) {
    const error: any = new Error('expectedVersion is required');
    error.status = 400;
    throw error;
  }
  return Number(body.expectedVersion);
}

function withoutExpectedVersion(body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const { expectedVersion: _expectedVersion, ...payload } = body;
  return payload;
}

function sendError(res: Response, err: any, fallback: string) {
  return res.status(err?.status || 400).json({
    error: err?.message || fallback,
    serverVersion: err?.serverVersion,
    preflight: err?.preflight,
  });
}

export function createFirestoreAdminDataRouter(options: {
  db: Firestore;
  store: FirestoreHouseholdStore;
}) {
  const router = Router();
  const service = new FirestoreAdminDataService(options.db, options.store);

  router.get('/backup', requireRole(['owner', 'editor']), async (req, res) => {
    try {
      const backup = await service.exportBackup(req.user!.email);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=mv_backup_${new Date().toISOString().split('T')[0]}.json`
      );
      return res.json(backup);
    } catch (err: any) {
      return sendError(res, err, 'Failed to export backup');
    }
  });

  router.post('/restore/preflight', requireRole(['owner']), async (req, res) => {
    try {
      const result = await service.preflightRestore(req.body);
      return res.status(result.valid ? 200 : 400).json(result);
    } catch (err: any) {
      return sendError(res, err, 'Restore preflight failed');
    }
  });

  router.post('/restore', requireRole(['owner']), async (req, res) => {
    try {
      const version = expectedVersion(req.body);
      const result = await service.restore(
        withoutExpectedVersion(req.body),
        version,
        req.user!.email
      );
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json(result);
    } catch (err: any) {
      return sendError(res, err, 'Restore failed');
    }
  });

  router.post('/household/reset', requireRole(['owner']), async (req, res) => {
    try {
      const version = expectedVersion(req.body);
      const result = await service.reset(version, req.user!.email);
      broadcastHouseholdUpdate(result.version, req.user!.email);
      return res.json(result);
    } catch (err: any) {
      return sendError(res, err, 'Household reset failed');
    }
  });

  // These routes intentionally do not exist as production capabilities.
  router.post(
    '/household/load-sample-data',
    requireRole(['owner']),
    (_req, res) =>
      res.status(404).json({
        error: 'Sample household data is not available in production.',
        code: 'DEVELOPMENT_ONLY_CAPABILITY',
      })
  );

  router.get('/tests/run', requireAuth, (_req, res) =>
    res.status(404).json({
      error: 'In-app pseudo acceptance tests are not a production capability.',
      code: 'DEVELOPMENT_ONLY_CAPABILITY',
    })
  );

  return router;
}
