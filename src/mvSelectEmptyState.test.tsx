import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MVSelect, type MVSelectOption } from './components/MVSelect';

const selectSource = fs.readFileSync(
  path.join(process.cwd(), 'src/components/MVSelect.tsx'),
  'utf8'
);

function renderSelect(
  options: MVSelectOption[],
  overrides: Partial<React.ComponentProps<typeof MVSelect>> = {}
): string {
  return renderToStaticMarkup(
    <MVSelect
      id="test-select"
      value=""
      options={options}
      onValueChange={vi.fn()}
      placeholder="Select account"
      ariaLabel="Account"
      {...overrides}
    />
  );
}

describe('MVSelect intentional empty state', () => {
  it('renders an explicit non-popup empty state instead of an empty listbox sliver', () => {
    const html = renderSelect([]);

    expect(html).toContain('No options available');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('aria-haspopup="listbox"');
    expect(html).not.toContain('data-mv-select-popover');
    expect(html).not.toContain('<svg');
  });

  it('supports a field-specific empty message without inventing a selectable value', () => {
    const html = renderSelect([], {
      emptyMessage: 'No accounts available',
      required: true,
    });

    expect(html).toContain('No accounts available');
    expect(html).toContain('aria-required="true"');
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('value="No accounts available"');
  });

  it('retains the normal listbox contract when one or more legal options exist', () => {
    const html = renderSelect([
      { value: 'lloyds-marius', label: 'Lloyds · Current · Marius' },
    ]);

    expect(html).toContain('Select account');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('aria-disabled="true"');
    expect(html).toContain('<svg');
  });

  it('renders a selected option by its stable value and preserves unambiguous account identity', () => {
    const html = renderSelect(
      [
        { value: 'lloyds-marius', label: 'Lloyds · Current · Marius' },
        { value: 'lloyds-vesta', label: 'Lloyds · Current · Vesta' },
      ],
      { value: 'lloyds-vesta' }
    );

    expect(html).toContain('Lloyds · Current · Vesta');
    expect(html).not.toContain('No options available');
    expect(html).toContain('aria-haspopup="listbox"');
  });

  it('keeps a non-empty all-disabled option set inspectable so disabled reasons can remain visible', () => {
    const html = renderSelect([
      {
        value: 'credit-card',
        label: 'Credit Card · Credit · Marius',
        disabled: true,
        disabledReason: 'Credit/liability account — not a cash funding source',
      },
    ]);

    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).not.toContain('aria-disabled="true"');
  });

  it('guards every direct open path and closes an already-open selector if dynamic options become empty', () => {
    expect(selectSource).toContain('if (disabled || !hasOptions) return;');
    expect(selectSource).toContain('if (open && !hasOptions) close(false);');
    expect(selectSource).toContain('open && hasOptions && triggerRef.current');
  });
});
