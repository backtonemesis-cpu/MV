# MV Household Finance / Penny — Global Audit Ledger

> **Role:** repository-resident Master Defect/Evidence Register for the discovery-inclusive Penny audit, repair and acceptance programme.
>
> **Execution authority:** **TITAN V3 / Master Autonomous Engineering Authority V3.0** is the sole active master autonomous engineering authority. Historical V2 authorities, old handovers and candidate V3 files are evidence only and do not authorise execution.
>
> **Implementation truth:** current GitHub source/ref, current PR/branch state, CI, deployment evidence and applicable runtime/physical evidence establish current implementation state. Permanent MV standards govern approved product behaviour.

## 0. Maintenance rules

1. Verify current `main`, open PRs, relevant branches, CI and deployment before relying on this file.
2. Do not mark an item PASS because code merely exists; use evidence appropriate to the claim.
3. Keep lifecycle status, acceptance status and final disposition distinct.
4. Physical-device evidence is a separate evidence tier. A physical PASS requires actual physical evidence; automated/source/CI/deployment evidence cannot substitute for it.
5. Preserve financial truth: integer pence, exact stable account IDs, no transfer-as-income/spend, no duplicate spend/income, funding != payment, exact linked undo, £0 valid, UK-local dates.
6. Later material work touching a passed area requires proportionate regression review.
7. Do not silently drop material issues. Historical superseded items may be condensed once disposition is explicit and Git history preserves implementation detail.
8. `BLOCKED` means a genuine unresolved dependency/semantic ambiguity, not ordinary engineering difficulty.
9. Do not create a competing Master Register. Reconcile this same ledger.
10. Only TITAN V3 owns global Penny autonomous-programme `COMPLETE`.

Allowed acceptance/status vocabulary includes: `PASS`, `PARTIAL PASS`, `FAIL`, `OPEN`, `PENDING`, `BLOCKED`, `TBC`, `SUPERSEDED`, `DEFERRED`, `N/A`.

---

## 1. Current verified repository baseline — 2026-09-13 cutover recovery

| Item | Current verified evidence |
|---|---|
| Repository | `backtonemesis-cpu/MV` |
| Current `main` before this evidence-only reconciliation PR | `599c5584ed47d964a77e7ac5248e3fed7442e5fe` |
| Current product commit | `Repair PC Dashboard physical acceptance findings (#249)` |
| PR #249 | merged; merge SHA `599c5584ed47d964a77e7ac5248e3fed7442e5fe` |
| Exact-main workflow | Run #996 / `34717954652` |
| TypeScript | `PASS` |
| Main automated suite | 124 test files / 732 tests `PASS` |
| Financial/storage/local-only guard | `PASS` |
| Production build/static verification | `PASS` |
| GitHub Pages deployment | `PASS` on exact SHA `599c5584ed47d964a77e7ac5248e3fed7442e5fe` |
| Open PRs at recovery start | none |
| Production persistence | browser-local `mv_local_state_v2` |
| Cloud financial backend | not active |
| Required outstanding acceptance | PR #249 post-deploy physical PC Dashboard verification |

The previous implementation baseline `b7dad748fd3d40d7dd45778057f5f7547167fbfc` / PR #247 remains valid historical evidence for the Transfer Plan attribution closure. PR #248 (`2d596e0eab2baa74fe878f6469a830a3367d087a`) was evidence-only. PR #249 then materially advanced the Dashboard implementation and therefore becomes the current product implementation baseline above.

### Latest material delivery chain

| PR / range | Result | Current disposition |
|---:|---|---|
| #203–#228 | selector/accessibility/responsive/month/Phone-target programme and reconciliation | `PASS`, merged/deployed |
| #229–#233 | Transfer Plan attribution design/model/persistence/atomic-writer foundations | `PASS`, merged/deployed |
| #234 | unsafe early attribution activation attempt | `SUPERSEDED / CLOSED`, never merged/deployed |
| #235–#242 | reversal/compatibility/card-undo/view-model safety chain | `PASS`, merged/deployed |
| #243 | live attributed Record Funding | `PASS`, merged/deployed |
| #244–#246 | exact per-bill Undo Funding adapter/modal/UI | `PASS`, merged/deployed |
| #247 | backup/cross-link/classification closure | `PASS`, merged/deployed |
| #248 | global audit ledger reconciliation | `PASS`, evidence-only |
| #249 | PC Dashboard physical-acceptance findings repair | source/automated/CI/deployment `PASS`; post-deploy physical acceptance `PENDING` |

---

## 2. TITAN V3 cutover / authority reconciliation

### GOV-V3-CUTOVER-001 — Authority cutover

**Lifecycle:** `RECONCILING`  
**Acceptance:** `PASS` for current active-authority/source-set postcondition  
**Programme consequence:** TITAN V3 is operationally active; V2 must not be restored absent contrary recovery evidence.

Current cutover evidence establishes:

- Marius explicitly authorised completion and activation of TITAN V3 on 2026-09-13.
- The active Penny Project Source set contains exactly the five permanent MV standards plus `TITAN-v3(2).md`.
- No V2/older Master Autonomous Engineering Authority remains in the active Project Source set.
- `TITAN-v3(2).md` identifies itself as `STATUS: AUTHORITATIVE`, `VERSION: 3.0`, superseding V2 and older master autonomous execution authorities.
- Active V3 SHA-256: `f9a426d2c79fd693fb87224b422119c4449ff0737671b63476692d6faf7d7020`.
- Final pre-release RC7 SHA-256: `32e7eb836279d1982733306ca08b711d950694b1ba09ebd7610ab444f4d13af3`.
- Full RC7→V3 diff was reviewed during cutover recovery. Differences were limited to authorised activation/header/version/supersession and candidate-to-active wording; no substantive financial invariant, safety gate, continuity rule, mutation guard or global-completion protection was found removed.
- Historical V2/V3 candidate files may remain in Library/history only as non-authoritative evidence. They do not compete with the active Project authority.
- Pre-cutover `CUTOVER_FREEZE` publication evidence was not recoverable in the current evidence channels. This historical evidence gap is recorded rather than invented. Because the exact post-cutover Project Source postcondition is now directly verified and contains one V3 authority with no competing V2 authority, recovery proceeds forward under V3 rather than restoring V2.

### Preserved still-material V2 content

Still-material V2 product/evidence content was reconciled instead of discarded:

- protected financial invariants and the load-bearing Transfer Plan contract are preserved in TITAN V3 §14 and the permanent product standards;
- GA-TP-002, formerly blocked under older handover state, is now `PASS` on exact attributed funding evidence under #229–#247;
- historical physical evidence remains historical evidence only and is not promoted into current physical PASS claims;
- the five V2 UX/product decisions preserved by TITAN V3 remain binding until superseded by a newer approved decision or incorporated into a permanent standard;
- stale V2 current-state SHAs, old open-PR references and old defect lists are `SUPERSEDED` by current direct GitHub/Register evidence.

---

## 3. Financial invariant matrix

| Invariant | Status | Current evidence |
|---|---|---|
| Authoritative money uses integer pence | `PASS` | finance/storage suite |
| Internal transfer != income/spending | `PASS` | finance classification + closure audit |
| Savings transfer remains internal | `PASS` | savings/transfer tests |
| Refund != ordinary income | `PASS` | refund classification tests |
| Credit-card repayment does not double-count spending | `PASS` | repayment safety tests |
| Planned bill != actual payment | `PASS` | planned-payment/payment linkage tests |
| Transfer Plan funding != payment | `PASS` | lifecycle + per-bill undo tests |
| Paid requires linked payment evidence where applicable | `PASS` | payment workflow/safety tests |
| Legacy card/batch Undo Funding reverses exact supported evidence | `PASS` | compatibility/legacy undo tests |
| New attributed funding/reversal is exact and append-only | `PASS` | attribution/reversal tests |
| Per-bill Undo Funding uses explicit attribution only | `PASS` | #229–#247; legacy bill undo fails closed |
| Multi-source bill undo returns exact pence to exact source IDs | `PASS` | bill-undo tests |
| Funding undo leaves payment evidence/status independent | `PASS` | paid-bill/lifecycle tests |
| Undo Payment reverses exact linked payment evidence | `PASS` | payment undo tests |
| Source/destination balances reconcile | `PASS` | transfer/cross-view/per-bill tests |
| Same-name accounts remain distinct by stable ID | `PASS` | identity tests |
| £0 balance is valid | `PASS` | account/funding coverage |
| PlannedPayment / PlannedIncome linkage | `PASS` | storage/finance tests |
| Funding record ↔ original/reversal transaction linkage | `PASS` | #247 cross-link validation |
| Backup/restore preserves attributed evidence | `PASS` | #247 closure audit |
| Corrupt attributed backup fails closed | `PASS` | #247 corruption test |
| UK-local date/month handling | `PASS` | date/month tests |

No known balance-reconciliation or monetary-corruption failure is open in the current verified source/automated evidence.

---

## 4. Current material defect/evidence register

| ID | Scope | Acceptance status | Current consequence |
|---|---|---|---|
| GA-ARCH-001 | Local-only architecture/persistence | `PASS` | `mv_local_state_v2`; retired backend not active |
| GA-DASH-001 | Dashboard financial truth | `PASS` source/automated | financial truth remains covered; PR #249 altered presentation only |
| GA-ACT-001 | Activity integrity/editing/destructive actions | `PASS` | no current material source/automated defect known |
| GA-ACC-001 / GLOBAL-IDENTITY-001 | Account identity/lifecycle | `PASS` | stable account IDs authoritative |
| GA-INC-001 | Income semantics | `PASS` | no current material source/automated defect known |
| GA-SAV-001 | Savings truth/classification | `PASS` | no current material source/automated defect known |
| GA-TP-001 / PHONE-TP-001 | Transfer Plan lifecycle | `PASS` | funding/payment separation and undo contracts covered |
| GA-TP-002 | Per-bill Undo Funding attribution | `PASS` | exact attribution/reversal/backup closure #229–#247 |
| GA-SET-001 / PHONE-SET-001 | Settings | `PASS` | source/automated contract |
| GA-CAT-001 | Category System v2 | `PASS` | #128 superseded; #129 authoritative implementation |
| GA-BUD-001 | Budgets/category budgets | `PASS` | budgets remain non-transaction metadata |
| GA-MONTH-001 | Prepare Next Month | `PASS` | identity/idempotency covered |
| GA-BACKUP-001 | Whole-state backup/restore | `PASS` | referential integrity + attribution preservation covered |
| GA-ADD-001 | Unified Add | `PASS` | six-choice launcher; bills persist as planned payments |
| GA-MODAL-001 / GA-FOCUS-001 | Modal/focus architecture | `PASS` source/automated | physical behaviour remains separate evidence tier |
| GA-SELECT-001 / GA-SELECT-002 | Selector architecture | `PASS` | exact IDs/caller eligibility authoritative |
| GA-DATE-001 | Date/month controls | `PASS` | dynamic/UK-local handling covered |
| GA-HTML-001 | HTML shell/assets/zoom | `PASS` | CI/deploy checks pass |
| GA-A11Y-001 | Reachable-control inventory | `PASS` source/automated | later runtime-only findings remain discoverable |
| GA-DESKTOP-001 | Desktop layout baseline | `PASS` source/automated | PR #249 physical follow-up tracked separately |
| GA-PHONE-001 | Phone responsive baseline | `PASS` source/automated | no physical PASS implied |
| GA-MODE-001 | PC/Phone mode switching | `PASS` | mode/reset contracts covered |
| GA-REPO-001 | Repository/PR/delivery hygiene | `PASS` at `599c558…` | run #996 and Pages green |
| PHONE-DENSITY-001 | Phone summary density | `PASS` source/automated | physical evidence remains separate |
| GLOBAL-COPY-001 | Content/copy density | `PASS` for current confirmed findings | PR #249 removed current Dashboard legacy copy findings |
| GLOBAL-RESPONSIVE-001 | Historical responsive family | `PASS` source/automated | covered by screen-specific regressions |
| PC-DASH-PHYS-001 | PR #249 post-deploy PC Dashboard acceptance | `PENDING` | requires current physical HP OmniBook/Chrome evidence; pre-fix screenshot does not prove post-fix PASS |

### GA-TP-002 preserved closure detail

The former per-bill funding blocker remains closed because new funding batches use immutable exact bill attribution, original transaction/source IDs and integer-pence shares; legacy funding is never guessed into attribution; reversals are append-only; paid state remains independent; partial/per-bill/batch undo reconciles exact remaining shares; malformed or mismatched evidence fails closed; and backup/restore preserves original/reversal linkage.

---

## 5. Physical evidence policy and current physical state

Automated/source/CI/deployment evidence must never be called physical evidence.

Under TITAN V3:

- missing physical evidence does not block unrelated safe engineering;
- a physical PASS claim requires actual current physical evidence;
- physical evidence is mandatory when an applicable acceptance criterion or explicit Marius requirement makes it mandatory;
- a screenshot establishes only the visible state actually shown, not unexercised dynamic behaviour or financial truth.

### Current required physical acceptance

PR #249 was created from physical HP OmniBook/Chrome PC-mode findings. Its PR acceptance statement explicitly left **post-deploy physical verification pending**. Therefore:

- source/automated/CI/deployment: `PASS`;
- post-deploy PC Dashboard physical acceptance: `PENDING`;
- pre-fix screenshot: valid defect evidence, not post-fix acceptance evidence;
- current programme may continue independent safe work, but `PC-DASH-PHYS-001` cannot be marked PASS without current physical evidence.

---

## 6. Material chronology / disposition

Git history remains the detailed implementation chronology. Current consequence is:

- #24–#28 local-only/static architecture — `PASS`;
- #34 old visual branch — `SUPERSEDED / CLOSED`;
- #48–#202 established financial, Transfer Plan, modal/date/select/navigation and readable Phone geometry foundations; later targeted work supersedes stale implementation detail;
- #203–#228 selector/accessibility/responsive/month/Phone-target programme — `PASS`;
- #229–#247 exact Transfer Plan attribution programme — `PASS`;
- #248 evidence-only global reconciliation — `PASS`;
- #249 PC Dashboard presentation repair — source/automated/CI/deployment `PASS`, physical post-deploy `PENDING`.

No historical branch or closed PR is evidence of an active mutating workstream by itself.

---

## 7. Current unresolved / pending queue

### Confirmed material source/automated defects

**None known at the recovered `599c558…` baseline.**

### Required pending acceptance/evidence

1. **PC-DASH-PHYS-001 — PR #249 post-deploy HP OmniBook / Chrome / PC-mode Dashboard verification.**

This is an evidence wait, not evidence that the source repair failed.

---

## 8. Continuation and programme status

### Current programme status

**ACTIVE under TITAN V3.**

Reason: the former source/automated global audit reached its completion gate, but newer PR #249 introduced an explicitly required post-deploy physical acceptance step and TITAN V3 cutover/state reconciliation is being finalised. Global `COMPLETE` must not be inferred from the older V2-era completion wording.

### Current execution routing after this reconciliation

- `programme_status`: `ACTIVE`
- `current_stage`: `WAITING_USER_EVIDENCE` for `PC-DASH-PHYS-001` once governance reconciliation is merged/deployed
- `Master Register`: this file, `docs/GLOBAL-AUDIT-LEDGER.md`
- `next_required_action`: obtain current post-deploy PC Dashboard physical evidence on the approved HP OmniBook/Chrome baseline, reconcile it here, then derive the next unfinished verified gate from current evidence

### Historical completion statement

The previous statement “COMPLETE for the current source/automated audit scope” remains historically valid for its then-verified scope/baseline. It is **not** the current TITAN V3 global programme status and does not override later material work or required physical acceptance.

---

## 9. Final evidence rule

A later execution must re-read current GitHub/PR/CI/deployment truth and the living `ai-context.md` before consequential work. If this ledger, `ai-context.md`, old handovers or memory conflict with newer direct evidence, reconcile the discrepancy; do not guess and do not revive V2 authority.
