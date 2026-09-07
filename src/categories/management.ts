import type { HouseholdData, Category, CategoryGroup } from '../types';
import { mutateLocalHousehold } from '../localStore';
import { assertCategoryCatalogue, categoryScope, validateCategoryName } from './validation';

export type CategoryCommand =
  | { action:'add-category'; name:string; groupId:string }
  | { action:'edit-category'; id:string; name:string; groupId:string }
  | { action:'archive-category' | 'restore-category' | 'delete-category'; id:string }
  | { action:'add-group'; name:string; scope:'expense'|'income' }
  | { action:'edit-group'; id:string; name:string; sortOrder:number }
  | { action:'archive-group' | 'restore-group' | 'delete-group'; id:string };

export function categoryReferences(state:HouseholdData, id:string) {
  const counts = {
    transactions: state.transactions.filter(t=>t.categoryId===id).length,
    splits: state.transactions.reduce((n,t)=>n+(t.splits?.filter(s=>s.categoryId===id).length??0),0),
    bills: state.plannedPayments.filter(p=>p.categoryId===id).length,
    incomes: (state.plannedIncomes??[]).filter(p=>p.categoryId===id).length,
    budgets: state.monthlyCategoryBudgets.filter(b=>b.categoryId===id).length,
    mergeLineage: state.categories.filter(c=>c.supersededById===id).length,
  };
  return { ...counts,total:Object.values(counts).reduce((n,v)=>n+v,0) };
}

export function requireCategory(state:HouseholdData,id:string):Category {
  const category=state.categories.find(c=>c.id===id);
  if(!category)throw new Error('Category not found.');
  return category;
}
export function requireGroup(state:HouseholdData,id:string):CategoryGroup {
  const group=state.categoryGroups.find(g=>g.id===id);
  if(!group)throw new Error('Group not found.');
  return group;
}
export function assertOrdinaryCategory(category:Category):void {
  if(category.isProtected||category.isSystem)throw new Error('System category is protected.');
  if(category.supersededById)throw new Error('Merged category identity is permanently retired.');
}

/** Classification-only snapshot: audit/revision and intended category references excluded. */
export function financialIdentitySnapshot(state:HouseholdData):string {
  const {categories,categoryGroups,monthlyCategoryBudgets,auditLogs,version,schemaStatus,...financial}=state;
  return JSON.stringify({ ...financial,
    transactions:state.transactions.map(({categoryId,splits,...t})=>({ ...t,...(splits?{splits:splits.map(({categoryId,...split})=>split)}:{}) })),
    plannedPayments:state.plannedPayments.map(({categoryId,...p})=>p),
    plannedIncomes:state.plannedIncomes?.map(({categoryId,...p})=>p),
  });
}

export function applyCategoryCommand(state:HouseholdData,command:CategoryCommand):void {
  const name='name' in command?command.name.trim():'';
  if('name' in command)validateCategoryName(name);
  switch(command.action){
    case 'add-category': {
      const group=requireGroup(state,command.groupId);
      if(group.isArchived||group.isSystem)throw new Error('Choose an active expense or income group.');
      state.categories.push({id:`cat-custom-${crypto.randomUUID()}`,name,groupId:group.id,sortOrder:state.categories.length,isArchived:false,isSystem:false,isProtected:false});
      break;
    }
    case 'edit-category': {
      const category=requireCategory(state,command.id);assertOrdinaryCategory(category);
      const group=requireGroup(state,command.groupId);
      if(group.isArchived||group.isSystem||group.scope!==categoryScope(state,category))throw new Error('Move requires an active group in the same financial scope.');
      category.name=name;category.groupId=group.id;break;
    }
    case 'archive-category': case 'restore-category': case 'delete-category': {
      const category=requireCategory(state,command.id);assertOrdinaryCategory(category);
      if(command.action==='delete-category'){
        if(categoryReferences(state,category.id).total)throw new Error('Category is referenced. Archive or merge it instead.');
        state.categories=state.categories.filter(c=>c.id!==category.id);
      }else{
        if(command.action==='restore-category'&&requireGroup(state,category.groupId).isArchived)throw new Error('Restore the group first.');
        category.isArchived=command.action==='archive-category';
      }break;
    }
    case 'add-group': {
      if(!['expense','income'].includes(command.scope))throw new Error('Invalid group scope.');
      state.categoryGroups.push({id:`group-custom-${crypto.randomUUID()}`,name,scope:command.scope,sortOrder:state.categoryGroups.length,isArchived:false,isSystem:false,isProtected:false});break;
    }
    case 'edit-group': {
      const group=requireGroup(state,command.id);
      if(group.isSystem)throw new Error('System group is protected.');
      if(!Number.isSafeInteger(command.sortOrder)||command.sortOrder<0)throw new Error('Invalid group order.');
      group.name=name;group.sortOrder=command.sortOrder;break;
    }
    case 'archive-group': case 'restore-group': case 'delete-group': {
      const group=requireGroup(state,command.id);
      if(group.isProtected||group.isSystem)throw new Error('Built-in group is protected.');
      if(state.categories.some(c=>c.groupId===group.id))throw new Error('Group must be empty, including archived categories.');
      if(command.action==='delete-group')state.categoryGroups=state.categoryGroups.filter(g=>g.id!==group.id);
      else group.isArchived=command.action==='archive-group';
      break;
    }
  }
  assertCategoryCatalogue(state);
}

export function executeCategoryCommand(command:CategoryCommand,expectedVersion:number):void {
  mutateLocalHousehold(expectedVersion,{action:command.action,entityType:'category',entityId:'id' in command?command.id:'catalogue',summary:command.action.replaceAll('-',' '),details:{command}},state=>{
    const before=financialIdentitySnapshot(state);
    applyCategoryCommand(state,command);
    if(financialIdentitySnapshot(state)!==before)throw new Error('Category operation changed financial fields. Nothing was saved.');
  });
}
