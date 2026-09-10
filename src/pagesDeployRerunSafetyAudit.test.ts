import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = fs.readFileSync(path.resolve(process.cwd(), '.github/workflows/deploy.yml'), 'utf8');

describe('GitHub Pages rerun safety', () => {
  it('gives each workflow attempt a unique Pages artifact name', () => {
    expect(workflow).toContain('name: github-pages-${{ github.run_attempt }}');
    expect(workflow).toContain('artifact_name: github-pages-${{ github.run_attempt }}');
  });

  it('keeps upload and deploy wired to the same attempt-scoped artifact', () => {
    const occurrences = workflow.match(/github-pages-\$\{\{ github\.run_attempt \}\}/g) ?? [];
    expect(occurrences).toHaveLength(2);
  });
});
