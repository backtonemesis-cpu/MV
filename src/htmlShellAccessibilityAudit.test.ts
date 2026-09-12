import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

describe('HTML shell accessibility and static asset contract', () => {
  it('keeps the responsive viewport scalable for browser/user zoom', () => {
    expect(indexHtml).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />'
    );
    expect(indexHtml).not.toContain('maximum-scale=1.0');
    expect(indexHtml).not.toContain('user-scalable=no');
  });

  it('does not request obsolete standalone CSS patches that are absent from the repository', () => {
    expect(indexHtml).not.toContain('iphone-transaction-date-fix.css');
    expect(indexHtml).not.toContain('unified-add-launcher-fix.css');
  });

  it('keeps the Vite app entrypoint and MV path build contract intact', () => {
    expect(indexHtml).toContain('<div id="root"></div>');
    expect(indexHtml).toContain('<script type="module" src="/src/main.tsx"></script>');
  });
});
