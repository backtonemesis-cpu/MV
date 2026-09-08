import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const main = fs.readFileSync(path.join(src, 'main.tsx'), 'utf8');
const compact = fs.readFileSync(path.join(src, 'unifiedAddLauncherCompact.css'), 'utf8');
const consistency = fs.readFileSync(path.join(src, 'unifiedAddConsistency.css'), 'utf8');

describe('unified Add initial launcher compactness', () => {
  it('loads the compact launcher override after the unified Add consistency layer', () => {
    expect(main.indexOf("./unifiedAddConsistency.css")).toBeLessThan(main.indexOf("./unifiedAddLauncherCompact.css"));
  });

  it('keeps the unselected iPhone launcher content-height instead of 92dvh', () => {
    expect(compact).toContain(':not(:has(.mv-transaction-type-tab[aria-pressed="true"]))');
    expect(compact).toContain('min-height: 0 !important');
    expect(compact).toContain('height: auto !important');
    expect(compact).toContain('max-height: calc(100dvh - 24px) !important');
    expect(compact).not.toContain('92dvh');
  });

  it('does not remove the fixed selected/Bill shell contract', () => {
    expect(consistency).toContain('min-height: 92dvh !important');
    expect(consistency).toContain('height: 92dvh !important');
    expect(consistency).toContain('.mv-add-bill-modal[data-unified-add="true"]');
  });

  it('contains no financial or persistence semantics', () => {
    expect(compact).not.toMatch(/amountPence|accountId|categoryId|onSave|TransactionType|PlannedPayment|localStorage|sessionStorage/);
  });
});
