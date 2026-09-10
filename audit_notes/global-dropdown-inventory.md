# MV global dropdown inventory

Baseline: `main` at `689b49954dc836362e8926c79d09bf65b413dd11`.

## Ordinary value selectors to migrate through the shared MVSelect system

| Component / screen | Current selector | Metadata / disabled semantics | Migration |
| --- | --- | --- | --- |
| UnifiedAddUi / Add Entry account fields | Native select on desktop + separate mobile account modal/sheet | Account identity + balance | Explicit MVSelect; remove mobile sheet architecture |
| ExecuteTransferModal / funding source | Custom trigger + listbox | Account identity, safe-to-move balance, visible disabled reason, already-selected rule | Explicit MVSelect; preserve eligibility and disabled reasons |
| AccountsView / Add Account | Owner, Type native selects | Disabled placeholders; Joint + active member owner options | Shared native-select bridge |
| AccountsView / Edit Account | Owner, Type native selects | Historical removed owner retained; legacy Joint type conditionally retained | Shared native-select bridge |
| TransactionList / Activity | Date, payer, classification, category native selects | Date filter can be disabled; exact current filter values | Shared native-select bridge |
| IncomeView | Received by, Account, Category, Receiving account native selects | Household people, account identity, category eligibility | Shared native-select bridge |
| CategorySettings | Category Group, new Group Scope native selects | Group scope/write-boundary constraints | Shared native-select bridge |
| CategoryBudgets | Category native select | Bill-category eligibility | Shared native-select bridge |
| CategoryCorrection | Operation, From category, To category, budget conflict policy native selects | Scope/system/archive/merge constraints | Shared native-select bridge |
| MembersView | Member role native select | Owner-only edit; Editor/View Only values | Shared native-select bridge |
| PlannedPaymentModal | Category native select | Bill-category eligibility | Shared native-select bridge; Payment Account uses UnifiedAddUi explicit MVSelect |
| SavingsView | Source account, Savings destination native selects | Existing source/destination eligibility | Shared native-select bridge |
| MarkPaymentPaidModal | Paid from native select | Active account options | Shared native-select bridge |
| AuditLogView | Audit type native select | Fixed audit entity filter values | Shared native-select bridge |
| TransactionModal | Bill category, transaction category, split category native selects | Bill/transaction/split category eligibility and historical preservation | Shared native-select bridge; account selectors use UnifiedAddUi explicit MVSelect |

There are 28 ordinary native `<select>` render points in the current source, plus the two custom selector architectures above.

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

`MVSelect` is the authoritative select-only listbox/popover implementation. Rich selectors (Unified Add account and Transfer Plan funding source) use it directly. Existing ordinary native `<select>` elements retain their option-generation and form semantics as the source of truth, while `MVNativeSelectBridge` mediates their visible opening interaction through the same MVSelect popover renderer. This preserves exact option sets and `onChange` contracts without duplicating business rules across dozens of forms.
