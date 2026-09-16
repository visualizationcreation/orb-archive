import {buildMuseumPackage,PACKAGE_LIMITS,normalizeMuseumSpotlight,safeMuseumSpotlightURL} from './lib/museum-package.mjs?v=spotlight-1';

const form=document.getElementById('museum-submission');
const result=document.getElementById('package-result'),errorBox=document.getElementById('package-error'),progress=document.getElementById('package-progress');
const library=document.getElementById('submission-library');
const fileIds=['submission-html','submission-json','submission-audio','submission-media'];
const defaults={'submission-html':'Choose your HTML file','submission-json':'No data file selected','submission-audio':'Choose audio files','submission-media':'Choose supporting files'};
let packageURL,manifestURL,linkNumber=0,busy=false,jsonReadVersion=0;
let pendingJSON=Promise.resolve();
const editedContribution={contributorNote:false,expression:false};
let spotlightEdited=false,spotlightUnloaded=false,spotlightNumber=0;
const spotlightKinds=['idea','thought','project','design','product'];
const spotlightContainer=type=>document.getElementById('spotlight-'+type);
function spotlightInput(){
  if(spotlightUnloaded&&!spotlightEdited)return undefined;
  const result={};
  for(const type of ['profiles','items']){
    const rows=[...spotlightContainer(type).children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-spotlight]')].map(input=>[input.dataset.spotlight,input.value.trim()]))).filter(row=>Object.entries(row).some(([key,value])=>key!=='kind'&&value));
    if(rows.length)result[type]=rows;
  }
  return result;
}
function syncSpotlightButtons(){for(const type of ['profiles','items'])document.getElementById('add-spotlight-'+(type==='profiles'?'profile':'item')).disabled=busy||spotlightContainer(type).children.length>=6;}
function changedSpotlight(){spotlightEdited=true;spotlightUnloaded=false;document.getElementById('spotlight-import-status').textContent='';discardResult();syncContributionPreview();}
function addSpotlight(type,data={},user=true){
  const list=spotlightContainer(type);if(list.children.length>=6)return;
  const row=document.createElement('div');row.className='spotlight-row';row.dataset.spotlightRow=type;
  const number=++spotlightNumber;
  const fields=type==='profiles'?[['label','Profile label','text',80],['url','Public profile link','url',2048]]:[['kind','Kind','select'],['title','Title','text',180],['description','A few words','textarea',2400],['url','Public link (optional)','url',2048]];
  for(const [key,labelText,typeName,limit] of fields){
    const label=document.createElement('label');label.textContent=labelText;
    const input=document.createElement(typeName==='select'?'select':typeName==='textarea'?'textarea':'input');input.name='spotlight-'+number+'-'+key;input.dataset.spotlight=key;
    if(typeName==='select'){for(const kind of spotlightKinds){const option=document.createElement('option');option.value=kind;option.textContent=kind[0].toUpperCase()+kind.slice(1);input.append(option);}}
    else{if(typeName==='textarea')input.rows=3;else input.type=typeName;input.maxLength=limit;if(typeName==='url'){input.placeholder='https://';input.setAttribute('inputmode','url');}}
    input.value=typeof data[key]==='string'?data[key]:key==='kind'?'idea':'';label.append(input);row.append(label);
  }
  const remove=document.createElement('button');remove.type='button';remove.className='quiet-button spotlight-remove';remove.textContent='Remove';remove.setAttribute('aria-label',type==='profiles'?'Remove profile link':'Remove shared work');remove.addEventListener('click',()=>{row.remove();changedSpotlight();});row.append(remove);list.append(row);
  if(user){changedSpotlight();row.querySelector('input,select,textarea').focus();}else syncSpotlightButtons();
}
function clearSpotlight(user=true){for(const type of ['profiles','items'])spotlightContainer(type).replaceChildren();spotlightUnloaded=false;if(user)changedSpotlight();else syncSpotlightButtons();}
function spotlightPreview(){
  const preview=document.getElementById('preview-spotlight');preview.replaceChildren();const data=spotlightInput()||{};
  const link=(parent,title,url)=>{const safe=safeMuseumSpotlightURL(url);const node=document.createElement(safe?'a':'span');node.textContent=title;node.className='orb-content';if(safe){node.href=safe;node.rel='noopener noreferrer ugc';}parent.append(node);};
  if(data.profiles?.length){const list=document.createElement('ul');list.className='spotlight-profiles';for(const profile of data.profiles){const item=document.createElement('li');link(item,profile.label||'Profile link',profile.url);list.append(item);}preview.append(list);}
  if(data.items?.length){const list=document.createElement('ul');list.className='spotlight-items';for(const work of data.items){const item=document.createElement('li'),kind=document.createElement('small');kind.textContent=work.kind[0].toUpperCase()+work.kind.slice(1);item.append(kind);link(item,work.title||'Untitled entry',work.url);if(work.description){const description=document.createElement('p');description.className='contributor-copy orb-content';description.textContent=work.description;item.append(description);}list.append(item);}preview.append(list);}
  const visible=!!preview.children.length;document.getElementById('preview-spotlight-section').hidden=!visible;syncSpotlightButtons();return visible;
}
document.getElementById('add-spotlight-profile').addEventListener('click',()=>addSpotlight('profiles'));
document.getElementById('add-spotlight-item').addEventListener('click',()=>addSpotlight('items'));
document.getElementById('clear-spotlight').addEventListener('click',()=>clearSpotlight());
function contributionInput(){return {attribution:form.elements.attribution.value,creatorName:form.elements.attribution.value==='anonymous'?'':form.elements.creatorName.value.trim(),creatorNote:form.elements.contributorNote.value.trim(),expression:form.elements.expression.value.trim()};}
function syncContributionPreview(){
  const anonymous=form.elements.attribution.value==='anonymous',name=form.elements.creatorName;
  if(anonymous)name.value='';name.disabled=busy||anonymous;name.required=!anonymous;document.getElementById('public-name-field').hidden=anonymous;
  const data=contributionInput(),title=form.elements.title.value.trim()||'Your orb',suffix=anonymous?'an anonymous orb':'an orb by '+(data.creatorName||'your name');
  document.getElementById('contribution-preview-title').textContent=title+' — '+suffix;
  for(const key of ['note','expression']){document.getElementById('preview-'+key).textContent=data[key==='note'?'creatorNote':'expression'];document.getElementById('preview-'+key+'-section').hidden=!data[key==='note'?'creatorNote':'expression'];}
  const hasSpotlight=spotlightPreview();document.getElementById('preview-empty').hidden=!!(data.creatorNote||data.expression||hasSpotlight);
}
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
form.addEventListener('input',event=>{if(Object.hasOwn(editedContribution,event.target.name))editedContribution[event.target.name]=true;if(event.target.dataset?.spotlight)spotlightEdited=true;if(!busy){discardResult();syncContributionPreview();}});
async function hydrateSavedContribution(){
  const version=++jsonReadVersion,file=document.getElementById('submission-json').files[0],status=document.getElementById('contribution-import-status');
  let saved={},savedSpotlight,message='';
  if(file){
    if(file.size>PACKAGE_LIMITS.jsonBytes){status.textContent='The selected ORB data is larger than 8 MB. Its saved note has not been loaded.';return;}
    try{const record=JSON.parse((await file.text()).replace(/^\uFEFF/,''));saved=record?.museum?.contribution||{};savedSpotlight=record?.museum?.spotlight;}catch{if(version===jsonReadVersion)status.textContent='The saved note could not be read from this JSON file. Your current words are unchanged.';return;}
  }
  if(version!==jsonReadVersion)return;
  const spotlightStatus=document.getElementById('spotlight-import-status');
  if(!spotlightEdited){
    try{const clean=normalizeMuseumSpotlight(savedSpotlight)||{};clearSpotlight(false);for(const type of ['profiles','items'])for(const row of clean[type]||[])addSpotlight(type,row,false);spotlightStatus.textContent=Object.keys(clean).length?'Saved public profiles and shared work loaded. Review them before preparing your package.':'';}
    catch{clearSpotlight(false);spotlightUnloaded=true;spotlightStatus.textContent='Saved shared work needs attention and was not loaded. It remains in the original JSON. Clear shared work to replace it, or correct the JSON before preparing your package.';}
  }else if(savedSpotlight)spotlightStatus.textContent='Your edited shared work was kept instead of the saved version.';
  const loaded=[],kept=[],oversized=[];
  for(const [field,key] of [['contributorNote','note'],['expression','expression']]){
    const value=typeof saved[key]==='string'?saved[key]:'';
    if(editedContribution[field]){if(value)kept.push(key);continue;}
    if(value.length>2400){oversized.push(key);continue;}
    form.elements[field].value=value;if(value)loaded.push(key);
  }
  if(loaded.length)message='Saved public contribution text loaded. You can edit it here.';
  if(kept.length)message+=(message?' ':'')+'Your edited text was kept instead of the saved version.';
  if(oversized.length)message+=(message?' ':'')+'A saved field exceeds 2,400 characters and was not loaded. Shorten it before adding it here; the original JSON stays intact.';
  status.textContent=message;syncContributionPreview();discardResult();
}
form.addEventListener('change',event=>{if(event.target.dataset?.spotlight)spotlightEdited=true;if(!busy){discardResult();listFiles();syncContributionPreview();if(event.target.id==='submission-json')pendingJSON=hydrateSavedContribution();}});
function sourceLinks(){
  return [...library.querySelectorAll('.library-link-row')].flatMap(row=>{
    const title=row.querySelector('[data-library="title"]').value.trim(),urlInput=row.querySelector('[data-library="url"]'),value=urlInput.value.trim();
    if(!title&&!value)return [];
    let url;try{url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)throw new Error();}catch{urlInput.focus();throw Object.assign(new Error('Use a complete https:// source link without a username or password.'),{field:'library'});}
    return [{title:title||url.hostname,url:url.href,type:row.querySelector('[data-library="type"]').value}];
  });
}
form.addEventListener('submit',async event=>{
  event.preventDefault();
  // A second selection can replace the read while submission awaits the first.
  let settledRead;do{settledRead=pendingJSON;await settledRead;}while(settledRead!==pendingJSON);
  if(busy||!form.reportValidity())return;discardResult();
  let links,spotlight;try{links=sourceLinks();const raw=spotlightInput();spotlight=raw===undefined?undefined:normalizeMuseumSpotlight(raw)||{};}catch(error){errorBox.textContent=error.message;errorBox.hidden=false;return;}
  const input={title:form.elements.title.value,description:form.elements.description.value,...contributionInput(),html:document.getElementById('submission-html').files[0],audioFiles:[...document.getElementById('submission-audio').files],mediaFiles:[...document.getElementById('submission-media').files]};
  const json=document.getElementById('submission-json').files[0];if(json)input.orbJSON=json;
  if(spotlight!==undefined)input.spotlight=spotlight;
  // Omitting an empty source list lets imported ORB JSON retain its own library.
  if(links.length)input.library=links;
  busy=true;form.setAttribute('aria-busy','true');const controls=[...form.elements];controls.forEach(control=>control.disabled=true);progress.textContent='Preparing your files…';
  try{
    const packaged=await buildMuseumPackage(input,{onProgress:step=>{progress.textContent=step.filename?'Packing '+step.filename+' · '+step.completed+' of '+step.total:step.phase==='validating'?'Checking selected files…':'Building your review package…';}});
    packageURL=URL.createObjectURL(packaged.blob);manifestURL=URL.createObjectURL(new Blob([JSON.stringify(packaged.manifest,null,2)+'\n'],{type:'application/json'}));
    const download=document.getElementById('download-package');download.href=packageURL;download.download=packaged.filename;
    const manifest=document.getElementById('download-manifest');manifest.href=manifestURL;manifest.download=packaged.filename.replace(/\.zip$/i,'-manifest.json');
    document.getElementById('large-package-note').hidden=packaged.blob.size<=25000000;
    document.getElementById('package-result-description').textContent='“'+input.title.trim()+'” · '+size(packaged.blob.size)+' review package'+(input.attribution==='anonymous'?' · An anonymous orb':' · An orb by '+input.creatorName.trim());
    const warnings=document.getElementById('package-warnings');warnings.replaceChildren();for(const warning of packaged.warnings||[]){const item=document.createElement('li');item.textContent=warning;warnings.append(item);}warnings.hidden=!warnings.children.length;
    result.hidden=false;progress.textContent='Package ready. Nothing has been sent.';result.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});download.focus({preventScroll:true});
  }catch(error){
    errorBox.textContent=error?.message||'The package could not be prepared. Your selected files are still here.';errorBox.hidden=false;progress.textContent='';
  }finally{busy=false;form.removeAttribute('aria-busy');controls.forEach(control=>control.disabled=false);syncContributionPreview();}
});
// Limits come from the same engine as the generated package.
const limitNote=document.querySelector('.package-limit-note');if(limitNote)limitNote.textContent='Up to '+PACKAGE_LIMITS.files+' files and '+PACKAGE_LIMITS.totalBytes/(1024*1024)+' MB total; individual supporting files can be up to '+PACKAGE_LIMITS.fileBytes/(1024*1024)+' MB.';
form.hidden=false;listFiles();syncContributionPreview();
window.addEventListener('pagehide',event=>{if(event.persisted)return;if(packageURL)URL.revokeObjectURL(packageURL);if(manifestURL)URL.revokeObjectURL(manifestURL);});
