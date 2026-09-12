import type { HouseholdData } from '../types';
import { normalizeTransferPlanFundingRecords } from '../utils/transferPlanFundingPersistence';
import type { CategoryCatalogue } from './model';
import { createCanonicalCatalogue } from './registry';
import { assertCategoryCatalogue } from './validation';

export const CATEGORY_SCHEMA_VERSION = 2;
export const CATEGORY_STORAGE_KEY = 'mv_local_state_v2';
export const CATEGORY_ROLLBACK_KEY = 'mv_local_state_before_restore_v2';

export type HouseholdDataV2 = Omit<HouseholdData, 'categories'> & CategoryCatalogue & { dataSchemaVersion: 2 };

/** A clean seed factory, deliberately given identity only, never legacy finances. */
export function createCleanCategoryHousehold(
  identity: Pick<HouseholdData, 'id' | 'name' | 'members'>,
  version = 1
): HouseholdDataV2 {
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('Invalid state revision.');
  return {
    id: identity.id, name: identity.name, members: structuredClone(identity.members), version,
    dataSchemaVersion: CATEGORY_SCHEMA_VERSION,
    schemaStatus: {
      currentSchemaVersion: CATEGORY_SCHEMA_VERSION,
      minSupportedClientVersion: CATEGORY_SCHEMA_VERSION,
      latestAppliedVersion: CATEGORY_SCHEMA_VERSION,
      appliedMigrations: [], isUpToDate: true,
    },
    ...createCanonicalCatalogue(),
    accounts: [], transactions: [], plannedPayments: [], plannedIncomes: [], savingsGoals: [], transferPlanFundingRecords: [], auditLogs: [],
  };
}

export function assertCategorySchema(value: unknown): asserts value is HouseholdDataV2 {
  if (!value || typeof value !== 'object' ||
      (value as HouseholdDataV2).dataSchemaVersion !== CATEGORY_SCHEMA_VERSION) {
    throw new Error('Incompatible data schema. V2 requires an explicit compatible backup; legacy data was not imported.');
  }
  assertCategoryCatalogue(value);

  // The funding-evidence collection is additive within V2. Older valid V2
  // households/backups omit it, so normalize absence to [] without inferring
  // attribution from legacy Transfer Plan transactions. Explicit records must
  // pass their exact structural reconciliation before the state can continue.
  const state = value as HouseholdDataV2;
  state.transferPlanFundingRecords = normalizeTransferPlanFundingRecords(
    state.transferPlanFundingRecords
  );
}

/** The caller must supply the complete financial validator before activating V2. */
export function loadOrCreateCategoryState(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  createBlank: () => HouseholdDataV2,
  validateFinancialState: (value: HouseholdDataV2) => void
): HouseholdDataV2 {
  const raw = storage.getItem(CATEGORY_STORAGE_KEY);
  const candidate: unknown = raw === null ? createBlank() : JSON.parse(raw);
  assertCategorySchema(candidate);
  validateFinancialState(candidate);
  if (raw === null) storage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(candidate));
  return candidate;
}
