import {CategoryCorrection} from './CategoryCorrection';
import React,{useState} from 'react';
import type {HouseholdData} from '../types';
import {executeCategoryCommand,categoryReferences,type CategoryCommand} from '../categories/management';
import {categoryScope} from '../categories/validation';
import {useModalAccessibility} from '../utils/modalAccessibility';

type Editor={kind:'category'|'group';id?:string;name:string;groupId:string;scope:'expense'|'income';sortOrder:number};
interface Props {household:HouseholdData;onChanged:()=>Promise<void>}
const button='min-h-11 px-3 rounded-md border border-muted text-sm text-main disabled:opacity-50';
const field='w-full min-h-11 rounded-md border border-muted bg-surface px-3 text-main';

export function CategorySettings({household,onChanged}:Props){
 const [mode,setMode]=useState<'categories'|'groups'>('categories');
 const [search,setSearch]=useState('');const [archived,setArchived]=useState(false);
 const [editor,setEditor]=useState<Editor|null>(null);
 const [confirmation,setConfirmation]=useState<{command:CategoryCommand;name:string;references?:number;version:number}|null>(null);
 const [version,setVersion]=useState(household.version);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const close=()=>{if(!busy){setEditor(null);setConfirmation(null);setError('');}};
 const ref=useModalAccessibility<HTMLDivElement>(!!editor||!!confirmation,close);
 const perform=async(command:CategoryCommand,expectedVersion:number)=>{
  setBusy(true);setError('');try{executeCategoryCommand(command,expectedVersion);await onChanged();setEditor(null);setConfirmation(null);}
  catch(error){setError(error instanceof Error?error.message:'Category change failed.');}finally{setBusy(false);}
 };
 const begin=(value:Editor)=>{setVersion(household.version);setError('');setEditor(value);};
 const confirm=(command:CategoryCommand,name:string,references?:number)=>{setError('');setConfirmation({command,name,references,version:household.version});};
 const groups=[...household.categoryGroups].filter(g=>!g.isSystem).sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name));
 return <section aria-label="Category management" className="space-y-3">
  <div className="flex flex-wrap gap-2">
   <button className={button} aria-pressed={mode==='categories'} onClick={()=>setMode('categories')}>Categories</button>
   <button className={button} aria-pressed={mode==='groups'} onClick={()=>setMode('groups')}>Groups</button>
   <button className={button} onClick={()=>begin({kind:mode==='categories'?'category':'group',name:'',groupId:'',scope:'expense',sortOrder:groups.length})}>Add {mode==='categories'?'category':'group'}</button>
  </div>
  <div className="flex flex-wrap items-center gap-3">
   <input className={field+' sm:max-w-xs'} aria-label="Search categories and groups" placeholder="Search" value={search} onChange={e=>setSearch(e.target.value)}/>
   <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>Show archived</label>
  </div>
  {mode==='categories'?groups.map(group=>{
   const categories=household.categories.filter(c=>c.groupId===group.id&&(archived||!c.isArchived)&&c.name.toLocaleLowerCase('en-GB').includes(search.toLocaleLowerCase('en-GB'))).sort((a,b)=>a.sortOrder-b.sortOrder||a.name.localeCompare(b.name));
   return categories.length?<div key={group.id} className="rounded-lg border border-muted p-3">
    <h3 className="text-sm font-semibold text-main mb-2">{group.name} <span className="text-muted font-normal">· {group.scope}</span></h3>
    {categories.map(category=>{const count=categoryReferences(household,category.id).total;return <div key={category.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-muted py-2">
     <div className="min-w-0"><span className="text-sm text-main break-words">{category.name}</span><span className="text-xs text-muted ml-2">{category.supersededById?'Merged':category.isArchived?'Archived':`${count} references`}</span></div>
     {!category.isProtected&&!category.supersededById&&<div className="flex flex-wrap gap-2">
      <button className={button} aria-label={`Edit ${category.name}`} onClick={()=>begin({kind:'category',id:category.id,name:category.name,groupId:category.groupId,scope:categoryScope(household,category) as 'expense'|'income',sortOrder:category.sortOrder})}>Edit</button>
      <button className={button} aria-label={`${category.isArchived?'Restore':'Archive'} ${category.name}`} onClick={()=>confirm({action:category.isArchived?'restore-category':'archive-category',id:category.id},category.name,count)}>{category.isArchived?'Restore':'Archive'}</button>
      {count===0&&<button className={button} aria-label={`Delete ${category.name}`} onClick={()=>confirm({action:'delete-category',id:category.id},category.name,0)}>Delete unused</button>}
     </div>}
    </div>})}
   </div>:null;
  }):groups.filter(g=>(archived||!g.isArchived)&&g.name.toLowerCase().includes(search.toLowerCase())).map(group=><div key={group.id} className="flex flex-wrap items-center justify-between gap-2 border border-muted rounded-lg p-3">
   <span className="text-sm text-main">{group.name} · {group.scope}{group.isArchived?' · Archived':''}</span>
   <div className="flex flex-wrap gap-2">
    <button className={button} aria-label={`Edit ${group.name} group`} onClick={()=>begin({kind:'group',id:group.id,name:group.name,groupId:'',scope:group.scope as 'expense'|'income',sortOrder:group.sortOrder})}>Edit</button>
    {!group.isProtected&&<><button className={button} onClick={()=>confirm({action:group.isArchived?'restore-group':'archive-group',id:group.id},group.name)}>{group.isArchived?'Restore':'Archive'}</button><button className={button} onClick={()=>confirm({action:'delete-group',id:group.id},group.name)}>Delete empty</button></>}
   </div>
  </div>)}
  <CategoryCorrection household={household} onChanged={onChanged}/>
  <p className="text-xs text-muted">Used categories can be archived. System classifications are protected.</p>
  {(editor||confirmation)&&<div className="mv-modal-backdrop"><div ref={ref} className="mv-modal-card" role="dialog" aria-modal="true" aria-labelledby="category-dialog-title" tabIndex={-1}>
   <div className="mv-modal-header"><h2 id="category-dialog-title" className="font-semibold text-main">{editor?`${editor.id?'Edit':'Add'} ${editor.kind}`:`Confirm ${confirmation!.command.action.replaceAll('-',' ')}`}</h2><button type="button" className={button} onClick={close} disabled={busy} aria-label="Close category dialog">Close</button></div>
   <form onSubmit={e=>{e.preventDefault();if(confirmation){void perform(confirmation.command,confirmation.version);return;}if(!editor)return;
    const command:CategoryCommand=editor.kind==='category'?(editor.id?{action:'edit-category',id:editor.id,name:editor.name,groupId:editor.groupId}:{action:'add-category',name:editor.name,groupId:editor.groupId}):(editor.id?{action:'edit-group',id:editor.id,name:editor.name,sortOrder:editor.sortOrder}:{action:'add-group',name:editor.name,scope:editor.scope});void perform(command,version);
   }} className="flex min-h-0 flex-1 flex-col">
    <div className="mv-modal-body space-y-3">
     {editor?<>
      <label className="block text-sm">Name<input className={field} value={editor.name} maxLength={80} required onChange={e=>setEditor({...editor,name:e.target.value})}/></label>
      {editor.kind==='category'?<label className="block text-sm">Group<select className={field} required value={editor.groupId} onChange={e=>setEditor({...editor,groupId:e.target.value})}><option value="">Choose group</option>{groups.filter(g=>!g.isArchived&&(!editor.id||g.scope===editor.scope)).map(g=><option key={g.id} value={g.id}>{g.name} · {g.scope}</option>)}</select></label>:<>
       {!editor.id&&<label className="block text-sm">Scope<select className={field} value={editor.scope} onChange={e=>setEditor({...editor,scope:e.target.value as 'expense'|'income'})}><option value="expense">Expense</option><option value="income">Income</option></select></label>}
       {editor.id&&<label className="block text-sm">Display order<input className={field} type="number" min="0" step="1" value={editor.sortOrder} onChange={e=>setEditor({...editor,sortOrder:Number(e.target.value)})}/></label>}
      </>}
      {editor.id&&<p className="text-sm text-muted">Renaming or moving updates the labels and grouping used by historical reports.</p>}
     </>:<p className="text-sm text-main">{confirmation!.name}{confirmation!.references!==undefined?` · ${confirmation!.references} references`:''}. {confirmation!.command.action.startsWith('delete')?'Permanently delete this unused identity?':'Apply this change?'}</p>}
     {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
    <div className="mv-modal-footer flex gap-2 justify-end"><button type="button" className={button} onClick={close} disabled={busy}>Cancel</button><button className={button+' bg-accent text-on-accent'} disabled={busy}>{busy?'Saving…':confirmation?'Confirm':'Save'}</button></div>
   </form>
  </div></div>}
 </section>;
}
