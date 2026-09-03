import type {
  AuditLogEntry,
  HouseholdData,
  HouseholdMember,
  UserPreferences,
} from '../../src/types';

export const HOUSEHOLD_ID = 'household-mv';
export const HOUSEHOLD_NAME = 'Marius & Vesta Household';
export const HOUSEHOLD_CURRENCY = 'GBP';
export const OWNER_EMAIL = 'backtonemesis@gmail.com';

export type PersistentBackend = 'firestore';

export interface HouseholdMutationAudit {
  action: string;
  entityType: AuditLogEntry['entityType'];
  entityId: string;
  summary: string;
  details?: Record<string, unknown>;
}

export interface HouseholdMutationRequest {
  expectedVersion: number;
  actorEmail: string;
  audit: HouseholdMutationAudit;
}

export interface HouseholdMutationResult<T> {
  value: T;
  version: number;
}

/**
 * Storage contract for the authoritative shared household dataset.
 *
 * All implementations must provide optimistic concurrency at household version
 * level and append an audit event in the same atomic mutation as the business
 * write. A mutation that cannot satisfy both requirements must fail rather than
 * partially persist.
 */
export interface PersistentHouseholdStore {
  readonly backend: PersistentBackend;

  ensureHousehold(): Promise<void>;
  getHouseholdData(): Promise<HouseholdData>;
  getMemberByEmail(email: string): Promise<HouseholdMember | null>;
  getMemberById(memberId: string): Promise<HouseholdMember | null>;
  getPreferences(memberId: string): Promise<UserPreferences>;
  savePreferences(memberId: string, preferences: UserPreferences): Promise<void>;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function initialRoleForVerifiedEmail(email: string): HouseholdMember['role'] {
  return normalizeEmail(email) === OWNER_EMAIL ? 'owner' : 'pending';
}

export function assertSafeIntegerPence(value: unknown, fieldName: string): asserts value is number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${fieldName} must be stored as an integer number of pence.`);
  }
}
