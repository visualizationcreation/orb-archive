import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

test('submission waits for the most recently selected ORB data and its note', async()=>{
const listeners=new Map(),nodes=new Map();
function node(id=''){return {id,value:'',files:[],children:[],hidden:false,disabled:false,textContent:'',addEventListener(type,fn){listeners.set(id+':'+type,fn)},setAttribute(){},removeAttribute(){},replaceChildren(...children){this.children=children},append(...children){this.children.push(...children)},focus(){},scrollIntoView(){},querySelectorAll(){return []}};}
const get=id=>{if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id)};
const form=get('museum-submission'),elements=[];
for(const name of ['title','description','attribution','creatorName','contributorNote','expression']){const input=node(name);input.name=name;elements.push(input);elements[name]=input;}
elements.title.value='Imported orb';elements.attribution.value='anonymous';form.elements=elements;form.reportValidity=()=>true;
const document={getElementById:get,querySelector:selector=>selector==='.package-limit-note'?null:get(selector),createElement:()=>node()};
const deferred=()=>{let resolve;return {promise:new Promise(r=>{resolve=r}),resolve:value=>resolve(value)}};
const a=deferred(),b=deferred(),called=deferred();
let inputAtBuild;
const fileA={name:'a.json',size:100,text:()=>a.promise},fileB={name:'b.json',size:100,text:()=>b.promise};
get('submission-html').files=[{name:'index.html',size:100}];
const context=vm.createContext({document,window:{addEventListener(){}},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},Blob,matchMedia:()=>({matches:true}),PACKAGE_LIMITS:{jsonBytes:8*1024*1024},buildMuseumPackage:async input=>{inputAtBuild=input;called.resolve(input);return {blob:new Blob(['zip']),manifest:{},filename:'review.zip',warnings:[]}}});
const source=(await fs.readFile(new URL('../museum-submit.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
vm.runInContext(source,context);
get('submission-json').files=[fileA];listeners.get('museum-submission:change')({target:get('submission-json')});
const submit=listeners.get('museum-submission:submit')({preventDefault(){}});
get('submission-json').files=[fileB];listeners.get('museum-submission:change')({target:get('submission-json')});
a.resolve(JSON.stringify({museum:{contribution:{note:'A note'}}}));
await new Promise(resolve=>setImmediate(resolve));
assert.equal(inputAtBuild,undefined,'Must wait for the latest selected JSON before building');
b.resolve(JSON.stringify({museum:{contribution:{note:'B note'}}}));
const input=await called.promise;
assert.equal(input.orbJSON,fileB);assert.equal(input.creatorNote,'B note');
await submit;await Promise.resolve();
assert.equal(elements.contributorNote.value,'B note');
});
