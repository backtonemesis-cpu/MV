import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = path.resolve(process.cwd(), 'src');
const dashboard = fs.readFileSync(path.join(src, 'components/Dashboard.tsx'), 'utf8');
const mobile = fs.readFileSync(path.join(src, 'mobileUx.css'), 'utf8');
const design = fs.readFileSync(path.join(src, 'globalDesignSystem.css'), 'utf8');

describe('PHONE-DENSITY-001 Dashboard secondary touch targets', () => {
  it('retains compact secondary Dashboard actions in source', () => {
    expect(dashboard).toContain('>Review Plan</button>');
    expect(dashboard).toContain('>View All</button>');
    expect(dashboard).toContain('>View Plan</button>');
    expect(dashboard).toContain('>Add Bill</button>');
    expect(dashboard).toContain('>Log Transaction</button>');
  });

  it('raises Dashboard Phone secondary actions to the shared 44px target floor', () => {
    expect(design).toContain('--mv-ds-click-target: 2.75rem');
    expect(mobile).toContain('PHONE-DENSITY-001: Dashboard primary actions already meet the 44px floor');
    expect(mobile).toContain('.mv-layout-phone .mv-dashboard-workspace button:not(.mv-dashboard-actions > button)');
    expect(mobile).toContain('min-height: var(--mv-ds-click-target) !important;');
  });
});
