import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const accounts = fs.readFileSync(path.join(src, 'components/AccountsView.tsx'), 'utf8');
const mobile = fs.readFileSync(path.join(src, 'mobileUx.css'), 'utf8');
const design = fs.readFileSync(path.join(src, 'globalDesignSystem.css'), 'utf8');

describe('PHONE-DENSITY-001 Accounts touch targets', () => {
  it('preserves compact desktop account controls in source', () => {
    expect(accounts).toContain('className="inline-flex h-8 items-center gap-1 rounded-lg border border-muted');
    expect(accounts).toContain('className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent');
    expect(accounts).toContain('className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-muted bg-surface');
    expect(accounts).toContain('className="inline-flex h-10 items-center gap-2 rounded-xl border border-muted bg-surface-muted');
  });

  it('raises all Accounts Phone actions to the shared 44px target floor', () => {
    expect(design).toContain('--mv-ds-click-target: 2.75rem');
    expect(mobile).toContain('PHONE-DENSITY-001: Accounts uses compact desktop actions in source.');
    expect(mobile).toContain('.mv-layout-phone .mv-app-workspace > div > .space-y-6.pb-12 :is(');
    expect(mobile).toContain('button,');
    expect(mobile).toContain('label:has(> input[type="checkbox"])');
    expect(mobile).toContain('min-height: var(--mv-ds-click-target) !important;');
  });
});
