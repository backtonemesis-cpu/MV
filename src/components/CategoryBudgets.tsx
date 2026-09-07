import React,{useState} from 'react';
import type {HouseholdData} from '../types';
import {setMonthlyCategoryBudget} from '../categories/budgets';
import {createCategoryEligibility} from '../utils/categoryEligibility';
import {parseToPence,formatPence,formatPenceToPoundsInput} from '../utils/currency';
import {localDateInputValue} from '../utils/dateInput';
import {MonthPicker} from './MonthPicker';
import {MoneyInput} from './MoneyInput';
import {useModalAccessibility} from '../utils/modalAccessibility';
const button='min-h-11 px-3 border border-muted rounded-md text-sm text-main disabled:opacity-50';
export function CategoryBudgets({household,onChanged}:{household:HouseholdData;onChanged:()=>Promise<void>}){
 const [open,setOpen]=useState(false),[month,setMonth]=useState(localDateInputValue().slice(0,7)),[categoryId,setCategoryId]=useState(''),[amount,setAmount]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[version,setVersion]=useState(household.version);
 const close=()=>{if(!busy)setOpen(false);};const ref=useModalAccessibility<HTMLDivElement>(open,close);
 const existing=household.monthlyCategoryBudgets.filter(b=>b.monthKey===month);
 const choose=(id:string,period=month)=>{setCategoryId(id);setAmount(formatPenceToPoundsInput(household.monthlyCategoryBudgets.find(b=>b.monthKey===period&&b.categoryId===id)?.budgetAmountPence??0));setVersion(household.version);};
 return <><button className={button} onClick={()=>{setVersion(household.version);setError('');setOpen(true);}}>Monthly category budgets</button>
 {open&&<div className="mv-modal-backdrop"><div ref={ref} className="mv-modal-card" role="dialog" aria-modal="true" aria-labelledby="category-budgets-title" tabIndex={-1}>
  <div className="mv-modal-header"><h2 id="category-budgets-title" className="text-main font-semibold">Monthly category budgets</h2><button className={button} disabled={busy} onClick={close}>Close</button></div>
  <form className="flex min-h-0 flex-1 flex-col" onSubmit={async e=>{e.preventDefault();setError('');setBusy(true);try{if(!amount.trim())throw new Error('Enter a budget amount.');setMonthlyCategoryBudget(month,categoryId,parseToPence(amount),version);await onChanged();setOpen(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
   <div className="mv-modal-body space-y-3">
    <MonthPicker ariaLabel="Category budget month" value={month} onChange={value=>{setMonth(value);choose(categoryId,value);}}/>
    <label className="block text-sm">Category<select className="w-full min-h-11 border border-muted rounded-md bg-surface px-3" required value={categoryId} onChange={e=>choose(e.target.value)}><option value="">Choose category</option>{createCategoryEligibility(household.categoryGroups).getBillCategoryOptions(household.categories).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="block text-sm">Budget (£)<MoneyInput aria-label="Category budget amount" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
    <p className="text-sm text-muted">This changes {month} only. Other months retain their budgets.</p>
    {!!existing.length&&<ul className="space-y-1 text-sm">{existing.map(b=><li key={b.categoryId} className="flex justify-between gap-3"><span>{household.categories.find(c=>c.id===b.categoryId)?.name??'Invalid category'}</span><span>{formatPence(b.budgetAmountPence)}</span></li>)}</ul>}
    {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
   </div>
   <div className="mv-modal-footer flex gap-2 justify-end"><button className={button} type="button" disabled={busy} onClick={close}>Cancel</button><button className={button} disabled={busy}>{busy?'Saving…':'Save budget'}</button></div>
  </form>
 </div></div>}</>;
}
