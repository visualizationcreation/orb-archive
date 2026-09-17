import {neighborhood} from './orb-connect-pass.mjs?v=fractal-click-20260916-1';
export const MAX_LAYERS=4;
export const CALL_SIZE=8;
export const sphereSize=depth=>76*Math.pow(.64,depth);
export function newView(center='universe') {
 return {version:2,center,selected:'root',nodes:[{key:'root',id:center,parent:null,depth:0,x:0,y:0}],expanded:[]};
}
export const layerCount=view=>Math.max(0,...view.nodes.map(node=>node.depth));
export function unseen(graph,view,key) {
 const parent=view.nodes.find(node=>node.key===key);if(!parent)return [];
 const ancestors=new Set();let node=parent;
 while(node){ancestors.add(node.id);node=view.nodes.find(item=>item.key===node.parent);}
 const shown=new Set(view.nodes.filter(node=>node.parent===key).map(node=>node.id));
 return neighborhood(graph,parent.id).filter(item=>!ancestors.has(item.node.id)&&!shown.has(item.node.id));
}
export function callTarget(graph,view,key=view.selected) {
 const selected=view.nodes.find(node=>node.key===key);
 return selected&&selected.depth<MAX_LAYERS&&unseen(graph,view,key).length?selected:null;
}
// Each occurrence is a route to one saved orb. Local children may point to an
// orb seen in another branch, but never back through this route's ancestors.
export function callOrbs(graph,view,key=view.selected) {
 const parent=callTarget(graph,view,key);if(!parent)return {view,added:[]};
 const next=structuredClone(view),items=unseen(graph,view,parent.key).slice(0,CALL_SIZE),depth=parent.depth+1;
 const base=parent.depth===0?330:Math.max(82,180*Math.pow(.67,parent.depth-1));
 for(let i=0;i<items.length;i++) {
  let best,score=Infinity;
  for(let ring=0;ring<18;ring++)for(let slot=0;slot<64;slot++) {
   const start=parent.depth?Math.atan2(parent.y,parent.x): -Math.PI/2;
   const angle=start+i*Math.PI*2/items.length+slot*Math.PI*2/64,radius=base+ring*14;
   const candidate={x:parent.x+Math.cos(angle)*radius,y:parent.y+Math.sin(angle)*radius};
   const clear=next.nodes.every(node=>{
    const spacing=node.depth<=1||depth<=1?115:node.depth===2||depth===2?88:65;
    return Math.hypot(candidate.x-node.x,(candidate.y-node.y)*1.18)>=Math.max(spacing,(sphereSize(depth)+sphereSize(node.depth))/2+24);
   });
   if(!clear)continue;
   const cost=ring*100+slot;
   if(cost<score){score=cost;best=candidate;}
  }
  if(!best)break; // Keep this branch local; its remaining children can follow after refocus.
  next.nodes.push({key:parent.key+'/'+encodeURIComponent(items[i].node.id),id:items[i].node.id,parent:parent.key,depth,...best});
 }
 const added=next.nodes.slice(view.nodes.length).map(node=>node.key);
 if(added.length&&!next.expanded.includes(parent.key))next.expanded.push(parent.key);
 return {view:next,added};
}
export const startView=(graph,center='universe')=>callOrbs(graph,newView(center)).view;
export function refocus(graph,view,key) {
 const node=view.nodes.find(node=>node.key===key);
 if(!node||node.parent===null||!graph.nodes.has(node.id))return null;
 return startView(graph,node.id);
}
export function visibleEdges(graph,view) {
 const edges=view.nodes.filter(node=>node.parent!==null).map(node=>({from:node.parent,to:node.key,kind:'branch'}));
 // A shared reference is a cross-link, not a duplicated publication.
 const first=new Map();for(const node of view.nodes){if(first.has(node.id))edges.push({from:first.get(node.id),to:node.key,kind:'shared'});else first.set(node.id,node.key);}
 return edges;
}
