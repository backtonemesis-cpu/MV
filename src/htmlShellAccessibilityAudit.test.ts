import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const indexHtml = fs.readFileSync(path.resolve(root, 'index.html'), 'utf8');
const viteConfig = fs.readFileSync(path.resolve(root, 'vite.config.ts'), 'utf8');

describe('HTML shell accessibility and static asset contract', () => {
  it('keeps the responsive viewport scalable for browser/user zoom', () => {
    expect(indexHtml).toContain(
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />'
    );
    expect(indexHtml).not.toContain('maximum-scale=1.0');
    expect(indexHtml).not.toContain('user-scalable=no');
  });

  it('loads required public CSS fixes using Vite public-asset root paths', () => {
    for (const file of ['iphone-transaction-date-fix.css', 'unified-add-launcher-fix.css']) {
      expect(fs.existsSync(path.resolve(root, 'public', file))).toBe(true);
      expect(indexHtml).toContain(`href="/${file}"`);
      expect(indexHtml).not.toContain(`href="./${file}"`);
    }
    expect(viteConfig).toContain("base: '/MV/'");
  });

  it('keeps the Vite app entrypoint and MV path build contract intact', () => {
    expect(indexHtml).toContain('<div id="root"></div>');
    expect(indexHtml).toContain('<script type="module" src="/src/main.tsx"></script>');
  });
});
