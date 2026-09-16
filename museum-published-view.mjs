import {fetchMuseumJSON,publicationId,publicationURL,listingFromPublication,mergeCatalog,connectionsFor,savedExploration,publicURL,MUSEUM_HOME} from './museum-publications.mjs';

const id=publicationId(new URLSearchParams(location.search).get('publication'));
const make=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;};
let es=new URLSearchParams(location.search).get('lang')==='es';const label=(en,sp)=>es?sp:en;
for(const stylesheet of document.querySelectorAll('link[rel="stylesheet"]'))stylesheet.disabled=true;
const style=make('link');style.rel='stylesheet';style.href='museum-reader.css?v=publication-1';document.head.append(style);
document.body.className='museum-published-reader';document.documentElement.lang=es?'es':'en';
const shell=make('main','','publication-loading'),home=make('a',label('← The Museum','← El Museo'));home.href='./';
const heading=make('h1',label('Opening your orb…','Abriendo tu orb…')),status=make('p');status.setAttribute('role','status');
const retry=make('button',label('Try again','Intentar de nuevo'));retry.type='button';retry.hidden=true;
shell.append(home,heading,status,retry);document.body.replaceChildren(shell);
let generation=0;
function failure(error){heading.textContent=label('This orb could not open.','No se pudo abrir este orb.');status.textContent=error.message||label('Please try again.','Inténtalo de nuevo.');retry.hidden=false;retry.disabled=false;}
function appendExploration(record){
  const windows=savedExploration(record);if(!windows.some(window=>window.nodes.length))return;
  const section=make('section','','publication-exploration');section.id='publication-exploration';section.setAttribute('aria-labelledby','exploration-heading');const title=make('h2',label('Saved exploration','Exploración guardada'));title.id='exploration-heading';section.append(title,make('p',label('The topics, discoveries and paths saved with this edition. Source links open their original providers.','Los temas, descubrimientos y caminos guardados con esta edición. Los enlaces abren las fuentes originales.')));
  for(const window of windows){const group=make('details'),summary=make('summary',window.title+(window.current?label(' · Last active view',' · Última vista activa'):''));group.append(summary);
    if(window.path.length){const path=make('p','','exploration-path');path.setAttribute('aria-label',label('Saved path','Camino guardado'));for(const [index,step]of window.path.entries()){if(index)path.append(document.createTextNode(' → '));if(step.url){const link=make('a',step.title);link.href=step.url;link.target='_blank';link.rel='noopener noreferrer';path.append(link);}else path.append(document.createTextNode(step.title));}group.append(path);}
    if(!window.nodes.length)group.append(make('p',label('This view was saved without further discoveries.','Esta vista se guardó sin más descubrimientos.')));
    for(const item of window.nodes){const row=make('article'),title=make('h3');if(item.url){const link=make('a',item.title);link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';title.append(link);}else title.textContent=item.title;row.append(title);
      row.append(make('p',item.authored?label('Authored topic','Tema del orb'):label('Saved discovery','Descubrimiento guardado'),'exploration-kind'));if(item.parent)row.append(make('p',label('Connected from: ','Conectado desde: ')+item.parent,'exploration-parent'));if(item.summary)row.append(make('p',item.summary));if(item.bridge)row.append(make('p',item.bridge));if(item.relation||item.domain)row.append(make('small',[item.relation,item.domain].filter(Boolean).join(' · ')));group.append(row);
    }section.append(group);
  }
  document.body.append(section);const button=make('button',label('Saved exploration','Exploración guardada'));button.type='button';button.onclick=()=>{section.scrollIntoView({block:'start'});section.querySelector('summary')?.focus({preventScroll:true});};document.querySelector('.portable-layout article nav')?.append(button);
}
function appendConnections(publication,catalog){
  const orb=listingFromPublication(publication),connections=connectionsFor(orb,catalog);if(!connections.length)return;
  const section=make('section','','publication-connections');section.setAttribute('aria-labelledby','publication-connections-title');const title=make('h2',label('Continue through the Museum','Sigue explorando el Museo'));title.id='publication-connections-title';section.append(title);
  for(const item of connections){const f=item.orb.editions?.find(e=>e.id===item.orb.featuredEdition)||item.orb.editions?.[0],url=publicURL(f?.url||item.orb.url);if(!url)continue;const row=make('div'),a=make('a',item.orb.title);a.href=url;
    const caption=item.kind==='previous'?label('Previous published edition','Edición publicada anterior'):item.kind==='contributor'?label('Contributor connection','Conexión del colaborador'):label('In the same topic · ','Del mismo tema · ')+item.orb.category;
    row.append(make('small',caption),a);if(item.reason)row.append(make('p',item.reason));section.append(row);
  }
  document.body.append(section);
}
async function open(){
  const serial=++generation;retry.disabled=true;retry.hidden=true;status.textContent=label('Loading the published readings and saved materials.','Cargando las lecturas publicadas y los materiales guardados.');
  try{
    if(!id)throw new Error(label('This published ORB address is not valid. Return to the Museum to choose an orb.','Esta dirección de ORB no es válida. Vuelve al Museo para elegir un orb.'));
    const publication=await fetchMuseumJSON(id);if(serial!==generation)return;es=publication.record.language==='es';
    // Only the trusted static runtime is executable. Submitted HTML is never read.
    const data=make('script');data.type='application/json';data.id='orb-data';data.textContent=JSON.stringify(publication.record).replaceAll('<','\\u003c');document.body.append(data);
    await new Promise((resolve,reject)=>{
      const script=make('script');script.src='museum-reader-runtime.js?v=publication-1';
      const runtimeError=event=>{if(String(event.filename).includes('museum-reader-runtime.js')){window.removeEventListener('error',runtimeError);reject(new Error(label('This edition contains unsupported ORB data.','Esta edición contiene datos ORB no compatibles.')));}};
      window.addEventListener('error',runtimeError);script.onload=()=>{window.removeEventListener('error',runtimeError);resolve();};script.onerror=()=>{window.removeEventListener('error',runtimeError);reject(new Error(label('The reader could not load. Please try again.','No se pudo cargar el lector. Inténtalo de nuevo.')));};document.body.append(script);
    });
    if(serial!==generation)return;
    shell.remove();
    // The hosted reader stays within published content. It has no AI handoff,
    // upload, editing, or generation controls.
    for(const link of document.querySelectorAll('a'))if(link.href.startsWith('https://www.orbforma.com/nano.html?q='))link.remove();
    const footer=document.querySelector('footer');if(footer)footer.replaceChildren(make('p',label('Published ORB · Readings and navigation are ready to explore. External sources and recordings may need a connection.','ORB publicado · Explora sus lecturas y conexiones. Las fuentes y grabaciones externas pueden necesitar conexión.')));
    const header=document.querySelector('header');if(header){const museumLink=make('a',label('Back to the Museum','Volver al Museo'));museumLink.href=MUSEUM_HOME+'?orb='+id;header.append(museumLink);}
    const publishedDate=new Date(publication.publishedAt),meta=make('p','','publication-edition');meta.textContent=label('Published edition','Edición publicada')+(Number.isFinite(publishedDate.getTime())?' · '+publishedDate.toLocaleDateString(es?'es':'en',{dateStyle:'medium'}):'');document.querySelector('h1')?.after(meta);
    if(publication.parentId&&publicationURL(publication.parentId)){const previous=make('a',label('Earlier edition','Edición anterior'));previous.href=publicationURL(publication.parentId);meta.append(document.createTextNode(' · '),previous);}
    appendExploration(publication.record);
    try{
      const [staticResponse,feed]=await Promise.all([fetch('orbs.json',{credentials:'omit'}),fetchMuseumJSON()]);const original=await staticResponse.json();if(serial===generation)appendConnections(publication,mergeCatalog(original.orbs,feed.orbs));
    }catch{const note=make('p',label('Other Museum connections are temporarily unavailable. The full orb is open above.','Las demás conexiones del Museo no están disponibles temporalmente. El orb completo está abierto arriba.'),'publication-connection-note');document.body.append(note);}
  }catch(error){if(serial!==generation)return;document.querySelectorAll('#orb-data,script[src^="museum-reader-runtime"]').forEach(el=>el.remove());document.body.replaceChildren(shell);failure(error);}
}
retry.onclick=()=>location.reload();
open();
