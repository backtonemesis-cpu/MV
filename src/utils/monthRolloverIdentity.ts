import type { PlannedIncome, PlannedPayment } from '../types';

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;

function normalizeText(value: string | undefined): string {
  return value?.trim().toLowerCase() || '';
}

function copiedFromId(record: PlannedIncome | PlannedPayment): string {
  return String(record.metadata?.copiedFromId || record.id);
}

export function shiftRolloverDateToMonth(
  date: string | undefined,
  targetMonth: string
): string | undefined {
  if (!date || date.length < 10) return date;
  if (!MONTH_KEY.test(targetMonth)) {
    throw new Error('Target month must use YYYY-MM format.');
  }

  const [yearText, monthText] = targetMonth.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const sourceDay = Number(date.slice(8, 10));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isInteger(sourceDay) ||
    sourceDay < 1
  ) {
    throw new Error('Cannot shift an invalid calendar date.');
  }

  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(sourceDay, lastDay);
  return `${targetMonth}-${String(day).padStart(2, '0')}`;
}

export function isRolloverPaymentDuplicate(
  source: PlannedPayment,
  candidate: PlannedPayment,
  targetMonth: string
): boolean {
  if (candidate.month !== targetMonth) return false;

  const lineageId = copiedFromId(source);
  if (String(candidate.metadata?.copiedFromId || '') === lineageId) return true;
  if (!MONTH_KEY.test(targetMonth)) return false;

  return (
    normalizeText(candidate.name) === normalizeText(source.name) &&
    candidate.accountId === source.accountId &&
    candidate.amountPence === source.amountPence &&
    normalizeText(candidate.responsiblePerson) === normalizeText(source.responsiblePerson) &&
    (candidate.categoryId || '') === (source.categoryId || '') &&
    (candidate.dueDate || '') ===
      (shiftRolloverDateToMonth(source.dueDate, targetMonth) || '') &&
    candidate.includeInTransferPlan === source.includeInTransferPlan &&
    Boolean(candidate.isRecurring) === Boolean(source.isRecurring) &&
    normalizeText(candidate.notes) === normalizeText(source.notes)
  );
}

export function isRolloverIncomeDuplicate(
  source: PlannedIncome,
  candidate: PlannedIncome,
  targetMonth: string
): boolean {
  if (candidate.month !== targetMonth) return false;

  const lineageId = copiedFromId(source);
  if (String(candidate.metadata?.copiedFromId || '') === lineageId) return true;
  if (!MONTH_KEY.test(targetMonth)) return false;

  return (
    normalizeText(candidate.name) === normalizeText(source.name) &&
    candidate.accountId === source.accountId &&
    candidate.expectedAmountPence === source.expectedAmountPence &&
    normalizeText(candidate.sourcePerson) === normalizeText(source.sourcePerson) &&
    (candidate.categoryId || '') === (source.categoryId || '') &&
    (candidate.expectedDate || '') ===
      (shiftRolloverDateToMonth(source.expectedDate, targetMonth) || '') &&
    normalizeText(candidate.notes) === normalizeText(source.notes)
  );
}
