import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const income = fs.readFileSync(path.resolve(process.cwd(), 'src/components/IncomeView.tsx'), 'utf8');
const savings = fs.readFileSync(path.resolve(process.cwd(), 'src/components/SavingsView.tsx'), 'utf8');
const dashboard = fs.readFileSync(path.resolve(process.cwd(), 'src/components/Dashboard.tsx'), 'utf8');

describe('PHONE-DENSITY-001 summary metric density', () => {
  it('keeps the three Income summary metrics in one phone row', () => {
    expect(income).toContain('className="grid grid-cols-3 gap-2 sm:grid-cols-3"');
    expect(income).not.toContain('className="grid grid-cols-1 gap-2 sm:grid-cols-3"');
  });

  it('keeps the four Savings summary metrics in a two-column phone grid', () => {
    expect(savings).toContain('className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"');
    expect(savings).not.toContain('className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"');
  });

  it('preserves the already-dense Dashboard two-column phone metrics', () => {
    expect(dashboard).toContain('className="mv-dashboard-metrics grid grid-cols-2 gap-3 lg:grid-cols-4"');
  });
});
