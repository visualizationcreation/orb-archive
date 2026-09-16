import {buildMuseumPackage,PACKAGE_LIMITS} from './lib/museum-package.mjs';

const form=document.getElementById('museum-submission');
const result=document.getElementById('package-result'),errorBox=document.getElementById('package-error'),progress=document.getElementById('package-progress');
const library=document.getElementById('submission-library');
const fileIds=['submission-html','submission-json','submission-audio','submission-media'];
const defaults={'submission-html':'Choose your HTML file','submission-json':'No data file selected','submission-audio':'Choose audio files','submission-media':'Choose supporting files'};
let packageURL,manifestURL,linkNumber=0,busy=false;
const size=bytes=>bytes>=1024*1024?(bytes/(1024*1024)).toFixed(1)+' MB':Math.ceil(bytes/1024)+' KB';
function discardResult(){result.hidden=true;errorBox.hidden=true;progress.textContent='';if(packageURL)URL.revokeObjectURL(packageURL);if(manifestURL)URL.revokeObjectURL(manifestURL);packageURL=manifestURL=null;}
function listFiles(){
  const list=document.getElementById('selected-files');list.replaceChildren();let count=0,total=0;
  for(const id of fileIds){const input=document.getElementById(id),files=[...input.files];document.querySelector('[data-selection="'+id+'"]').textContent=files.length?(files.length===1?files[0].name:files.length+' files selected'):defaults[id];for(const file of files){count++;total+=file.size;const item=document.createElement('li'),name=document.createElement('span'),bytes=document.createElement('small');name.textContent=file.name;bytes.textContent=size(file.size);item.append(name,bytes);list.append(item);}}
  document.getElementById('selected-file-count').textContent=count+' · '+size(total);
}
function addSource(){
  const number=++linkNumber,row=document.createElement('div');row.className='library-link-row';
  const titleLabel=document.createElement('label'),urlLabel=document.createElement('label'),kindLabel=document.createElement('label');
  titleLabel.textContent='Source title';urlLabel.textContent='Link';kindLabel.textContent='Type';
  const title=document.createElement('input');title.type='text';title.maxLength=180;title.name='library-title-'+number;title.placeholder='A source, collection, or credit';title.dataset.library='title';
  const url=document.createElement('input');url.type='url';url.name='library-url-'+number;url.placeholder='https://';url.dataset.library='url';url.setAttribute('inputmode','url');
  const type=document.createElement('select');type.name='library-type-'+number;type.dataset.library='type';
  for(const value of ['Source','Images','Book','Video','Audio','Document','Credits']){const option=document.createElement('option');option.value=value;option.textContent=value;type.append(option);}
  titleLabel.append(title);urlLabel.append(url);kindLabel.append(type);
  const remove=document.createElement('button');remove.type='button';remove.className='remove-source';remove.textContent='Remove';remove.setAttribute('aria-label','Remove source link '+number);remove.addEventListener('click',()=>{row.remove();discardResult();});
  row.append(titleLabel,urlLabel,kindLabel,remove);library.append(row);title.focus();
}
document.getElementById('add-library-link').addEventListener('click',addSource);
form.addEventListener('input',()=>{if(!busy)discardResult();});
form.addEventListener('change',()=>{if(!busy){discardResult();listFiles();}});
function sourceLinks(){
  return [...library.querySelectorAll('.library-link-row')].flatMap(row=>{
    const title=row.querySelector('[data-library="title"]').value.trim(),urlInput=row.querySelector('[data-library="url"]'),value=urlInput.value.trim();
    if(!title&&!value)return [];
    let url;try{url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw new Error();}catch{urlInput.focus();throw Object.assign(new Error('Use a complete https:// source link without a username or password.'),{field:'library'});}
    return [{title:title||url.hostname,url:url.href,type:row.querySelector('[data-library="type"]').value}];
  });
}
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;discardResult();
  let links;try{links=sourceLinks();}catch(error){errorBox.textContent=error.message;errorBox.hidden=false;return;}
  const input={title:form.elements.title.value,description:form.elements.description.value,creatorName:form.elements.creatorName.value,html:document.getElementById('submission-html').files[0],audioFiles:[...document.getElementById('submission-audio').files],mediaFiles:[...document.getElementById('submission-media').files]};
  const json=document.getElementById('submission-json').files[0];if(json)input.orbJSON=json;
  // Omitting an empty source list lets imported ORB JSON retain its own library.
  if(links.length)input.library=links;
  busy=true;form.setAttribute('aria-busy','true');const controls=[...form.elements];controls.forEach(control=>control.disabled=true);progress.textContent='Preparing your files…';
  try{
    const packaged=await buildMuseumPackage(input,{onProgress:step=>{progress.textContent=step.filename?'Packing '+step.filename+' · '+step.completed+' of '+step.total:step.phase==='validating'?'Checking selected files…':'Building your review package…';}});
    packageURL=URL.createObjectURL(packaged.blob);manifestURL=URL.createObjectURL(new Blob([JSON.stringify(packaged.manifest,null,2)+'\n'],{type:'application/json'}));
    const download=document.getElementById('download-package');download.href=packageURL;download.download=packaged.filename;
    const manifest=document.getElementById('download-manifest');manifest.href=manifestURL;manifest.download=packaged.filename.replace(/\.zip$/i,'-manifest.json');
    document.getElementById('large-package-note').hidden=packaged.blob.size<=25000000;
    document.getElementById('package-result-description').textContent='“'+input.title.trim()+'” · '+size(packaged.blob.size)+' review package'+(input.creatorName.trim()?' · Signed by '+input.creatorName.trim():'');
    const warnings=document.getElementById('package-warnings');warnings.replaceChildren();for(const warning of packaged.warnings||[]){const item=document.createElement('li');item.textContent=warning;warnings.append(item);}warnings.hidden=!warnings.children.length;
    result.hidden=false;progress.textContent='Package ready. Nothing has been sent.';result.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});download.focus({preventScroll:true});
  }catch(error){
    errorBox.textContent=error?.message||'The package could not be prepared. Your selected files are still here.';errorBox.hidden=false;progress.textContent='';
  }finally{busy=false;form.removeAttribute('aria-busy');controls.forEach(control=>control.disabled=false);}
});
// Limits come from the same engine as the generated package.
const limitNote=document.querySelector('.package-limit-note');if(limitNote)limitNote.textContent='Up to '+PACKAGE_LIMITS.files+' files and '+PACKAGE_LIMITS.totalBytes/(1024*1024)+' MB total; individual supporting files can be up to '+PACKAGE_LIMITS.fileBytes/(1024*1024)+' MB.';
form.hidden=false;listFiles();
window.addEventListener('pagehide',event=>{if(event.persisted)return;if(packageURL)URL.revokeObjectURL(packageURL);if(manifestURL)URL.revokeObjectURL(manifestURL);});
