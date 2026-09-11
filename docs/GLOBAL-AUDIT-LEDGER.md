# MV Household Finance / Penny — Global Audit Ledger

> **Purpose:** durable, repository-resident handover for the ongoing global audit. This file records only evidence that can be traced to repository history/tests/current source or explicitly recorded physical-device results. It is not a substitute for checking the current repository before work begins.

## GLOBAL AUDIT LEDGER MAINTENANCE RULES

1. Every material global-audit PR must update this ledger.
2. No item moves to `PASS` merely because code exists; use tests, CI, deployment and physical evidence where each is required.
3. Physical-device requirements require physical-device evidence. Code/tests/deployment do not equal live iPhone or desktop verification.
4. Any later PR touching a previously passed area triggers targeted regression review of that area.
5. `SUPERSEDED` work remains documented but must not be reopened blindly.
6. `FUTURE` product/design ideas do not count as audit failures.
7. Financial integrity, traceability and recoverability outrank visual polish.
8. Current GitHub state always overrides stale SHA references in older chats or handovers.
9. Do not declare the global audit complete while material `FAIL`, `OPEN`, `BLOCKED` or required `UNPROVEN` items remain.
10. Every new audit chat begins by reading this ledger **and independently checking current GitHub state**.

Allowed status labels in this ledger are: `PASS`, `PARTIAL PASS`, `FAIL`, `OPEN`, `BLOCKED`, `UNPROVEN`, `FUTURE`, `SUPERSEDED`, `N/A`.

---

## 1. Current verified repository baseline

| Item | Verified state |
|---|---|
| Repository | `backtonemesis-cpu/MV` |
| Baseline main SHA when ledger v1 was created | `76d778671765e39b19ed25a0106d39e406d7f493` |
| Baseline main commit | PR #185 — dynamic UK/local working month |
| Latest verified successful main workflow at ledger creation | Run #827 / workflow run `34544553413` |
| Main test/build/privacy/local-only checks | `PASS` |
| GitHub Pages deployment in that run | `PASS` |
| Open PR #186 | `OPEN` — stale September fallback cleanup; PR CI run #829 was failing at the local finance/storage test step when ledger v1 was created |
| Open PR #34 | `SUPERSEDED` — old Activity/Accounts/Savings visual branch; do not opportunistically merge |

**Mandatory freshness rule:** the baseline above is historical as soon as `main` advances. At the start of every audit session, verify `main`, current workflows, deployment and open/draft PRs again.

### 2026-09-11 current-main reconciliation

- Verified deployed `main` before the first current-main physical phone repair: `fe6b86a7959c9a4b74f8cacbb54371219c695271` (PR #197).
- Main workflow run #865: test/build/privacy/local-only checks `PASS`; GitHub Pages deployment `PASS` for exact build version `fe6b86a7959c9a4b74f8cacbb54371219c695271`.
- PRs #188–#197 are merged and deployed. They repaired field accessible names, Settings tab semantics, primary navigation history semantics, native browser feedback, modal-stack accessibility, Prepare Next Month identity, reachable-control accessibility defects, safe modal initial-focus precedence, MVSelect modal-scoped Tab traversal, and Category Correction review focus safety.
- `GA-INC-001` optional-category wording defect is technically resolved by PR #188; physical current-main regression remains governed by the device matrix.
- `GA-MONTH-001` broad rollover duplicate identity is technically resolved by PR #193 with shared UI/storage identity and lineage idempotency; physical current-main regression remains governed by the device matrix.
- `GA-A11Y-001` source-only shared-control sweep is at `PARTIAL PASS`; current-main physical verification has begun on iPhone 13 Safari in Phone mode and remains required across the full device/mode matrix.
- `PHONE-TP-001` is a physically confirmed `FAIL`: iPhone 13 Phone-mode screenshots showed `£2,479.98 Transfer Required`, `0 accounts`, `0 unpaid · 13 paid`, and `0 funded cards` while the selected bill list showed paid rows. Source trace proved `calculateAccountFunding` was subtracting a negative destination balance even when selected unpaid total was zero, while lifecycle classification correctly returned Paid. `repair/transfer-plan-paid-only-negative-balance` fixes the calculation boundary so paid-only selections require £0.00 while preserving overdraft funding for genuine unpaid bills.
- The earlier Accounts fixed-bottom-navigation occlusion concern is physically `PASS`: a follow-up iPhone screenshot showed Activity, Reconcile, Edit, Archive and Delete permanently can all be scrolled fully above the bottom navigation.
- `GA-TP-002` per-bill Undo Funding attribution remains `BLOCKED`; PHONE-TP-001 does not change funding attribution, payment evidence, balances, transactions or storage semantics.

---

## 2. Device and environment baselines

| Environment | Baseline |
|---|---|
| Physical phone | iPhone 13, Safari, portrait |
| Desktop/laptop | HP OmniBook 7 AI 14-inch, 1920×1200, Windows scaling 150%, Chrome 100% |
| App presentation modes | User-selectable PC / Phone modes; repeated switching must be tested independently of physical viewport |
| Locale/financial context | UK terminology, GBP, UK/local calendar dates |

---

## 3. Financial invariant matrix

These invariants are the highest-priority regression gates.

| Invariant | Current status | Current evidence / remaining risk |
|---|---|---|
| Exact integer-pence arithmetic | `PASS` | Safe-integer validation and finance/storage regression coverage are present; latest verified main CI passed. |
| Internal transfers are not income | `PASS` | Transfer type/flags and financial calculations are separately classified and covered by finance tests. |
| Internal transfers are not spending | `PASS` | Same classification boundary as above. |
| Savings transfers are not ordinary income/spending | `PASS` | Savings/transfer classification is separately represented and covered by finance tests. |
| Card repayments are not duplicate spending | `PASS` | Repayment has its own transaction type/flag and dedicated repayment safety work/tests. |
| Refunds are not ordinary income | `PASS` | Refund is a separate transaction type/flag and is treated separately from income. |
| Funding != Paid | `PASS` | Transfer Plan stores funding as transfer evidence and payment as linked expense evidence; separate undo paths exist. |
| Paid requires actual evidence | `PASS` | PlannedPayment payment workflow creates reciprocal Activity evidence; undo rejects missing/duplicated/mismatched evidence. |
| Undo Funding reverses funding only | `PASS` | Current account/batch-level undo targets the exact latest recognised funding batch. Per-bill undo is a separate open architecture gap below. |
| Undo Payment reverses payment evidence only | `PASS` | Exact linked payment transaction is required before undo. |
| Source/destination transfer balances reconcile | `PASS` | Transfer/undo paths and cross-view reconciliation tests are present and pass current verified CI. |
| Same-name accounts remain distinct | `PASS` | Stable account IDs and owner/type identity are used; account-identity regression work exists. |
| Account owner identity remains exact | `PASS` | Stable ownership IDs/account-derived attribution work is present. |
| PlannedPayment ↔ Transaction reciprocal linkage | `PASS` | `plannedPaymentId` / `actualTransactionId` linkage and validation are present. |
| PlannedIncome linkage | `PASS` | Planned-income actual/link fields and receive workflow are represented and covered by storage/finance tests. |
| Category changes do not alter monetary truth | `PASS` | Category System v2 is ID/scoping driven and category operations are separated from monetary/account/date fields. |
| Backup/restore is atomic and referentially safe | `PASS` | Restore validates household shape and referential integrity, writes rollback copy before active state, and restores rollback-key state on write failure; category-v2 backup/restore tests and latest verified CI pass. Live destructive restore remains inappropriate for routine physical testing. |

---

## 4. Current material audit ledger

### GA-ARCH-001 — Local-only architecture and persistence

| Field | Record |
|---|---|
| ID / Audit Area | GA-ARCH-001 / Global Architecture |
| Requirement / Defect | Production household data must remain browser-local; GitHub repository/static bundle must not contain household finance data. |
| Original Evidence | Earlier cloud/Firebase direction was superseded by local-only work; global audit Stage 1 added a committed-data privacy guard. |
| Device / Environment | All |
| Root Cause | Earlier architecture evolved from cloud/shared concepts into local static deployment. |
| Repair | Local-store architecture, static GitHub Pages build, CI guard against committed finance data. |
| PR / Commit | PR #24 onward; global audit Stage 1 PR #84; later local-only checks retained. |
| Automated Test Coverage | Privacy/data guard and local-only architecture verification run in CI. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `UNPROVEN` |
| Current Status | `PASS` |
| Remaining Risk | Browser storage remains device/browser scoped by design; backup discipline remains important. |
| Last Later Change Touching Area | PR #185 did not change storage architecture. |
| Notes / Dependencies | Never commit real household data into this public repository. |

### GA-DASH-001 — Dashboard financial summary and actions

| Field | Record |
|---|---|
| ID / Audit Area | GA-DASH-001 / Dashboard |
| Requirement / Defect | Dashboard must use the same financial truth as Activity/Accounts/Income/Savings/Transfer Plan and expose stable primary actions. |
| Original Evidence | Global cross-view audit found the need for one reconciled financial source of truth. |
| Device / Environment | Desktop + Phone |
| Root Cause | Earlier independent view calculations/presentation drift. |
| Repair | Shared finance calculations, reconciliation tests, later unified Add action. |
| PR / Commit | PR #86; PR #142 and follow-ups. |
| Automated Test Coverage | Cross-view reconciliation, finance tests, unified Add launcher tests. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `PARTIAL PASS` |
| Current Status | `PARTIAL PASS` |
| Remaining Risk | Final end-to-end current-main physical regression pass remains required. |
| Last Later Change Touching Area | PR #185 working-month propagation. |
| Notes / Dependencies | Do not infer global visual/live pass solely from code/tests. |

### GA-ACT-001 — Activity integrity, editing and destructive actions

| Field | Record |
|---|---|
| ID / Audit Area | GA-ACT-001 / Activity |
| Requirement / Defect | Activity must show audit evidence without duplicate financial effects; edit/delete must preserve category/type/link integrity and destructive actions require explicit confirmation. |
| Original Evidence | Earlier global audit and screenshots exposed edit-category/destructive-confirmation/date issues. |
| Device / Environment | Desktop + Phone |
| Root Cause | Inconsistent interaction/date/category handling across legacy flows. |
| Repair | Activity ledger, edit eligibility/split fixes, destructive confirmation repair, UK-local date display. |
| PR / Commit | PR #48, #107, #123, #130. |
| Automated Test Coverage | Activity edit/destructive/date regression tests plus finance/store tests. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `PARTIAL PASS` |
| Current Status | `PARTIAL PASS` |
| Remaining Risk | Final complete live-device pass remains. |
| Last Later Change Touching Area | Global dropdown/date-control work through #183–#185 may affect reachable controls. |
| Notes / Dependencies | Linked bill/income evidence must remain reciprocal. |

### GA-ACC-001 — Accounts identity, balances and lifecycle

| Field | Record |
|---|---|
| ID / Audit Area | GA-ACC-001 / Accounts |
| Requirement / Defect | Stable account IDs, unambiguous owner/type identity, zero balances accepted, safe archive/reactivate/reconcile/delete. |
| Original Evidence | Same-name account collapse/owner ambiguity, zero-balance and archive/reconcile defects were found during audit. |
| Device / Environment | Desktop + Phone |
| Root Cause | Legacy name-oriented identity and inconsistent account lifecycle UX. |
| Repair | Stable ownership IDs, account identity helpers, lifecycle and permanent-delete eligibility, reconcile/archive UX, selected-account mobile presentation. |
| PR / Commit | #49, #62, #108–#112, #133–#137, #157. |
| Automated Test Coverage | Account ownership/delete/archive/reconcile/selected-account tests. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `PASS` |
| Current Status | `PASS` |
| Remaining Risk | Final global mode-switch/device sweep may still expose presentation regressions. |
| Last Later Change Touching Area | Global MVSelect work #182–#184 affects account selectors. |
| Notes / Dependencies | Same-name accounts must never be merged by display label. |

### GA-INC-001 — Income & Wages integrity and wording

| Field | Record |
|---|---|
| ID / Audit Area | GA-INC-001 / Income |
| Requirement / Defect | Expected/received income must preserve linkage, account attribution and valid income category semantics. UI wording must match required fields. |
| Original Evidence | Income category/type/wording and receipt-state issues were identified during global audit. |
| Device / Environment | Desktop + Phone |
| Root Cause | Legacy optional-category presentation and earlier mixed attribution patterns. |
| Repair | Income receive/link work, Category System v2 eligibility, account-derived attribution. |
| PR / Commit | #51, #129, #157–#158. |
| Automated Test Coverage | Finance/storage/category tests. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `UNPROVEN` |
| Current Status | `OPEN` |
| Remaining Risk | Current source still renders `Category (optional)` while save validation requires a valid income category. This is a wording/UX inconsistency, not currently a financial-integrity failure. |
| Last Later Change Touching Area | Category/dropdown work #129/#182–#184. |
| Notes / Dependencies | Narrow repair should change wording only unless inspection proves a deeper defect. |

### GA-SAV-001 — Savings truth and classification

| Field | Record |
|---|---|
| ID / Audit Area | GA-SAV-001 / Savings |
| Requirement / Defect | Savings view must use authoritative savings accounts/transactions and must not classify internal savings movements as spending/income. |
| Original Evidence | Early Savings view showed inappropriate accounts/calculation ambiguity. |
| Device / Environment | Desktop + Phone |
| Root Cause | Earlier presentation/calculation drift. |
| Repair | Authoritative savings calculation and classification. |
| PR / Commit | #50, #85, #86. |
| Automated Test Coverage | `savingsCalculation` and cross-view/finance tests. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `UNPROVEN` |
| Current Status | `PARTIAL PASS` |
| Remaining Risk | Final live layout/interaction sweep still required. |
| Last Later Change Touching Area | Global control/dropdown work. |
| Notes / Dependencies | Preserve internal-transfer classification. |

### GA-TP-001 — Transfer Plan functional lifecycle

| Field | Record |
|---|---|
| ID / Audit Area | GA-TP-001 / Transfer Plan |
| Requirement / Defect | Required lifecycle: Needs Funding → Funded by Transfer or Covered by Existing Balance → Paid/Complete; funding/payment independent. |
| Original Evidence | Repeated historical regressions replaced actions with passive state, showed funded bills as needing funds, or coupled Paid/Funding. |
| Device / Environment | Desktop + Phone |
| Root Cause | Transfer Plan was repeatedly patched across earlier designs. |
| Repair | V2 lifecycle, explicit actions, bulk payment, reciprocal payment evidence, funded-selection lock, exact batch undo. |
| PR / Commit | #53–#72, #113–#116 and follow-ups. |
| Automated Test Coverage | Transfer Plan funding/payment/bulk/payment-safety regression suites. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `PARTIAL PASS` |
| Current Status | `PARTIAL PASS` |
| Remaining Risk | Remaining physical live-device matrix is not fully closed. |
| Last Later Change Touching Area | Mobile card-density/global controls later changed presentation. |
| Notes / Dependencies | Visual redesign remains `FUTURE`, not an audit failure. |

### GA-TP-002 — Per-bill Undo Funding attribution

| Field | Record |
|---|---|
| ID / Audit Area | GA-TP-002 / Transfer Plan |
| Requirement / Defect | User requirement includes undoing funding for an individual bill without corrupting balances or other funded bills. |
| Original Evidence | Requirement recorded during Transfer Plan regression audit; existing card/batch undo is not equivalent. |
| Device / Environment | All |
| Root Cause | Current funding evidence is destination-account/batch based. `TransferPlanFundingBatch` records source allocations and destination, but no `plannedPaymentId` or per-bill allocation. |
| Repair | No safe per-bill repair implemented. Current code correctly avoids guessing attribution. |
| PR / Commit | N/A |
| Automated Test Coverage | Existing tests cover batch/card undo, not a safe per-bill attribution model. |
| CI Result | `N/A` |
| Merged Status | `N/A` |
| Deployment Status | `N/A` |
| Live Desktop Status | `N/A` |
| Live iPhone Status | `N/A` |
| Current Status | `BLOCKED` |
| Remaining Risk | Implementing this requires an explicit funding-allocation/linkage model and migration/backward-compatibility decision; amount inference is unsafe. |
| Last Later Change Touching Area | Current `transferPlanFunding` batch model still has no bill attribution at ledger creation. |
| Notes / Dependencies | This is an architecture/product-semantics decision. Do not implement by proportional or positional guessing. |

### GA-SET-001 — Settings / household-local controls

| Field | Record |
|---|---|
| ID / Audit Area | GA-SET-001 / Settings |
| Requirement / Defect | Settings controls, theme/preferences and data-management actions must be reachable and not imply remote permissions in the local-only build. |
| Original Evidence | Global audit covered settings consistency/contrast and legacy household-access concepts. |
| Device / Environment | Desktop + Phone |
| Root Cause | Evolving local-only architecture and visual inconsistency. |
| Repair | Local preferences/theme work, control-surface and contrast repairs. |
| PR / Commit | Multiple early settings/theme PRs; global stages #88–#90 and later control system. |
| Automated Test Coverage | Theme/contrast/control-surface tests. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `UNPROVEN` |
| Current Status | `PARTIAL PASS` |
| Remaining Risk | Reachable-control inventory and final live sweep remain. |
| Last Later Change Touching Area | Global control/dropdown work #178–#184. |
| Notes / Dependencies | Multi-user cloud permissions are outside current local-only production scope. |

### GA-CAT-001 — Category System v2

| Field | Record |
|---|---|
| ID / Audit Area | GA-CAT-001 / Categories |
| Requirement / Defect | Canonical category IDs/groups/scopes, lifecycle/admin, merge, recategorisation, budgets and backup/restore must remain coherent. |
| Original Evidence | Legacy category system had static/ambiguous behavior and migration risk. |
| Device / Environment | All |
| Root Cause | Legacy category model lacked required v2 lifecycle/scoping. |
| Repair | Category System v2 Stages 1–5. |
| PR / Commit | PR #129 merged; PR #128 `SUPERSEDED`. |
| Automated Test Coverage | Category schema/eligibility/backup/budget/admin regression suite. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `PASS` for the Step 44 category picker/readability checks recorded below. |
| Current Status | `PASS` |
| Remaining Risk | Later dropdown work requires normal regression awareness but no current category-integrity failure is known. |
| Last Later Change Touching Area | #182–#184 selector implementation; category eligibility itself unchanged. |
| Notes / Dependencies | Manual ordinary entry must use eligible final categories; system uncategorised roles remain special-purpose. |

### GA-BUD-001 — Budget view and category budget truth

| Field | Record |
|---|---|
| ID / Audit Area | GA-BUD-001 / Budget |
| Requirement / Defect | Budget data must use Category v2 IDs and selected/dynamic month, without mutating transaction truth. |
| Original Evidence | Category-v2 and month audit identified budget as a dependent surface. |
| Device / Environment | Desktop + Phone |
| Root Cause | Dependency on older category/month assumptions. |
| Repair | Category System v2 budget integration and dynamic month fallback. |
| PR / Commit | #129, #185. |
| Automated Test Coverage | Category budget and dynamic-active-month tests. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `UNPROVEN` |
| Current Status | `PARTIAL PASS` |
| Remaining Risk | Final live reachability/layout pass remains. |
| Last Later Change Touching Area | #185. |
| Notes / Dependencies | Do not treat budgets as transaction mutations. |

### GA-MONTH-001 — Prepare Next Month duplicate matching

| Field | Record |
|---|---|
| ID / Audit Area | GA-MONTH-001 / Prepare Next Month |
| Requirement / Defect | Re-running rollover must not create false duplicates or suppress distinct bills/incomes. |
| Original Evidence | Duplicate rollover risk was identified during global audit. |
| Device / Environment | All |
| Root Cause | Current fallback matching for bills uses name + account + amount + responsible person, but not category; income fallback similarly omits category. `copiedFromId` is authoritative when present, but manually equivalent target rows can still be misclassified by fallback. |
| Repair | Earlier duplicate guard exists, but semantic identity is not fully specified for category-distinct otherwise-identical rows. |
| PR / Commit | #106 introduced rollover duplicate protection; later month work #185. |
| Automated Test Coverage | Prepare-next-month tests exist and pass, but they do not close the category-distinct identity question. |
| CI Result | `PASS` for current tests |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `UNPROVEN` |
| Current Status | `OPEN` |
| Remaining Risk | Need explicit duplicate identity contract before changing fallback matching; category may be part of semantic identity, but this should be confirmed rather than guessed. |
| Last Later Change Touching Area | #185 month default/rollover month propagation. |
| Notes / Dependencies | `copiedFromId` remains the strongest duplicate evidence and must continue to win. |

### GA-BACKUP-001 — Whole-state backup / restore

| Field | Record |
|---|---|
| ID / Audit Area | GA-BACKUP-001 / Backup / Restore |
| Requirement / Defect | Export/restore must preserve complete current schema, reject invalid references, provide rollback safety and avoid partial mutation. |
| Original Evidence | Global financial-system audit and Category v2 migration required stronger restore integrity. |
| Device / Environment | Browser-local storage |
| Root Cause | Older backup format/schema paths required hardening as model evolved. |
| Repair | Versioned local backup envelope, shape/referential/category validation, rollback copy, failure restoration and Category-v2 round-trip/preflight work. |
| PR / Commit | #85 and #129 family. |
| Automated Test Coverage | `localStore` and Category backup/restore tests; latest verified main CI passes. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `N/A` |
| Live iPhone Status | `N/A` |
| Current Status | `PASS` |
| Remaining Risk | Real-data destructive restore should not be used as routine physical QA; retain downloadable backups before production migrations. |
| Last Later Change Touching Area | Later UI/control work did not alter restore core at ledger creation. |
| Notes / Dependencies | Restore path validates before active-state replacement and maintains rollback data. |

### GA-ADD-001 — Unified + Add launcher and persistence separation

| Field | Record |
|---|---|
| ID / Audit Area | GA-ADD-001 / Unified + Add |
| Requirement / Defect | One Home `+ Add` launcher with Expense, Income, Transfer, Refund, Repayment, Bill; Bill must remain PlannedPayment-only. |
| Original Evidence | User-approved consolidation of separate Home Add Transaction/Add Bill actions. |
| Device / Environment | Desktop + iPhone |
| Root Cause | Two competing entry points and unused sixth type-selector cell. |
| Repair | One launcher; `UnifiedAddChoice = TransactionType | 'bill'`; separate Bill save path. |
| PR / Commit | #142; hardening #143–#149, #151–#177. |
| Automated Test Coverage | Unified Add launcher/initial-state/consistency/batch-entry/shared-UI/date/containment tests. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `UNPROVEN` for a single current-main end-to-end six-choice routing sweep after all later hardening. |
| Current Status | `PARTIAL PASS` |
| Remaining Risk | One current-main physical iPhone launcher/routing check remains appropriate; do not reimplement the feature. |
| Last Later Change Touching Area | #177 field typography; #182–#184 dropdown system can affect selected forms but not launcher semantics. |
| Notes / Dependencies | `bill` must never be added to `TransactionType`. Opening/switching/cancelling must create nothing. |

### GA-MODAL-001 — Modals / sheets / footer containment

| Field | Record |
|---|---|
| ID / Audit Area | GA-MODAL-001 / All Modals & Sheets |
| Requirement / Defect | Header/footer/actions reachable; vertical scroll works; no horizontal panning/clipping; focus/Escape behavior correct. |
| Original Evidence | iPhone screenshots showed clipped/panning transaction/Add Bill/date/footer states. |
| Device / Environment | iPhone 13 Safari + Desktop |
| Root Cause | Mixed legacy modal geometry, WebKit intrinsic sizing, safe-area/footer interactions. |
| Repair | Global modal accessibility plus targeted iPhone containment/date/footer fixes. |
| PR / Commit | #118–#127, #131–#141, #143–#177. |
| Automated Test Coverage | Modal viewport, footer safe-area, Add Bill containment, date containment and accessibility tests. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `PARTIAL PASS` |
| Current Status | `PARTIAL PASS` |
| Remaining Risk | Not every reachable modal has a post-latest-change physical check. |
| Last Later Change Touching Area | #182–#184 selector system and #185 month flow. |
| Notes / Dependencies | Never hide underlying overflow as the sole fix when child geometry remains oversized. |

### GA-SELECT-001 — MVSelect / dropdown / native selector architecture

| Field | Record |
|---|---|
| ID / Audit Area | GA-SELECT-001 / Dropdowns & Selectors |
| Requirement / Defect | Action menus vs value selectors must be semantically correct, contained, keyboard/touch usable and iOS-safe. |
| Original Evidence | Global dropdown audit found inconsistent native/custom menus, clipping and iOS touch behavior. |
| Device / Environment | Desktop + iPhone Safari |
| Root Cause | Multiple legacy selector implementations and Safari/native-control behavior. |
| Repair | Global MVSelect architecture, native iOS picker guard, empty direct-MVSelect protection. |
| PR / Commit | #182, #183, #184. |
| Automated Test Coverage | Global MV dropdown tests, empty-state tests, native select touch guard tests. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `PARTIAL PASS` |
| Current Status | `PARTIAL PASS` |
| Remaining Risk | Full reachable-selector inventory and physical matrix remain to be completed. |
| Last Later Change Touching Area | #184. |
| Notes / Dependencies | Preserve native iOS picker behavior where intentionally used. |

### GA-DATE-001 — Date / month controls and UK-local defaults

| Field | Record |
|---|---|
| ID / Audit Area | GA-DATE-001 / Date & Month Controls |
| Requirement / Defect | UK/local calendar dates, no UTC rollover surprises, native Safari interaction retained, no fixed September production default. |
| Original Evidence | Date frame/picker issues and fixed-month defaults were identified during iPhone/global audit. |
| Device / Environment | All, especially iPhone Safari |
| Root Cause | Browser-native date rendering plus legacy fixed working-month assumptions. |
| Repair | Local date/month helpers, iPhone date containment/presentation fixes, PR #185 dynamic app working month. |
| PR / Commit | #123–#127, #170–#172, #179/#181, #185. |
| Automated Test Coverage | UK date display, date frame/containment and dynamic active-month tests. |
| CI Result | `PASS` on main baseline |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `PARTIAL PASS` |
| Current Status | `OPEN` |
| Remaining Risk | PR #186 is an open follow-up attempting to remove defensive `2026-09` fallbacks from standalone TransactionModal/TransferPlanView; its CI run #829 was failing at ledger creation and it must not be merged until diagnosed. Historical migration ID containing `2026-09` is intentionally preserved. |
| Last Later Change Touching Area | #185 main; #186 open/unmerged. |
| Notes / Dependencies | Explicit selected/imported months must take precedence over defaults. |

### GA-DESKTOP-001 — Desktop baseline

| Field | Record |
|---|---|
| ID / Audit Area | GA-DESKTOP-001 / Desktop Layout |
| Requirement / Defect | Stable PC-mode layout at 1920×1200 / 150% Windows scaling / Chrome 100%; no phone-style oversized forms or clipped menus. |
| Original Evidence | Global audit desktop baseline requirements. |
| Device / Environment | HP OmniBook baseline above |
| Root Cause | Earlier mixed responsive rules/density. |
| Repair | Global audit Stage 5 and later component-specific desktop fixes. |
| PR / Commit | #89 and later control/UI PRs. |
| Automated Test Coverage | Desktop layout/control/readability tests. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `N/A` |
| Current Status | `UNPROVEN` |
| Remaining Risk | A final current-main physical desktop sweep is still required for global closure. |
| Last Later Change Touching Area | #182–#185. |
| Notes / Dependencies | Automated CSS contracts are not physical visual proof. |

### GA-PHONE-001 — Phone mode and iPhone Safari

| Field | Record |
|---|---|
| ID / Audit Area | GA-PHONE-001 / Phone Mode & iPhone 13 Safari |
| Requirement / Defect | Portrait Phone mode must remain contained, touch-usable, safe-area aware and vertically scrollable. |
| Original Evidence | Extensive iPhone screenshot audit found modal, field, footer, selector and card-density defects. |
| Device / Environment | iPhone 13 Safari portrait; Phone mode on laptop also relevant |
| Root Cause | Mixed WebKit/native-control sizing and legacy responsive rules. |
| Repair | Global Stage 6 plus targeted PRs #118–#141 and later unified Add/date/select fixes. |
| PR / Commit | #90, #118–#141, #143–#184. |
| Automated Test Coverage | Mobile UX plus numerous `iphone*Audit` tests. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `N/A` |
| Live iPhone Status | `PARTIAL PASS` |
| Current Status | `PARTIAL PASS` |
| Remaining Risk | Final all-screen current-main iPhone pass remains. |
| Last Later Change Touching Area | #184 selectors / #185 month propagation. |
| Notes / Dependencies | Preserve physical evidence separately from code/test status. |

### GA-MODE-001 — PC mode on iPhone and repeated PC ↔ Phone switching

| Field | Record |
|---|---|
| ID / Audit Area | GA-MODE-001 / Presentation Mode Switching |
| Requirement / Defect | PC/Phone selector stays accessible and repeated switching does not leave clipped/offscreen/stale layout state. PC mode on iPhone must remain usable. |
| Original Evidence | Explicit global-audit device matrix. |
| Device / Environment | Laptop + iPhone 13 Safari |
| Root Cause | App uses user-selected presentation classes in addition to viewport behavior; cross-mode regressions are possible. |
| Repair | Device layout/mode-switch architecture and later iPhone PC-mode date containment. |
| PR / Commit | #73–#83, #179. |
| Automated Test Coverage | Device/layout and iPhone PC-mode contracts exist. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `UNPROVEN` |
| Current Status | `UNPROVEN` |
| Remaining Risk | Final repeated physical switching sequence has not been closed in durable evidence. |
| Last Later Change Touching Area | #182–#185. |
| Notes / Dependencies | Do not replace user-selected mode with CSS viewport inference. |

### GA-FOCUS-001 — Keyboard, focus and modal accessibility

| Field | Record |
|---|---|
| ID / Audit Area | GA-FOCUS-001 / Keyboard & Focus |
| Requirement / Defect | No unwanted first-field autofocus/keyboard; Escape/Enter/focus restore must be predictable; hidden controls removed from keyboard path. |
| Original Evidence | Physical iPhone audit showed unwanted keyboard/opening and viewport-offset risk. |
| Device / Environment | Desktop keyboard + iPhone Safari |
| Root Cause | Legacy autofocus/modal behavior and hidden-form state. |
| Repair | Shared modal accessibility utility, removed money-field autofocus, unified Add initial-state hiding, focus/viewport repairs. |
| PR / Commit | #88, #100–#105, #124–#127, #145–#148. |
| Automated Test Coverage | Interaction accessibility, money input and modal tests. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `PASS` for the specifically retested unwanted-autofocus/transaction area; global inventory remains incomplete. |
| Current Status | `PARTIAL PASS` |
| Remaining Risk | Reachable-control keyboard inventory remains open. |
| Last Later Change Touching Area | #182–#184 custom dropdown architecture. |
| Notes / Dependencies | Do not add autofocus to monetary inputs. |

### GA-A11Y-001 — Reachable-control accessibility inventory

| Field | Record |
|---|---|
| ID / Audit Area | GA-A11Y-001 / Accessibility |
| Requirement / Defect | Every reachable button/menu/listbox/dialog/form control must have correct semantics, labels, focus order, target size and keyboard/touch behavior. |
| Original Evidence | Global-audit completeness requirement; multiple targeted fixes exist but no durable evidence of a final entire-app reachable-control inventory. |
| Device / Environment | Desktop keyboard + iPhone touch |
| Root Cause | Incremental component evolution. |
| Repair | Many targeted accessibility repairs and shared utilities. |
| PR / Commit | #88 onward; selector/modal/accessibility PRs. |
| Automated Test Coverage | Interaction accessibility and component-specific regression tests. |
| CI Result | `PASS` |
| Merged Status | `PASS` |
| Deployment Status | `PASS` |
| Live Desktop Status | `UNPROVEN` |
| Live iPhone Status | `PARTIAL PASS` |
| Current Status | `OPEN` |
| Remaining Risk | A systematic current-main reachable-control inventory is still required for global completion. |
| Last Later Change Touching Area | #182–#184. |
| Notes / Dependencies | WCAG/APG semantics should be checked at the component actually rendered, not inferred from visual appearance. |

### GA-REPO-001 — Repository / PR / CI / deployment hygiene

| Field | Record |
|---|---|
| ID / Audit Area | GA-REPO-001 / Repository & Delivery |
| Requirement / Defect | Audit work must be branch/PR/CI controlled; stale branches must not be mistaken for current work. |
| Original Evidence | Long-running audit accumulated superseded/open PRs. |
| Device / Environment | GitHub |
| Root Cause | Iterative audit and long chat history. |
| Repair | Controlled PR workflow plus this durable ledger. |
| PR / Commit | This ledger PR plus historical audit PR chain. |
| Automated Test Coverage | Repository CI. |
| CI Result | `PASS` on main baseline; PR #186 currently not green |
| Merged Status | `PARTIAL PASS` |
| Deployment Status | `PASS` on main baseline |
| Live Desktop Status | `N/A` |
| Live iPhone Status | `N/A` |
| Current Status | `OPEN` |
| Remaining Risk | Diagnose/resolve or supersede #186; close/supersede stale #34 when safe. Do not merge stale visual work. |
| Last Later Change Touching Area | #186 open. |
| Notes / Dependencies | Current GitHub state is authoritative over chat references. |

---

## 5. Known physical/manual evidence

`HISTORICAL NUMBERING EVIDENCE INCOMPLETE`

Only step numbers and results that survived reliable handover evidence are retained here. Missing numbers are not reconstructed by guesswork.

| Step | Screen / action | Original result | Later repair | Current code/test status | Live Desktop | Live iPhone |
|---|---|---|---|---|---|---|
| Step 43 | New Transaction mobile entry/focus behavior | Unwanted/fragile initial focus behavior was under review | Autofocus removed/guarded in later transaction/modal work | `PASS` | `UNPROVEN` | `PASS` for the specifically retested behavior |
| Step 44 | Income/Transaction selected category readability | Long `Child Maintenance Received` selected value clipped in Safari | PR #131 then #132 narrowing | `PASS` | `UNPROVEN` | `PASS` |
| Step 44 | Expense → Category picker eligibility/interaction | One screenshot raised concern when no type was selected; deliberate Expense test showed normal eligible categories | Concern superseded; no category-system repair required | `PASS` | `UNPROVEN` | `PASS` |
| Step 44 | New Transaction horizontal containment | Modal could pan horizontally after oversized Account/Category geometry | Later containment repair removed >100%/negative geometry | `PASS` | `UNPROVEN` | `PASS` |
| Step 44 follow-up | Account selected-state identity/readability | Native closed account text clipped/ambiguous | Coherent selected account field/identity work | `PASS` | `UNPROVEN` | `PASS` |
| Later iPhone Add Bill check | Add Bill horizontal panning / inconsistent widths | Physical defect | Add Bill containment/field-geometry repair | `PASS` | `UNPROVEN` | `PASS` recorded before unified Add rollout |

**Physical evidence rule:** a later PR touching the same rendered control may require a targeted physical recheck even when the historical physical result was `PASS`.

---

## 6. Compact material PR / repair chronology

This is intentionally a repair-chain index, not a list of every repository PR.

| PR / range | Purpose / outcome | Status |
|---|---|---|
| #16 | Earlier cloud/Firestore-era work | `SUPERSEDED` |
| #24–#28 | Local-only architecture / static GitHub Pages path | `PASS` |
| #34 | Old Activity/Accounts/Savings visual modernization branch | `SUPERSEDED` |
| #36 | Later Activity/Accounts/Savings restyle | `PASS` |
| #39 | Month-range work | `PASS` |
| #48–#51 | Activity ledger, Accounts grouping, Savings authoritative calculations, Income/household repairs | `PASS` |
| #53–#72 | Major Transfer Plan funding/payment/ownership/undo/V2 repair chain | `PASS` with GA-TP-002 exception |
| #73–#83 | PC/Phone presentation architecture and mode switching | `PARTIAL PASS` — final physical matrix still required |
| #84 | Global audit Stage 1 privacy/data guard | `PASS` |
| #85 | Stage 2 finance/data integrity | `PASS` |
| #86 | Stage 3 cross-view reconciliation | `PASS` |
| #87 | Earlier interaction/accessibility attempt | `SUPERSEDED` |
| #88 | Stage 4 interactions/accessibility | `PASS` with GA-A11Y-001 final inventory still open |
| #89 | Stage 5 desktop baseline | `PARTIAL PASS` — physical final pass unproven |
| #90 | Stage 6 mobile/iPhone hardening | `PARTIAL PASS` — later targeted defects were found/repaired |
| #100–#105 | Money-input and Add Bill entry/accessibility/category fixes | `PASS` |
| #106 | Prepare Next Month focus/duplicate protection | `PARTIAL PASS` — duplicate semantic identity remains GA-MONTH-001 |
| #107–#112 | Activity editing + account add/edit/reconcile/archive lifecycle | `PASS` |
| #113–#116 | Transfer Plan funded selection, bulk payments and payment safety/UX | `PASS` |
| #117–#127 | UK payment/date, modal/footer/card-density/iPhone transaction repairs | `PASS` for code/tests; physical evidence item-specific |
| #128 | Legacy category migration approach | `SUPERSEDED` |
| #129 | Category System v2 Stages 1–5 | `PASS` |
| #130 | Activity destructive confirmations | `PASS` |
| #131–#137 | Step 44 category/account/transaction containment chain | `PASS` |
| #138–#141 | Add Bill iPhone containment/footer/date chain | `PASS` |
| #142 | Unified Dashboard + Add launcher | `PASS` |
| #143–#149 | Unified Add shell/initial-state/iPhone hardening | `PASS` |
| #150 | Earlier dropdown/select attempt | `SUPERSEDED` |
| #151–#177 | Unified Add safe-area, switching, batch-entry, typography, attribution, repayment, shared UI and date/presentation hardening | `PASS` |
| #178–#181 | Global control typography and iPhone date/surface parity | `PASS` |
| #182 | Global MVSelect/dropdown architecture | `PASS` |
| #183 | Native iOS picker protection | `PASS` |
| #184 | Prevent empty direct MVSelect popovers | `PASS` |
| #185 | Dynamic UK/local working month | `PASS` |
| #186 | Remove remaining defensive September fallbacks | `OPEN` — CI failing at ledger creation; do not merge until diagnosed |

---

## 7. Current unresolved queue — risk ordered

This queue must be re-ranked against current GitHub state at the start of every audit session.

| Priority | Item | Status | Why it remains |
|---:|---|---|---|
| 1 | GA-TP-002 per-bill Undo Funding attribution | `BLOCKED` | No safe bill-level funding attribution exists; requires explicit financial architecture/product decision. |
| 2 | GA-MONTH-001 Prepare Next Month duplicate semantic identity | `OPEN` | Fallback matching omits category; exact intended identity needs confirmation before repair. |
| 3 | GA-A11Y-001 full reachable-control accessibility inventory | `OPEN` | Targeted tests exist, but no durable final current-main whole-app inventory. |
| 4 | GA-MODE-001 final PC/Phone/iPhone mode-switch matrix | `UNPROVEN` | Requires physical/live evidence. |
| 5 | GA-DESKTOP-001 final current-main desktop sweep | `UNPROVEN` | Requires physical/live evidence. |
| 6 | GA-PHONE-001 final current-main all-screen iPhone sweep | `PARTIAL PASS` | Many checks passed individually, not one final post-latest-change sweep. |
| 7 | GA-ADD-001 current-main unified Add six-choice routing physical sweep | `PARTIAL PASS` | Implemented/tested/deployed; final current-main physical routing check still useful. |
| 8 | GA-INC-001 `Category (optional)` wording | `OPEN` | Source validation requires a category, so label is misleading. |
| 9 | GA-DATE-001 / PR #186 | `OPEN` | Follow-up PR exists but CI is not green. Diagnose rather than merge blindly. |
| 10 | GA-REPO-001 stale PR #34 cleanup | `OPEN` | Repository hygiene only; do not prioritise above functional/a11y/device work. |

No known current-main financial corruption or balance-reconciliation failure was established when ledger v1 was created.

---

## 8. Current design/future items that are not audit failures

| Item | Status | Rule |
|---|---|---|
| Transfer Plan visual redesign concept | `FUTURE` | Functional/financial audit takes precedence; do not implement opportunistically. |
| Broader visual-polish ideas not tied to a proven defect | `FUTURE` | Keep separate from global-audit completion criteria unless explicitly authorised. |
| Future multi-user/cloud synchronization and permissions | `FUTURE` | Current production architecture is local-only. |

---

## 9. Audit continuation protocol

Every continuation must follow this order:

1. Read this ledger from current `main`.
2. Verify current `main` SHA, recent commits, open/draft PRs, latest main CI and Pages deployment.
3. Reconcile any PRs/commits newer than this ledger revision.
4. Recheck the risk-ordered unresolved queue; remove stale items only with evidence.
5. For a proven defect whose behavior is not ambiguous: impact analysis → root cause → narrow repair → targeted tests → full suite → typecheck → privacy/data guard → local-only check → production build → PR → CI → merge → post-merge main CI → Pages deploy → live/physical check where required.
6. Stop for user input only when physical-device evidence, destructive real-data action, ambiguous financial semantics, or a genuine product-choice decision is required.
7. Update this ledger in the same material audit PR or immediately following evidence-only ledger update.

### Final global-completion gate

Do not declare the global audit complete until all required areas have been reconciled on current deployed `main`, including Dashboard, Activity, Accounts, Income, Savings, Transfer Plan, Settings, Categories, Budget, Prepare Next Month, Backup/Restore, all reachable modals/selectors/date controls, Desktop, Phone mode, physical iPhone 13 Safari, PC mode on iPhone, repeated PC↔Phone switching, keyboard/focus/accessibility, financial reconciliation and storage/backup integrity.
