// Shared helpers for the in-browser file tools. Nothing is uploaded anywhere.
function kb(n){return n>1048576?(n/1048576).toFixed(2)+' MB':Math.max(1,Math.round(n/1024))+' KB'}
function setupDrop(label,onFiles){
  const input=label.querySelector('input');
  input.addEventListener('change',()=>{onFiles([...input.files]);input.value='';});
  label.addEventListener('dragover',e=>{e.preventDefault();label.classList.add('over');});
  label.addEventListener('dragleave',()=>label.classList.remove('over'));
  label.addEventListener('drop',e=>{e.preventDefault();label.classList.remove('over');onFiles([...e.dataTransfer.files]);});
}
function download(blob,name){
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),10000);
}
function loadImage(file){
  return new Promise((ok,bad)=>{const img=new Image();img.onload=()=>ok(img);img.onerror=()=>bad(new Error(file.name+' is not a supported image'));img.src=URL.createObjectURL(file);});
}
// Draws an image to a canvas (optionally shrunk to maxW) and returns a JPEG/WebP blob.
async function encodeImage(file,{maxW=0,quality=0.8,type='image/jpeg'}={}){
  const img=await loadImage(file);
  const s=maxW&&img.naturalWidth>maxW?maxW/img.naturalWidth:1;
  const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);
  const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);
  URL.revokeObjectURL(img.src);
  return new Promise(ok=>c.toBlob(b=>ok({blob:b,width:c.width,height:c.height}),type,quality));
}
