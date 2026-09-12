import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const transferPlan = fs.readFileSync(path.join(src, 'components/TransferPlanView.tsx'), 'utf8');
const mobile = fs.readFileSync(path.join(src, 'mobileUx.css'), 'utf8');
const design = fs.readFileSync(path.join(src, 'globalDesignSystem.css'), 'utf8');

describe('PHONE-DENSITY-001 Transfer Plan bill-selection target', () => {
  it('keeps the native bill-selection checkbox inside its label', () => {
    expect(transferPlan).toContain('aria-label="Transfer Plan bill selection"');
    expect(transferPlan).toContain('className="flex items-center" title="Include in Transfer Plan"');
    expect(transferPlan).toContain('className="h-4 w-4 rounded border-muted"');
  });

  it('expands the Phone label hit area to the shared 44px floor', () => {
    expect(design).toContain('--mv-ds-click-target: 2.75rem');
    expect(mobile).toContain('section[aria-label="Transfer Plan bill selection"] label:has(> input[type="checkbox"])');
    expect(mobile).toContain('min-width: var(--mv-ds-click-target) !important;');
    expect(mobile).toContain('min-height: var(--mv-ds-click-target) !important;');
  });
});
