# MV Household Finance / Penny — Global Audit Ledger

> **Role:** current repository-resident master defect/evidence register for the discovery-inclusive global audit and repair programme.
>
> **Authority:** current GitHub source, current PR/branch state, CI, deployment evidence and available runtime evidence establish implementation state. Master Autonomous Engineering Authority v2 governs execution and completion. Permanent MV standards govern approved behaviour. Historical chats/handover notes are not current truth unless reverified.

## 0. Maintenance rules

1. Verify current `main`, open PRs, relevant branches, CI and deployment before relying on this file.
2. Do not mark an item PASS because code merely exists; use evidence appropriate to the claim.
3. Physical-device evidence is a separate evidence tier and is required only when Marius explicitly requests it for the relevant issue/final gate.
4. Preserve financial truth: integer pence, exact stable account IDs, no transfer-as-income/spend, no duplicate spend/income, funding != payment, exact linked undo, £0 valid, UK-local dates.
5. Later material work touching a passed area requires proportionate regression review.
6. Do not silently drop material issues. Historical superseded items may be condensed once disposition is explicit and Git history preserves implementation detail.
7. `BLOCKED` means a genuine unresolved dependency/semantic ambiguity, not ordinary engineering difficulty.
8. Do not declare the global programme COMPLETE while a known material unresolved defect remains.

Allowed statuses: `PASS`, `PARTIAL PASS`, `FAIL`, `OPEN`, `BLOCKED`, `TBC`, `SUPERSEDED`, `DEFERRED`, `N/A`.

---

## 1. Current verified baseline — 2026-09-12

| Item | Current evidence |
|---|---|
| Repository | `backtonemesis-cpu/MV` |
| Current `main` | `8f89c1c39e621646cc48f83e5821e2731cac085e` |
| Current main commit | `Tighten Income copy and readable month labels (#215)` |
| Exact-main workflow | Run #918 / `34689367423` |
| Test/build/privacy/local-only | `PASS` |
| Main automated suite | full repository suite PASS in run #918 |
| GitHub Pages deploy | `PASS` in run #918 for exact current main |
| Production persistence | browser-local `mv_local_state_v2` |
| Cloud financial backend | not active |
| Physical evidence requirement | only when explicitly requested |

**Freshness rule:** this baseline becomes historical immediately when `main` advances. Re-read GitHub after every merge.

### Current delivery chain added 2026-09-12

| PR | Result | Current disposition |
|---:|---|---|
| #203 | Restored native browser contract for ordinary selectors; removed global native/custom bridge and coarse-pointer interception | `PASS`, merged, exact-main CI/deploy PASS |
| #204 | Added exhaustive rendered-modal inventory gate across `dialog`/`alertdialog` and shared modal accessibility stack | `PASS`, merged, exact-main CI/deploy PASS |
| #205 | Restored browser zoom and corrected required `public/` CSS asset paths while preserving iPhone date/Unified Add fixes | `PASS`, merged, exact-main CI/deploy PASS |
| #206 | Reconciled this master ledger from current GitHub evidence and removed stale default physical-only blockers | `PASS`, merged, exact-main CI/deploy PASS |
| #207 | Added whole-source reachable-control accessibility inventory | `PASS`, merged, exact-main CI/deploy PASS |
| #208 | Reconciled accessibility evidence/current queue in the master ledger | `PASS`, merged, exact-main CI/deploy PASS |
| #209 | Added isolated searchable long-financial-list selector primitive | `PASS`, merged, exact-main CI/deploy PASS |
| #210 | Added count-driven `CategorySelect`; migrated PlannedPayment, category budgets and category correction long lists | `PASS`, merged, exact-main CI/deploy PASS |
| #211 | Migrated Activity Category filter to adaptive search while retaining short native filters and `All categories` | `PASS`, merged, exact-main CI/deploy PASS |
| #212 | Migrated TransactionModal Bill/main/split categories while preserving native short Income, stable IDs and financial semantics | `PASS`, merged; branch 97/97 files + 644/644 tests; exact-main run #910/deploy PASS |
| #213 | Reconciled selector-programme evidence and promoted responsive revalidation | `PASS`, evidence-only, merged |
| #214 | Revalidated historical responsive family and repaired Audit Trail long-identifier containment | `PASS`, merged; exact-main run #914/deploy PASS |
| #215 | Tightened Income copy density and replaced raw `YYYY-MM` with readable en-GB month labels | `PASS`, merged; branch run #917 PASS; exact-main run #918/deploy PASS |

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
| UK-local date/month handling | `PASS` | date/month tests |

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

Destructive confirmation, edit/category/date, adaptive category filtering and linked-evidence regression coverage pass.

### GA-ACC-001 / GLOBAL-IDENTITY-001 — Account identity and lifecycle
**Status:** `PASS`

Stable account IDs are authoritative. Same-name accounts remain distinct; archive/reconcile/delete/ownership tests pass.

### GA-INC-001 — Income financial/category semantics
**Status:** `PASS` for finance semantics and current copy repair

Current source requires a valid income category and stable account identity. The canonical seven-option Income category picker remains native under the adaptive selector contract. PR #215 removed redundant Income helper copy, shortened summary qualifiers and formats visible months as readable en-GB month/year labels without changing financial semantics or Phone geometry.

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

PR #203 removed the global native-select bridge, coarse-pointer hit-test suppression and competing picker architecture. Current component source contains **22 native `<select>` render points**; short choices retain browser/OS activation. Explicit rich/searchable selectors are mounted only where the field contract requires them.

### GA-SELECT-002 — Long financial-list pattern classification
**Status:** `PASS` for current source/automated contract

PRs #209–#212 implement the approved classification:
- `MVSearchableSelect` is the isolated long-list primitive.
- `CategorySelect` uses an explicit threshold: fewer than 12 eligible categories stays native; 12+ uses one searchable selector.
- Canonical catalogue: **37 expense categories** and **7 income categories**.
- Long category tasks now use the adaptive pattern in PlannedPayment, CategoryBudgets, CategoryCorrection, Activity, and TransactionModal Bill/main/split category fields.
- Short fixed-choice selectors stay native; canonical Income remains native.
- Exact category IDs, caller-owned eligibility rules, historical edit preservation and submit validation remain authoritative.
- No global interception/native-custom competition was reintroduced.

Final evidence: PR #212 branch gate passed **97/97 test files and 644/644 tests**; exact-main run #910 and Pages deployment passed for `7e7b5315c28740d917c7b95e6b154c6025d68b9d`. No physical-device claim is made.

### GA-DATE-001 — Date/month controls and current working month
**Status:** `PASS` for current source/automated contract

Dynamic/local month handling and UK date tests pass. PR #205 preserves required iPhone date containment.

### GA-HTML-001 — HTML shell accessibility / public asset paths
**Status:** `PASS`

PR #205 restored browser/user zoom and corrected required public CSS asset paths. Exact-main CI/deploy passed.

### GA-A11Y-001 — Whole-app reachable-control accessibility inventory
**Status:** `PASS` for current source/automated inventory

PR #207 adds a TypeScript-AST inventory across production TSX. It finds no definite unnamed native controls/links/interactive-role widgets and no non-interactive element definitely placed in forward tab order. Later runtime-only accessibility defects may still be discovered.

### GA-DESKTOP-001 — Desktop layout baseline
**Status:** `PARTIAL PASS`

Existing desktop source/CSS regression tests pass. Discovery-inclusive reconciliation of remaining screens/content/visual contracts is pending.

### GA-PHONE-001 — Phone responsive baseline
**Status:** `PARTIAL PASS`

Current historical responsive family is source/automated PASS after PR #214. Remaining work is discovery-inclusive final Phone reconciliation and any still-open content/density findings.

### GA-MODE-001 — PC/Phone mode switching
**Status:** `PARTIAL PASS`

Mode architecture and targeted tests exist. Current-source regression reconciliation for stale overlays/layout state across repeated switching remains.

### GA-REPO-001 — Repository / PR / delivery hygiene
**Status:** `PASS` at this baseline

PR #34 is closed/superseded. PRs #203–#215 are merged; current delivery chain has exact-main CI/deployment evidence. GitHub remains authoritative after the next change.

---

## 4. Current content / responsive defect families

### PHONE-DENSITY-001 — Phone summary density/readability
**Status:** `PARTIAL PASS / OPEN`

Historical sequence: #200 ineffective cascade repair; #201 made density effective but Income three-column geometry was unreadable; #202 changed Income to two columns with Outstanding below while Savings retained 2×2. PR #215 repaired confirmed Income copy density while preserving the approved two-column Phone geometry. Broader discovery-inclusive Phone density review remains open; do not restore superseded geometry without new evidence.

### GLOBAL-COPY-001 — Content/copy density
**Status:** `PARTIAL PASS / OPEN` — LOW

PR #215 repaired the confirmed Income helper/qualifier prose and raw `YYYY-MM` user-facing schedule/empty-state copy. Broader current-source copy review across remaining screens remains open; no financial-calculation failure is implied.

### GLOBAL-RESPONSIVE-001 — Historical responsive defect family
**Status:** `PASS` for current source/automated evidence

PR #214 revalidated the historical family. Split Categories and Savings Goal actions are contained by local `.mv-hscroll`; Prepare Next Month is viewport-bounded with one vertical scroll owner; shared modal containment remains covered; Audit Trail long actor/entity/action/summary content received explicit `min-w-0`/wrap/break containment while raw JSON remains locally horizontal-scrollable. Exact-main run #914 and Pages deployment passed. No physical-device claim is made.

---

## 5. Historical physical evidence policy

Historical physical evidence is retained only for what it directly observed at that time. Automated/source/CI/deployment evidence must never be called physical evidence.

Under Master Autonomous Engineering Authority v2:
- missing physical evidence does not block ordinary engineering, merge or deployment;
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
| #185–#199 | month/accessibility/navigation/payment/settings repairs — merged; current tests authoritative |
| #200 | Phone density first attempt — `SUPERSEDED` |
| #201 | density cascade repair — `SUPERSEDED` for Income three-column geometry |
| #202 | readable Phone summary geometry — layout `PASS`; broader copy/density remains open |
| #203 | native-first selector architecture — `PASS` |
| #204 | exhaustive modal inventory gate — `PASS` |
| #205 | browser zoom/public asset paths — `PASS` |
| #206 | master evidence reconciliation — `PASS` |
| #207 | whole-source reachable-control inventory — `PASS` |
| #208 | evidence reconciliation after accessibility gate — `PASS` |
| #209 | searchable long-list primitive — `PASS` |
| #210 | adaptive category selector + contained consumers — `PASS` |
| #211 | Activity adaptive category filter — `PASS` |
| #212 | TransactionModal adaptive categories; GA-SELECT-002 completion gate — `PASS` |
| #213 | selector-programme ledger reconciliation — `PASS` |
| #214 | responsive revalidation + Audit Trail containment — `PASS` |
| #215 | Income copy density/readable month labels — `PASS` |

Git history remains the detailed implementation chronology; this ledger stores current consequence.

---

## 7. Current unresolved queue — risk ordered

This ordering must be rechecked whenever `main` changes.

| Priority | Item | Status | Current reason |
|---:|---|---|---|
| 1 | GA-TP-002 per-bill Undo Funding attribution | `BLOCKED` | No safe explicit bill-level funding attribution exists; guessing would risk financial corruption. Continue independent work. |
| 2 | GA-MODE-001 current mode-switch regression reconciliation | `PARTIAL PASS` | Needs current-source/test reconciliation; physical evidence not default. |
| 3 | PHONE-DENSITY-001 / GLOBAL-COPY-001 broader discovery-inclusive review | `PARTIAL PASS / OPEN` | Confirmed Income copy defects repaired in #215; remaining screens still need concise-copy/density reconciliation. |
| 4 | GA-DESKTOP-001 / GA-PHONE-001 discovery-inclusive final source audit | `PARTIAL PASS` | Remaining screens/content/visual contracts must be reconciled after higher-priority items. |

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
