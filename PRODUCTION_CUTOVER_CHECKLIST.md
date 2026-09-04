# MV production Firestore cutover checklist

This checklist is the final external deployment gate after the repository-side
Firestore cutover has passed CI.

## Authoritative datastore decision

- Production MV must use the stable Firestore `(default)` database.
- `MV_DATA_BACKEND=firestore` must be set on the Cloud Run revision.
- `MV_FIRESTORE_DATABASE_ID=(default)` must be set or left at its fail-closed default.
- Cloud Run + SQLite remains prohibited.
- The legacy AI Studio named database
  `ai-studio-mv-02fb52df-6e5f-458e-bc1e-b1fdc07a8db7` is not the production
  system of record.
- The committed `data/household.json` is historical/pre-SQLite data and must not
  be used as authoritative migration evidence.

No verified authoritative production SQLite database or backup was recoverable
from GitHub, connected Google Drive, email evidence, or the known deployment
handoff. Therefore no live SQLite migration is authorized. A new production
Firestore household must begin empty except for the standard non-financial
category catalogue created by MV on first initialization.

## Firebase / Google Cloud prerequisites

Before deploying the Firestore revision:

1. Create/confirm the project's Firestore `(default)` database.
2. Deploy this repository's deny-all browser rules to both:
   - `(default)`
   - `ai-studio-mv-02fb52df-6e5f-458e-bc1e-b1fdc07a8db7`
3. Confirm Google sign-in is enabled in Firebase Authentication.
4. Add the deployed MV Cloud Run/custom domain to Firebase Authentication's
   authorized domains.
5. Confirm the Cloud Run runtime service account has the least privileges
   required for Firebase Admin token verification and Firestore server access
   through Application Default Credentials.
6. Do not grant household Editor/View-only users Google Cloud, Firebase console,
   GitHub, deployment, or repository permissions.

## Cloud Run environment

Required application values:

```
MV_DATA_BACKEND=firestore
MV_FIRESTORE_DATABASE_ID=(default)
NODE_ENV=production
```

Cloud Run supplies `PORT`; MV must use that injected value.

## Startup gate

The production startup preflight must:

- refuse Cloud Run + SQLite;
- refuse any Firestore database ID other than `(default)`;
- read `households/household-mv/meta/state` using Firebase Admin;
- allow a genuinely empty default database;
- refuse a partially migrated state such as `loading` or `verifying`;
- refuse malformed existing dataset/schema version metadata;
- refuse startup if Firestore cannot be reached.

## First live identity initialization

On an empty production database:

1. Marius signs in with verified Firebase identity
   `backtonemesis@gmail.com`.
2. MV creates that Firebase UID as the sole Household Owner.
3. No finance rows are invented.
4. Standard categories may be created as non-financial schema configuration.
5. Any other verified user starts Pending and sees no household financial data.
6. Marius may then approve Vesta as Editor or View-only.

## Post-deploy verification

Do not call production complete until all of the following have been observed on
the deployed revision:

- revision reaches Ready;
- schema-status reports `backend: firestore`;
- Marius signs in successfully as the sole Owner;
- Pending user sees no finance data;
- Editor may perform permitted writes;
- View-only receives 403 on writes;
- Marius cannot be demoted/removed and no other user can become Owner;
- account/transaction/savings/planned bill/planned income/transfer/month-import
  operations persist after a revision restart;
- stale writes return 409;
- backup export succeeds;
- restore/reset remain Owner-only and versioned;
- sample-data and pseudo acceptance-test endpoints are absent;
- browser direct Firestore access remains denied.

## Current limitation

Repository code can prove the cutover against the Firestore Emulator, but this
workspace currently has no connected Google Cloud/Firebase administration tool.
Creation of the default database, Firebase Auth provider/domain configuration,
IAM confirmation, security-rules deployment, Cloud Run environment update, and
the final real deployment must therefore be verified externally before MV is
declared production-ready.
