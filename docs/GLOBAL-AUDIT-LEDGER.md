# MV Household Finance / Penny — Global Audit Ledger

> **Role:** current repository-resident master defect/evidence register for the discovery-inclusive global audit and repair programme.
>
> **Authority:** current GitHub source/CI/deployment evidence establishes implementation state. The Master Autonomous Engineering Authority v2 governs execution and completion. Permanent MV standards govern approved behaviour. Historical chat/handover state is not current truth unless reverified.

## 0. Maintenance rules

1. Verify current `main`, open PRs, relevant branches, CI and deployment before relying on this file.
2. Do not mark an item PASS because code merely exists; use evidence appropriate to the claim.
3. Physical-device evidence is a separate evidence tier. It is required only when Marius explicitly requests it for the relevant issue/final gate. Missing physical evidence is **not** a default blocker under Master Authority v2.
4. Preserve financial truth: integer pence, exact stable account IDs, no transfer-as-income/spend, no duplicate spend/income, funding != payment, exact linked undo, £0 valid, UK-local dates.
5. Later material work touching a passed area requires proportionate regression review.
6. Do not silently drop material issues. Historical superseded items may be condensed once their disposition is explicit and Git history preserves the implementation detail.
7. `BLOCKED` means a genuine unresolved dependency/semantic ambiguity, not ordinary engineering difficulty.
8. Do not declare the global programme COMPLETE while a known material unresolved defect remains.

Allowed current statuses: `PASS`, `PARTIAL PASS`, `FAIL`, `OPEN`, `BLOCKED`, `TBC`, `SUPERSEDED`, `DEFERRED`, `N/A`.

---

## 1. Current verified baseline — 2026-09-12

| Item | Current evidence |
|---|---|
| Repository | `backtonemesis-cpu/MV` |
| Current `main` | `7c6ed59820b715a074479b7551fd6b87c5cd67af` |
| Current main commit | `Restore browser zoom and correct public CSS asset paths (#205)` |
| Exact-main workflow | Run #889 / `34662700403` |
| Test/build/privacy/local-only | `PASS` |
| Main test count | `91/91` files, `613/613` tests on the equivalent PR head; exact-main test/build also PASS |
| GitHub Pages deploy | `PASS` in run #889 for current main |
| Open PRs after #205 merge | `NONE` |
| PR #34 | `SUPERSEDED / CLOSED` on 2026-09-12 after comparison with current main |
| Production persistence | browser-local `mv_local_state_v2` |
| Cloud financial backend | not active |

**Freshness rule:** re-read GitHub after any `main` advance. This section becomes historical immediately when the SHA changes.

### Current delivery chain added 2026-09-12

| PR | Result | Current disposition |
|---:|---|---|
| #203 | Restored native browser contract for ordinary selectors; removed global native/custom bridge and coarse-pointer geometry interception; retained explicit rich MVSelect consumers | `PASS`, merged, exact-main CI/deploy PASS |
| #204 | Added exhaustive rendered-modal inventory gate across `dialog`/`alertdialog` and shared modal containment/accessibility stack | `PASS`, merged, exact-main CI/deploy PASS |
| #205 | Restored browser zoom and corrected required `public/` CSS asset paths while preserving iPhone date and Unified Add fixes | `PASS`, merged, exact-main CI/deploy PASS |

---

## 2. Financial invariant matrix

| Invariant | Status | Evidence state |
|---|---|---|
| Authoritative money uses integer pence | `PASS` | finance/storage suite PASS |
| Internal transfer != income | `PASS` | finance classification tests PASS |
| Internal transfer != spending | `PASS` | finance classification tests PASS |
| Savings transfer remains internal | `PASS` | savings/transfer tests PASS |
| Refund != ordinary income | `PASS` | refund classification tests PASS |
| Credit-card repayment does not double-count spending | `PASS` | repayment safety tests PASS |
| Planned bill != actual payment | `PASS` | planned-payment/payment linkage tests PASS |
| Transfer Plan funding != payment | `PASS` | funding/payment lifecycle tests PASS |
| Paid requires linked payment evidence where applicable | `PASS` | payment workflow/safety tests PASS |
| Undo Funding reverses exact supported funding evidence | `PASS` | card/batch undo tests PASS; per-bill attribution tracked separately as GA-TP-002 |
| Undo Payment reverses exact linked payment evidence | `PASS` | payment undo tests PASS |
| Source/destination balances reconcile | `PASS` | transfer/cross-view reconciliation PASS |
| Same-name accounts remain distinct | `PASS` | stable-ID + identity-label regression tests PASS |
| £0 balance is valid | `PASS` | account/funding coverage PASS |
| PlannedPayment ↔ Transaction reciprocal linkage | `PASS` | storage/finance tests PASS |
| PlannedIncome linkage | `PASS` | storage/finance tests PASS |
| Backup/restore integrity | `PASS` | local-store/category backup tests PASS |
| UK-local date/month handling | `PASS` | date/month tests PASS; historical September fallback work merged in #186 |

No current evidence establishes a known balance-reconciliation or monetary-corruption failure on current `main`.

---

## 3. Current material defect/evidence register

### GA-ARCH-001 — Local-only architecture and persistence
**Status:** `PASS`

Production remains a static React/Vite GitHub Pages application with browser-local `mv_local_state_v2`. CI guards against committed household data and retired backend configuration. No current production financial backend is active.

### GA-DASH-001 — Dashboard financial truth
**Status:** `PASS` for financial/source/automated contract

Shared finance/reconciliation tests pass. Remaining content/visual quality is tracked under `GLOBAL-COPY-001` / `PHONE-DENSITY-001`, not as a separate financial failure.

### GA-ACT-001 — Activity integrity / editing / destructive actions
**Status:** `PASS` for current source/automated contract

Activity destructive confirmation, edit/category/date and linked-evidence regression coverage pass. No current source-level financial failure is established.

### GA-ACC-001 / GLOBAL-IDENTITY-001 — Account identity and lifecycle
**Status:** `PASS`

Stable account IDs are authoritative. Same-name accounts remain distinct; current tests explicitly preserve `Lloyds · Current · Marius` vs `Lloyds · Current · Vesta`. Archive/reconcile/delete/ownership tests pass. Historical blank/truncated-account symptoms do not justify a new code change without current evidence.

### GA-INC-001 — Income financial/category semantics
**Status:** `PASS` for finance semantics

Current source requires a valid income category and uses stable account identity. The old ledger claim that current UI still says `Category (optional)` is stale and is not reproduced in current source. Income content density/wording remains separately open under `GLOBAL-COPY-001`.

### GA-SAV-001 — Savings truth and classification
**Status:** `PASS` for financial classification/calculation

Savings calculations and internal-transfer classification tests pass. Current copy/density quality is tracked separately.

### GA-TP-001 / PHONE-TP-001 — Transfer Plan lifecycle
**Status:** `PASS` for supported financial lifecycle

Funding and payment remain separate; reciprocal payment evidence, bulk payment, funded-selection locking, batch undo and paid-only negative-balance correction are covered by passing tests. PR #198 repaired the paid-only shortfall defect and was merged/deployed; relevant historical physical evidence also passed.

### GA-TP-002 — Per-bill Undo Funding attribution
**Status:** `BLOCKED`

Current funding evidence is destination-account/batch based and does not contain safe explicit bill-to-funding attribution. A per-bill undo cannot be implemented by proportional, positional or amount inference without risking incorrect balance reversal. Keep blocked until a safe data-model/linkage and backward-compatibility design is established from approved requirements/evidence.

### GA-SET-001 / PHONE-SET-001 — Settings controls and Phone tab strip
**Status:** `PASS` for current repaired contract

PR #199 repaired the Phone Settings tab strip and was merged/deployed with relevant historical physical verification. Settings semantics/contrast tests pass. Broader whole-app accessibility inventory remains GA-A11Y-001.

### GA-CAT-001 — Category System v2
**Status:** `PASS`

Schema, eligibility, management, reclassification, budgets and backup coverage pass. PR #128 is superseded; #129 is the implemented path.

### GA-BUD-001 — Budget/category budget truth
**Status:** `PASS` for current source/automated contract

Category-v2 budget and dynamic-month tests pass; budgets remain non-transaction metadata.

### GA-MONTH-001 — Prepare Next Month identity/idempotency
**Status:** `PASS`

Old ledger OPEN state is stale. PR #193 merged the shared rollover identity/lineage repair. `monthRolloverIdentityAudit.test.ts` passes on current CI. `copiedFromId` lineage remains the strongest identity evidence.

### GA-BACKUP-001 — Whole-state backup/restore
**Status:** `PASS`

Current local-store and category backup/restore validation, referential integrity and rollback tests pass. Do not use real-data destructive restore merely for cosmetic QA.

### GA-ADD-001 — Unified Add launcher
**Status:** `PASS` for source/automated contract

One six-choice launcher remains; `bill` stays outside `TransactionType` and persists as PlannedPayment only. The required `public/unified-add-launcher-fix.css` layer is preserved by #205 and launcher tests pass.

### GA-MODAL-001 / GA-FOCUS-001 — Modal/focus architecture
**Status:** `PASS` for current rendered source/automated contract

PR #204 added an exhaustive rendered-modal inventory gate. Every current rendered modal/alertdialog is required to use the shared modal accessibility stack. Shared evidence covers top-modal Escape/Tab ownership, initial/return focus, inert/aria-hidden background isolation, body scroll lock, bounded modal card, internal scroll body, fixed actions and Phone safe-area target rules.

Physical-device behaviour remains a separate evidence tier and is not a default blocker.

### GA-SELECT-001 — Native/custom selector competition
**Status:** `PASS`

PR #203 removed the global `MVNativeSelectBridge`, native-select touch guard and coarse-pointer hit-test suppression. The 28 ordinary HTML selects now retain native browser/OS activation. Explicit rich `MVSelect` remains only where current presentation needs richer account identity/disabled-reason information. Stable IDs and exact eligibility logic are unchanged.

### GA-SELECT-002 — Long financial-list pattern classification
**Status:** `OPEN`

Approved product direction says genuinely long financial lists should use a one-tap searchable list/sheet where search materially improves the task. Current ordinary native selectors and direct select-only MVSelect consumers have not yet been exhaustively classified by option-set size/task complexity. Do not solve this by reintroducing global interception.

### GA-DATE-001 — Date/month controls and current working month
**Status:** `PASS` for current source/automated contract

PR #186 is **MERGED**, not open. Dynamic/local month handling and UK date tests pass. PR #205 preserves the required iPhone transaction-date containment stylesheet under the correct Vite public-asset path.

### GA-HTML-001 — HTML shell accessibility / public asset paths
**Status:** `PASS`

PR #205 removed `maximum-scale=1.0, user-scalable=no`, preserving browser/user zoom. The two required public CSS layers remain loaded using Vite-compatible root paths and the configured `/MV/` base. Exact-main CI and Pages deployment pass.

### GA-A11Y-001 — Whole-app reachable-control accessibility inventory
**Status:** `OPEN`

Targeted accessibility suites are extensive, but `reachableControlAccessibilityAudit.test.ts` is not an exhaustive whole-app rendered-control inventory. Current remaining work is to inventory reachable controls/shared primitives systematically and repair only concrete exceptions found. Do not infer a whole-app accessibility PASS from component-specific tests.

### GA-DESKTOP-001 — Desktop layout baseline
**Status:** `PARTIAL PASS`

Existing desktop source/CSS regression tests pass, but the discovery-inclusive audit has not yet reconciled every current screen/control against the latest visual/content standards. Physical desktop evidence is not a default blocker unless explicitly requested.

### GA-PHONE-001 — Phone responsive baseline
**Status:** `PARTIAL PASS`

Numerous Phone/iPhone containment tests pass and historical physical repairs are retained. Current known remaining issue is primarily content/density quality (`PHONE-DENSITY-001` / `GLOBAL-COPY-001`) plus discovery-inclusive revalidation of historical responsive candidates. Physical iPhone evidence is not a default blocker unless explicitly requested.

### GA-MODE-001 — PC/Phone mode switching
**Status:** `PARTIAL PASS`

Mode architecture and targeted tests exist. Current audit still needs current-source regression reconciliation for stale overlays/layout state across repeated mode switching. Physical repeated switching is only required if explicitly requested.

### GA-REPO-001 — Repository / PR / delivery hygiene
**Status:** `PASS` as of baseline above

PR #34 is closed/superseded. PR #186 and #193 are merged. After #205 merge there are no open PRs. Current GitHub state remains authoritative after the next change.

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

Current source confirms content that conflicts with the newer concise-copy standard, including Income helper/qualifier prose and raw `YYYY-MM` presentation in schedule/empty-state copy. This is a current source-confirmed UX/content issue, not a financial-calculation failure.

Repair must preserve financial values and semantics while applying the Content + Copy standard: remove duplicate explanation, shorten qualifiers, format months for users and keep the shortest safe wording.

### GLOBAL-RESPONSIVE-001 — Historical responsive defect family
**Status:** `OPEN / REVALIDATE`

Historical evidence included Split Categories horizontal overflow, Audit Trail clipping/panning, Savings Goal action clipping, Prepare Next Month wrapping/nested overflow and modal-content overflow. Some areas have since received substantial shared repairs. Do **not** patch from history alone; confirm each symptom against current source/tests before changing code, then close or repair with evidence.

---

## 5. Historical physical evidence policy

Historical physical evidence is retained only for what it directly observed at that time. Examples include successful targeted rechecks for account selected-state identity, category readability, transaction containment, Settings tab strip and paid-only Transfer Plan correction.

Under Master Autonomous Engineering Authority v2:
- automated/source/CI/deployment evidence must not be called physical evidence;
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
| #73–#90 | mode/global audit stages — implemented; later targeted repairs supersede old open-device wording |
| #100–#127 | money, entry, Activity/account lifecycle, Transfer Plan, modal/date repairs — `PASS` under current tests |
| #128 | old category approach — `SUPERSEDED` |
| #129 | Category System v2 — `PASS` |
| #130–#184 | destructive confirmations, iPhone containment, Unified Add, control/date/select hardening — implemented; latest selector architecture superseded by #203 where applicable |
| #185 | dynamic UK/local working month — `PASS` |
| #186 | September fallback cleanup — `MERGED / PASS` |
| #188–#197 | accessibility/navigation/month identity/reachable controls — `MERGED`; #193 closes GA-MONTH-001 source/automated gap |
| #198 | paid-only Transfer Plan funding correction — `PASS` |
| #199 | Phone Settings tab strip — `PASS` |
| #200 | Phone density first attempt — `SUPERSEDED` |
| #201 | density cascade repair — `SUPERSEDED` for Income 3-column geometry |
| #202 | readable Phone summary geometry repair — layout `PASS`; content remains PHONE-DENSITY-001/GLOBAL-COPY-001 |
| #203 | native-first selector architecture — `PASS` |
| #204 | exhaustive modal inventory gate — `PASS` |
| #205 | browser zoom/public asset-path repair — `PASS` |

Git history remains the detailed implementation chronology; this ledger stores current consequence, not every historical intermediate state.

---

## 7. Current unresolved queue — risk ordered

This ordering must be rechecked whenever `main` changes.

| Priority | Item | Status | Current reason |
|---:|---|---|---|
| 1 | GA-TP-002 per-bill Undo Funding attribution | `BLOCKED` | No safe explicit bill-level funding attribution exists; guessing would risk financial corruption. |
| 2 | GA-A11Y-001 whole-app reachable-control inventory | `OPEN` | Targeted suites are not yet a systematic current-main whole-app inventory. |
| 3 | GA-SELECT-002 long financial-list classification/searchability | `OPEN` | Native-first architecture fixed competition; long-list task classification remains. |
| 4 | GLOBAL-RESPONSIVE-001 current-source revalidation | `OPEN` | Historical responsive defects need current confirmation/closure after later shared repairs. |
| 5 | PHONE-DENSITY-001 / GLOBAL-COPY-001 | `OPEN` | Current source still contains excessive/duplicate helper copy and raw month strings. |
| 6 | GA-MODE-001 current mode-switch regression reconciliation | `PARTIAL PASS` | Needs current-source/test reconciliation; physical evidence not default. |
| 7 | GA-DESKTOP-001 / GA-PHONE-001 discovery-inclusive final source audit | `PARTIAL PASS` | Remaining screens/content/visual contracts must be reconciled after above items. |

No physical-only sweep is listed as a default blocker.

---

## 8. Continuation protocol

1. Verify current GitHub truth and compare it with this file.
2. Continue the highest-risk non-blocked item; record genuine blockers and move to independent work.
3. For R2–R4 work: current source → root cause → concise Impact Analysis → smallest durable repair → targeted tests → broader regression → diff review → PR → exact-head CI → merge → exact-main CI/deploy → evidence reconciliation.
4. Classify test failures before changing expectations. Never weaken a valid test merely to get green.
5. Reconcile this same ledger after material change; do not create competing master registers.
6. Do not require Marius to supply routine physical verification unless explicitly requested.

### Final completion gate

The global programme may be called COMPLETE only when the Master Authority final gate is satisfied: discovery-inclusive scope accounted for; no known unresolved material defect falsely closed; applicable static/type/build/regression/financial/persistence/accessibility/responsive gates pass; intended repairs are merged/deployed; available runtime evidence is reconciled; requested physical evidence (if any) passes; and this master register matches final truth.

**Current programme status: WORKING / NOT COMPLETE.**
