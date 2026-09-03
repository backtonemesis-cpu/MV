#!/usr/bin/env bash
set -euo pipefail

run_suite() {
  local file="$1"
  echo "=== Firestore emulator suite: $file ==="
  timeout 120s npx vitest run "$file"
}

run_suite server/storage/firestoreStore.emulator.test.ts
run_suite server/storage/readParity.emulator.test.ts
run_suite server/storage/coreMutationParity.emulator.test.ts
run_suite server/storage/edgeMutationParity.emulator.test.ts
run_suite server/storage/sqliteFirestoreMigration.emulator.test.ts
run_suite server/storage/runtimeFirestoreFoundation.emulator.test.ts
