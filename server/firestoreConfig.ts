export const PRODUCTION_FIRESTORE_DATABASE_ID = '(default)';

export function resolveProductionFirestoreDatabaseId(
  env: NodeJS.ProcessEnv = process.env
): string {
  const configured = String(
    env.MV_FIRESTORE_DATABASE_ID || PRODUCTION_FIRESTORE_DATABASE_ID
  ).trim();

  if (configured !== PRODUCTION_FIRESTORE_DATABASE_ID) {
    throw new Error(
      `[MV Firestore] Refusing production database '${configured}'. ` +
        `MV authoritative production data requires the stable default Firestore database API (${PRODUCTION_FIRESTORE_DATABASE_ID}); ` +
        'named-database access must not be used for production while the Firebase Admin API remains Public Preview.'
    );
  }

  return configured;
}
