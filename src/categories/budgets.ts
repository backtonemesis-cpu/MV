import type {HouseholdData,Transaction} from '../types';
import {mutateLocalHousehold} from '../localStore';
import {assertCategoryCatalogue,categoryScope} from './validation';
import {requireCategory,financialIdentitySnapshot} from './management';

export function setMonthlyCategoryBudget(monthKey:string,categoryId:string,budgetAmountPence:number,expectedVersion:number):void{
 mutateLocalHousehold(expectedVersion,{action:'monthly_category_budget_set',entityType:'category',entityId:categoryId,summary:`Set category budget for ${monthKey}`,details:{monthKey,categoryId,budgetAmountPence}},state=>{
  const before=financialIdentitySnapshot(state),category=requireCategory(state,categoryId);
  if(category.isArchived||category.isSystem||category.supersededById||categoryScope(state,category)!=='expense')throw new Error('Choose an active expense category.');
  if(!Number.isSafeInteger(budgetAmountPence)||budgetAmountPence<0)throw new Error('Budget must be non-negative integer pence.');
  const existing=state.monthlyCategoryBudgets.find(b=>b.monthKey===monthKey&&b.categoryId===categoryId);
  if(existing)existing.budgetAmountPence=budgetAmountPence;
  else state.monthlyCategoryBudgets.push({monthKey,categoryId,budgetAmountPence});
  assertCategoryCatalogue(state);
  if(financialIdentitySnapshot(state)!==before)throw new Error('Financial invariant failed.');
 });
}

/** Signed net spending for budget reporting; cashflow still reports refunds separately. */
export function categoryBudgetSpending(transactions:Transaction[]):Map<string,number>{
 const map=new Map<string,number>();
 for(const tx of transactions){
  if(tx.isTransfer||tx.isSavings||tx.isRepayment||tx.type==='transfer'||tx.type==='repayment')continue;
  const sign=tx.type==='refund'||tx.isRefund?-1:tx.type==='expense'?1:0;
  if(!sign)continue;
  const entries=tx.splits?.length?tx.splits:[{categoryId:tx.categoryId,amountPence:tx.amountPence}];
  for(const entry of entries){const total=(map.get(entry.categoryId)??0)+sign*entry.amountPence;if(!Number.isSafeInteger(total))throw new Error('Category budget spending exceeds safe integer pence.');map.set(entry.categoryId,total);}
 }
 for(const [categoryId,total] of map)map.set(categoryId,Math.max(0,total));
 return map;
}
