import { describe, expect, it } from 'vitest';
import {
  OWNER_EMAIL,
  assertSafeIntegerPence,
  initialRoleForVerifiedEmail,
  normalizeEmail,
} from './contracts';

describe('persistent datastore invariants', () => {
  it('normalizes identity email before authorization decisions', () => {
    expect(normalizeEmail('  BACKTONEMESIS@GMAIL.COM ')).toBe(OWNER_EMAIL);
  });

  it('assigns Owner only to the verified household Owner email', () => {
    expect(initialRoleForVerifiedEmail(OWNER_EMAIL)).toBe('owner');
    expect(initialRoleForVerifiedEmail('new.member@example.com')).toBe('pending');
  });

  it('accepts exact integer pence and rejects floating point money', () => {
    expect(() => assertSafeIntegerPence(213_742, 'amountPence')).not.toThrow();
    expect(() => assertSafeIntegerPence(2137.42, 'amountPence')).toThrow(/integer number of pence/);
  });
});
