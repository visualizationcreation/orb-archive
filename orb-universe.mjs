import {createMuseumTree} from './orb-tree.mjs?v=central-tree-20260916-1';
import {startView,callOrbs,callTarget,layerCount,MAX_LAYERS,refocus,visibleEdges,sphereSize,unseen,branchCurve} from './orb-browsing.mjs?v=central-tree-20260916-1';
import {createUniverse} from './orb-connect-pass.mjs?v=central-tree-20260916-1';
import {savedWorks} from './orb-connect-snapshot.mjs?v=central-tree-20260916-1';

export function mountUniverse({catalog,overview}){
 const field=document.querySelector('.orb-field'),studio=field.closest('.vault-studio');
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./orb-universe.css?v=central-tree-20260916-1',import.meta.url).href;document.head.append(css);
 document.querySelector('.vault-workspace').classList.add('universe-workspace');field.classList.add('universe-field');
 const es=()=>document.documentElement.lang==='es',tr=(a,b)=>es()?b:a;
 const make=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
 const button=(label,fn,className='')=>{const el=make('button',label,className);el.type='button';el.onclick=fn;return el;};
 const label=node=>(es()&&node.es?node.es:node.title)+(node.editionLabel?' · '+node.editionLabel:'');
 const copy=node=>es()&&node.summaryEs?node.summaryEs:node.summary||node.description;
 const nav=make('nav','','universe-nav');nav.setAttribute('aria-label','Universe navigation');studio.append(nav);
 const paging=make('div','','universe-pages');studio.append(paging);
 const status=make('p','','universe-status');status.setAttribute('role','status');studio.append(status);
 let graph,view,trail=[],message='',origin={x:0,y:0},arriving=new Set(),zoom=1,fit=true;
 const plane=make('div','','universe-plane');
 function update(data){const works=new Map(savedWorks.map(o=>[o.id,o]));for(const orb of data)works.set(orb.id,{...works.get(orb.id),...orb});graph=createMuseumTree(createUniverse([...works.values()]));if(!view)readLocation();render();}
 function readLocation(){const params=new URLSearchParams(location.search),id=params.get('map')||params.get('orb');view=startView(graph,graph.nodes.has(id)?id:'universe');trail=[];}
 function remember(){history.replaceState({orbBrowsing:{view,trail}},'');}
 function route(){const url=new URL(location.href);url.searchParams.delete('orb');view.center==='universe'?url.searchParams.delete('map'):url.searchParams.set('map',view.center);history.pushState({orbBrowsing:{view,trail}},'',url);}
 function choose(key){const node=view.nodes.find(n=>n.key===key);if(!node)return;view.selected=key;reveal(key);remember();render();field.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});}
 function reveal(key){const node=view.nodes.find(n=>n.key===key),result=callOrbs(graph,view,key);view=result.view;arriving=new Set(result.added);
 message=result.added.length?tr('Unfolded ','Se desplegaron ')+result.added.length+(result.added.length===1?tr(' smaller orb around ',' orb pequeño alrededor de '):tr(' smaller orbs around ',' orbs pequeños alrededor de '))+(graph.nodes.get(node.id)?.title||'Orbiversity')+'.':node.depth>=MAX_LAYERS?tr('This branch has four layers. Refocus it to continue.','Esta rama tiene cuatro capas. Recéntrala para continuar.'):unseen(graph,view,key).length?tr('This cluster is full. Refocus the branch for more room.','Este grupo está lleno. Recentra la rama para obtener más espacio.'):tr('This point is fully unfolded. Choose one of its children or open its published ORB.','Este punto está desplegado. Elige uno de sus hijos o abre su ORB publicado.');
 }
 function focus(id){const next=refocus(graph,view,id);if(!next)return;remember();trail.push(structuredClone(view));view=next;message='';fit=true;route();render(true);}
 function back(){if(!trail.length)return;remember();view=trail.pop();message='';fit=true;route();render(true);}
 function allWorlds(){remember();trail.push(structuredClone(view));view=startView(graph);message='';fit=true;route();render(true);}
 function grow(){reveal(view.selected);remember();render();nav.querySelector('.universe-call')?.focus({preventScroll:true});}
 function panel(key){
  const occurrence=view.nodes.find(n=>n.key===key),id=occurrence.id,node=graph.nodes.get(id),isRoot=!node;overview.replaceChildren();
  overview.setAttribute('aria-label',isRoot?tr('The Orbiversity universe','El universo de Orbiversity'):label(node));
  overview.append(make('p',isRoot?'Orb Connect':node.kind==='group'?tr('A grouping orb','Un orb de colección'):tr('A published orb','Un orb publicado'),'universe-kind'));
  overview.append(make('h2',isRoot?tr('One center. Worlds within worlds.','Un centro. Mundos dentro de mundos.'):label(node)));
  overview.append(make('p',isRoot?tr('Start at the center and unfold a branch. Every saved orb has one home in this tree; smaller layers reveal the collections and works inside.','Empieza en el centro y despliega una rama. Cada orb guardado tiene un lugar en este árbol; las capas más pequeñas revelan sus colecciones y obras.'):copy(node),'overview-description'));
  if(node?.kind==='work'){
   const edition=node.editions?.find(e=>e.id===node.featuredEdition)||node.editions?.[0],url=edition?.url||node.url;
   if(url){const a=make('a',tr('Open published ORB','Abrir ORB publicado'),'primary-link');a.href=url;overview.append(a);}
   overview.append(make('p',tr('The original edition opens with its readings, sources and available recordings.','La edición original conserva sus lecturas, fuentes y grabaciones disponibles.'),'overview-meta'));
  }
  const actions=make('div','','universe-branch-actions');
  if(occurrence.parent!==null&&(graph.children.get(id)||[]).length)actions.append(button(tr('Refocus this branch','Recentrar esta rama'),()=>focus(key),'primary-link'));
  overview.append(actions);
  overview.append(make('h3',tr('Branches from this point','Ramas desde este punto'),'universe-path-title'));
  const paths=make('ul','','universe-paths');
  for(const child of view.nodes.filter(n=>n.parent===key)){const item=graph.nodes.get(child.id),li=make('li');li.append(button(label(item),()=>choose(child.key)));paths.append(li);}overview.append(paths);
  if(!paths.children.length)overview.append(make('p',occurrence.depth>=MAX_LAYERS?tr('Refocus this branch to unfold the next four layers.','Recentra esta rama para desplegar las próximas cuatro capas.'):tr('No further saved connections along this route.','No hay más conexiones guardadas en esta ruta.'),'overview-meta'));
  const note=make('p',tr('An authored arrangement · 16 September 2026. Collections are invitations to explore; the original orbs keep their identities.','Una organización de autor · 16 de septiembre de 2026. Las colecciones invitan a explorar; los orbs originales conservan su identidad.'),'vault-note');overview.append(note);
 }
 function render(recenter=false){
  const selected=view.nodes.find(n=>n.key===view.selected),depth=layerCount(view),target=callTarget(graph,view),blocked=selected.depth>=MAX_LAYERS;
  document.querySelector('#studio-title').textContent=tr('Follow a fractal of the Orb.','Sigue un fractal del Orb.');
  const subtitle=document.querySelector('.studio-heading > p:last-child');if(subtitle)subtitle.textContent=tr('Click an orb. Watch its smaller worlds unfold.','Haz clic en un orb. Despliega sus mundos más pequeños.');
  const scroll={left:field.scrollLeft,top:field.scrollTop};field.replaceChildren(plane);plane.replaceChildren();nav.replaceChildren();paging.replaceChildren();
  nav.append(button(tr('All worlds','Todos los mundos'),allWorlds));
  if(trail.length)nav.append(button(tr('Wider view','Vista anterior'),back));
  const call=button(tr('Call Orbs +','Llamar Orbs +'),grow,'universe-call');call.disabled=!target;nav.append(call);
  call.title=target?tr('Reveal connections around ','Mostrar conexiones de ')+(graph.nodes.get(target.id)?.title||'Orbiversity'):tr('Click a smaller orb to unfold its branch.','Haz clic en un orb pequeño para desplegar su rama.');
  const ref=button(tr('Refocus branch','Recentrar rama'),()=>focus(view.selected));ref.disabled=selected.parent===null||!(graph.children.get(selected.id)||[]).length;nav.append(ref);
  nav.append(button(tr('Rearrange','Reordenar'),()=>{view.nodes=view.nodes.map(n=>({...n,angle:n.angle+.38,x:n.x*Math.cos(.38)-n.y*Math.sin(.38),y:n.x*Math.sin(.38)+n.y*Math.cos(.38)}));remember();render(true);}));
  nav.append(button(tr('Fit tree','Ver árbol'),()=>{fit=true;render(true);}),button('−',()=>{fit=false;zoom=Math.max(.25,zoom/1.3);render(true);}),button('+',()=>{fit=false;zoom=Math.min(2,zoom*1.3);render(true);}));nav.lastChild.setAttribute('aria-label',tr('Zoom in','Acercar'));nav.children[nav.children.length-2].setAttribute('aria-label',tr('Zoom out','Alejar'));
  const path=make('span',[...trail.map(v=>graph.nodes.get(v.center)?.title||'Orbiversity'),graph.nodes.get(view.center)?.title||'Orbiversity'].join(' › '),'universe-breadcrumb');nav.append(path);
  plane.classList.toggle('tree-overview',fit&&view.nodes.length>16);
  const nodes=view.nodes,extent=Math.max(205,...nodes.map(n=>Math.hypot(n.x,n.y)))+100;
  if(fit)zoom=Math.min(1,(field.clientWidth-24)/(extent*2),(field.clientHeight-24)/(extent*2));
  const width=Math.max(field.clientWidth,extent*2*zoom),height=Math.max(field.clientHeight,extent*2*zoom),dx=width/2,dy=height/2;
  plane.style.width=width+'px';plane.style.height=height+'px';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.classList.add('universe-lines');svg.setAttribute('aria-hidden','true');plane.append(svg);
  const positions=new Map(nodes.map(n=>[n.key,n]));
  for(const edge of visibleEdges(graph,view)){const a=positions.get(edge.from),b=positions.get(edge.to),line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',branchCurve(a,b,1/Math.sqrt(zoom)));line.setAttribute('transform',`translate(${dx},${dy}) scale(${zoom})`);line.setAttribute('vector-effect','non-scaling-stroke');if(edge.from===view.selected)line.classList.add('universe-selected-branch');svg.append(line);}
  function branchColor(item){let current=item;while(current){const color=graph.nodes.get(current.id)?.color;if(color)return color;current=positions.get(current.parent);}return '#a8c8df';}
  for(const item of nodes){
   const node=graph.nodes.get(item.id),isCenter=item.parent===null,text=node?label(node):'Orbiversity';
   const el=button('',()=>choose(item.key),'universe-orb'+(isCenter?' universe-center':'')+(node?.kind==='work'?' universe-work':' universe-group'));
   el.style.setProperty('--x',(item.x*zoom+dx)+'px');el.style.setProperty('--y',(item.y*zoom+dy)+'px');el.style.setProperty('--orb-color',branchColor(item));el.style.setProperty('--sphere-size',sphereSize(item.depth)*Math.sqrt(zoom)+'px');el.dataset.depth=item.depth;el.dataset.orbId=item.id;el.dataset.key=item.key;el.setAttribute('aria-label',text);el.setAttribute('aria-pressed',String(item.key===view.selected));
   el.append(make('span','','universe-sphere'),make('span',text,'universe-label orb-content'));
   el.setAttribute('aria-expanded',String(view.expanded.includes(item.key)));el.title=text+' · '+tr('Click to unfold','Haz clic para desplegar');
   el.append(make('small',isCenter?tr('Current center','Centro actual'):tr('Layer ','Capa ')+item.depth,'universe-node-count'));plane.append(el);
   if(arriving.has(item.key)&&!matchMedia('(prefers-reduced-motion:reduce)').matches){const parent=positions.get(item.parent);el.animate([{transform:`translate(-50%,-50%) translate(${(parent.x-item.x)*zoom}px,${(parent.y-item.y)*zoom}px) scale(.15)`,opacity:0},{transform:'translate(-50%,-50%) translate(0,0) scale(1)',opacity:1}],{duration:600,easing:'cubic-bezier(.16,1,.3,1)'});}
  }
  const guidance=blocked?tr('Four layers on this branch. Refocus it to continue deeper; other branches can still unfold.','Cuatro capas en esta rama. Recéntrala para continuar; las otras ramas aún pueden desplegarse.'):depth>=3?tr('Click a child to unfold its next layer. Refocus any branch for a closer view.','Haz clic en un hijo para desplegar su próxima capa. Recentra cualquier rama para verla de cerca.'):tr('Click a branch to unfold the next layer. Each orb has one place in the tree.','Haz clic en una rama para desplegar la siguiente capa. Cada orb tiene un lugar en el árbol.');
  paging.append(make('p',guidance));
  status.textContent=(message?message+' ':'')+nodes.length+tr(' unique points',' puntos únicos')+' · '+depth+'/4 '+tr('layers','capas')+' · '+graph.workCount+tr(' published orbs',' orbs publicados');
  panel(view.selected);
  if(fit||recenter||!field.dataset.positioned){const center=positions.get('root');field.scrollLeft=dx-field.clientWidth/2;field.scrollTop=dy-field.clientHeight/2;field.dataset.positioned='true';}else{field.scrollLeft=scroll.left+dx-origin.x;field.scrollTop=scroll.top+dy-origin.y;}origin={x:dx,y:dy};arriving.clear();
 }
 window.addEventListener('popstate',event=>{const saved=event.state?.orbBrowsing;if(saved?.view.version===3&&saved.view.nodes.every(n=>n.id==='universe'||graph.nodes.has(n.id))){view=saved.view;trail=saved.trail;}else readLocation();message='';render(true);});
 new ResizeObserver(()=>render()).observe(studio);
 new MutationObserver(()=>render()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 update(catalog);remember();return {update,select:id=>{if(graph.nodes.has(id)){const node=view.nodes.find(n=>n.id===id);if(node)choose(node.key);else{trail.push(structuredClone(view));view=startView(graph,id);route();render(true);}}},current:()=>view.nodes.find(n=>n.key===view.selected)?.id};
}
