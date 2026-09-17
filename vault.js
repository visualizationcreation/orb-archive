(async()=>{
const {fetchMuseumJSON,mergeCatalog,connectionsFor,publicationId,listingFromPublication}=await import('./museum-publications.mjs');

const {mountUniverse}=await import('./orb-universe.mjs?v=central-tree-20260916-2');
const {createUniverse}=await import('./orb-connect-pass.mjs?v=central-tree-20260916-2');
const {createMuseumTree}=await import('./orb-tree.mjs?v=central-tree-20260916-2');
let universe;
const original=JSON.parse(document.getElementById('orb-catalog').textContent).orbs;
let catalog=[...original],request=0,selectedId=new URLSearchParams(location.search).get('orb');
const controls={topic:document.getElementById('topic'),format:document.getElementById('format'),sort:document.getElementById('sort')},form=document.querySelector('.vault-filters'),entries=document.getElementById('entries'),overview=document.getElementById('orb-overview'),feedStatus=document.getElementById('publication-status'),retry=document.getElementById('publication-retry');
const state=()=>Object.fromEntries(Object.entries(controls).map(([key,value])=>[key,value.value]));
const es=()=>document.documentElement.lang==='es',tr=(en,sp)=>es()?sp:en;
const e=escapeHtml;
function connectionMarkup(orb){
  const tree=createMuseumTree(createUniverse(catalog)),owner=tree.nodes.get(tree.parent.get(orb.id)),collections=owner?[owner]:[];
  const grouping=collections.length?'<div class="museum-collections"><span>'+tr('Home in the tree','Lugar en el árbol')+'</span> '+collections.map(g=>'<a href="?map='+encodeURIComponent(g.id)+'&amp;lang='+(es()?'es':'en')+'">'+e(es()?g.es:g.title)+'</a>').join(' · ')+'</div>':'';
  const connections=connectionsFor(orb,catalog);if(!connections.length)return grouping;
  return grouping+'<details class="museum-connections"><summary>'+tr('Connections in the Museum','Conexiones en el Museo')+'</summary><ul>'+connections.map(item=>{
    const target=featured(item.orb);if(!target)return '';
    const label=item.kind==='previous'?tr('Earlier edition','Edición anterior'):item.kind==='contributor'?tr('Contributor connection','Conexión del colaborador'):tr('Same topic','Mismo tema');
    return '<li><small>'+e(label)+'</small><a href="'+e(target.url)+'">'+e(item.orb.title)+'</a>'+(item.reason?'<p>'+e(item.reason)+'</p>':'')+'</li>';
  }).join('')+'</ul></details>';
}
function render({preserveURL=false}={}){
  const current=state(),rows=filterCatalog(catalog,current);
  if(current.sort!=='title')rows.sort((a,b)=>(b.publishedAt||(current.sort==='newest'?b.firstPublished:dateValue(b))||'').localeCompare(a.publishedAt||(current.sort==='newest'?a.firstPublished:dateValue(a))||'')||a.title.localeCompare(b.title));
  entries.innerHTML=rows.map(orb=>ORBMuseum.entry(orb).replace('<details class="version-details">',connectionMarkup(orb)+'<details class="version-details">')).join('');
  document.getElementById('empty').hidden=!!rows.length;
  document.getElementById('count').textContent=rows.length===catalog.length?catalog.length+' ORBs':rows.length+tr(' of ',' de ')+catalog.length+' ORBs';
  document.querySelector('.edition-total').textContent=' · '+catalog.reduce((total,orb)=>total+editionList(orb).length,0)+tr(' editions',' ediciones');
  if(!preserveURL){const url=new URL(location.href);for(const [key,value]of Object.entries(current))value==='all'||key==='sort'&&value==='updated'?url.searchParams.delete(key):url.searchParams.set(key,value);history.replaceState(null,'',url);}
}
const reset=()=>{controls.topic.value=controls.format.value='all';controls.sort.value='updated';render();};
function restore(){const p=new URLSearchParams(location.search);for(const [key,el]of Object.entries(controls)){const value=p.get(key);el.value=[...el.options].some(o=>o.value===value)?value:key==='sort'?'updated':'all';}}
function topics(){const selected=controls.topic.value;const values=[...new Set(catalog.map(orb=>orb.category).filter(Boolean))].sort();controls.topic.replaceChildren(new Option(tr('All topics','Todos los temas'),'all'),...values.map(value=>new Option(value,value)));controls.topic.value=values.includes(selected)?selected:'all';restore();}
function preview(id){if(universe)return;const orb=catalog.find(orb=>orb.id===id);if(!orb)return;selectedId=id;overview.setAttribute('aria-label',orb.title);overview.innerHTML=ORBMuseum.overview(orb)+connectionMarkup(orb);document.querySelectorAll('.vault-orb').forEach(el=>el.classList.toggle('is-featured',el.dataset.orb===id));}
function renderScene(){if(universe)universe.update(catalog);else universe=mountUniverse({catalog,overview});}
async function loadPublications(){
  const serial=++request;retry.hidden=true;feedStatus.textContent=tr('Loading community orbs…','Cargando orbs de la comunidad…');
  try{
    const feed=await fetchMuseumJSON();if(serial!==request)return;catalog=mergeCatalog(original,feed.orbs);
    const requested=publicationId(new URLSearchParams(location.search).get('orb'));let requestedMissing=false;
    if(requested&&!catalog.some(orb=>orb.id===requested)){
      try{const publication=await fetchMuseumJSON(requested);if(serial!==request)return;const item=listingFromPublication(publication);if(item)catalog=mergeCatalog(catalog,[item]);}
      catch{requestedMissing=true;}
    }
    if(serial!==request)return;topics();render();renderScene();
    const added=catalog.length-original.length;feedStatus.textContent=requestedMissing?tr('That orb could not be found. You can explore the collection below.','No se encontró ese orb. Puedes explorar la colección a continuación.'):added?added+tr(' community '+(added===1?'orb':'orbs')+' · Published directly by contributors.',' orb'+(added===1?'':'s')+' de la comunidad · Publicados directamente por sus colaboradores.'):tr('The collection is up to date. New contributions will appear here.','La colección está al día. Las nuevas contribuciones aparecerán aquí.');
    if(requested&&catalog.some(o=>o.id===requested)){preview(requested);overview.classList.add('publication-selected');}
  }catch{if(serial!==request)return;feedStatus.textContent=tr('Community orbs are temporarily unavailable. The original collection is ready below.','Los orbs de la comunidad no están disponibles temporalmente. La colección original está lista a continuación.');retry.hidden=false;}
}
form.hidden=false;form.addEventListener('submit',event=>event.preventDefault());Object.values(controls).forEach(control=>control.addEventListener('change',render));document.getElementById('clear').addEventListener('click',reset);document.getElementById('empty-reset').addEventListener('click',reset);retry.addEventListener('click',loadPublications);
window.addEventListener('popstate',()=>{selectedId=new URLSearchParams(location.search).get('orb');restore();render();if(selectedId)preview(selectedId);});restore();render({preserveURL:true});
for(const eventName of ['pointerover','focusin'])document.addEventListener(eventName,event=>{if(eventName==='pointerover'&&event.pointerType!=='mouse')return;const item=event.target.closest('[data-orb],article[data-orb-id]');if(item&&!item.contains(event.relatedTarget))preview(item.dataset.orb||item.dataset.orbId);});
overview.addEventListener('click',event=>{const link=event.target.closest('.edition-link');if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const id=new URL(link.href).hash.slice(1);event.preventDefault();if(!document.getElementById(id))reset();const target=document.getElementById(id);if(target){const url=new URL(location.href);url.hash=id;history.pushState(null,'',url);target.scrollIntoView({block:'start'});}});
renderScene();
loadPublications();
})();
