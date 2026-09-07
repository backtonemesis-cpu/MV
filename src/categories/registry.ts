import type { CategoryCatalogue, CategoryGroup, CategoryScope, CategoryV2, SystemCategoryRole } from './model';

/** The sole V2 starter registry. Runtime household categories remain editable data. */
const STARTER_GROUPS: readonly [string, string, CategoryScope, readonly (readonly [string, string])[]][] = [
  ['housing', 'Housing', 'expense', [
    ['rent', 'Rent'], ['mortgage', 'Mortgage'], ['council-tax', 'Council Tax'],
    ['service-charge', 'Service Charge'], ['ground-rent', 'Ground Rent'],
    ['home-insurance', 'Home Insurance'], ['repairs-maintenance', 'Repairs & Maintenance'],
  ]],
  ['utilities-communications', 'Utilities & Communications', 'expense', [
    ['gas-electricity', 'Gas & Electricity'], ['water', 'Water'], ['broadband', 'Broadband'],
    ['mobile', 'Mobile Phone'], ['tv-licence', 'TV Licence'],
  ]],
  ['food-household', 'Food & Household', 'expense', [
    ['groceries', 'Groceries'], ['dining-takeaway', 'Dining & Takeaway'],
    ['household-goods', 'Household Goods'], ['furniture-appliances', 'Furniture & Appliances'],
  ]],
  ['transport', 'Transport', 'expense', [
    ['fuel-ev-charging', 'Fuel / EV Charging'], ['public-transport', 'Public Transport'],
    ['vehicle-insurance', 'Vehicle Insurance'], ['vehicle-tax-mot', 'Vehicle Tax / MOT'],
    ['vehicle-servicing-repairs', 'Servicing & Repairs'], ['parking-tolls', 'Parking & Tolls'],
  ]],
  ['family-children', 'Family & Children', 'expense', [
    ['childcare', 'Childcare'], ['child-maintenance-paid', 'Child Maintenance Paid'],
    ['school-education', 'School & Education'], ['children-activities', "Children's Activities"],
  ]],
  ['health-personal', 'Health & Personal', 'expense', [
    ['health-pharmacy', 'Health & Pharmacy'], ['dental-optical', 'Dental & Optical'],
    ['personal-care', 'Personal Care'], ['clothing', 'Clothing'],
  ]],
  ['entertainment-leisure', 'Entertainment & Leisure', 'expense', [
    ['entertainment-hobbies', 'Entertainment & Hobbies'], ['subscriptions', 'Subscriptions'],
  ]],
  ['financial-costs', 'Financial Costs', 'expense', [
    ['bank-fees', 'Bank Fees'], ['loan-credit-interest-fees', 'Loan / Credit Interest & Fees'],
  ]],
  ['travel', 'Travel', 'expense', [['holidays-travel', 'Holidays & Travel']]],
  ['gifts-charity', 'Gifts & Charity', 'expense', [['gifts-charity', 'Gifts & Charity']]],
  ['pets', 'Pets', 'expense', [['pets', 'Pets']]],
  ['income', 'Income', 'income', [
    ['salary-wages', 'Salary & Wages'], ['universal-credit', 'Universal Credit'],
    ['child-benefit', 'Child Benefit'], ['child-maintenance-received', 'Child Maintenance Received'],
    ['interest', 'Interest'], ['bonus-rewards', 'Bonus & Rewards'], ['other-income', 'Other Income'],
  ]],
];

export const SYSTEM_CATEGORY_IDS = Object.freeze({
  'internal-transfer': 'cat-transfer',
  'uncategorised-expense': 'cat-uncategorised-expense',
  'uncategorised-income': 'cat-uncategorised-income',
} satisfies Record<SystemCategoryRole, string>);

export function createCanonicalCatalogue(): CategoryCatalogue {
  const categoryGroups: CategoryGroup[] = STARTER_GROUPS.map(([id, name, scope], sortOrder) => ({
    id: `group-${id}`, name, scope, sortOrder,
    isArchived: false, isSystem: false, isProtected: true,
  }));
  const categories: CategoryV2[] = STARTER_GROUPS.flatMap(([group, , , entries]) =>
    entries.map(([id, name], sortOrder) => ({
      id: `cat-${id}`, name, groupId: `group-${group}`, sortOrder,
      isArchived: false, isSystem: false, isProtected: false,
    }))
  );
  categoryGroups.push({
    id: 'group-system', name: 'System', scope: 'system', sortOrder: categoryGroups.length,
    isArchived: false, isSystem: true, isProtected: true,
  });
  const roles: [SystemCategoryRole, string][] = [
    ['internal-transfer', 'Internal Transfer'],
    ['uncategorised-expense', 'Uncategorised Expense'],
    ['uncategorised-income', 'Uncategorised Income'],
  ];
  roles.forEach(([systemRole, name], sortOrder) => categories.push({
    id: SYSTEM_CATEGORY_IDS[systemRole], name, groupId: 'group-system', sortOrder,
    isArchived: false, isSystem: true, isProtected: true, systemRole,
  }));
  return { categoryGroups, categories, monthlyCategoryBudgets: [] };
}
