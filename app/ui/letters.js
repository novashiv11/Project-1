/* Letters → reminders: photos of IRP letters, insurance, bills → dated items in one go.
   Registers EXTRA_VIEWS.letters (⋯ menu entry via `menu`). Page globals (settings, capture, askClaude, parseClaude,
   applyPaste via data-paste buttons, pasteResult, view, render, esc, toast, iso, todayDate, backend) are used only at call time.
   With an API key: photos are downscaled in a canvas and sent once to Claude (Sonnet, photos per CLAUDE.md); nothing is stored.
   Without a key: opens the person's Claude app with a prompt, then the usual LIFEOS paste-back. */
(()=>{
const css=`
.let{display:grid;gap:14px;min-width:0}
.let *{min-width:0}
.let .go{padding:12px 16px;border-radius:14px}
.let-pick{display:grid;gap:8px}
.let-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:16px;border-radius:18px;font:800 17px var(--display,system-ui);
  background:var(--accent);color:var(--accent-ink);cursor:pointer;text-align:center}
.let-cam{justify-self:center;color:var(--accent);font:700 14px var(--body,system-ui);cursor:pointer;padding:6px}
.let-file{position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none}
.let-steps{margin:0;padding-left:20px;display:grid;gap:6px}
.let-row{display:grid;grid-template-columns:28px minmax(0,1fr);gap:8px;align-items:center}
.let-row input[type=checkbox]{width:22px;height:22px;accent-color:var(--accent);margin:0}
.let-row input[type=text]{width:100%;padding:10px 12px;font:15px var(--body,system-ui);color:var(--fg);background:var(--bg);border:1.5px solid var(--line);border-radius:12px}
.let-err{color:var(--late);margin:0;font-size:14px}
.let-note{color:var(--muted);font-size:12px;margin:0}
`;
document.head.insertAdjacentHTML("beforeend",`<style>${css}</style>`);

const MODEL="claude-sonnet-5-5", MAX=1600, Q=0.8;
const PRIVACY="NEVER include document, card, PPSN, passport, IRP, policy, account, IBAN or reference numbers, names of other people, or addresses.";
let rows=[], busy=0, err="";

// Client-side safety net: drop any run of 6+ digits (ID/policy/account numbers). Dates like 2027-01-20 survive.
const scrub=t=>String(t||"").replace(/\d{6,}/g,"").replace(/[ \t]{2,}/g," ").replace(/\s+([,.;:)])/g,"$1").replace(/\(\s*\)/g,"").trim();
const lineOf=r=>[scrub(r.text),/^\d{4}-\d{2}-\d{2}$/.test(r.date||"")?r.date:"",/^every\b[\w ]{0,20}$/i.test(r.repeat||"")?r.repeat.trim():""]
  .filter(Boolean).join(" ");

function apiPrompt(){
  return `These are photos of my letters, cards and bills. I live in Ireland. Today is ${iso(todayDate())}.
Find every deadline, expiry, renewal, appointment and payment date in them.
Return ONLY a JSON array, no other text:
[{"text": "...", "date": "YYYY-MM-DD" or null, "repeat": "every year" | "every month" | null}]
"text" is one short line in simple English, the way I would type it, without the date (e.g. "IRP card expires", "car insurance renewal", "Electric Ireland bill pay").
${PRIVACY}
If nothing has a date, return [].`;
}
function claudePromptLetters(){
  return `I'm attaching photos of my letters, cards and bills (I live in Ireland: IRP/immigration, insurance, bills, Revenue, NCT, motor tax…). Today is ${iso(todayDate())}.
Read every deadline, expiry, renewal, appointment and payment date in them.
Reply with ONLY this block:
LIFEOS
+ one short line per item, with the date as YYYY-MM-DD and "every year" / "every month" if it repeats (e.g. "IRP card expires 2027-01-20", "car insurance renewal 2027-03-05 every year")
Privacy: ${PRIVACY}`;
}

async function shrink(file){ // max 1600px JPEG, never kept
  const bmp=await createImageBitmap(file), k=Math.min(1,MAX/Math.max(bmp.width,bmp.height));
  const c=document.createElement("canvas"); c.width=Math.max(1,Math.round(bmp.width*k)); c.height=Math.max(1,Math.round(bmp.height*k));
  c.getContext("2d").drawImage(bmp,0,0,c.width,c.height); if(bmp.close)bmp.close();
  return c.toDataURL("image/jpeg",Q).split(",")[1];
}
function parseList(txt){
  const a=txt.indexOf("["), b=txt.lastIndexOf("]"); if(a<0||b<a)throw new Error("Claude didn't return a list. Try again.");
  const arr=JSON.parse(txt.slice(a,b+1)); if(!Array.isArray(arr))throw new Error("Claude didn't return a list. Try again.");
  return arr.filter(x=>x&&typeof x.text==="string").map(x=>({line:lineOf(x),on:true})).filter(r=>r.line.length>=3);
}
async function readPhotos(files){
  busy=files.length; err=""; render();
  try{
    const imgs=[]; for(const f of files)imgs.push(await shrink(f));
    const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":settings.key,
      "anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:MODEL,max_tokens:2048,messages:[{role:"user",content:[
        ...imgs.map(data=>({type:"image",source:{type:"base64",media_type:"image/jpeg",data}})),{type:"text",text:apiPrompt()}]}]})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok){const m=data.error&&data.error.message||r.statusText;
      throw new Error(r.status===401?"That API key didn't work. Check it in Jarvis settings.":r.status===429?"Too many requests right now. Try again in a minute.":m)}
    const found=parseList((data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("\n"));
    if(!found.length)err="No dates found in these photos.";
    rows=rows.concat(found);
  }catch(e){err=e.message||"Couldn't read the photos. Try again."}
  busy=0; render();
}
const checked=()=>rows.filter(r=>r.on&&scrub(r.line).length>=3);

function keyMode(){
  const pick=busy?`<div class="setup" aria-live="polite"><b>Reading ${busy} photo${busy>1?"s":""}…</b><span class="covers">Takes a few seconds.</span></div>`
    :`<div class="let-pick"><label class="let-btn">📸 Pick photos<input class="let-file" type="file" accept="image/*" multiple data-let-files aria-label="Pick photos of letters"></label>
      <label class="let-cam">or take a photo<input class="let-file" type="file" accept="image/*" capture="environment" data-let-files aria-label="Take a photo of a letter"></label></div>`;
  const list=rows.length?`<section class="setup" aria-label="Review reminders" data-let-review><b>Found ${rows.length} · check and fix</b>
      ${rows.map((r,i)=>`<div class="let-row"><input type="checkbox" data-let-on="${i}"${r.on?" checked":""} aria-label="Add this one">
        <input type="text" data-let-text="${i}" value="${esc(r.line)}" aria-label="Reminder ${i+1}"></div>`).join("")}
      <div class="acts"><button class="go" data-let="add">Add ${checked().length}</button><button class="linkbtn" data-let="clear">Clear</button></div></section>`:"";
  return `${pick}${err?`<p class="let-err" role="alert">${esc(err)}</p>`:""}${list}`;
}
function noKeyMode(){
  const pv=pasteResult?(pasteResult.adds.length||pasteResult.dones.length?`<div class="setup" data-let-pv><b>From Claude</b><div class="pv">
      ${pasteResult.adds.map(t=>`<div>＋ ${esc(t)}</div>`).join("")}${pasteResult.dones.map(id=>`<div>✓ done: ${esc(items.get(id).text)}</div>`).join("")}</div>
      <div class="acts"><button class="go" data-paste="apply">Save all</button><button class="linkbtn" data-paste="cancel">Cancel</button></div></div>`
    :`<div class="setup"><b>Nothing to save found.</b><span class="covers">Paste the part of Claude's reply that starts with LIFEOS.</span><button class="linkbtn" data-paste="cancel">OK</button></div>`):"";
  const canShare=!!(navigator.share&&navigator.canShare);
  return `<div class="setup"><ol class="let-steps"><li><b>Photos chuno</b></li><li><b>Claude ko bhejo</b> → share menu mein Claude app (prompt copied: wahan paste karo)</li><li>Claude ki LIFEOS lines yahan paste karo</li></ol>
      ${canShare?`<label class="let-btn">📸 Photos chuno${freeFiles.length?` (${freeFiles.length})`:""}<input class="let-file" type="file" accept="image/*" multiple data-let-free aria-label="Pick photos of letters"></label>
      ${freeFiles.length?`<button class="go" data-let="share">Claude ko bhejo (${freeFiles.length} photo${freeFiles.length>1?"s":""}) ↗</button>`:""}
      <button class="linkbtn" data-let="open">Ya Claude kholo aur khud attach karo ↗</button>`
      :`<button class="go" data-let="open">Open Claude ↗</button>`}</div>
    <form class="setup" id="letpaste"><textarea id="paste" rows="4" placeholder="Paste LIFEOS lines here…" aria-label="Claude's reply"></textarea>
      <div class="acts"><button class="linkbtn" type="button" data-readclip>📋 Paste clipboard</button><button class="go" type="submit">Check</button></div></form>${pv}`;
}

let freeFiles=[];
document.addEventListener("change",e=>{
  const t=e.target;
  if(t.matches&&t.matches("[data-let-free]")){freeFiles=[...(t.files||[])].filter(f=>/^image\//.test(f.type)).slice(0,10);render();return}
  if(t.matches&&t.matches("[data-let-files]")){const fs=[...(t.files||[])].filter(f=>/^image\//.test(f.type)).slice(0,10);if(fs.length&&!busy)readPhotos(fs);return}
  if(t.dataset&&t.dataset.letOn!==undefined){const r=rows[+t.dataset.letOn];if(r)r.on=t.checked;
    const b=document.querySelector("[data-let=add]");if(b)b.textContent=`Add ${checked().length}`}
});
document.addEventListener("input",e=>{
  const t=e.target; if(!t.dataset||t.dataset.letText===undefined)return;
  const r=rows[+t.dataset.letText]; if(r)r.line=t.value;
  const b=document.querySelector("[data-let=add]");if(b)b.textContent=`Add ${checked().length}`;
});
document.addEventListener("submit",e=>{
  if(e.target.id!=="letpaste")return; e.preventDefault();
  const r=parseClaude(document.getElementById("paste").value);
  r.adds=[...new Set(r.adds.map(scrub).filter(t=>t.length>=3))];
  pasteResult=r; render();
});
document.addEventListener("click",async e=>{
  const b=e.target.closest&&e.target.closest("[data-let]"); if(!b)return;
  if(b.dataset.let==="open"){askClaude("📸 Letters → reminders",claudePromptLetters());view="letters";render();return}
  if(b.dataset.let==="share"){ // needs this tap (user activation) for the share sheet
    const text=claudePromptLetters();
    try{navigator.clipboard&&navigator.clipboard.writeText(text).catch(()=>{})}catch(_){}
    const data={files:freeFiles,text,title:"Letters → reminders"};
    try{if(navigator.canShare&&!navigator.canShare(data))delete data.text;await navigator.share(data);freeFiles=[];render();
      toast("Claude mein prompt paste karo (copied). Reply ki LIFEOS lines yahan paste karo.",false)}
    catch(x){if(x&&x.name==="AbortError")return;askClaude("📸 Letters → reminders",text);view="letters";render()}
    return}
  if(b.dataset.let==="clear"){rows=[];err="";render();return}
  if(b.dataset.let==="add"){
    if(typeof backend==="undefined"||!backend)return;
    const todo=checked(); if(!todo.length)return; b.disabled=true;
    for(const r of todo)await capture(scrub(r.line));
    rows=[]; err=""; render(); toast(`Ho gaya ✓ ${todo.length} reminder${todo.length>1?"s":""} added`,false);
  }
});

window.EXTRA_VIEWS=window.EXTRA_VIEWS||{};
EXTRA_VIEWS.letters={title:"Letters",
  menu:{icon:"📸",title:"Letters → reminders",sub:"Photos of IRP, insurance, bills → dates"},
  render(){
    return `<div class="let"><p class="covers">Photos of letters, cards and bills → every deadline becomes a reminder.</p>
      ${settings.key&&(typeof CHAT_OK==="undefined"||CHAT_OK)?keyMode():noKeyMode()}
      <p class="let-note">🔒 Photos are never stored: read once, then thrown away. ID and policy numbers are left out.</p></div>`},
  mount(){},
  _test:{scrub,lineOf,parseList,apiPrompt,claudePromptLetters}};
})();
