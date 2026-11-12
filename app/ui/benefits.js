/* Claim: what you're owed. Profile (entered once) → eligibility per scheme → find a provider → draft the booking email → mark booked → reminder for next time.
   Rules and drafts are deterministic (entitle-core.js + schemes.js); nothing here calls an AI. Profile and claims stay in settings on this phone. */
(()=>{
const css=`
.bn{display:grid;gap:12px;min-width:0}.bn *{min-width:0}
.bn-card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:14px;display:grid;gap:8px}
.bn-card h3{margin:0;font:700 17px var(--display)}
.bn-tag{justify-self:start;font:600 11px var(--mono);padding:3px 9px;border-radius:99px;background:var(--chip);color:var(--muted)}
.bn-tag.yes{background:#123f2f;color:#5fe0b0}.bn-tag.no{background:#3d1c1c;color:#ff9c8f}.bn-tag.need{background:#3d3212;color:#f3c969}
.bn-sub{color:var(--muted);font-size:14px}
.bn-form{display:grid;gap:8px}.bn-form label{display:grid;gap:4px;font-size:13px;color:var(--muted)}
.bn-form input,.bn-form select,.bn-form textarea{min-width:0;padding:10px;border-radius:10px;border:1px solid var(--line);background:var(--bg);color:var(--fg);font:15px var(--body)}
.bn-step{display:grid;gap:8px;padding-top:8px;border-top:1px solid var(--line)}.bn-step b{font:600 12px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.bn-copy{display:grid;gap:4px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:10px;font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}
.bn-copy small{display:flex;justify-content:space-between;color:var(--muted);font:11px var(--mono)}
.bn-btns{display:flex;gap:8px;flex-wrap:wrap}.bn-btns a{text-decoration:none}`;
document.head.insertAdjacentHTML("beforeend",`<style>${css}</style>`);
const E=()=>window.EntitleCore, schemes=()=>window.SCHEMES||[];
const P=()=>settings.profile||(settings.profile={}), claims=()=>settings.claims||(settings.claims={});
const today=()=>R2.todayIso();
const FIELDS={ // the questions, asked once
  town:{q:"Town or area (for finding nearby clinics)",type:"text",ph:"e.g. Galway city"},
  work:{q:"Work",type:"select",opts:[["","Choose…"],["employee","Employee (PAYE, paying PRSI)"],["self","Self-employed"],["other","Not working / other"]]},
  age_band:{q:"Age",type:"select",opts:[["","Choose…"],["u21","Under 21"],["21-24","21–24"],["25-28","25–28"],["29-65","29–65"],["66+","66 or over"]]},
  prsi_years:{q:"Years you've paid PRSI in Ireland (roughly)",type:"number",ph:"e.g. 4"},
  prsi_recent:{q:()=>`Did you pay PRSI for most of ${+today().slice(0,4)-2}? (about 9 months or more)`,type:"select",opts:[["","Choose…"],["yes","Yes"],["no","No"]]}
};
let openId=null, editProfile=false, draftFor={}; // draftFor[id]={emails,when,phone}

const statusOf=s=>E().check(P(),s);
const TAG={yes:["yes","You qualify"],no:["no","You don't qualify"],need:["need","Need 1 answer"]};
function field(k){const f=FIELDS[k],v=P()[k]==null?"":P()[k];
  return `<label>${esc(typeof f.q==="function"?f.q():f.q)}${f.type==="select"?`<select data-bn-f="${k}">${f.opts.map(([a,b])=>`<option value="${a}"${String(v)===a?" selected":""}>${esc(b)}</option>`).join("")}</select>`
    :`<input data-bn-f="${k}" type="${f.type}" ${f.type==="number"?'inputmode="numeric" min="0"':""} value="${esc(v)}" placeholder="${esc(f.ph||"")}">`}</label>`}
const profileForm=()=>`<form class="bn-card bn-form" id="bnProfile"><h3>About you · asked once</h3>
  <span class="bn-sub">Stays on this phone. No PPS number needed, ever.</span>${Object.keys(FIELDS).map(field).join("")}
  <button class="go" style="padding:12px" type="submit">Save and check</button></form>`;
const filled=()=>Object.keys(FIELDS).every(k=>!(P()[k]==null||P()[k]===""));

function card(s){
  const st=statusOf(s), [cls,label]=TAG[st.status], c=claims()[s.id], next=c&&E().nextEligible(s,c.last), avail=E().available(s,claims(),today());
  const used=c&&!avail?`<span class="bn-sub">Used ${esc(c.last)} · free again from ${esc(next)}</span>`:"";
  return `<div class="bn-card"><span class="bn-tag ${used?"":cls}">${used?"Used":label}</span><h3>${esc(s.icon||"💶")} ${esc(s.name)}</h3>
    <span>${esc(s.get)}</span>${st.status==="no"?`<span class="bn-sub">Why: ${esc(st.reason)}</span>`:""}${used}
    ${st.status==="need"?`<div class="bn-form">${FIELDS[st.ask.field]?field(st.ask.field):""}<button class="go" style="padding:10px" data-bn-save1>Check</button></div>`:""}
    ${st.status==="yes"&&avail?`<button class="go" style="padding:12px" data-bn-open="${s.id}">${esc(s.cta||"Book it")} →</button>`:""}
    <a class="bn-sub" href="${esc(s.source)}" target="_blank" rel="noopener">Official rules ↗ · checked ${esc(s.verified)}</a></div>`;
}
const copyBlock=(label,text,id)=>`<div class="bn-copy"><small><span>${label}</span><button class="linkbtn" style="padding:0" data-bn-copy="${id}">Copy</button></small><span id="${id}">${esc(text)}</span></div>`;
// The copy blocks and mail button, redrawn on every keystroke without touching the inputs (so the keyboard stays open).
function draftHTML(s){
  const d=draftFor[s.id], list=E().emails(d.emails), m=E().draft(s,P(),settings.name||"",d);
  return `${list.length>1?copyBlock("BCC",list.join(", "),"bnBcc"):list.length?copyBlock("To",list[0],"bnBcc"):""}
      ${copyBlock("Subject",m.subject,"bnSub")}${copyBlock("Message",m.body,"bnBody")}
      <a class="go" style="padding:12px;text-align:center;text-decoration:none" id="bnMail" href="${esc(E().mailto(list,m.subject,m.body))}">Open in email app${list.length>1?` · BCC ${list.length}`:""}</a>`;
}
function detail(s){
  const d=draftFor[s.id]||(draftFor[s.id]={emails:"",when:"",phone:""}), town=P().town||"";
  return `<button class="linkbtn" data-bn-back>← All</button>
  <div class="bn-card"><span class="bn-tag yes">You qualify</span><h3>${esc(s.icon||"💶")} ${esc(s.name)}</h3><span>${esc(s.get)}</span><span class="bn-sub">⚠ ${esc(s.catch)}</span>
    <div class="bn-step"><b>1 · Find a ${esc(s.provider)}</b><div class="bn-btns">
      <a class="go" style="padding:10px 14px" href="${esc(E().mapsUrl(s.provider,town))}" target="_blank" rel="noopener">Near ${esc(town||"me")} on Maps ↗</a>
      ${s.panel?`<a class="linkbtn" href="${esc(s.panel)}" target="_blank" rel="noopener">Official list ↗</a>`:""}
      ${s.book?`<a class="linkbtn" href="${esc(s.book.url)}" target="_blank" rel="noopener">${esc(s.book.label)} ↗</a>`:""}</div>
      <span class="bn-sub">${esc(s.providerTip||"Ask when you call or email: “Do you take PRSI patients?”")}</span></div>
    <div class="bn-step bn-form"><b>2 · Email up to 3 at once</b>
      <label>Their emails (comma or space between)<textarea rows="2" data-bn-d="emails" placeholder="reception@clinic-one.ie, info@clinic-two.ie">${esc(d.emails)}</textarea></label>
      <label>When are you free? (optional)<input data-bn-d="when" value="${esc(d.when)}" placeholder="weekday mornings, any day after 4pm"></label>
      <label>Your phone (optional)<input data-bn-d="phone" inputmode="tel" value="${esc(d.phone)}"></label>
      <div id="bnDraft" style="display:grid;gap:8px">${draftHTML(s)}</div>
      <span class="bn-sub">Your PPS number is never put in the email. The clinic asks for it at the visit.</span></div>
    <div class="bn-step bn-form"><b>3 · Booked?</b>
      <label>Appointment date<input type="date" data-bn-date value="${today()}"></label>
      <button class="go" style="padding:12px" data-bn-done="${s.id}">Mark booked · remind me next time</button></div>
    <a class="bn-sub" href="${esc(s.source)}" target="_blank" rel="noopener">Official rules ↗ · checked ${esc(s.verified)}</a></div>`;
}
function screen(){
  if(!E()||!schemes().length)return `<p class="bn-sub">No schemes loaded.</p>`;
  const s=openId&&schemes().find(x=>x.id===openId);
  if(s&&statusOf(s).status==="yes")return `<div class="bn">${detail(s)}</div>`;
  const order={yes:0,need:1,no:2}, list=[...schemes()].sort((a,b)=>order[statusOf(a).status]-order[statusOf(b).status]);
  return `<div class="bn">${!filled()||editProfile?profileForm():""}${list.map(card).join("")}
    ${filled()&&!editProfile?`<button class="linkbtn" data-bn-edit>Edit my answers</button>`:""}</div>`;
}
function readFields(root){root.querySelectorAll("[data-bn-f]").forEach(el=>{const k=el.dataset.bnF;let v=el.value.trim();
  P()[k]=FIELDS[k].type==="number"?(v===""?null:+v):v});saveSettings()}
async function markBooked(id){
  const s=schemes().find(x=>x.id===id), date=(document.querySelector("[data-bn-date]")||{}).value||today();
  claims()[id]={last:date};saveSettings();
  const next=E().nextEligible(s,date);
  await R2.create("deadline",{title:`${s.short||s.name}: free again`,area:"health",date:next,date_known:true,remind_before_days:14,action_when_due:"Book the next one"},
    `Booked ✓ Reminder set for ${next}`);
  openId=null;render();
}
document.addEventListener("input",e=>{const t=e.target;if(!(t.dataset&&t.dataset.bnD&&openId))return;
  (draftFor[openId]=draftFor[openId]||{})[t.dataset.bnD]=t.value;
  const box=document.getElementById("bnDraft"),s=schemes().find(x=>x.id===openId);if(box&&s)box.innerHTML=draftHTML(s)});
document.addEventListener("submit",e=>{if(e.target.id!=="bnProfile")return;e.preventDefault();readFields(e.target);editProfile=false;render();toast("Saved ✓ Checking what you're owed",false)});
document.addEventListener("click",async e=>{const b=e.target.closest&&e.target.closest("button");if(!b)return;
  if(b.dataset.bnOpen){openId=b.dataset.bnOpen;view_("benefits");return}
  if(b.hasAttribute("data-bn-back")){openId=null;render();window.scrollTo(0,0);return}
  if(b.hasAttribute("data-bn-edit")){editProfile=true;render();return}
  if(b.hasAttribute("data-bn-save1")){readFields(b.closest(".bn-card"));render();return}
  if(b.dataset.bnCopy){const el=document.getElementById(b.dataset.bnCopy);try{await navigator.clipboard.writeText(el.textContent);b.textContent="Copied ✓"}catch(_){toast("Long-press to copy",false)}return}
  if(b.dataset.bnDone){await markBooked(b.dataset.bnDone);return}
});
function view_(v){view=v;render();window.scrollTo(0,0)}

// Home feed: at most 2 claim cards.
(window.LIFEOS_CLAIMS=window.LIFEOS_CLAIMS||[]).push(()=>{
  if(!E()||!schemes().length)return [];
  if(!filled())return [{title:"Check what you're owed · 2 min",sub:schemes().map(s=>s.short).join(", "),action:`<button class="td-ok" data-v="benefits" aria-label="Open Claim">›</button>`}];
  return schemes().filter(s=>statusOf(s).status==="yes"&&E().available(s,claims(),today())).slice(0,2).map(s=>({title:`${s.short}: ${s.teaser}`,
    sub:E().useItOrLoseIt(s,claims(),today())?"Resets 1 Jan · use it before 31 Dec":"You qualify · not used yet",
    action:`<button class="td-ok" data-bn-open="${s.id}" aria-label="Book ${esc(s.short)}">›</button>`}));
});
// "dental check-up", "eye test?" typed anywhere → open that scheme.
window.ENT_ROUTE=text=>{const t=String(text||"").trim();if(!E()||t.split(/\s+/).length>8)return false;
  try{const p=parse(t,todayDate());if(p.due||p.repeat)return false}catch(_){} // anything with a date or repeat is an appointment to save, not a question
  const s=E().route(t,schemes());if(!s)return false;openId=statusOf(s).status==="yes"?s.id:null;view_("benefits");return true};

window.EXTRA_VIEWS=window.EXTRA_VIEWS||{};
EXTRA_VIEWS.benefits={title:"Claim",render:screen,mount(){},_test:{reset(){openId=null;editProfile=false;draftFor={}}}};
})();
