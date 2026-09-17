import test from 'node:test';
import assert from 'node:assert/strict';
import {newView,startView,callOrbs,callTarget,layerCount,refocus,visibleEdges} from '../orb-browsing.mjs';
const graph=()=>({nodes:new Map(Array.from({length:30},(_,i)=>['n'+i,{id:'n'+i,title:'Node '+i}])),groups:[],edges:Array.from({length:29},(_,i)=>({from:'n'+i,to:'n'+(i+1)}))});
test('calls retain all earlier nodes and positions; boundary is four layers',()=>{
 const g=graph();let view=newView('n0');
 for(let layer=1;layer<=4;layer++){const before=structuredClone(view);view=callOrbs(g,view).view;assert.deepEqual(view.nodes.slice(0,before.nodes.length),before.nodes);assert.equal(layerCount(view),layer);assert.equal(view.center,'n0');}
 assert.equal(callTarget(g,view),null);assert.strictEqual(callOrbs(g,view).view,view);
});
test('refocus is explicit and preserves the wider view for return',()=>{
 const g=graph();let view=startView(g,'n0');for(let i=0;i<3;i++)view=callOrbs(g,view).view;
 const saved=structuredClone(view),next=refocus(g,view,'n4');assert.equal(next.center,'n4');assert.equal(layerCount(next),1);assert.deepEqual(view,saved);assert.equal(refocus(g,view,'n29'),null);
});
test('cycles reuse logical nodes and display cross-links',()=>{
 const g=graph();g.edges=[{from:'n0',to:'n1'},{from:'n1',to:'n2'},{from:'n2',to:'n0'}];
 let view=startView(g,'n0');view=callOrbs(g,view).view;
 assert.equal(view.nodes.length,3);assert.equal(visibleEdges(g,view).length,3);assert.equal(callTarget(g,view),null);
});
test('eight per call is a batch size, not a total cap; selected branch grows first',()=>{
 const g=graph();g.edges=Array.from({length:29},(_,i)=>({from:'n0',to:'n'+(i+1)}));
 let view=startView(g,'n0');assert.equal(view.nodes.length,9);while(callTarget(g,view))view=callOrbs(g,view).view;assert.equal(view.nodes.length,30);
 const branch=graph();branch.edges=[{from:'n0',to:'n1'},{from:'n0',to:'n2'},{from:'n1',to:'n3'},{from:'n2',to:'n4'}];let v=startView(branch,'n0');v.selected='n2';v=callOrbs(branch,v).view;assert.equal(v.nodes.at(-1).id,'n4');assert.equal(v.nodes.at(-1).parent,'n2');
});
test('dense arrangements keep finite positions and label clearance',()=>{
 const g=graph();g.edges=Array.from({length:29},(_,i)=>({from:'n0',to:'n'+(i+1)}));let view=startView(g,'n0');while(callTarget(g,view))view=callOrbs(g,view).view;
 for(const [i,node]of view.nodes.entries()){assert.ok(Number.isFinite(node.x)&&Number.isFinite(node.y));for(const previous of view.nodes.slice(0,i))assert.ok(Math.hypot((node.x-previous.x)/180,(node.y-previous.y)/130)>=1);}
});
