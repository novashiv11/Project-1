/* LifeOS v4 home: "Today" — at most 5 things, ranked, plus quick-add and the open Cases strip.
   1 overdue deadlines + case actions · 2 due in 7 days · 3 one Needs-info question · 4 active project's next step · 5 one decide-for-me. */
(()=>{
const css=`
.td-list{display:grid;gap:8px}
.td-row{display:flex;gap:10px;align-items:center;padding:12px 12px 12px 14px;border:1px solid var(--line);border-radius:18px;background:var(--card);min-width:0}
.td-row.hot{border-color:#e5484d;box-shadow:inset 3px 0 0 #e5484d}
.td-main{flex:1;min-width:0;display:grid;gap:2px;text-align:left;background:none;border:0;padding:0;color:inherit;font:inherit}
.td-main b{font:600 15px var(--body);overflow-wrap:anywhere}.td-main small{color:var(--muted);font:12px var(--mono)}
.td-ok{flex:none;width:40px;height:40px;border-radius:12px;background:var(--chip);font-size:18px}
.td-q{display:grid;gap:8px;padding:12px 14px;border:1.5px dashed var(--line);border-radius:18px}
.td-q input{min-width:0;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font:15px var(--body)}
.td-strip{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.td-case{flex:none;max-width:72%;display:grid;gap:2px;text-align:left;padding:10px 12px;border-radius:14px;background:var(--chip);color:var(--fg)}
.td-case small{color:var(--muted);font:11px var(--mono)}
.td-empty{color:var(--muted);padding:6px 2px}`;
document.head.insertAdjacentHTML("beforeend",`<style>${css}</style>`);

const ICON={task:"✅",recurring:"🔁",deadline:"⏳",case:"⚖️",job:"🔧",project:"🚀",fact:"🧠",journal:"📓"};
const open=all=>all.filter(i=>!i.done&&!i.deleted_at);
const when=(it,today)=>{const n=daysLeft(it,today);return n<0?`${-n}d late`:n===0?"aaj":n===1?"kal":`${n} din`};

function rank(all,today){
  const v=open(all).map(R2.view), dated=v.filter(r=>r.due).sort((a,b)=>a.due.localeCompare(b.due));
  const rows=[];
  // 1 overdue deadlines and case actions (and anything else overdue)
  dated.filter(r=>daysLeft(r,today)<0).forEach(r=>rows.push({r,kind:"late"}));
  // 2 due in the next 7 days
  dated.filter(r=>{const n=daysLeft(r,today);return n>=0&&n<=7}).forEach(r=>rows.push({r,kind:"soon"}));
  // 3 one Needs-info question (a deadline without a known date)
  const q=v.find(r=>r.type==="deadline"&&!r.date_known&&!(settings.askedLater||[]).includes(r.id));
  if(q)rows.push({r:q,kind:"ask"});
  // 4 the one active project's next step
  const p=v.find(r=>r.type==="project"&&r.is_active&&r.next_step);
  if(p)rows.push({r:p,kind:"project"});
  // 5 decide for me: the oldest undated task → default "do it tomorrow"
  const d=v.filter(r=>r.type==="task"&&!r.due).sort((a,b)=>a.id-b.id)[0];
  if(d)rows.push({r:d,kind:"decide"});
  return rows.slice(0,5);
}
function caseLine(r,today){
  if(r.next_action_date&&daysLeft(r,today)<0&&r.waiting_on==="them")return `No reply from ${r.seller||"them"} · chase / escalate`;
  return r.next_action||"Next step?";
}
function row({r,kind},today){
  if(kind==="ask")return `<div class="td-q"><b>❓ ${esc(r.title)}: date kya hai?</b>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><input type="date" id="tdDate" data-td-date="${r.id}" aria-label="Date for ${esc(r.title)}"><button class="go" style="padding:10px 14px" data-td-setdate="${r.id}">Save</button><button class="linkbtn" data-td-later="${r.id}">Pata nahi</button></div></div>`;
  const hot=kind==="late", isCase=r.type==="case";
  const title=kind==="project"?`${r.title}: ${r.next_step}`:kind==="decide"?`Decide: "${r.title}"`:isCase?`${r.title}`:r.title;
  const sub=kind==="decide"?"Default: kal kar lo":isCase?`${caseLine(r,today)} · ${when(r,today)}`:kind==="project"?"Active project · next step":`${R2.TYPE_LABEL[r.type]} · ${when(r,today)}`;
  const act=kind==="decide"?`<button class="td-ok" data-td-tomorrow="${r.id}" aria-label="Kal ke liye set karo">⏭</button>`
    :isCase?`<button class="td-ok" data-td-case="${r.id}" aria-label="Open case">›</button>`
    :`<button class="td-ok" data-td-done="${r.id}" aria-label="Done: ${esc(r.title)}">✓</button>`;
  return `<div class="td-row${hot?" hot":""}"><button class="td-main" ${isCase?`data-td-case="${r.id}"`:""}><b>${ICON[r.type]||"•"} ${esc(title)}</b><small>${esc(sub)}</small></button>${act}</div>`;
}
function render2(all,today){
  const rows=rank(all,today), cases=open(all).map(R2.view).filter(r=>r.type==="case");
  const up=!R2.migrated&&items.size?`<button class="go" style="width:100%;padding:12px;margin-bottom:12px" data-v="migrate">⬆️ Upgrade to v4: records sort ho jayenge (1 min)</button>`:"";
  return `${up}<section><h2>Aaj · ${rows.length?`${rows.length} cheezein`:"sab clear"}</h2><div class="td-list">
    ${rows.length?rows.map(x=>row(x,today)).join(""):`<p class="td-empty">Kuch pending nahi 🌿 Upar likho ya 🎙 bolo.</p>`}</div></section>
    ${cases.length?`<section><h2>⚖️ Cases · ${cases.length} open</h2><div class="td-strip">${cases.map(c=>`<button class="td-case" data-td-case="${c.id}"><b>${esc(c.title)}</b><small>${esc(c.waiting_on==="them"?"waiting on them":"your move")}${c.next_action_date?` · ${esc(when(c,today))}`:""}</small></button>`).join("")}</div></section>`:""}
    <div class="acts"><button class="ex" data-v="jarvis">🧠 Jarvis se pucho</button>${EXTRA_VIEWS.cases?`<button class="ex" data-v="cases">⚖️ All cases</button>`:""}<button class="ex" data-v="today">☰ Full list</button></div>`;
}
document.addEventListener("click",async e=>{const b=e.target.closest&&e.target.closest("button");if(!b)return;
  if(b.dataset.tdDone){await complete(+b.dataset.tdDone);return}
  if(b.dataset.tdCase){const id=+b.dataset.tdCase;if(typeof window.openCase==="function")openCase(id);else{view="today";render()}return}
  if(b.dataset.tdTomorrow){const id=+b.dataset.tdTomorrow,it=items.get(id);if(!it)return;
    if(R2.migrated)await R2.update(id,{due_date:R2.addDays(R2.todayIso(),1)},"Kal ke liye ✓");else await change(id,Object.assign(clone(it),{due:R2.addDays(R2.todayIso(),1)}),"Kal ke liye ✓");return}
  if(b.dataset.tdSetdate){const id=+b.dataset.tdSetdate,v=(document.querySelector(`[data-td-date="${id}"]`)||{}).value;
    if(!v){toast("Date chuno pehle",false);return}
    if(R2.migrated)await R2.update(id,{date:v,date_known:true},"Date saved ✓");else await change(id,Object.assign(clone(items.get(id)),{due:v}),"Date saved ✓");return}
  if(b.dataset.tdLater){(settings.askedLater=settings.askedLater||[]).push(+b.dataset.tdLater);saveSettings();render();return}
});

window.EXTRA_VIEWS=window.EXTRA_VIEWS||{};
EXTRA_VIEWS.now={title:"Today",render:render2,mount(){},_test:{rank}};
})();
