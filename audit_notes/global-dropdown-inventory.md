# MV global dropdown inventory

Baseline: `main` at `88c304fcf82d53f203c30cc2b1343146c2c104ee`.

## Ordinary value selectors routed through the shared MVSelect system

| Component / screen | Current selector | Metadata / disabled semantics | Shared architecture |
| --- | --- | --- | --- |
| UnifiedAddUi / Add Entry account fields | Explicit MVSelect | Account identity + balance | Direct MVSelect; no mobile sheet architecture |
| ExecuteTransferModal / funding source | Explicit MVSelect | Account identity, safe-to-move balance, visible disabled reason, already-selected rule | Direct MVSelect; preserve eligibility and disabled reasons |
| AccountsView / Add Account | Owner, Type native selects | Disabled placeholders; Joint + active member owner options | Shared native-select bridge + coarse-pointer guard |
| AccountsView / Edit Account | Owner, Type native selects | Historical removed owner retained; legacy Joint type conditionally retained | Shared native-select bridge + coarse-pointer guard |
| TransactionList / Activity | Date, payer, classification, category native selects | Date filter can be disabled; exact current filter values | Shared native-select bridge + coarse-pointer guard |
| IncomeView | Received by, Account, Category, Receiving account native selects | Household people, account identity, category eligibility | Shared native-select bridge + coarse-pointer guard |
| CategorySettings | Category Group, new Group Scope native selects | Group scope/write-boundary constraints | Shared native-select bridge + coarse-pointer guard |
| CategoryBudgets | Category native select | Bill-category eligibility | Shared native-select bridge + coarse-pointer guard |
| CategoryCorrection | Operation, From category, To category, budget conflict policy native selects | Scope/system/archive/merge constraints | Shared native-select bridge + coarse-pointer guard |
| MembersView | Member role native select | Owner-only edit; Editor/View Only values | Shared native-select bridge + coarse-pointer guard |
| PlannedPaymentModal | Category native select | Bill-category eligibility | Shared native-select bridge + coarse-pointer guard; Payment Account uses UnifiedAddUi explicit MVSelect |
| SavingsView | Source account, Savings destination native selects | Existing source/destination eligibility | Shared native-select bridge + coarse-pointer guard |
| MarkPaymentPaidModal | Paid from native select | Active account options | Shared native-select bridge + coarse-pointer guard |
| AuditLogView | Audit type native select | Fixed audit entity filter values | Shared native-select bridge + coarse-pointer guard |
| TransactionModal | Bill category, transaction category, split category native selects | Bill/transaction/split category eligibility and historical preservation | Shared native-select bridge + coarse-pointer guard; account selectors use UnifiedAddUi explicit MVSelect |

There are 28 ordinary native `<select>` render points in the current source, plus the two direct rich-selector architectures above.

## Deliberately native/system controls

- `MonthPicker` (`input[type="month"]`): semantic browser month picker; preserve UK-local month behaviour.
- All `input[type="date"]`: native date picker and existing Safari containment remain authoritative.
- Backup file input: browser/OS file picker.
- Colour input, checkboxes, radios and range sliders: native/system interaction retained.

## Not ordinary value dropdowns

- CommandPalette: command launcher/search dialog, not a single-value select.
- Navigation mobile More panel: navigation menu, not stored-value selection.
- Header PC/Phone switcher: two-button mode switch, not a dropdown.
- Conflict/Undo/Acceptance modals: action dialogs, no value dropdown.

## Shared architecture decision

`MVSelect` is the authoritative select-only listbox/popover implementation. Rich selectors (Unified Add account and Transfer Plan funding source) use it directly. Existing ordinary native `<select>` elements retain their option-generation and form semantics as the source of truth, while `MVNativeSelectBridge` mediates their value/opening contract through the same MVSelect popover renderer. This preserves exact option sets and `onChange` contracts without duplicating business rules across dozens of forms.

### Direct MVSelect empty-state contract

A direct `MVSelect` must never open an unexplained empty bordered popover when its legal option array is empty. A clean MV household deliberately starts with `accounts: []`, so Unified Add can legitimately have no account options before the user creates or restores an account. In that state the closed field remains focusable and readable, exposes `aria-disabled="true"`, replaces its normal placeholder with an explicit empty message, removes popup affordances, and does not open a listbox. Unified Add uses the field-specific message `No accounts available`; other direct selectors use the shared `No options available` fallback unless they supply a more specific message.

A non-empty option set whose items are all disabled is different: the listbox remains available so the user can inspect the options and their disabled reasons. If a direct selector is already open and its dynamic option array becomes empty, it closes immediately rather than collapsing into an empty sliver.

### iPhone / coarse-pointer activation guard

Physical iPhone 13 Safari verification after PR #182 proved that cancelling `pointerdown`/`click` on a directly tapped native `<select>` was not sufficient: Safari could still present the native white picker while MV's custom popover was also visible.

The global repair therefore does not depend on Mobile Safari honouring cancellation of the native select's own activation. Under `@media (pointer: coarse)`, bridged native selects stay visible, focusable and authoritative for values/forms/accessibility, but are removed from direct pointer hit-testing with `pointer-events: none`. `nativeSelectTouchGuard` resolves a tap to the visible select rectangle (or its associated label) and dispatches the existing bridge keyboard-open contract. Safari therefore never receives the direct native-select pointer activation that produced the duplicate picker.

Fine-pointer/desktop interaction continues to use the existing direct `MVNativeSelectBridge` interception path. No user-agent sniffing is used. Direct `MVSelect` controls are unaffected by the coarse-pointer guard. Date/month/file/colour/checkbox/radio/range controls remain outside this guard.

Physical iPhone verification remains mandatory after deployment because the Node/Vitest environment cannot itself display or suppress Safari's native picker UI.
