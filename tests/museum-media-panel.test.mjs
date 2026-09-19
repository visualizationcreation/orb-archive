import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {collectMuseumMedia} from '../museum-media-model.mjs';
import {publicationId} from '../museum-publications.mjs';

// Exercise the actual panel module with a small DOM/event surface. Network
// promises are controlled explicitly; no browser or live service is involved.
const source=(await readFile(new URL('../museum-media-panel.mjs',import.meta.url),'utf8'))
 .replace(/^import[^\n]+\n/gm,'').replace('export function mountMuseumMediaPanel','function mountMuseumMediaPanel')
 .replaceAll('import.meta.url',JSON.stringify(new URL('../museum-media-panel.mjs',import.meta.url).href));
class Events{
 constructor(){this.listeners=new Map();}
 addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
 removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
 dispatchEvent(event){event.target ||= this;for(const fn of this.listeners.get(event.type)||[])fn(event);this['on'+event.type]?.(event);return true;}
}
class Element extends Events{
 constructor(tag){super();this.tagName=tag.toUpperCase();this.childNodes=[];this.parentNode=null;this.attributes=new Map();this.dataset={};this.className='';this.hidden=false;this._text='';this.pauseCalls=0;this.playCalls=0;this.paused=true;}
 get children(){return this.childNodes.filter(child=>child.tagName!=='#TEXT');}
 get textContent(){return this._text+this.childNodes.map(child=>child.textContent).join('');}
 set textContent(value){for(const child of this.childNodes)child.parentNode=null;this.childNodes=[];this._text=String(value??'');}
 append(...children){for(const child of children){child.remove();child.parentNode=this;this.childNodes.push(child);}}
 replaceChildren(...children){this.textContent='';this.append(...children);}
 remove(){if(this.parentNode){const at=this.parentNode.childNodes.indexOf(this);if(at>=0)this.parentNode.childNodes.splice(at,1);this.parentNode=null;}}
 setAttribute(name,value){this.attributes.set(name,String(value));}
 getAttribute(name){return this.attributes.get(name)??null;}
 matches(selector){
  if(selector.startsWith('.'))return this.className.split(/\s+/).includes(selector.slice(1));
  const attr=/^([a-z]+)?\[([^\]]+)\]$/i.exec(selector);
  if(attr)return (!attr[1]||this.tagName===attr[1].toUpperCase())&&(attr[2]==='data-museum-media'?!!this.dataset.museumMedia:this.attributes.has(attr[2]));
  return this.tagName===selector.toUpperCase();
 }
 querySelectorAll(selector){const selectors=selector.split(','),found=[];for(const child of this.childNodes){if(selectors.some(s=>child.matches(s)))found.push(child);found.push(...child.querySelectorAll(selector));}return found;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 click(){this.dispatchEvent({type:'click',target:this});}
 pause(){this.pauseCalls++;this.paused=true;}
 play(){this.playCalls++;this.paused=false;this.dispatchEvent({type:'play'});return Promise.resolve();}
 showModal(){this.open=true;}
 close(){this.open=false;this.dispatchEvent({type:'close'});}
 focus(){}
}
const defer=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function harness({fetchRecord=async()=>{throw Error('Unexpected publication fetch');},discover=async()=>({items:[]})}={}){
 const head=new Element('head'),body=new Element('body'),html=new Element('html');html.lang='en';html.append(head,body);
 const document={head,body,documentElement:html,createElement:tag=>new Element(tag),createTextNode:text=>{const node=new Element('#text');node.textContent=text;return node;},querySelector:selector=>html.querySelector(selector)};
 const window=new Events(),calls={publication:[],discovery:[]};
 const context=vm.createContext({document,window,URL,AbortController,CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail;}},collectMuseumMedia,publicationId,
  fetchMuseumJSON:async id=>{calls.publication.push(id);return {record:await fetchRecord(id)};},loadMuseumMedia:async input=>{calls.discovery.push(input);return discover(input);}});
 vm.runInContext(source+'\nglobalThis.mount=mountMuseumMediaPanel;',context);
 return {document,window,calls,mount(options){const panel=context.mount(options);body.append(panel.element);return panel;}};
}
const photo=(node,name='forest')=>({node,src:`https://example.com/${name}.jpg`,title:name,credit:'Photographer',license:'CC BY 4.0',source:'https://example.com/source'});
const record=(name='forest')=>({content:{title:name,readings:[{id:'p0',label:'Water',text:'Water connects the forest.'},{id:'p1',label:'Trees',text:'Trees shelter the river.'}]},readingImages:[photo('p0',name),photo('p1',name+'-trees')]});
const stage=panel=>panel.element.querySelector('.museum-media-stage');
const thumbs=panel=>panel.element.querySelector('.museum-media-strip').children;
const text=panel=>panel.element.textContent;
const idA='a'.repeat(64),idB='b'.repeat(64);

test('saved images appear automatically, retain plain-text credits, and need no discovery',async()=>{
 const h=harness(),panel=h.mount(),r=record();r.readingImages[0].title='<img onerror=alert(1)>';
 await panel.update({record:r,point:0});assert.equal(stage(panel).querySelector('img').src,r.readingImages[0].src);assert.ok(text(panel).includes('Photographer'));assert.ok(text(panel).includes('<img onerror=alert(1)>'));assert.equal(h.calls.discovery.length,0);assert.equal(h.calls.publication.length,0);panel.destroy();
});
test('an older publication response cannot replace the newly selected ORB',async()=>{
 const a=defer(),b=defer(),h=harness({fetchRecord:id=>id===idA?a.promise:b.promise}),panel=h.mount();
 const first=panel.update({listing:{id:idA,title:'A'}}),second=panel.update({listing:{id:idB,title:'B'}});
 b.resolve(record('B'));await second;assert.equal(stage(panel).querySelector('img').src,'https://example.com/B.jpg');
 a.resolve(record('A'));await first;assert.equal(stage(panel).querySelector('img').src,'https://example.com/B.jpg');panel.destroy();
});
test('same-key point selection while detail is loading uses the latest point without another fetch',async()=>{
 const pending=defer(),h=harness({fetchRecord:()=>pending.promise}),panel=h.mount();
 const initial=panel.update({listing:{id:idA},point:0}),latest=panel.update({listing:{id:idA},point:1});pending.resolve(record());await Promise.all([initial,latest]);
 assert.equal(h.calls.publication.length,1);assert.equal(stage(panel).querySelector('img').src,'https://example.com/forest-trees.jpg');panel.destroy();
});
test('legacy numeric point IDs preserve the latest selection while detail is loading',async()=>{
 const pending=defer(),h=harness({fetchRecord:()=>pending.promise}),panel=h.mount(),r=record();r.content.readings.forEach(reading=>delete reading.id);r.readingImages=[photo('0','zero'),photo('1','one')];
 const initial=panel.update({listing:{id:idA},point:0}),latest=panel.update({listing:{id:idA},point:1});pending.resolve(r);await Promise.all([initial,latest]);
 assert.equal(stage(panel).querySelector('img').src,'https://example.com/one.jpg');panel.destroy();
});
test('same-key listing metadata arriving during detail load is included in the completed panel',async()=>{
 const pending=defer(),h=harness({fetchRecord:()=>pending.promise}),panel=h.mount();
 const initial=panel.update({listing:{id:idA,title:'Forest'}}),latest=panel.update({listing:{id:idA,title:'Forest',museum:{audio:[{title:'Saved narration',url:'https://example.com/voice.mp3'}]}}});pending.resolve(record());await Promise.all([initial,latest]);
 assert.ok(thumbs(panel).some(thumb=>thumb.title==='Saved narration'));assert.equal(h.calls.publication.length,1);panel.destroy();
});
test('same-record updates refresh saved media without requiring a different record identity',async()=>{
 const h=harness(),panel=h.mount(),r=record();await panel.update({record:r});r.presentation={media:[{kind:'audio',node:'p0',title:'New narration',url:'https://example.com/new.mp3'}]};await panel.update({record:r});
 assert.ok(thumbs(panel).some(thumb=>thumb.title==='New narration'));panel.destroy();
});
test('direct audio uses a native player while external audio and video stay provider links',async()=>{
 const h=harness(),panel=h.mount(),r={content:{readings:[]},presentation:{media:[{kind:'audio',title:'Recording',url:'https://example.com/voice.mp3'},{kind:'audio',title:'Journey page',url:'https://example.com/journey.html'},{kind:'video',title:'Film page',url:'https://example.com/film.html'}]}};
 await panel.update({record:r});const player=stage(panel).querySelector('audio');assert.ok(player);assert.equal(player.controls,true);assert.equal(player.preload,'none');assert.equal(player.playCalls,0);
 thumbs(panel)[1].click();assert.equal(stage(panel).querySelector('audio'),null);assert.equal(stage(panel).querySelector('a').href,'https://example.com/journey.html');
 thumbs(panel)[2].click();assert.equal(stage(panel).querySelector('video'),null);assert.equal(stage(panel).querySelector('iframe'),null);assert.equal(stage(panel).querySelector('a').href,'https://example.com/film.html');panel.destroy();
});
test('switching media pauses native video and removes an active approved embed',async()=>{
 const h=harness(),panel=h.mount(),r={content:{readings:[]},presentation:{media:[{kind:'video',title:'File',url:'https://example.com/film.mp4'},{kind:'video',title:'YouTube',url:'https://youtu.be/xGZt80vYokI'},{kind:'audio',title:'Voice',url:'https://example.com/voice.mp3'}]}};
 await panel.update({record:r});stage(panel).querySelector('button').click();const video=stage(panel).querySelector('video');assert.ok(video);assert.equal(video.playCalls,1);
 thumbs(panel)[1].click();assert.ok(video.pauseCalls>0);assert.equal(video.parentNode,null);stage(panel).querySelector('button').click();const iframe=stage(panel).querySelector('iframe');assert.match(iframe.src,/^https:\/\/www.youtube-nocookie.com\/embed\//);
 thumbs(panel)[2].click();assert.equal(iframe.parentNode,null);assert.equal(stage(panel).querySelector('iframe'),null);assert.ok(stage(panel).querySelector('audio'));panel.destroy();
});
test('starting a second panel stops playback in the first and destroy detaches listeners',async()=>{
 const h=harness(),a=h.mount(),b=h.mount(),r={content:{readings:[]},presentation:{media:[{kind:'audio',title:'Voice',url:'https://example.com/voice.mp3'}]}};
 await a.update({record:r});await b.update({record:r});const first=stage(a).querySelector('audio'),second=stage(b).querySelector('audio');await first.play();const before=first.pauseCalls;await second.play();assert.ok(first.pauseCalls>before);a.destroy();b.destroy();assert.equal(h.window.listeners.get('museum-media-start').size,0);assert.equal(h.window.listeners.get('pagehide').size,0);
});
test('stale discovery and late publication completion cannot paint after selection changes or destroy',async()=>{
 const discovery=defer(),pending=defer(),h=harness({fetchRecord:()=>pending.promise,discover:()=>discovery.promise}),panel=h.mount();
 const initial=panel.update({record:{content:{title:'Empty',readings:[]}}});await Promise.resolve();await panel.update({record:record('Current')});discovery.resolve({items:collectMuseumMedia(record('Stale'))});await initial;assert.equal(stage(panel).querySelector('img').src,'https://example.com/Current.jpg');
 const late=panel.update({listing:{id:idA}});panel.destroy();const before=stage(panel).querySelector('img');pending.resolve(record('Late'));await late;assert.equal(panel.element.parentNode,null);assert.equal(stage(panel).querySelector('img'),before);assert.equal(stage(panel).hidden,true);
});
test('external image pages remain source links instead of broken native images',async()=>{
 const h=harness(),panel=h.mount();await panel.update({record:{content:{readings:[]},museum:{library:[{title:'Photo page',type:'image',url:'https://commons.wikimedia.org/wiki/File:Forest.jpg'}]}}});
 assert.equal(stage(panel).querySelector('img'),null);assert.equal(stage(panel).querySelector('a').href,'https://commons.wikimedia.org/wiki/File:Forest.jpg');panel.destroy();
});
test('an old image error cannot replace the current ORB when both reuse the same asset URL',async()=>{
 const h=harness(),panel=h.mount(),a=record('same'),b=record('same');await panel.update({record:a});const stale=stage(panel).querySelector('img');await panel.update({record:b});const current=stage(panel).querySelector('img');stale.onerror();
 assert.equal(stage(panel).querySelector('img'),current);panel.destroy();
});

test('reviewed media is applied to a published record that already contains images',async()=>{
 const original=record('old'),before=JSON.stringify(original),revised=record('reviewed');
 const h=harness({discover:async()=>({items:collectMuseumMedia(revised),status:'saved'})}),panel=h.mount(),listing={id:idA};
 await panel.update({record:original,listing,point:0});
 assert.equal(h.calls.discovery.length,1);assert.equal(stage(panel).querySelector('img').src,'https://example.com/reviewed.jpg');
 await panel.update({record:original,listing,point:1});
 assert.equal(stage(panel).querySelector('img').src,'https://example.com/reviewed-trees.jpg');assert.equal(h.calls.discovery.length,1);
 assert.equal(JSON.stringify(original),before);panel.destroy();
});
