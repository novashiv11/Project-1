/* Cases: consumer disputes (refunds, repairs, claims) with a timeline, an escalation ladder and legal-window deadlines.
   Registers EXTRA_VIEWS.cases (⋯ menu via `menu`) and window.openCase(id). Uses page globals (items, render, toast, esc,
   todayDate, view, backend) and window.R2 (records.js) only at call time. Evidence is links or notes only; no files are stored. */
(()=>{
const css=`
.cs{display:grid;gap:12px;min-width:0}
.cs *{min-width:0}
.cs .go{padding:12px 16px;border-radius:14px}
.cs-card{display:grid;gap:4px;width:100%;text-align:left;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:14px;color:var(--fg)}
.cs-t{font:700 16px/1.3 var(--display,system-ui);overflow-wrap:anywhere}
.cs-m{font-size:13px;color:var(--muted);display:flex;flex-wrap:wrap;gap:2px 10px;overflow-wrap:anywhere}
.cs-next{font-size:14px;overflow-wrap:anywhere}
.cs-late{color:var(--late);font-weight:700}
.cs-pill{justify-self:start;font:700 11px var(--body,system-ui);padding:3px 9px;border-radius:99px;background:var(--chip);color:var(--muted)}
.cs-pill.me{background:var(--warn-bg);color:var(--warn)}
.cs-pill.late{background:var(--late-bg);color:var(--late)}
.cs details summary{cursor:pointer;color:var(--muted);font-size:14px;padding:6px 0}
.cs details[open]{display:grid;gap:10px}
.cs-box{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:14px;display:grid;gap:8px}
.cs-box.overdue{border-color:var(--late);background:var(--late-bg)}
.cs-h{font:500 11px var(--mono,monospace);text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:0}
.cs-ladder{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.cs-ladder li{display:grid;grid-template-columns:26px minmax(0,1fr);gap:8px;align-items:start;padding:8px 10px;border-radius:14px;color:var(--muted);font-size:14px}
.cs-ladder li i{font-style:normal;font:800 13px var(--display,system-ui);width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:var(--chip)}
.cs-ladder li small{display:block;font-size:12px;overflow-wrap:anywhere}
.cs-ladder li.past{opacity:.7}
.cs-ladder li.on{background:var(--ok-bg);color:var(--fg);font-weight:700}
.cs-ladder li.on i{background:var(--accent);color:var(--accent-ink)}
.cs-facts{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;margin:0;font-size:14px}
.cs-facts dt{color:var(--muted)}.cs-facts dd{margin:0;overflow-wrap:anywhere}
.cs-tl{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.cs-tl li{border-left:3px solid var(--line);padding:2px 0 2px 10px;font-size:14px;overflow-wrap:anywhere}
.cs-tl li.them{border-color:var(--warn)}.cs-tl li.me{border-color:var(--accent)}
.cs-tl b{font-size:13px}.cs-tl p{margin:2px 0 0}
.cs-ev{margin:0;padding-left:18px;display:grid;gap:4px;font-size:14px;overflow-wrap:anywhere}
.cs-ev a{color:var(--accent)}
.cs-2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}
.cs .setup input,.cs .setup select,.cs .setup textarea{width:100%;font-family:var(--body,system-ui)}
.cs-seg{display:flex;gap:6px;flex-wrap:wrap}
.cs-seg label{display:flex;align-items:center;gap:6px;color:var(--fg);font-size:14px;background:var(--chip);padding:8px 12px;border-radius:99px}
.cs-seg input{width:auto!important;margin:0;padding:0;accent-color:var(--accent)}
.cs-sec{background:var(--chip);color:var(--fg);padding:10px 14px;border-radius:14px}
.cs-sec[disabled]{opacity:.45}
.cs-note{color:var(--muted);font-size:12px;margin:0}
`;
document.head.insertAdjacentHTML("beforeend",`<style>${css}</style>`);

const RUNGS=[null,
  {t:"Seller support",s:"Email or chat. Keep it in writing.",next:"Contact seller support"},
  {t:"Complaints / management",s:"Formal complaint letter",next:"Send formal complaint letter to management"},
  {t:"ECC Ireland or CCPC",s:"ECC if the seller is in another EU country; CCPC if Irish",next:"File with ECC Ireland / check CCPC guidance"},
  {t:"Small Claims",s:"District Court, online",next:"Prepare Small Claims application"}];
const CHANNELS=["email","phone","chat","in person","letter","web form"];
const WANTS=["refund","replacement","repair"];
const OPEN=c=>c.status==="open"||c.status==="waiting";
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt=s=>{if(!s)return "";const [y,m,d]=String(s).slice(0,10).split("-").map(Number);return `${d} ${MON[m-1]}${y!==new Date().getFullYear()?" "+y:""}`};
const dayDiff=(a,b)=>Math.round((Date.parse(String(b).slice(0,10))-Date.parse(String(a).slice(0,10)))/864e5);
const isoOf=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const isDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s||"");
const safeUrl=s=>/^https?:\/\/[^\s"'<>]+$/i.test(s||"")?s:"";

let ui={mode:"list",id:null,form:null,confirm:false};
const cases=all=>all.filter(i=>i.type==="case");
const cur=()=>{const c=items.get(ui.id);return c&&c.type==="case"?c:null};
const overdue=c=>OPEN(c)&&isDate(c.next_action_date)&&c.next_action_date<R2.todayIso();
const lastContact=c=>(c.timeline||[]).map(t=>t.at).filter(Boolean).sort().pop()||null;
const titleOf=f=>f.seller&&f.product?`${f.seller}: ${f.product}`:[f.seller,f.product||f.problem].filter(Boolean).join(": ").slice(0,90)||"Case";
const waitPill=c=>!OPEN(c)?`<span class="cs-pill">${c.status==="done"?"Resolved":"Archived"}</span>`
  :c.waiting_on==="them"?`<span class="cs-pill">Waiting on them</span>`:`<span class="cs-pill me">Waiting on you</span>`;
const nextLine=c=>c.next_action?`<div class="cs-next${overdue(c)?" cs-late":""}" data-case-next>Next: ${esc(c.next_action)}${c.next_action_date?` · ${fmt(c.next_action_date)}`:""}${overdue(c)?" · overdue":""}</div>`:"";

/* ---- legal windows: one linked deadline per kind, updated in place when dates change ---- */
async function syncWindows(id){
  const c=items.get(id); if(!c||!isDate(c.delivery_date))return;
  const who=c.seller||c.product||"Seller", want=[["cancel",R2.addDays(c.delivery_date,14),`${who}: online cancellation window ends (check your terms)`,"Cancel/return in writing before this date"]];
  if(+c.return_days>0)want.push(["return",R2.addDays(c.delivery_date,+c.return_days),`${who}: return window ends (check your terms)`,"Return the item before this date"]);
  const links=[...(c.links||[])]; let added=0;
  for(const [kind,date,title,action] of want){
    const ex=links.map(l=>items.get(l)||R2.trash.get(l)).find(d=>d&&d.type==="deadline"&&d.case_window===kind);
    if(ex){if(items.has(ex.id)&&(ex.date!==date||ex.title!==title))await R2.update(ex.id,{date,date_known:true,title},"Deadline moved ✓");continue} // trashed → respect the delete
    const d=await R2.create("deadline",{title,date,date_known:true,remind_before_days:3,action_when_due:action,area:"shopping",links:[id],case_window:kind},`Saved ✓ ${title}`);
    links.push(d.id); added++;
  }
  if(added)await R2.update(id,{links},`Saved ✓ ${added} deadline${added>1?"s":""} added`);
}

/* ---- screens ---- */
function card(c){
  const open=dayDiff(c.created_at||c.created||R2.todayIso(),R2.todayIso()), lc=lastContact(c);
  return `<button type="button" class="cs-card" data-case-open="${c.id}"><span class="cs-t">${esc(c.title||c.text||"Case")}</span>
    <span class="cs-m"><span>${open<=0?"Opened today":`${open}d open`}</span><span>${lc?`Last contact ${fmt(lc)}`:"No contact yet"}</span>${c.escalation>1?`<span>Step ${c.escalation}/4</span>`:""}</span>
    ${nextLine(c)}${waitPill(c)}</button>`;
}
function vList(all){
  const cs=cases(all).sort((a,b)=>String(a.next_action_date||"9999").localeCompare(String(b.next_action_date||"9999"))||b.id-a.id);
  const open=cs.filter(OPEN), closed=cs.filter(c=>!OPEN(c));
  return `<p class="covers">Refunds, repairs, faulty orders. Log every contact; LifeOS reminds you to chase or escalate.</p>
    <button type="button" class="go" data-case="new">+ New case</button>
    ${open.length?`<section class="cs" aria-label="Open cases">${open.map(card).join("")}</section>`:`<p class="cs-note">No open cases. Something faulty or a refund stuck? Start one above.</p>`}
    ${closed.length?`<details data-case-closed><summary>Closed (${closed.length})</summary>${closed.map(card).join("")}</details>`:""}`;
}
function factsForm(c){
  c=c||{}; const w=String(c.want||""), pick=WANTS.find(x=>w.toLowerCase().startsWith(x))||"", free=pick?w.slice(pick.length).replace(/^\s*·\s*/,""):w;
  const f=(n,l,v,t="text",x="")=>`<label>${l}<input name="${n}" type="${t}" value="${esc(v==null?"":v)}"${x}></label>`;
  return `<form class="setup" id="caseform" data-mode="${c.id?"edit":"new"}"><b>${c.id?"Edit facts":"New case"}</b>
    <div class="cs-2">${f("seller","Seller",c.seller,"text"," placeholder=\"Shop / brand\"")}${f("product","Product",c.product)}</div>
    ${f("bought_where","Where bought",c.bought_where,"text"," placeholder=\"Website, app, shop\"")}
    <div class="cs-2">${f("order_date","Order date",c.order_date,"date")}${f("delivery_date","Delivery date",c.delivery_date,"date")}</div>
    <div class="cs-2">${f("price","Price €",c.price,"number"," step=\"0.01\" min=\"0\" inputmode=\"decimal\"")}${f("return_days","Return policy (days)",c.return_days,"number"," min=\"0\" max=\"365\" placeholder=\"optional\"")}</div>
    <label>Problem<textarea name="problem" rows="3" placeholder="What went wrong?">${esc(c.problem||"")}</textarea></label>
    <span class="cs-h">What I want</span><div class="cs-seg">${WANTS.map(x=>`<label><input type="radio" name="want" value="${x}"${pick===x?" checked":""}>${x[0].toUpperCase()+x.slice(1)}</label>`).join("")}</div>
    ${f("want_text","Details (optional)",free)}
    <div class="acts"><button class="go" type="submit">${c.id?"Save":"Create case"}</button><button class="linkbtn" type="button" data-case="cancel">Cancel</button></div></form>`;
}
function contactForm(){
  return `<form class="setup" id="casecontact"><b>Log contact</b>
    <div class="cs-2"><label>Date<input name="at" type="date" value="${R2.todayIso()}"></label>
      <label>Channel<select name="channel">${CHANNELS.map(c=>`<option>${c}</option>`).join("")}</select></label></div>
    <label>Person / agent<input name="person" type="text" placeholder="Name or ref (optional)"></label>
    <div class="cs-seg" role="radiogroup" aria-label="Who contacted"><label><input type="radio" name="by" value="me" checked>I contacted them</label><label><input type="radio" name="by" value="them">They replied</label></div>
    <label>They said<textarea name="they_said" rows="2"></textarea></label>
    <label>I said<textarea name="i_said" rows="2"></textarea></label>
    <div class="acts"><button class="go" type="submit">Save contact</button><button class="linkbtn" type="button" data-case="close-form">Cancel</button></div></form>`;
}
function evidenceForm(){
  return `<form class="setup" id="caseev"><b>Add evidence</b><p class="cs-note">Links or notes only (e.g. a shared photo link, email subject). Nothing is uploaded.</p>
    <label>Kind<select name="kind"><option>photo</option><option>video</option><option>email</option><option selected>link</option></select></label>
    <label>Link or reference<input name="ref" type="text" placeholder="https://… or 'email 3 Nov, subject: Order'"></label>
    <label>Note<input name="note" type="text"></label>
    <div class="acts"><button class="go" type="submit">Add</button><button class="linkbtn" type="button" data-case="close-form">Cancel</button></div></form>`;
}
// Step-aware message: steps 1–2 are an email to the seller, steps 3–4 a summary to paste into the official form.
function draftBox(c){
  if(!window.CaseDraft)return "";
  const m=CaseDraft.draft(c,settings.name||""), blk=(label,text,id)=>`<div class="pv" style="white-space:pre-wrap;overflow-wrap:anywhere"><small class="covers">${label} · <button type="button" class="linkbtn" style="padding:0" data-case-copy="${id}">Copy</button></small>\n<span id="${id}">${esc(text)}</span></div>`;
  return `<div class="setup" data-case-draft><b>${m.kind==="email"?`Message for step ${m.step}`:`Summary to paste · step ${m.step}`}</b>
    ${blk("Subject",m.subject,"csSub")}${blk("Message",m.body,"csBody")}
    <div class="acts">${m.kind==="email"?`<a class="go" style="text-decoration:none;padding:10px 14px" href="mailto:?subject=${encodeURIComponent(m.subject)}&body=${encodeURIComponent(m.body)}">Open in email app</a>`
      :m.links.map(([l,u])=>`<a class="go" style="text-decoration:none;padding:10px 14px" href="${esc(u)}" target="_blank" rel="noopener">${esc(l)} ↗</a>`).join("")}
      <button type="button" class="cs-sec" data-case="sent">I sent it · log it</button><button type="button" class="linkbtn" data-case="close-form">Close</button></div>
    <span class="covers">Short and factual. Once they agree to fix it, stop arguing and just confirm.</span></div>`;
}
function vDetail(c){
  const rung=Math.min(4,Math.max(1,+c.escalation||1)), od=overdue(c);
  const tl=(c.timeline||[]).map((t,i)=>[t,i]).sort((a,b)=>String(b[0].at).localeCompare(String(a[0].at))||b[1]-a[1]);
  const wins=(c.links||[]).map(l=>items.get(l)).filter(d=>d&&d.type==="deadline");
  const facts=[["Seller",c.seller],["Product",c.product],["Bought",c.bought_where],["Ordered",fmt(c.order_date)],["Delivered",fmt(c.delivery_date)],
    ["Price",c.price!=null&&c.price!==""?`€${c.price}`:""],["Returns",c.return_days?`${c.return_days} days`:""],["Problem",c.problem],["I want",c.want]].filter(f=>f[1]);
  const f=ui.form;
  return `<button type="button" class="linkbtn" data-case="list">← All cases</button>
    <div class="cs-box"><span class="cs-t" data-case-title>${esc(c.title||c.text||"Case")}</span>${waitPill(c)}
      <ol class="cs-ladder" aria-label="Escalation ladder">${RUNGS.slice(1).map((r,i)=>`<li class="${i+1===rung?"on":i+1<rung?"past":""}"${i+1===rung?' aria-current="step"':""}><i>${i+1}</i><span>${r.t}<small>${r.s}</small></span></li>`).join("")}</ol></div>
    ${OPEN(c)?`<div class="cs-box${od?" overdue":""}" data-case-nextbox><span class="cs-h">Next action</span>${nextLine(c)||'<div class="cs-next">Nothing planned</div>'}
      <div class="acts"><button type="button" class="go" data-case="draft">✉️ Draft message</button><button type="button" class="cs-sec" data-case="contact">Log contact</button>
        <button type="button" class="cs-sec" data-case="escalate"${rung>=4?" disabled":""}>Escalate ↑</button>
        <button type="button" class="cs-sec" data-case="resolve">Mark resolved</button></div></div>`
    :`<div class="cs-box"><span class="cs-h">Closed</span><div class="acts"><button type="button" class="cs-sec" data-case="reopen">Reopen</button></div></div>`}
    ${ui.confirm?`<div class="setup" data-case-confirm role="alertdialog" aria-label="Confirm resolve"><b>Mark this case resolved?</b><span class="covers">You can undo or reopen it later.</span>
      <div class="acts"><button type="button" class="go" data-case="resolve-yes">Yes, resolved</button><button type="button" class="linkbtn" data-case="resolve-no">Not yet</button></div></div>`:""}
    ${f==="draft"?draftBox(c):""}
    ${f==="contact"?contactForm():f==="evidence"?evidenceForm():f==="edit"?factsForm(c):""}
    <section><h2>Timeline</h2>${tl.length?`<ol class="cs-tl" data-case-tl>${tl.map(([t])=>`<li class="${t.by==="them"?"them":"me"}"><b>${fmt(t.at)} · ${esc(t.channel||"")} · ${t.by==="them"?"they":"me"}${t.person?` (${esc(t.person)})`:""}</b>
      ${t.they_said?`<p>They: ${esc(t.they_said)}</p>`:""}${t.i_said?`<p>Me: ${esc(t.i_said)}</p>`:""}</li>`).join("")}</ol>`:`<p class="cs-note">No contact logged yet.</p>`}</section>
    <section><h2>Facts</h2><div class="cs-box"><dl class="cs-facts">${facts.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      <div class="acts"><button type="button" class="linkbtn" data-case="edit">Edit facts</button></div></div></section>
    ${wins.length?`<section><h2>Legal windows</h2><div class="cs-box">${wins.map(d=>`<div class="cs-next${d.date&&d.date<R2.todayIso()?" cs-late":""}" data-case-win>${esc(d.title)} · ${fmt(d.date)}</div>`).join("")}
      <p class="cs-note">EU online purchases usually have 14 days to cancel from delivery. Check the seller's terms.</p></div></section>`:""}
    <section><h2>Evidence</h2><div class="cs-box">${(c.evidence||[]).length?`<ul class="cs-ev" data-case-ev>${c.evidence.map(e=>{const u=safeUrl(e.ref);
      return `<li>${esc(e.kind||"link")}: ${u?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(e.ref)}</a>`:esc(e.ref||"")}${e.note?` · ${esc(e.note)}`:""}</li>`}).join("")}</ul>`:`<p class="cs-note">Photos of the fault, order email, chat transcript links.</p>`}
      <div class="acts"><button type="button" class="linkbtn" data-case="evidence">+ Add link or note</button></div></div></section>`;
}

/* ---- actions ---- */
const formVals=form=>Object.fromEntries(new FormData(form).entries());
function factsFrom(v){
  const s=k=>String(v[k]||"").trim(), n=k=>s(k)===""?null:Math.max(0,+s(k));
  const want=[v.want||"",s("want_text")].filter(Boolean).join(" · ");
  const f={seller:s("seller"),product:s("product"),bought_where:s("bought_where"),order_date:isDate(v.order_date)?v.order_date:null,
    delivery_date:isDate(v.delivery_date)?v.delivery_date:null,price:n("price"),return_days:n("return_days")||null,problem:s("problem"),want};
  f.title=titleOf(f); return f;
}
const go=(patch)=>{Object.assign(ui,patch);render();window.scrollTo(0,0)};
window.openCase=id=>{ui={mode:"detail",id:+id,form:null,confirm:false};view="cases";render();window.scrollTo(0,0)};

document.addEventListener("submit",async e=>{
  const fm=e.target; if(!["caseform","casecontact","caseev"].includes(fm.id))return; e.preventDefault();
  if(typeof backend==="undefined"||!backend||!window.R2)return;
  const v=formVals(fm), btn=fm.querySelector("[type=submit]"); if(btn)btn.disabled=true;
  if(fm.id==="caseform"){
    const f=factsFrom(v); if(!f.seller&&!f.product&&!f.problem){if(btn)btn.disabled=false;toast("Add the seller, product or problem",false);return}
    if(fm.dataset.mode==="edit"&&cur()){await R2.update(ui.id,f,"Saved ✓ case facts");await syncWindows(ui.id);ui.form=null;render();return}
    const r=await R2.create("case",Object.assign(f,{area:"shopping",status:"open",escalation:1,waiting_on:"me",timeline:[],evidence:[],links:[],
      next_action:RUNGS[1].next,next_action_date:R2.todayIso()}),"Saved ✓ case opened");
    await syncWindows(r.id); go({mode:"detail",id:r.id,form:null,confirm:false}); return;
  }
  const c=cur(); if(!c)return;
  if(fm.id==="casecontact"){
    const me=v.by!=="them", t={at:isDate(v.at)?v.at:R2.todayIso(),channel:CHANNELS.includes(v.channel)?v.channel:"email",person:String(v.person||"").trim(),
      they_said:String(v.they_said||"").trim(),i_said:String(v.i_said||"").trim(),by:me?"me":"them"};
    const nd=isoOf(R2.addWorkingDays(todayDate(),me?5:2));
    await R2.update(c.id,{timeline:[...(c.timeline||[]),t],waiting_on:me?"them":"me",status:OPEN(c)?(me?"waiting":"open"):c.status,
      next_action:me?"Chase if no reply":"Reply",next_action_date:nd},`Contact logged ✓ · next ${fmt(nd)}`);
  }else{
    const ref=String(v.ref||"").trim(), note=String(v.note||"").trim(); if(!ref&&!note){if(btn)btn.disabled=false;return}
    await R2.update(c.id,{evidence:[...(c.evidence||[]),{kind:["photo","video","email","link"].includes(v.kind)?v.kind:"link",ref,note}]},"Evidence added ✓");
  }
  ui.form=null; render();
});
document.addEventListener("click",async e=>{
  const nav=e.target.closest&&e.target.closest("[data-v=cases]"); if(nav){ui={mode:"list",id:null,form:null,confirm:false};return} // runs before the page's menu handler
  const o=e.target.closest&&e.target.closest("[data-case-open]"); if(o){window.openCase(+o.dataset.caseOpen);return}
  const cp=e.target.closest&&e.target.closest("[data-case-copy]");
  if(cp){try{await navigator.clipboard.writeText(document.getElementById(cp.dataset.caseCopy).textContent);cp.textContent="Copied ✓"}catch(_){toast("Long-press to copy",false)}return}
  const b=e.target.closest&&e.target.closest("[data-case]"); if(!b)return;
  const a=b.dataset.case;
  if(a==="new")return go({mode:"new",form:null});
  if(a==="list")return go({mode:"list",id:null,form:null,confirm:false});
  if(a==="cancel"){if(ui.mode==="new")return go({mode:"list"});ui.form=null;render();return}
  if(a==="close-form"){ui.form=null;render();return}
  if(["contact","evidence","edit","draft"].includes(a)){ui.form=ui.form===a?null:a;ui.confirm=false;render();return}
  if(typeof backend==="undefined"||!backend||!window.R2)return;
  const c=cur(); if(!c)return;
  if(a==="sent"){ // the drafted message went out: log it and start the 5-working-day clock
    const m=CaseDraft.draft(c,settings.name||""), nd=isoOf(R2.addWorkingDays(todayDate(),5));
    ui.form=null;
    await R2.update(c.id,{timeline:[...(c.timeline||[]),{at:R2.todayIso(),channel:m.kind==="email"?"email":"web form",person:"",they_said:"",i_said:m.subject,by:"me"}],
      waiting_on:"them",status:"waiting",next_action:"Chase if no reply",next_action_date:nd},`Logged ✓ · chase on ${fmt(nd)}`);return}
  if(a==="escalate"){const n=Math.min(4,(+c.escalation||1)+1); if(n===+c.escalation)return;ui.form=null;
    await R2.update(c.id,{escalation:n,next_action:RUNGS[n].next,next_action_date:R2.todayIso(),waiting_on:"me",status:"open"},`Step ${n}: ${RUNGS[n].t} · Undo`);return}
  if(a==="resolve"){ui.confirm=true;ui.form=null;render();return}
  if(a==="resolve-no"){ui.confirm=false;render();return}
  if(a==="resolve-yes"){ui.confirm=false;await R2.update(c.id,{status:"done"},"Case resolved ✓ · Undo");return}
  if(a==="reopen"){await R2.update(c.id,{status:"open",waiting_on:c.waiting_on||"me"},"Case reopened");return}
});

window.EXTRA_VIEWS=window.EXTRA_VIEWS||{};
EXTRA_VIEWS.cases={title:"Cases",
  menu:{icon:"⚖️",title:"Cases",sub:"Disputes, refunds, claims"},
  render(all){
    if(!window.R2)return `<p class="covers">Cases need the v4 records module.</p>`;
    if(ui.mode==="detail"&&!cur())ui.mode="list";
    return `<div class="cs">${ui.mode==="new"?factsForm(null):ui.mode==="detail"?vDetail(cur()):vList(all)}</div>`},
  mount(){},
  _test:{RUNGS,titleOf,factsFrom,syncWindows,state:()=>ui}};
})();
