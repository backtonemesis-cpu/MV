from pathlib import Path

select_path = Path('src/components/MVSelect.tsx')
select_source = select_path.read_text()
old_focus = """function focusRelativeTo(anchor: HTMLElement, reverse: boolean): void {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])'
    )
  ).filter((element) => !element.closest('[data-mv-select-popover]') && isElementVisible(element));
  const index = candidates.indexOf(anchor);
  if (index < 0) return;
  const target = candidates[index + (reverse ? -1 : 1)];
  target?.focus({ preventScroll: true });
}"""
new_focus = """function focusRelativeTo(anchor: HTMLElement, reverse: boolean): void {
  const modal = anchor.closest('[role=\"dialog\"][aria-modal=\"true\"]') as HTMLElement | null;
  const focusScope: ParentNode = modal ?? document;
  const candidates = Array.from(
    focusScope.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])'
    )
  ).filter((element) => !element.closest('[data-mv-select-popover]') && isElementVisible(element));
  const index = candidates.indexOf(anchor);
  if (index < 0) return;
  const nextIndex = index + (reverse ? -1 : 1);
  const target =
    candidates[nextIndex] ??
    (modal ? candidates[reverse ? candidates.length - 1 : 0] : undefined);
  target?.focus({ preventScroll: true });
}"""
assert select_source.count(old_focus) == 1, 'Expected focusRelativeTo implementation exactly once'
select_path.write_text(select_source.replace(old_focus, new_focus, 1))

test_path = Path('src/globalMvDropdownSystemAudit.test.ts')
test_source = test_path.read_text()
marker = "  it('closes on outside pointer interaction and selects one option without nested interactive option controls', () => {"
new_test = """  it('keeps portalled listbox Tab traversal inside the owning modal and wraps at modal edges', () => {
    expect(selectSource).toContain(\"anchor.closest('[role=\\\"dialog\\\"][aria-modal=\\\"true\\\"]')\");
    expect(selectSource).toContain('const focusScope: ParentNode = modal ?? document;');
    expect(selectSource).toContain('focusScope.querySelectorAll<HTMLElement>');
    expect(selectSource).toContain('const nextIndex = index + (reverse ? -1 : 1);');
    expect(selectSource).toContain('(modal ? candidates[reverse ? candidates.length - 1 : 0] : undefined)');
  });

"""
assert test_source.count(marker) == 1, 'Expected dropdown test insertion marker exactly once'
test_path.write_text(test_source.replace(marker, new_test + marker, 1))

ledger_path = Path('docs/GLOBAL-AUDIT-LEDGER.md')
ledger = ledger_path.read_text()
replacements = [
    (
        'Verified deployed `main` before this modal-focus substage: `e181e07d103aff28a7588f4524c12a49bf5b1620` (PR #194).',
        'Verified deployed `main` before this MVSelect Tab-scope substage: `39f83fc85658bf65ee2ff9ebb91e36ef94173b59` (PR #195).',
    ),
    (
        'Main workflow run #859: test/build/privacy/local-only checks `PASS`; GitHub Pages deployment `PASS` for exact build version `e181e07d103aff28a7588f4524c12a49bf5b1620`.',
        'Main workflow run #861: test/build/privacy/local-only checks `PASS`; GitHub Pages deployment `PASS` for exact build version `39f83fc85658bf65ee2ff9ebb91e36ef94173b59`.',
    ),
    (
        'PRs #188–#194 are merged and deployed. They repaired field accessible names, Settings tab semantics, primary navigation history semantics, native browser feedback, modal-stack accessibility, Prepare Next Month identity, and the first systematic reachable-control accessibility defects.',
        'PRs #188–#195 are merged and deployed. They repaired field accessible names, Settings tab semantics, primary navigation history semantics, native browser feedback, modal-stack accessibility, Prepare Next Month identity, reachable-control accessibility defects, and safe modal initial-focus precedence.',
    ),
    (
        '`GA-A11Y-001` remains `OPEN` after deployed PR #194 because physical current-main verification and remaining shared-control review are still required. The next source-proven defect is shared modal initial-focus precedence: `data-modal-initial-focus` is present on deliberately safe controls such as Cancel, but the helper currently uses one combined selector so earlier DOM controls can win. `repair/modal-initial-focus-precedence` makes the safe marker authoritative before native autofocus and generic focusables; physical verification is not claimed.',
        '`GA-A11Y-001` remains `OPEN` after deployed PR #195 because physical current-main verification and remaining shared-control review are still required. The next source-proven defect is MVSelect portalled-listbox Tab scope: trigger-relative traversal currently searches the entire document, so selectors inside modals can cross the modal focus boundary or lose focus at an edge. `repair/mvselect-modal-tab-scope` scopes Tab traversal to the owning modal and wraps within modal boundaries while preserving non-modal behavior; physical verification is not claimed.',
    ),
]
for old, new in replacements:
    assert ledger.count(old) == 1, f'Expected ledger text exactly once: {old[:80]}'
    ledger = ledger.replace(old, new, 1)
ledger_path.write_text(ledger)
