export const MAX_LAYERS=4;
export const CALL_SIZE=8;
export const sphereSize=depth=>76*Math.pow(.66,depth);
export function newView(center='universe') {return {version:3,center,selected:'root',nodes:[{key:'root',id:center,parent:null,depth:0,x:0,y:0,angle:0,radius:0,sector:Math.PI*2}],expanded:[]};}
export const layerCount=view=>Math.max(0,...view.nodes.map(node=>node.depth));
export function unseen(tree,view,key){const node=view.nodes.find(n=>n.key===key);if(!node)return [];const shown=new Set(view.nodes.map(n=>n.id));return (tree.children.get(node.id)||[]).filter(id=>!shown.has(id)).map(id=>({node:tree.nodes.get(id)}));}
export function callTarget(tree,view,key=view.selected){const node=view.nodes.find(n=>n.key===key);return node&&node.depth<MAX_LAYERS&&unseen(tree,view,key).length?node:null;}
// Nested angular sectors and increasing radius follow the app's fractal
// formation. Every child stays in its parent's outward-facing territory.
export function callOrbs(tree,view,key=view.selected){
 const parent=callTarget(tree,view,key);if(!parent)return {view,added:[]};
 const next=structuredClone(view),siblings=tree.children.get(parent.id)||[],items=unseen(tree,view,key).slice(0,CALL_SIZE);
 for(const item of items){
  next.nodes.push(positionChild(parent,item.node.id,siblings));
 }
 if(!next.expanded.includes(key))next.expanded.push(key);
 return {view:next,added:next.nodes.slice(view.nodes.length).map(n=>n.key)};
}
function positionChild(parent,id,siblings){
 const slot=siblings.indexOf(id),sector=parent.sector/Math.max(1,siblings.length),depth=parent.depth+1;
 const angle=parent.depth===0?parent.angle-Math.PI/2+sector*(slot+.5):parent.angle+(slot-(siblings.length-1)/2)*sector;
 const radius=parent.depth===0?205:parent.radius+170*Math.pow(.76,depth-2);
 return {key:id,id,parent:parent.key,depth,x:Math.cos(angle)*radius,y:Math.sin(angle)*radius,angle,radius,sector};
}
export function reconcileView(tree,view){
 const next=structuredClone(view),placed=new Map();
 next.nodes=next.nodes.map(node=>{const parent=placed.get(node.parent),updated=parent?positionChild(parent,node.id,tree.children.get(parent.id)||[]):node;placed.set(updated.key,updated);return updated;});
 return next;
}
export const startView=(tree,center='universe')=>callOrbs(tree,newView(center)).view;
export function refocus(tree,view,key){const node=view.nodes.find(n=>n.key===key);if(!node||node.parent===null||!(tree.children.get(node.id)||[]).length)return null;return startView(tree,node.id);}
export const visibleEdges=(tree,view)=>view.nodes.filter(n=>n.parent!==null).map(n=>({from:n.parent,to:n.key,kind:'branch'}));
// Match the app's cubic connector, with a gentler bend on root branches.
export function branchCurve(a,b,sizeScale=1){
 const distance=Math.hypot(b.x-a.x,b.y-a.y),ux=(b.x-a.x)/distance,uy=(b.y-a.y)/distance;
 const start={x:a.x+ux*(sphereSize(a.depth)*sizeScale/2+3),y:a.y+uy*(sphereSize(a.depth)*sizeScale/2+3)},end={x:b.x-ux*(sphereSize(b.depth)*sizeScale/2+3),y:b.y-uy*(sphereSize(b.depth)*sizeScale/2+3)},bend=distance*(a.depth? .2:.08);
 return `M ${start.x} ${start.y} C ${start.x+ux*distance*.35-uy*bend} ${start.y+uy*distance*.35+ux*bend} ${end.x-ux*distance*.25-uy*bend} ${end.y-uy*distance*.25+ux*bend} ${end.x} ${end.y}`;
}
