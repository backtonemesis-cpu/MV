# MV Household Finance / Penny — Global Audit Ledger

> **Role:** repository-resident master defect/evidence register for the discovery-inclusive global audit and repair programme.
>
> **Authority:** current GitHub source, current PR/branch state, CI, deployment evidence and available runtime evidence establish implementation state. Master Autonomous Engineering Authority v2 governs execution and completion. Permanent MV standards govern approved behaviour. Historical chats/handover notes are not current truth unless reverified.

## 0. Maintenance rules

1. Verify current `main`, open PRs, relevant branches, CI and deployment before relying on this file.
2. Do not mark an item PASS because code merely exists; use evidence appropriate to the claim.
3. Physical-device evidence is a separate tier and is required only when Marius explicitly requests it for the relevant issue/final gate.
4. Preserve financial truth: integer pence, exact stable account IDs, no transfer-as-income/spend, no duplicate spend/income, funding != payment, exact linked undo, £0 valid, UK-local dates.
5. Later material work touching a passed area requires proportionate regression review.
6. Do not silently drop material issues. Historical superseded items may be condensed once disposition is explicit and Git history preserves implementation detail.
7. `BLOCKED` means a genuine unresolved dependency/semantic ambiguity, not ordinary engineering difficulty.
8. Do not declare the global programme COMPLETE while a known material unresolved defect remains.

Allowed statuses: `PASS`, `PARTIAL PASS`, `FAIL`, `OPEN`, `BLOCKED`, `TBC`, `SUPERSEDED`, `DEFERRED`, `N/A`.

---

## 1. Verified implementation baseline — 2026-09-12

This section records the exact **product implementation** SHA whose source, tests and Pages deployment establish the completion evidence below. A later evidence-only ledger commit may advance repository `main` without changing this implementation baseline.

| Item | Verified evidence |
|---|---|
| Repository | `backtonemesis-cpu/MV` |
| Verified implementation SHA | `b7dad748fd3d40d7dd45778057f5f7547167fbfc` |
| Implementation commit | `Close Transfer Plan attribution backup integrity gap (#247)` |
| Exact-main implementation workflow | Run #990 / `34715897898` |
| Test/build/privacy/local-only | `PASS` |
| Main automated suite | 123 test files / 727 tests PASS in #990 |
| Production build/static verification | `PASS` in #990 |
| GitHub Pages deploy | `PASS` in #990 |
| Production persistence | browser-local `mv_local_state_v2` |
| Cloud financial backend | not active |
| Physical verification | not requested for this final gate; not claimed |

**Freshness rule:** re-read GitHub whenever material implementation work resumes. Evidence-only documentation commits do not invalidate this product baseline unless they also change application/test/build behaviour.

### Material delivery chain since the prior global baseline

| PR | Result | Disposition |
|---:|---|---|
| #203–#222 | Selector, accessibility, responsive, month-display and evidence-reconciliation programme | `PASS`, merged/deployed |
| #223–#227 | Phone target refinements for Accounts, Dashboard, Activity, Savings and Transfer Plan | `PASS`, merged/deployed |
| #228 | Prior global evidence reconciliation | `PASS`, evidence-only, merged/deployed |
| #229 | Repository-authoritative Transfer Plan bill-funding attribution design | `PASS`, merged/deployed |
| #230 | Pure immutable funding-attribution types/builder/validator | `PASS`, merged/deployed |
| #231–#232 | Additive V2 funding-record persistence and schema-boundary normalization | `PASS`, merged/deployed |
| #233 | Atomic attributed funding writer | `PASS`, merged/deployed dormant before activation |
| #234 | Unsafe early activation attempt caught before merge | `SUPERSEDED / CLOSED`, not deployed |
| #235–#236 | Pure active/reversal derivation and append-only attributed reversal mutations | `PASS`, merged/deployed |
| #237 | Safe active attributed/legacy resolution; reversal-as-legacy defect repaired before merge | `PASS`, merged/deployed |
| #238–#239 | Unified attributed/legacy card undo and API routing | `PASS`, merged/deployed |
| #240–#242 | Active funding display, immutable undo identity and exact transaction-linked fallback | `PASS`, merged/deployed |
| #243 | Live atomic attributed Record Funding activation with public-API workflow proof | `PASS`, merged/deployed |
| #244 | Exact per-bill Undo Funding adapter and storage acceptance tests | `PASS`, merged/deployed |
| #245 | Exact per-bill Undo Funding confirmation modal | `PASS`, merged/deployed |
| #246 | Exact per-bill Undo Funding exposed in Transfer Plan | `PASS`, merged/deployed |
| #247 | Funding-record ↔ original/reversal cross-link validation and backup/classification closure | `PASS`; branch #989, exact-main #990 and Pages PASS |

### Target-size evidence nuance

`globalDesignSystem.css` establishes the shared 44px effective target floor. Compact visible controls may remain smaller where the effective hit area is expanded to that floor. Target-size conclusions concern the effective interactive target, not visible box dimensions alone.

---

## 2. Financial invariant matrix

| Invariant | Status | Current evidence |
|---|---|---|
| Authoritative money uses integer pence | `PASS` | finance/storage suite |
| Internal transfer != income/spending | `PASS` | finance classification + #247 closure audit |
| Savings transfer remains internal | `PASS` | savings/transfer tests |
| Refund != ordinary income | `PASS` | refund classification tests |
| Credit-card repayment does not double-count spending | `PASS` | repayment safety tests |
| Planned bill != actual payment | `PASS` | planned-payment/payment linkage tests |
| Transfer Plan funding != payment | `PASS` | lifecycle + per-bill undo tests |
| Paid requires linked payment evidence where applicable | `PASS` | payment workflow/safety tests |
| Legacy card/batch Undo Funding reverses exact supported evidence | `PASS` | compatibility/legacy undo tests |
| New attributed card/batch Undo Funding is append-only and exact | `PASS` | reversal/compatibility tests |
| Per-bill Undo Funding uses explicit attribution only | `PASS` | #229–#247; legacy path refuses bill undo |
| Multi-source bill undo returns exact pence to exact source IDs | `PASS` | bill-undo adapter/reversal tests |
| Latest active bill attribution reverses first | `PASS` | bill-undo acceptance tests |
| Partial bill undo then batch undo reverses only remaining shares | `PASS` | reversal-store tests |
| Funding undo leaves payment evidence/status independent | `PASS` | paid-bill/lifecycle tests |
| Undo Payment reverses exact linked payment evidence | `PASS` | payment undo tests |
| Source/destination balances reconcile | `PASS` | transfer/cross-view/per-bill tests |
| Same-name accounts remain distinct | `PASS` | stable-ID + identity-label tests |
| £0 balance is valid | `PASS` | account/funding coverage |
| PlannedPayment / PlannedIncome linkage | `PASS` | storage/finance tests |
| Funding records persist without historical inference | `PASS` | V2 persistence tests |
| Funding record ↔ original/reversal transaction linkage | `PASS` | #247 cross-link validation |
| Backup/restore preserves attributed evidence | `PASS` | #247 closure audit |
| Corrupt attributed backup fails closed | `PASS` | #247 corruption test |
| UK-local date/month handling | `PASS` | date/month tests |

No known balance-reconciliation or monetary-corruption failure remains in the verified implementation baseline.

---

## 3. Current material defect/evidence register

### GA-ARCH-001 — Local-only architecture and persistence
**Status:** `PASS`

Static React/Vite GitHub Pages application with browser-local `mv_local_state_v2`. CI guards against committed household data and retired backend configuration.

### GA-DASH-001 — Dashboard financial truth
**Status:** `PASS` for current source/automated contract

Shared finance/reconciliation tests pass; readable month display and Phone target repairs remain covered.

### GA-ACT-001 — Activity integrity / editing / destructive actions
**Status:** `PASS` for current source/automated contract

Destructive confirmation, edit/category/date, adaptive category filtering and linked-evidence coverage pass. Funding and funding-reversal entries remain traceable internal transfers without becoming income/spending.

### GA-ACC-001 / GLOBAL-IDENTITY-001 — Account identity and lifecycle
**Status:** `PASS`

Stable account IDs remain authoritative; same-name accounts remain distinct. Archive/reconcile/delete/ownership tests pass.

### GA-INC-001 — Income financial/category semantics
**Status:** `PASS`

Valid income category and stable account identity remain required. Final current-source review found no additional Income repair justified.

### GA-SAV-001 — Savings truth and classification
**Status:** `PASS`

Savings calculations/internal-transfer classification tests pass.

### GA-TP-001 / PHONE-TP-001 — Transfer Plan lifecycle
**Status:** `PASS`

Funding and payment remain separate. Record Funding, card/batch undo, per-bill undo, bulk payment, funded-selection locking, paid-only negative-balance handling, Phone target geometry and confirmation behaviour are covered by passing tests.

### GA-TP-002 — Per-bill Undo Funding attribution
**Status:** `PASS` for current source/automated contract

The former blocker is resolved by #229–#247:

- every new funding batch atomically records an immutable `TransferPlanFundingRecord` with stable bill IDs, original source transaction IDs, destination/month identity and exact integer-pence source shares;
- positive existing destination balance is not fabricated as transfer funding;
- negative destination balance recovery is stored separately as account-level funding;
- legacy transaction-only funding is never backfilled or guessed into bill attribution;
- active attribution is immutable original attribution minus exact linked reversal transactions;
- per-bill undo reverses only the most recent active attributed batch for that bill and returns exact pence to exact original source account IDs;
- paid-bill funding can be undone without altering Paid status or linked Activity payment evidence;
- partial bill undo followed by card/batch undo reverses only remaining bill/deficit shares with exact balance reconciliation;
- original attributed transfers/records remain preserved; reversal is append-only internal-transfer evidence;
- fully reversed attributed originals cannot fall through into legacy discovery;
- duplicate, missing, mismatched and over-reversed evidence fails closed;
- Transfer Plan shows exact transfer-funded amounts and exposes `Undo funding £X.XX` only for exact active attribution;
- backup/restore preserves immutable funding records plus original/reversal linkage; mismatched backup evidence is rejected at the V2 schema boundary;
- original funding and reversal transactions contribute zero to income/spending.

No physical-device claim is made for GA-TP-002.

### GA-SET-001 / PHONE-SET-001 — Settings controls and Phone tab strip
**Status:** `PASS`

Settings tab semantics/contrast and Phone target contracts pass.

### GA-CAT-001 — Category System v2
**Status:** `PASS`

Schema, eligibility, management, reclassification, budgets and backup coverage pass. #128 remains superseded; #129 is authoritative.

### GA-BUD-001 — Budget/category budget truth
**Status:** `PASS`

Category-v2 budget and dynamic-month tests pass; budgets remain non-transaction metadata.

### GA-MONTH-001 — Prepare Next Month identity/idempotency
**Status:** `PASS`

Shared rollover identity/lineage tests pass; `copiedFromId` remains the strongest identity evidence.

### GA-BACKUP-001 — Whole-state backup/restore
**Status:** `PASS`

Local-store/category backup validation, referential integrity and rollback tests pass. #247 additionally proves exact attributed record/original/reversal preservation and rejects mismatched immutable funding linkage before restore.

### GA-ADD-001 — Unified Add launcher
**Status:** `PASS`

One six-choice launcher remains; `bill` stays outside `TransactionType` and persists as PlannedPayment only.

### GA-MODAL-001 / GA-FOCUS-001 — Modal/focus architecture
**Status:** `PASS` for current source/automated contract

The modal inventory and shared accessibility/containment stack pass; per-bill funding confirmation uses the same contract. Physical behaviour is a separate tier.

### GA-SELECT-001 / GA-SELECT-002 — Selector architecture
**Status:** `PASS`

Short choices retain browser/OS activation. `MVSearchableSelect` remains the isolated long-list primitive and `CategorySelect` uses the approved adaptive threshold. Exact IDs and caller-owned eligibility remain authoritative.

### GA-DATE-001 — Date/month controls
**Status:** `PASS`

Dynamic/local month handling and UK date tests pass; canonical internal `YYYY-MM` keys remain unchanged.

### GA-HTML-001 — HTML shell accessibility / asset paths
**Status:** `PASS`

Browser zoom remains enabled and required public CSS assets pass CI/deploy checks.

### GA-A11Y-001 — Reachable-control accessibility inventory
**Status:** `PASS` for current source/automated inventory

The source inventory finds no definite unnamed native controls/links/interactive-role widgets or definitely invalid forward-tab elements. Later runtime-only findings remain separately discoverable.

### GA-DESKTOP-001 — Desktop layout baseline
**Status:** `PASS` for current source/automated contract

Desktop contract/readability/responsive tests and the full suite pass. No physical-device claim is made.

### GA-PHONE-001 — Phone responsive baseline
**Status:** `PASS` for current source/automated contract

Dashboard, Activity, Accounts, Income, Savings, Transfer Plan and Settings are covered by current Phone/iPhone source audits, containment, navigation, density, safe-area and effective-target tests. No physical-device claim is made.

### GA-MODE-001 — PC/Phone mode switching
**Status:** `PASS`

Mode persistence/root mirroring and Phone transient-state reset remain covered.

### GA-REPO-001 — Repository / PR / delivery hygiene
**Status:** `PASS` at this implementation baseline

Superseded work is explicitly classified. GA-TP-002 was staged through design, pure model, persistence, reversal safety, compatibility, activation, UI exposure and backup closure. Exact-main #990 and Pages are green on `b7dad748…`.

---

## 4. Current content / responsive defect families

### PHONE-DENSITY-001 — Phone summary density/readability
**Status:** `PASS` for current source/automated screen review

Historical #200–#202 density work is superseded/reconciled by later screen-specific fixes. Current primary Phone screens use the shared effective 44px target system, approved summary geometry, viewport-bounded controls, safe-area modal actions and dedicated containment tests. No physical-device claim is made.

### GLOBAL-COPY-001 — Content/copy density
**Status:** `PASS` for current confirmed findings

Income and Dashboard month/copy repairs remain covered. Reviewed Accounts, Activity, Savings and Settings surfaces produced no confirmed additional defect in the completed audit scope.

### GLOBAL-RESPONSIVE-001 — Historical responsive family
**Status:** `PASS` for current source/automated evidence

Historical findings remain covered by screen-specific regression tests for horizontal containment, menus/sheets, shared modals, Audit Trail long content, Phone navigation/safe areas, transaction/date containment and Transfer Plan density.

---

## 5. Physical evidence policy

Automated/source/CI/deployment evidence must never be called physical evidence.

Under Master Autonomous Engineering Authority v2:
- missing physical evidence does not block ordinary engineering, merge or deployment;
- a physical PASS claim requires actual physical evidence;
- physical evidence becomes mandatory only when Marius explicitly requests it for the relevant issue/final verification.

No new physical-device verification was requested or claimed for the final GA-TP-002 closure.

---

## 6. Material chronology / disposition

| PR / range | Current disposition |
|---|---|
| #24–#28 | local-only/static architecture — `PASS` |
| #34 | old visual branch — `SUPERSEDED / CLOSED` |
| #48–#51 | Activity/Accounts/Savings/Income truth repairs — `PASS` |
| #53–#72 | original Transfer Plan lifecycle chain — `PASS`; later GA-TP-002 work supersedes the old attribution limitation |
| #73–#90 | mode/global audit stages — implemented; later targeted repairs supersede stale wording |
| #100–#127 | money, entry, Activity/account lifecycle, Transfer Plan, modal/date repairs — `PASS` |
| #128 | old category approach — `SUPERSEDED` |
| #129 | Category System v2 — `PASS` |
| #130–#199 | confirmation, containment, Unified Add, control/date/select, month/navigation/payment/settings work — implemented; later tests authoritative |
| #200 | Phone density first attempt — `SUPERSEDED` |
| #201 | density cascade attempt — `SUPERSEDED` for Income geometry |
| #202 | readable Phone summary geometry — `PASS` |
| #203–#228 | selector/accessibility/responsive/month/Phone-target programme and reconciliation — `PASS` |
| #229–#233 | GA-TP-002 design/model/persistence/atomic-writer foundations — `PASS` |
| #234 | unsafe early activation attempt caught before merge — `SUPERSEDED / CLOSED` |
| #235–#242 | reversal/compatibility/card-undo/view-model safety chain — `PASS` |
| #243 | live attributed Record Funding — `PASS` |
| #244–#246 | exact per-bill undo adapter, modal and Transfer Plan UI — `PASS` |
| #247 | backup/cross-link/classification closure — `PASS` |

Git history remains the detailed implementation chronology; this ledger stores current consequence.

---

## 7. Current unresolved queue

**No confirmed material source/automated defect remains open from the discovery-inclusive global audit queue at the verified implementation baseline.**

New findings after this baseline must be added here and handled under the same evidence discipline. A future explicitly requested physical-device sweep is a separate evidence task, not an unresolved software defect by default.

---

## 8. Continuation and completion protocol

1. Verify current GitHub truth whenever work resumes.
2. For a newly discovered R2–R4 issue: source → root cause → Impact Analysis → smallest durable repair → targeted tests → full regression → diff review → PR → branch CI → merge → exact-main CI/Pages → ledger reconciliation.
3. Classify test failures before changing expectations; never weaken a valid test merely to get green.
4. Reconcile this same ledger after later material changes; do not create competing master registers.
5. Do not require routine physical verification unless explicitly requested.

### Final completion gate

At verified implementation SHA `b7dad748fd3d40d7dd45778057f5f7547167fbfc`:
- discovery-inclusive material scope is accounted for;
- no known material source/automated defect is falsely closed or left unresolved;
- static/type/build/regression/financial/persistence/accessibility/responsive gates pass;
- intended product repairs through #247 are merged and deployed;
- exact-main #990 and GitHub Pages pass;
- GA-TP-002 satisfies its repository design acceptance criteria;
- no physical-device verification was requested for this final gate and none is claimed.

**Programme status: COMPLETE for the current source/automated audit scope at the verified implementation baseline above.**
