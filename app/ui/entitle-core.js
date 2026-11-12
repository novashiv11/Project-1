/* Entitlements core: check a profile against scheme rules, work out when a benefit is available again,
   and draft the booking email. Pure functions, no DOM: window.EntitleCore in the browser, require() in node tests.
   Scheme facts live in schemes.js (each carries its official source link and a "verified" date). */
(function(root){
"use strict";
const pad=n=>String(n).padStart(2,"0");
const get=(o,path)=>path.split(".").reduce((a,k)=>a==null?a:a[k],o);
const blank=v=>v==null||v==="";

// One rule → "yes" | "no" | "need". Rule kinds:
//  {field, in:[…]}            value must be one of
//  {field, is:value}          value must equal
//  {field, gte:n}             number must be at least n
//  {field:"prsi_years", weeksByAge:{u21:39,…}}  paid PRSI weeks needed for the person's age band (years × 52)
function rule(profile,r){
  if(r.weeksByAge){
    const band=profile.age_band, yrs=profile.prsi_years;
    if(blank(band))return {s:"need",field:"age_band"};
    if(blank(yrs))return {s:"need",field:"prsi_years"};
    const need=r.weeksByAge[band]; if(need==null)return {s:"need",field:"age_band"};
    return {s:+yrs*52>=need?"yes":"no"};
  }
  const v=get(profile,r.field);
  if(blank(v))return {s:"need",field:r.field};
  if(r.in)return {s:r.in.includes(v)?"yes":"no"};
  if("is" in r)return {s:v===r.is?"yes":"no"};
  if("gte" in r)return {s:+v>=r.gte?"yes":"no"};
  return {s:"yes"};
}
// → {status:"yes"|"no"|"need", reason, ask:{field, question}}. A clear "no" wins over a missing answer.
function check(profile,scheme){
  let need=null;
  for(const r of scheme.rules||[]){
    const x=rule(profile||{},r);
    if(x.s==="no")return {status:"no",reason:r.no||"Doesn't match this scheme's rules"};
    if(x.s==="need"&&!need)need={field:x.field,question:r.ask||`Fill in: ${x.field}`};
  }
  return need?{status:"need",ask:need}:{status:"yes"};
}
// When can it be used again after a claim on lastIso?
//  {type:"calendar_year"}        → 1 Jan of the next year
//  {type:"calendar_years",n:2}   → 1 Jan, n years after the claim year
//  {type:"years",n:2}            → same day n years later
function nextEligible(scheme,lastIso){
  if(!lastIso)return null;
  const [y,m,d]=lastIso.slice(0,10).split("-").map(Number), r=scheme.renews||{type:"calendar_year"};
  if(r.type==="years")return `${y+(r.n||1)}-${pad(m)}-${pad(m===2&&d===29?28:d)}`;
  return `${y+(r.type==="calendar_years"?(r.n||1):1)}-01-01`;
}
function available(scheme,claims,todayIso){
  const last=(claims||{})[scheme.id]&&claims[scheme.id].last, next=nextEligible(scheme,last);
  return !next||todayIso>=next;
}
// Year-end nudge for benefits that reset on 1 Jan.
function useItOrLoseIt(scheme,claims,todayIso){
  return (scheme.renews||{}).type==="calendar_year"&&available(scheme,claims,todayIso)&&+todayIso.slice(5,7)>=11;
}
// Never let an ID slip into a draft: Irish PPS numbers (7 digits + 1–2 letters) and long digit runs.
const scrub=t=>String(t||"").replace(/\b\d{7}\s?[A-Za-z]{1,2}\b/g,"").replace(/\b\d{8,}\b/g,"").replace(/[ \t]{2,}/g," ");
function draft(scheme,profile,name,opts){
  opts=opts||{}; const d=scheme.draft||{};
  const lines=["Hello,","",d.ask||`I'd like to book an appointment under the ${scheme.name}.`,
    "Do you take new patients under the scheme, and what is your earliest appointment?",
    opts.when?`I'm usually free ${opts.when}.`:"",
    "","Thank you,",name||"",opts.phone?`Phone: ${opts.phone}`:""].filter((l,i,a)=>l!==""||a[i-1]!=="");
  return {subject:scrub(d.subject||`Appointment request: ${scheme.short||scheme.name}`),body:scrub(lines.join("\n")).trim()};
}
const emails=s=>[...new Set(String(s||"").split(/[\s,;]+/).map(x=>x.trim()).filter(x=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))].slice(0,3);
// One clinic → To. Several → BCC, so clinics don't see each other.
function mailto(list,subject,body){
  const q=`subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return list.length<=1?`mailto:${encodeURIComponent(list[0]||"")}?${q}`:`mailto:?bcc=${encodeURIComponent(list.join(","))}&${q}`;
}
const mapsUrl=(what,town)=>`https://www.google.com/maps/search/${encodeURIComponent(`${what} near ${town||"me"}`)}`;
// Free text ("dental check-up", "eye test kab?") → scheme, by keyword.
function route(text,schemes){
  const t=String(text||"").toLowerCase();
  return (schemes||[]).find(s=>(s.keywords||[]).some(k=>new RegExp(`\\b${k}`,"i").test(t)))||null;
}
const API={check,nextEligible,available,useItOrLoseIt,scrub,draft,emails,mailto,mapsUrl,route};
root.EntitleCore=API; if(typeof module!=="undefined")module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
