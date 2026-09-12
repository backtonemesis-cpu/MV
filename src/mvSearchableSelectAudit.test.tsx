import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MVSearchableSelect } from './components/MVSearchableSelect';

const ROOT = process.cwd();
const source = fs.readFileSync(
  path.join(ROOT, 'src/components/MVSearchableSelect.tsx'),
  'utf8'
);
const css = fs.readFileSync(
  path.join(ROOT, 'src/mvSearchableSelect.css'),
  'utf8'
);
const ordinarySelect = fs.readFileSync(
  path.join(ROOT, 'src/components/MVSelect.tsx'),
  'utf8'
);

function render(overrides: Partial<React.ComponentProps<typeof MVSearchableSelect>> = {}) {
  return renderToStaticMarkup(
    <MVSearchableSelect
      id="category-search-test"
      value=""
      options={[
        { value: 'cat-rent', label: 'Rent', textValue: 'Rent Housing', secondary: 'Housing' },
        { value: 'cat-water', label: 'Water', textValue: 'Water Utilities', secondary: 'Utilities' },
      ]}
      onValueChange={vi.fn()}
      placeholder="Choose category"
      ariaLabel="Category"
      {...overrides}
    />
  );
}

describe('searchable financial long-list primitive', () => {
  it('keeps a single closed trigger with stable-value selection semantics', () => {
    const html = render({ value: 'cat-water' });

    expect(html).toContain('data-mv-searchable-select="true"');
    expect(html).toContain('Water');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(source).toContain('onValueChange(option.value)');
  });

  it('renders an explicit non-popup empty state when no legal options exist', () => {
    const html = render({ options: [], emptyMessage: 'No categories available' });

    expect(html).toContain('No categories available');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('aria-haspopup="listbox"');
  });

  it('uses a search combobox controlling one listbox rather than a competing native select', () => {
    expect(source).toContain('type="search"');
    expect(source).toContain('role="combobox"');
    expect(source).toContain('aria-controls={listboxId}');
    expect(source).toContain('aria-autocomplete="list"');
    expect(source).toContain('role="listbox"');
    expect(source).toContain('role="option"');
    expect(source).not.toContain('<select');
    expect(source).not.toContain('MVNativeSelectBridge');
    expect(source).not.toContain('installMVNativeSelectTouchGuard');
  });

  it('filters by explicit textValue/secondary copy without changing stored option values', () => {
    expect(source).toContain('option.textValue ??');
    expect(source).toContain('optionSearchText(option).includes(normalised)');
    expect(source).toContain("toLocaleLowerCase('en-GB')");
    expect(source).toContain('No matching options');
    expect(source).toContain('onValueChange(option.value)');
  });

  it('supports the keyboard/focus contract for a portalled searchable list', () => {
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', 'Escape', 'Tab']) {
      expect(source).toContain(`event.key === '${key}'`);
    }
    expect(source).toContain("anchor.closest('[role=\"dialog\"][aria-modal=\"true\"]')");
    expect(source).toContain('focusRelativeTo(trigger, reverse)');
    expect(source).toContain('searchRef.current?.focus({ preventScroll: true })');
    expect(source).toContain('window.visualViewport');
  });

  it('keeps long-list search touch-sized, internally scrollable and viewport-contained', () => {
    expect(css).toContain('.mv-searchable-select-popover');
    expect(css).toContain('overflow: hidden');
    expect(css).toContain('.mv-searchable-select-list');
    expect(css).toContain('overflow-y: auto');
    expect(css).toContain('overscroll-behavior: contain');
    expect(css).toContain('@media (max-width: 47.999rem)');
    expect(css).toContain('min-height: 44px');
    expect(source).toContain('viewportWidth - VIEWPORT_GUTTER * 2');
  });

  it('does not alter the existing select-only MVSelect primitive used by current rich account selectors', () => {
    expect(ordinarySelect).toContain('export const MVSelect: React.FC<MVSelectProps>');
    expect(ordinarySelect).toContain('role="listbox"');
    expect(ordinarySelect).not.toContain('type="search"');
  });
});
