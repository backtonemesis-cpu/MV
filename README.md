# MV

**MV** is a new private shared household finance application for Marius and Vesta.

This repository is intentionally a fresh build. It is not a fork or copy of Penny.

## Current state

The repository now contains the **initial secure architecture scaffold**, not a finished finance app:

- Firebase Auth identity foundation
- Pending / Owner / Editor / Viewer / Removed household roles
- Firestore household isolation and server-side access rules
- version-checked financial writes to prevent silent stale overwrites
- append-only client audit collection
- integer-pence financial calculations
- automated core calculation/policy/validation tests
- minimal mobile-first authenticated shell

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the implementation model and [`GOOGLE_HANDOFF.md`](./GOOGLE_HANDOFF.md) for the wider product requirements.

## Local setup

1. Copy `.env.example` to `.env` and enter the Firebase **Web SDK** configuration for the MV project.
2. Enable Google as a Firebase Authentication provider.
3. Create Firestore and deploy `firestore.rules` and `firestore.indexes.json`.
4. Install dependencies and run the app:

```bash
npm install
npm test
npm run dev
```

Production build:

```bash
npm run build
```

## Security rules

Do not commit Firebase Admin SDK/service-account credentials. `VITE_*` variables are delivered to the browser and therefore must contain only Firebase Web SDK client configuration.

The initial Owner identity is deliberately limited to the verified authentication email `backtonemesis@gmail.com`. All other authenticated identities start Pending and receive no household financial data until the Owner approves them.
