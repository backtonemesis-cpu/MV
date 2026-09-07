import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createBlankLocalHousehold,saveLocalHousehold,loadLocalHousehold} from '../localStore';
import {setMonthlyCategoryBudget,categoryBudgetSpending} from './budgets';
import {executeCategoryCommand,financialIdentitySnapshot} from './management';
import type {Transaction} from '../types';
beforeEach(()=>{const raw=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>raw.get(k)??null,setItem:(k:string,v:string)=>raw.set(k,v)});saveLocalHousehold(createBlankLocalHousehold());});
describe('period-specific category budgets',()=>{
 it('changes one month only and retains historical budgets when category is archived',()=>{
  const before=financialIdentitySnapshot(loadLocalHousehold());
  setMonthlyCategoryBudget('2027-09','cat-rent',12345,1);setMonthlyCategoryBudget('2027-10','cat-rent',23456,2);setMonthlyCategoryBudget('2027-10','cat-rent',34567,3);
  executeCategoryCommand({action:'archive-category',id:'cat-rent'},4);
  const state=loadLocalHousehold();expect(state.monthlyCategoryBudgets.map(b=>b.budgetAmountPence)).toEqual([12345,34567]);expect(financialIdentitySnapshot(state)).toBe(before);
 });
 it('rejects fractional, negative, unsafe and incompatible budget values',()=>{
  for(const pence of [0.1,-1,Number.MAX_SAFE_INTEGER+1])expect(()=>setMonthlyCategoryBudget('2027-01','cat-rent',pence,1)).toThrow();
  expect(()=>setMonthlyCategoryBudget('2027-13','cat-rent',1,1)).toThrow();
  expect(()=>setMonthlyCategoryBudget('2027-01','cat-salary-wages',1,1)).toThrow();
 });
 it('attributes splits once and handles refunds independently of input ordering',()=>{
  const base={id:'tx',description:'Synthetic',amountPence:100,type:'expense',categoryId:'cat-rent',date:'2027-01-01',accountId:'a',payer:'Marius',isTransfer:false,isRepayment:false,isSavings:false,isRefund:false,createdAt:'2027-01-01',createdBy:'synthetic'} as Transaction;
  const expense={...base,splits:[{id:'a',categoryId:'cat-groceries',amountPence:60},{id:'b',categoryId:'cat-rent',amountPence:40}]};
  const refund={...base,id:'refund',type:'refund' as const,isRefund:true,categoryId:'cat-groceries',amountPence:10};
  const transfer={...base,id:'transfer',type:'transfer' as const,isTransfer:true,amountPence:9000};
  const a=categoryBudgetSpending([expense,refund,transfer]);const b=categoryBudgetSpending([refund,transfer,expense]);expect([...a].sort()).toEqual([...b].sort());expect(a.get('cat-groceries')).toBe(50);expect(a.get('cat-rent')).toBe(40);expect([...a.values()].reduce((n,v)=>n+v,0)).toBe(90);
  expect(categoryBudgetSpending([{...refund,amountPence:1000}]).get('cat-groceries')).toBe(0);
 });
});
