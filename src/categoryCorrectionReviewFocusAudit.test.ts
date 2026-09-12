import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(
  path.join(process.cwd(), 'src', 'components', 'CategoryCorrection.tsx'),
  'utf8'
);

describe('Category Correction preview focus safety', () => {
  it('moves focus from Preview changes to the review summary before confirmation can run', () => {
    expect(source).toContain("import React, { useEffect, useRef, useState } from 'react';");
    expect(source).toContain('const reviewRef = useRef<HTMLDivElement>(null);');
    expect(source).toContain('if (!review) return;');
    expect(source).toContain('reviewRef.current?.focus({ preventScroll: true })');
    expect(source).toContain('window.cancelAnimationFrame(frame)');
    expect(source).toContain('ref={reviewRef}');
    expect(source).toContain('tabIndex={-1}');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-label="Category correction preview"');
    expect(source).toContain("? 'Confirm correction'");
    expect(source).toContain(": 'Preview changes'");
  });
});
