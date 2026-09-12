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
| Current `main` | `237dd6519bccdfe2368e5322b14c535f9352f41d` |
| Current main commit | `Raise Transfer Plan Phone selection target to 44px (#227)` |
| Exact-main workflow | Run #946 / `34692561471` |
| Test/build/privacy/local-only | `PASS` |
| Main automated suite | full repository suite PASS in run #946 |
| GitHub Pages deploy | `PASS` in run #946 for exact current main |
| Production persistence | browser-local `mv_local_state_v2` |
| Cloud financial backend | not active |
| Physical evidence requirement | only when explicitly requested |

**Freshness rule:** this baseline becomes historical immediately when `main` advances. Re-read GitHub after every merge.

### Current delivery chain added 2026-09-12

| PR | Result | Current disposition |
|---:|---|---|
| #203 | Restored native browser contract for ordinary selectors | `PASS`, merged/deployed |
| #204 | Added exhaustive rendered-modal inventory gate | `PASS`, merged/deployed |
| #205 | Restored browser zoom and corrected required public CSS asset paths | `PASS`, merged/deployed |
| #206 | Reconciled the master ledger and removed stale physical-only blockers | `PASS`, evidence-only, merged/deployed |
| #207 | Added whole-source reachable-control accessibility inventory | `PASS`, merged/deployed |
| #208 | Reconciled accessibility evidence/current queue | `PASS`, evidence-only, merged/deployed |
| #209 | Added isolated searchable long-financial-list selector primitive | `PASS`, merged/deployed |
| #210 | Added adaptive `CategorySelect` and first consumers | `PASS`, merged/deployed |
| #211 | Migrated Activity Category filter to adaptive search | `PASS`, merged/deployed |
| #212 | Migrated TransactionModal category fields while preserving short native choices | `PASS`, merged/deployed |
| #213 | Reconciled selector-programme evidence | `PASS`, evidence-only, merged/deployed |
| #214 | Revalidated historical responsive family and repaired Audit Trail containment | `PASS`, merged/deployed |
| #215 | Tightened Income copy density and readable month labels | `PASS`, merged/deployed |
| #216 | Reconciled responsive/Income evidence | `PASS`, evidence-only, merged/deployed |
| #217 | Reset Phone More-menu transient state on layout-mode changes | `PASS`, merged/deployed |
| #218 | Reconciled mode-switch evidence | `PASS`, evidence-only, merged/deployed |
| #219 | Added shared UK month display formatter | `PASS`, merged/deployed |
| #220 | Reconciled shared-month formatter evidence | `PASS`, evidence-only; exact-main run #930/deploy PASS |
| #221 | Replaced all six visible Dashboard raw month keys with readable labels | `PASS`; branch #932, exact-main #933/deploy PASS |
| #222 | Reconciled audit evidence after Dashboard month repair | `PASS`, evidence-only; exact-main #935/deploy PASS |
| #223 | Raised Accounts Phone action/control targets to the shared 44px floor | `PASS`; branch #937, exact-main #938/deploy PASS |
| #224 | Raised Dashboard secondary Phone actions to the shared 44px floor | `PASS`; branch #939, exact-main #940/deploy PASS |
| #225 | Reinforced Activity Phone action targets, including row action geometry | `PASS`; branch #941, exact-main #942/deploy PASS |
| #226 | Raised Savings goal-card Phone actions to the shared 44px floor | `PASS`; branch #943, exact-main #944/deploy PASS |
| #227 | Expanded Transfer Plan bottom bill-selection checkbox label to a 44×44 Phone hit area | `PASS`; branch #945, exact-main #946/deploy PASS |

### Target-size evidence nuance

Current `globalDesignSystem.css` already establishes a shared `--mv-ds-click-target: 2.75rem` (44px) and applies a 44px minimum to generic buttons/menu items. Compact icon controls such as `.finance-action-button` may retain a 32px visible box while a pseudo-element expands the effective hit area to the shared 44px target. Therefore target-size conclusions are based on the **effective interactive hit area**, not visible box dimensions alone. PRs #223–#227 are Phone-scoped presentation/accessibility reinforcements and do not alter financial semantics.

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
| Same-name accounts remain distinct | `PASS` | stable-ID + identity-label tests |
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

Static React/Vite GitHub Pages application with browser-local `mv_local_state_v2`. CI guards against committed household data and retired backend configuration.

### GA-DASH-001 — Dashboard financial truth
**Status:** `PASS` for current source/automated contract

Shared finance/reconciliation tests pass. Dashboard readable month display is repaired by #221. Current Phone target review is reconciled by #224.

### GA-ACT-001 — Activity integrity / editing / destructive actions
**Status:** `PASS` for current source/automated contract

Destructive confirmation, edit/category/date, adaptive category filtering and linked-evidence regression coverage pass. Current Phone action-target review is reconciled by #225.

### GA-ACC-001 / GLOBAL-IDENTITY-001 — Account identity and lifecycle
**Status:** `PASS`

Stable account IDs remain authoritative; same-name accounts remain distinct. Archive/reconcile/delete/ownership tests pass. Current Phone target review is reconciled by #223.

### GA-INC-001 — Income financial/category semantics
**Status:** `PASS`

Valid income category and stable account identity remain required. Canonical seven-option Income category choice remains native. Current-source final target review found no additional Income repair justified: generic actions inherit the shared 44px target and compact icon controls retain a 44px effective hit area.

### GA-SAV-001 — Savings truth and classification
**Status:** `PASS`

Savings calculations/internal-transfer classification tests pass. Current Phone goal-action target review is reconciled by #226.

### GA-TP-001 / PHONE-TP-001 — Transfer Plan supported lifecycle
**Status:** `PASS`

Funding and payment remain separate; reciprocal payment evidence, bulk payment, funded-selection locking, batch undo and paid-only negative-balance correction are covered by passing tests. Current Phone bill-selection hit-area review is reconciled by #227.

### GA-TP-002 — Per-bill Undo Funding attribution
**Status:** `BLOCKED`

Current funding evidence is destination-account/batch based and does not contain safe explicit bill-to-funding attribution. A per-bill undo cannot be implemented by proportional, positional or amount inference without risking incorrect balance reversal. Keep blocked until a safe data-model/linkage and backward-compatibility design is established from approved requirements/evidence.

### GA-SET-001 / PHONE-SET-001 — Settings controls and Phone tab strip
**Status:** `PASS`

Settings tab-strip, semantics and contrast tests pass. Final source review confirms the Phone tab strip has an explicit 44px target contract and shared modal actions use the 44px control contract.

### GA-CAT-001 — Category System v2
**Status:** `PASS`

Schema, eligibility, management, reclassification, budgets and backup coverage pass. PR #128 is superseded; #129 is authoritative.

### GA-BUD-001 — Budget/category budget truth
**Status:** `PASS`

Category-v2 budget and dynamic-month tests pass; budgets remain non-transaction metadata.

### GA-MONTH-001 — Prepare Next Month identity/idempotency
**Status:** `PASS`

PR #193 merged the shared rollover identity/lineage repair. `monthRolloverIdentityAudit.test.ts` passes. `copiedFromId` lineage remains the strongest identity evidence.

### GA-BACKUP-001 — Whole-state backup/restore
**Status:** `PASS`

Local-store/category backup/restore validation, referential integrity and rollback tests pass.

### GA-ADD-001 — Unified Add launcher
**Status:** `PASS`

One six-choice launcher remains; `bill` stays outside `TransactionType` and persists as PlannedPayment only.

### GA-MODAL-001 / GA-FOCUS-001 — Modal/focus architecture
**Status:** `PASS` for current rendered source/automated contract

The exhaustive modal inventory and shared modal accessibility/containment stack pass. Physical-device behaviour remains a separate evidence tier.

### GA-SELECT-001 — Native/custom selector competition
**Status:** `PASS`

PR #203 removed the global native-select bridge and coarse-pointer interception. Short choices retain browser/OS activation; explicit rich/searchable selectors are mounted only where required.

### GA-SELECT-002 — Long financial-list pattern classification
**Status:** `PASS`

`MVSearchableSelect` remains the isolated long-list primitive; `CategorySelect` uses the approved adaptive threshold. Long category tasks use adaptive search while short fixed-choice selectors stay native. Exact IDs and caller-owned eligibility remain authoritative.

### GA-DATE-001 — Date/month controls and current working month
**Status:** `PASS`

Dynamic/local month handling and UK date tests pass. Shared `formatMonthKeyUk` formats user-facing month/year labels while canonical internal `YYYY-MM` keys remain unchanged.

### GA-HTML-001 — HTML shell accessibility / public asset paths
**Status:** `PASS`

Browser zoom remains enabled and required public CSS asset paths are correct under passing CI/deploy evidence.

### GA-A11Y-001 — Whole-app reachable-control accessibility inventory
**Status:** `PASS` for current source/automated inventory

The TypeScript-AST inventory finds no definite unnamed native controls/links/interactive-role widgets and no non-interactive element definitely placed in forward tab order. Later runtime-only issues can still be discovered and must be treated separately.

### GA-DESKTOP-001 — Desktop layout baseline
**Status:** `PASS` for current source/automated contract

Current desktop contract tests enforce the 1440px maximum workspace, 64px app bar, routine 40px desktop form controls and prohibition on CSS `zoom`. Desktop-specific responsive/readability tests and the full repository suite pass on exact current main. Recent #223–#227 changes are Phone-scoped. No physical-device claim is made.

### GA-PHONE-001 — Phone responsive baseline
**Status:** `PASS` for current source/automated contract

Discovery-inclusive primary-screen source reconciliation has now covered Dashboard, Activity, Accounts, Income, Savings, Transfer Plan and Settings. Existing iPhone/mobile containment, modal, navigation, density and safe-area audits plus the new #223–#227 target regressions pass in exact-main #946. No physical-device claim is made.

### GA-MODE-001 — PC/Phone mode switching
**Status:** `PASS`

The selected mode remains persisted in `mv-layout-mode-v1`, mirrored to root `data-layout-mode`, and applied through exclusive mode classes. #217 clears Phone-only More-menu transient state on mode changes; dedicated regression coverage passes.

### GA-REPO-001 — Repository / PR / delivery hygiene
**Status:** `PASS` at this baseline

PR #34 is closed/superseded. PRs #203–#227 are merged. Exact-main CI and Pages deployment are green through #946. GitHub remains authoritative after the next change.

---

## 4. Current content / responsive defect families

### PHONE-DENSITY-001 — Phone summary density/readability
**Status:** `PASS` for current source/automated screen review

Historical sequence: #200 ineffective first attempt; #201 made density effective but produced unreadable Income three-column geometry; #202 established readable Income two-column geometry with Outstanding below while Savings retained 2×2; #215 repaired confirmed Income copy density. Final current-source reconciliation then reviewed the primary Phone screens and delivered narrow target refinements in #223–#227 for Accounts, Dashboard, Activity, Savings and Transfer Plan. Income and Settings required no additional product patch after effective-cascade review.

The current global Phone system uses 16px working gutters, shared 44px effective targets, two-column Dashboard actions/metrics, approved Income/Savings summary geometry, wrapped Activity rows, scrollable Settings tabs, viewport-bounded menus, safe-area modal actions and dedicated iPhone containment tests. Compact icon controls may remain visually 32px where a pseudo-element supplies the 44px effective hit area. No physical-device claim is made.

### GLOBAL-COPY-001 — Content/copy density
**Status:** `PASS` for current confirmed findings

#215 repaired confirmed Income copy density and raw month display; #219 added shared month formatting support; #221 replaced all six then-confirmed Dashboard raw month labels. Reviewed Accounts, Activity, Savings and Settings copy surfaces produced no confirmed additional copy defect in this pass. No physical-device claim is made.

### GLOBAL-RESPONSIVE-001 — Historical responsive defect family
**Status:** `PASS` for current source/automated evidence

Historical responsive findings remain covered by #214 and later screen-specific tests: local horizontal containment where deliberate, viewport-bounded Prepare Next Month and menus, shared modal containment, Audit Trail long-content containment, Phone navigation/safe areas, transaction/date containment and Transfer Plan card density. Exact current full suite remains green.

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
| #202 | readable Phone summary geometry — `PASS` under current source/automated review |
| #203–#221 | selector/accessibility/responsive/month programme — `PASS` |
| #222 | evidence-only reconciliation after Dashboard month repair — `PASS` |
| #223 | Accounts Phone target reinforcement — `PASS` |
| #224 | Dashboard secondary Phone target reinforcement — `PASS` |
| #225 | Activity Phone target reinforcement — `PASS` |
| #226 | Savings goal Phone target reinforcement — `PASS` |
| #227 | Transfer Plan bottom selection target repair — `PASS` |

Git history remains the detailed implementation chronology; this ledger stores current consequence.

---

## 7. Current unresolved queue — risk ordered

This ordering must be rechecked whenever `main` changes.

| Priority | Item | Status | Current reason |
|---:|---|---|---|
| 1 | GA-TP-002 per-bill Undo Funding attribution | `BLOCKED` | No safe explicit bill-level funding attribution exists; guessing would risk financial corruption. Continue independent work if another item exists. |

No other confirmed current source/automated defect remains open from the reconciled global Desktop/Phone audit queue. No physical-only sweep is a default blocker.

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

**Current programme status: WORKING / NOT COMPLETE — GA-TP-002 remains BLOCKED by missing safe bill-level funding attribution.**
