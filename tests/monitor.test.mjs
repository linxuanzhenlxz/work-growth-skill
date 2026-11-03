import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {brief,snapshot,diff,validDate} from '../scripts/monitor.mjs';
const base = task => ({timezone:'Europe/Berlin',tasks:[{id:'A',title:'Report',status:'active',owner:'Me',nextAction:'Review',...task}]});
test('deadline and check are independent',()=>{
 const r=brief(base({due:'2026-11-06',nextCheck:'2026-11-03'}),'2026-11-03');
 assert.equal(r.checksDue.length,1);assert.equal(r.dueToday.length,0);assert.equal(r.overdue.length,0);
});
test('closed sending does not close collection or create repeat reminders',()=>{
 const d=base({status:'closed',completionEvidence:'User confirms',due:'2026-11-02'});
 d.tasks.push({id:'B',title:'Collect',status:'waiting',owner:'Me',nextAction:'Ask',nextCheck:'2026-11-03'});
 const r=brief(d,'2026-11-03');assert.deepEqual(r.checksDue.map(x=>x.id),['B']);assert.equal(r.overdue.length,0);
});
test('waiting needs a next date even if a deadline exists',()=>{
 const r=brief(base({status:'waiting',due:'2026-11-06'}),'2026-11-03');assert.equal(r.missingNextDate.length,1);
});
test('close reports uncertainty without mutating or rolling deadline',()=>{
 const d=base({due:'2026-11-02',executeOn:'2026-11-03'}),copy=JSON.stringify(d);
 const r=brief(d,'2026-11-03','close');assert.equal(r.completionUnconfirmed.length,1);assert.equal(r.overdue[0].due,'2026-11-02');assert.equal(JSON.stringify(d),copy);
});
test('new occurrence remains open after previous closes',()=>{
 const d=base({id:'A/old',status:'closed',completionEvidence:'confirmed'});
 d.tasks.push({id:'A/new',title:'New',status:'active',owner:'Me',nextAction:'Process',executeOn:'2026-11-03'});
 assert.deepEqual(brief(d,'2026-11-03').workDue.map(x=>x.id),['A/new']);
});
test('paused remains out of action queue, missing review contract flagged',()=>{
 const r=brief(base({status:'paused',due:'2026-11-01'}),'2026-11-03');assert.equal(r.overdue.length,0);assert.equal(r.validationErrors.length,1);
});
test('invalid dates, exact timestamps and duplicate IDs are rejected explicitly',()=>{
 assert.equal(validDate('2026-02-30'),false);
 const d=base({due:'2026-11-03T09:00:00+01:00'});d.tasks.push({...d.tasks[0]});
 assert.equal(brief(d,'2026-11-03').validationErrors.length,2);
});
test('baseline never calls existing files new; incomplete scan does not claim deletion',()=>{
 const s={version:1,root:'fixture',checkedAt:'2026-11-02T00:00:00Z',complete:true,files:[{path:'a',sha256:'x'}]};
 assert.equal(diff(null,s).added.length,0);
 const r=diff(s,{...s,complete:false,files:[]});assert.deepEqual(r.unverifiedMissing,['a']);assert.equal(r.missing.length,0);
 assert.throws(()=>diff({...s,complete:false},s));
});
test('content hash detects same-size changes, ignores metadata-only changes',()=>{
 const s={version:1,root:'fixture',checkedAt:'x',complete:true,files:[{path:'a',sha256:'x',size:1}]};
 assert.deepEqual(diff(s,{...s,files:[{path:'a',sha256:'y',size:1}]}).changed,['a']);
 assert.deepEqual(diff(s,{...s,files:[{path:'a',sha256:'x',size:1,modifiedUtc:'later'}]}).unchanged,['a']);
});
test('repeat brief is deterministic; closed pending sync stays visible only as sync',()=>{
 const d=base({status:'closed',completionEvidence:'confirmed',syncPending:true,nextCheck:'2026-11-03'});
 assert.deepEqual(brief(d,'2026-11-03'),brief(d,'2026-11-03'));
 const r=brief(d,'2026-11-03');assert.equal(r.syncPending.length,1);assert.equal(r.checksDue.length,0);
});
test('real directory scan and CLI protect originals and refuse output overwrite',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'work-growth-test-'));
 try {
  const root=path.join(tmp,'source');await fs.mkdir(root);await fs.writeFile(path.join(root,'a.txt'),'one');
  await fs.writeFile(path.join(root,'~$locked.xlsx'),'lock');
  const first=await snapshot(root);assert.equal(first.files.length,1);assert.equal(first.skipped.length,1);
  await fs.writeFile(path.join(root,'a.txt'),'two');const second=await snapshot(root);assert.deepEqual(diff(first,second).changed,['a.txt']);
  const cli=fileURLToPath(new URL('../scripts/monitor.mjs',import.meta.url)),out=path.join(tmp,'snapshot.json');
  const run=(...args)=>spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
  assert.equal(run('snapshot',root,out).status,0);
  assert.notEqual(run('snapshot',root,out).status,0);
  assert.notEqual(run('snapshot',root,path.join(root,'bad.json')).status,0);
  assert.equal(await fs.readFile(path.join(root,'a.txt'),'utf8'),'two');
 } finally {await fs.rm(tmp,{recursive:true,force:true});}
});
