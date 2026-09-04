import type { HouseholdMember, Payer } from '../types';

export function activeHouseholdPeople(members: HouseholdMember[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const member of members) {
    if (member.role === 'removed') continue;
    const name = member.name.trim();
    if (!name || name.toLowerCase() === 'joint') continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }

  return result;
}

export function householdPersonOptions(
  members: HouseholdMember[],
  extraValues: Array<string | undefined | null> = []
): Payer[] {
  const result: string[] = ['Joint', ...activeHouseholdPeople(members)];
  const seen = new Set(result.map((value) => value.toLowerCase()));

  for (const rawValue of extraValues) {
    const value = rawValue?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}
