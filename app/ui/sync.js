/* Google Drive sync: optional private copy of all items in the user's own Drive appDataFolder (lifeos-items.json).
   Uses page globals (items, localBackend, settings, saveSettings, render, toast, upgrade, view) only at call time.
   Token lives in memory only; settings keep syncOn, syncLast and syncDeleted (tombstones). The Claude key is never sent.
   Founder setup + limits: docs/DRIVE_SYNC.md */
(()=>{
const GOOGLE_CLIENT_ID="";  // paste the OAuth Web client ID here (docs/DRIVE_SYNC.md); empty = "coming soon"
const SCOPE="https://www.googleapis.com/auth/drive.appdata", FILE="lifeos-items.json";
const API="https://www.googleapis.com/drive/v3/files", UP="https://www.googleapis.com/upload/drive/v3/files";
const MAX_TOMBSTONES=1000;
const clientId=()=>window.LIFEOS_GOOGLE_CLIENT_ID||GOOGLE_CLIENT_ID;
const debounce=()=>window.LIFEOS_SYNC_DEBOUNCE||3000;
const S={token:null,exp:0,client:null,wait:null,gisP:null,fileId:null,timer:null,busy:false,again:false,need:false,state:"",err:"",known:null,writing:false};
const H=window.LIFEOS_HOOKS=window.LIFEOS_HOOKS||{};
const stampNow=()=>new Date().toISOString().slice(0,19);
const stamp=i=>String((i&&(i.updated||i.done_at||i.created))||"");
const canon=list=>JSON.stringify([...list].sort((a,b)=>String(a.id).localeCompare(String(b.id))));

/* Union by id; same id → later `updated` (else done_at/created) wins, ties keep local. Tombstone newer than the item removes it. */
function merge(local,remote){
  const del={...((remote&&remote.deleted)||{})};
  Object.entries(local.deleted||{}).forEach(([k,v])=>{if(!del[k]||v>del[k])del[k]=v});
  const m=new Map();
  (local.items||[]).forEach(i=>m.set(String(i.id),i));
  ((remote&&remote.items)||[]).forEach(r=>{const k=String(r.id),l=m.get(k);if(!l||stamp(r)>stamp(l))m.set(k,r)});
  const out=[...m.entries()].filter(([k,i])=>!(del[k]&&del[k]>=stamp(i))).map(([,i])=>i);
  const keep=Object.entries(del).sort((a,b)=>b[1].localeCompare(a[1])).slice(0,MAX_TOMBSTONES);
  return {items:out,deleted:Object.fromEntries(keep)};
}

function gis(){
  if(window.google&&google.accounts&&google.accounts.oauth2)return Promise.resolve();
  return S.gisP||(S.gisP=new Promise((ok,no)=>{const s=document.createElement("script");s.src="https://accounts.google.com/gsi/client";s.async=true;
    s.onload=ok;s.onerror=()=>{S.gisP=null;no(new Error("could not load Google sign-in"))};document.head.appendChild(s)}));
}
function getToken(prompt){
  return gis().then(()=>new Promise((ok,no)=>{
    const t=setTimeout(()=>S.wait&&S.wait.no(new Error("timeout")),prompt===""?15000:120000);
    S.wait={ok:()=>{clearTimeout(t);S.wait=null;ok()},no:e=>{clearTimeout(t);S.wait=null;no(e)}};
    if(!S.client)S.client=google.accounts.oauth2.initTokenClient({client_id:clientId(),scope:SCOPE,
      callback:r=>{const w=S.wait;if(!w)return;
        if(r&&r.access_token){S.token=r.access_token;S.exp=Date.now()+(+r.expires_in||3600)*1000;w.ok()}
        else w.no(new Error((r&&(r.error_description||r.error))||"no token"))},
      error_callback:e=>{S.wait&&S.wait.no(new Error((e&&e.type)||"cancelled"))}});
    S.client.requestAccessToken(prompt===undefined?{}:{prompt});
  }));
}
async function drive(method,url,body,type){
  const headers={Authorization:"Bearer "+S.token};if(type)headers["Content-Type"]=type;
  const r=await fetch(url,{method,headers,body});
  if(r.status===401){S.token=null;throw new Error("auth")}
  if(!r.ok)throw new Error("Drive "+r.status);
  return r;
}
async function findFile(){
  const q=encodeURIComponent(`name='${FILE}' and trashed=false`);
  const r=await drive("GET",`${API}?spaces=appDataFolder&fields=files(id,name)&q=${q}`);
  const f=((await r.json()).files||[])[0];return f?f.id:null;
}
async function upload(doc){
  const json=JSON.stringify(doc);
  if(S.fileId){
    try{await drive("PATCH",`${UP}/${S.fileId}?uploadType=media`,json,"application/json");return}
    catch(e){if(e.message!=="Drive 404")throw e;S.fileId=null}
  }
  const b="lifeos"+Math.random().toString(36).slice(2);
  const body=`--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({name:FILE,parents:["appDataFolder"]})}\r\n`+
    `--${b}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${b}--`;
  const r=await drive("POST",`${UP}?uploadType=multipart&fields=id`,body,`multipart/related; boundary=${b}`);
  S.fileId=(await r.json()).id;
}
function applyLocal(list){
  const keep=new Set(list.map(i=>i.id));
  [...items.keys()].forEach(id=>{if(!keep.has(id))items.delete(id)});
  list.forEach(i=>items.set(i.id,upgrade(i)));
  S.writing=true;try{localBackend.save()}finally{S.writing=false}
  S.known=new Set(items.keys());
  render();
}
function refresh(){if(typeof view!=="undefined"&&view==="all")render()}

async function sync(){
  if(!settings.syncOn||!clientId())return;
  if(S.busy){S.again=true;return}
  if(!S.token||Date.now()>S.exp-60000){S.token=null;S.need=true;refresh();return}  // no popup without a tap
  S.busy=true;S.err="";
  try{
    if(!S.fileId)S.fileId=await findFile();
    const remote=S.fileId?await (await drive("GET",`${API}/${S.fileId}?alt=media`)).json():null;
    const local={items:[...items.values()],deleted:settings.syncDeleted||{}};
    const m=merge(local,remote);
    settings.syncDeleted=m.deleted;
    if(canon(local.items)!==canon(m.items))applyLocal(m.items);
    if(!remote||canon(remote.items||[])!==canon(m.items)||JSON.stringify(remote.deleted||{})!==JSON.stringify(m.deleted))
      await upload({app:"lifeos",v:1,saved:stampNow(),items:m.items,deleted:m.deleted});  // items only: never settings/key
    settings.syncLast=Date.now();saveSettings();
  }catch(e){S.err=e.message;if(e.message==="auth")S.need=true;console.warn("Drive sync:",e.message)}
  finally{S.busy=false;refresh();if(S.again){S.again=false;schedule()}}
}
function schedule(){clearTimeout(S.timer);S.timer=setTimeout(sync,debounce())}

async function connectDrive(){
  S.state="Connecting…";refresh();
  try{
    await getToken();
    settings.syncOn=true;S.need=false;saveSettings();S.known=new Set(items.keys());
    await sync();
    toast(S.err?`Drive sync failed: ${S.err}`:"Google Drive connected ✓",false);
  }catch(e){toast(/popup_failed/.test(e.message)?"Popup blocked. Tap Connect again.":`Drive not connected (${e.message})`,false)}
  finally{S.state="";refresh()}
}
function disconnect(){
  try{if(S.token&&window.google&&google.accounts.oauth2.revoke)google.accounts.oauth2.revoke(S.token,()=>{})}catch(e){}
  clearTimeout(S.timer);Object.assign(S,{token:null,exp:0,fileId:null,need:false,err:""});
  delete settings.syncOn;delete settings.syncLast;delete settings.syncDeleted;saveSettings();render();
  toast("Drive sync off. Your Drive copy stays until you remove LifeOS in Google account settings.",false);
}

const when=ms=>ms?new Date(ms).toLocaleString([], {day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"not yet";
(H.prefs=H.prefs||[]).push(()=>{
  if(!clientId())return `<div class="setup" data-sync-box><span>☁️ Drive sync: coming soon</span></div>`;
  const btn=(a,l,cls="go")=>`<button class="${cls}" style="padding:10px 14px" data-sync="${a}">${l}</button>`;
  if(S.state)return `<div class="setup" data-sync-box><span>☁️ ${S.state}</span></div>`;
  if(!settings.syncOn)return `<div class="setup" data-sync-box><span>☁️ Keep a private copy in your own Google Drive (hidden app folder). New phone? Connect and everything comes back.</span>
    <div class="acts">${btn("connect","Connect Google Drive")}</div></div>`;
  const status=S.need?"Drive sync paused. Tap Reconnect.":S.busy?"Syncing…":S.err?`Last sync failed (${S.err}).`:"Google Drive sync on.";
  return `<div class="setup" data-sync-box><span>☁️ ${status}</span><span class="covers" data-sync-last>Last synced: ${when(settings.syncLast)}</span>
    <div class="acts" style="display:flex;gap:8px;flex-wrap:wrap">${S.need?btn("connect","Reconnect"):btn("now","Sync now")}${btn("off","Disconnect","linkbtn")}</div></div>`;
});
(H.save=H.save||[]).push(arr=>{
  if(S.writing)return;
  const ids=new Set(arr.map(i=>i.id));
  if(settings.syncOn&&S.known){let n=0;const t=stampNow();
    S.known.forEach(id=>{if(!ids.has(id)){(settings.syncDeleted=settings.syncDeleted||{})[String(id)]=t;n++}});
    if(n)saveSettings()}
  S.known=ids;
  if(settings.syncOn&&clientId())schedule();
});
(H.boot=H.boot||[]).push(()=>{
  S.known=new Set(items.keys());
  if(!settings.syncOn||!clientId())return;
  getToken("").then(()=>{S.need=false;return sync()}).catch(()=>{S.need=true;refresh()});
});
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-sync]");if(!b)return;
  const a=b.dataset.sync;
  if(a==="connect")connectDrive();
  else if(a==="now")sync();
  else if(a==="off")disconnect();
});
window.LIFEOS_SYNC={merge,sync,state:S};
})();
