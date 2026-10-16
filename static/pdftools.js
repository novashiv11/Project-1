// Shared helpers for the PDF page tools (split, rotate, delete, number, watermark).
// Needs filetools.js and vendor/pdf-lib.min.js. Everything runs in the browser.

// Turns "1-3, 5, 8-10" into 0-based page indexes (in the order typed, no duplicates).
// Throws an Error with a friendly message if the text is not valid for an n-page PDF.
function parseRanges(text,n){
  const parts=String(text).split(',').map(s=>s.trim()).filter(Boolean);
  if(!parts.length)throw new Error('Enter the pages you want, for example 1-3, 5, 8-10.');
  const out=[],seen=new Set();
  for(const p of parts){
    const m=p.match(/^(\d+)(?:\s*[-\u2013]\s*(\d+|end))?$/i);
    if(!m)throw new Error(`"${p}" is not a page number or range. Use numbers like 1-3, 5, 8-10.`);
    const a=+m[1],b=m[2]===undefined?a:/end/i.test(m[2])?n:+m[2];
    if(a<1||b<1)throw new Error('Page numbers start at 1.');
    if(a>b)throw new Error(`"${p}" goes backwards. Write the smaller page number first.`);
    if(b>n)throw new Error(`"${p}" is outside this PDF, which has ${n} page${n==1?'':'s'}.`);
    for(let i=a;i<=b;i++)if(!seen.has(i)){seen.add(i);out.push(i-1);}
  }
  return out;
}

// Wires a drop zone for a single PDF. Calls onLoad({file,bytes,pages}) once it opens,
// and writes status messages into the out element.
function setupPdfDrop(drop,out,onLoad){
  setupDrop(drop,async files=>{
    const f=files.find(x=>x.type==='application/pdf'||/\.pdf$/i.test(x.name));
    if(!f){out.textContent='Please choose a PDF file.';return;}
    out.textContent='Opening '+f.name+'...';
    try{
      const bytes=await f.arrayBuffer();
      const doc=await openPdf(bytes,f.name);
      const pages=doc.getPageCount();
      drop.firstChild.textContent=f.name;
      drop.querySelector('span').textContent=`${pages} page${pages==1?'':'s'}, ${kb(f.size)}. Click to choose another file.`;
      out.textContent=`Loaded ${f.name}: ${pages} page${pages==1?'':'s'}.`;
      onLoad({file:f,bytes,pages});
    }catch(e){out.textContent=e.message;}
  });
}

async function openPdf(bytes,name){
  try{return await PDFLib.PDFDocument.load(bytes);}
  catch(e){throw new Error(`${name||'This file'} could not be opened. It may be damaged or password-protected.`);}
}

// "report.pdf" -> "report-rotated.pdf"
function outName(name,suffix){return name.replace(/\.pdf$/i,'')+'-'+suffix+'.pdf';}

async function savePdf(doc,name){
  const blob=new Blob([await doc.save()],{type:'application/pdf'});
  download(blob,name);
  return blob;
}

function hexToRgb(hex){
  const v=parseInt(hex.slice(1),16);
  return PDFLib.rgb((v>>16&255)/255,(v>>8&255)/255,(v&255)/255);
}
