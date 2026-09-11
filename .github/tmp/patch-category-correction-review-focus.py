from pathlib import Path

component_path = Path('src/components/CategoryCorrection.tsx')
source = component_path.read_text()

old_import = "import React,{useState} from 'react';"
new_import = "import React,{useEffect,useRef,useState} from 'react';"
assert source.count(old_import) == 1, 'Expected CategoryCorrection React import exactly once'
source = source.replace(old_import, new_import, 1)

old_state = " const [review,setReview]=useState<{preview:ReturnType<typeof previewReclassification>;version:number}|null>(null);\n const close=()=>{if(!busy){setOpen(false);setReview(null);setError('');}};"
new_state = " const [review,setReview]=useState<{preview:ReturnType<typeof previewReclassification>;version:number}|null>(null);\n const reviewRef=useRef<HTMLDivElement>(null);\n const close=()=>{if(!busy){setOpen(false);setReview(null);setError('');}};"
assert source.count(old_state) == 1, 'Expected review state block exactly once'
source = source.replace(old_state, new_state, 1)

old_update = " const update=(next:Partial<ReclassificationCommand>)=>{setCommand({...command,...next});setReview(null);setError('');};\n const source=household.categories.find(c=>c.id===command.sourceId);"
new_update = " const update=(next:Partial<ReclassificationCommand>)=>{setCommand({...command,...next});setReview(null);setError('');};\n useEffect(()=>{if(!review)return;const frame=window.requestAnimationFrame(()=>reviewRef.current?.focus({preventScroll:true}));return()=>window.cancelAnimationFrame(frame);},[review]);\n const source=household.categories.find(c=>c.id===command.sourceId);"
assert source.count(old_update) == 1, 'Expected update/source block exactly once'
source = source.replace(old_update, new_update, 1)

old_review = "    {review&&<div className=\"rounded-lg border border-muted p-3 text-sm text-main\" role=\"status\">"
new_review = "    {review&&<div ref={reviewRef} tabIndex={-1} className=\"rounded-lg border border-muted p-3 text-sm text-main\" role=\"status\" aria-label=\"Category correction preview\">"
assert source.count(old_review) == 1, 'Expected review summary element exactly once'
source = source.replace(old_review, new_review, 1)
component_path.write_text(source)

test_path = Path('src/categoryCorrectionReviewFocusAudit.test.ts')
test_path.write_text("""import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src', 'components', 'CategoryCorrection.tsx'),
  'utf8'
);

describe('Category Correction preview focus safety', () => {
  it('moves focus from Preview changes to the review summary before confirmation can run', () => {
    expect(source).toContain("import React,{useEffect,useRef,useState} from 'react';");
    expect(source).toContain('const reviewRef=useRef<HTMLDivElement>(null);');
    expect(source).toContain('if(!review)return;');
    expect(source).toContain('reviewRef.current?.focus({preventScroll:true})');
    expect(source).toContain('window.cancelAnimationFrame(frame)');
    expect(source).toContain('ref={reviewRef} tabIndex={-1}');
    expect(source).toContain('role="status" aria-label="Category correction preview"');
    expect(source).toContain("review?'Confirm correction':'Preview changes'");
  });
});
""")

ledger_path = Path('docs/GLOBAL-AUDIT-LEDGER.md')
ledger = ledger_path.read_text()
replacements = [
    (
        'Verified deployed `main` before this MVSelect Tab-scope substage: `39f83fc85658bf65ee2ff9ebb91e36ef94173b59` (PR #195).',
        'Verified deployed `main` before this Category Correction review-focus substage: `501130123d8d9522729c34a29c38b36ecf76b5b0` (PR #196).',
    ),
    (
        'Main workflow run #861: test/build/privacy/local-only checks `PASS`; GitHub Pages deployment `PASS` for exact build version `39f83fc85658bf65ee2ff9ebb91e36ef94173b59`.',
        'Main workflow run #863: test/build/privacy/local-only checks `PASS`; GitHub Pages deployment `PASS` for exact build version `501130123d8d9522729c34a29c38b36ecf76b5b0`.',
    ),
    (
        'PRs #188–#195 are merged and deployed. They repaired field accessible names, Settings tab semantics, primary navigation history semantics, native browser feedback, modal-stack accessibility, Prepare Next Month identity, reachable-control accessibility defects, and safe modal initial-focus precedence.',
        'PRs #188–#196 are merged and deployed. They repaired field accessible names, Settings tab semantics, primary navigation history semantics, native browser feedback, modal-stack accessibility, Prepare Next Month identity, reachable-control accessibility defects, safe modal initial-focus precedence, and MVSelect modal-scoped Tab traversal.',
    ),
    (
        '`GA-A11Y-001` remains `OPEN` after deployed PR #195 because physical current-main verification and remaining shared-control review are still required. The next source-proven defect is MVSelect portalled-listbox Tab scope: trigger-relative traversal currently searches the entire document, so selectors inside modals can cross the modal focus boundary or lose focus at an edge. `repair/mvselect-modal-tab-scope` scopes Tab traversal to the owning modal and wraps within modal boundaries while preserving non-modal behavior; physical verification is not claimed.',
        '`GA-A11Y-001` remains `OPEN` after deployed PR #196 because physical current-main verification and remaining shared-control review are still required. The next source-proven defect is Category Correction review focus: after keyboard activation of Preview changes, the same focused submit control changes in place to Confirm correction, allowing rapid double-Enter to execute the bulk rewrite before focus reaches the review summary. `repair/category-correction-review-focus` moves focus to the successful preview summary before confirmation; financial mutation semantics are unchanged and physical verification is not claimed.',
    ),
]
for old, new in replacements:
    assert ledger.count(old) == 1, f'Expected ledger text exactly once: {old[:80]}'
    ledger = ledger.replace(old, new, 1)
ledger_path.write_text(ledger)
