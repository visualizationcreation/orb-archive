import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {normalizeMuseumSpotlight,safeMuseumSpotlightURL,PACKAGE_LIMITS} from '../lib/museum-package.mjs';
const require=createRequire(import.meta.url),catalog=require('../museum-catalog.js');
const source=(await fs.readFile(new URL('../museum-submit.js',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');
function harness(){
  const nodes=new Map(),builds=[],revoked=[];
  function node(id='',tag='div'){
    const n={id,tag,value:'',files:[],children:[],dataset:{},events:{},hidden:false,disabled:false,textContent:'',addEventListener(type,fn){this.events[type]=fn},setAttribute(){},removeAttribute(){},focus(){},scrollIntoView(){},append(...children){for(const c of children){c.parent=this;this.children.push(c)}},replaceChildren(...children){this.children=[];this.append(...children)},remove(){this.parent.children=this.parent.children.filter(c=>c!==this)},querySelectorAll(selector){const all=this.children.flatMap(c=>[c,...c.querySelectorAll('*')]);return selector==='*'?all:selector==='[data-spotlight]'?all.filter(c=>c.dataset.spotlight):[]},querySelector(){return this.querySelectorAll('*').find(c=>['input','select','textarea'].includes(c.tag))}};
    return n;
  }
  const get=id=>{if(!nodes.has(id))nodes.set(id,node(id));return nodes.get(id)};
  const form=get('museum-submission'),elements=[];
  for(const name of ['title','description','attribution','creatorName','contributorNote','expression']){const input=node(name,'input');input.name=name;elements.push(input);elements[name]=input;}
  elements.title.value='Community garden';elements.attribution.value='anonymous';form.elements=elements;form.reportValidity=()=>true;
  get('submission-html').files=[{name:'index.html',size:20}];
  const document={getElementById:get,querySelector:selector=>selector==='.package-limit-note'?null:get(selector),createElement:tag=>node('',tag)};
  const normalize=value=>normalizeMuseumSpotlight(value===undefined?undefined:JSON.parse(JSON.stringify(value)));
  vm.runInContext(source,vm.createContext({document,window:{addEventListener(){}},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL:u=>revoked.push(u)},Blob,matchMedia:()=>({matches:true}),PACKAGE_LIMITS,normalizeMuseumSpotlight:normalize,safeMuseumSpotlightURL,buildMuseumPackage:async input=>{builds.push(input);return {blob:new Blob(['zip']),manifest:{},filename:'review.zip',warnings:[]}}}));
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  async function importRecord(record){get('submission-json').files=[{name:'saved.json',size:100,text:async()=>JSON.stringify(record)}];form.events.change({target:get('submission-json')});await settle();}
  const submit=()=>form.events.submit({preventDefault(){}});
  function edit(input,value){input.value=value;form.events.input({target:input});}
  return {get,form,elements,builds,revoked,importRecord,submit,edit};
}
const saved={profiles:[{label:'Studio',url:'https://example.com/studio'}],items:[{kind:'idea',title:'A shared garden',description:'A quiet place to learn together.'}]};
test('untouched imported profiles and text-only ideas appear and survive anonymous submission',async()=>{
  const h=harness();await h.importRecord({museum:{spotlight:saved}});await h.submit();
  assert.deepEqual(JSON.parse(JSON.stringify(h.builds[0].spotlight)),saved);assert.equal(h.builds[0].attribution,'anonymous');assert.equal(h.get('preview-spotlight-section').hidden,false);
});
test('edited shared work wins over a later JSON import and invalidates an old download',async()=>{
  const h=harness();await h.importRecord({museum:{spotlight:saved}});await h.submit();assert.equal(h.get('package-result').hidden,false);
  const label=h.get('spotlight-profiles').children[0].querySelectorAll('[data-spotlight]')[0];h.edit(label,'My current studio');assert.equal(h.get('package-result').hidden,true);assert.equal(h.revoked.length,2);
  await h.importRecord({museum:{spotlight:{profiles:[{label:'Old studio',url:'https://example.com/old'}]}}});await h.submit();assert.equal(h.builds[1].spotlight.profiles[0].label,'My current studio');
});
test('clear shared work is explicit and a later import cannot restore it',async()=>{
  const h=harness();await h.importRecord({museum:{spotlight:saved}});h.get('clear-spotlight').events.click();await h.importRecord({museum:{spotlight:saved}});await h.submit();assert.deepEqual(JSON.parse(JSON.stringify(h.builds[0].spotlight)),{});assert.equal(h.get('preview-spotlight-section').hidden,true);
});
test('private links cannot be prepared and do not become preview anchors',async()=>{
  const h=harness();h.get('add-spotlight-profile').events.click();const [label,url]=h.get('spotlight-profiles').children[0].querySelectorAll('[data-spotlight]');h.edit(label,'Private');h.edit(url,'https://example.com/?access_token=secret');await h.submit();assert.equal(h.builds.length,0);assert.equal(h.get('package-error').hidden,false);assert.equal(h.get('preview-spotlight').querySelectorAll('*').some(n=>n.tag==='a'),false);
});
test('oversized imported spotlight is not silently truncated or replaced',async()=>{
  const h=harness();await h.importRecord({museum:{spotlight:{profiles:Array.from({length:7},()=>saved.profiles[0])}}});await h.submit();assert.equal(Object.hasOwn(h.builds[0],'spotlight'),false);assert.match(h.get('spotlight-import-status').textContent,/needs attention/);
});
test('catalog renders spotlight-only metadata without inventing contributor identity',()=>{
  const html=catalog.aboutPoint({title:'Garden',museum:{spotlight:saved}});assert.match(html,/About this orb/);assert.match(html,/From the contributor/);assert.match(html,/A shared garden/);assert.doesNotMatch(html,/an orb by|anonymous orb/);
  assert.equal(catalog.aboutPoint({title:'Existing orb'}),'');
});
test('catalog escapes claims and keeps them separate from library sources',()=>{
  const html=catalog.aboutPoint({title:'Garden',museum:{attribution:'anonymous',spotlight:{profiles:[{label:'<script>profile</script>',url:'https://example.com/studio'}],items:[{kind:'product',title:'<img src=x>',description:'<script>alert(1)</script>',url:'javascript:alert(1)'}]}}});
  assert.match(html,/an anonymous orb/);assert.match(html,/&lt;script&gt;/);assert.match(html,/separate from this orb’s sources/);assert.doesNotMatch(html,/<script|<img|javascript:/);
});
test('classic catalog URL filtering matches the canonical package validator',()=>{
  const urls=['https://example.com/hello','https://www.youtube.com/@orb','https://example.com/path?topic=art#part-2','http://example.com/','javascript:alert(1)','https://a:b@example.com/','https://127.0.0.1/','https://[::1]/','https://library.local/','https://intranet/','https://example.com/?token=secret','https://example.com/#route?access_token=secret','https://example.com/?X-Amz-Signature=secret','https://example.com/\\other','https://example.com/'+ 'a'.repeat(2048)];
  for(const url of urls)assert.equal(catalog.spotlightURL(url),safeMuseumSpotlightURL(url),url);
});
