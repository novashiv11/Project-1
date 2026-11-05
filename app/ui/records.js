/* LifeOS v4 records: typed records layered on the classic item shape.
   Every record keeps the classic fields (text, domain, due, done) in sync, so every older screen keeps working.
   Store after migration: localStorage "lifeos.v2" = {schema:2, records:[…], trash:[…]}; "lifeos.items.v1" is left as the backup. */
(()=>{
const V2_KEY="lifeos.v2", DAY=864e5;
const TYPES=["task","recurring","deadline","case","job","project","fact","journal"];
const TYPE_LABEL={task:"Task",recurring:"Recurring",deadline:"Deadline",case:"Case",job:"Job",project:"Project",fact:"Fact",journal:"Journal"};
const AREAS2=[["home","Home","🏠"],["money","Money","💰"],["pets","Pets","🐾"],["documents","Documents & IDs","🛂"],["shopping","Orders & Shopping","📦"],
  ["family","Family & Friends","👪"],["health","Health","💪"],["projects","Projects","🚀"],["ideas","Ideas","💡"]];
const AREA_OF_DOMAIN={home:"home",vehicle:"home",calendar:"home",money:"money",pet:"pets",document:"documents",shopping:"shopping",family:"family",
  social:"family",travel:"family",kids:"family",health:"health",mind:"health",work:"projects",growth:"projects",idea:"ideas",journal:"ideas"};
const DOMAIN_OF_AREA={home:"home",money:"money",pets:"pet",documents:"document",shopping:"shopping",family:"family",health:"health",projects:"work",ideas:"idea"};

const PREF_RE=/\b(max(imum)? ?\d+ lines?|hinglish|reply (in|with)|short answers?|decide for me|one recommendation|prefer(s|red)? (short|hinglish|english))\b/i;
const CASE_RE=/\b(refund|dispute\w*|small claims|ccpc|ecc ireland|faulty|defect\w*|replacement|complain\w*|claim against|warranty claim|chargeback|not working|broken)\b/i;
const DEADLINE_RE=/\b(renew\w*|expir\w*|valid until|return (by|window)|returns? by|contract (ends?|end date)|cooling[- ]off|tax return|self[- ]assessment|licen[cs]e|deadline|irp|gnib|passport|visa|insurance|nct|motor tax|policy)\b/i;
const UNKNOWN_RE=/\?|\bdate unknown\b|\bunknown date\b|\bdate (tbc|tbd)\b|\(date unknown\)/i;

const day=s=>s?String(s).slice(0,10):null;
const nowStampR=()=>new Date().toISOString().slice(0,19);
const todayIso=()=>{const n=new Date();return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}-${String(n.getDate()).padStart(2,"0")}`};

/* ---- Irish working days (public holidays; weekend holidays move to the next Monday-ish weekday) ---- */
function easter(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),
  h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=(h+l-7*m+114)%31+1;
  return new Date(y,mo-1,da)}
const firstMon=(y,m)=>{const d=new Date(y,m,1);while(d.getDay()!==1)d.setDate(d.getDate()+1);return d};
const lastMon=(y,m)=>{const d=new Date(y,m+1,0);while(d.getDay()!==1)d.setDate(d.getDate()-1);return d};
const isoD=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const HOL={};
function irishHolidays(y){
  if(HOL[y])return HOL[y];
  const feb1=new Date(y,1,1), em=easter(y); em.setDate(em.getDate()+1);
  const fixed=[new Date(y,0,1),new Date(y,2,17),new Date(y,11,25),new Date(y,11,26)].map(d=>{const x=new Date(d);
    if(x.getDay()===6)x.setDate(x.getDate()+2);else if(x.getDay()===0)x.setDate(x.getDate()+1);return x});
  if(fixed[3].getTime()===fixed[2].getTime())fixed[3].setDate(fixed[3].getDate()+1); // Christmas on Sat → Mon + Tue
  const set=new Set([...fixed,feb1.getDay()===5?feb1:firstMon(y,1),em,firstMon(y,4),firstMon(y,5),firstMon(y,7),lastMon(y,9)].map(isoD));
  return HOL[y]=set;
}
const isWorkingDay=d=>d.getDay()!==0&&d.getDay()!==6&&!irishHolidays(d.getFullYear()).has(isoD(d));
function addWorkingDays(from,n){const d=new Date(from.getFullYear(),from.getMonth(),from.getDate());let left=n;
  while(left>0){d.setDate(d.getDate()+1);if(isWorkingDay(d))left--}return d}
const addDaysR=(isoDate,n)=>{const [y,m,d]=isoDate.split("-").map(Number);return isoD(new Date(y,m-1,d+n))};

/* ---- classify a classic item into a typed record ---- */
function guessType(it){
  const t=it.text||"";
  if(PREF_RE.test(t))return "fact";
  if(CASE_RE.test(t)&&!it.repeat)return "case";
  if(it.repeat)return "recurring";
  if(DEADLINE_RE.test(t))return "deadline";
  if(it.domain==="idea"||it.domain==="journal")return it.due?"task":"journal";
  return "task";
}
function typeFields(type,it){
  const d=day(it.due), unknown=UNKNOWN_RE.test(it.text||"");
  switch(type){
    case "task": return {due_date:d,priority:2};
    case "recurring":{const r=it.repeat||{every:1,unit:"month"}, spent=(it.metrics||[]).find(m=>m.name==="spent");
      return {amount:spent?spent.value:null,every:r.every,unit:r.unit,day_of_month:r.unit==="month"&&d?+d.slice(8,10):null,paid_each_month:!it.repeat,next_date:d}}
    case "deadline": return {date:unknown?null:d,date_known:!!d&&!unknown,remind_before_days:typeof leadDays==="function"?leadDays(it):30,
      action_when_due:(typeof guideFor==="function"&&guideFor(it)||{}).title||""};
    case "case":{const m=(it.text||"").match(/^\s*([^:]{2,40}?)\s*(?:refund|dispute|return|claim|complaint)?\s*:/i);
      return {seller:m?m[1].trim():"",product:"",order_date:null,delivery_date:null,price:null,bought_where:"",problem:it.text||"",want:"",
        timeline:[],evidence:[],next_action:"Log the last contact",next_action_date:d,escalation:1,waiting_on:"me",return_days:null}}
    case "job": return {tradesperson:"",quote:null,scope:"",paid:null,balance:null,checklist_state:{}};
    case "project": return {next_step:"",is_active:false};
    case "fact": return {source:"migration",confirmed:false};
    default: return {};
  }
}
// Fill the typed fields a record is missing (never overwrites ones it has).
function toRecord(it,type){
  type=type||it.type||guessType(it);
  const base={type,area:it.area||AREA_OF_DOMAIN[it.domain]||"home",title:it.text||"",notes:it.notes||"",
    status:it.status||(it.done?"done":"open"),created_at:it.created_at||it.created||nowStampR(),updated_at:it.updated_at||it.updated||it.created||nowStampR(),
    deleted_at:null,links:it.links||[]};
  return Object.assign({},typeFields(type,it),base,it,{type});
}
// Classic fields → typed fields (old screens edit text/due/done).
function fromLegacy(r){
  r.title=r.text; const d=day(r.due), a=AREA_OF_DOMAIN[r.domain]; if(a&&a!==r.area)r.area=a; // classic screens re-file by domain
  if(r.type==="task")r.due_date=d;
  else if(r.type==="recurring")r.next_date=d;
  else if(r.type==="deadline"){if(d){r.date=d;r.date_known=true}}
  else if(r.type==="case")r.next_action_date=d;
  if(r.done&&(r.status==="open"||r.status==="waiting"))r.status="done";
  if(!r.done&&(r.status==="done"||r.status==="archived"))r.status="open";
  return r;
}
// Typed fields → classic fields (new screens edit typed fields).
function toLegacy(r){
  r.text=r.title||r.text||"";
  const want=r.type==="task"?r.due_date:r.type==="recurring"?r.next_date:r.type==="deadline"?(r.date_known?r.date:null):r.type==="case"?r.next_action_date:day(r.due);
  r.due=want?(day(r.due)===want?r.due:want):null;
  if(r.type!=="recurring")r.repeat=null;
  else if(!r.paid_each_month)r.repeat={every:r.every||1,unit:r.unit||"month"};
  r.done=r.status==="done"||r.status==="archived";
  if(r.done&&!r.done_at)r.done_at=nowStampR();
  const dm=DOMAIN_OF_AREA[r.area]; if(dm&&AREA_OF_DOMAIN[r.domain]!==r.area)r.domain=dm;
  return r;
}

/* ---- store ---- */
const R2={TYPES,TYPE_LABEL,AREAS2,AREA_OF_DOMAIN,DOMAIN_OF_AREA,PREF_RE,UNKNOWN_RE,
  migrated:false,trash:new Map(),
  guessType,toRecord,fromLegacy,toLegacy,addWorkingDays,isWorkingDay,irishHolidays,addDays:addDaysR,
  areaOf:r=>(AREAS2.find(a=>a[0]===(r.area||AREA_OF_DOMAIN[r.domain]))||AREAS2[0]),
  view:it=>it.type?it:toRecord(it), // typed view of any item, migrated or not
  load(){ // → true when v2 data exists (items are loaded into the page's items Map)
    let raw=null; try{raw=localStorage.getItem(V2_KEY)}catch(e){}
    if(!raw)return false;
    try{const db=JSON.parse(raw);(db.records||[]).forEach(r=>items.set(r.id,r));this.trash=new Map((db.trash||[]).map(r=>[r.id,r]))}catch(e){return false}
    this.migrated=true; this.purge(); return true;
  },
  save(){try{localStorage.setItem(V2_KEY,JSON.stringify({schema:2,saved:nowStampR(),records:[...items.values()],trash:[...this.trash.values()]}))}catch(e){}},
  // called by the page's backend.put: keep both shapes in sync; un-trash on undo
  normalize(it){if(!this.migrated)return it;const r=it.type?fromLegacy(it):toRecord(it);r.updated_at=nowStampR();this.trash.delete(r.id);return toLegacy(r)},
  softDelete(it){const r=Object.assign({},it,{deleted_at:nowStampR()});this.trash.set(r.id,r)},
  async restore(id){const r=this.trash.get(id);if(!r)return;this.trash.delete(id);delete r.deleted_at;r.deleted_at=null;await backend.put(r)},
  forget(id){this.trash.delete(id);this.save();render()},
  purge(){const cut=Date.now()-30*DAY;for(const [id,r] of this.trash)if(Date.parse(r.deleted_at)<cut)this.trash.delete(id)},
  // typed update from new screens: patch typed fields, derive the classic ones, save with undo
  async update(id,patch,msg){const cur=items.get(id);if(!cur)return null;
    const next=toLegacy(Object.assign(clone(cur),patch,{updated_at:nowStampR()}));
    await change(id,next,msg||"Saved ✓");return next},
  async create(type,fields,msg){const id=Math.max(0,...items.keys(),...this.trash.keys())+1;
    const r=toLegacy(Object.assign(toRecord({id,text:fields.title||"",created:nowStampR(),done:false,domain:DOMAIN_OF_AREA[fields.area]||"home"},type),
      {area:fields.area||"home"},fields,{id,type}));
    await change(id,r,msg||`Saved ✓ ${TYPE_LABEL[type]}`);return r},
  async archive(id){return this.update(id,{status:"archived"},"Archived · Undo")},
  todayIso
};
window.R2=R2;
})();
