import {neighborhood} from './orb-connect-pass.mjs?v=call-layers-20260916-1';

export const MAX_LAYERS=4;
export const CALL_SIZE=8;
export function newView(center='universe') {
 return {center,selected:center,nodes:[{id:center,parent:null,depth:0,x:0,y:0}],expanded:[]};
}
export const layerCount=view=>Math.max(0,...view.nodes.map(node=>node.depth));
export function unseen(graph,view,id) {
 const shown=new Set(view.nodes.map(node=>node.id));
 return neighborhood(graph,id).filter(item=>!shown.has(item.node.id));
}
export function callTarget(graph,view) {
 if(layerCount(view)>=MAX_LAYERS)return null;
 const selected=view.nodes.find(node=>node.id===view.selected);
 if(selected&&unseen(graph,view,selected.id).length)return selected;
 return view.nodes.find(node=>unseen(graph,view,node.id).length)||null;
}
// Store positions with the view: revealing a branch never moves earlier orbs.
export function callOrbs(graph,view) {
 const parent=callTarget(graph,view);if(!parent)return {view,added:[]};
 const next=structuredClone(view),items=unseen(graph,view,parent.id).slice(0,CALL_SIZE);
 for(let i=0;i<items.length;i++) {
  let position;
  for(let ring=0;ring<30&&!position;ring++)for(let slot=0;slot<32;slot++) {
   const angle=-Math.PI/2+(i/items.length)*Math.PI*2+slot*Math.PI*2/32;
   const radius=(parent.depth===0?260:190)+ring*65;
   const candidate={x:parent.x+Math.cos(angle)*radius,y:parent.y+Math.sin(angle)*radius};
   if(next.nodes.every(node=>Math.hypot((candidate.x-node.x)/180,(candidate.y-node.y)/130)>=1)) {position=candidate;break;}
  }
  next.nodes.push({id:items[i].node.id,parent:parent.id,depth:parent.depth+1,...position});
 }
 if(!next.expanded.includes(parent.id))next.expanded.push(parent.id);
 return {view:next,added:items.map(item=>item.node.id)};
}
export function startView(graph,center='universe') {
 return callOrbs(graph,newView(center)).view;
}
export function refocus(graph,view,id) {
 if(id===view.center||!view.nodes.some(node=>node.id===id)||!graph.nodes.has(id))return null;
 return startView(graph,id);
}
export function visibleEdges(graph,view) {
 const shown=new Set(view.nodes.map(node=>node.id));
 const edges=graph.edges.filter(edge=>shown.has(edge.from)&&shown.has(edge.to));
 if(shown.has('universe'))for(const group of graph.groups)if(shown.has(group.id))edges.push({from:'universe',to:group.id,kind:'entry'});
 return edges;
}
