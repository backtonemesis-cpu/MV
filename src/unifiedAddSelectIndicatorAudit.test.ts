import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const css = fs.readFileSync(path.join(src, 'unifiedAddSelectIndicator.css'), 'utf8');
const main = fs.readFileSync(path.join(src, 'main.tsx'), 'utf8');

describe('unified Add select indicator repair', () => {
  it('loads the select indicator repair after unified Add presentation styles', () => {
    expect(main).toContain("import './unifiedAddSelectIndicator.css';");
  });

  it('replaces only unified Add native stacked select arrows with one centred chevron', () => {
    expect(css).toContain('select.mv-transaction-control');
    expect(css).toContain('.mv-add-bill-modal[data-unified-add="true"] select');
    expect(css).toContain('-webkit-appearance: none !important');
    expect(css).toContain('appearance: none !important');
    expect(css).toContain('background-position: right 14px center !important');
    expect(css).toContain('background-repeat: no-repeat !important');
    expect(css).toContain('padding-right: 42px !important');
  });
});
