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
.td-empty{color:var(--muted);padding:6px 2px}
.td-streak{color:var(--muted);font:11px var(--mono)}
.td-tag{margin:0 0 4px;color:var(--muted);font-size:14px}
.td-money{width:100%;text-align:left;margin-top:12px;padding:14px;border-radius:18px;border:1px solid var(--line);background:var(--card);color:var(--fg);font:600 15px var(--body)}`;
document.head.insertAdjacentHTML("beforeend",`<style>${css}</style>`);

const ICON={task:"✅",recurring:"🔁",deadline:"⏳",case:"⚖️",job:"🔧",project:"🚀",fact:"🧠",journal:"📓"};
const open=all=>all.filter(i=>!i.done&&!i.deleted_at);
const when=(it,today)=>{const n=daysLeft(it,today);return n<0?`${-n}d late`:n===0?"aaj":n===1?"kal":`${n} din`};

// Home feed, max 5 cards, in this order (PM decision 2026-11-08):
// ⚖️ Chase (cases whose next step is due) → ⏳ Don't forget (late, next 7 days, renewal window open, one needs-info) → 💶 Claim (entitlements hook).
function rank(all,today){
  const v=open(all).map(R2.view), rows=[], byDue=(a,b)=>a.due.localeCompare(b.due);
  v.filter(r=>r.type==="case"&&r.due&&daysLeft(r,today)<=0).sort(byDue).forEach(r=>rows.push({r,kind:"chase"}));
  const dated=v.filter(r=>r.type!=="case"&&r.due).sort(byDue);
  dated.filter(r=>daysLeft(r,today)<0).forEach(r=>rows.push({r,kind:"late"}));
  dated.filter(r=>{const n=daysLeft(r,today);return n>=0&&(n<=7||(typeof windowOpen==="function"&&windowOpen(r,today)))}).forEach(r=>rows.push({r,kind:"soon"}));
  const q=v.find(r=>r.type==="deadline"&&!r.date_known&&!(settings.askedLater||[]).includes(r.id));
  if(q)rows.push({r:q,kind:"ask"});
  for(const f of (window.LIFEOS_CLAIMS||[]))try{(f(today)||[]).forEach(c=>rows.push({c,kind:"claim"}))}catch(e){}
  if(growDue())rows.push({kind:"grow"}); // lowest priority: only shows when there is room
  return rows.slice(0,5);
}
// Growth: one small question a day; the answer is saved as a journal note. settings.grow = {last, streak}.
const GROW=["Aaj ek cheez jo seekhi?","What gave you energy today?","Ek cheez jo kal 1% better karoge?","What are you avoiding, and what's the smallest first step?",
  "Aaj kis baat ka shukr hai?","One thing you did well today?","Kaunsi skill pe is hafte 20 minute lagaoge?","What would make tomorrow a good day?",
  "Kis se baat karke accha lagega is hafte?","One habit to drop, one to start?"];
const growDue=()=>settings.growOff!==true&&(settings.grow||{}).last!==R2.todayIso();
const growQ=()=>GROW[Math.floor(Date.parse(R2.todayIso())/864e5)%GROW.length];
function caseLine(r,today){
  if(r.next_action_date&&daysLeft(r,today)<0&&r.waiting_on==="them")return `No reply from ${r.seller||"them"} · chase / escalate`;
  return r.next_action||"Next step?";
}
function row({r,c,kind},today){
  if(kind==="grow")return `<div class="td-q"><b>🌱 ${esc(growQ())}</b>${(settings.grow||{}).streak>1?`<small class="td-streak">${settings.grow.streak} din lagataar</small>`:""}
    <div style="display:flex;gap:8px;flex-wrap:wrap"><input type="text" id="tdGrow" placeholder="Ek line kaafi hai" aria-label="Your answer" style="flex:1"><button class="go" style="padding:10px 14px" data-td-grow>Save</button><button class="linkbtn" data-td-growskip>Aaj nahi</button></div></div>`;
  if(kind==="claim")return `<div class="td-row"><div class="td-main"><b>💶 ${esc(c.title)}</b><small>${esc(c.sub||"")}</small></div>${c.action||""}</div>`;
  if(kind==="ask")return `<div class="td-q"><b>❓ ${esc(r.title)}: date kya hai?</b>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><input type="date" id="tdDate" data-td-date="${r.id}" aria-label="Date for ${esc(r.title)}"><button class="go" style="padding:10px 14px" data-td-setdate="${r.id}">Save</button><button class="linkbtn" data-td-later="${r.id}">Pata nahi</button></div></div>`;
  const hot=kind==="late"||kind==="chase", isCase=r.type==="case";
  const title=kind==="project"?`${r.title}: ${r.next_step}`:kind==="decide"?`Decide: "${r.title}"`:isCase?`${r.title}`:r.title;
  const sub=kind==="decide"?"Default: kal kar lo":isCase?`${caseLine(r,today)} · ${when(r,today)}`:kind==="project"?"Active project · next step":`${R2.TYPE_LABEL[r.type]} · ${when(r,today)}`;
  const act=kind==="decide"?`<button class="td-ok" data-td-tomorrow="${r.id}" aria-label="Kal ke liye set karo">⏭</button>`
    :isCase?`<button class="td-ok" data-td-case="${r.id}" aria-label="Open case">›</button>`
    :`<button class="td-ok" data-td-done="${r.id}" aria-label="Done: ${esc(r.title)}">✓</button>`;
  return `<div class="td-row${hot?" hot":""}"><button class="td-main" ${isCase?`data-td-case="${r.id}"`:""}><b>${ICON[r.type]||"•"} ${esc(title)}</b><small>${esc(sub)}</small></button>${act}</div>`;
}
function moneyLine(){
  const mv=EXTRA_VIEWS.money&&EXTRA_VIEWS.money._test; if(!mv||!window.MoneyCore)return "";
  if(!mv.S.loaded){if(!moneyLoading){moneyLoading=true;mv.load().then(()=>render()).catch(()=>{})}return ""}
  if(!mv.S.txns.length)return `<button class="td-money" data-v="money">📊 Bank file daalo, kharcha yahan dikhega ›</button>`;
  const D=MoneyCore.dashboard(mv.S.txns,mv.S.settings,R2.todayIso()), e=v=>`€${Math.round(v).toLocaleString("en-IE")}`;
  return `<button class="td-money" data-v="money">📊 Is mahine ${e(D.cur.spend)} kharcha${D.avgSpend!=null?` · usual ${e(D.avgSpend)}`:""}${D.overIncome?" · ⚠ pace too high":""} ›</button>`;
}
let moneyLoading=false;
function render2(all,today){
  const rows=rank(all,today);
  const up=!R2.migrated&&items.size?`<button class="go" style="width:100%;padding:12px;margin-bottom:12px" data-v="migrate">⬆️ Upgrade to v4: records sort ho jayenge (1 min)</button>`:"";
  return `${up}<p class="td-tag">Jarvis sorts your Irish life admin and gets you what you're owed.</p>
    <section><h2>Jarvis found for you${rows.length?` · ${rows.length}`:""}</h2><div class="td-list">
    ${rows.length?rows.map(x=>row(x,today)).join(""):`<p class="td-empty">Sab sorted 🌿 Upar likho, bolo ya pucho.</p>`}</div></section>${moneyLine()}`;
}
document.addEventListener("click",async e=>{const b=e.target.closest&&e.target.closest("button");if(!b)return;
  if(b.dataset.tdDone){await complete(+b.dataset.tdDone);return}
  if(b.dataset.tdCase){const id=+b.dataset.tdCase;if(typeof window.openCase==="function")openCase(id);else{view="today";render()}return}
  if(b.dataset.tdTomorrow){const id=+b.dataset.tdTomorrow,it=items.get(id);if(!it)return;
    if(R2.migrated)await R2.update(id,{due_date:R2.addDays(R2.todayIso(),1)},"Kal ke liye ✓");else await change(id,Object.assign(clone(it),{due:R2.addDays(R2.todayIso(),1)}),"Kal ke liye ✓");return}
  if(b.dataset.tdSetdate){const id=+b.dataset.tdSetdate,v=(document.querySelector(`[data-td-date="${id}"]`)||{}).value;
    if(!v){toast("Date chuno pehle",false);return}
    if(R2.migrated)await R2.update(id,{date:v,date_known:true},"Date saved ✓");else await change(id,Object.assign(clone(items.get(id)),{due:v}),"Date saved ✓");return}
  if(b.hasAttribute("data-td-grow")||b.hasAttribute("data-td-growskip")){
    const t=R2.todayIso(), g=settings.grow||{}, ans=b.hasAttribute("data-td-grow")?(document.getElementById("tdGrow")||{}).value.trim():"";
    if(b.hasAttribute("data-td-grow")&&!ans){toast("Ek line likho, ya \"Aaj nahi\"",false);return}
    if(ans){settings.grow={last:t,streak:g.last===R2.addDays(t,-1)?(g.streak||0)+1:1};saveSettings();
      await R2.create("journal",{title:`🌱 ${growQ()} → ${ans}`,area:"ideas"},`Saved 🌱 ${settings.grow.streak} din`)}
    else{settings.grow={last:t,streak:g.streak||0};saveSettings();render()}
    return}
  if(b.dataset.tdLater){(settings.askedLater=settings.askedLater||[]).push(+b.dataset.tdLater);saveSettings();render();return}
});

window.EXTRA_VIEWS=window.EXTRA_VIEWS||{};
EXTRA_VIEWS.now={title:"LifeOS",render:render2,mount(){},_test:{rank}};
})();
