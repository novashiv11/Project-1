/* Case message drafts: a short, factual message for the case's current escalation step.
   Pure function (window.CaseDraft / node). Tone rule from the founder: short and factual; stop arguing once they agree to fix it.
   No legal claims beyond the plain basics; the steps link to the official bodies. */
(function(root){
"use strict";
const scrub=t=>String(t||"").replace(/\b\d{7}\s?[A-Za-z]{1,2}\b/g,"").replace(/[ \t]{2,}/g," ");
const d=iso=>{if(!iso)return "";const [y,m,dd]=String(iso).slice(0,10).split("-").map(Number);
  return `${dd} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m-1]} ${y}`};
const LINKS={3:[["ECC Ireland (seller in another EU country)","https://www.eccireland.ie/"],["CCPC (Irish seller)","https://www.ccpc.ie/consumers/"]],
  4:[["Small Claims (Courts Service)","https://www.courts.ie/small-claims"]]};
function facts(c){
  const item=[c.product,c.seller&&`from ${c.seller}`].filter(Boolean).join(" ")||c.title||"my order";
  const when=[c.order_date&&`ordered ${d(c.order_date)}`,c.delivery_date&&`delivered ${d(c.delivery_date)}`].filter(Boolean).join(", ");
  const tl=(c.timeline||[]).slice().sort((a,b)=>String(a.at).localeCompare(String(b.at)));
  return {item,when,price:c.price!=null&&c.price!==""?`€${c.price}`:"",tl,first:tl[0],mine:tl.filter(t=>t.by==="me").length};
}
const timelineText=tl=>tl.map(t=>`- ${d(t.at)} (${t.channel||"contact"}${t.person?`, ${t.person}`:""}): ${t.by==="me"?`I said: ${t.i_said||"contacted them"}`:`They said: ${t.they_said||"replied"}`}`).join("\n");
// → {kind:"email"|"form", subject, body, links:[[label,url]]}
function draft(c,name){
  const step=Math.min(4,Math.max(1,+c.escalation||1)), f=facts(c), sign=`\n\nThank you,\n${name||""}`.trimEnd();
  const what=`${f.item}${f.when?` (${f.when})`:""}${f.price?`, ${f.price}`:""}`;
  const want=c.want?`What I'm asking for: ${c.want}.`:"Please tell me how you will put this right: repair, replacement or refund.";
  let subject,body,kind="email";
  if(step===1){
    subject=`Problem with ${f.item}`;
    body=`Hello,\n\nI bought ${what}.\nThe problem: ${c.problem||"it is faulty"}.\n${want}\n\nPlease reply within 5 working days.${sign}`;
  }else if(step===2){
    subject=`Formal complaint: ${f.item}`;
    body=`Hello,\n\nThis is a formal complaint about ${what}.\nThe problem: ${c.problem||"it is faulty"}.\n`+
      (f.first?`I first contacted you on ${d(f.first.at)}${f.mine>1?` and ${f.mine-1} more time${f.mine>2?"s":""} since`:""}, and it is still not resolved.\n`:"")+
      `${want}\nFaulty goods should be repaired, replaced or refunded. Please confirm in writing within 10 working days what you will do.\n`+
      `If I don't hear back, I will take this to the consumer bodies and, if needed, the Small Claims procedure.${sign}`;
  }else{
    kind="form";
    subject=step===3?`Complaint summary: ${f.item}`:`Small claim summary: ${f.item}`;
    body=`Seller: ${c.seller||""}\nItem: ${what}\nProblem: ${c.problem||""}\nWhat I want: ${c.want||"repair, replacement or refund"}\n`+
      (f.tl.length?`\nWhat happened:\n${timelineText(f.tl)}\n`:"")+(step===4&&f.price?`\nAmount claimed: ${f.price}\n`:"");
  }
  return {kind,step,subject:scrub(subject),body:scrub(body).trim(),links:LINKS[step]||[]};
}
const API={draft};
root.CaseDraft=API; if(typeof module!=="undefined")module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
