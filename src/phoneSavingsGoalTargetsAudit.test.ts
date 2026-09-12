import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const savings = fs.readFileSync(path.join(src, 'components/SavingsView.tsx'), 'utf8');
const mobile = fs.readFileSync(path.join(src, 'mobileUx.css'), 'utf8');
const design = fs.readFileSync(path.join(src, 'globalDesignSystem.css'), 'utf8');

describe('PHONE-DENSITY-001 Savings goal touch targets', () => {
  it('preserves compact desktop goal-card action pills in source', () => {
    expect(savings).toContain('className="mv-hscroll mt-4 pt-3 border-t border-muted"');
    expect(savings).toContain('rounded-full bg-success-soft px-3 py-1.5');
    expect(savings).toContain('rounded-full bg-surface-muted px-3 py-1.5');
    expect(savings).toContain('rounded-full bg-danger-soft px-3 py-1.5');
  });

  it('raises Savings goal-card Phone actions to the shared 44px target floor', () => {
    expect(design).toContain('--mv-ds-click-target: 2.75rem');
    expect(mobile).toContain('PHONE-DENSITY-001: Savings goal-card actions use compact desktop pills');
    expect(mobile).toContain('.mv-layout-phone .mv-hscroll > button');
    expect(mobile).toContain('min-height: var(--mv-ds-click-target) !important;');
  });
});
