/* Orb home: a breathing orb with the most urgent open items floating around it as glass bubbles.
   Tap orb / "Shuru karo" → focus stack (or list). Hold orb ≥450ms → voice (mic) or typing.
   Loaded before the page script: page globals (items, daysLeft, esc…) are only used inside functions. */
(()=>{
const css=`
html:has(body[data-view="orb"]){background:#020306}
body[data-view="orb"]{background:transparent;color-scheme:dark;
  --bg:#05080f;--card:#0d1a26;--card2:#0d1a26;--fg:#eaf6ff;--muted:#7fb6c9;--line:rgb(255 255 255 / .14);
  --accent:#7ef3dc;--accent-ink:#04131a;--chip:rgb(255 255 255 / .08);--nav:#05080f;color:#eaf6ff}
body[data-view="orb"]::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:
   radial-gradient(1px 1px at 20% 30%,#fff8,transparent),radial-gradient(1px 1px at 70% 15%,#fff6,transparent),
   radial-gradient(1.5px 1.5px at 85% 60%,#9ff8,transparent),radial-gradient(1px 1px at 10% 75%,#fff5,transparent),
   radial-gradient(1px 1px at 55% 88%,#fff4,transparent),radial-gradient(1px 1px at 35% 52%,#fff3,transparent),
   radial-gradient(1px 1px at 92% 8%,#fff5,transparent),radial-gradient(1.5px 1.5px at 6% 42%,#b49bff88,transparent),
   radial-gradient(120% 70% at 50% 42%,#0f2b3a 0%,#05080f 60%,#020306 100%)}
body[data-view="orb"] .capbox{background:rgb(255 255 255 / .06);border-color:rgb(255 255 255 / .14);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.o3k{position:relative;display:grid;gap:14px;justify-items:center;color:#eaf6ff;min-width:0;
  font-family:"Atkinson Hyperlegible",system-ui,sans-serif;padding-bottom:8px}
.o3k button{font-family:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.o3k button:focus-visible{outline:2px solid #7ef3dc;outline-offset:3px}
.o3k-stage{position:relative;width:100%;height:340px;--os:min(190px,52vw)}
.o3k-ring{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:50%;border:1px solid #7ef3dc33;pointer-events:none}
.o3k-r1{width:calc(var(--os) * 1.32);height:calc(var(--os) * 1.32)}
.o3k-r2{width:calc(var(--os) * 1.66);height:calc(var(--os) * 1.66);border-style:dashed;border-color:#7ef3dc22}
.o3k-orb{position:absolute;left:50%;top:50%;width:var(--os);height:var(--os);margin:calc(var(--os) / -2) 0 0 calc(var(--os) / -2);
  border-radius:50%;border:0;padding:0;background:none;touch-action:manipulation;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
.o3k-core{position:absolute;inset:0;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle at 35% 30%,#e8fffb 0%,#7ef3dc 18%,#19b5c9 45%,#5b3fd8 75%,#1a0f4a 100%);
  box-shadow:0 0 60px 10px #2ad4d066,0 0 140px 30px #5b3fd844,inset -20px -30px 60px #1a0f4a;transition:box-shadow .3s}
.o3k-orb::after{content:"";position:absolute;inset:-10px;border-radius:50%;border:2px solid #7ef3dc;opacity:0;transform:scale(.92);transition:opacity .2s,transform .2s;pointer-events:none}
.o3k-orb.listening .o3k-core{box-shadow:0 0 80px 18px #2ad4d099,0 0 170px 40px #b49bff66,inset -20px -30px 60px #1a0f4a}
.o3k-orb.listening::after{opacity:.85;transform:scale(1)}
.o3k-bub{position:absolute;z-index:2;display:flex;max-width:60%;min-width:0;padding:0;border:0;background:none;border-radius:99px}
.o3k-pill{display:flex;align-items:center;gap:7px;min-width:0;max-width:100%;padding:9px 13px;border-radius:99px;
  background:rgb(255 255 255 / .07);border:1px solid rgb(255 255 255 / .16);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
  box-shadow:0 0 18px #2ad4d026;font:400 13px/1.2 "Atkinson Hyperlegible",system-ui,sans-serif;text-align:left;white-space:nowrap}
.o3k-bub .t{min-width:0;overflow:hidden;text-overflow:ellipsis}
.o3k-bub small{flex:none;font:500 11px "JetBrains Mono",ui-monospace,monospace;color:#7fb6c9;letter-spacing:.02em}
.o3k-bub small.hot{color:#ff9d7a}.o3k-bub small.warm{color:#ffd28a}
.o3k-dot{width:8px;height:8px;border-radius:50%;flex:none;box-shadow:0 0 8px currentColor}
.o3k-s0{left:0;top:4%}.o3k-s1{right:0;top:27%}.o3k-s2{left:0;top:66%}.o3k-s3{right:0;top:86%}
.o3k-say{margin:4px 0 0;text-align:center;font:400 25px/1.3 "Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.01em;padding:0 6px;overflow-wrap:anywhere}
.o3k-say b{font-weight:800;background:linear-gradient(90deg,#7ef3dc,#b49bff);-webkit-background-clip:text;background-clip:text;color:transparent}
.o3k-go{padding:13px 26px;border-radius:99px;border:0;background:linear-gradient(90deg,#7ef3dc,#9fb8ff);color:#04131a!important;
  font:800 16px "Bricolage Grotesque",system-ui,sans-serif;box-shadow:0 0 26px #2ad4d055}
.o3k-links{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}
.o3k-links button{background:none;border:0;padding:10px 12px;border-radius:12px;font:500 13px "JetBrains Mono",ui-monospace,monospace;color:#9fd3e4;letter-spacing:.02em}
.o3k-links button:hover{background:rgb(255 255 255 / .06)}
.o3k-hint{font:500 11px "JetBrains Mono",ui-monospace,monospace;letter-spacing:.18em;text-transform:uppercase;color:#7fb6c9aa;text-align:center}
@media (prefers-reduced-motion:no-preference){
  .o3k-core{animation:o3kBreathe 5s ease-in-out infinite}
  .o3k-orb.listening .o3k-core{animation:o3kBreathe 1.1s ease-in-out infinite}
  .o3k-pill{animation:o3kFloat 6s ease-in-out infinite}
  .o3k-s1 .o3k-pill{animation-delay:-1.5s}.o3k-s2 .o3k-pill{animation-delay:-3s}.o3k-s3 .o3k-pill{animation-delay:-4.5s}
}
@keyframes o3kBreathe{0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.045);filter:brightness(1.12)}}
@keyframes o3kFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
`;
document.head.insertAdjacentHTML("beforeend",`<style>${css}</style>`);
window.EXTRA_VIEWS=window.EXTRA_VIEWS||{};

const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const target=()=>window.EXTRA_VIEWS.stack?"stack":"today";
const short=(s,n=22)=>s.length>n?s.slice(0,n-1).trimEnd()+"…":s;

/* Most urgent open items: overdue, today, renewal window open, then the next 7 days (no food, no done). */
function urgent(all,today){
  const rank=it=>{const n=daysLeft(it,today);return n<0?0:n===0?1:windowOpen(it,today)?2:n<=7?3:9};
  return all.filter(i=>i.due&&!i.done&&!isFood(i)).map(it=>[rank(it),it]).filter(([r])=>r<9)
    .sort((a,b)=>a[0]-b[0]||a[1].due.localeCompare(b[1].due)).map(([r,it])=>({r,it}));
}
function label(it,today){
  const n=daysLeft(it,today);
  if(n<0)return [`${-n}d late`,"hot"];
  if(n===0)return [it.due.includes("T")?it.due.slice(11,16):"today","warm"];
  if(windowOpen(it,today))return ["start now","warm"];
  if(n===1)return ["kal","warm"];
  return [DAYS[fromIso(it.due).getDay()],""];
}

function orbHtml(){
  return `<div class="o3k-ring o3k-r2"></div><div class="o3k-ring o3k-r1"></div>
    <button class="o3k-orb" type="button" data-orb aria-label="Start: tap to begin, hold to speak"><span class="o3k-core"></span></button>`;
}

EXTRA_VIEWS.orb={
  title:"LifeOS",
  render(all,today){
    const go=target(), name=String((typeof settings!=="undefined"&&settings&&settings.name)||"").trim(), hi=name?`${esc(name)}, `:"";
    const links=`<nav class="o3k-links" aria-label="Other screens">
      <button type="button" data-v="today" aria-label="Open the list">☰ List</button>
      ${EXTRA_VIEWS.timeline?`<button type="button" data-v="timeline" aria-label="Open the timeline">〰 Timeline</button>`:""}
      ${EXTRA_VIEWS.finance?`<button type="button" data-v="finance" aria-label="Open money">€ Money</button>`:""}
      <button type="button" data-v="jarvis" aria-label="Open Jarvis chat">🧠 Jarvis</button></nav>`;
    if(!all.length)return `<div class="o3k" data-orbroot><div class="o3k-stage">${orbHtml()}</div>
      <p class="o3k-say">Mujhe kuch bhi batao — likho ya orb dabake bolo.</p>${links}
      <div class="o3k-hint">Orb dabake rakho · bolo</div></div>`;
    const list=urgent(all,today), now=list.filter(x=>x.r<3).length, week=list.length-now;
    const bubs=list.slice(0,4).map(({it},k)=>{const [l,cls]=label(it,today);
      return `<button type="button" class="o3k-bub o3k-s${k}" data-v="${go}" data-orbitem="${it.id}" aria-label="${esc(it.text)}, ${esc(l)}. Open">
        <span class="o3k-pill"><i class="o3k-dot" style="background:${colorOf(it.domain)};color:${colorOf(it.domain)}"></i><span class="t">${esc(short(it.text))}</span><small class="${cls}">${esc(l)}</small></span></button>`}).join("");
    const say=now?`${hi}<b>${now} ${now===1?"cheez":"cheezein"}</b> aaj.<br>Shuru karein?`
      :week?`${hi}aaj free.<br><b>${week} ${week===1?"cheez":"cheezein"}</b> is hafte.`
      :`Sab clear ✨<br>Kuch naya batao.`;
    return `<div class="o3k" data-orbroot><div class="o3k-stage">${orbHtml()}${bubs}</div>
      <p class="o3k-say">${say}</p>
      ${list.length?`<button type="button" class="o3k-go" data-v="${go}" aria-label="Start with the most urgent item">Shuru karo →</button>`:""}
      ${links}<div class="o3k-hint">Orb dabake rakho · bolo</div></div>`;
  },
  mount(root){
    const box=root.querySelector("[data-orbroot]"); if(!box)return;
    const first=box.querySelector("[data-orbitem]");
    // Bubbles carry data-v (the page navigates); this runs first and tells the stack where to start.
    box.addEventListener("click",e=>{
      const b=e.target.closest("[data-orbitem]"); if(b){window.STACK_START=+b.dataset.orbitem;return}
      if(e.target.closest(".o3k-go")&&first)window.STACK_START=+first.dataset.orbitem;
    });
    const orb=box.querySelector("[data-orb]"); let timer=0, held=false;
    const stop=()=>{clearTimeout(timer);timer=0;orb.classList.remove("listening")};
    orb.addEventListener("pointerdown",e=>{
      if(e.button>0)return; held=false; clearTimeout(timer);
      timer=setTimeout(()=>{held=true;orb.classList.add("listening");buzz(15);
        const mic=document.getElementById("mic"), q=document.getElementById("q");
        if(mic&&!mic.hidden&&mic.offsetParent!==null)mic.click(); else if(q)q.focus();
      },450);
    });
    for(const ev of ["pointerup","pointercancel","pointerleave"])orb.addEventListener(ev,stop);
    orb.addEventListener("contextmenu",e=>e.preventDefault());
    orb.addEventListener("click",e=>{
      if(held){held=false;e.preventDefault();return}
      if(first)window.STACK_START=+first.dataset.orbitem;
      view=target(); window.scrollTo(0,0); render();
    });
  },
};
})();
