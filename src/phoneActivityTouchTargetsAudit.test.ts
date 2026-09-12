import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const activity = fs.readFileSync(path.join(src, 'components/TransactionList.tsx'), 'utf8');
const mobile = fs.readFileSync(path.join(src, 'mobileUx.css'), 'utf8');
const design = fs.readFileSync(path.join(src, 'globalDesignSystem.css'), 'utf8');

describe('PHONE-DENSITY-001 Activity touch targets', () => {
  it('preserves compact desktop Activity actions in source', () => {
    expect(activity).toContain('id="tx-list-add-btn"');
    expect(activity).toContain('className="inline-flex h-10 items-center justify-center');
    expect(activity).toContain('className="mt-4 inline-flex h-9 items-center');
    expect(design).toContain('.mv-layout-phone .finance-action-button {');
    expect(design).toContain('width: var(--mv-ds-control-compact) !important;');
    expect(design).toContain('height: var(--mv-ds-control-compact) !important;');
  });

  it('raises all Activity Phone actions to the shared 44px target floor', () => {
    expect(design).toContain('--mv-ds-click-target: 2.75rem');
    expect(mobile).toContain('PHONE-DENSITY-001: Activity keeps 40px/36px page actions and 32px row');
    expect(mobile).toContain('.mv-layout-phone .finance-activity-workspace button');
    expect(mobile).toContain('.mv-layout-phone .finance-activity-workspace .finance-action-button');
    expect(mobile).toContain('width: var(--mv-ds-click-target) !important;');
    expect(mobile).toContain('height: var(--mv-ds-click-target) !important;');
  });
});
