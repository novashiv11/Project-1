/* Focus: one task at a time as a swipeable card stack (year-3000 aurora theme).
   Loaded before the page script; page globals (items, complete, change, …) are only touched at call time. */
(()=>{
const css=`
.stk-stage{position:relative;overflow:hidden;border-radius:30px;background:#07070c;color:#fff;min-height:min(640px,calc(100svh - 150px));
  padding:16px 16px 18px;display:flex;flex-direction:column;gap:12px;isolation:isolate;font-family:"Space Grotesk",system-ui,sans-serif}
.stk-mesh{position:absolute;inset:0;z-index:-1;opacity:.78;pointer-events:none;
  background:radial-gradient(60% 40% at 12% 6%,#ff6b3d,transparent 70%),radial-gradient(60% 45% at 98% 32%,#7a5cff,transparent 70%),radial-gradient(75% 45% at 50% 104%,#00d5a8,transparent 70%)}
.stk-hud{display:flex;justify-content:space-between;align-items:center;gap:12px}
.stk-lv{font:800 13px/1 system-ui,sans-serif;letter-spacing:.08em;background:#ffffff22;border:1px solid #ffffff44;border-radius:99px;padding:9px 14px;white-space:nowrap;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.stk-xp{flex:0 1 120px;height:8px;border-radius:9px;background:#ffffff2a;overflow:hidden}.stk-xp i{display:block;height:100%;background:#fff;border-radius:9px;transition:width .4s}
.stk-deck{position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;padding:10px 4px 22px}
.stk-ghost{position:absolute;left:4px;right:4px;top:10px;bottom:22px;border-radius:30px;pointer-events:none;transform-origin:50% 100%}
.stk-ghost.g1{background:#ffffff4d;transform:translateY(11px) scale(.94)}
.stk-ghost.g2{background:#ffffff26;transform:translateY(22px) scale(.88)}
.stk-card{position:relative;z-index:2;min-height:340px;background:#f7f5ff;color:#10131a;border-radius:32px;box-shadow:0 30px 80px #0009;
  padding:22px 20px;display:flex;flex-direction:column;touch-action:pan-y;user-select:none;-webkit-user-select:none;cursor:grab;will-change:transform}
.stk-card.stk-drag{cursor:grabbing}
.stk-card.stk-back{transition:transform .22s ease-out}
.stk-card.stk-fly-r{transition:transform .34s ease-in,opacity .34s ease-in;transform:translateX(130%) rotate(18deg);opacity:0}
.stk-card.stk-fly-l{transition:transform .34s ease-in,opacity .34s ease-in;transform:translateX(-130%) rotate(-18deg);opacity:0}
.stk-tag{font:500 12px/1.3 ui-monospace,"JetBrains Mono",monospace;letter-spacing:.14em;color:#6b4dff;text-transform:uppercase}
.stk-big{font:800 30px/1.05 system-ui,sans-serif;letter-spacing:-.03em;margin-top:12px;overflow-wrap:anywhere}
.stk-meta{margin-top:10px;font-size:15px;line-height:1.35;color:#4a4f63}
.stk-pill{align-self:flex-start;margin-top:12px;color:#fff;font:700 14px system-ui,sans-serif;padding:8px 14px;border-radius:99px;background:#7a5cff}
.stk-pill.late{background:#e5334f}.stk-pill.hot{background:#ff6b3d}.stk-pill.calm{background:#5b6075}
.stk-steps{margin-top:auto;padding-top:14px;display:grid;gap:6px;font-size:13px;line-height:1.35;color:#2b3042}
.stk-step{background:#ece8ff;border-radius:14px;padding:8px 11px}
.stk-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
.stk-cal{display:inline-flex;margin-top:10px;font:600 13px system-ui,sans-serif;color:inherit;opacity:.75;text-decoration:none;min-height:34px;align-items:center}
.stk-links a{background:#10131a;color:#fff;text-decoration:none;font:700 12px system-ui,sans-serif;padding:8px 12px;border-radius:99px;min-height:34px;display:inline-flex;align-items:center}
.stk-stamp{position:absolute;top:22px;right:18px;transform:rotate(14deg) scale(1.4);border:3px solid #00a884;color:#00a884;font:800 22px system-ui,sans-serif;
  padding:4px 12px;border-radius:12px;opacity:0;pointer-events:none;background:#f7f5ffd0}
.stk-stamp.kal{left:18px;right:auto;transform:rotate(-14deg) scale(1.4);border-color:#7a5cff;color:#7a5cff}
.stk-card.stk-done .stk-stamp:not(.kal){opacity:1;transform:rotate(14deg) scale(1);transition:transform .18s cubic-bezier(.3,1.6,.6,1),opacity .12s}
.stk-acts{display:flex;justify-content:center;align-items:center;gap:22px}
.stk-acts button{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;font:400 24px/1 system-ui,sans-serif;background:#ffffff1f;
  border:1px solid #ffffff44;color:#fff;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);padding:0}
.stk-acts button.stk-ok{width:72px;height:72px;background:#00d5a8;border:0;color:#04261d;font-size:32px;box-shadow:0 0 40px #00d5a8aa}
.stk-acts button:focus-visible,.stk-links a:focus-visible,.stk-home:focus-visible{outline:3px solid #fff;outline-offset:3px}
.stk-acts button:disabled{opacity:.35}
.stk-lbl{text-align:center;font:500 11px ui-monospace,"JetBrains Mono",monospace;letter-spacing:.16em;color:#ffffffb8}
.stk-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:14px;position:relative}
.stk-empty h2{font:800 36px/1.1 system-ui,sans-serif;letter-spacing:-.02em;margin:0;color:#fff;text-transform:none}
.stk-empty p{margin:0;color:#ffffffc8;max-width:280px}
.stk-again{background:#ffffff1f;color:#fff;border:1px solid #ffffff44;border-radius:99px;padding:10px 18px;font:700 14px system-ui,sans-serif}
.stk-home{background:#fff;color:#10131a;border-radius:99px;padding:13px 22px;font:700 16px system-ui,sans-serif;margin-top:6px}
.stk-conf{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.stk-conf i{position:absolute;top:-16px;left:var(--x);width:8px;height:14px;border-radius:2px;background:var(--c);opacity:0;
  animation:stk-fall 1.8s var(--d) cubic-bezier(.2,.6,.4,1) forwards}
@keyframes stk-fall{0%{opacity:1;transform:translateY(0) rotate(0)}100%{opacity:0;transform:translateY(560px) rotate(var(--r))}}
@media (prefers-reduced-motion:reduce){
  .stk-card,.stk-card.stk-back,.stk-xp i{transition:none!important}
  .stk-card.stk-fly-r,.stk-card.stk-fly-l{transition:none;transform:none;opacity:0}
  .stk-card.stk-done .stk-stamp:not(.kal){transition:none}
  .stk-conf{display:none}}
`;
document.head.insertAdjacentHTML("beforeend",`<style>${css}</style>`);

const S={done:0,deferred:[],pinned:null,hist:[],busy:false};      // this Focus session
const still=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const WD=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function queue(all,today){
  const open=all.filter(i=>!i.done&&!isFood(i)), dated=openDated(open), used=new Set();
  const take=f=>dated.filter(i=>!used.has(i.id)&&f(i)).map(i=>(used.add(i.id),i));
  const q=[...take(i=>daysLeft(i,today)<0),...take(i=>daysLeft(i,today)===0),...take(i=>windowOpen(i,today)),
    ...take(i=>daysLeft(i,today)<=7),...open.filter(i=>!i.due&&(i.created||"").slice(0,10)>=iso(addDays(today,-14))).sort((a,b)=>b.id-a.id)]; // old undated notes stay in the list, not in Focus
  const later=S.deferred.map(id=>q.find(i=>i.id===id)).filter(Boolean);
  let out=[...q.filter(i=>!later.includes(i)),...later];
  const pin=S.pinned!=null&&items.get(S.pinned);
  if(pin&&!pin.done)out=[pin,...out.filter(i=>i.id!==pin.id)];else S.pinned=null;
  return out.slice(0,12);
}
function urgency(it,today){
  if(!it.due)return ["anytime","calm"];
  const n=daysLeft(it,today);
  if(n<0)return [`${-n}d late`,"late"];
  if(n===0)return ["today","hot"];
  if(windowOpen(it,today))return [`${n} days left`,"hot"];
  if(n===1)return ["kal",""];
  return [`${n} days left`,""];
}
function metaLine(it,today){
  const out=[];
  if(it.due){const n=daysLeft(it,today),d=fromIso(it.due);
    out.push((n===0?"Today":n===1?"Kal":n>1&&n<=6?WD[d.getDay()]:`${d.getDate()} ${MON_SHORT[d.getMonth()]}${d.getFullYear()!==today.getFullYear()?" "+d.getFullYear():""}`)
      +(it.due.includes("T")?" · "+it.due.slice(11):""));
    if(windowOpen(it,today))out.push("window open: start now");}
  else out.push("No date. Jab time mile.");
  if(it.repeat)out.push(it.repeat.every>1?`every ${it.repeat.every} ${it.repeat.unit}s`:`every ${it.repeat.unit}`);
  return out.join(" · ");
}
function cardHtml(it,i,n,today){
  const a=area(it.domain), g=guideFor(it), [pill,cls]=urgency(it,today), num="①②";
  const steps=g?`<div class="stk-steps">${g.steps.slice(0,2).map((s,k)=>`<div class="stk-step">${num[k]} ${esc(s)}</div>`).join("")}
    ${g.links.length?`<div class="stk-links">${g.links.map(l=>`<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join("")}</div>`:""}</div>`:"";
  return `<article class="stk-card" data-stk-id="${it.id}" aria-label="${esc(it.text)}">
    <span class="stk-tag">${i} OF ${n} · ${esc(a.icon)} ${esc(a.label)}</span>
    <div class="stk-big">${esc(it.text)}</div><div class="stk-meta">${esc(metaLine(it,today))}</div>
    <span class="stk-pill ${cls}">${esc(pill)}</span>${steps}
    ${it.due&&typeof gcalUrl==="function"?`<a class="stk-cal" href="${esc(gcalUrl(it))}" target="_blank" rel="noopener">📅 Calendar mein daalo</a>`:""}
    <span class="stk-stamp" aria-hidden="true">HO GAYA</span><span class="stk-stamp kal" aria-hidden="true">${it.due?"KAL":"BAAD MEIN"}</span></article>`;
}
function confetti(){
  const cs=["#ff6b3d","#7a5cff","#00d5a8","#ffd23f","#ff4d8d","#ffffff"];
  return `<div class="stk-conf" aria-hidden="true">${Array.from({length:28},(_,k)=>
    `<i style="--x:${(k*37)%100}%;--d:${(k%7)*.09}s;--c:${cs[k%cs.length]};--r:${(k%2?1:-1)*(180+k*23)}deg"></i>`).join("")}</div>`;
}

function renderStack(all,today){
  if(!document.querySelector("#view .stk-stage"))Object.assign(S,{done:0,deferred:[],hist:[],busy:false}); // fresh visit
  if(window.STACK_START!=null){S.pinned=+window.STACK_START;window.STACK_START=null}
  const xp=+settings.xp||0, lvl=Math.floor(xp/100)+1, q=queue(all,today), total=S.done+q.length;
  const hud=`<div class="stk-hud"><span class="stk-lv">LVL ${lvl} · 🔥 ${streak(all,today)}</span>
    <span class="stk-xp" role="progressbar" aria-label="XP to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${xp%100}"><i style="width:${xp%100}%"></i></span></div>`;
  if(!q.length)return `<div class="stk-stage">${S.done?confetti():""}<div class="stk-mesh"></div>${hud}
    <div class="stk-empty"><h2>Sab ho gaya 🎉</h2><p>${S.done?`${S.done} kaam khatam, +${S.done*10} XP. Ab aaram karo.`:"Abhi kuch pending nahi. Naya kaam aaye toh yahan dikhega."}</p>
    <button class="stk-home" data-v="home">← Back home</button>
    ${S.hist.length?`<button class="stk-again" data-stk="undo" aria-label="Undo last action">↺ Undo</button>`:""}</div></div>`;
  const it=q[0], ghosts=Math.min(2,q.length-1);
  return `<div class="stk-stage"><div class="stk-mesh"></div>${hud}
    <div class="stk-deck">${ghosts>1?'<div class="stk-ghost g2"></div>':""}${ghosts>0?'<div class="stk-ghost g1"></div>':""}${cardHtml(it,S.done+1,total,today)}</div>
    <div class="stk-acts"><button data-stk="undo" aria-label="Undo last action">↺</button>
      <button class="stk-ok" data-stk="done" aria-label="Done: ${esc(it.text)}">✓</button>
      <button data-stk="later" aria-label="Later: ${esc(it.text)}">⏭</button></div>
    <div class="stk-lbl">SWIPE → DONE · ← ${it.due?"KAL":"BAAD MEIN"}</div></div>`;
}

async function done(id,card){
  if(S.busy||!backend||!items.get(id))return; S.busy=true;
  try{
    buzz(15);
    settings.xp=(+settings.xp||0)+10; saveSettings();
    if(card){card.style.transform="";card.classList.add("stk-done");await wait(still()?160:320);if(!still())card.classList.add("stk-fly-r");await wait(still()?0:260)}
    if(S.pinned===id)S.pinned=null;
    S.done++; await complete(id); S.hist.push({kind:"done",depth:undoStack.length});
  }finally{S.busy=false}
  render();
}
async function later(id,card){
  if(S.busy||!backend)return; const cur=items.get(id); if(!cur)return; S.busy=true;
  try{
    buzz([8,40,8]);
    if(card&&!still()){card.classList.add("stk-fly-l");await wait(280)}
    if(S.pinned===id)S.pinned=null;
    S.deferred=S.deferred.filter(x=>x!==id).concat(id);
    if(cur.due){const it=clone(cur); const [d,t]=it.due.split("T"); it.due=iso(addDays(fromIso(d),1))+(t?"T"+t:"");
      await change(id,it,"Kal tak 💤"); S.hist.push({kind:"later",id,depth:undoStack.length})}
    else{S.hist.push({kind:"skip",id,depth:null});toast("Baad mein ⏭",false)}
  }finally{S.busy=false}
  render();
}
async function back(){
  if(S.busy||!backend)return;
  const h=S.hist[S.hist.length-1];
  if(h&&h.kind==="skip"){S.hist.pop();S.deferred=S.deferred.filter(x=>x!==h.id);render();return}
  if(h&&h.depth===undoStack.length){S.hist.pop();
    if(h.kind==="done"){settings.xp=Math.max(0,(+settings.xp||0)-10);saveSettings();S.done=Math.max(0,S.done-1)}
    else S.deferred=S.deferred.filter(x=>x!==h.id);}
  await undo(); render();
}

function mount(root){
  root.querySelectorAll("[data-stk]").forEach(b=>b.addEventListener("click",e=>{
    e.stopPropagation(); const card=root.querySelector(".stk-card"), id=card?+card.dataset.stkId:null;
    if(b.dataset.stk==="done"&&id!=null)done(id,card);
    else if(b.dataset.stk==="later"&&id!=null)later(id,card);
    else if(b.dataset.stk==="undo")back();
  }));
  const card=root.querySelector(".stk-card"); if(!card)return;
  const tilt=!still(), id=+card.dataset.stkId, ok=card.querySelector(".stk-stamp:not(.kal)"), kal=card.querySelector(".stk-stamp.kal");
  let x0=0,y0=0,dx=0,pid=null,locked=null;
  const reset=()=>{card.classList.remove("stk-drag");card.classList.add("stk-back");card.style.transform="";ok.style.opacity="";kal.style.opacity="";
    setTimeout(()=>card.classList.remove("stk-back"),240)};
  card.addEventListener("pointerdown",e=>{
    if(S.busy||e.target.closest("a,button")||(e.pointerType==="mouse"&&e.button!==0))return;
    pid=e.pointerId;x0=e.clientX;y0=e.clientY;dx=0;locked=null;
    try{card.setPointerCapture(pid)}catch(_){}
  });
  card.addEventListener("pointermove",e=>{
    if(e.pointerId!==pid)return; const mx=e.clientX-x0,my=e.clientY-y0;
    if(locked===null&&(Math.abs(mx)>8||Math.abs(my)>8))locked=Math.abs(mx)>Math.abs(my);
    if(!locked)return; dx=mx; card.classList.add("stk-drag");
    card.style.transform=`translateX(${dx}px)${tilt?` rotate(${Math.max(-18,Math.min(18,dx/14))}deg)`:""}`;
    ok.style.opacity=String(Math.max(0,Math.min(1,dx/90)));kal.style.opacity=String(Math.max(0,Math.min(1,-dx/90)));
  });
  const end=e=>{
    if(e.pointerId!==pid)return; pid=null; card.classList.remove("stk-drag");
    if(locked&&dx>90){ok.style.opacity="";done(id,card)}
    else if(locked&&dx<-90){kal.style.opacity="";card.style.transform="";later(id,card)}
    else reset();
  };
  card.addEventListener("pointerup",end);card.addEventListener("pointercancel",end);
}

window.EXTRA_VIEWS=window.EXTRA_VIEWS||{};
EXTRA_VIEWS.stack={title:"Focus",render:renderStack,mount};
})();
