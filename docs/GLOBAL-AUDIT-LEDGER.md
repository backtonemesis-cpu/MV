# MV Household Finance / Penny — Global Audit Ledger

> **Role:** repository-resident master defect/evidence register for the discovery-inclusive global audit and repair programme.
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
| Current `main` | `b7dad748fd3d40d7dd45778057f5f7547167fbfc` |
| Current main commit | `Close Transfer Plan attribution backup integrity gap (#247)` |
| Exact-main workflow | Run #990 / `34715897898` |
| Test/build/privacy/local-only | `PASS` |
| Main automated suite | 123 test files / 727 tests PASS in exact-main #990 |
| Production build/static verification | `PASS` in exact-main #990 |
| GitHub Pages deploy | `PASS` in exact-main #990 |
| Production persistence | browser-local `mv_local_state_v2` |
| Cloud financial backend | not active |
| Physical verification | not requested for this final gate; not claimed |

**Freshness rule:** this baseline becomes historical immediately when `main` advances. Re-read GitHub after every merge.

### Current delivery chain — material work since the previous global baseline

| PR | Result | Current disposition |
|---:|---|---|
| #203–#222 | Selector, accessibility, responsive, month-display and evidence-reconciliation programme | `PASS`, merged/deployed |
| #223 | Accounts Phone target reinforcement | `PASS`, merged/deployed |
| #224 | Dashboard secondary Phone target reinforcement | `PASS`, merged/deployed |
| #225 | Activity Phone target reinforcement | `PASS`, merged/deployed |
| #226 | Savings goal Phone target reinforcement | `PASS`, merged/deployed |
| #227 | Transfer Plan bottom bill-selection target repair | `PASS`, merged/deployed |
| #228 | Reconciled prior global audit evidence | `PASS`, evidence-only, merged/deployed |
| #229 | Added repository-authoritative Transfer Plan bill-funding attribution design | `PASS`, design checkpoint, merged/deployed |
| #230 | Added pure immutable funding-attribution types/builder/validator | `PASS`, merged/deployed |
| #231 | Added additive V2 funding-record persistence compatibility | `PASS`, merged/deployed |
| #232 | Normalized/validated funding records at the V2 schema boundary | `PASS`, merged/deployed |
| #233 | Added atomic attributed funding writer | `PASS`, merged/deployed dormant before activation |
| #234 | Early live-routing attempt stopped because old batch undo could orphan attribution | `SUPERSEDED / CLOSED`, not merged/deployed |
| #235 | Added pure active-funding/reversal derivation | `PASS`, merged/deployed |
| #236 | Added append-only attributed bill/batch reversal mutations | `PASS`, merged/deployed |
| #237 | Added safe active attributed/legacy compatibility resolution; fixed reversal-as-legacy classification defect | `PASS`, merged/deployed |
| #238 | Unified attributed append-only card undo with exact legacy batch undo | `PASS`, merged/deployed |
| #239 | Routed card Undo Funding through unified compatibility layer | `PASS`, merged/deployed |
| #240 | Separated active funding display from immutable undo identity in the view model | `PASS`, merged/deployed |
| #241 | Separated Undo Funding displayed amount from stale-confirmation fingerprint | `PASS`, merged/deployed |
| #242 | Derived active attributed card funding from exact transaction links | `PASS`, merged/deployed |
| #243 | Activated atomic attributed Record Funding with public-API end-to-end proof | `PASS`, merged/deployed |
| #244 | Exposed exact per-bill Undo Funding adapter and acceptance coverage | `PASS`, merged/deployed |
| #245 | Added exact per-bill Undo Funding confirmation modal | `PASS`, merged/deployed |
| #246 | Exposed exact per-bill Undo Funding in Transfer Plan | `PASS`, merged/deployed |
| #247 | Added funding-record ↔ original/reversal transaction cross-link validation and backup/restore closure | `PASS`; branch #989, exact-main #990 and Pages PASS |

### Target-size evidence nuance

`globalDesignSystem.css` establishes `--mv-ds-click-target: 2.75rem` (44px). Compact visible controls may remain smaller where their effective hit area is expanded to the shared 44px floor. Target-size conclusions therefore concern the effective interactive target, not visible box dimensions alone.

---

## 2. Financial invariant matrix

| Invariant | Status | Current evidence |
|---|---|---|
| Authoritative money uses integer pence | `PASS` | finance/storage suite |
| Internal transfer != income | `PASS` | finance classification + #247 closure audit |
| Internal transfer != spending | `PASS` | finance classification + #247 closure audit |
| Savings transfer remains internal | `PASS` | savings/transfer tests |
| Refund != ordinary income | `PASS` | refund classification tests |
| Credit-card repayment does not double-count spending | `PASS` | repayment safety tests |
| Planned bill != actual payment | `PASS` | planned-payment/payment linkage tests |
| Transfer Plan funding != payment | `PASS` | funding/payment lifecycle + per-bill undo tests |
| Paid requires linked payment evidence where applicable | `PASS` | payment workflow/safety tests |
| Undo Funding reverses exact supported funding evidence | `PASS` | legacy card/batch + attributed card/batch + exact per-bill undo tests |
| Per-bill Undo Funding uses explicit attribution only | `PASS` | #229–#247; legacy/no-attribution path refuses bill undo |
| Multi-source per-bill reversal returns exact pence to exact source IDs | `PASS` | `transferPlanBillFundingApi.test.ts` / reversal-store tests |
| Partial bill undo followed by batch undo reverses only active remainder | `PASS` | `transferPlanFundingReversalStore.test.ts` |
| Funding undo leaves payment evidence/status independent | `PASS` | paid-bill and lifecycle tests |
| Undo Payment reverses exact linked payment evidence | `PASS` | payment undo tests |
| Source/destination balances reconcile | `PASS` | transfer/cross-view/per-bill reconciliation tests |
| Same-name accounts remain distinct | `PASS` | stable-ID + identity-label tests |
| £0 balance is valid | `PASS` | account/funding coverage |
| PlannedPayment ↔ Transaction reciprocal linkage | `PASS` | storage/finance tests |
| PlannedIncome linkage | `PASS` | storage/finance tests |
| Funding records persist without historical inference | `PASS` | V2 normalization/persistence tests |
| Funding record ↔ original/reversal transaction linkage | `PASS` | #247 schema-boundary cross-link validation |
| Backup/restore preserves attributed funding evidence | `PASS` | #247 valid backup/restore closure audit |
| Corrupt attributed backup fails closed | `PASS` | #247 corruption test |
| UK-local date/month handling | `PASS` | date/month tests |

No current automated/source evidence establishes a known balance-reconciliation or monetary-corruption failure on current `main`.

---

## 3. Current material defect/evidence register

### GA-ARCH-001 — Local-only architecture and persistence
**Status:** `PASS`

Static React/Vite GitHub Pages application with browser-local `mv_local_state_v2`. CI guards against committed household data and retired backend configuration.

### GA-DASH-001 — Dashboard financial truth
**Status:** `PASS` for current source/automated contract

Shared finance/reconciliation tests pass. Readable month display and Phone target repairs remain covered.

### GA-ACT-001 — Activity integrity / editing / destructive actions
**Status:** `PASS` for current source/automated contract

Destructive confirmation, edit/category/date, adaptive category filtering and linked-evidence regression coverage pass. Funding and funding-reversal transactions remain visible internal-transfer Activity evidence without becoming income/spending.

### GA-ACC-001 / GLOBAL-IDENTITY-001 — Account identity and lifecycle
**Status:** `PASS`

Stable account IDs remain authoritative; same-name accounts remain distinct. Archive/reconcile/delete/ownership tests pass.

### GA-INC-001 — Income financial/category semantics
**Status:** `PASS`

Valid income category and stable account identity remain required. Current-source target review found no additional Income repair justified.

### GA-SAV-001 — Savings truth and classification
**Status:** `PASS`

Savings calculations/internal-transfer classification tests pass.

### GA-TP-001 / PHONE-TP-001 — Transfer Plan supported lifecycle
**Status:** `PASS`

Funding and payment remain separate. Record Funding, card/batch undo, per-bill undo, bulk payment, paid-only negative-balance correction, funded-selection locking, Phone target geometry and exact confirmation behaviour are covered by current tests.

### GA-TP-002 — Per-bill Undo Funding attribution
**Status:** `PASS` for current source/automated contract

The former blocker is resolved by the repository-authoritative design and implementation chain #229–#247:

- every new funding batch atomically records an immutable `TransferPlanFundingRecord` with exact stable bill IDs, original source transaction IDs, exact integer-pence source shares and destination/month identity;
- positive pre-existing destination balance is not fabricated as transfer funding;
- negative destination balance recovery is tracked separately as account-level funding;
- bill attribution is never reconstructed for legacy transaction-only funding;
- active attribution is derived as immutable original attribution minus exact linked reversal transactions;
- per-bill undo reverses the most recent active attributed batch for that bill only and returns exact pence to exact original source account IDs;
- paid-bill funding can be undone without altering payment status or linked Activity expense evidence;
- partial bill undo followed by card/batch undo reverses only the remaining active shares, including deficit recovery, with exact source/destination balance reconciliation;
- original funding evidence is retained; new attributed undo uses append-only internal-transfer reversals;
- fully reversed attributed originals cannot fall through into legacy funding discovery;
- duplicate/missing/mismatched/over-reversed evidence fails closed;
- Transfer Plan shows `Transfer-funded £X.XX` and exposes `Undo funding £X.XX` only where exact active attribution exists;
- backup/restore preserves the immutable funding record plus original/reversal transaction linkage exactly; mismatched backup evidence is rejected at the V2 schema boundary;
- original funding and reversal transactions remain internal transfers and contribute zero to income/spending.

No physical-device claim is made for this item.

### GA-SET-001 / PHONE-SET-001 — Settings controls and Phone tab strip
**Status:** `PASS`

Settings tab-strip, semantics and contrast tests pass; the Phone tab strip and shared modal actions retain the required effective targets.

### GA-CAT-001 — Category System v2
**Status:** `PASS`

Schema, eligibility, management, reclassification, budgets and backup coverage pass. PR #128 remains superseded; #129 is authoritative.

### GA-BUD-001 — Budget/category budget truth
**Status:** `PASS`

Category-v2 budget and dynamic-month tests pass; budgets remain non-transaction metadata.

### GA-MONTH-001 — Prepare Next Month identity/idempotency
**Status:** `PASS`

Shared rollover identity/lineage tests pass; `copiedFromId` remains the strongest identity evidence.

### GA-BACKUP-001 — Whole-state backup/restore
**Status:** `PASS`

Local-store/category backup/restore validation, referential integrity and rollback tests pass. #247 additionally proves exact attributed funding record/original/reversal preservation and rejects mismatched immutable funding linkage before restore.

### GA-ADD-001 — Unified Add launcher
**Status:** `PASS`

One six-choice launcher remains; `bill` stays outside `TransactionType` and persists as PlannedPayment only.

### GA-MODAL-001 / GA-FOCUS-001 — Modal/focus architecture
**Status:** `PASS` for current rendered source/automated contract

The exhaustive modal inventory and shared modal accessibility/containment stack pass. The new per-bill funding confirmation uses the shared modal contract. Physical-device behaviour remains a separate evidence tier.

### GA-SELECT-001 — Native/custom selector competition
**Status:** `PASS`

Short choices retain browser/OS activation; explicit rich/searchable selectors are mounted only where required.

### GA-SELECT-002 — Long financial-list pattern classification
**Status:** `PASS`

`MVSearchableSelect` remains the isolated long-list primitive; `CategorySelect` uses the approved adaptive threshold. Exact IDs and caller-owned eligibility remain authoritative.

### GA-DATE-001 — Date/month controls and current working month
**Status:** `PASS`

Dynamic/local month handling and UK date tests pass. Canonical internal `YYYY-MM` keys remain unchanged.

### GA-HTML-001 — HTML shell accessibility / public asset paths
**Status:** `PASS`

Browser zoom remains enabled and required public CSS asset paths are correct under passing CI/deploy evidence.

### GA-A11Y-001 — Whole-app reachable-control accessibility inventory
**Status:** `PASS` for current source/automated inventory

The TypeScript-AST inventory finds no definite unnamed native controls/links/interactive-role widgets and no non-interactive element definitely placed in forward tab order. Later runtime-only issues can still be discovered and must be treated separately.

### GA-DESKTOP-001 — Desktop layout baseline
**Status:** `PASS` for current source/automated contract

Current desktop contract tests enforce the 1440px maximum workspace, 64px app bar, routine desktop control geometry and prohibition on CSS `zoom`. Desktop-specific responsive/readability tests and the full repository suite pass on exact current main. No physical-device claim is made.

### GA-PHONE-001 — Phone responsive baseline
**Status:** `PASS` for current source/automated contract

Discovery-inclusive primary-screen source reconciliation covers Dashboard, Activity, Accounts, Income, Savings, Transfer Plan and Settings. Existing iPhone/mobile containment, modal, navigation, density, safe-area and effective-target audits pass on exact current main. No physical-device claim is made.

### GA-MODE-001 — PC/Phone mode switching
**Status:** `PASS`

Selected mode persists in `mv-layout-mode-v1`, mirrors to root `data-layout-mode`, and applies through exclusive mode classes. Phone-only transient More-menu state resets on mode changes; dedicated regression coverage passes.

### GA-REPO-001 — Repository / PR / delivery hygiene
**Status:** `PASS` at this baseline

Known superseded branches/PRs are explicitly classified. The GA-TP-002 chain was staged through design, dormant pure/persistence layers, reversal safety, compatibility, activation, UI exposure and backup closure rather than merged as one unreviewable mutation. Exact-main #990 and Pages are green on `b7dad748…`.

---

## 4. Current content / responsive defect families

### PHONE-DENSITY-001 — Phone summary density/readability
**Status:** `PASS` for current source/automated screen review

Historical #200–#202 density work is superseded/reconciled by later screen-specific fixes. Current primary Phone screens use the shared effective 44px target system, approved summary geometry, wrapped Activity rows, scrollable Settings tabs, viewport-bounded menus, safe-area modal actions and dedicated iPhone containment tests. No physical-device claim is made.

### GLOBAL-COPY-001 — Content/copy density
**Status:** `PASS` for current confirmed findings

Income and Dashboard month/copy repairs remain covered. Reviewed Accounts, Activity, Savings and Settings surfaces produced no confirmed additional copy defect in the completed audit scope.

### GLOBAL-RESPONSIVE-001 — Historical responsive defect family
**Status:** `PASS` for current source/automated evidence

Historical responsive findings remain covered by screen-specific regression tests: local horizontal containment where deliberate, viewport-bounded menus/sheets, shared modal containment, Audit Trail long-content containment, Phone navigation/safe areas, transaction/date containment and Transfer Plan card density.

---

## 5. Physical evidence policy

Historical physical evidence is retained only for what it directly observed at that time. Automated/source/CI/deployment evidence must never be called physical evidence.

Under Master Autonomous Engineering Authority v2:
- missing physical evidence does not block ordinary engineering, merge or deployment;
- a physical PASS claim requires actual physical evidence;
- physical evidence becomes mandatory only when Marius explicitly requests it for the relevant issue/final verification.

No new physical-device verification was requested or claimed in the final GA-TP-002 closure.

---

## 6. Material PR chronology / disposition

| PR / range | Current disposition |
|---|---|
| #24–#28 | local-only/static architecture — `PASS` |
| #34 | old visual branch — `SUPERSEDED / CLOSED` |
| #48–#51 | Activity/Accounts/Savings/Income truth repairs — `PASS` |
| #53–#72 | original Transfer Plan lifecycle repair chain — `PASS`; later GA-TP-002 work supersedes old attribution limitation |
| #73–#90 | mode/global audit stages — implemented; later targeted repairs supersede stale wording |
| #100–#127 | money, entry, Activity/account lifecycle, Transfer Plan, modal/date repairs — `PASS` under current tests |
| #128 | old category approach — `SUPERSEDED` |
| #129 | Category System v2 — `PASS` |
| #130–#199 | destructive confirmation, containment, Unified Add, control/date/select, month/navigation/payment/settings repairs — implemented; later targeted regressions authoritative |
| #200 | Phone density first attempt — `SUPERSEDED` |
| #201 | density cascade repair — `SUPERSEDED` for Income geometry |
| #202 | readable Phone summary geometry — `PASS` under current review |
| #203–#228 | selector/accessibility/responsive/month/Phone-target programme and evidence reconciliation — `PASS` |
| #229–#233 | GA-TP-002 design, attribution model, persistence and atomic writer foundations — `PASS` |
| #234 | unsafe early activation attempt caught before merge — `SUPERSEDED / CLOSED` |
| #235–#242 | active reversal, compatibility, card undo and view-model safety chain — `PASS` |
| #243 | live attributed Record Funding activation — `PASS` |
| #244–#246 | exact per-bill undo adapter, confirmation and Transfer Plan UI exposure — `PASS` |
| #247 | backup/cross-link/classification closure — `PASS` |

Git history remains the detailed implementation chronology; this ledger stores current consequence.

---

## 7. Current unresolved queue — risk ordered

**No confirmed material source/automated defect remains open from the discovery-inclusive global audit queue at this baseline.**

Items discovered after this baseline must be added here and handled under the same evidence discipline. A future explicitly requested physical-device sweep is a separate evidence task, not an unresolved software defect by default.

---

## 8. Continuation and completion protocol

1. Verify current GitHub truth and compare it with this file whenever work resumes.
2. For any newly discovered R2–R4 issue: current source → root cause → concise Impact Analysis → smallest durable repair → targeted tests → broader regression → diff review → PR → exact-head CI → merge → exact-main CI/deploy → evidence reconciliation.
3. Classify test failures before changing expectations. Never weaken a valid test merely to get green.
4. Reconcile this same ledger after later material changes; do not create competing master registers.
5. Do not require routine physical verification unless explicitly requested.

### Final completion gate

For the baseline recorded here:
- discovery-inclusive material scope is accounted for;
- no known material source/automated defect is falsely closed or left unresolved;
- static/type/build/regression/financial/persistence/accessibility/responsive gates pass;
- intended repairs through #247 are merged and deployed;
- exact-main #990 and GitHub Pages pass;
- GA-TP-002 now satisfies its repository design acceptance criteria;
- no physical-device verification was requested for this final gate and none is claimed.

**Current programme status: COMPLETE for the current source/automated audit scope at exact main `b7dad748fd3d40d7dd45778057f5f7547167fbfc`.**
