# MV global selector inventory

Baseline repaired from `main` at `a87bb385843d53b9543ab72ece9314a7c22e3333`.

## Ordinary native selectors

The current component source contains 28 ordinary native `<select>` render points. These controls keep their browser/OS activation, focus, option and form semantics. They are **not** globally intercepted or mirrored into a second custom popup.

| Component / screen | Current selector | Metadata / eligibility source |
| --- | --- | --- |
| AccountsView / Add Account | Owner, Type native selects | Disabled placeholders; Joint + active member owner options |
| AccountsView / Edit Account | Owner, Type native selects | Historical removed owner retained; legacy Joint type conditionally retained |
| TransactionList / Activity | Date, payer, classification, category native selects | Exact current filter values |
| IncomeView | Received by, Account, Category, Receiving account native selects | Household people, account identity, category eligibility |
| CategorySettings | Category Group, new Group Scope native selects | Group scope/write-boundary constraints |
| CategoryBudgets | Category native select | Bill-category eligibility |
| CategoryCorrection | Operation, From category, To category, budget conflict policy native selects | Scope/system/archive/merge constraints |
| MembersView | Member role native select | Owner-only edit; Editor/View Only values |
| PlannedPaymentModal | Category native select | Bill-category eligibility |
| SavingsView | Source account, Savings destination native selects | Existing source/destination eligibility |
| MarkPaymentPaidModal | Paid from native select | Active account options |
| AuditLogView | Audit type native select | Fixed audit entity filter values |
| TransactionModal | Bill category, transaction category, split category native selects | Bill/transaction/split category eligibility and historical preservation |

### Native-first contract

Native selects are the default when native behaviour is sufficient. This follows the MV rule to use the simplest semantic native control that satisfies the task and prevents a native picker and custom picker competing for one field.

Do not disable native select pointer hit-testing. Do not install a document-level geometry/touch interceptor. Do not mount a global bridge that turns every native select into a portalled custom listbox.

Short fixed-choice selectors should remain native unless a specific interaction requirement justifies a different pattern.

## Direct rich selectors

Two current selector families use `MVSelect` directly because their presentation needs richer information than a plain short-choice native control:

| Component / screen | Current selector | Required rich information |
| --- | --- | --- |
| UnifiedAddUi / Add Entry account fields | Explicit MVSelect | Stable account identity + balance |
| ExecuteTransferModal / funding source | Explicit MVSelect | Stable account identity, balance, disabled state + visible disabled reason |

These direct controls own exactly one popup/listbox. They do not sit on top of a second native `<select>` for the same field.

### Direct MVSelect empty-state contract

A direct `MVSelect` must never open an unexplained empty bordered popover when its legal option array is empty. A clean MV household can legitimately start with `accounts: []`. In that state the closed field remains readable, exposes its unavailable state, replaces its normal placeholder with an explicit empty message, removes popup affordances, and does not open a listbox. Unified Add uses `No accounts available`; other direct selectors use the shared `No options available` fallback unless they supply a more specific message.

A non-empty option set whose items are all disabled is different: the listbox remains available so the user can inspect the options and their disabled reasons. If a direct selector is already open and its dynamic option array becomes empty, it closes predictably rather than collapsing into an empty sliver.

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

The approved MV product decision requires genuinely long financial lists to use a one-tap searchable list/sheet where search materially improves the task. Current direct `MVSelect` remains select-only and the ordinary native category/account selectors have not all been classified by list size/task complexity yet. That is a separate follow-on workstream; it must not be implemented by reintroducing global native-select interception.

Physical Safari evidence is not a default completion requirement under the current Master Autonomous Engineering Authority. If explicitly requested, physical verification remains a separate evidence tier and must not be inferred from DOM tests.
