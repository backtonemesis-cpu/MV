import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const settingsPath = path.resolve(process.cwd(), 'src/components/SettingsView.tsx');
const settings = fs.readFileSync(settingsPath, 'utf8');

const tabs = ['categories', 'appearance', 'members', 'audit', 'backup'] as const;

describe('Settings ARIA tabs contract', () => {
  it('uses one tablist with five explicit tabs', () => {
    expect(settings).toContain('role="tablist"');
    expect(settings).toContain('aria-label="Settings sections"');
    expect(settings.match(/role="tab"/g)?.length).toBe(5);

    for (const tab of tabs) {
      expect(settings).toContain(`id="settings-tab-${tab}"`);
      expect(settings).toContain(`aria-controls="settings-panel-${tab}"`);
      expect(settings).toContain(`tabIndex={activeTab === '${tab}' ? 0 : -1}`);
    }
  });

  it('keeps a stable owned tabpanel for every Settings tab', () => {
    expect(settings.match(/role="tabpanel"/g)?.length).toBe(5);

    for (const tab of tabs) {
      expect(settings).toContain(`id="settings-panel-${tab}"`);
      expect(settings).toContain(`aria-labelledby="settings-tab-${tab}"`);
      expect(settings).toContain(`hidden={activeTab !== '${tab}'}`);
    }
  });

  it('implements horizontal tab keyboard movement plus Home and End', () => {
    expect(settings).toContain("['ArrowLeft', 'ArrowRight', 'Home', 'End']");
    expect(settings).toContain("if (event.key === 'Home')");
    expect(settings).toContain("else if (event.key === 'End')");
    expect(settings).toContain("const direction = event.key === 'ArrowRight' ? 1 : -1;");
    expect(settings).not.toContain("'ArrowUp', 'ArrowDown'");
  });

  it('keeps focus on the selected tab instead of stealing it into Household content', () => {
    expect(settings).toContain('document.getElementById(`settings-tab-${nextTab}`)?.focus()');
    expect(settings).not.toContain('memberNameInputRef.current?.focus()');
  });

  it('makes Settings tab buttons non-submitting controls', () => {
    const tabArea = settings.slice(
      settings.indexOf('{/* Settings Tabs */}'),
      settings.indexOf('id="settings-panel-categories"')
    );
    expect(tabArea.match(/type="button"/g)?.length).toBe(5);
  });
});
