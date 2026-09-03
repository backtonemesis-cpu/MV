import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { getMvFirestore } from '../server/firestoreAdmin';
import { resolveFirebaseUidForEmail } from '../server/firebaseAdmin';
import {
  MIGRATION_CONFIRMATION,
  migrateSqliteToFirestore,
} from '../server/storage/sqliteFirestoreMigration';

const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire('node:sqlite');

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function usage(): never {
  console.error(
    [
      'Usage:',
      '  npm run migrate:firestore -- --source /absolute/path/to/mv_household.sqlite',
      '',
      'Dry-run is the default and performs no Firestore writes.',
      '',
      'To apply:',
      `  npm run migrate:firestore -- --source /absolute/path/to/mv_household.sqlite --apply --confirm ${MIGRATION_CONFIRMATION}`,
      '',
      'Optional destructive replacement of a non-empty target requires --allow-replace.',
    ].join('\n')
  );
  process.exit(2);
}

const sourceArg = valueAfter('--source');
if (!sourceArg) usage();

const sourcePath = path.resolve(sourceArg);
if (!fs.existsSync(sourcePath)) {
  throw new Error(`SQLite source does not exist: ${sourcePath}`);
}

const apply = process.argv.includes('--apply');
const allowReplace = process.argv.includes('--allow-replace');
const confirmation = valueAfter('--confirm');

if (allowReplace && !apply) {
  throw new Error('--allow-replace is only meaningful together with --apply');
}

const sourceDb = new DatabaseSync(sourcePath);

try {
  const result = await migrateSqliteToFirestore({
    sourceDb,
    targetDb: getMvFirestore(),
    resolveFirebaseUid: resolveFirebaseUidForEmail,
    dryRun: !apply,
    allowReplace,
    confirmation,
  });

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply' : 'dry-run',
        sourcePath,
        applied: result.applied,
        sourceValid: result.source.valid,
        errors: result.source.errors,
        warnings: result.source.warnings,
        evidence: result.source.evidence,
        targetBefore: result.targetBefore,
        targetAfter: result.targetAfter,
        equivalentAfterMigration: result.equivalentAfterMigration,
        identityBindings: result.identityBindings,
        excludedLegacyFields: result.excludedLegacyFields,
      },
      null,
      2
    )
  );

  if (!result.source.valid) {
    process.exitCode = 1;
  }
} finally {
  sourceDb.close();
}
