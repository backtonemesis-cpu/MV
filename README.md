# MV Household Finance

MV is a private-use household finance application deployed as a static browser app.

## Current production architecture

- React + TypeScript + Vite.
- GitHub Pages static deployment.
- Household finance data is stored only in the user's browser localStorage.
- There is no production backend, shared database, Firebase authentication, or server-side household authorization in the current build.
- A new browser starts with a blank household. Production source code must never contain real household balances, transactions, bills, income, backups, or personal email addresses.
- Moving to another browser/device requires an explicit MV backup/restore until a separately approved shared-data architecture is implemented.

## Financial integrity principles

- GBP money is stored as integer pence.
- Internal transfers, savings transfers, and card repayments are excluded from household income/spending.
- Refunds/credits are separate from salary/income and restore available money without hiding gross spending.
- Planned obligations and actual ledger evidence remain separate.
- Transfer Plan funding is not bill payment.
- Exact linked records are used for payment/funding undo.
- Reconciliation uses an explicit balance anchor and post-anchor actual movements.
- Same-name accounts are identified by stable account ID, account type, and owner.
- Optimistic version checks reject stale writes in the local browser.

## Privacy rule

Never commit real household financial data or production backup exports to this repository.

The CI pipeline must fail if retired production seed files or obvious personal-email/household-fixture markers are reintroduced.

## Development workflow

- Keep `main` deployable.
- Use feature/audit branches for substantive changes.
- Preserve a rollback point before financial-engine changes.
- Run typecheck, finance/storage regression tests, production build checks, and privacy guards before deployment.
- Do not treat a green build as proof that the financial application is fully audited.
