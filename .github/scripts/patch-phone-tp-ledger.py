from pathlib import Path

path = Path('docs/GLOBAL-AUDIT-LEDGER.md')
text = path.read_text(encoding='utf-8')

old = """- Verified deployed `main` before this Category Correction review-focus substage: `501130123d8d9522729c34a29c38b36ecf76b5b0` (PR #196).
- Main workflow run #863: test/build/privacy/local-only checks `PASS`; GitHub Pages deployment `PASS` for exact build version `501130123d8d9522729c34a29c38b36ecf76b5b0`.
- PRs #188–#196 are merged and deployed. They repaired field accessible names, Settings tab semantics, primary navigation history semantics, native browser feedback, modal-stack accessibility, Prepare Next Month identity, reachable-control accessibility defects, safe modal initial-focus precedence, and MVSelect modal-scoped Tab traversal.
- `GA-INC-001` optional-category wording defect is technically resolved by PR #188; physical current-main regression remains governed by the device matrix.
- `GA-MONTH-001` broad rollover duplicate identity is technically resolved by PR #193 with shared UI/storage identity and lineage idempotency; physical current-main regression remains governed by the device matrix.
- `GA-A11Y-001` remains `OPEN` after deployed PR #196 because physical current-main verification and remaining shared-control review are still required. The next source-proven defect is Category Correction review focus: after keyboard activation of Preview changes, the same focused submit control changes in place to Confirm correction, allowing rapid double-Enter to execute the bulk rewrite before focus reaches the review summary. `repair/category-correction-review-focus` moves focus to the successful preview summary before confirmation; financial mutation semantics are unchanged and physical verification is not claimed.
- `GA-TP-002` per-bill Undo Funding attribution remains `BLOCKED`; this accessibility stage does not change Transfer Plan attribution or financial semantics.
"""

new = """- Verified deployed `main` before the first current-main physical phone repair: `fe6b86a7959c9a4b74f8cacbb54371219c695271` (PR #197).
- Main workflow run #865: test/build/privacy/local-only checks `PASS`; GitHub Pages deployment `PASS` for exact build version `fe6b86a7959c9a4b74f8cacbb54371219c695271`.
- PRs #188–#197 are merged and deployed. They repaired field accessible names, Settings tab semantics, primary navigation history semantics, native browser feedback, modal-stack accessibility, Prepare Next Month identity, reachable-control accessibility defects, safe modal initial-focus precedence, MVSelect modal-scoped Tab traversal, and Category Correction review focus safety.
- `GA-INC-001` optional-category wording defect is technically resolved by PR #188; physical current-main regression remains governed by the device matrix.
- `GA-MONTH-001` broad rollover duplicate identity is technically resolved by PR #193 with shared UI/storage identity and lineage idempotency; physical current-main regression remains governed by the device matrix.
- `GA-A11Y-001` source-only shared-control sweep is at `PARTIAL PASS`; current-main physical verification has begun on iPhone 13 Safari in Phone mode and remains required across the full device/mode matrix.
- `PHONE-TP-001` is a physically confirmed `FAIL`: iPhone 13 Phone-mode screenshots showed `£2,479.98 Transfer Required`, `0 accounts`, `0 unpaid · 13 paid`, and `0 funded cards` while the selected bill list showed paid rows. Source trace proved `calculateAccountFunding` was subtracting a negative destination balance even when selected unpaid total was zero, while lifecycle classification correctly returned Paid. `repair/transfer-plan-paid-only-negative-balance` fixes the calculation boundary so paid-only selections require £0.00 while preserving overdraft funding for genuine unpaid bills.
- The earlier Accounts fixed-bottom-navigation occlusion concern is physically `PASS`: a follow-up iPhone screenshot showed Activity, Reconcile, Edit, Archive and Delete permanently can all be scrolled fully above the bottom navigation.
- `GA-TP-002` per-bill Undo Funding attribution remains `BLOCKED`; PHONE-TP-001 does not change funding attribution, payment evidence, balances, transactions or storage semantics.
"""

if old not in text:
    raise SystemExit('Expected reconciliation block not found; refusing to patch ledger')

path.write_text(text.replace(old, new, 1), encoding='utf-8')
