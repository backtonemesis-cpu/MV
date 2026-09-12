# MV Household Finance / Penny — Global Audit Ledger

> **Role:** current repository-resident master defect/evidence register for the discovery-inclusive global audit and repair programme.
>
> **Authority:** current GitHub source, current PR/branch state, CI, deployment evidence and available runtime evidence establish implementation state. Master Autonomous Engineering Authority v2 governs execution and completion. Permanent MV standards govern approved behaviour. Historical chats/handover notes are not current truth unless reverified.

## 0. Maintenance rules

1. Verify current `main`, open PRs, relevant branches, CI and deployment before relying on this file.
2. Do not mark an item PASS because code merely exists; use evidence appropriate to the claim.
3. Physical-device evidence is a separate evidence tier. It is required only when Marius explicitly requests it for the relevant issue/final gate. Missing physical evidence is **not** a default blocker under Master Authority v2.
4. Preserve financial truth: integer pence, exact stable account IDs, no transfer-as-income/spend, no duplicate spend/income, funding != payment, exact linked undo, £0 valid, UK-local dates.
5. Later material work touching a passed area requires proportionate regression review.
6. Do not silently drop material issues. Historical superseded items may be condensed once their disposition is explicit and Git history preserves implementation detail.
7. `BLOCKED` means a genuine unresolved dependency/semantic ambiguity, not ordinary engineering difficulty.
8. Do not declare the global programme COMPLETE while a known material unresolved defect remains.

Allowed current statuses: `PASS`, `PARTIAL PASS`, `FAIL`, `OPEN`, `BLOCKED`, `TBC`, `SUPERSEDED`, `DEFERRED`, `N/A`.

---

## 1. Current verified baseline — 2026-09-12

| Item | Current evidence |
|---|---|
| Repository | `backtonemesis-cpu/MV` |
| Current `main` | `f6b8460c475cdd8938a3f870d6f6dcb4d12fa8cb` |
| Current main commit | `Add global reachable-control accessibility inventory gate (#207)` |
| Exact-main workflow | Run #894 / `34669056284` |
| Test/build/privacy/local-only | `PASS` |
| Main automated suite | `92/92` test files, `616/616` tests |
| GitHub Pages deploy | `PASS` in run #894 for exact current main |
| Production persistence | browser-local `mv_local_state_v2` |
| Cloud financial backend | not active |
| Physical evidence requirement | only when explicitly requested |

**Freshness rule:** this baseline becomes historical immediately when `main` advances. Re-read GitHub after every merge.

### Current delivery chain added 2026-09-12

| PR | Result | Current disposition |
|---:|---|---|
| #203 | Restored native browser contract for ordinary selectors; removed global native/custom bridge and coarse-pointer geometry interception; retained explicit rich MVSelect consumers | `PASS`, merged, exact-main CI/deploy PASS |
| #204 | Added exhaustive rendered-modal inventory gate across `dialog`/`alertdialog` and shared modal containment/accessibility stack | `PASS`, merged, exact-main CI/deploy PASS |
| #205 | Restored browser zoom and corrected required `public/` CSS asset paths while preserving iPhone date and Unified Add fixes | `PASS`, merged, exact-main CI/deploy PASS |
| #206 | Reconciled this master ledger from current GitHub evidence and removed stale default physical-only blockers | `PASS`, merged, exact-main CI/deploy PASS |
| #207 | Added a whole-source TSX reachable-control AST inventory; initial false positives were classified and the inventory was corrected for dynamic labels, prop-spread primitives and ARIA listbox semantics | `PASS`, merged, exact-main CI/deploy PASS |

---

## 2. Financial invariant matrix

| Invariant | Status | Current evidence |
|---|---|---|
| Authoritative money uses integer pence | `PASS` | finance/storage suite |
| Internal transfer != income | `PASS` | finance classification tests |
| Internal transfer != spending | `PASS` | finance classification tests |
| Savings transfer remains internal | `PASS` | savings/transfer tests |
| Refund != ordinary income | `PASS` | refund classification tests |
| Credit-card repayment does not double-count spending | `PASS` | repayment safety tests |
| Planned bill != actual payment | `PASS` | planned-payment/payment linkage tests |
| Transfer Plan funding != payment | `PASS` | funding/payment lifecycle tests |
| Paid requires linked payment evidence where applicable | `PASS` | payment workflow/safety tests |
| Undo Funding reverses exact supported funding evidence | `PASS` | card/batch undo tests; per-bill attribution tracked as GA-TP-002 |
| Undo Payment reverses exact linked payment evidence | `PASS` | payment undo tests |
| Source/destination balances reconcile | `PASS` | transfer/cross-view reconciliation |
| Same-name accounts remain distinct | `PASS` | stable-ID + identity-label regression tests |
| £0 balance is valid | `PASS` | account/funding coverage |
| PlannedPayment ↔ Transaction reciprocal linkage | `PASS` | storage/finance tests |
| PlannedIncome linkage | `PASS` | storage/finance tests |
| Backup/restore integrity | `PASS` | local-store/category backup tests |
| UK-local date/month handling | `PASS` | date/month tests; September fallback work merged in #186 |

No current evidence establishes a known balance-reconciliation or monetary-corruption failure on current `main`.

---

## 3. Current material defect/evidence register

### GA-ARCH-001 — Local-only architecture and persistence
**Status:** `PASS`

Production remains a static React/Vite GitHub Pages application with browser-local `mv_local_state_v2`. CI guards against committed household data and retired backend configuration.

### GA-DASH-001 — Dashboard financial truth
**Status:** `PASS` for financial/source/automated contract

Shared finance/reconciliation tests pass. Remaining content/visual quality is tracked under `GLOBAL-COPY-001` / `PHONE-DENSITY-001`.

### GA-ACT-001 — Activity integrity / editing / destructive actions
**Status:** `PASS` for current source/automated contract

Destructive confirmation, edit/category/date and linked-evidence regression coverage pass.

### GA-ACC-001 / GLOBAL-IDENTITY-001 — Account identity and lifecycle
**Status:** `PASS`

Stable account IDs are authoritative. Same-name accounts remain distinct; current tests preserve `Lloyds · Current · Marius` vs `Lloyds · Current · Vesta`. Archive/reconcile/delete/ownership tests pass.

### GA-INC-001 — Income financial/category semantics
**Status:** `PASS` for finance semantics

Current source requires a valid income category and stable account identity. Content density/wording remains separately tracked under `GLOBAL-COPY-001`.

### GA-SAV-001 — Savings truth and classification
**Status:** `PASS` for financial classification/calculation

Savings calculations and internal-transfer classification tests pass.

### GA-TP-001 / PHONE-TP-001 — Transfer Plan supported lifecycle
**Status:** `PASS`

Funding and payment remain separate; reciprocal payment evidence, bulk payment, funded-selection locking, batch undo and paid-only negative-balance correction are covered by passing tests.

### GA-TP-002 — Per-bill Undo Funding attribution
**Status:** `BLOCKED`

Current funding evidence is destination-account/batch based and does not contain safe explicit bill-to-funding attribution. A per-bill undo cannot be implemented by proportional, positional or amount inference without risking incorrect balance reversal. Keep blocked until a safe data-model/linkage and backward-compatibility design is established from approved requirements/evidence.

### GA-SET-001 / PHONE-SET-001 — Settings controls and Phone tab strip
**Status:** `PASS` for current repaired contract

Settings tab-strip, semantics and contrast tests pass.

### GA-CAT-001 — Category System v2
**Status:** `PASS`

Schema, eligibility, management, reclassification, budgets and backup coverage pass. PR #128 is superseded; #129 is authoritative.

### GA-BUD-001 — Budget/category budget truth
**Status:** `PASS` for current source/automated contract

Category-v2 budget and dynamic-month tests pass; budgets remain non-transaction metadata.

### GA-MONTH-001 — Prepare Next Month identity/idempotency
**Status:** `PASS`

PR #193 merged the shared rollover identity/lineage repair. `monthRolloverIdentityAudit.test.ts` passes. `copiedFromId` lineage remains the strongest identity evidence.

### GA-BACKUP-001 — Whole-state backup/restore
**Status:** `PASS`

Local-store and category backup/restore validation, referential integrity and rollback tests pass.

### GA-ADD-001 — Unified Add launcher
**Status:** `PASS` for source/automated contract

One six-choice launcher remains; `bill` stays outside `TransactionType` and persists as PlannedPayment only.

### GA-MODAL-001 / GA-FOCUS-001 — Modal/focus architecture
**Status:** `PASS` for current rendered source/automated contract

PR #204 exhaustively inventories rendered `dialog`/`alertdialog` surfaces and requires the shared modal accessibility/containment stack. Physical-device behaviour remains a separate evidence tier.

### GA-SELECT-001 — Native/custom selector competition
**Status:** `PASS`

PR #203 removed the global native-select bridge, coarse-pointer hit-test suppression and competing picker architecture. The 28 ordinary HTML selects retain native browser/OS activation. Explicit rich `MVSelect` remains only for fields that need richer account identity/disabled-reason presentation.

### GA-SELECT-002 — Long financial-list pattern classification
**Status:** `OPEN`

Approved direction requires genuinely long financial lists to use a one-tap searchable list/sheet where search materially improves the task. Current evidence confirms the canonical starter catalogue already contains **37 expense categories** before user-added categories, so category selection is a genuine long-list case. Short fixed-choice selectors must remain native. Current selector families still need explicit classification and the long-list implementation must preserve exact IDs/eligibility and avoid native/custom competition.

### GA-DATE-001 — Date/month controls and current working month
**Status:** `PASS` for current source/automated contract

PR #186 is merged. Dynamic/local month handling and UK date tests pass. PR #205 preserves the required iPhone date-containment stylesheet.

### GA-HTML-001 — HTML shell accessibility / public asset paths
**Status:** `PASS`

PR #205 restored browser/user zoom and corrected the required public CSS asset paths. Exact-main CI/deploy pass.

### GA-A11Y-001 — Whole-app reachable-control accessibility inventory
**Status:** `PASS` for current source/automated inventory

PR #207 adds a TypeScript-AST inventory across all production TSX rather than a hand-written component shortlist. It currently finds no **definite** unnamed native controls/links/interactive-role widgets and no non-interactive element definitely placed in the forward tab order. The gate understands dynamic `htmlFor`/`id` expressions, caller-prop-spread primitives and explicit ARIA listbox/combobox roles.

This is not a physical-device claim and does not prevent later discovery of runtime-only accessibility defects.

### GA-DESKTOP-001 — Desktop layout baseline
**Status:** `PARTIAL PASS`

Existing desktop source/CSS regression tests pass. Discovery-inclusive reconciliation of all remaining screens/content/visual contracts is still pending.

### GA-PHONE-001 — Phone responsive baseline
**Status:** `PARTIAL PASS`

Numerous Phone/iPhone containment tests pass. Current known remaining work is content/density quality plus current-source revalidation of historical responsive candidates.

### GA-MODE-001 — PC/Phone mode switching
**Status:** `PARTIAL PASS`

Mode architecture and targeted tests exist. Current-source regression reconciliation for stale overlays/layout state across repeated mode switching remains.

### GA-REPO-001 — Repository / PR / delivery hygiene
**Status:** `PASS` at this baseline

PR #34 is closed/superseded. PRs #186/#193 are merged. PRs #203–#207 are merged with exact-main CI/deployment evidence where applicable. Current GitHub state remains authoritative after the next change.

---

## 4. Current content / responsive defect families

### PHONE-DENSITY-001 — Phone summary density/readability
**Status:** `PARTIAL FAIL / OPEN`

Historical sequence:
- #200 attempted density repair but was ineffective because of CSS cascade.
- #201 made the cascade effective but three-column Income was physically unreadable.
- #202 changed Income to two columns with Outstanding on the lower row; Savings retained 2×2.

Latest known geometry was recorded as layout PASS, but content/copy density remains open. Do not restore #200/#201 Income geometry without new evidence.

### GLOBAL-COPY-001 — Content/copy density
**Status:** `OPEN` — LOW/MEDIUM

Current source confirms copy that conflicts with the concise-copy standard, including Income helper/qualifier prose and raw `YYYY-MM` presentation in user-facing schedule/empty-state copy. This is a UX/content issue, not a financial-calculation failure.

### GLOBAL-RESPONSIVE-001 — Historical responsive defect family
**Status:** `OPEN / REVALIDATE`

Historical evidence included Split Categories horizontal overflow, Audit Trail clipping/panning, Savings Goal action clipping, Prepare Next Month wrapping/nested overflow and modal-content overflow. Later shared repairs may already have closed some symptoms. Confirm each against current source/tests before changing code.

---

## 5. Historical physical evidence policy

Historical physical evidence is retained only for what it directly observed at that time. Automated/source/CI/deployment evidence must never be called physical evidence.

Under Master Autonomous Engineering Authority v2:
- missing physical evidence does **not** block ordinary engineering, merge or deployment;
- a physical PASS claim requires actual physical evidence;
- physical evidence becomes mandatory only when Marius explicitly requests it for the relevant issue/final verification.

---

## 6. Material PR chronology / disposition

| PR / range | Current disposition |
|---|---|
| #24–#28 | local-only/static architecture — `PASS` |
| #34 | old visual branch — `SUPERSEDED / CLOSED` |
| #48–#51 | Activity/Accounts/Savings/Income truth repairs — `PASS` |
| #53–#72 | Transfer Plan lifecycle repair chain — `PASS`, except GA-TP-002 |
| #73–#90 | mode/global audit stages — implemented; later targeted repairs supersede stale wording |
| #100–#127 | money, entry, Activity/account lifecycle, Transfer Plan, modal/date repairs — `PASS` under current tests |
| #128 | old category approach — `SUPERSEDED` |
| #129 | Category System v2 — `PASS` |
| #130–#184 | destructive confirmation, containment, Unified Add, control/date/select hardening — implemented; selector architecture superseded by #203 where applicable |
| #185 | dynamic UK/local working month — `PASS` |
| #186 | September fallback cleanup — `MERGED / PASS` |
| #188–#197 | accessibility/navigation/month identity/reachable controls — `MERGED`; #193 closes GA-MONTH-001 |
| #198 | paid-only Transfer Plan correction — `PASS` |
| #199 | Phone Settings tab strip — `PASS` |
| #200 | Phone density first attempt — `SUPERSEDED` |
| #201 | density cascade repair — `SUPERSEDED` for Income 3-column geometry |
| #202 | readable Phone summary geometry — layout `PASS`; copy/density remains open |
| #203 | native-first selector architecture — `PASS` |
| #204 | exhaustive modal inventory gate — `PASS` |
| #205 | browser zoom/public asset paths — `PASS` |
| #206 | master evidence reconciliation — `PASS` |
| #207 | whole-source reachable-control inventory — `PASS` for source/automated evidence |

Git history remains the detailed implementation chronology; this ledger stores current consequence.

---

## 7. Current unresolved queue — risk ordered

This ordering must be rechecked whenever `main` changes.

| Priority | Item | Status | Current reason |
|---:|---|---|---|
| 1 | GA-TP-002 per-bill Undo Funding attribution | `BLOCKED` | No safe explicit bill-level funding attribution exists; guessing would risk financial corruption. Continue independent work. |
| 2 | GA-SELECT-002 long financial-list classification/searchability | `OPEN` | Expense category selection is a confirmed long-list case; classify selector families and implement the approved searchable pattern without global interception. |
| 3 | GLOBAL-RESPONSIVE-001 current-source revalidation | `OPEN` | Historical responsive defects need current confirmation/closure after shared repairs. |
| 4 | PHONE-DENSITY-001 / GLOBAL-COPY-001 | `OPEN` | Current source still contains excessive/duplicate helper copy and raw month strings. |
| 5 | GA-MODE-001 current mode-switch regression reconciliation | `PARTIAL PASS` | Needs current-source/test reconciliation; physical evidence not default. |
| 6 | GA-DESKTOP-001 / GA-PHONE-001 discovery-inclusive final source audit | `PARTIAL PASS` | Remaining screens/content/visual contracts must be reconciled after higher-priority items. |

No physical-only sweep is a default blocker.

---

## 8. Continuation protocol

1. Verify current GitHub truth and compare it with this file.
2. Continue the highest-risk non-blocked item; record genuine blockers and move to independent work.
3. For R2–R4 work: current source → root cause → concise Impact Analysis → smallest durable repair → targeted tests → broader regression → diff review → PR → exact-head CI → merge → exact-main CI/deploy → evidence reconciliation.
4. Classify test failures before changing expectations. Never weaken a valid test merely to get green.
5. Reconcile this same ledger after material change; do not create competing master registers.
6. Do not require routine physical verification unless explicitly requested.

### Final completion gate

The global programme may be called COMPLETE only when the Master Authority final gate is satisfied: discovery-inclusive scope accounted for; no known unresolved material defect falsely closed; applicable static/type/build/regression/financial/persistence/accessibility/responsive gates pass; intended repairs are merged/deployed; available runtime evidence is reconciled; requested physical evidence (if any) passes; and this master register matches final truth.

**Current programme status: WORKING / NOT COMPLETE.**
