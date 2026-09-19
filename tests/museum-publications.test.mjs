import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {PUBLICATIONS_API,publicationId,publicationURL,publicURL,normalizeListing,mergeCatalog,connectionsFor,savedExploration,fetchMuseumJSON,listingFromPublication} from '../museum-publications.mjs';
const require=createRequire(import.meta.url),museum=require('../museum-catalog.js');
const a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64);
const row=(id=a)=>({id,title:'New world',category:'Nature',publishedAt:'2026-09-16T06:00:00.000Z',pointCount:5,museum:{attribution:'anonymous'}});
test('only exact publication IDs create a Museum reader URL',()=>{assert.equal(publicationId(a),a);for(const bad of ['',a+'x','../'+a,a.toUpperCase(),'<script>']){assert.equal(publicationId(bad),null);assert.equal(publicationURL(bad),null);}assert.equal(publicationURL(a),'https://orbiversity.com/orb-archive/studio.html?publication='+a);});
test('published catalog cannot substitute an arbitrary reader, HTML or private links',()=>{
  const item=normalizeListing({...row(),url:'javascript:alert(1)',editions:[{url:'https://evil.example/'}],museum:{attribution:'anonymous',creator:{displayName:'Private'},contribution:{note:'<img src=x onerror=alert(1)>',expression:'Unchanged words'},library:[{title:'secret',url:'https://example.com/?token=private'},{title:'Good source',url:'https://example.com/research'}]}});
  assert.equal(item.editions[0].url,publicationURL(a));assert.equal(item.museum.creator,undefined);assert.equal(item.museum.library.length,1);assert.equal(item.museum.contribution.expression,'Unchanged words');
  const html=museum.entry(item);assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('Private'));assert.ok(!html.includes('javascript:'));
});
test('public link policy rejects credentials, secret fragments and local hosts',()=>{for(const url of ['http://example.com','https://user:pass@example.com/','https://127.0.0.1/','https://[::1]/','https://service.local/','https://example.com/?API_KEY=x','https://example.com/#access_token=x','https://example.com/\nnext'])assert.equal(publicURL(url),null,url);assert.equal(publicURL('https://example.com/research?q=forest'),'https://example.com/research?q=forest');});
test('merging preserves every static object, ID, and historical edition',async()=>{
  const original=JSON.parse(await readFile(new URL('../orbs.json',import.meta.url),'utf8')).orbs;const before=JSON.stringify(original);const merged=mergeCatalog(original,[row(),row(),{...row(),id:original[0].id}]);assert.equal(merged.length,original.length+1);assert.equal(JSON.stringify(original),before);assert.equal(merged[0],original[0]);assert.deepEqual(merged.slice(0,original.length).flatMap(o=>o.editions),original.flatMap(o=>o.editions));
});
test('Reach links require exact real ID or URL and reject contradictory targets',()=>{
  const first=normalizeListing(row()),second=normalizeListing(row(b)),third=normalizeListing({...row(c),category:'Art'});
  first.reaches=[{target:{id:b,url:publicationURL(c)},reason:'Mismatch'},{target:{url:publicationURL(c)},reason:'Same shape'}, {target:{id:'invented'},reason:'Unknown'}];
  const result=connectionsFor(first,[first,second,third]);assert.equal(result.length,2);assert.equal(result[0].orb.id,c);assert.equal(result[0].kind,'contributor');assert.equal(result[1].orb.id,b);assert.equal(result[1].kind,'topic');assert.ok(!result.some(x=>x.reason==='Mismatch'));
});
test('earlier published edition is retained separately from topic suggestions',()=>{const first=normalizeListing({...row(),parentId:b}),second=normalizeListing(row(b));assert.equal(connectionsFor(first,[first,second])[0].kind,'previous');});
test('saved exploration preserves authored topics, parent connections and every focus window without invented sources',()=>{
  const record={content:{title:'Root',neighbors:[{title:'Authored topic',summary:'Original',bridge:'Shared ideas'}]},calledOrbs:[{title:'Source <img>',url:'https://en.wikipedia.org/wiki/Art',summary:'Saved source',parent:0}],orbFocus:{current:'focus-one',windows:[{id:'focus-one',content:{title:'Focused source',neighbors:[]},path:[{title:'Authored topic'},{title:'Source <img>',url:'https://en.wikipedia.org/wiki/Art'}],calledOrbs:[{title:'Child',parent:-1,url:'javascript:alert(1)',bridge:'Authored link'}]}]}};
  const windows=savedExploration(record);assert.equal(windows.length,2);assert.equal(windows[0].nodes[0].url,null);assert.equal(windows[0].nodes[1].parent,'Authored topic');assert.equal(windows[0].nodes[1].title,'Source <img>');assert.equal(windows[1].current,true);assert.equal(windows[1].path.length,2);assert.equal(windows[1].nodes[0].parent,'Focused source');assert.equal(windows[1].nodes[0].url,null);
});
test('publication detail makes a compatible fallback listing without authored HTML',()=>{const value={id:a,record:{content:{title:'Art',readings:[{text:'Actual opening'}]},museum:{contribution:{note:'Personal note'}}},publishedAt:'2026-09-16T06:00:00Z'};const item=listingFromPublication(value);assert.equal(item.title,'Art');assert.equal(item.pointCount,1);assert.equal(item.museum.contribution.note,'Personal note');assert.equal(item.editions[0].url,publicationURL(a));});
test('reader requests only canonical API with no credentials and validates returned identity',async()=>{
  let called;const body={id:a,record:{content:{title:'Art',readings:[{}]}}};assert.deepEqual(await fetchMuseumJSON(a,{fetchImpl:async(url,options)=>{called={url,options};return new Response(JSON.stringify(body));}}),body);assert.equal(called.url,PUBLICATIONS_API+'?id='+a);assert.equal(called.options.credentials,'omit');
  await assert.rejects(fetchMuseumJSON(b,{fetchImpl:async()=>new Response(JSON.stringify(body))}),/incomplete/);
});
test('404, unavailable catalog, timeout and oversized responses give retryable failures',async()=>{
  await assert.rejects(fetchMuseumJSON(a,{fetchImpl:async()=>new Response('{}',{status:404})}),error=>error.status===404&&/not be found/.test(error.message));
  await assert.rejects(fetchMuseumJSON(undefined,{fetchImpl:async()=>new Response('{}',{status:503})}),/try again/);
  await assert.rejects(fetchMuseumJSON(undefined,{fetchImpl:async()=>new Response('{}',{headers:{'content-length':String(33*1024*1024)}})}),/too large/);
  await assert.rejects(fetchMuseumJSON(undefined,{fetchImpl:async()=>new Response('{"schemaVersion":2,"orbs":[]}')}),/unsupported/);
  await assert.rejects(fetchMuseumJSON(undefined,{timeoutMs:1,fetchImpl:async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))}),/too long/);
});
test('record stream without Content-Length is cancelled before exceeding its byte budget',async()=>{let cancelled=false;const body=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(1024*1024));},cancel(){cancelled=true;}});await assert.rejects(fetchMuseumJSON(a,{fetchImpl:async()=>new Response(body)}),/too large/);assert.equal(cancelled,true);});
test('published mode has a separate trusted renderer and normal Studio retains its full loading order',async()=>{
  const entry=await readFile(new URL('../studio-entry.mjs',import.meta.url),'utf8'),view=await readFile(new URL('../museum-published-view.mjs',import.meta.url),'utf8');assert.match(entry,/has\('publication'\)/);assert.match(entry,/studio-parser\.js.*orbfill-handoff\.js.*studio\.js.*spanish\.js.*studio-spanish\.js.*languages\.js.*studio-resize\.js/);assert.match(view,/data\.textContent=JSON\.stringify\(publication\.record\)/);assert.ok(!view.includes('innerHTML'));assert.ok(!view.includes('srcdoc'));assert.match(view,/museum-reader-runtime\.js/);
});
