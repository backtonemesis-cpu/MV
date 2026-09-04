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
run_suite server/firestoreCoreFinanceRoutes.emulator.test.ts
run_suite server/firestorePlanningRoutes.emulator.test.ts
run_suite server/storage/firestoreAdminData.emulator.test.ts
run_suite server/firestoreAdminDataRoutes.emulator.test.ts

echo "=== Production storage preflight matrix ==="
timeout 120s node scripts/test-production-preflight.mjs

echo "=== Cloud Run + Firestore production startup smoke ==="
npm run build
PORT=3100 \
K_SERVICE=mv-ci \
K_REVISION=mv-ci-00001 \
MV_DATA_BACKEND=firestore \
MV_FIRESTORE_DATABASE_ID="(default)" \
npm start > /tmp/mv-firestore-production.log 2>&1 &
server_pid=$!
cleanup_server() {
  kill "$server_pid" 2>/dev/null || true
}
trap cleanup_server EXIT

started=0
for attempt in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:3100/api/system/schema-status > /tmp/mv-firestore-schema.json; then
    started=1
    break
  fi
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "MV Firestore production server exited before becoming ready"
    cat /tmp/mv-firestore-production.log
    exit 1
  fi
  sleep 1
done

if [ "$started" -ne 1 ]; then
  echo "MV Firestore production server did not become ready"
  cat /tmp/mv-firestore-production.log
  exit 1
fi

cat /tmp/mv-firestore-schema.json
grep --fixed-strings '"backend":"firestore"' /tmp/mv-firestore-schema.json
grep --fixed-strings 'Cloud Run Firestore preflight passed' /tmp/mv-firestore-production.log

cleanup_server
trap - EXIT
