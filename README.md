# MV

**MV** is a new shared household finance application for Marius and Vesta.

This repository is intentionally a **fresh build**. It is not a fork or copy of Penny and should be developed as an independent product.

## Core objective

Build a secure, mobile-first household money-management app that two authenticated household members can use simultaneously against one shared dataset.

## Initial roles

- **Marius** — Household Owner/Admin
- **Vesta** — Household Editor once approved
- New authenticated users — Pending until approved by the Owner/Admin
- Optional approved role — View only

Household roles control financial-data access only. Household members must never receive repository, deployment, hosting, publishing, or development permissions merely because they can use the app.

## Development principles

- Shared server-side data; do not use browser localStorage as the system of record.
- Authentication-backed identity and server-side authorization on every read/write.
- Pending users receive no household financial data.
- Owner/Admin can approve, change role, reject, or remove household members.
- Version/conflict protection must prevent stale saves silently overwriting newer edits.
- Keep an append-only audit/history trail for security-sensitive membership changes and meaningful financial edits.
- Mobile-first UI, especially iPhone, with desktop support.
- Preserve exact currency values; avoid floating-point rounding errors for money.
- Build automated tests before production deployment.

## Handoff

See [`GOOGLE_HANDOFF.md`](./GOOGLE_HANDOFF.md) for the implementation brief intended for the next development environment.
