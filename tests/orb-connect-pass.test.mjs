import test from 'node:test';
import assert from 'node:assert/strict';
import {createUniverse,neighborhood,pageOf,pass} from '../orb-connect-pass.mjs';
import {savedWorks} from '../orb-connect-snapshot.mjs';

test('the organizing pass retains all fifteen published entries and six authored grouping orbs',()=>{
 const graph=createUniverse(savedWorks);assert.equal(graph.workCount,15);assert.equal(graph.groups.length,6);assert.equal(graph.nodes.size,21);
 for(const work of savedWorks){assert.equal(graph.nodes.get(work.id).url,work.url);assert.ok(neighborhood(graph,work.id).length>0,work.title);}
 for(const edge of graph.edges){assert.ok(graph.nodes.has(edge.from));assert.ok(graph.nodes.has(edge.to));assert.ok(edge.reason.length>20);assert.notEqual(edge.from,edge.to);}
 assert.equal(new Set(graph.edges.map(e=>[e.from,e.to].sort().join('|'))).size,graph.edges.length);
});
test('every published orb can be reached from the collections and has a return route',()=>{
 const graph=createUniverse(savedWorks),visited=new Set(['universe']),queue=['universe'];
 while(queue.length)for(const {node}of neighborhood(graph,queue.shift()))if(!visited.has(node.id)){visited.add(node.id);queue.push(node.id);}
 assert.equal(visited.size,graph.nodes.size+1);
 for(const group of graph.groups)for(const [id]of group.members)assert.ok(neighborhood(graph,id).some(n=>n.node.id===group.id));
});
test('self-development joins four new works to the existing universe',()=>{
 const ids=['from-intention-to-action','a-life-that-matters','the-beliefs-we-live-by','connection-without-losing-yourself'];
 const graph=createUniverse([...savedWorks,...ids.map(id=>({id,title:id,url:'https://orbiversity.com/'+id+'/'}))]);
 assert.equal(graph.workCount,19);
 assert.equal(graph.nodes.get('self-development').members.length,4);
 for(const id of ids)assert.ok(neighborhood(graph,id).some(n=>n.node.id==='self-development'));
 assert.ok(neighborhood(graph,'self-development').some(n=>n.node.id==='belief-memory'));
});
test('future arrivals remain navigable without inventing semantic membership',()=>{
 const next={id:'another-world',title:'A new orb',url:'https://example.org/orb'};const graph=createUniverse([...savedWorks,next]);
 assert.equal(graph.workCount,16);assert.deepEqual(neighborhood(graph,next.id).map(n=>n.node.id),['new-arrivals']);
 assert.ok(neighborhood(graph,'universe').some(n=>n.node.id==='new-arrivals'));
});
test('eight is a page size, never a collection or graph cap',()=>{
 const graph=createUniverse(Array.from({length:29},(_,i)=>({id:'new-'+i,title:'Topic '+i}))),items=neighborhood(graph,'new-arrivals');
 const visited=new Set();for(let page=0;page<4;page++)for(const item of pageOf(items,page).items)visited.add(item.node.id);
 assert.equal(visited.size,29);assert.equal(pageOf(items,999).page,3);
});
test('a repeated pass is deterministic and empty input has no dangling edges',()=>{
 assert.deepEqual(createUniverse(savedWorks),createUniverse(savedWorks));assert.equal(createUniverse([]).edges.length,0);
});
test('same-title editions retain separate identities and distinguishable labels',()=>{
 const editions=[...createUniverse(savedWorks).nodes.values()].filter(n=>n.title.startsWith('Musée'));
 assert.equal(editions.length,2);assert.notEqual(editions[0].id,editions[1].id);assert.notEqual(editions[0].editionLabel,editions[1].editionLabel);
});
