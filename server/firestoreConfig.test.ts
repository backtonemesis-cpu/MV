import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_FIRESTORE_DATABASE_ID,
  resolveProductionFirestoreDatabaseId,
} from './firestoreConfig';

describe('production Firestore database selection', () => {
  it('defaults to the stable default Firestore database', () => {
    expect(resolveProductionFirestoreDatabaseId({})).toBe('(default)');
    expect(PRODUCTION_FIRESTORE_DATABASE_ID).toBe('(default)');
  });

  it('accepts an explicit default database selection', () => {
    expect(
      resolveProductionFirestoreDatabaseId({
        MV_FIRESTORE_DATABASE_ID: '(default)',
      })
    ).toBe('(default)');
  });

  it('rejects a named database for authoritative production data', () => {
    expect(() =>
      resolveProductionFirestoreDatabaseId({
        MV_FIRESTORE_DATABASE_ID: 'ai-studio-mv-02fb52df-6e5f-458e-bc1e-b1fdc07a8db7',
      })
    ).toThrow(/named-database access must not be used for production/i);
  });
});
