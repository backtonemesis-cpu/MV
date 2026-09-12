import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
const css = fs.readFileSync(
  path.resolve(process.cwd(), 'public/iphone-transaction-date-fix.css'),
  'utf8'
);
const mobileCss = fs.readFileSync(path.resolve(process.cwd(), 'src/mobileUx.css'), 'utf8');
const designCss = fs.readFileSync(path.resolve(process.cwd(), 'src/globalDesignSystem.css'), 'utf8');
const unifiedAddCss = fs.readFileSync(
  path.resolve(process.cwd(), 'src/unifiedAddConsistency.css'),
  'utf8'
);

describe('Actual iPhone transaction date visual frame regression', () => {
  it('loads the dedicated iPhone transaction date containment layer as a Vite public asset', () => {
    expect(html).toContain('href="/iphone-transaction-date-fix.css"');
  });

  it('applies the iPhone-sized containment layer in both user-selectable layout modes', () => {
    expect(css).toContain('@media (max-width: 430px)');
    expect(css).toContain('.mv-density-root:is(.mv-layout-pc, .mv-layout-phone)');
  });

  it('makes the Date wrapper consume exactly its available grid width like sibling fields', () => {
    expect(css).toMatch(
      /div:has\(> label\[for="transaction-date"\]\)\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?inline-size:\s*100%;[\s\S]*?width:\s*100%;[\s\S]*?min-inline-size:\s*0;[\s\S]*?min-width:\s*0;[\s\S]*?max-inline-size:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?overflow:\s*hidden;/
    );
  });

  it('prevents the native Date input from exceeding that wrapper in either dimension model', () => {
    expect(css).toMatch(
      /\.mv-density-root:is\(\.mv-layout-pc, \.mv-layout-phone\) \.mv-transaction-modal #transaction-date\s*\{[\s\S]*?inline-size:\s*100% !important;[\s\S]*?width:\s*100% !important;[\s\S]*?min-inline-size:\s*0 !important;[\s\S]*?min-width:\s*0 !important;[\s\S]*?max-inline-size:\s*100% !important;[\s\S]*?max-width:\s*100% !important;[\s\S]*?box-sizing:\s*border-box !important;[\s\S]*?margin:\s*0 !important;/
    );
  });

  it('clips native Safari date paint inside the transaction field container', () => {
    expect(css).toContain('label[for="transaction-date"]');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('#transaction-date');
    expect(css).toContain('max-width: 100% !important');
  });

  it('uses the same normal field border contract instead of a separate pseudo-frame', () => {
    expect(unifiedAddCss).toContain('border-color: var(--border) !important;');
    expect(unifiedAddCss).toContain('border-radius: var(--card-radius, 6px) !important;');
    expect(css).toContain('border: 1px solid var(--border) !important;');
    expect(css).toContain('border-radius: var(--card-radius, 6px) !important;');
    expect(css).toContain('background-color: var(--field) !important;');
    expect(css).not.toContain('::after');
    expect(css).not.toContain('border: 0 !important');
    expect(css).not.toContain('background: transparent !important');
  });

  it('centres the native date value inside the 40px MV field', () => {
    expect(css).toContain('height: 40px !important');
    expect(css).toContain('line-height: 40px !important');
    expect(css).toContain('::-webkit-date-and-time-value');
    expect(css).toContain('min-height: 40px');
    expect(css).toContain('text-align: left');
  });

  it('keeps the full date field tappable while hiding native chrome', () => {
    expect(css).toContain('-webkit-appearance: none');
    expect(css).toContain('appearance: none');
    expect(css).toContain('::-webkit-calendar-picker-indicator');
    expect(css).toContain('inset: 0');
    expect(css).toContain('opacity: 0');
  });

  it('preserves the PR #178 16px anti-focus-zoom contract in both iPhone layout modes', () => {
    expect(designCss).toContain('--mv-control-value-phone-size: 1rem;');
    expect(designCss).toContain('--mv-control-value-phone-leading: 1.5rem;');
    expect(mobileCss).toContain('@media (max-width: 47.999rem)');
    expect(mobileCss).toContain('.mv-density-root:is(.mv-layout-pc, .mv-layout-phone)');
    expect(mobileCss).toContain('--mv-control-value-size: var(--mv-control-value-phone-size);');
    expect(mobileCss).toContain('--mv-control-value-leading: var(--mv-control-value-phone-leading);');
  });

  it('preserves native date input semantics and only changes presentation', () => {
    const tx = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/TransactionModal.tsx'),
      'utf8'
    );
    expect(tx).toContain('id="transaction-date"');
    expect(tx).toContain('type="date"');
    expect(tx).toContain('value={date}');
    expect(tx).toContain('onChange={(e) => setDate(e.target.value)}');
    expect(tx).toContain("const [date, setDate] = useState('')");
  });
});
