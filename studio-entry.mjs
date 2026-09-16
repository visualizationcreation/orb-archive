// File Studio retains its original classic-script order. Published records use
// a separate trusted reader and never mount the file or editing controls.
if(new URLSearchParams(location.search).has('publication')){
  await import('./museum-published-view.mjs');
}else{
  for(const src of ['studio-parser.js','orbfill-handoff.js?v=1','studio.js?v=copy-1','spanish.js?v=copy-1','studio-spanish.js?v=6','languages.js','studio-resize.js?v=2']){
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=()=>reject(new Error('Could not load '+src));document.body.append(script);});
  }
}
