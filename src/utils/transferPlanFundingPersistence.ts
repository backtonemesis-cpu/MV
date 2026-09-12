import type { TransferPlanFundingRecord } from '../types';
import { validateTransferPlanFundingRecord } from './transferPlanFundingAttribution';

/**
 * Normalizes the additive Transfer Plan funding-evidence collection without
 * reconstructing attribution for legacy transaction-only funding batches.
 */
export function normalizeTransferPlanFundingRecords(
  value: TransferPlanFundingRecord[] | undefined
): TransferPlanFundingRecord[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error('Transfer Plan funding records must be an array.');
  }

  const ids = new Set<string>();
  return value.map((record) => {
    validateTransferPlanFundingRecord(record);
    if (ids.has(record.id)) {
      throw new Error(`Transfer Plan funding record ID '${record.id}' is duplicated.`);
    }
    ids.add(record.id);
    return structuredClone(record);
  });
}
