/* Timeline: open, dated items (overdue → 400 days ahead) as glowing nodes on one curving river.
   Tap a node → inline details (✓ Done, Guide). Loaded before the page script: page globals
   (items, daysLeft, esc…) are only touched inside render()/mount(). Layout is deterministic:
   node i sits at y = TOP + i*SP + SP/2 and x = xAt(i) (% of width); mount() only re-measures
   when a node is expanded (its panel pushes later rows down). */
(()=>{
const SP=110, TOP=56, TAIL=70, NOW={x:7,y:24}, HORIZON=400;
const xAt=i=>50-32*Math.cos(i*1.15);           // sine-like weave, 18%..82% of the width
const expanded=new Set();                       // group keys (YYYY-MM-DD) kept open across re-renders

const css=`
html:has(body[data-view="timeline"]){background:#05030c}
body[data-view="timeline"]{background:transparent;color-scheme:dark;
  --bg:#0a0614;--card:#1a1230;--card2:#150f29;--fg:#f3eefe;--muted:#b9a8ff;--line:rgb(255 255 255 / .14);
  --accent:#00e0b4;--accent-ink:#0a0614;--chip:rgb(255 255 255 / .08);--nav:#0a0614;--ok-bg:#0f2e2a;color:#f3eefe}
body[data-view="timeline"]::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:radial-gradient(60% 30% at 10% 12%,#ff4fd83a,transparent 70%),radial-gradient(60% 35% at 95% 48%,#4f7dff40,transparent 70%),
  radial-gradient(60% 30% at 20% 92%,#00e0b42e,transparent 70%),linear-gradient(180deg,#0a0614 0%,#120a2a 50%,#05030c 100%)}
body[data-view="timeline"] .capbox{background:rgb(255 255 255 / .06);border-color:rgb(255 255 255 / .15);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.tl{--tl-fg:#f3eefe;--tl-soft:#c9bfff;--tl-eye:#b9a8ff;--tl-now:#00e0b4;color:var(--tl-fg);display:grid;gap:4px;min-width:0;overflow-x:clip}
.tl .tl-h{margin:0;font:800 30px/1.05 "Bricolage Grotesque",ui-rounded,system-ui,sans-serif;letter-spacing:-.02em;color:var(--tl-fg);text-transform:none;text-wrap:balance}
.tl .tl-eye{display:block;font:500 12px "JetBrains Mono",ui-monospace,monospace;letter-spacing:.2em;color:var(--tl-eye);margin-bottom:8px}
.tl-river{position:relative;padding:${TOP}px 0 ${TAIL}px;min-width:0}
.tl-svg{position:absolute;left:0;top:0;width:100%;overflow:visible;pointer-events:none;z-index:0}
.tl-shimmer{animation:tl-flow 7s linear infinite}
@keyframes tl-flow{to{stroke-dashoffset:-520}}
.tl-now{position:absolute;top:${NOW.y}px;left:${NOW.x}%;transform:translate(-5px,-50%);z-index:1;display:flex;align-items:center;gap:8px;
  font:500 11px "JetBrains Mono",ui-monospace,monospace;letter-spacing:.2em;color:var(--tl-now)}
.tl-now i{width:10px;height:10px;border-radius:50%;background:var(--tl-now);box-shadow:0 0 14px var(--tl-now);flex:none}
.tl-month{position:absolute;z-index:1;transform:translate(-50%,-50%);font:600 10px "JetBrains Mono",ui-monospace,monospace;letter-spacing:.18em;
  color:#fff;background:#160d2ecc;border:1px solid rgb(255 255 255 / .22);padding:3px 9px;border-radius:99px;white-space:nowrap;pointer-events:none}
.tl-row{position:relative;z-index:2;min-width:0}
.tl-node{position:relative;display:block;width:100%;height:${SP}px;background:none;padding:0;border-radius:18px;color:inherit;text-align:left;font:inherit}
.tl-node:focus-visible{outline:2px solid var(--tl-now);outline-offset:-2px}
.tl-dot{position:absolute;top:50%;left:var(--x);width:var(--s);height:var(--s);transform:translate(-50%,-50%);border-radius:50%;
  background:var(--c);box-shadow:0 0 calc(var(--s) * .8) var(--c),inset 0 0 0 2px rgb(255 255 255 / .25)}
.tl-dot.tl-hot{animation:tl-pulse 2.4s ease-in-out infinite}
@keyframes tl-pulse{50%{box-shadow:0 0 calc(var(--s) * 1.4) var(--c),inset 0 0 0 2px rgb(255 255 255 / .35)}}
.tl-lab{position:absolute;top:50%;transform:translateY(-50%);display:grid;gap:3px;min-width:0;text-shadow:0 1px 10px #0a0614}
.tl-r .tl-lab{left:calc(var(--x) + var(--s) / 2 + 10px);right:0}
.tl-l .tl-lab{right:calc(100% - var(--x) + var(--s) / 2 + 10px);left:0;text-align:right}
.tl-lab b{font:600 15px/1.25 "Bricolage Grotesque",ui-rounded,system-ui,sans-serif;overflow-wrap:anywhere;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tl-lab small{font:500 11px "JetBrains Mono",ui-monospace,monospace;color:var(--tl-soft);letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-lab small.tl-late{color:#ff8a9a}.tl-lab small.tl-win{color:#ffb4f0}
.tl-detail{margin:0 0 14px;padding:14px;border-radius:20px;background:rgb(22 13 46 / .86);border:1px solid rgb(255 255 255 / .16);
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);display:grid;gap:12px;min-width:0;box-shadow:0 10px 30px rgb(0 0 0 / .4)}
.tl-it{display:grid;gap:8px;min-width:0;border-left:3px solid var(--c);padding-left:10px}
.tl-it .tl-t{font:700 16px/1.3 "Bricolage Grotesque",ui-rounded,system-ui,sans-serif;overflow-wrap:anywhere}
.tl-it .tl-m{font:500 11px/1.4 "JetBrains Mono",ui-monospace,monospace;color:var(--tl-soft);letter-spacing:.04em;overflow-wrap:anywhere}
.tl-acts{display:flex;gap:8px;flex-wrap:wrap}
.tl-acts button{min-height:40px;padding:8px 14px;border-radius:14px;font:700 14px system-ui,sans-serif}
.tl-done{background:linear-gradient(135deg,#00e0b4,#4f7dff);color:#060312}
.tl-guide{background:rgb(255 255 255 / .1);color:#f3eefe;border:1px solid rgb(255 255 255 / .2)}
.tl-detail .guide{background:rgb(255 255 255 / .05);color:#f3eefe;border-color:rgb(255 255 255 / .14)}
.tl-detail .guide a{color:#7ef3dc}
.tl-empty{position:relative;z-index:2;height:${SP}px;display:flex;align-items:center;padding-left:calc(${xAt(0)}% + 22px);
  font:600 16px/1.35 "Bricolage Grotesque",ui-rounded,system-ui,sans-serif;color:var(--tl-soft)}
.tl-ring{position:absolute;left:${xAt(0)}%;top:50%;width:14px;height:14px;transform:translate(-50%,-50%);border-radius:50%;border:2px solid #4f7dff;box-shadow:0 0 12px #4f7dff}
.tl-foot{display:flex;justify-content:center;padding-bottom:6px}
.tl-foot button{background:rgb(255 255 255 / .07);border:1px solid rgb(255 255 255 / .18);color:#f3eefe;padding:10px 16px;border-radius:99px;
  font:600 14px system-ui,sans-serif;max-width:100%}
@media (prefers-reduced-motion:reduce){.tl-shimmer{animation:none;display:none}.tl-dot.tl-hot{animation:none}}
`;
document.head.insertAdjacentHTML("beforeend",`<style id="tl-css">${css}</style>`);

const trunc=(s,n)=>s.length>n?s.slice(0,n-1).trimEnd()+"…":s;
const DOW=["SUN","MON","TUE","WED","THU","FRI","SAT"];
const repLabel=r=>!r?"":r.every>1?`EVERY ${r.every} ${String(r.unit).toUpperCase()}S`:({day:"DAILY",week:"WEEKLY",month:"MONTHLY",year:"YEARLY"}[r.unit]||"");

function dateLine(g,today){
  const it=g.items[0], n=g.n, d=fromIso(it.due), M=MON_SHORT[d.getMonth()].toUpperCase(), parts=[];
  if(n<0)parts.push(`${-n}D LATE`);
  else if(n===0)parts.push("TODAY");
  else if(n===1)parts.push("KAL");
  else if(g.win)parts.push(`WINDOW OPEN · ${n}D`);
  else if(n<=13)parts.push(`${DOW[d.getDay()]} ${d.getDate()} ${M}`);
  else if(n<=90)parts.push(`${d.getDate()} ${M} · ${n}D`);
  else parts.push(d.getFullYear()!==today.getFullYear()?`${M} '${String(d.getFullYear()).slice(2)}`:`${d.getDate()} ${M}`);
  const r=repLabel(it.repeat); if(r&&g.items.length===1)parts.push(r);
  if(g.items.length>1)parts.push(String(g.items.length));
  return parts.join(" · ");
}

function groups(all,today){
  const out=[], by=new Map();
  for(const it of openDated(all)){
    if(isFood(it))continue;
    const n=daysLeft(it,today); if(n>HORIZON)continue;
    const k=it.due.slice(0,10);
    if(!by.has(k)){const g={key:k,n,items:[]};by.set(k,g);out.push(g)}
    by.get(k).items.push(it);
  }
  for(const g of out){
    g.win=g.items.some(i=>windowOpen(i,today));
    g.hot=g.n<=0||g.win;
    g.long=g.items.some(i=>leadDays(i)>14);
    g.size=16+(g.hot?12:0)+(g.long?6:0);
    const lead=g.items.find(i=>windowOpen(i,today))||g.items.find(i=>leadDays(i)>14)||g.items[0];
    g.color=colorOf(lead.domain);
  }
  return out;
}

/* Smooth Catmull-Rom curve through points (x in %, y in px) → cubic Bézier segments. */
function segments(P){
  const S=[];
  for(let i=0;i<P.length-1;i++){
    const a=P[i-1]||P[i], b=P[i], c=P[i+1], d=P[i+2]||c;
    S.push([b,{x:b.x+(c.x-a.x)/6,y:b.y+(c.y-a.y)/6},{x:c.x-(d.x-b.x)/6,y:c.y-(d.y-b.y)/6},c]);
  }
  return S;
}
const pathD=S=>S.length?`M${S[0][0].x.toFixed(2)} ${S[0][0].y.toFixed(1)}`+S.map(([,p,q,e])=>
  ` C${p.x.toFixed(2)} ${p.y.toFixed(1)} ${q.x.toFixed(2)} ${q.y.toFixed(1)} ${e.x.toFixed(2)} ${e.y.toFixed(1)}`).join(""):"";
const bez=(s,t,k)=>{const u=1-t;return u*u*u*s[0][k]+3*u*u*t*s[1][k]+3*u*t*t*s[2][k]+t*t*t*s[3][k]};
function xAtY(s,y){let lo=0,hi=1;for(let i=0;i<24;i++){const m=(lo+hi)/2;bez(s,m,"y")<y?lo=m:hi=m}return bez(s,(lo+hi)/2,"x")}

/* Points through NOW, every node centre and a tail; month markers sit on the river at row boundaries. */
function geometry(ys,H){
  const P=[NOW,...ys.map((y,i)=>({x:xAt(i),y})),{x:xAt(ys.length),y:H-8}], S=segments(P);
  return {S,d:pathD(S)};
}
const svg=(d,H)=>`<svg class="tl-svg" viewBox="0 0 100 ${H}" preserveAspectRatio="none" height="${H}" aria-hidden="true" focusable="false">
  <defs><linearGradient id="tl-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#00e0b4"/><stop offset=".5" stop-color="#4f7dff"/><stop offset="1" stop-color="#ff4fd8"/></linearGradient></defs>
  <path class="tl-p" d="${d}" fill="none" stroke="url(#tl-g)" stroke-width="20" stroke-linecap="round" opacity=".14" vector-effect="non-scaling-stroke"/>
  <path class="tl-p" d="${d}" fill="none" stroke="url(#tl-g)" stroke-width="4" stroke-linecap="round" opacity=".95" vector-effect="non-scaling-stroke"/>
  <path class="tl-p tl-shimmer" d="${d}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".55" stroke-dasharray="26 494" vector-effect="non-scaling-stroke"/></svg>`;

function monthLabel(g,prevKey){
  const [y,m]=g.key.split("-").map(Number), [py,pm]=prevKey.split("-").map(Number);
  if(y===py&&m===pm)return "";
  return y!==py?String(y):MON_SHORT[m-1].toUpperCase();
}

function detail(g,today){
  return `<div class="tl-detail" id="tl-d-${g.key}">${g.items.map(it=>{
    const a=area(it.domain), d=fromIso(it.due), n=daysLeft(it,today), gd=guideFor(it), r=repLabel(it.repeat);
    const when=`${d.getDate()} ${MON_SHORT[d.getMonth()]} ${d.getFullYear()}${it.due.includes("T")?" · "+it.due.slice(11,16):""} · ${n<0?`${-n}d late`:n===0?"today":n===1?"kal":`in ${n}d`}`;
    return `<div class="tl-it" style="--c:${colorOf(it.domain)}"><div class="tl-t">${esc(it.text)}</div>
      <div class="tl-m">${esc(a.icon)} ${esc(a.label)} · ${esc(when)}${r?` · ${esc(r.toLowerCase())}`:""}${windowOpen(it,today)?" · window open: start now":""}</div>
      <div class="tl-acts"><button class="tl-done" data-done="${it.id}" aria-label="Mark done: ${esc(it.text)}">✓ Done</button>
      ${gd&&!it.done?`<button class="tl-guide" data-guide="${it.id}" aria-expanded="${openGuides.has(it.id)}" aria-label="${openGuides.has(it.id)?"Hide":"Show"} guide: ${esc(gd.title)}">Guide ›</button>`:""}</div>
      ${guidePanel(it)}</div>`}).join("")}</div>`;
}

function render(all,today){
  const gs=groups(all,today), undated=all.filter(i=>!i.due&&!i.done&&!isFood(i)).length;
  const head=`<h2 class="tl-h"><span class="tl-eye">YOUR TIMELINE</span>Aaj se aage, sab ek line pe.</h2>`;
  const foot=undated?`<div class="tl-foot"><button data-v="today" aria-label="${undated} items without a date: open the list">${undated} bina date wale → List</button></div>`:"";
  if(!gs.length){
    const H=TOP+SP+TAIL, {d}=geometry([TOP+SP/2],H);
    return `<div class="tl tl-isempty">${head}<div class="tl-river" style="min-height:${H}px">${svg(d,H)}
      <div class="tl-now"><i></i>NOW</div>
      <div class="tl-empty"><span class="tl-ring"></span>Abhi kuch scheduled nahi. Date ke saath kuch add karo.</div></div>${foot}</div>`;
  }
  const ys=gs.map((_,i)=>TOP+i*SP+SP/2), H=TOP+gs.length*SP+TAIL, {S,d}=geometry(ys,H);
  let prev=iso(today), marks="";
  gs.forEach((g,i)=>{const lab=monthLabel(g,prev);prev=g.key;
    if(lab){const y=TOP+i*SP;marks+=`<span class="tl-month" data-i="${i}" style="left:${xAtY(S[i],y).toFixed(2)}%;top:${y}px">${esc(lab)}</span>`}});
  const rows=gs.map((g,i)=>{
    const x=xAt(i), open=expanded.has(g.key), label=g.items.map(it=>trunc(it.text,28)).join(" · "), dl=dateLine(g,today);
    const cls=g.n<0?"tl-late":g.win?"tl-win":"";
    return `<div class="tl-row ${x<=50?"tl-r":"tl-l"}" data-key="${g.key}" style="--x:${x.toFixed(2)}%;--s:${g.size}px;--c:${g.color}">
      <button class="tl-node" data-tl="${g.key}" aria-expanded="${open}" aria-controls="tl-d-${g.key}"
        aria-label="${esc(g.items.map(it=>it.text).join(", "))}. ${esc(dl)}. ${open?"Hide":"Show"} details">
        <span class="tl-dot${g.n===0||g.win?" tl-hot":""}"></span>
        <span class="tl-lab"><b>${esc(label)}</b><small class="${cls}">${esc(dl)}</small></span></button>
      ${open?detail(g,today):""}</div>`}).join("");
  return `<div class="tl">${head}<div class="tl-river">${svg(d,H)}<div class="tl-now"><i></i>NOW</div>${marks}${rows}</div>${foot}</div>`;
}

function mount(root){
  const tl=root.querySelector(".tl"); if(!tl)return;
  tl.addEventListener("click",e=>{
    const b=e.target.closest("button[data-tl]"); if(!b)return;
    const k=b.dataset.tl; expanded.has(k)?expanded.delete(k):expanded.add(k);
    window.render();
  });
  const river=tl.querySelector(".tl-river"), rows=[...river.querySelectorAll(".tl-row")];
  if(!rows.some(r=>r.querySelector(".tl-detail")))return;    // collapsed: index layout is already exact
  const ys=rows.map(r=>r.offsetTop+SP/2), H=river.offsetHeight, {S,d}=geometry(ys,H), s=river.querySelector(".tl-svg");
  s.setAttribute("viewBox",`0 0 100 ${H}`);s.setAttribute("height",H);
  s.querySelectorAll(".tl-p").forEach(p=>p.setAttribute("d",d));
  river.querySelectorAll(".tl-month").forEach(m=>{const i=+m.dataset.i,y=rows[i].offsetTop;
    m.style.top=y+"px";m.style.left=xAtY(S[i],y).toFixed(2)+"%"});
}

window.EXTRA_VIEWS=window.EXTRA_VIEWS||{};
EXTRA_VIEWS.timeline={title:"Timeline",render,mount};
})();
