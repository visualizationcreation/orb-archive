import {startView,callOrbs,callTarget,layerCount,MAX_LAYERS,refocus,visibleEdges} from './orb-browsing.mjs?v=call-layers-20260916-1';
import {createUniverse,neighborhood} from './orb-connect-pass.mjs?v=call-layers-20260916-1';
import {savedWorks} from './orb-connect-snapshot.mjs?v=call-layers-20260916-1';

export function mountUniverse({catalog,overview}){
 const field=document.querySelector('.orb-field'),studio=field.closest('.vault-studio');
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./orb-universe.css?v=call-layers-20260916-1',import.meta.url).href;document.head.append(css);
 document.querySelector('.vault-workspace').classList.add('universe-workspace');field.classList.add('universe-field');
 const es=()=>document.documentElement.lang==='es',tr=(a,b)=>es()?b:a;
 const make=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
 const button=(label,fn,className='')=>{const el=make('button',label,className);el.type='button';el.onclick=fn;return el;};
 const label=node=>(es()&&node.es?node.es:node.title)+(node.editionLabel?' · '+node.editionLabel:'');
 const copy=node=>es()&&node.summaryEs?node.summaryEs:node.summary||node.description;
 const nav=make('nav','','universe-nav');nav.setAttribute('aria-label','Universe navigation');studio.append(nav);
 const paging=make('div','','universe-pages');studio.append(paging);
 const status=make('p','','universe-status');status.setAttribute('role','status');studio.append(status);
 let graph,view,trail=[],message='',origin={x:0,y:0};
 const plane=make('div','','universe-plane');
 function update(data){const works=new Map(savedWorks.map(o=>[o.id,o]));for(const orb of data)works.set(orb.id,{...works.get(orb.id),...orb});graph=createUniverse([...works.values()]);if(!view)readLocation();render();}
 function readLocation(){const params=new URLSearchParams(location.search),id=params.get('map')||params.get('orb');view=startView(graph,graph.nodes.has(id)?id:'universe');trail=[];}
 function remember(){history.replaceState({orbBrowsing:{view,trail}},'');}
 function route(){const url=new URL(location.href);url.searchParams.delete('orb');view.center==='universe'?url.searchParams.delete('map'):url.searchParams.set('map',view.center);history.pushState({orbBrowsing:{view,trail}},'',url);}
 function choose(id){if(!view.nodes.some(n=>n.id===id))return;view.selected=id;message='';remember();render();field.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});}
 function focus(id){const next=refocus(graph,view,id);if(!next)return;remember();trail.push(structuredClone(view));view=next;message='';route();render(true);}
 function back(){if(!trail.length)return;remember();view=trail.pop();message='';route();render(true);}
 function allWorlds(){if(view.center==='universe')return;remember();trail.push(structuredClone(view));view=startView(graph);message='';route();render(true);}
 function grow(){const result=callOrbs(graph,view);view=result.view;message=result.added.length?tr('Added ','Se añadieron ')+result.added.length+tr(' connected orbs. Earlier layers remain.',' orbs conectados. Las capas anteriores permanecen.'):'';remember();render();nav.querySelector('.universe-call')?.focus({preventScroll:true});}
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
  const actions=make('div','','universe-branch-actions');
  if(id!==view.center)actions.append(button(tr('Refocus this branch','Recentrar esta rama'),()=>focus(id),'primary-link'));
  overview.append(actions);
  const near=neighborhood(graph,id),heading=make('h3',node?.kind==='work'?tr('Explore its collections','Explora sus colecciones'):tr('Paths from here','Caminos desde aquí'),'universe-path-title');overview.append(heading);
  const paths=make('ul','','universe-paths');
  for(const item of near){const li=make('li');li.append(button(label(item.node),()=>{if(view.nodes.some(n=>n.id===item.node.id))choose(item.node.id);else {view.selected=id;grow();if(view.nodes.some(n=>n.id===item.node.id))choose(item.node.id);}}));if(!isRoot)li.append(make('p',item.reason,'orb-content'));paths.append(li);}overview.append(paths);
  const note=make('p',tr('An authored arrangement · 16 September 2026. Collections are invitations to explore; the original orbs keep their identities.','Una organización de autor · 16 de septiembre de 2026. Las colecciones invitan a explorar; los orbs originales conservan su identidad.'),'vault-note');overview.append(note);
 }
 function render(recenter=false){
  const selected=graph.nodes.get(view.selected),depth=layerCount(view),target=callTarget(graph,view),blocked=depth>=MAX_LAYERS;
  document.querySelector('#studio-title').textContent=tr('Follow a fractal of the Orb.','Sigue un fractal del Orb.');
  const subtitle=document.querySelector('.studio-heading > p:last-child');if(subtitle)subtitle.textContent=tr('Call connections. Choose a branch. Go deeper.','Llama conexiones. Elige una rama. Profundiza.');
  const scroll={left:field.scrollLeft,top:field.scrollTop};field.replaceChildren(plane);plane.replaceChildren();nav.replaceChildren();paging.replaceChildren();
  nav.append(button(tr('All worlds','Todos los mundos'),allWorlds));
  if(trail.length)nav.append(button(tr('Wider view','Vista anterior'),back));
  const call=button(tr('Call Orbs +','Llamar Orbs +'),grow,'universe-call');call.disabled=!target;nav.append(call);
  call.title=target?tr('Reveal connections around ','Mostrar conexiones de ')+(graph.nodes.get(target.id)?.title||'Orbiversity'):tr('Choose a branch to refocus and continue.','Elige una rama para recentrar y continuar.');
  const ref=button(tr('Refocus branch','Recentrar rama'),()=>focus(view.selected));ref.disabled=view.selected===view.center;nav.append(ref);
  nav.append(button(tr('Rearrange','Reordenar'),()=>{view.nodes=view.nodes.map(n=>({...n,x:n.x*Math.cos(.38)-n.y*Math.sin(.38),y:n.x*Math.sin(.38)+n.y*Math.cos(.38)}));remember();render(true);}));
  const path=make('span',[...trail.map(v=>graph.nodes.get(v.center)?.title||'Orbiversity'),graph.nodes.get(view.center)?.title||'Orbiversity'].join(' › '),'universe-breadcrumb');nav.append(path);
  const nodes=view.nodes,minX=Math.min(...nodes.map(n=>n.x))-110,minY=Math.min(...nodes.map(n=>n.y))-90;
  const width=Math.max(field.clientWidth,Math.max(...nodes.map(n=>n.x))-minX+110),height=Math.max(field.clientHeight,Math.max(...nodes.map(n=>n.y))-minY+90);
  plane.style.width=width+'px';plane.style.height=height+'px';
  const dx=(width-(Math.max(...nodes.map(n=>n.x))-minX+110))/2-minX,dy=(height-(Math.max(...nodes.map(n=>n.y))-minY+90))/2-minY;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.classList.add('universe-lines');svg.setAttribute('aria-hidden','true');plane.append(svg);
  const positions=new Map(nodes.map(n=>[n.id,n]));
  for(const edge of visibleEdges(graph,view)){const a=positions.get(edge.from),b=positions.get(edge.to),line=document.createElementNS(svg.namespaceURI,'line');for(const [key,value]of Object.entries({x1:a.x+dx,y1:a.y+dy,x2:b.x+dx,y2:b.y+dy}))line.setAttribute(key,value);if(a.parent!==b.id&&b.parent!==a.id)line.classList.add('cross-connection');svg.append(line);}
  for(const item of nodes){
   const node=graph.nodes.get(item.id),isCenter=item.id===view.center,text=node?label(node):'Orbiversity';
   const el=button('',()=>choose(item.id),'universe-orb'+(isCenter?' universe-center':'')+(node?.kind==='work'?' universe-work':' universe-group'));
   el.style.setProperty('--x',(item.x+dx)+'px');el.style.setProperty('--y',(item.y+dy)+'px');el.style.setProperty('--orb-color',node?.color||'#a8c8df');el.dataset.depth=item.depth;el.dataset.orbId=item.id;el.setAttribute('aria-label',text);el.setAttribute('aria-pressed',String(item.id===view.selected));
   el.append(make('span','','universe-sphere'),make('span',text,'universe-label orb-content'));
   el.append(make('small',isCenter?tr('Current center','Centro actual'):tr('Layer ','Capa ')+item.depth,'universe-node-count'));plane.append(el);
  }
  const guidance=!target&&!blocked?tr('All connected orbs in this view are visible. Select a branch to explore it as a new center.','Todos los orbs conectados de esta vista están visibles. Elige una rama como nuevo centro.'):blocked?tr('Four layers reached. Select an orb, then Refocus branch to continue.','Has llegado a cuatro capas. Selecciona un orb y recentra su rama para continuar.'):depth>=3?tr('Three layers open. Choose a branch when you are ready to go deeper.','Tres capas abiertas. Elige una rama para profundizar.'):tr('Select an orb, then Call Orbs. Scroll the map to explore its growing branches.','Selecciona un orb y llama conexiones. Desplaza el mapa para explorar sus ramas.');
  paging.append(make('p',guidance));
  status.textContent=(message?message+' ':'')+nodes.length+tr(' visible',' visibles')+' · '+depth+'/4 '+tr('layers','capas')+' · '+graph.workCount+tr(' published orbs',' orbs publicados');
  panel(view.selected);
  if(recenter||!field.dataset.positioned){const center=positions.get(view.center);field.scrollLeft=center.x+dx-field.clientWidth/2;field.scrollTop=center.y+dy-field.clientHeight/2;field.dataset.positioned='true';}else{field.scrollLeft=scroll.left+dx-origin.x;field.scrollTop=scroll.top+dy-origin.y;}origin={x:dx,y:dy};
 }
 window.addEventListener('popstate',event=>{const saved=event.state?.orbBrowsing;if(saved&&saved.view.nodes.every(n=>n.id==='universe'||graph.nodes.has(n.id))){view=saved.view;trail=saved.trail;}else readLocation();message='';render(true);});
 new ResizeObserver(()=>render()).observe(studio);
 new MutationObserver(()=>render()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 update(catalog);remember();return {update,select:id=>{if(graph.nodes.has(id)){if(view.nodes.some(n=>n.id===id))choose(id);else{trail.push(structuredClone(view));view=startView(graph,id);route();render(true);}}},current:()=>view.selected};
}
