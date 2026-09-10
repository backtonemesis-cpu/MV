import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { pointInsideRect } from './nativeSelectTouchGuard';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const read = (relativePath: string) => fs.readFileSync(path.join(SRC, relativePath), 'utf8');

const guardSource = read('nativeSelectTouchGuard.ts');
const selectSource = read('components/MVSelect.tsx');
const selectCss = read('mvSelect.css');
const mainSource = read('main.tsx');
const transactionSource = read('components/TransactionModal.tsx');

describe('iPhone native select touch guard', () => {
  it('resolves pointer coordinates against the complete closed-field rectangle', () => {
    const rect = { left: 100, right: 300, top: 200, bottom: 244 };

    expect(pointInsideRect(rect, 100, 200)).toBe(true);
    expect(pointInsideRect(rect, 300, 244)).toBe(true);
    expect(pointInsideRect(rect, 200, 222)).toBe(true);
    expect(pointInsideRect(rect, 99, 222)).toBe(false);
    expect(pointInsideRect(rect, 301, 222)).toBe(false);
    expect(pointInsideRect(rect, 200, 199)).toBe(false);
    expect(pointInsideRect(rect, 200, 245)).toBe(false);
  });

  it('removes direct coarse-pointer hit testing from bridged native selects only', () => {
    expect(selectCss).toContain('@media (pointer: coarse)');
    expect(selectCss).toContain('.mv-density-root select:not([data-mv-native="true"])');
    expect(selectCss).toContain('pointer-events: none');
    expect(selectCss).not.toMatch(/input\[type=["']date["']\][\s\S]{0,120}pointer-events:\s*none/);
  });

  it('routes a touch-resolved field through the existing bridge without focusing the native select', () => {
    expect(guardSource).toContain('selectAtPoint(event.clientX, event.clientY)');
    expect(guardSource).toContain('selectFromLabelTarget(event.target)');
    expect(guardSource).toContain("new KeyboardEvent('keydown'");
    expect(guardSource).toContain("key: 'Enter'");
    expect(guardSource).toContain('dispatchBridgeOpen(select)');
    expect(guardSource).not.toContain('select.focus(');
    expect(guardSource).not.toMatch(/userAgent|navigator\.platform|iPhone|iPad/);
  });

  it('protects label activation as well as taps inside the visible select rectangle', () => {
    expect(guardSource).toContain("target.closest('label')");
    expect(guardSource).toContain('label.htmlFor');
    expect(guardSource).toContain("label.querySelector<HTMLSelectElement>('select')");
    expect(guardSource).toContain('event.preventDefault()');
    expect(guardSource).toContain('event.stopPropagation()');
  });

  it('installs one global touch guard while retaining one global MVNativeSelectBridge', () => {
    expect(mainSource).toContain("import { installMVNativeSelectTouchGuard } from './nativeSelectTouchGuard';");
    expect(mainSource).toContain('installMVNativeSelectTouchGuard();');
    expect(mainSource.match(/<MVNativeSelectBridge \/>/g)).toHaveLength(1);
  });

  it('keeps bridge value propagation and input/change events unchanged', () => {
    expect(selectSource).toContain("dispatchEvent(new Event('input', { bubbles: true }))");
    expect(selectSource).toContain("dispatchEvent(new Event('change', { bubbles: true }))");
    expect(selectSource).toContain('nativeSelectOptions(select)');
    expect(selectSource).toContain("select.dataset.mvNative !== 'true'");
  });

  it('does not capture native Date controls or alter PR #181 date semantics', () => {
    expect(guardSource).toContain("select:not([data-mv-native=\"true\"])");
    expect(guardSource).toContain('HTMLSelectElement');
    expect(guardSource).not.toContain('HTMLInputElement');
    expect(transactionSource).toContain('id="transaction-date"');
    expect(transactionSource).toContain('type="date"');
  });

  it('documents the DOM-runtime limitation rather than claiming a simulated Safari picker test', () => {
    expect(guardSource).toContain('pointerdown');
    expect(guardSource).toContain('click');
    expect(selectCss).toContain('Mobile Safari');
  });
});
