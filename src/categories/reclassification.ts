import type {HouseholdData} from '../types';
import {mutateLocalHousehold} from '../localStore';
import {assertCategoryCatalogue,categoryScope} from './validation';
import {requireCategory,assertOrdinaryCategory,financialIdentitySnapshot} from './management';

export interface ReclassificationCommand {
 action:'merge'|'recategorise';sourceId:string;destinationId:string;
 /** Bulk correction may be limited to one period. Merge always covers every period. */
 monthKey?:string;
 budgetConflictPolicy?:'sum'|'keep-source'|'keep-destination';
}
export function previewReclassification(state:HouseholdData,command:ReclassificationCommand){
 const source=requireCategory(state,command.sourceId),destination=requireCategory(state,command.destinationId);
 if(source.id===destination.id)throw new Error('Choose two different categories.');
 assertOrdinaryCategory(destination);
 if(destination.isArchived)throw new Error('Destination must be active.');
 if(source.supersededById)throw new Error('Source is already merged.');
 if(command.action==='merge')assertOrdinaryCategory(source);
 if(source.systemRole==='internal-transfer')throw new Error('Internal Transfer cannot be recategorised.');
 if(categoryScope(state,source)!==categoryScope(state,destination))throw new Error('Categories must have the same financial scope.');
 if(command.monthKey&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(command.monthKey))throw new Error('Invalid correction month.');
 if(command.action==='merge'&&command.monthKey)throw new Error('Merge must include every month.');
 const inPeriod=(month:string)=>!command.monthKey||month===command.monthKey;
 const transactions=new Set(state.transactions.filter(t=>t.categoryId===source.id&&inPeriod(t.date.slice(0,7))).map(t=>t.id));
 const bills=new Set(state.plannedPayments.filter(p=>p.categoryId===source.id&&inPeriod(p.month)).map(p=>p.id));
 const incomes=new Set((state.plannedIncomes??[]).filter(p=>p.categoryId===source.id&&inPeriod(p.month)).map(p=>p.id));
 // Reciprocal financial evidence follows the same classification. Never silently
 // override a third category; expose the conflict before any mutation.
 let changed=true;
 while(changed){changed=false;
  for(const t of state.transactions){
   const linked=!!((t.plannedPaymentId&&bills.has(t.plannedPaymentId))||(t.plannedIncomeId&&incomes.has(t.plannedIncomeId)));
   if(linked){
    if(t.categoryId!==source.id&&t.categoryId!==destination.id)throw new Error('Linked Activity categories differ. Review the linked records before bulk correction.');
    if(t.categoryId===source.id&&!transactions.has(t.id)){transactions.add(t.id);changed=true;}
   }
   if(transactions.has(t.id)){
    for(const [id,list,set] of [[t.plannedPaymentId,state.plannedPayments,bills],[t.plannedIncomeId,state.plannedIncomes??[],incomes]] as const){
     if(!id)continue;const plan=list.find(p=>p.id===id);
     if(!plan||(![source.id,destination.id].includes(plan.categoryId??'')))throw new Error('Linked planned category differs. Review before correction.');
     if(plan.categoryId===source.id&&!set.has(id)){set.add(id);changed=true;}
    }
   }
  }
 }
 const splits=state.transactions.flatMap(t=>(t.splits??[]).filter(s=>s.categoryId===source.id&&(inPeriod(t.date.slice(0,7))||transactions.has(t.id))).map(s=>({transactionId:t.id,splitId:s.id})));
 const budgets=command.action==='merge'?state.monthlyCategoryBudgets.filter(b=>b.categoryId===source.id):[];
 const budgetConflicts=budgets.filter(b=>state.monthlyCategoryBudgets.some(d=>d.categoryId===destination.id&&d.monthKey===b.monthKey)).map(b=>b.monthKey);
 return {transactions:[...transactions],bills:[...bills],incomes:[...incomes],splits,budgets:budgets.map(b=>b.monthKey),budgetConflicts,
  total:transactions.size+bills.size+incomes.size+splits.length+budgets.length};
}
export function executeReclassification(command:ReclassificationCommand,expectedVersion:number):void{
 const details: {command:ReclassificationCommand;preview?:ReturnType<typeof previewReclassification>}={command};
 mutateLocalHousehold(expectedVersion,{action:`category_${command.action}`,entityType:'category',entityId:command.sourceId,summary:`${command.action} category relationships`,details},state=>{
  const before=financialIdentitySnapshot(state);const preview=previewReclassification(state,command);
  if(command.action==='recategorise'&&preview.total===0)throw new Error('No matching category references remain.');
  if(preview.budgetConflicts.length&&!['sum','keep-source','keep-destination'].includes(command.budgetConflictPolicy??''))throw new Error('Choose how to handle monthly budget conflicts.');
  state.transactions.forEach(t=>{if(preview.transactions.includes(t.id))t.categoryId=command.destinationId;for(const split of t.splits??[])if(preview.splits.some(s=>s.transactionId===t.id&&s.splitId===split.id))split.categoryId=command.destinationId;});
  state.plannedPayments.forEach(p=>{if(preview.bills.includes(p.id))p.categoryId=command.destinationId;});
  state.plannedIncomes?.forEach(p=>{if(preview.incomes.includes(p.id))p.categoryId=command.destinationId;});
  if(command.action==='merge'){
   for(const source of state.monthlyCategoryBudgets.filter(b=>b.categoryId===command.sourceId)){
    const destination=state.monthlyCategoryBudgets.find(b=>b.categoryId===command.destinationId&&b.monthKey===source.monthKey);
    if(!destination)source.categoryId=command.destinationId;
    else if(command.budgetConflictPolicy==='sum'){
     const amount=source.budgetAmountPence+destination.budgetAmountPence;if(!Number.isSafeInteger(amount))throw new Error('Merged budget exceeds safe integer pence.');destination.budgetAmountPence=amount;
    }else if(command.budgetConflictPolicy==='keep-source')destination.budgetAmountPence=source.budgetAmountPence;
   }
   state.monthlyCategoryBudgets=state.monthlyCategoryBudgets.filter(b=>b.categoryId!==command.sourceId);
   const source=requireCategory(state,command.sourceId);source.isArchived=true;source.supersededById=command.destinationId;
  }
  assertCategoryCatalogue(state);
  if(financialIdentitySnapshot(state)!==before)throw new Error('Financial invariant failed. Nothing was saved.');
  details.preview=preview;
 });
}
