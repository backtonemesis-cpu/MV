import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createBlankLocalHousehold,saveLocalHousehold,loadLocalHousehold,LOCAL_STORAGE_KEY} from '../localStore';
import {previewReclassification,executeReclassification} from './reclassification';
import {financialIdentitySnapshot,executeCategoryCommand} from './management';
let raw:Map<string,string>;
beforeEach(()=>{raw=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>raw.get(k)??null,setItem:(k:string,v:string)=>raw.set(k,v)});const state=createBlankLocalHousehold();
 state.accounts=[{id:'account',name:'Synthetic',type:'current',currency:'GBP',startingBalancePence:100000,currentBalancePence:100000,ownerPerson:'Marius'}];
 state.plannedPayments=[{id:'bill',name:'Synthetic',amountPence:1234,month:'2027-01',accountId:'account',responsiblePerson:'Marius',categoryId:'cat-rent',status:'paid',actualTransactionId:'tx',includeInTransferPlan:true,createdAt:'2027-01-01',createdBy:'synthetic'}];
 state.transactions=[{id:'tx',description:'Synthetic',amountPence:1234,date:'2027-02-01',type:'expense',categoryId:'cat-rent',accountId:'account',payer:'Marius',isTransfer:false,isRepayment:false,isSavings:false,isRefund:false,plannedPaymentId:'bill',splits:[{id:'split',categoryId:'cat-rent',amountPence:1234}],createdAt:'2027-02-01',createdBy:'synthetic'}];
 state.monthlyCategoryBudgets=[{monthKey:'2027-01',categoryId:'cat-rent',budgetAmountPence:1000},{monthKey:'2027-01',categoryId:'cat-mortgage',budgetAmountPence:2000},{monthKey:'2027-02',categoryId:'cat-rent',budgetAmountPence:1500}];saveLocalHousehold(state);
});
describe('atomic classification-only correction',()=>{
 it('previews and merges every reference including budgets without changing money or links',()=>{
  const state=loadLocalHousehold(),before=financialIdentitySnapshot(state);
  const command={action:'merge' as const,sourceId:'cat-rent',destinationId:'cat-mortgage',budgetConflictPolicy:'sum' as const};
  const preview=previewReclassification(state,command);expect(preview.total).toBe(5);expect(preview.budgetConflicts).toEqual(['2027-01']);
  executeReclassification(command,state.version);const after=loadLocalHousehold();
  expect(financialIdentitySnapshot(after)).toBe(before);expect(after.transactions[0].categoryId).toBe('cat-mortgage');expect(after.transactions[0].splits![0].categoryId).toBe('cat-mortgage');expect(after.plannedPayments[0].categoryId).toBe('cat-mortgage');
  expect(after.monthlyCategoryBudgets.map(b=>b.budgetAmountPence)).toEqual([3000,1500]);
  expect(after.categories.find(c=>c.id==='cat-rent')?.supersededById).toBe('cat-mortgage');
  expect(()=>executeReclassification(command,after.version)).toThrow(/already merged/);
  expect(()=>executeCategoryCommand({action:'restore-category',id:'cat-rent'},after.version)).toThrow(/retired/);
 });
 it('requires an explicit budget conflict choice and rejects cross-scope and protected targets atomically',()=>{
  const before=raw.get(LOCAL_STORAGE_KEY);
  expect(()=>executeReclassification({action:'merge',sourceId:'cat-rent',destinationId:'cat-mortgage'},1)).toThrow(/conflicts/);
  for(const destinationId of ['cat-salary-wages','cat-transfer','cat-rent'])expect(()=>executeReclassification({action:'merge',sourceId:'cat-rent',destinationId},1)).toThrow();
  expect(raw.get(LOCAL_STORAGE_KEY)).toBe(before);
 });
 it('bulk correction follows linked evidence across periods and leaves budgets and source identity intact',()=>{
  const state=loadLocalHousehold();const before=financialIdentitySnapshot(state);
  const command={action:'recategorise' as const,sourceId:'cat-rent',destinationId:'cat-mortgage',monthKey:'2027-01'};
  expect(previewReclassification(state,command).transactions).toEqual(['tx']);
  executeReclassification(command,state.version);const after=loadLocalHousehold();expect(financialIdentitySnapshot(after)).toBe(before);expect(after.monthlyCategoryBudgets).toEqual(state.monthlyCategoryBudgets);expect(after.categories).toEqual(state.categories);
  expect(()=>executeReclassification(command,after.version)).toThrow(/No matching/);
 });
 it('rewrites planned income and every linked receipt once',()=>{
  const state=createBlankLocalHousehold();state.plannedIncomes=[{id:'income',name:'Synthetic',expectedAmountPence:100,month:'2027-01',sourcePerson:'Marius',accountId:'account',categoryId:'cat-interest',status:'expected',createdAt:'2027-01-01',createdBy:'synthetic'}];saveLocalHousehold(state);
  executeReclassification({action:'merge',sourceId:'cat-interest',destinationId:'cat-other-income'},1);
  expect(loadLocalHousehold().plannedIncomes![0].categoryId).toBe('cat-other-income');
 });
});
