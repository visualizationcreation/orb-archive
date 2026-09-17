import test from 'node:test';
import assert from 'node:assert/strict';
import {newView,startView,callOrbs,callTarget,layerCount,refocus,visibleEdges,sphereSize,branchCurve} from '../orb-browsing.mjs';
import {createMuseumTree} from '../orb-tree.mjs';
import {createUniverse} from '../orb-connect-pass.mjs';
import {savedWorks} from '../orb-connect-snapshot.mjs';
const museum=()=>createMuseumTree(createUniverse(savedWorks));
function unfold(tree,view){for(let round=0;round<100;round++){const node=view.nodes.find(n=>callTarget(tree,view,n.key));if(!node)return view;view=callOrbs(tree,view,node.key).view;}throw Error('Growth did not terminate');}
test('whole museum is one tree with a single home for all 15 published works',()=>{
 const tree=museum();assert.equal(tree.workCount,15);assert.equal(tree.nodes.size,25);assert.equal(tree.parent.size,25);
 const view=unfold(tree,startView(tree));assert.equal(view.nodes.length,26);assert.equal(new Set(view.nodes.map(n=>n.id)).size,view.nodes.length);
 assert.equal(visibleEdges(tree,view).length,view.nodes.length-1);assert.equal(layerCount(view),4);
 for(const node of tree.nodes.values()){let id=node.id;const seen=new Set();while(id!=='universe'){assert.ok(!seen.has(id));seen.add(id);id=tree.parent.get(id);assert.ok(id);}}
});
test('expanding in a different order gives the same primary homes and positions',()=>{
 const tree=museum(),first=unfold(tree,startView(tree));let second=startView(tree);
 for(let round=0;round<100;round++){const node=second.nodes.slice().reverse().find(n=>callTarget(tree,second,n.key));if(!node)break;second=callOrbs(tree,second,node.key).view;}
 const sorted=view=>view.nodes.slice().sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(sorted(first),sorted(second));
});
test('nested children grow outward inside their parent sector with decreasing sizes',()=>{
 const tree=museum(),view=unfold(tree,startView(tree));
 for(const node of view.nodes.filter(n=>n.parent!==null)){const parent=view.nodes.find(n=>n.key===node.parent);assert.ok(node.radius>parent.radius);assert.ok(sphereSize(node.depth)<sphereSize(parent.depth));if(parent.depth)assert.ok(Math.abs(node.angle-parent.angle)<=parent.sector/2);assert.ok(node.sector<=parent.sector);}
});
test('the app-style connectors are finite cubic curves, with no cross-links',()=>{
 const tree=museum(),view=unfold(tree,startView(tree));for(const edge of visibleEdges(tree,view)){assert.equal(edge.kind,'branch');const curve=branchCurve(view.nodes.find(n=>n.key===edge.from),view.nodes.find(n=>n.key===edge.to));assert.match(curve,/^M .* C /);assert.doesNotMatch(curve,/NaN|Infinity/);}
});
test('refocus follows only descendants and preserves the wider tree unchanged',()=>{
 const tree=museum(),view=unfold(tree,startView(tree)),saved=structuredClone(view),focused=refocus(tree,view,'cities-museums');assert.equal(focused.center,'cities-museums');assert.ok(!focused.nodes.some(n=>n.id==='human-worlds'));assert.deepEqual(view,saved);assert.equal(refocus(tree,view,'quinault'),null);
});
test('four levels are a local view limit and eight is only a batch limit',()=>{
 const nodes=new Map(),children=new Map();for(let i=0;i<12;i++){nodes.set('n'+i,{id:'n'+i});children.set('n'+i,i<11?['n'+(i+1)]:[]);}const tree={nodes,children};const first=unfold(tree,startView(tree,'n0'));assert.equal(layerCount(first),4);assert.equal(first.nodes.length,5);const next=unfold(tree,refocus(tree,first,'n4'));assert.equal(next.nodes.at(-1).id,'n8');
 const ids=Array.from({length:29},(_,i)=>'b'+i);const broad={nodes:new Map(ids.map(id=>[id,{id}])),children:new Map([['universe',ids]])};let view=unfold(broad,startView(broad));assert.equal(view.nodes.length,30);assert.equal(new Set(view.nodes.map(n=>n.id)).size,30);
});
test('new arrivals remain reachable once and original catalog objects are unchanged',()=>{
 const graph=createUniverse([...savedWorks,{id:'new-work',title:'A new work',url:'https://example.com'}]),before=[...graph.nodes.keys()];const tree=createMuseumTree(graph),view=unfold(tree,startView(tree));assert.equal(view.nodes.filter(n=>n.id==='new-work').length,1);assert.deepEqual([...graph.nodes.keys()],before);assert.equal(tree.nodes.get('quinault').url,graph.nodes.get('quinault').url);
});
