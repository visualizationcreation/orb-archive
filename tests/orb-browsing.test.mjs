import test from 'node:test';
import assert from 'node:assert/strict';
import {newView,startView,callOrbs,callTarget,layerCount,refocus,visibleEdges,sphereSize} from '../orb-browsing.mjs';
import {createUniverse} from '../orb-connect-pass.mjs';
import {savedWorks} from '../orb-connect-snapshot.mjs';
const graph=()=>({nodes:new Map(Array.from({length:30},(_,i)=>['n'+i,{id:'n'+i,title:'Node '+i}])),groups:[],edges:Array.from({length:29},(_,i)=>({from:'n'+i,to:'n'+(i+1)}))});
const at=(view,id)=>view.nodes.find(node=>node.id===id).key;
test('clicked parent grows local smaller children; old positions stay fixed',()=>{
 const g=graph();let view=newView('n0');
 for(let layer=1;layer<=4;layer++){view.selected=at(view,'n'+(layer-1));const before=structuredClone(view);view=callOrbs(g,view).view;assert.deepEqual(view.nodes.slice(0,before.nodes.length),before.nodes);assert.equal(layerCount(view),layer);assert.equal(view.center,'n0');const child=view.nodes.at(-1),parent=view.nodes.find(n=>n.key===child.parent);assert.ok(Math.hypot(child.x-parent.x,child.y-parent.y)<350);assert.ok(sphereSize(child.depth)<sphereSize(parent.depth));}
 view.selected=at(view,'n4');assert.equal(callTarget(g,view),null);assert.strictEqual(callOrbs(g,view).view,view);
});
test('explicit refocus continues beyond four layers and keeps the return view intact',()=>{
 const g=graph();let view=startView(g,'n0');for(let i=1;i<=3;i++){view.selected=at(view,'n'+i);view=callOrbs(g,view).view;}
 const saved=structuredClone(view),next=refocus(g,view,at(view,'n4'));assert.equal(next.center,'n4');assert.equal(layerCount(next),1);assert.deepEqual(view,saved);assert.equal(refocus(g,view,'absent'),null);
});
test('shared destinations unfold per branch without ancestor loops or duplicate children',()=>{
 const g=graph();g.edges=[{from:'n0',to:'n1'},{from:'n0',to:'n2'},{from:'n1',to:'n3'},{from:'n2',to:'n3'},{from:'n3',to:'n0'}];
 let view=startView(g,'n0');view.selected=at(view,'n1');view=callOrbs(g,view).view;view.selected=at(view,'n2');view=callOrbs(g,view).view;
 assert.equal(view.nodes.filter(n=>n.id==='n3').length,3);const before=view.nodes.length;view=callOrbs(g,view).view;assert.equal(view.nodes.length,before);
 view.selected=view.nodes.filter(n=>n.id==='n3').at(-1).key;view=callOrbs(g,view).view;assert.equal(view.nodes.filter(n=>n.id==='n0').length,1);assert.ok(visibleEdges(g,view).some(e=>e.kind==='shared'));
});
test('a four-layer branch does not block a shallower sibling',()=>{
 const g=graph();g.edges.push({from:'n0',to:'n20'},{from:'n20',to:'n29'});let view=startView(g,'n0');for(let i=1;i<=3;i++){view.selected=at(view,'n'+i);view=callOrbs(g,view).view;}
 view.selected=at(view,'n20');assert.ok(callTarget(g,view));const result=callOrbs(g,view);assert.ok(result.added.length);assert.equal(layerCount(result.view),4);
});
test('eight is a batch size, not a total limit, and unrelated branches never grow',()=>{
 const g=graph();g.edges=Array.from({length:29},(_,i)=>({from:'n0',to:'n'+(i+1)}));let view=startView(g,'n0');assert.equal(view.nodes.length,9);while(callTarget(g,view))view=callOrbs(g,view).view;assert.equal(view.nodes.length,30);
 view.selected=at(view,'n1');assert.equal(callOrbs(g,view).added.length,0);
 for(const node of view.nodes)assert.ok(Number.isFinite(node.x)&&Number.isFinite(node.y));
});
test('actual museum unfolds a four-layer route from an existing group',()=>{
 const g=createUniverse(savedWorks);let view=startView(g);view.selected=at(view,'forests-waters');view=callOrbs(g,view).view;
 view.selected=at(view,'south-sound-salmon-watching-guide');view=callOrbs(g,view).view;
 const third=view.nodes.find(n=>n.id==='seasons-gathering'&&n.depth===3);assert.ok(third);view.selected=third.key;view=callOrbs(g,view).view;assert.ok(view.nodes.some(n=>n.depth===4));
 assert.equal(g.nodes.size,21);assert.equal(new Set(view.nodes.map(n=>n.key)).size,view.nodes.length);
});
