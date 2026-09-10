import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
const designCss = fs.readFileSync(
  path.resolve(process.cwd(), 'src/globalDesignSystem.css'),
  'utf8'
);
const moneyInput = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/MoneyInput.tsx'),
  'utf8'
);
const transactionModal = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/TransactionModal.tsx'),
  'utf8'
);

describe('Shared numeric-only GBP money-input regression guard', () => {
  it('renders no standalone pound glyph inside the shared input component', () => {
    expect(moneyInput).not.toContain('mv-money-prefix');
    expect(moneyInput).not.toMatch(/>\s*£\s*</);
    expect(moneyInput).toContain('mv-money-input-control');
  });

  it('uses ordinary symmetric numeric input padding with no obsolete prefix gap', () => {
    const rule = css.match(
      /\.mv-density-root input\.mv-money-input-control\s*\{[^}]+\}/s
    )?.[0] ?? '';

    expect(rule).toContain('padding-left: 12px !important');
    expect(rule).toContain('padding-right: 12px !important');
    expect(rule).not.toMatch(/padding-left:\s*(23|26|32)px/);
  });

  it('keeps placeholder styling without prefix-specific entered/focus/disabled CSS', () => {
    expect(css).toContain('.mv-density-root input.mv-money-input-control::placeholder');
    expect(css).toContain('opacity: 1');
    expect(css).not.toContain('.mv-money-prefix');
    expect(css).not.toContain('input.mv-money-input-with-prefix');
  });

  it('keeps Phone-mode money inputs numeric-only with normal padding', () => {
    const phoneRule = css.match(
      /\.mv-layout-phone input\.mv-money-input-control\s*\{[^}]+\}/s
    )?.[0] ?? '';

    expect(phoneRule).toContain('padding-left: 12px !important');
    expect(phoneRule).toContain('padding-right: 12px !important');
    expect(phoneRule).not.toContain('font-size:');
    expect(designCss).toContain('--mv-control-value-phone-size: 1rem;');
    expect(designCss).toContain('.mv-density-root.mv-layout-phone');
    expect(designCss).toContain('font-size: var(--mv-control-value-size);');
  });

  it('does not reintroduce forced autofocus into Transaction monetary fields', () => {
    const blocks = transactionModal.match(/<MoneyInput[\s\S]*?\/>/g) ?? [];
    expect(blocks).toHaveLength(3);
    expect(blocks.every((block) => !block.includes('autoFocus'))).toBe(true);
  });
});
