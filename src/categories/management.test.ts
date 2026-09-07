import {beforeEach,describe,expect,it,vi} from 'vitest';
import {createBlankLocalHousehold,saveLocalHousehold,loadLocalHousehold,LOCAL_STORAGE_KEY} from '../localStore';
import {executeCategoryCommand,categoryReferences,financialIdentitySnapshot} from './management';
let raw:Map<string,string>;
beforeEach(()=>{raw=new Map();vi.stubGlobal('localStorage',{getItem:(k:string)=>raw.get(k)??null,setItem:(k:string,v:string)=>raw.set(k,v)});saveLocalHousehold(createBlankLocalHousehold());});
describe('category lifecycle storage boundary',()=>{
 it('preserves identity and financial fields through rename, move, archive and restore',()=>{
  let state=loadLocalHousehold();const before=financialIdentitySnapshot(state);
  executeCategoryCommand({action:'edit-category',id:'cat-rent',name:'Tenancy',groupId:'group-financial-costs'},state.version);
  state=loadLocalHousehold();expect(state.categories.find(c=>c.id==='cat-rent')?.name).toBe('Tenancy');
  executeCategoryCommand({action:'archive-category',id:'cat-rent'},state.version);
  state=loadLocalHousehold();expect(state.categories.find(c=>c.id==='cat-rent')?.isArchived).toBe(true);
  executeCategoryCommand({action:'restore-category',id:'cat-rent'},state.version);
  state=loadLocalHousehold();expect(state.categories.find(c=>c.id==='cat-rent')?.isArchived).toBe(false);
  expect(financialIdentitySnapshot(state)).toBe(before);expect(state.auditLogs).toHaveLength(3);
 });
 it('uses generated durable IDs and blocks case/archived duplicates atomically',()=>{
  executeCategoryCommand({action:'add-category',name:'Custom Cost',groupId:'group-housing'},1);
  let state=loadLocalHousehold();const category=state.categories.find(c=>c.name==='Custom Cost')!;
  expect(category.id).toMatch(/^cat-custom-/);expect(category.id).not.toContain('Cost');
  executeCategoryCommand({action:'archive-category',id:category.id},state.version);state=loadLocalHousehold();
  const before=raw.get(LOCAL_STORAGE_KEY);
  expect(()=>executeCategoryCommand({action:'add-category',name:'custom cost',groupId:'group-transport'},state.version)).toThrow(/restore/i);
  expect(raw.get(LOCAL_STORAGE_KEY)).toBe(before);
 });
 it('blocks referenced deletion and permits unused deletion',()=>{
  const state=loadLocalHousehold();state.monthlyCategoryBudgets.push({monthKey:'2027-01',categoryId:'cat-rent',budgetAmountPence:1234});saveLocalHousehold(state);
  expect(categoryReferences(state,'cat-rent').budgets).toBe(1);
  expect(()=>executeCategoryCommand({action:'delete-category',id:'cat-rent'},state.version)).toThrow(/referenced/);
  executeCategoryCommand({action:'delete-category',id:'cat-mortgage'},state.version);
  expect(loadLocalHousehold().categories.some(c=>c.id==='cat-mortgage')).toBe(false);
 });
 it('protects system identities and rejects cross-scope moves',()=>{
  const before=raw.get(LOCAL_STORAGE_KEY);
  for(const action of ['archive-category','restore-category','delete-category'] as const)expect(()=>executeCategoryCommand({action,id:'cat-transfer'},1)).toThrow(/protected/);
  expect(()=>executeCategoryCommand({action:'edit-category',id:'cat-transfer',name:'Spending',groupId:'group-housing'},1)).toThrow();
  expect(()=>executeCategoryCommand({action:'edit-category',id:'cat-rent',name:'Rent',groupId:'group-income'},1)).toThrow(/scope/);
  expect(raw.get(LOCAL_STORAGE_KEY)).toBe(before);
 });
 it('manages empty custom groups safely and rejects deletion of non-empty groups',()=>{
  executeCategoryCommand({action:'add-group',name:'Custom',scope:'expense'},1);let state=loadLocalHousehold();const group=state.categoryGroups.find(g=>g.name==='Custom')!;
  executeCategoryCommand({action:'edit-group',id:group.id,name:'Renamed',sortOrder:0},state.version);state=loadLocalHousehold();
  executeCategoryCommand({action:'archive-group',id:group.id},state.version);state=loadLocalHousehold();
  executeCategoryCommand({action:'restore-group',id:group.id},state.version);state=loadLocalHousehold();
  executeCategoryCommand({action:'add-category',name:'Custom Cost',groupId:group.id},state.version);state=loadLocalHousehold();
  expect(()=>executeCategoryCommand({action:'delete-group',id:group.id},state.version)).toThrow(/empty/);
  executeCategoryCommand({action:'delete-category',id:state.categories.find(c=>c.name==='Custom Cost')!.id},state.version);state=loadLocalHousehold();
  executeCategoryCommand({action:'delete-group',id:group.id},state.version);
  expect(loadLocalHousehold().categoryGroups.some(g=>g.id===group.id)).toBe(false);
 });
 it('rejects stale mutations without a partial write',()=>{
  executeCategoryCommand({action:'archive-category',id:'cat-rent'},1);const before=raw.get(LOCAL_STORAGE_KEY);
  expect(()=>executeCategoryCommand({action:'delete-category',id:'cat-mortgage'},1)).toThrow(/conflict/);
  expect(raw.get(LOCAL_STORAGE_KEY)).toBe(before);
 });
});
