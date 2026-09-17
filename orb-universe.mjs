import {createUniverse,neighborhood,pageOf} from './orb-connect-pass.mjs?v=connect-20260916-2';
import {savedWorks} from './orb-connect-snapshot.mjs?v=connect-20260916-2';

export function mountUniverse({catalog,overview}){
 const field=document.querySelector('.orb-field'),studio=field.closest('.vault-studio');
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./orb-universe.css?v=connect-20260916-2',import.meta.url).href;document.head.append(css);
 document.querySelector('.vault-workspace').classList.add('universe-workspace');field.classList.add('universe-field');
 const es=()=>document.documentElement.lang==='es',tr=(a,b)=>es()?b:a;
 const make=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
 const button=(label,fn,className='')=>{const el=make('button',label,className);el.type='button';el.onclick=fn;return el;};
 const label=node=>(es()&&node.es?node.es:node.title)+(node.editionLabel?' · '+node.editionLabel:'');
 const copy=node=>es()&&node.summaryEs?node.summaryEs:node.summary||node.description;
 const nav=make('nav','','universe-nav');nav.setAttribute('aria-label','Universe navigation');studio.append(nav);
 const paging=make('div','','universe-pages');studio.append(paging);
 const status=make('p','','universe-status');status.setAttribute('role','status');studio.append(status);
 let graph,current='universe',page=0,angle=0,trail=[];
 function update(data){const works=new Map(savedWorks.map(o=>[o.id,o]));for(const orb of data)works.set(orb.id,{...works.get(orb.id),...orb});graph=createUniverse([...works.values()]);readLocation();render();}
 function readLocation(){const params=new URLSearchParams(location.search),id=params.get('map')||params.get('orb');current=graph.nodes.has(id)?id:'universe';page=0;}
 function go(id,{historyEntry=true}={}){if(id!=='universe'&&!graph.nodes.has(id))return;trail.push(current);current=id;page=0;if(historyEntry){const url=new URL(location.href);url.searchParams.delete('orb');id==='universe'?url.searchParams.delete('map'):url.searchParams.set('map',id);history.pushState(null,'',url);}render();field.querySelector('.universe-center')?.focus({preventScroll:true});}
 function panel(id){
  const node=graph.nodes.get(id),isRoot=!node;overview.replaceChildren();
  overview.setAttribute('aria-label',isRoot?tr('The Orbiversity universe','El universo de Orbiversity'):label(node));
  overview.append(make('p',isRoot?'Orb Connect':node.kind==='group'?tr('A grouping orb','Un orb de colección'):tr('A published orb','Un orb publicado'),'universe-kind'));
  overview.append(make('h2',isRoot?tr('Choose a world. Find another.','Elige un mundo. Descubre otro.'):label(node)));
  overview.append(make('p',isRoot?tr('A forest leads to a season. A season leads to a poem. Follow the grouping orbs to find a way through the collection.','Un bosque lleva a una estación. Una estación lleva a un poema. Sigue los orbs de colección para descubrir caminos.'):copy(node),'overview-description'));
  if(node?.kind==='work'){
   const edition=node.editions?.find(e=>e.id===node.featuredEdition)||node.editions?.[0],url=edition?.url||node.url;
   if(url){const a=make('a',tr('Open published ORB','Abrir ORB publicado'),'primary-link');a.href=url;overview.append(a);}
   overview.append(make('p',tr('The original edition opens with its readings, sources and available recordings.','La edición original conserva sus lecturas, fuentes y grabaciones disponibles.'),'overview-meta'));
  }
  const near=neighborhood(graph,id),heading=make('h3',node?.kind==='work'?tr('Explore its collections','Explora sus colecciones'):tr('Paths from here','Caminos desde aquí'),'universe-path-title');overview.append(heading);
  const paths=make('ul','','universe-paths');
  for(const item of near){const li=make('li');li.append(button(label(item.node),()=>go(item.node.id)));if(!isRoot)li.append(make('p',item.reason,'orb-content'));paths.append(li);}overview.append(paths);
  const note=make('p',tr('An authored arrangement · 16 September 2026. Collections are invitations to explore; the original orbs keep their identities.','Una organización de autor · 16 de septiembre de 2026. Las colecciones invitan a explorar; los orbs originales conservan su identidad.'),'vault-note');overview.append(note);
 }
 function render(){
  const center=graph.nodes.get(current),all=neighborhood(graph,current),window=pageOf(all,page,matchMedia('(max-width:700px)').matches?6:8);page=window.page;
  document.querySelector('#studio-title').textContent=tr('A universe of connected worlds.','Un universo de mundos conectados.');
  const subtitle=document.querySelector('.studio-heading > p:last-child');if(subtitle)subtitle.textContent=tr('Enter a collection. Follow a connection.','Entra en una colección. Sigue una conexión.');
  field.replaceChildren();nav.replaceChildren();paging.replaceChildren();
  nav.append(button(tr('All worlds','Todos los mundos'),()=>{trail=[];go('universe');}));
  if(current!=='universe')nav.append(button(tr('Back','Atrás'),()=>{const last=trail.pop()||'universe';go(last);trail.pop();}));
  nav.append(button(tr('Rearrange','Reordenar'),()=>{angle+=.38;render();}));
  nav.lastChild.title=tr('Change the layout; keep the connections.','Cambia la disposición; conserva las conexiones.');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.classList.add('universe-lines');svg.setAttribute('aria-hidden','true');field.append(svg);
  // Every background point represents a real node in this saved arrangement.
  [...graph.nodes.values()].forEach((node,i)=>{const dot=make('span','','universe-distant');dot.style.left=(4+(i*37)%92)+'%';dot.style.top=(3+(i*23)%94)+'%';dot.setAttribute('aria-hidden','true');field.append(dot);});
  const positions=window.items.map((item,i)=>{const a=-Math.PI/2+angle+i*Math.PI*2/window.items.length;return {...item,x:50+37*Math.cos(a),y:50+37*Math.sin(a)};});
  for(const item of positions){const line=document.createElementNS(svg.namespaceURI,'line');for(const [key,value]of Object.entries({x1:50,y1:50,x2:item.x,y2:item.y}))line.setAttribute(key,value);svg.append(line);}
  const shown=new Map(positions.map(p=>[p.node.id,p]));for(const edge of graph.edges){const a=shown.get(edge.from),b=shown.get(edge.to);if(!a||!b)continue;const line=document.createElementNS(svg.namespaceURI,'line');for(const [k,v]of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))line.setAttribute(k,v);line.classList.add('cross-connection');svg.append(line);}
  function orb(node,x,y,isCenter=false){
   const text=node?label(node):'Orbiversity',el=button('',()=>isCenter?panel(current):go(node.id),'universe-orb'+(isCenter?' universe-center':'')+(node?.kind==='work'?' universe-work':' universe-group'));
   el.style.setProperty('--x',x+'%');el.style.setProperty('--y',y+'%');el.style.setProperty('--orb-color',node?.color||center?.color||'#c8d6e1');el.setAttribute('aria-label',isCenter?text:tr('Explore ','Explorar ')+text);
   el.append(make('span','','universe-sphere'),make('span',text,'universe-label orb-content'));
   if(node?.kind==='group')el.append(make('small',node.members.length+tr(' orbs',' orbs'),'universe-node-count'));field.append(el);
  }
  orb(center,50,50,true);positions.forEach(item=>orb(item.node,item.x,item.y));
  if(window.pages>1){paging.append(button(tr('Previous','Anterior'),()=>{page=(page-1+window.pages)%window.pages;render();}),make('span',(page+1)+' / '+window.pages),button(tr('More paths','Más caminos'),()=>{page=(page+1)%window.pages;render();}));}
  status.textContent=graph.workCount+tr(' published orbs',' orbs publicados')+' · '+graph.groups.length+tr(' collections',' colecciones')+' · '+graph.edges.length+tr(' connections',' conexiones');
  panel(current);
 }
 window.addEventListener('popstate',()=>{readLocation();render();});
 matchMedia('(max-width:700px)').addEventListener('change',()=>{page=0;render();});
 new MutationObserver(()=>render()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 update(catalog);return {update,select:id=>{if(graph.nodes.has(id))go(id);},current:()=>current};
}
