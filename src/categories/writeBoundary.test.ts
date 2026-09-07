import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBlankLocalHousehold, saveLocalHousehold, loadLocalHousehold, LOCAL_STORAGE_KEY,
  createLocalPlannedPayment, createLocalPlannedIncome, createLocalTransaction, markLocalPaymentPaid,
  markLocalPaymentsPaid, markLocalIncomeReceived, updateLocalTransaction, preflightLocalRestore,
  createLocalBackupPackage } from '../localStore';

let values: Map<string,string>;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key,value) });
  const state = createBlankLocalHousehold();
  state.accounts.push({ id:'synthetic-account', name:'Synthetic', type:'current', currency:'GBP', startingBalancePence:100000, currentBalancePence:100000, ownerPerson:'Marius', ownerMemberId:'local-marius' });
  saveLocalHousehold(state);
});
const bill = { name:'Synthetic bill', amountPence:1234, month:'2027-01', accountId:'synthetic-account', responsiblePerson:'Marius', includeInTransferPlan:true };
const income = { name:'Synthetic income', expectedAmountPence:2345, month:'2027-01', accountId:'synthetic-account', sourcePerson:'Marius' };
const expense = { description:'Synthetic expense', amountPence:1234, date:'2027-01-01', accountId:'synthetic-account', payer:'Marius', type:'expense' as const, categoryId:'cat-groceries' };

describe('category authoritative write boundary', () => {
  it('rejects missing and cross-scope manual categories without any write', () => {
    const before = values.get(LOCAL_STORAGE_KEY);
    for (const categoryId of [undefined, '', 'absent', 'cat-salary-wages', 'cat-transfer', 'cat-uncategorised-expense']) {
      expect(() => createLocalPlannedPayment({ ...bill, categoryId }, 1)).toThrow();
    }
    for (const categoryId of [undefined, '', 'absent', 'cat-rent', 'cat-transfer', 'cat-uncategorised-income']) {
      expect(() => createLocalPlannedIncome({ ...income, categoryId }, 1)).toThrow();
    }
    expect(() => createLocalTransaction({ ...expense, categoryId:undefined }, 1)).toThrow(/required/);
    expect(() => createLocalTransaction({ ...expense, type:'income', categoryId:undefined }, 1)).toThrow(/required/);
    expect(values.get(LOCAL_STORAGE_KEY)).toBe(before);
  });
  it('propagates exact bill and income categories, including explicit unresolved external classification', () => {
    createLocalPlannedPayment({ ...bill, categoryId:'cat-bank-fees' }, 1);
    let state=loadLocalHousehold();
    const paymentId=state.plannedPayments[0].id;
    markLocalPaymentPaid(paymentId, { actualDate:'2027-01-01' }, state.version);
    state=loadLocalHousehold();
    expect(state.transactions.find(t=>t.plannedPaymentId===paymentId)?.categoryId).toBe('cat-bank-fees');
    createLocalPlannedIncome({ ...income, categoryId:'cat-child-maintenance-received' }, state.version);
    state=loadLocalHousehold();
    markLocalIncomeReceived(state.plannedIncomes![0].id, { actualDate:'2027-01-01' }, state.version);
    state=loadLocalHousehold();
    expect(state.transactions.find(t=>t.plannedIncomeId)?.categoryId).toBe('cat-child-maintenance-received');
  });
  it('rejects unresolved missing categories on single and bulk payment and income receipt', () => {
    createLocalPlannedPayment({ ...bill, categoryId:'cat-rent' }, 1);
    let state=loadLocalHousehold();
    createLocalPlannedIncome({ ...income, categoryId:'cat-salary-wages' }, state.version);
    state=loadLocalHousehold();
    state.plannedPayments[0].categoryId=undefined;
    state.plannedIncomes![0].categoryId=undefined;
    saveLocalHousehold(state);
    const before=values.get(LOCAL_STORAGE_KEY);
    expect(()=>markLocalPaymentPaid(state.plannedPayments[0].id, {}, state.version)).toThrow(/required/);
    expect(()=>markLocalPaymentsPaid([state.plannedPayments[0]], '2027-01-01', state.version)).toThrow();
    expect(()=>markLocalIncomeReceived(state.plannedIncomes![0].id, {}, state.version)).toThrow(/required/);
    expect(values.get(LOCAL_STORAGE_KEY)).toBe(before);
  });
  it('checks every split category and exact pence on create and edit', () => {
    for(const categoryId of ['absent','cat-salary-wages','cat-transfer']) {
      expect(()=>createLocalTransaction({ ...expense, splits:[{ id:'split', categoryId, amountPence:1234 }] },1)).toThrow();
    }
    expect(()=>createLocalTransaction({ ...expense, splits:[{ id:'split',categoryId:'cat-groceries',amountPence:1233 }] },1)).toThrow();
    createLocalTransaction({ ...expense,splits:[{ id:'split',categoryId:'cat-groceries',amountPence:1234 }] },1);
    const state=loadLocalHousehold();
    expect(()=>updateLocalTransaction(state.transactions[0].id,{ splits:[{ id:'split',categoryId:'cat-salary-wages',amountPence:1234 }] },state.version)).toThrow();
  });
  it('rejects V1 and future backup schemas without fallback', () => {
    const backup=createLocalBackupPackage();
    for(const dataSchemaVersion of [undefined,1,3,99]) expect(()=>preflightLocalRestore({ ...backup,dataSchemaVersion })).toThrow(/schema/);
    for(const dataSchemaVersion of [undefined,1,3,99]) expect(()=>preflightLocalRestore({ ...backup,state:{...backup.state,dataSchemaVersion} })).toThrow(/schema/);
  });
});
