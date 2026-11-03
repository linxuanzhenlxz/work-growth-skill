// Read-only work monitoring helpers. Node.js 18+, standard library only.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

const closed = new Set(['closed']);
const statuses = new Set(['planned', 'active', 'waiting', 'paused', 'closed']);
const dateFields = ['due', 'forecast', 'nextCheck', 'executeOn', 'reviewOn', 'promisedBy'];
export function validDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function brief(data, today, mode = 'morning') {
  if (!validDate(today)) throw new Error('today must be a real YYYY-MM-DD date');
  if (!['morning', 'close'].includes(mode)) throw new Error('mode must be morning or close');
  if (!Array.isArray(data.tasks)) throw new Error('tasks must be an array');
  if (!data.timezone) throw new Error('timezone is required');
  new Intl.DateTimeFormat('en', {timeZone: data.timezone}).format();
  const out = { date: today, mode, timezone: data.timezone, sourceAsOf: data.sourceAsOf ?? null,
    overdue: [], dueToday: [], forecastDue: [], checksDue: [], workDue: [], waiting: [],
    pausedReview: [], missingNextDate: [], syncPending: [], completionUnconfirmed: [],
    validationErrors: [], notes: [] };
  const seen = new Set();
  for (const t of data.tasks) {
    if (!t || typeof t !== 'object' || !t.id || !t.title || !statuses.has(t.status)) {
      out.validationErrors.push({id:t?.id ?? null, error:'id, title and valid status required'}); continue;
    }
    if (seen.has(t.id)) { out.validationErrors.push({id:t.id,error:'duplicate task ID'}); continue; }
    seen.add(t.id);
    const item = {id:t.id, title:t.title, nextAction:t.nextAction ?? null, owner:t.owner ?? null};
    const badDates = dateFields.filter(k => t[k] != null && !validDate(t[k]));
    for (const field of badDates) out.validationErrors.push({id:t.id,error:'invalid date-only field',field,value:t[field]});
    const ok = k => t[k] != null && !badDates.includes(k);
    if (t.syncPending) out.syncPending.push(item);
    if (closed.has(t.status)) {
      if (!t.completionEvidence) out.validationErrors.push({id:t.id,error:'closed without completion evidence'});
      continue;
    }
    if (t.status === 'paused') {
      if (ok('reviewOn') && t.reviewOn <= today) out.pausedReview.push(item);
      if (!ok('reviewOn') && !t.resumeCondition) out.validationErrors.push({id:t.id,error:'paused without review date or resume condition'});
      continue;
    }
    if (!t.nextAction || !t.owner) out.validationErrors.push({id:t.id,error:'open task missing next action or owner'});
    if (!ok('nextCheck') && !ok('executeOn')) out.missingNextDate.push(item);
    if (ok('due') && t.due < today) out.overdue.push({...item,due:t.due});
    if (ok('due') && t.due === today) out.dueToday.push({...item,due:t.due});
    if (ok('forecast') && t.forecast <= today) out.forecastDue.push({...item,forecast:t.forecast});
    if (ok('nextCheck') && t.nextCheck <= today) out.checksDue.push({...item,nextCheck:t.nextCheck});
    if (ok('executeOn') && t.executeOn <= today) out.workDue.push({...item,executeOn:t.executeOn});
    if (t.status === 'waiting') out.waiting.push({...item,waitingFor:t.waitingFor ?? null,
      promisedBy:t.promisedBy ?? null, nextCheck:t.nextCheck ?? null,
      attention: (ok('nextCheck') && t.nextCheck <= today) || (ok('promisedBy') && t.promisedBy <= today) || (ok('due') && t.due <= today)});
    if (mode === 'close' && ['due','forecast','executeOn'].some(k => ok(k) && t[k] <= today)) out.completionUnconfirmed.push(item);
  }
  out.notes.push('Read-only date-level queues. File changes and planned dates do not confirm completion.');
  if (!out.sourceAsOf) out.notes.push('Source freshness unknown.');
  return out;
}
const ignoredName = name => name === '.git' || name === 'node_modules' || name.startsWith('~$');
export async function snapshot(root) {
  root = await fs.realpath(root);
  if (!(await fs.stat(root)).isDirectory()) throw new Error('root must be a directory');
  const result = {version:1, root, checkedAt:new Date().toISOString(), complete:true, files:[], skipped:[], errors:[]};
  async function walk(dir) {
    let entries;
    try { entries = await fs.readdir(dir, {withFileTypes:true}); }
    catch (e) { result.complete=false; result.errors.push({path:path.relative(root,dir).replaceAll('\\','/'),code:e.code}); return; }
    entries.sort((a,b)=>a.name.localeCompare(b.name));
    for (const e of entries) {
      const full = path.join(dir,e.name), rel = path.relative(root,full).replaceAll('\\','/');
      if (ignoredName(e.name)) { result.skipped.push({path:rel,reason:'excluded'}); continue; }
      try {
        const before = await fs.lstat(full);
        if (before.isSymbolicLink()) { result.skipped.push({path:rel,reason:'symlink'}); continue; }
        if (before.isDirectory()) { await walk(full); continue; }
        if (!before.isFile()) { result.skipped.push({path:rel,reason:'not a regular file'}); continue; }
        const hash = crypto.createHash('sha256');
        const handle = await fs.open(full, 'r');
        try {
          for await (const chunk of handle.createReadStream({autoClose:false})) hash.update(chunk);
        } finally { await handle.close(); }
        const after = await fs.lstat(full);
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || before.ino !== after.ino) {
          result.complete=false; result.errors.push({path:rel,code:'CHANGED_DURING_READ'}); continue;
        }
        result.files.push({path:rel,size:after.size,modifiedUtc:after.mtime.toISOString(),sha256:hash.digest('hex')});
      } catch (err) { result.complete=false; result.errors.push({path:rel,code:err.code ?? 'READ_ERROR'}); }
    }
  }
  await walk(root);
  return result;
}
function validateSnapshot(s) {
  if (!s || s.version !== 1 || typeof s.complete !== 'boolean' || typeof s.root !== 'string' || !s.checkedAt || !Array.isArray(s.files)) throw new Error('unsupported snapshot');
  const seen = new Set();
  for (const f of s.files) {
    if (!f.path || !f.sha256 || seen.has(f.path)) throw new Error('invalid/duplicate snapshot entry');
    seen.add(f.path);
  }
}
export function diff(previous, current) {
  validateSnapshot(current);
  if (previous === null) return {baselineOnly:true, added:[],changed:[],missing:[],unverifiedMissing:[],unchanged:[],complete:current.complete,
    note:'Initial baseline; no claim that existing files are new.'};
  validateSnapshot(previous);
  if (previous.root !== current.root) throw new Error('snapshot roots differ');
  if (!previous.complete) throw new Error('Use the last complete snapshot as the baseline');
  const old = new Map(previous.files.map(f=>[f.path,f])), now = new Map(current.files.map(f=>[f.path,f]));
  const result={baselineOnly:false,from:previous.checkedAt,to:current.checkedAt,added:[],changed:[],missing:[],unverifiedMissing:[],unchanged:[],complete:current.complete};
  for (const [p,f] of now) {
    if (!old.has(p)) result.added.push(p);
    else if (old.get(p).sha256 !== f.sha256) result.changed.push(p);
    else result.unchanged.push(p);
  }
  for (const p of old.keys()) if (!now.has(p)) (current.complete ? result.missing : result.unverifiedMissing).push(p);
  return result;
}
async function readJSON(file) { return JSON.parse(await fs.readFile(file,'utf8')); }
async function main(args) {
  const [cmd,...rest]=args;
  if (cmd==='snapshot' && rest.length===2) {
    const root=await fs.realpath(rest[0]);
    const parent=await fs.realpath(path.dirname(path.resolve(rest[1])));
    const dest=path.join(parent,path.basename(rest[1]));
    const rel=path.relative(root,dest);
    if (rel==='' || (!rel.startsWith('..'+path.sep) && rel!=='..' && !path.isAbsolute(rel))) throw new Error('Snapshot output must be outside monitored root');
    const s=await snapshot(root);
    await fs.writeFile(dest,JSON.stringify(s,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({output:dest,files:s.files.length,complete:s.complete,errors:s.errors.length}));
    if (!s.complete) process.exitCode=2;
  } else if (cmd==='diff' && rest.length===2) {
    console.log(JSON.stringify(diff(rest[0]==='-' ? null : await readJSON(rest[0]),await readJSON(rest[1])),null,2));
  } else if (cmd==='brief' && rest.length===3) {
    const report=brief(await readJSON(rest[0]),rest[1],rest[2]);
    console.log(JSON.stringify(report,null,2));
    if (report.validationErrors.length) process.exitCode=2;
  } else throw new Error('Usage: snapshot ROOT NEW_OUTPUT | diff PREVIOUS_OR_- CURRENT | brief TASKS YYYY-MM-DD morning|close');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
}
