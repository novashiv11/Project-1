/* Money view: CA-grade money console for an Ireland-based PAYE employee who also invests.
   Registers EXTRA_VIEWS.finance. Uses page globals (items, area, esc, iso, capture, askClaude, snapshot…) only at call time.
   Tax facts checked on revenue.ie (Oct 2026); every row links to the official page. Not tax advice. */
(()=>{
const css=`
.fin{--fx-bg:#05070f;--fx-panel:rgba(18,26,44,.72);--fx-line:rgba(120,255,190,.16);--fx-fg:#eaf6ff;--fx-mut:#8a9bb8;
  --fx-green:#3dffa8;--fx-green2:#17c27a;--fx-amber:#ffb547;--fx-red:#ff6b7a;--fx-cyan:#5ee7ff;
  display:grid;gap:14px;min-width:0;color:var(--fx-fg);background:
  radial-gradient(120% 60% at 100% 0%,rgba(61,255,168,.14),transparent 60%),
  radial-gradient(90% 50% at 0% 30%,rgba(94,231,255,.10),transparent 60%),
  radial-gradient(80% 40% at 50% 100%,rgba(255,181,71,.08),transparent 60%),var(--fx-bg);
  border-radius:26px;padding:14px;border:1px solid var(--fx-line);box-shadow:0 20px 50px rgba(0,0,0,.5);font-family:var(--body,system-ui,sans-serif)}
.fin *{min-width:0}
.fin a{color:var(--fx-cyan)}
.fin-panel{background:var(--fx-panel);border:1px solid var(--fx-line);border-radius:20px;padding:14px;display:grid;gap:10px;
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.fin-h{font:500 11px var(--mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;color:var(--fx-mut);margin:0;
  display:flex;justify-content:space-between;align-items:center;gap:8px}
.fin-h b{color:var(--fx-green);font-weight:500}
.fin-hero{position:relative;overflow:hidden;background:linear-gradient(160deg,rgba(23,194,122,.20),rgba(10,16,32,.85) 55%);border-color:rgba(61,255,168,.35)}
.fin-big{font:800 clamp(40px,13vw,56px)/1 var(--display,system-ui);letter-spacing:-.03em;color:var(--fx-green);
  text-shadow:0 0 24px rgba(61,255,168,.45)}
.fin-big small{font-size:.42em;color:var(--fx-mut);letter-spacing:0;text-shadow:none;margin-left:6px}
.fin-delta{display:inline-flex;gap:6px;align-items:center;font:500 12px var(--mono,monospace);padding:5px 10px;border-radius:99px;
  background:rgba(61,255,168,.12);color:var(--fx-green);justify-self:start}
.fin-delta.up{background:rgba(255,181,71,.14);color:var(--fx-amber)}
.fin-spark{width:100%;height:auto;display:block}
.fin-spark text{font:500 9px var(--mono,monospace);fill:var(--fx-mut)}
.fin-spark text.v{fill:var(--fx-fg)}
.fin-hint{color:var(--fx-mut);font-size:13px;margin:0}
.fin code{font:500 12px var(--mono,monospace);color:var(--fx-green);background:rgba(61,255,168,.1);padding:2px 6px;border-radius:6px}
.fin-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid rgba(255,255,255,.06)}
.fin-row:first-of-type{border-top:0}
.fin-t{font:700 15px/1.3 var(--display,system-ui);overflow-wrap:anywhere}
.fin-m{font:500 11px var(--mono,monospace);color:var(--fx-mut);margin-top:3px;overflow-wrap:anywhere}
.fin-m .late{color:var(--fx-red)}.fin-m .soon{color:var(--fx-amber)}.fin-m .ok{color:var(--fx-green)}
.fin-amt{font:800 16px var(--display,system-ui);color:var(--fx-amber);white-space:nowrap}
.fin-tick{width:40px;height:40px;border-radius:13px;background:rgba(61,255,168,.12);color:var(--fx-green);font-size:18px;border:1px solid rgba(61,255,168,.3)}
.fin-total{display:flex;justify-content:space-between;gap:8px;align-items:baseline;font:500 12px var(--mono,monospace);color:var(--fx-mut)}
.fin-total b{font:800 22px var(--display,system-ui);color:var(--fx-amber)}
.fin-cal{display:grid;grid-template-columns:62px minmax(0,1fr);gap:10px;padding:10px 0;border-top:1px solid rgba(255,255,255,.06)}
.fin-cal:first-of-type{border-top:0}
.fin-date{font:800 13px/1.15 var(--display,system-ui);color:var(--fx-cyan);text-align:center;background:rgba(94,231,255,.08);
  border:1px solid rgba(94,231,255,.25);border-radius:12px;padding:6px 4px;align-self:start}
.fin-date small{display:block;font:500 9px var(--mono,monospace);color:var(--fx-mut);letter-spacing:.06em}
.fin-who{font-size:12px;color:var(--fx-mut);margin-top:2px}
.fin-link{font:700 12px var(--body,system-ui);text-decoration:none;display:inline-block;margin-top:4px}
.fin-chk{display:grid;gap:6px;padding:10px 0;border-top:1px solid rgba(255,255,255,.06)}
.fin-chk:first-of-type{border-top:0}
.fin-chk p{margin:0;font-size:13px;color:#c9d6ea}
.fin-acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.fin-add{background:rgba(61,255,168,.12);color:var(--fx-green);border:1px solid rgba(61,255,168,.35);border-radius:99px;padding:7px 12px;font:700 13px var(--body,system-ui)}
.fin-cta{display:grid;gap:10px}
.fin-btn{width:100%;padding:16px;border-radius:18px;font:800 16px var(--display,system-ui);text-align:left;display:grid;gap:2px}
.fin-btn small{font:500 12px var(--body,system-ui);opacity:.8}
.fin-btn.ca{background:linear-gradient(135deg,#3dffa8,#17c27a);color:#03140b;box-shadow:0 0 28px rgba(61,255,168,.35)}
.fin-btn.imp{background:rgba(94,231,255,.10);color:var(--fx-cyan);border:1px solid rgba(94,231,255,.4)}
.fin-note{font-size:11px;color:var(--fx-mut);margin:0}
.fin-empty{color:var(--fx-mut);font-size:13px;margin:0}
`;
document.head.insertAdjacentHTML("beforeend",`<style>${css}</style>`);

const TAX_RX=/\b(tax|taxes|motor tax|revenue|insurance|property tax|lpt|cgt|capital gains|usc|prsi|self[- ]?assess\w*|ros|form ?1[12]|preliminary|pay (?:and|&) file|myaccount|dividend\w*|pension)\b/i;
const FIXED_TEXT=/\b(each month|monthly|every month|direct debit|standing order|subscription)\b/i;
const BILLISH=/\b(rent|mortgage|bill|insurance|subscription|direct debit|standing order|netflix|spotify|gym|loan|emi|sip|broadband|phone|eir|vodafone|three|electric\w*|gas|lpt|property tax)\b/i;
const EURO_RX=/€\s*(\d[\d,]*(?:\.\d+)?)/;
const LINK={
  payfile:"https://www.revenue.ie/en/self-assessment-and-self-employment/guide-to-self-assessment/pay-file-system.aspx",
  prelim:"https://www.revenue.ie/en/self-assessment-and-self-employment/guide-to-self-assessment/preliminary-tax.aspx",
  cgt:"https://www.revenue.ie/en/gains-gifts-and-inheritance/transfering-an-asset/when-and-how-do-you-pay-and-file-cgt.aspx",
  cgtci:"https://www.citizensinformation.ie/en/money-and-tax/tax/capital-taxes/capital-gains-tax/",
  lpt:"https://www.revenue.ie/en/property/local-property-tax/paying-your-lpt/payment-dates.aspx",
  rent:"https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/land-and-property/rent-credit/index.aspx",
  med:"https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/health-and-age/health-expenses/how-do-you-claim-health-expenses.aspx",
  remote:"https://www.revenue.ie/en/jobs-and-pensions/eworking/how-to-claim.aspx",
  pension:"https://www.revenue.ie/en/jobs-and-pensions/pension/relief/tax-relief-limits.aspx",
  fre:"https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/income-and-employment/flat-rate-expenses/how-to-claim-an-fre-allowance.aspx",
  div:"https://www.revenue.ie/en/additional-incomes/dividend-income/index.aspx",
};
// Ireland tax calendar (2026 cycle). Dates verified on revenue.ie; the ROS extension changes yearly.
const CAL=[
  {d:"31 Oct",y:"2026",what:"Pay & File: 2025 tax return + balance, and 2026 preliminary tax",
   who:"If you're self-assessed (Form 11), e.g. PAYE with €5,000+ side/investment income. ROS pay+file gets an extension (18 Nov 2026 announced) — check revenue.ie.",url:LINK.payfile},
  {d:"31 Oct",y:"2026",what:"File CGT for 2025 share sales (return due even if no tax)",
   who:"If you sold shares/ETFs in 2025 (e.g. via a broker app).",url:LINK.cgt},
  {d:"Prelim",y:"tax",what:"Preliminary tax = lesser of 90% of this year's or 100% of last year's liability",
   who:"Self-assessed people, paid with Pay & File.",url:LINK.prelim},
  {d:"15 Dec",y:"2026",what:"Pay CGT on gains made 1 Jan – 30 Nov 2026",
   who:"If you sold shares at a profit this year (e.g. via a broker app).",url:LINK.cgt},
  {d:"31 Jan",y:"2027",what:"Pay CGT on gains made in December 2026",
   who:"If you sell shares in December.",url:LINK.cgt},
  {d:"€1,270",y:"per year",what:"CGT annual exemption: first €1,270 of gains each year are tax-free (not transferable)",
   who:"Every individual. Losses can offset gains.",url:LINK.cgtci},
  {d:"15th",y:"monthly",what:"Local Property Tax direct debit runs on the 15th, to 15 Dec 2026",
   who:"Home owners paying LPT monthly. 2027 options: check revenue.ie.",url:LINK.lpt},
];
// Commonly missed (PAYE employee who invests). One sentence each, revenue.ie links.
const CHECK=[
  {k:"rent",t:"Rent tax credit",p:"20% of rent paid, up to €1,000 a year (€2,000 jointly assessed couple) for 2024–2028; claim in myAccount.",url:LINK.rent,add:"money: claim rent tax credit in Revenue myAccount"},
  {k:"med",t:"Medical expenses relief",p:"Get 20% back on doctor, consultant and prescription costs: upload receipts to the Receipts Tracker in myAccount.",url:LINK.med,add:"money: claim medical expenses relief in myAccount (upload receipts)"},
  {k:"remote",t:"Remote working relief",p:"Claim 30% of electricity, heating and broadband for the days you worked from home.",url:LINK.remote,add:"money: claim remote working relief (30% of bills for WFH days)"},
  {k:"pension",t:"Pension contribution relief",p:"Relief at your tax rate on contributions up to 15–40% of earnings by age, earnings capped at €115,000.",url:LINK.pension,add:"money: check pension contributions vs my age limit for tax relief"},
  {k:"fre",t:"Flat-rate expenses",p:"Many jobs have an agreed allowance: myAccount → Manage your tax → Your job → Flat Rate Expenses.",url:LINK.fre,add:"money: check flat rate expenses for my job in myAccount"},
  {k:"div",t:"Declare dividends",p:"All dividends (incl. foreign, in €) are taxable: under €5,000 non-PAYE income on Form 12 in myAccount, else Form 11.",url:LINK.div,add:"money: declare 2026 dividends on my tax return"},
  {k:"cgt",t:"CGT on share sales",p:"Gains above €1,270 a year are taxed; pay by 15 Dec (Jan–Nov sales) or 31 Jan (December sales).",url:LINK.cgt,add:"money: pay CGT on 2026 share sales by 15 Dec 2026"},
  {k:"4yr",t:"4-year refund limit",p:"Refund claims (rent, medical, FRE) go back 4 years only, so 2022 claims must be made in 2026.",url:LINK.med,add:"money: claim any 2022 tax refunds by 31 Dec 2026"},
];

const eur=n=>"€"+(Math.round(n*100)/100).toLocaleString("en-IE",{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2});
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const createdKey=it=>{if(!it.created)return"";const d=new Date(/Z|[+-]\d\d:?\d\d$/.test(it.created)?it.created:it.created+"Z");return isNaN(d)?String(it.created).slice(0,7):monthKey(d)};
const spentOf=it=>(it.metrics||[]).filter(m=>String(m.name).split(".").pop()==="spent").reduce((a,m)=>a+(+m.value||0),0);
const isMoney=it=>{try{return area(it.domain).id==="money"}catch(e){return it.domain==="money"}};
const fixedLike=it=>(it.repeat&&/^(month|year)$/.test(it.repeat.unit))||FIXED_TEXT.test(it.text);
const isFixed=it=>!it.done&&fixedLike(it)&&(isMoney(it)||BILLISH.test(it.text));
const euroIn=it=>{const m=it.text.match(EURO_RX);return m?+m[1].replace(/,/g,""):0};
const monthlyOf=it=>{const v=euroIn(it);if(!v)return 0;const r=it.repeat;if(r&&r.unit==="year")return v/(r.every||1)/12;if(r&&r.unit==="month")return v/(r.every||1);return v};
const short=s=>{const d=fromIso(s);return `${d.getDate()} ${MON_SHORT[d.getMonth()]}`};
const relTxt=n=>n<0?`<span class="late">${-n}d overdue</span>`:n===0?`<span class="soon">today</span>`:n<=14?`<span class="soon">in ${n}d</span>`:`<span class="ok">in ${n}d</span>`;
const ext=(url,label,txt)=>`<a class="fin-link" href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${esc(label)} (opens revenue.ie in a new tab)">${txt} ↗</a>`;

function months(all,today){
  const out=[];
  for(let i=5;i>=0;i--){const d=new Date(today.getFullYear(),today.getMonth()-i,1);out.push({k:monthKey(d),label:MON_SHORT[d.getMonth()],v:0})}
  const by=Object.fromEntries(out.map(m=>[m.k,m]));
  for(const it of all){if(it.repeat||fixedLike(it))continue; // bills live in "Fixed", not in spending
    const s=spentOf(it);if(!s)continue;const m=by[createdKey(it)];if(m)m.v+=s}
  return out;
}
function spark(ms){
  const W=300,H=96,bw=34,gap=(W-bw*6)/5,max=Math.max(1,...ms.map(m=>m.v)),base=74;
  const bars=ms.map((m,i)=>{const x=i*(bw+gap),h=m.v?Math.max(4,(m.v/max)*52):2,y=base-h,cur=i===5;
    return `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="6" fill="${cur?"#3dffa8":"rgba(61,255,168,.35)"}"${cur?' filter="url(#finglow)"':""}/>
      <text class="v" x="${x+bw/2}" y="${y-5}" text-anchor="middle">${m.v?eur(Math.round(m.v)):"–"}</text>
      <text x="${x+bw/2}" y="${base+16}" text-anchor="middle">${m.label}</text>`}).join("");
  return `<svg class="fin-spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spending last 6 months: ${ms.map(m=>`${m.label} ${eur(Math.round(m.v))}`).join(", ")}">
    <defs><filter id="finglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${bars}</svg>`;
}
function stats(all,today){
  const ms=months(all,today), cur=ms[5].v, prev=ms[4].v;
  const fixed=all.filter(isFixed).sort((a,b)=>(a.due||"9999").localeCompare(b.due||"9999"));
  const fixedTotal=fixed.reduce((a,i)=>a+monthlyOf(i),0);
  const deadlines=all.filter(i=>!i.done&&i.due&&TAX_RX.test(i.text)) // tax, insurance, LPT, motor tax… in any area
    .map(i=>({it:i,n:daysLeft(i,today)})).filter(x=>x.n<=120).sort((a,b)=>a.it.due.localeCompare(b.it.due));
  return {ms,cur,prev,fixed,fixedTotal,deadlines};
}

function hero(s){
  const pct=s.prev?Math.round((s.cur-s.prev)/s.prev*100):null;
  const delta=s.prev?`<span class="fin-delta ${pct>0?"up":""}">${pct>0?"↑":pct<0?"↓":"="} ${Math.abs(pct)}% vs last month (${eur(s.prev)})</span>`
    :`<span class="fin-delta">first month tracked</span>`;
  const body=s.cur||s.ms.some(m=>m.v)?`<div class="fin-big" data-fin-total>${eur(s.cur)}<small>spent</small></div>${delta}${spark(s.ms)}`
    :`<div class="fin-big" data-fin-total>€0<small>spent</small></div><p class="fin-hint">Log spending like you'd text it: <code>spent €45 at tesco</code> or <code>spent €20 on lunch</code>. It totals here by month.</p>`;
  return `<section class="fin-panel fin-hero" aria-label="This month's spending"><h2 class="fin-h">This month <b>◉ live</b></h2>${body}</section>`;
}
function fixedPanel(s,today){
  const rows=s.fixed.map(i=>{const amt=euroIn(i);
    return `<div class="fin-row"><div><div class="fin-t">${esc(i.text)}</div><div class="fin-m">${i.due?`next ${short(i.due)} · ${relTxt(daysLeft(i,today))}`:"no date yet"}${i.repeat?` · every ${i.repeat.every>1?i.repeat.every+" ":""}${esc(i.repeat.unit)}`:""}</div></div>
      ${amt?`<div class="fin-amt">${eur(amt)}</div>`:""}</div>`}).join("");
  const total=s.fixedTotal?`<div class="fin-total"><span>Fixed per month</span><b>${eur(Math.round(s.fixedTotal*100)/100)}</b></div>`:"";
  return `<section class="fin-panel" aria-label="Fixed every month" data-fin-fixed><h2 class="fin-h">Fixed every month <b>${s.fixed.length}</b></h2>
    ${rows||`<p class="fin-empty">No bills yet. Try <code>Eir bill €45 every month on the 5th</code>.</p>`}
    ${total}<p class="fin-note">Add the amount in the text (e.g. €45) to total it.</p></section>`;
}
function deadlinePanel(s){
  const rows=s.deadlines.map(({it,n})=>`<div class="fin-row"><div><div class="fin-t">${esc(it.text)}</div><div class="fin-m">${short(it.due)} · ${relTxt(n)}</div></div>
    <button class="fin-tick" data-done="${it.id}" aria-label="Mark done: ${esc(it.text)}">✓</button></div>`).join("");
  return `<section class="fin-panel" aria-label="Tax and insurance deadlines" data-fin-deadlines><h2 class="fin-h">Deadlines · 120 days <b>${s.deadlines.length}</b></h2>
    ${rows||`<p class="fin-empty">Nothing tax or insurance-related in the next 120 days.</p>`}</section>`;
}
function calPanel(){
  const rows=CAL.map(r=>`<div class="fin-cal"><div class="fin-date">${esc(r.d)}<small>${esc(r.y)}</small></div>
    <div><div class="fin-t">${esc(r.what)}</div><div class="fin-who">${esc(r.who)}</div>${ext(r.url,r.what,"Official info")}</div></div>`).join("");
  return `<section class="fin-panel" aria-label="Ireland tax calendar"><h2 class="fin-h">Ireland tax calendar <b>2026</b></h2>${rows}
    <p class="fin-note">General info, not tax advice. Check revenue.ie or a tax adviser.</p></section>`;
}
function checkPanel(){
  const rows=CHECK.map(c=>`<div class="fin-chk"><div class="fin-t">${esc(c.t)}</div><p>${esc(c.p)}</p>
    <div class="fin-acts"><button class="fin-add" data-fin-add="${esc(c.k)}" aria-label="Add to my list: ${esc(c.t)}">+ Add to my list</button>${ext(c.url,c.t,"revenue.ie")}</div></div>`).join("");
  return `<section class="fin-panel" aria-label="CA check-up"><h2 class="fin-h">CA check-up · PAYE + investor <b>${CHECK.length}</b></h2>${rows}
    <p class="fin-note">General info, not tax advice. Check revenue.ie or a tax adviser.</p></section>`;
}
function ctaPanel(){
  return `<section class="fin-cta" aria-label="Ask Claude"><button class="fin-btn ca" data-fin-ask="ca" aria-label="Ask my CA: open Claude with a money review prompt">🧾 Ask my CA (Claude)<small>Deadlines at risk, missed credits, leaks, 3-step plan</small></button>
    <button class="fin-btn imp" data-fin-ask="import" aria-label="Import from my CA chat: ask Claude to pull finance items from past chats">📥 Import from my CA chat<small>Pull action items from earlier tax/finance chats</small></button>
    <p class="fin-note">Uses your own Claude app. Paste Claude's LIFEOS lines back on the Jarvis screen.</p></section>`;
}

const LIFEOS_BLOCK=`End your reply with this block, exactly:
LIFEOS
+ one short line per new item, with the date in plain words (e.g. "money: pay CGT by 15 Dec 2026")
done #<id> for each item that is already finished
Never include PPSN, IBAN, account, card or ID numbers.`;
function snap(today,max){let s=snapshot(today);return s.length>max?s.slice(0,max)+"\n…(more items not shown)":s}
function caPrompt(){
  const all=[...items.values()], today=todayDate(), s=stats(all,today);
  const fixed=s.fixed.slice(0,15).map(i=>`- ${i.text}${i.due?` (next ${i.due})`:""}`).join("\n")||"- none logged";
  return `Act as my chartered accountant (Ireland). I'm an Irish tax resident. Be professional, specific and short; cite revenue.ie pages where useful.
${typeof aboutMe==="function"?"\n"+aboutMe().trim()+"\n":""}
Spending this month: ${eur(s.cur)} (last month ${eur(s.prev)}). Last 6 months: ${s.ms.map(m=>`${m.label} ${eur(Math.round(m.v))}`).join(", ")}.
Fixed monthly costs I logged (≈${eur(Math.round(s.fixedTotal))}/month where amounts are known):
${fixed}

${snap(today,3000)}

Please give me:
1. Deadlines at risk (Pay & File, CGT 15 Dec / 31 Jan, preliminary tax, LPT, renewals) with dates.
2. Tax credits/reliefs I'm likely missing (rent credit, medical, remote working, pension, flat-rate expenses, dividends, CGT exemption, 4-year refund limit).
3. Spending leaks from the numbers above.
4. A 3-step savings plan for the next 3 months.
Say clearly if something needs a professional tax adviser.

${LIFEOS_BLOCK}`;
}
function importPrompt(){
  return `Search our past conversations (use your memory and chat search) for any earlier finance, CA, tax or budgeting analysis we did together: Revenue / myAccount, tax credits, CGT on shares/ETFs, dividends, pensions, savings goals, bills and subscriptions.
Return every action item, deadline, recurring payment, savings goal and open question from those chats as LIFEOS lines.
Only include things we actually discussed. Don't invent dates; if you only know the month, write the month. For recurring payments write the amount and day if known ("Eir bill €45 every month on the 5th").
Skip anything already in my list:

${snap(todayDate(),3000)}

Reply with ONLY this block:
LIFEOS
+ one short line per item, starting with "money:" (e.g. "money: claim rent tax credit in myAccount")
Never include PPSN, IBAN, account, card or ID numbers.`;
}

document.addEventListener("click",async e=>{
  const b=e.target.closest&&e.target.closest("[data-fin-ask],[data-fin-add]"); if(!b)return;
  if(b.dataset.finAsk==="ca"){askClaude("🧾 Ask my CA",caPrompt());return}
  if(b.dataset.finAsk==="import"){askClaude("📥 Import from my CA chat",importPrompt());return}
  const c=CHECK.find(x=>x.k===b.dataset.finAdd); if(!c||typeof backend==="undefined"||!backend)return;
  b.disabled=true; await capture(c.add); toast(`Added ✓ ${c.t} is on your list`,false);
});

window.EXTRA_VIEWS=window.EXTRA_VIEWS||{};
EXTRA_VIEWS.finance={title:"Money",
  render(all,today){const s=stats(all,today);return `<div class="fin">${hero(s)}${ctaPanel()}${deadlinePanel(s)}${fixedPanel(s,today)}${checkPanel()}${calPanel()}</div>`},
  mount(){},
  _test:{stats,caPrompt,importPrompt}};
})();
