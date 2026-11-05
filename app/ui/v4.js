/* LifeOS v4: one-time migration (classic items → typed records, reviewed before it runs) and the Trash.
   Needs app/ui/records.js (window.R2). Nothing is changed until the person taps Approve; the classic list stays saved as the backup. */
(()=>{
const css=`
.mg-row{display:grid;gap:6px;padding:12px;border:1px solid var(--line);border-radius:16px;background:var(--card);min-width:0}
.mg-from{font:12px var(--mono);color:var(--muted);overflow-wrap:anywhere}
.mg-to{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}
.mg-row select,.mg-row input[type=text]{min-width:0;width:100%;padding:9px 10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font:14px var(--body)}
.mg-flags{display:flex;flex-wrap:wrap;gap:6px}.mg-flag{font:600 11px var(--mono);padding:3px 8px;border-radius:99px;background:var(--chip);color:var(--muted)}
.mg-flag.warn{background:#ffe7c2;color:#7a4b00}.mg-row.skip{opacity:.45}
.mg-acts{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.tr-row{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);min-width:0}
.tr-row span{min-width:0;overflow-wrap:anywhere}`;
document.head.insertAdjacentHTML("beforeend",`<style>${css}</style>`);

const MIXED_RE=/;|\s\+\s|\s\/\s|,.*,.*,/;
let rows=null; // the review table: [{key, from, type, area, title, skip, flags}]

function flagsFor(r){
  const f=[];
  if(r.type==="fact"&&R2.PREF_RE.test(r.title))f.push(["→ settings",""]);
  if(r.type==="deadline"&&(!r.from.due||R2.UNKNOWN_RE.test(r.from.text)))f.push(["date unknown → Needs info","warn"]);
  if(MIXED_RE.test(r.title)&&r.title.length>30)f.push(["mixed? split it","warn"]);
  return f;
}
function buildRows(){
  rows=[...items.values()].sort((a,b)=>a.id-b.id).map(it=>{const t=R2.guessType(it);
    const r={key:"r"+it.id,from:it,type:t,area:R2.AREA_OF_DOMAIN[it.domain]||"home",title:it.text,skip:false};r.flags=flagsFor(r);return r});
}
const opt=(list,cur)=>list.map(([v,l])=>`<option value="${v}"${v===cur?" selected":""}>${esc(l)}</option>`).join("");

function viewMigrate(){
  if(R2.migrated)return `<section><h2>Upgrade done ✓</h2><p class="covers">Your records are typed now. The old list is kept as a backup on this phone.</p></section>`;
  if(!rows)buildRows();
  const n=rows.filter(r=>!r.skip).length, types=R2.TYPES.map(t=>[t,R2.TYPE_LABEL[t]]), areas=R2.AREAS2.map(a=>[a[0],a[2]+" "+a[1]]);
  return `<section><h2>Upgrade to v4 · check ${rows.length} items</h2>
    <p class="covers">Har item ko ek type milega (Task, Deadline, Case…). Galat lage toh badlo, mixed item ko Split karo, faltu ko Skip. Approve se pehle backup download hoga.</p>
    <div style="display:grid;gap:10px">${rows.map((r,i)=>`<div class="mg-row${r.skip?" skip":""}" data-mg="${i}">
      <div class="mg-from">${r.from.id?`#${r.from.id} · `:"new · "}${esc(r.from.text||"(split part)")}</div>
      <input type="text" data-mg-title="${i}" value="${esc(r.title)}" aria-label="Title">
      <div class="mg-to"><select data-mg-type="${i}" aria-label="Type">${opt(types,r.type)}</select><select data-mg-area="${i}" aria-label="Area">${opt(areas,r.area)}</select></div>
      ${r.flags.length?`<div class="mg-flags">${r.flags.map(([t,c])=>`<span class="mg-flag ${c}">${esc(t)}</span>`).join("")}</div>`:""}
      <div class="mg-acts"><button class="linkbtn" data-mg-split="${i}">✂︎ Split</button><button class="linkbtn" data-mg-skip="${i}">${r.skip?"↺ Keep":"✕ Skip"}</button></div></div>`).join("")}</div>
    <div class="acts" style="margin-top:14px"><button class="go" style="padding:12px 16px" data-mg-approve>Approve · ${n} records</button><button class="linkbtn" data-v="home">Baad mein</button></div></section>`;
}

// preference lines become settings instead of records
function absorbPreference(text){
  const m=text.match(/\bmax(?:imum)? ?(\d+) lines?\b/i); if(m)settings.max_lines=+m[1];
  if(/\bhinglish\b/i.test(text))settings.language="hinglish";
  if(/\b(decide for me|one recommendation)\b/i.test(text))settings.decision_style="one recommendation + default, then act";
  const ctx=(settings.lifeContext||"").trim();
  if(!ctx.toLowerCase().includes(text.toLowerCase()))settings.lifeContext=(ctx?ctx+"\n":"")+(/## How to help me/.test(ctx)?"":"## How to help me\n")+"- "+text;
}
async function approve(){
  if(typeof backupNow==="function")try{backupNow()}catch(e){}
  try{localStorage.setItem("lifeos.items.v1.backup",JSON.stringify([...items.values()]))}catch(e){}
  let next=Math.max(0,...items.keys())+1; const out=[];
  for(const r of rows){if(r.skip||!r.title.trim())continue;
    if(r.type==="fact"&&R2.PREF_RE.test(r.title)){absorbPreference(r.title.trim());continue}
    const base=Object.assign({},r.from.id?r.from:{created:new Date().toISOString().slice(0,19),done:false},{id:r.from.id||next++,text:r.title.trim(),area:r.area});
    delete base.type; out.push(R2.toLegacy(R2.toRecord(base,r.type)));}
  items.clear(); out.forEach(x=>items.set(x.id,x));
  R2.migrated=true; settings.v4At=new Date().toISOString().slice(0,10); saveSettings(); localBackend.save();
  rows=null; undoStack=[]; view=HOME; window.scrollTo(0,0); render(); toast(`Upgrade done ✓ ${out.length} records`,false);
}

document.addEventListener("input",e=>{const t=e.target;if(!rows)return;
  if(t.dataset.mgTitle!==undefined){const r=rows[+t.dataset.mgTitle];r.title=t.value}});
document.addEventListener("change",e=>{const t=e.target;if(!rows)return;
  if(t.dataset.mgType!==undefined){const r=rows[+t.dataset.mgType];r.type=t.value;r.flags=flagsFor(r);render()}
  if(t.dataset.mgArea!==undefined){rows[+t.dataset.mgArea].area=t.value}});
document.addEventListener("click",async e=>{const b=e.target.closest&&e.target.closest("button");if(!b)return;
  if(b.dataset.mgSplit!==undefined){const i=+b.dataset.mgSplit,r=rows[i];
    rows.splice(i+1,0,{key:r.key+"s"+Date.now(),from:{text:""},type:"task",area:r.area,title:"",skip:false,flags:[]});render();return}
  if(b.dataset.mgSkip!==undefined){const r=rows[+b.dataset.mgSkip];r.skip=!r.skip;render();return}
  if(b.hasAttribute("data-mg-approve")){await approve();return}
  if(b.dataset.trRestore){await R2.restore(+b.dataset.trRestore);toast("Restored ✓",false);return}
  if(b.dataset.trForget){R2.forget(+b.dataset.trForget);toast("Deleted for good",false);return}
});

const H=window.LIFEOS_HOOKS=window.LIFEOS_HOOKS||{};
// A brand-new phone (nothing saved yet) starts on v4 straight away.
(H.boot=H.boot||[]).push(()=>{if(!R2.migrated&&items.size===0){R2.migrated=true;localBackend.save()}});
// Me → Trash: deleted records stay 30 days.
(H.prefs=H.prefs||[]).push(()=>{if(!R2.migrated)return "";const t=[...R2.trash.values()].sort((a,b)=>(b.deleted_at||"").localeCompare(a.deleted_at||""));
  return `<div class="setup" id="trash"><b>🗑 Trash (${t.length})</b><span class="covers">Deleted things stay here 30 days.</span>
    ${t.length?t.slice(0,30).map(r=>`<div class="tr-row"><span>${esc(r.text)}</span><span style="display:flex;gap:6px;flex:none"><button class="linkbtn" data-tr-restore="${r.id}">Restore</button><button class="linkbtn" data-tr-forget="${r.id}">Delete now</button></span></div>`).join(""):""}</div>`});

window.EXTRA_VIEWS=window.EXTRA_VIEWS||{};
EXTRA_VIEWS.migrate={title:"Upgrade",render:viewMigrate,mount(){},_test:{buildRows,flagsFor,rows:()=>rows,approve}};
})();
