# MV global selector inventory

Current selector architecture is reconciled against deployed `main` at `85ddc9dea64631456d31c174783a5f8bb13ee54b` plus the active TransactionModal adaptive-category migration branch.

## Ordinary native selectors

The current component source on this branch contains **22 native `<select>` render points**. This is a source inventory, not a claim that every adaptive category field renders native at runtime: `CategorySelect` owns one native fallback render point and switches to the searchable long-list primitive only when the eligible category set reaches the explicit long-list threshold.

Native controls keep browser/OS activation, focus, option and form semantics. They are **not** globally intercepted or mirrored into a second custom popup.

| Component / screen | Current selector | Metadata / eligibility source |
| --- | --- | --- |
| AccountsView / Add Account | Owner, Type native selects | Disabled placeholders; Joint + active member owner options |
| AccountsView / Edit Account | Owner, Type native selects | Historical removed owner retained; legacy Joint type conditionally retained |
| TransactionList / Activity | Date, payer, classification native selects | Exact current filter values; Category is adaptive/searchable when long |
| IncomeView | Received by, Account, Category, Receiving account native selects | Household people, account identity, category eligibility |
| CategorySettings | Category Group, new Group Scope native selects | Group scope/write-boundary constraints |
| CategoryCorrection | Operation and budget conflict policy native selects | Two/short fixed-choice workflow decisions |
| MembersView | Member role native select | Owner-only edit; Editor/View Only values |
| SavingsView | Source account, Savings destination native selects | Existing source/destination eligibility |
| MarkPaymentPaidModal | Paid from native select | Active account options |
| AuditLogView | Audit type native select | Fixed audit entity filter values |
| CategorySelect | Native fallback for category sets below the long-list threshold | Exact category IDs supplied by the authoritative eligibility caller |

### Native-first contract

Native selects are the default when native behaviour is sufficient. This follows the MV rule to use the simplest semantic native control that satisfies the task and prevents a native picker and custom picker competing for one field.

Do not disable native select pointer hit-testing. Do not install a document-level geometry/touch interceptor. Do not mount a global bridge that turns every native select into a portalled custom listbox.

Short fixed-choice selectors remain native unless a specific interaction requirement justifies a different pattern.

## Direct rich selectors

Two current selector families continue to use the select-only `MVSelect` directly because their presentation needs richer information than a plain short-choice native control:

| Component / screen | Current selector | Required rich information |
| --- | --- | --- |
| UnifiedAddUi / Add Entry account fields | Explicit MVSelect | Stable account identity + balance |
| ExecuteTransferModal / funding source | Explicit MVSelect | Stable account identity, balance, disabled state + visible disabled reason |

These direct controls own exactly one popup/listbox. They do not sit on top of a second native `<select>` for the same field.

### Direct MVSelect empty-state contract

A direct `MVSelect` must never open an unexplained empty bordered popover when its legal option array is empty. A clean MV household can legitimately start with `accounts: []`. In that state the closed field remains readable, exposes its unavailable state, replaces its normal placeholder with an explicit empty message, removes popup affordances, and does not open a listbox. Unified Add uses `No accounts available`; other direct selectors use the shared `No options available` fallback unless they supply a more specific message.

A non-empty option set whose items are all disabled is different: the listbox remains available so the user can inspect options and disabled reasons. If a direct selector is already open and its dynamic option array becomes empty, it closes predictably rather than collapsing into an empty sliver.

## Adaptive searchable financial lists

`MVSearchableSelect` is a separate long-list primitive. It is not a replacement for ordinary native selects or the select-only account `MVSelect`.

`CategorySelect` is the category-specific adaptive adapter:

- fewer than 12 eligible categories → native `<select>`;
- 12 or more eligible categories → one searchable `MVSearchableSelect`;
- exact category IDs remain the stored values in both branches;
- search text may include category/group display metadata but never substitutes display text for IDs;
- caller-supplied eligibility arrays remain authoritative;
- there is never a native and custom picker mounted for the same field at the same time.

The canonical catalogue currently provides **37 expense categories** and **7 income categories**. Therefore ordinary Income category selection stays native, while bill/expense category tasks qualify as long-list tasks.

Current adaptive consumers:

| Component / screen | Adaptive field | Preserved semantics |
| --- | --- | --- |
| PlannedPaymentModal | Bill category | Existing bill-category eligibility and validation |
| CategoryBudgets | Budget category | Bill-category eligibility; explicit category-required validation before budget write |
| CategoryCorrection | From / To category | Scope/system/archive rules; archived source label retained; Operation/policy selectors remain native |
| TransactionList / Activity | Category filter | `All categories` sentinel and exact category IDs retained; Date/Payer/Classification remain native |
| TransactionModal | Bill category | Existing bill eligibility and submit validation retained |
| TransactionModal | Main transaction category | Type-scoped eligibility and historical-category preservation retained; seven-option Income remains native |
| TransactionModal | Split category | Type-scoped eligibility and original split-category preservation retained; exact split category IDs retained |

## Deliberately native/system controls

- `MonthPicker` (`input[type="month"]`): semantic browser month picker; preserve UK-local month behaviour.
- All `input[type="date"]`: native date picker and existing Safari containment remain authoritative.
- Backup file input: browser/OS file picker.
- Colour input, checkboxes, radios and range sliders: native/system interaction retained.

## Not ordinary value selectors

- CommandPalette: command launcher/search dialog, not a single-value select.
- Navigation mobile More panel: navigation menu, not stored-value selection.
- Header PC/Phone switcher: two-button mode switch, not a dropdown.
- Conflict/Undo/Acceptance modals: action dialogs, no value dropdown.

## Remaining selector work

The current source classification and migration for GA-SELECT-002 is complete on this branch: long category tasks use the searchable pattern and short fixed-choice tasks remain native. GA-SELECT-002 must not be marked fully closed in the master audit ledger until this branch passes the full repository gate, merges, and exact-main CI plus Pages deployment are confirmed.

The work must not reintroduce global native-select interception or convert short fixed-choice controls merely for visual consistency.

Physical Safari evidence is not a default completion requirement under the current Master Autonomous Engineering Authority. If explicitly requested, physical verification remains a separate evidence tier and must not be inferred from DOM/tests.
