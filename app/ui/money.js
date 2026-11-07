/* Money (Phase 1): import bank files, categorise (learns), one-screen dashboard, category charts.
   Every number is a button that opens the transactions behind it. Data never leaves the phone:
   it's AES-GCM encrypted in IndexedDB with a non-extractable key made on this device (protects copies of the
   browser's storage; anyone using the unlocked phone can still open the app). Needs money-core.js (+ money-xlsx/esb when present). */
(()=>{
const MC=()=>window.MoneyCore;
const css=`
.mn{display:grid;gap:12px;min-width:0}.mn *{min-width:0}
.mn-card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:14px;display:grid;gap:8px}
.mn-h{font:600 11px var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:0;display:flex;justify-content:space-between;gap:8px;align-items:center}
.mn-n{background:none;border:0;padding:0;color:inherit;font:inherit;text-align:left;cursor:pointer;text-decoration:underline dotted 1px;text-underline-offset:3px}
.mn-big{font:800 40px/1 var(--display);letter-spacing:-.02em}
.mn-sub{color:var(--muted);font-size:14px}
.mn-warn{color:#ff8a65;font-weight:600}.mn-ok{color:#3ddc97;font-weight:600}
.mn-row{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.mn-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mn-pct{font:800 26px var(--display)}
.mn-tie{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;font:14px var(--mono)}.mn-tie b{text-align:right}
.mn-svg{width:100%;height:auto;display:block}.mn-svg text{font:10px var(--mono);fill:var(--muted)}
.mn-svg rect,.mn-svg circle{cursor:pointer}
.mn-bar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;font-size:14px}
.mn-bar i{grid-column:1/-1;height:6px;border-radius:4px;background:var(--chip);overflow:hidden;display:block}.mn-bar i b{display:block;height:100%}
.mn-legend{display:flex;flex-wrap:wrap;gap:6px 12px;font:11px var(--mono);color:var(--muted)}.mn-legend span::before{content:"";display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;background:var(--c)}
.mn-tx{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:10px 0;border-bottom:1px solid var(--line)}
.mn-tx small{color:var(--muted);font:11px var(--mono)}.mn-tx select{grid-column:1/-1;padding:7px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font:13px var(--body)}
.mn-tx label{grid-column:1/-1;font-size:12px;color:var(--muted);display:flex;gap:6px;align-items:center}
.mn-drill{position:fixed;inset:0;z-index:9;background:rgb(0 0 0 / .55);display:flex;align-items:flex-end}
.mn-drill>div{width:100%;max-width:640px;margin:0 auto;max-height:82vh;overflow:auto;background:var(--card2,var(--card));border-radius:22px 22px 0 0;padding:16px 16px calc(20px + env(safe-area-inset-bottom,0px))}
.mn-form{display:grid;gap:8px}.mn-form input,.mn-form select{min-width:0;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font:15px var(--body)}
.mn-empty{text-align:center;display:grid;gap:10px;padding:18px 8px}`;
document.head.insertAdjacentHTML("beforeend",`<style>${css}</style>`);
const GC={Home:"#4f8cff",Living:"#2fbf71",Lifestyle:"#f5a524",People:"#e5484d",Other:"#8b8fa3"};
const eur=(v,dp)=>{const n=Math.abs(v)>=1000||dp===0?Math.round(v).toLocaleString("en-IE"):(+v).toFixed(2);return `€${n}`};
const eur2=v=>`€${(+v).toLocaleString("en-IE",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const pct=v=>`${v>=10?Math.round(v):(+v).toFixed(1)}%`;
const today=()=>R2&&R2.todayIso?R2.todayIso():new Date().toISOString().slice(0,10);

/* ---------- encrypted store (IndexedDB) ---------- */
const DBN="lifeos-money";
const idb=()=>new Promise((ok,no)=>{const r=indexedDB.open(DBN,1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
const kvGet=async k=>{const db=await idb();return new Promise(ok=>{const q=db.transaction("kv").objectStore("kv").get(k);q.onsuccess=()=>ok(q.result);q.onerror=()=>ok(undefined)})};
const kvSet=async(k,v)=>{const db=await idb();return new Promise((ok,no)=>{const t=db.transaction("kv","readwrite");t.objectStore("kv").put(v,k);t.oncomplete=()=>ok();t.onerror=()=>no(t.error)})};
async function cryptoKey(){let k=await kvGet("key");if(k)return k;
  k=await crypto.subtle.generateKey({name:"AES-GCM",length:256},false,["encrypt","decrypt"]);await kvSet("key",k);return k}
let S={txns:[],esb:null,settings:null,loaded:false};
async function load(){
  try{const blob=await kvGet("data");if(blob){const k=await cryptoKey();
      const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:blob.iv},k,blob.ct);Object.assign(S,JSON.parse(new TextDecoder().decode(pt)))}}
  catch(e){console.error("money load",e)}
  S.settings=Object.assign(MC().defaultSettings(),S.settings||{});S.loaded=true;
}
async function save(){const k=await cryptoKey(),iv=crypto.getRandomValues(new Uint8Array(12));
  const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv},k,new TextEncoder().encode(JSON.stringify({txns:S.txns,esb:S.esb,settings:S.settings})));
  await kvSet("data",{iv,ct,saved:new Date().toISOString()})}

/* ---------- import ---------- */
async function importFile(file){
  const M=MC(); let raw=[], what="";
  if(/\.xlsx$/i.test(file.name)){
    if(!window.MoneyXLSX)throw new Error("Excel import isn't available in this version");
    const sheets=await MoneyXLSX.readSheets(new Uint8Array(await file.arrayBuffer()));
    const name=Object.keys(sheets).find(n=>/ledger/i.test(n))||Object.keys(sheets)[0];
    const {txns,categories}=MoneyXLSX.ledgerToTxns(sheets[name]);
    for(const c of categories||[])if(c.name&&!S.settings.categories.find(x=>x.name===c.name))
      S.settings.categories.push({name:c.name,group:c.group||"Other",essential:!!c.essential});
    const votes={};
    raw=txns.map(t=>{const kind=String(t.kind||"").toUpperCase();
      if(kind==="SPEND"&&t.category){const mk=M.merchantKey(t.desc);(votes[mk]=votes[mk]||{})[t.category]=((votes[mk]||{})[t.category]||0)+1}
      return {source:"ledger",account:t.account||"Ledger",started:t.date,date:t.date,desc:t.desc||"",amount:+t.amount||0,fee:0,currency:"EUR",state:"completed",rtype:"",
        kind:kind||undefined,kindLocked:!!kind,category:t.category||undefined,catLocked:!!t.category,note:t.note||""}});
    for(const [mk,v] of Object.entries(votes))if(!S.settings.rules[mk])S.settings.rules[mk]=Object.entries(v).sort((a,b)=>b[1]-a[1])[0][0];
    raw.forEach(t=>{if(t.kindLocked&&t.kind!=="SPEND"&&!t.category)t.category=t.kind==="SAVE"?"Saving":t.kind==="INCOME"?"Income":"Internal"});
    what="tracker";
  }else{
    const text=await file.text(), head=text.slice(0,400);
    if(/MPRN/i.test(head)&&/Read Type/i.test(head)){
      if(!window.MoneyESB)throw new Error("Electricity import isn't available in this version");
      const r=MoneyESB.parseHDF(text), have=new Map(((S.esb&&S.esb.daily)||[]).map(d=>[d.date,d]));r.daily.forEach(d=>have.set(d.date,d));
      S.esb={daily:[...have.values()].sort((a,b)=>a.date.localeCompare(b.date)),registers:r.registers};await save();
      return `⚡ ${r.daily.length} days of electricity saved (charts come in Phase 2)`;
    }
    raw=/Started Date/.test(head)?M.parseRevolut(text):M.parseBank(text,S.settings.bankAccountName||"BOI Current");
    what=/Started Date/.test(head)?"Revolut":"bank";
  }
  const r=M.merge({txns:S.txns},raw,S.settings);S.txns=r.db.txns;await save();
  return `${what}: ${r.added} new${r.updated?`, ${r.updated} completed`:""}${r.dupes?`, ${r.dupes} already there`:""}`;
}

/* ---------- drill-down ---------- */
let drill=null; // {title, f}
function drillHTML(){
  if(!drill)return "";const M=MC(), rows=M.filterTxns(S.txns,drill.f,S.settings).slice(0,300);
  const cats=[...S.settings.categories.map(c=>c.name)];
  const total=rows.reduce((a,t)=>a+t.amountEur,0); // drill shows exact cents
  return `<div class="mn-drill" data-mn-close><div role="dialog" aria-label="${esc(drill.title)}">
    <div class="mn-row"><b>${esc(drill.title)}</b><button class="linkbtn" data-mn-close>Close</button></div>
    <div class="mn-sub">${rows.length} transactions · net ${eur2(total)}</div>
    ${rows.map(t=>`<div class="mn-tx"><span>${esc(t.desc)}</span><b>${eur2(t.amountEur)}</b>
      <small>${esc(t.date)} · ${esc(t.account)} · ${esc(t.kind)}${t.refundOf?" · refund":""}${t.state==="pending"?" · pending":""}</small><small></small>
      <select data-mn-kind="${t.id}" aria-label="Type">${["SPEND","SAVE","INTERNAL","INCOME"].map(k=>`<option${k===t.kind?" selected":""}>${k}</option>`).join("")}</select>
      ${t.kind==="SPEND"?`<select data-mn-cat="${t.id}" aria-label="Category">${cats.map(c=>`<option${c===t.category?" selected":""}>${esc(c)}</option>`).join("")}</select>
      <label><input type="checkbox" data-mn-all="${t.id}" checked> apply to all from “${esc(M.merchantKey(t.desc))}”</label>`:""}</div>`).join("")||`<p class="mn-sub">Nothing here.</p>`}
  </div></div>`;
}
const n=(v,title,f,cls)=>`<button class="mn-n ${cls||""}" data-mn-drill='${esc(JSON.stringify({title,f}))}'>${v}</button>`;

/* ---------- charts (SVG) ---------- */
function stacked(months){
  const M=MC(), data=M.monthlySeries(S.txns,S.settings,months), max=Math.max(1,...data.map(d=>d.spend)), W=320,H=150,bw=W/months.length*.6;
  const bars=data.map((d,i)=>{let y=H-18;const x=i*W/months.length+(W/months.length-bw)/2;
    const segs=M.GROUPS.map(g=>{const v=d.byGroup[g]||0;if(v<=0)return "";const h=v/max*(H-30);y-=h;
      return `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(1,h)}" fill="${GC[g]}" data-mn-drill='${esc(JSON.stringify({title:`${g} · ${d.month}`,f:{month:d.month,group:g}}))}'><title>${g} ${eur(v)}</title></rect>`}).join("");
    return segs+`<text x="${x+bw/2}" y="${H-4}" text-anchor="middle">${d.month.slice(5)}</text><text x="${x+bw/2}" y="${Math.max(10,y-3)}" text-anchor="middle">${Math.round(d.spend/100)/10}k</text>`}).join("");
  return `<svg class="mn-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending by month and group">${bars}</svg>
    <div class="mn-legend">${M.GROUPS.map(g=>`<span style="--c:${GC[g]}">${g}</span>`).join("")}</div>`;
}
function trend(cat,months){
  const M=MC(), pts=M.categoryTrend(S.txns,S.settings,cat,months), max=Math.max(1,...pts.map(p=>p.value)), W=320,H=120;
  const xy=pts.map((p,i)=>[16+i*(W-32)/Math.max(1,pts.length-1),H-20-p.value/max*(H-36)]);
  return `<svg class="mn-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cat)} by month"><polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${xy.map(p=>p.join(",")).join(" ")}"/>
    ${pts.map((p,i)=>`<circle cx="${xy[i][0]}" cy="${xy[i][1]}" r="5" fill="var(--accent)" data-mn-drill='${esc(JSON.stringify({title:`${cat} · ${p.month}`,f:{month:p.month,category:cat}}))}'><title>${p.month} ${eur(p.value)}</title></circle>
    <text x="${xy[i][0]}" y="${H-4}" text-anchor="middle">${p.month.slice(5)}</text>`).join("")}</svg>`;
}

/* ---------- screen ---------- */
let trendCat=null, showSettings=false, showManual=false;
function render3(){
  if(!MC())return `<p>Money core missing.</p>`;
  if(!S.loaded){load().then(()=>render());return `<p class="mn-sub">Loading…</p>`}
  const M=MC(), t=today(), D=M.dashboard(S.txns,S.settings,t), first=M.monthsWithData(S.txns)[0]||D.month, since=ms=>ms.filter(m=>m>=first);
  const months=since(M.prevMonths(D.month,5).reverse().concat(D.month)), cur=D.cur;
  const head=`<div class="mn-row"><label class="go" style="padding:10px 14px;border-radius:14px;cursor:pointer">⬆ Import<input type="file" id="mnFile" accept=".csv,.txt,.xlsx" multiple hidden></label>
    <span style="display:flex;gap:8px"><button class="linkbtn" data-mn-manual>＋ Manual</button><button class="linkbtn" data-mn-settings>⚙︎</button></span></div>
    ${showManual?manualForm():""}${showSettings?settingsPanel():""}`;
  if(!S.txns.length)return `<div class="mn">${head}<div class="mn-card mn-empty"><b>Apni bank files daalo</b>
    <span class="mn-sub">Revolut CSV, Bank of Ireland CSV, ya apna tracker .xlsx. Sab sirf is phone pe, encrypted.</span></div></div>`;
  const avg=D.avgSpend, proj=D.projected;
  const share=Object.entries(cur.byCat).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]), totalSp=cur.spend||1;
  const cats=[...new Set(S.txns.filter(x=>x.kind==="SPEND").map(x=>x.category))].sort(); if(!trendCat||!cats.includes(trendCat))trendCat=share[0]?share[0][0]:cats[0];
  const tie=D.tie, ms=M.merchantStats(S.txns,t,8);
  return `<div class="mn">${head}
  <div class="mn-card"><p class="mn-h">This month so far <span>day ${D.day}/${D.daysInMonth}</span></p>
    <div class="mn-big">${n(eur(cur.spend,0),`Spent · ${D.month}`,{month:D.month,kind:"SPEND"})}</div>
    <div class="mn-sub">${avg!=null?`usual month ${n(eur(avg,0),"Spending · last 12 months",{kind:"SPEND"})}`:"no history yet"}${cur.pending?` · ${n(eur(cur.pending,0)+" pending",`Pending`,{pending:true})}`:""}</div>
    <div class="mn-row"><span>Month-end at this pace</span><b class="${D.overIncome?"mn-warn":""}">${eur(proj,0)}${D.overIncome?` ⚠ more than income ${eur(D.incomeRef,0)}`:""}</b></div></div>
  <div class="mn-grid2">
    <div class="mn-card"><p class="mn-h">Saved · month</p><div class="mn-pct">${D.savingsRate==null?"–":n(pct(D.savingsRate),`Saved · ${D.month}`,{month:D.month,kind:"SAVE"})}</div><span class="mn-sub">${eur(cur.save,0)} of ${eur(cur.income,0)}</span></div>
    <div class="mn-card"><p class="mn-h">Saved · 12 months</p><div class="mn-pct">${D.savingsRate12==null?"–":n(pct(D.savingsRate12),"Saved · all",{kind:"SAVE"})}</div><span class="mn-sub">savings rate</span></div></div>
  <div class="mn-card"><p class="mn-h">Tie-out · ${D.month} ${tie.gap===0?`<span class="mn-ok">✓ €0 gap</span>`:`<span class="mn-warn">gap ${eur2(tie.gap)}</span>`}</p>
    <div class="mn-tie"><span>Net pay</span><b>${n(eur2(tie.income),`Income · ${D.month}`,{month:D.month,kind:"INCOME"})}</b>
    <span>− Spent</span><b>${n(eur2(tie.spend),`Spent · ${D.month}`,{month:D.month,kind:"SPEND"})}</b>
    <span>− Saved</span><b>${n(eur2(tie.save),`Saved · ${D.month}`,{month:D.month,kind:"SAVE"})}</b>
    <span>= Left</span><b>${eur2(tie.left)}</b><span>Accounts moved</span><b>${eur2(tie.actual)}</b>
    ${tie.gap!==0?`<span>Gap</span><b>${n(eur2(tie.gap),"Gap: own-account moves with one side missing",{ids:tie.gapRows},"mn-warn")}</b>`:""}</div>
    ${tie.gap!==0?`<span class="mn-sub">Gap = transfers between your own accounts where only one side is imported. Import the other account, or mark them.</span>`:""}</div>
  ${D.changes.length?`<div class="mn-card"><p class="mn-h">What changed vs 3-month average</p>
    ${D.changes.map(c=>`<div class="mn-row"><span>${n(esc(c.category),`${c.category} · ${D.month}`,{month:D.month,category:c.category})}</span><b class="mn-warn">+${eur(c.delta,0)} vs usual ${eur(c.avg,0)}</b></div>`).join("")}</div>`:""}
  <div class="mn-card"><p class="mn-h">Spending by month</p>${stacked(months)}</div>
  <div class="mn-card"><p class="mn-h">Where it went · ${D.month} <span>need ${Math.round(cur.essential/totalSp*100)}% · want ${Math.round(cur.flexible/totalSp*100)}%</span></p>
    ${share.slice(0,10).map(([c,v])=>{const def=M.catDef(S.settings,c);return `<div class="mn-bar"><span>${n(esc(c),`${c} · ${D.month}`,{month:D.month,category:c})} <small class="mn-sub">${def.essential?"need":"want"}</small></span><b>${eur(v,0)} · ${Math.round(v/totalSp*100)}%</b>
      <i><b style="width:${Math.max(2,v/share[0][1]*100)}%;background:${GC[def.group]||GC.Other}"></b></i></div>`}).join("")||`<span class="mn-sub">No spending this month yet.</span>`}</div>
  <div class="mn-card"><p class="mn-h">Trend <select data-mn-trend aria-label="Category" style="font:13px var(--body);background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:4px">${cats.map(c=>`<option${c===trendCat?" selected":""}>${esc(c)}</option>`).join("")}</select></p>
    ${trendCat?trend(trendCat,since(M.prevMonths(D.month,11).reverse().concat(D.month))):""}</div>
  <div class="mn-card"><p class="mn-h">Where the money really goes · 12 months</p>
    ${ms.map(m=>`<div class="mn-row"><span>${n(esc(m.merchant),m.merchant,{merchant:m.merchant})}</span><b>${m.count}× · avg ${eur(m.avg,0)} = ${m.rough?"≈":""}${eur(m.yearly,0)}/yr</b></div>`).join("")||`<span class="mn-sub">Not enough data.</span>`}</div>
  </div>${drillHTML()}`;
}
function manualForm(){return `<form class="mn-card mn-form" id="mnManual"><b>Manual entry</b>
  <input type="date" id="mnDate" value="${today()}" aria-label="Date"><input id="mnDesc" placeholder="What (e.g. Plumber cash)" aria-label="Description">
  <input id="mnAmt" type="number" step="0.01" inputmode="decimal" placeholder="Amount € (spent = positive)" aria-label="Amount">
  <select id="mnKindNew" aria-label="Type"><option>SPEND</option><option>INCOME</option><option>SAVE</option><option>INTERNAL</option></select>
  <input id="mnAcct" value="Cash" aria-label="Account"><button class="go" style="padding:10px" type="submit">Add</button></form>`}
function settingsPanel(){const s=S.settings;return `<form class="mn-card mn-form" id="mnSettings"><b>Money settings</b>
  <label class="mn-sub">My names (transfers “To/From &lt;name&gt;” are your own accounts)<input id="mnNames" value="${esc((s.myNames||[]).join(", "))}" placeholder="e.g. First Last"></label>
  <label class="mn-sub">Bank CSV account name<input id="mnBankName" value="${esc(s.bankAccountName||"BOI Current")}"></label>
  <div class="mn-grid2"><label class="mn-sub">1 INR in €<input id="mnINR" type="number" step="0.0001" value="${s.rates.INR}"></label><label class="mn-sub">1 GBP in €<input id="mnGBP" type="number" step="0.0001" value="${s.rates.GBP}"></label></div>
  <button class="go" style="padding:10px" type="submit">Save</button>
  <div class="acts"><button class="linkbtn" type="button" data-mn-export="json">Export backup (JSON)</button><button class="linkbtn" type="button" data-mn-export="csv">Export CSV</button>
  <label class="linkbtn" style="cursor:pointer">Restore JSON<input type="file" id="mnRestore" accept=".json" hidden></label><button class="linkbtn" type="button" data-mn-wipe>Delete all money data</button></div>
  <span class="mn-sub">🔒 Stored encrypted on this phone only. No bank logins, no analytics.</span></form>`}
function download(name,text,type){const f=new File([text],name,{type});if(typeof shareFile==="function")shareFile(f,name,()=>toast("Exported ✓",false));
  else{const a=document.createElement("a");a.href=URL.createObjectURL(f);a.download=name;a.click()}}

document.addEventListener("change",async e=>{const t=e.target;
  if(t.id==="mnFile"){for(const f of t.files||[]){try{toast(await importFile(f),false)}catch(x){toast("⚠ "+x.message,false)}}render();return}
  if(t.id==="mnRestore"){const f=t.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(!Array.isArray(d.txns))throw new Error("not a LifeOS money backup");
      S.txns=d.txns;S.esb=d.esb||null;S.settings=Object.assign(MC().defaultSettings(),d.settings||{});await save();render();toast(`Restored ${S.txns.length} transactions`,false)}catch(x){toast("⚠ "+x.message,false)}return}
  if(t.dataset.mnTrend!==undefined){trendCat=t.value;render();return}
  if(t.dataset.mnCat){const all=(document.querySelector(`[data-mn-all="${t.dataset.mnCat}"]`)||{}).checked;
    const k=MC().recategorise({txns:S.txns},t.dataset.mnCat,t.value,S.settings,all);await save();render();toast(`${k} updated${all?" · rule saved":""}`,false);return}
  if(t.dataset.mnKind){MC().setKind({txns:S.txns},t.dataset.mnKind,t.value);await save();render();return}
});
document.addEventListener("submit",async e=>{
  if(e.target.id==="mnManual"){e.preventDefault();const g=id=>document.getElementById(id).value, kind=g("mnKindNew"), a=+g("mnAmt");if(!a||!g("mnDesc").trim())return;
    const amount=kind==="INCOME"?Math.abs(a):-Math.abs(a);
    const r=MC().merge({txns:S.txns},[{source:"manual",account:g("mnAcct")||"Cash",started:g("mnDate"),date:g("mnDate"),desc:g("mnDesc").trim(),amount,fee:0,currency:"EUR",state:"completed",rtype:"",kind,kindLocked:true}],S.settings);
    S.txns=r.db.txns;await save();showManual=false;render();toast("Added ✓",false)}
  if(e.target.id==="mnSettings"){e.preventDefault();const g=id=>document.getElementById(id).value;
    S.settings.myNames=g("mnNames").split(",").map(x=>x.trim()).filter(Boolean);S.settings.bankAccountName=g("mnBankName").trim()||"BOI Current";
    S.settings.rates.INR=+g("mnINR")||S.settings.rates.INR;S.settings.rates.GBP=+g("mnGBP")||S.settings.rates.GBP;
    S.txns.forEach(x=>{if(!x.kindLocked)MC().classify(x,S.settings)});await save();showSettings=false;render();toast("Saved ✓",false)}
});
document.addEventListener("click",async e=>{const b=e.target.closest&&e.target.closest("[data-mn-drill],[data-mn-close],button,label");
  if(!b)return;
  if(b.dataset.mnDrill){drill=JSON.parse(b.dataset.mnDrill);render();return}
  if(b.hasAttribute("data-mn-close")&&(e.target===b||b.tagName==="BUTTON")){drill=null;render();return}
  if(b.hasAttribute("data-mn-manual")){showManual=!showManual;render();return}
  if(b.hasAttribute("data-mn-settings")){showSettings=!showSettings;render();return}
  if(b.dataset.mnExport==="json"){download(`lifeos-money-${today()}.json`,JSON.stringify({app:"LifeOS money",format:1,txns:S.txns,esb:S.esb,settings:S.settings},null,1),"application/json");return}
  if(b.dataset.mnExport==="csv"){download(`lifeos-money-${today()}.csv`,MC().toCSV(S.txns),"text/csv");return}
  if(b.hasAttribute("data-mn-wipe")){if(b.dataset.sure){S.txns=[];S.esb=null;S.settings=MC().defaultSettings();await save();showSettings=false;render();toast("Money data deleted",false)}
    else{b.dataset.sure="1";b.textContent="Tap again to delete everything"}return}
});

window.EXTRA_VIEWS=window.EXTRA_VIEWS||{};
EXTRA_VIEWS.money={title:"Money",render:render3,mount(){},_test:{S,load,save,importFile}};
})();
