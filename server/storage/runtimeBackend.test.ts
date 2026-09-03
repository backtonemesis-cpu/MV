import { describe, expect, it } from 'vitest';
import { resolveRuntimeDataBackend } from './runtimeBackend';

describe('runtime data backend selection', () => {
  it('defaults to sqlite for local compatibility', () => {
    expect(resolveRuntimeDataBackend(undefined)).toBe('sqlite');
  });

  it('accepts only explicit sqlite or firestore values', () => {
    expect(resolveRuntimeDataBackend(' sqlite ')).toBe('sqlite');
    expect(resolveRuntimeDataBackend('FIRESTORE')).toBe('firestore');
    expect(() => resolveRuntimeDataBackend('json')).toThrow('Unsupported MV_DATA_BACKEND');
  });
});
