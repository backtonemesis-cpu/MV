import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = fs.readFileSync(
  path.resolve(process.cwd(), 'src/index.css'),
  'utf8'
);

describe('Actual iPhone payment footer safe-area regression', () => {
  it('reserves the bottom navigation footprint for financial modal actions', () => {
    expect(css).toContain('@media (max-width: 430px)');
    expect(css).toContain(
      'padding-bottom: calc(72px + env(safe-area-inset-bottom)) !important'
    );
    expect(css).toContain(
      '100% - 80px - env(safe-area-inset-bottom)'
    );
  });

  it('disables bottom-navigation interaction while a modal is open', () => {
    expect(css).toContain(
      '.mv-layout-phone .mv-device-frame:has(.mv-modal-backdrop) .mv-nav-mobile'
    );
    expect(css).toContain('pointer-events: none !important');
  });
});
