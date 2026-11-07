/* Money core: bank CSV parsing, de-duplication, categorisation that learns, internal/save detection,
   refund netting and the month maths (dashboard, tie-out, "what changed", merchant frequency).
   Pure functions, no DOM: runs in the browser (window.MoneyCore) and in node for tests. */
(function(root){
"use strict";

/* ---------- categories ---------- */
const CATEGORIES=[ // name, group, essential
  ["Mortgage","Home",true],["Electricity","Home",true],["Gas","Home",true],["Insurance","Home",true],["Broadband & mobile","Home",true],
  ["Refuse","Home",true],["LPT","Home",true],["Home & DIY","Home",false],
  ["Groceries","Living",true],["Dog","Living",true],["Admin","Living",true],["Bank fees","Living",true],["Cash","Living",false],
  ["Amazon","Lifestyle",false],["Vape/smoke","Lifestyle",false],["Electronics","Lifestyle",false],["Clothing","Lifestyle",false],
  ["Eating out","Lifestyle",false],["Subscriptions","Lifestyle",false],
  ["Gifts/family","People",false],["People & trades","People",false],["Other","Other",false]
].map(([name,group,essential])=>({name,group,essential}));
const GROUPS=["Home","Living","Lifestyle","People","Other"];
// Bills that come once a month: counted as they are, never extrapolated by the daily pace.
const FIXED=new Set(["Mortgage","Insurance","LPT","Refuse","Broadband & mobile","Electricity","Gas"]);

// Generic Irish merchant rules (regex on the description). The person's own rules always win.
const RULES=[
  [/mortgage|home loan/i,"Mortgage"],
  [/electric ireland|sse airtricity|airtricity|energia|pinergy|flogas electric|bord g[aá]is energy.*elec|community power|yuno/i,"Electricity"],
  [/bord g[aá]is|flogas|calor|gas networks/i,"Gas"],
  [/insurance|fbd|allianz|aviva|axa|zurich|liberty ins|an post insurance|vhi|laya|irish life health|petplan|royal london/i,"Insurance"],
  [/\beir\b|vodafone|three ireland|\bthree\b|48 ?mobile|gomo|virgin media|sky ireland|digiweb|pure telecom|tesco mobile|clear mobile/i,"Broadband & mobile"],
  [/panda|greyhound|city bin|barna|thorntons|keywaste|bin collection|refuse/i,"Refuse"],
  [/local property tax|\blpt\b|revenue.*property/i,"LPT"],
  [/tesco|lidl|aldi|dunnes|supervalu|super valu|centra|spar|mace|daybreak|londis|marks ?& ?spencer food|m&s food|asian market|oriental/i,"Groceries"],
  [/vet|zooplus|petstop|maxi zoo|pet ?shop|dog groom|kennel|petmania/i,"Dog"],
  [/vape|vapou?r|smoke|tobacco|e-?cig/i,"Vape/smoke"],
  [/amazon|amzn/i,"Amazon"],
  [/currys|harvey norman|power city|apple\.com\/bill.*device|samsung|argos|smyths/i,"Electronics"],
  [/penneys|primark|zara|h ?& ?m|next retail|tk ?maxx|river island|jd sports|sports direct|asos|shein|uniqlo/i,"Clothing"],
  [/just ?eat|deliveroo|uber ?eats|mcdonald|burger king|supermac|starbucks|costa|insomnia|restaurant|cafe|caf[eé]|pizza|kfc|subway|nando|bar\b|pub\b/i,"Eating out"],
  [/woodie|b ?& ?q|homebase|screwfix|ikea|chadwick|grafton|brennans|hardware|diy|des kelly|harold'?s cross/i,"Home & DIY"],
  [/netflix|spotify|disney|playstation|xbox|apple\.com\/bill|google (one|play|storage)|youtube|prime video|amazon prime|audible|chatgpt|openai|claude|anthropic|icloud|patreon|now tv/i,"Subscriptions"],
  [/\batm\b|cash withdrawal|cashback/i,"Cash"],
  [/revenue|motor tax|ndls|passport|immigration|citizens information|courts|an post(?! ins)|solicitor|notary|embassy/i,"Admin"],
  [/fee|charge|interest|maintenance|stamp duty|overdraft/i,"Bank fees"],
  [/gift|flowers|card factory|moonpig|interflora/i,"Gifts/family"]
];
// Saving: investments, pension, savings vaults. Outgoing only.
const SAVE_RE=/trading ?212|trade republic|degiro|etoro|interactive brokers|freetrade|revolut (?:invest|stocks|trading|robo|commodit)|irish life|pension|\bavc\b|prsa|savings? (?:vault|account|pot)|instant access|flexible cash|deposit account|to savings/i;
// Movements between the person's own accounts (never spending).
const INTERNAL_RE=/top[- ]?up|google pay top|apple pay top|exchanged to|exchange to|currency exchange|\bpocket\b|to (?:eur|gbp|inr|usd)\b|from (?:eur|gbp|inr|usd)\b|transfer (?:to|from) (?:own|my|savings)|\brevolut\b|bank of ireland|\bboi\b|aib transfer|ptsb transfer|n26|own account/i;
const REFUND_RE=/refund|reversal|chargeback|returned/i;

/* ---------- small utils ---------- */
const round2=n=>Math.round(n*100)/100;
const pad=n=>String(n).padStart(2,"0");
const monthKey=d=>String(d).slice(0,7);
const daysIn=(y,m)=>new Date(y,m,0).getDate(); // m 1-12
function normalizeDate(s){
  s=String(s||"").trim(); let m;
  if(m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  if(m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/))return `${m[3]}-${pad(m[2])}-${pad(m[1])}`; // Irish banks: day first
  if(m=s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/)){const i="janfebmaraprmayjunjulaugsepoctnovdec".indexOf(m[2].toLowerCase());
    if(i>=0)return `${m[3]}-${pad(i/3+1)}-${pad(m[1])}`}
  return null;
}
function num(s){if(s==null||s==="")return 0;if(typeof s==="number")return s;
  let t=String(s).replace(/[€£₹$\s]/g,"");if(/^\(.*\)$/.test(t))t="-"+t.slice(1,-1);
  if(/,\d{2}$/.test(t)&&!/\.\d{2}$/.test(t))t=t.replace(/\./g,"").replace(",",".");else t=t.replace(/,/g,"");
  const v=parseFloat(t);return isFinite(v)?v:0}

// RFC-4180-ish CSV (quotes, escaped quotes, CRLF, BOM). Detects ; or , delimiter.
function parseCSV(text){
  text=String(text).replace(/^﻿/,""); const first=text.split(/\r?\n/,1)[0]||"";
  const delim=(first.split(";").length>first.split(",").length)?";":",";
  const rows=[];let row=[],cell="",q=false;
  for(let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else q=false}else cell+=c;continue}
    if(c==='"')q=true;else if(c===delim){row.push(cell);cell=""}
    else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(cell);if(row.some(x=>x!==""))rows.push(row);row=[];cell=""}
    else cell+=c}
  row.push(cell);if(row.some(x=>x!==""))rows.push(row);
  return rows;
}
const headerIndex=(hdr,re)=>hdr.findIndex(h=>re.test(String(h).trim()));

function merchantKey(desc){
  // "Amazon.ie*AB12" and "AMAZON.IE*XY99" are one merchant: drop the reference after "*" and any token with digits
  const w=String(desc||"").toLowerCase().replace(/https?:\/\/\S+/g," ").replace(/\*.*$/,"").split(/[^a-z0-9&]+/).filter(x=>!/\d/.test(x))
    .filter(x=>x.length>1&&!/^(pos|card|payment|purchase|to|from|the|ltd|limited|ie|com|www|dd|so|sepa|direct|debit|contactless|online|gpay|apple|pay)$/.test(x));
  return w.slice(0,2).join(" ")||String(desc||"").toLowerCase().trim().slice(0,20);
}

/* ---------- parsers → raw txns {date, started, account, source, desc, amount, fee, currency, state, rtype, balance} ---------- */
function parseRevolut(text){
  const rows=parseCSV(text); if(!rows.length)return [];
  const h=rows[0].map(x=>x.trim()), ix=n=>h.indexOf(n);
  const I={type:ix("Type"),product:ix("Product"),start:ix("Started Date"),done:ix("Completed Date"),desc:ix("Description"),
    amount:ix("Amount"),fee:ix("Fee"),cur:ix("Currency"),state:ix("State"),bal:ix("Balance")};
  if(I.amount<0||I.desc<0||I.start<0)throw new Error("Not a Revolut statement (needs Started Date, Description, Amount)");
  const out=[];
  for(const r of rows.slice(1)){
    const state=String(r[I.state]||"COMPLETED").toUpperCase();
    if(/REVERTED|DECLINED|FAILED/.test(state))continue;
    const product=(r[I.product]||"Current").trim(), cur=(r[I.cur]||"EUR").trim().toUpperCase();
    const started=normalizeDate(r[I.start]), completed=normalizeDate(r[I.done]);
    out.push({source:"revolut",account:`Revolut ${cur}${product&&!/^current$/i.test(product)?" "+product:""}`,product,
      started,date:completed||started,desc:(r[I.desc]||"").trim(),amount:num(r[I.amount]),fee:num(r[I.fee]),currency:cur,
      state:state==="PENDING"?"pending":"completed",rtype:String(r[I.type]||"").toUpperCase(),balance:I.bal>=0&&r[I.bal]!==""?num(r[I.bal]):null});
  }
  return out;
}
// Bank of Ireland (and most Irish bank) CSV exports: Date, Details/Description, Debit, Credit (or Amount), Balance.
function parseBank(text,account){
  const rows=parseCSV(text); if(!rows.length)return [];
  let hi=rows.findIndex(r=>r.some(c=>/date/i.test(c))&&r.some(c=>/details|description|narrative|transaction/i.test(c)));
  if(hi<0)throw new Error("Couldn't find the header row (needs Date and Details)");
  const h=rows[hi];
  const I={date:headerIndex(h,/^(transaction |posting )?date/i),desc:headerIndex(h,/details|description|narrative|^transaction$/i),
    debit:headerIndex(h,/debit|money out|paid out|withdrawal/i),credit:headerIndex(h,/credit|money in|paid in|lodgement/i),
    amount:headerIndex(h,/^amount/i),bal:headerIndex(h,/balance/i)};
  const out=[];
  for(const r of rows.slice(hi+1)){
    const date=normalizeDate(r[I.date]); if(!date)continue;
    let amount=I.amount>=0&&r[I.amount]!==undefined&&r[I.amount]!==""?num(r[I.amount]):num(r[I.credit])-Math.abs(num(r[I.debit]));
    if(!amount)continue;
    out.push({source:"bank",account:account||"BOI Current",started:date,date,desc:(r[I.desc]||"").trim(),amount,fee:0,currency:"EUR",
      state:"completed",rtype:"",balance:I.bal>=0&&r[I.bal]?num(r[I.bal]):null});
  }
  return out;
}

/* ---------- classify ---------- */
function defaultSettings(){return {myNames:[],rates:{EUR:1,GBP:1.17,INR:0.0105,USD:0.92},rules:{},needShare:{},categories:CATEGORIES.map(c=>({...c}))}}
function catDef(settings,name){return (settings.categories||CATEGORIES).find(c=>c.name===name)||{name,group:"Other",essential:false}}
function guessCategory(desc,settings){
  const mk=merchantKey(desc), r=(settings.rules||{})[mk]; if(r)return r;
  for(const [re,cat] of RULES)if(re.test(desc))return cat;
  return "Other";
}
function isMine(desc,settings){
  return (settings.myNames||[]).filter(Boolean).some(n=>new RegExp(`(^|\\b)(to|from|payment from|transfer (to|from))\\s+${n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}\\b`,"i").test(desc));
}
function classify(t,settings){
  const d=t.desc||"";
  if(t.kindLocked)return t;
  let kind;
  if(t.rtype==="EXCHANGE"||t.rtype==="TOPUP"||isMine(d,settings))kind="INTERNAL";
  else if(/pocket/i.test(t.product||"")||/pocket/i.test(d))kind="INTERNAL";
  else if(t.amount<0&&(SAVE_RE.test(d)||/savings|deposit/i.test(t.product||"")&&!/^current$/i.test(t.product||"")))kind="SAVE";
  else if(t.amount>0&&(SAVE_RE.test(d)||/savings|deposit/i.test(t.product||"")))kind="INTERNAL"; // money coming back from savings/investments
  else if(INTERNAL_RE.test(d))kind="INTERNAL";
  else if(t.amount>0&&(t.rtype==="CARD_REFUND"||t.rtype==="REFUND"||REFUND_RE.test(d)))kind="SPEND"; // a refund reduces spending
  else if(t.amount>0)kind="INCOME";
  else kind="SPEND";
  t.kind=kind;
  if(kind==="SPEND"&&!t.catLocked)t.category=t.rtype==="FEE"?"Bank fees":guessCategory(d,settings);
  if(kind!=="SPEND"&&!t.catLocked)t.category=kind==="SAVE"?"Saving":kind==="INCOME"?"Income":"Internal";
  return t;
}

/* ---------- import: ids, de-duplication, pending → completed, refunds ---------- */
function baseKey(t){return [t.account,t.started||t.date,round2(t.amount).toFixed(2),String(t.desc).toLowerCase().replace(/\s+/g," ").trim()].join("|")}
function hash(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return h.toString(36)}
// Same purchase twice on one day is real: the n-th identical row in a file gets #n, so re-importing the file maps to the same ids.
function withIds(raw){const seen={};return raw.map(t=>{const k=baseKey(t);seen[k]=(seen[k]||0)+1;return Object.assign(t,{id:hash(k+"#"+seen[k])})})}
function toEur(t,settings){const rate=(settings.rates||{})[t.currency]||1;return round2((t.amount-(t.fee||0))*rate)}

function merge(db,raw,settings){
  const byId=new Map((db.txns||[]).map(t=>[t.id,t]));let added=0,updated=0,dupes=0;
  for(const t of withIds(raw)){
    t.amountEur=toEur(t,settings);
    const cur=byId.get(t.id);
    if(cur){
      if(cur.state==="pending"&&t.state==="completed"){Object.assign(cur,{state:"completed",date:t.date,balance:t.balance,amountEur:t.amountEur});updated++}
      else dupes++;
      continue;
    }
    classify(t,settings);byId.set(t.id,t);added++;
  }
  const txns=[...byId.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  linkRefunds(txns);
  return {db:Object.assign({},db,{txns}),added,updated,dupes};
}
// A refund takes the category of the purchase it reverses (most recent earlier spend at the same merchant, ≤ 180 days, big enough).
function linkRefunds(txns){
  for(const r of txns){
    if(r.kind!=="SPEND"||r.amountEur<=0||r.refundOf)continue;
    const mk=merchantKey(r.desc), limit=new Date(r.date).getTime()-180*864e5;
    const orig=txns.filter(t=>t!==r&&t.kind==="SPEND"&&t.amountEur<0&&t.date<=r.date&&new Date(t.date).getTime()>=limit&&
      merchantKey(t.desc)===mk&&-t.amountEur>=r.amountEur-0.005).pop();
    if(orig){r.refundOf=orig.id;if(!r.catLocked)r.category=orig.category}
  }
}
// Recategorise one txn; with all=true learn a rule for the merchant and re-apply it everywhere.
function recategorise(db,id,category,settings,all){
  const t=db.txns.find(x=>x.id===id);if(!t)return 0;
  const mk=merchantKey(t.desc);let n=0;
  if(all){settings.rules=Object.assign({},settings.rules,{[mk]:category});
    for(const x of db.txns)if(merchantKey(x.desc)===mk&&x.kind==="SPEND"){x.category=category;n++}}
  else{t.category=category;t.catLocked=true;n=1}
  return n;
}
function setKind(db,id,kind){const t=db.txns.find(x=>x.id===id);if(!t)return;t.kind=kind;t.kindLocked=true;
  if(kind!=="SPEND")t.category=kind==="SAVE"?"Saving":kind==="INCOME"?"Income":"Internal";else if(/^(Saving|Income|Internal)$/.test(t.category))t.category="Other"}

/* ---------- maths ---------- */
const done=txns=>txns.filter(t=>t.state!=="pending");
const spendOf=t=>-t.amountEur; // refunds are negative spend
function needShare(t,settings){const s=(settings.needShare||{})[merchantKey(t.desc)];
  return s!=null?s:(catDef(settings,t.category).essential?1:0)}
function monthTotals(txns,month,settings){
  const r={month,income:0,spend:0,save:0,internal:0,essential:0,flexible:0,byCat:{},byGroup:{},count:0,pending:0};
  for(const t of txns){if(monthKey(t.date)!==month)continue;
    if(t.state==="pending"){r.pending+=t.kind==="SPEND"?spendOf(t):0;continue}
    r.count++;
    if(t.kind==="INCOME")r.income+=t.amountEur;
    else if(t.kind==="SAVE")r.save+=-t.amountEur;
    else if(t.kind==="INTERNAL")r.internal+=t.amountEur;
    else{const s=spendOf(t),g=catDef(settings,t.category).group,ns=needShare(t,settings);
      r.spend+=s;r.byCat[t.category]=(r.byCat[t.category]||0)+s;r.byGroup[g]=(r.byGroup[g]||0)+s;r.essential+=s*ns;r.flexible+=s*(1-ns)}}
  for(const k of ["income","spend","save","internal","essential","flexible","pending"])r[k]=round2(r[k]);
  for(const o of [r.byCat,r.byGroup])for(const k in o)o[k]=round2(o[k]);
  return r;
}
function monthsWithData(txns){return [...new Set(done(txns).map(t=>monthKey(t.date)))].sort()}
function prevMonths(month,n){const [y,m]=month.split("-").map(Number);const out=[];for(let i=1;i<=n;i++){const d=new Date(y,m-1-i,1);out.push(`${d.getFullYear()}-${pad(d.getMonth()+1)}`)}return out}
function average(txns,month,n,settings,field){
  const have=new Set(monthsWithData(txns)), ms=prevMonths(month,n).filter(m=>have.has(m));
  if(!ms.length)return null;
  return round2(ms.reduce((a,m)=>a+monthTotals(txns,m,settings)[field],0)/ms.length);
}
function dashboard(txns,settings,todayIso){
  const month=monthKey(todayIso), [y,m,d]=todayIso.split("-").map(Number), dim=daysIn(y,m);
  const cur=monthTotals(txns,month,settings), avgSpend=average(txns,month,12,settings,"spend"), avgIncome=average(txns,month,3,settings,"income");
  const fixedNow=Object.entries(cur.byCat).filter(([c])=>FIXED.has(c)).reduce((a,[,v])=>a+v,0);
  const have=new Set(monthsWithData(txns)), prev3=prevMonths(month,3).filter(x=>have.has(x));
  const fixedUsual=prev3.length?prev3.reduce((a,x)=>a+Object.entries(monthTotals(txns,x,settings).byCat).filter(([c])=>FIXED.has(c)).reduce((s,[,v])=>s+v,0),0)/prev3.length:0;
  const projected=round2(Math.max(fixedNow,fixedUsual)+(cur.spend-fixedNow)/d*dim), incomeRef=cur.income||avgIncome||0;
  const last12=prevMonths(month,12).map(mm=>monthTotals(txns,mm,settings)), inc12=last12.reduce((a,x)=>a+x.income,0)+cur.income, sav12=last12.reduce((a,x)=>a+x.save,0)+cur.save;
  return {month,day:d,daysInMonth:dim,cur,avgSpend,avgIncome,projected,overIncome:incomeRef>0&&projected>incomeRef,incomeRef:round2(incomeRef),
    savingsRate:cur.income>0?round2(cur.save/cur.income*100):null,savingsRate12:inc12>0?round2(sav12/inc12*100):null,
    tie:tieOut(txns,month,settings),changes:whatChanged(txns,month,settings)};
}
// net pay − spending − saved = left. Actual = what really moved in the accounts this month (all completed rows).
// The gap is money that moved but isn't income/spend/saving: usually an own-account transfer whose other side isn't imported.
function tieOut(txns,month,settings){
  const t=monthTotals(txns,month,settings), left=round2(t.income-t.spend-t.save);
  const rows=done(txns).filter(x=>monthKey(x.date)===month), actual=round2(rows.reduce((a,x)=>a+x.amountEur,0));
  return {income:t.income,spend:t.spend,save:t.save,left,actual,gap:round2(actual-left),gapRows:rows.filter(x=>x.kind==="INTERNAL").map(x=>x.id)};
}
function whatChanged(txns,month,settings,n=3){
  const cur=monthTotals(txns,month,settings).byCat, prev=prevMonths(month,3).map(m=>monthTotals(txns,m,settings).byCat);
  const have=new Set(monthsWithData(txns)), k=prevMonths(month,3).filter(m=>have.has(m)).length;
  if(!k)return []; // no history yet: nothing to compare with
  const cats=new Set([...Object.keys(cur),...prev.flatMap(Object.keys)]);
  return [...cats].map(c=>{const avg=round2(prev.reduce((a,p)=>a+(p[c]||0),0)/k);return {category:c,now:round2(cur[c]||0),avg,delta:round2((cur[c]||0)-avg)}})
    .filter(x=>x.delta>0.5).sort((a,b)=>b.delta-a.delta).slice(0,n);
}
function monthlySeries(txns,settings,months){return months.map(m=>monthTotals(txns,m,settings))}
function categoryTrend(txns,settings,category,months){return months.map(m=>({month:m,value:monthTotals(txns,m,settings).byCat[category]||0}))}
function merchantStats(txns,todayIso,limit=15){
  const end=new Date(todayIso).getTime(), start=end-365*864e5, by={};
  for(const t of done(txns)){if(t.kind!=="SPEND"||t.amountEur>=0)continue;const ts=new Date(t.date).getTime();if(ts<start||ts>end)continue;
    const k=merchantKey(t.desc);(by[k]=by[k]||{merchant:k,count:0,total:0,first:t.date,ids:[]});by[k].count++;by[k].total+=-t.amountEur;by[k].ids.push(t.id);if(t.date<by[k].first)by[k].first=t.date}
  const firstAll=done(txns).reduce((a,t)=>t.date<a?t.date:a,todayIso), span=Math.max(30,Math.min(365,(end-new Date(firstAll).getTime())/864e5+1));
  return Object.values(by).map(x=>({...x,total:round2(x.total),avg:round2(x.total/x.count),yearly:Math.round(x.total*365/span),rough:span<90}))
    .sort((a,b)=>b.yearly-a.yearly).slice(0,limit);
}
// Drill-down: every number on screen maps to a filter.
function filterTxns(txns,f,settings){
  return txns.filter(t=>(!f.month||monthKey(t.date)===f.month)&&(!f.kind||t.kind===f.kind)&&(!f.category||t.category===f.category)&&
    (!f.group||(t.kind==="SPEND"&&catDef(settings,t.category).group===f.group))&&(!f.merchant||merchantKey(t.desc)===f.merchant)&&
    (!f.ids||f.ids.includes(t.id))&&(f.pending?t.state==="pending":t.state!=="pending"))
    .sort((a,b)=>b.date.localeCompare(a.date));
}
function toCSV(txns){const cols=["date","account","desc","amountEur","currency","kind","category","state","note"];
  const q=v=>{v=v==null?"":String(v);return /[",\n]/.test(v)?`"${v.replace(/"/g,'""')}"`:v};
  return [cols.join(","),...txns.map(t=>cols.map(c=>q(t[c])).join(","))].join("\n")+"\n"}

const API={CATEGORIES,GROUPS,FIXED,RULES,parseCSV,parseRevolut,parseBank,normalizeDate,num,merchantKey,defaultSettings,catDef,guessCategory,
  classify,withIds,merge,linkRefunds,recategorise,setKind,monthTotals,monthsWithData,prevMonths,average,dashboard,tieOut,whatChanged,
  monthlySeries,categoryTrend,merchantStats,filterTxns,toCSV,needShare,monthKey,round2};
root.MoneyCore=API; if(typeof module!=="undefined")module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
