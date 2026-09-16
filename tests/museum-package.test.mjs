import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash, randomBytes} from 'node:crypto';
import {buildMuseumPackage, PACKAGE_LIMITS, MuseumPackageError, crc32, sha256Fallback} from '../lib/museum-package.mjs';

const encode=s=>new TextEncoder().encode(s), decode=b=>new TextDecoder().decode(b);
const html='<!doctype html><html><head><meta charset="utf-8"></head><body><h1>ORB</h1><script>globalThis.MUST_NOT_EXECUTE=true</script></body></html>';
const file=(name,data,type='')=>({name,data:typeof data==='string'?encode(data):data,type});
const base=()=>({title:'A remembered forest',html:file('forest.html',html)});
const hash=b=>createHash('sha256').update(b).digest('hex');

// Independent ZIP directory reader validates offsets, flags, sizes and content.
// This is deliberately not the builder's implementation or its CRC table.
function slowCRC(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=(n&1)?(n>>>1)^0xedb88320:n>>>1;}return (n^0xffffffff)>>>0;}
async function unzip(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer),end=bytes.length-22;
  assert.equal(view.getUint32(end,true),0x06054b50);const count=view.getUint16(end+10,true);let central=view.getUint32(end+16,true);const files=new Map();
  for(let i=0;i<count;i++){
    assert.equal(view.getUint32(central,true),0x02014b50);assert.equal(view.getUint16(central+8,true),0x800);assert.equal(view.getUint16(central+10,true),0);
    const expectedCRC=view.getUint32(central+16,true),size=view.getUint32(central+24,true),nameLength=view.getUint16(central+28,true),local=view.getUint32(central+42,true),name=decode(bytes.subarray(central+46,central+46+nameLength));
    assert.equal(view.getUint32(local,true),0x04034b50);assert.equal(view.getUint32(local+14,true),expectedCRC);assert.equal(view.getUint32(local+18,true),size);assert.equal(view.getUint32(local+22,true),size);assert.equal(decode(bytes.subarray(local+30,local+30+nameLength)),name);
    const content=bytes.slice(local+30+nameLength,local+30+nameLength+size);assert.equal(slowCRC(content),expectedCRC);assert.ok(!files.has(name));files.set(name,content);central+=46+nameLength;
  }
  assert.equal(central,end);assert.equal(files.size,count);return files;
}
const invalid=(code,field)=>e=>e instanceof MuseumPackageError&&e.code===code&&(!field||e.field===field);

test('deterministic minimal review ZIP preserves HTML, has real hashes and no automatic execution',async()=>{
  const events=[],input=base(),a=await buildMuseumPackage(input,{onProgress:e=>events.push(e)}),b=await buildMuseumPackage(input);
  assert.deepEqual(new Uint8Array(await a.blob.arrayBuffer()),new Uint8Array(await b.blob.arrayBuffer()));
  assert.equal(a.blob.type,'application/zip');assert.equal(a.filename,'A remembered forest-orb-review.zip');assert.equal(globalThis.MUST_NOT_EXECUTE,undefined);
  const files=await unzip(a.blob);assert.equal(decode(files.get('content/forest.html')),html);assert.equal(a.manifest.museum.creator,undefined);assert.equal(a.manifest.record,null);assert.equal(a.manifest.reviewStatus,'needs_owner_review');assert.equal(a.manifest.publicationApproved,false);
  assert.equal(a.manifest.offline.complete,false);assert.equal(a.manifest.offline.externalFilesFetched,0);
  for(const entry of a.manifest.files){assert.equal(entry.size,files.get(entry.path).length);assert.equal(entry.sha256,hash(files.get(entry.path)));assert.equal(entry.crc32,slowCRC(files.get(entry.path)));}
  assert.equal(a.manifest.files.length,files.size-1);assert.equal(events.at(-1).phase,'complete');assert.match(decode(files.get('cover.html')),/No creator credit supplied/);assert.doesNotMatch(decode(files.get('cover.html')),/<script|<iframe/i);
});

test('all audio bytes, media, raw record, library and Reach proposals survive without approvals',async()=>{
  const audioOne=randomBytes(1000),audioTwo=randomBytes(65537),image=randomBytes(127),record={content:{id:'legacy-42',source:'https://example.org/source',media:{url:'https://example.org/image.jpg'}},library:[{title:'Older library shape',url:'https://example.org/book'}],museum:{audio:[{title:'Remote voice',url:'https://example.org/voice.mp3',language:'es',durationLabel:'22 min'}]},reaches:[{id:'r1',target:{id:'known',url:'https://example.org/orb'},approved:true}],editions:[{id:'old',url:'https://example.org/old'}]};
  const raw=JSON.stringify(record,null,4)+'\n';
  const result=await buildMuseumPackage({...base(),creatorName:'M. Rivera',orbJSON:new File([raw],'source-record.json',{type:'application/json'}),library:[{title:'Actual library item',url:'https://example.org/item',type:'book'}],audioFiles:[new File([audioOne],'voz-es.mp3',{type:'audio/mpeg'}),{name:'voice-en.wav',data:Promise.resolve(new Uint8Array(audioTwo))}],mediaFiles:[file('canopy.png',image)]});
  const files=await unzip(result.blob);assert.equal(decode(files.get('orb-record.json')),raw);assert.deepEqual(files.get('content/voz-es.mp3'),new Uint8Array(audioOne));assert.deepEqual(files.get('content/voice-en.wav'),new Uint8Array(audioTwo));assert.deepEqual(files.get('content/canopy.png'),new Uint8Array(image));
  assert.equal(result.manifest.bundledAudio.length,2);assert.equal(result.manifest.museum.audio[0].url,record.museum.audio[0].url);assert.ok(result.manifest.museum.library.some(item=>item.title==='Actual library item'));assert.ok(result.manifest.museum.library.some(item=>item.title==='Older library shape'));assert.equal(result.manifest.museum.creator.displayName,'M. Rivera');assert.equal(result.manifest.museum.creator.verified,false);
  assert.equal(result.manifest.reaches[0].approved,true);assert.equal(result.manifest.publicationApproved,false);assert.equal(result.manifest.integrity.identityVerified,false);assert.equal(result.manifest.externalReferences.find(r=>r.url==='https://example.org/voice.mp3').fetched,false);
  assert.match(decode(files.get('README.txt')),/All 2 selected audio file/);
});

test('named contribution adds escaped About text and title without changing the authored files',async()=>{
  const raw='{ "id":"authored", "museum":{"creator":{"displayName":"Original credit"}}, "content":{"readings":[{"id":"point-one","text":"Keep me"}]} }\n';
  const note=' First line\nA <script>alert("note")</script> & a memory. ',expression='<img src=x onerror="boom()">\nQuiet, with pauses.';
  const result=await buildMuseumPackage({...base(),attribution:'named',creatorName:'  María <Maker>  ',creatorNote:note,expression,orbJSON:raw});
  const files=await unzip(result.blob),submission=JSON.parse(decode(files.get('submission.json'))),cover=decode(files.get('cover.html'));
  assert.equal(result.manifest.title,'A remembered forest');
  assert.equal(result.manifest.museum.attribution,'named');assert.equal(result.manifest.museum.creator.displayName,'María <Maker>');
  assert.deepEqual(result.manifest.museum.contribution,{note:note.trim(),expression});assert.deepEqual(submission.museum,result.manifest.museum);
  assert.match(cover,/<h1>A remembered forest — an orb by María &lt;Maker&gt;<\/h1>/);
  assert.match(cover,/<section id="about-this-orb"/);assert.match(cover,/>About this orb<\/h2>/);assert.match(cover,/>Personal note<\/h3>/);assert.match(cover,/>Intended expression and presentation<\/h3>/);
  assert.match(cover,/First line\nA &lt;script&gt;alert\(&quot;note&quot;\)&lt;\/script&gt; &amp; a memory\./);assert.match(cover,/&lt;img src=x onerror=&quot;boom\(\)&quot;&gt;/);assert.doesNotMatch(cover,/<script|<img|<iframe/i);
  assert.match(cover,/white-space:pre-wrap/);assert.match(decode(files.get('README.txt')),/ABOUT THIS ORB\nSigned by María <Maker>/);
  assert.equal(decode(files.get('content/forest.html')),html);assert.equal(decode(files.get('orb-record.json')),raw);
  assert.equal(result.manifest.publicationApproved,false);assert.equal(result.manifest.integrity.identityVerified,false);
});

test('anonymous projection removes stale creator credit while retaining contribution and exact originals',async()=>{
  const raw='{"museum":{"creator":{"displayName":"Embedded Author"},"attribution":"named"},"content":{"text":"Embedded Author wrote this."}}\n';
  const result=await buildMuseumPackage({...base(),attribution:'anonymous',creatorName:'stale-private@example.org',creatorNote:'A personal thought.',expression:'Read slowly.',orbJSON:raw});
  const files=await unzip(result.blob),submission=decode(files.get('submission.json')),cover=decode(files.get('cover.html')),readme=decode(files.get('README.txt'));
  assert.equal(result.manifest.museum.attribution,'anonymous');assert.equal(Object.hasOwn(result.manifest.museum,'creator'),false);
  assert.deepEqual(result.manifest.museum.contribution,{note:'A personal thought.',expression:'Read slowly.'});
  assert.match(cover,/<h1>A remembered forest — an anonymous orb<\/h1>/);assert.match(cover,/A personal thought\./);assert.match(cover,/Read slowly\./);
  for(const generated of [submission,cover,readme,JSON.stringify(result.manifest)])assert.doesNotMatch(generated,/stale-private@example\.org|Embedded Author/);
  assert.match(cover,/does not anonymize the supplied HTML, ORB record or attachments/);assert.ok(result.warnings.some(w=>w.includes('Original content may identify its author.')));
  assert.equal(decode(files.get('orb-record.json')),raw);assert.equal(decode(files.get('content/forest.html')),html);
});

test('legacy omitted attribution uses only a submitted name; empty contributions stay optional',async()=>{
  const unnamed=await buildMuseumPackage({...base(),creatorName:'   ',creatorNote:' \n ',expression:''});
  assert.equal(unnamed.manifest.museum.attribution,'anonymous');assert.equal(unnamed.manifest.museum.creator,undefined);assert.equal(unnamed.manifest.museum.contribution,undefined);
  const named=await buildMuseumPackage({...base(),creatorName:'A. Reader',creatorNote:'Only a note'});
  assert.equal(named.manifest.museum.attribution,'named');assert.equal(named.manifest.museum.creator.displayName,'A. Reader');assert.deepEqual(named.manifest.museum.contribution,{note:'Only a note'});
  const expressionOnly=await buildMuseumPackage({...base(),attribution:'anonymous',expression:'An open reading.'});
  assert.deepEqual(expressionOnly.manifest.museum.contribution,{expression:'An open reading.'});
});

test('attribution and contribution bounds fail clearly without invoking getters',async()=>{
  await assert.rejects(buildMuseumPackage({...base(),attribution:'named',creatorName:'  '}),invalid('DISPLAY_NAME_REQUIRED','creatorName'));
  await assert.rejects(buildMuseumPackage({...base(),attribution:'verified',creatorName:'Someone'}),invalid('INVALID_ATTRIBUTION','attribution'));
  await assert.rejects(buildMuseumPackage({...base(),attribution:null}),invalid('INVALID_ATTRIBUTION','attribution'));
  for(const field of ['creatorNote','expression']){
    const limit=PACKAGE_LIMITS[field];assert.equal(limit,2400);
    const valid=await buildMuseumPackage({...base(),[field]:'a'.repeat(limit)});assert.equal(valid.manifest.museum.contribution[field==='creatorNote'?'note':field].length,limit);
    await assert.rejects(buildMuseumPackage({...base(),[field]:'a'.repeat(limit+1)}),invalid('INVALID_TEXT',field));
    await assert.rejects(buildMuseumPackage({...base(),[field]:{text:'wrong'}}),invalid('INVALID_TEXT',field));
    await assert.rejects(buildMuseumPackage({...base(),[field]:'bad\u0000text'}),invalid('INVALID_TEXT',field));
  }
  let ran=0;for(const field of ['attribution','creatorNote','expression']){
    const input=base();Object.defineProperty(input,field,{get(){ran++;return 'untrusted';}});
    await assert.rejects(buildMuseumPackage(input),invalid('INVALID_INPUT',field));
  }assert.equal(ran,0);
});

test('imported contributor metadata survives omitted inputs while explicit choices clear or replace it',async()=>{
  const record={museum:{attribution:'named',creator:{displayName:'Original contributor',verified:true},contribution:{note:'Original note',expression:'Original expression'}},content:{id:'stable-id',title:'Original title'}};
  const raw=JSON.stringify(record,null,4)+'\n';
  const kept=await buildMuseumPackage({...base(),orbJSON:raw});
  assert.equal(kept.manifest.museum.attribution,'named');assert.equal(kept.manifest.museum.creator.displayName,'Original contributor');assert.equal(kept.manifest.museum.creator.verified,false);
  assert.deepEqual(kept.manifest.museum.contribution,record.museum.contribution);
  const anonymous=await buildMuseumPackage({...base(),orbJSON:raw,attribution:'anonymous'});
  assert.equal(anonymous.manifest.museum.creator,undefined);assert.equal(anonymous.manifest.museum.attribution,'anonymous');assert.deepEqual(anonymous.manifest.museum.contribution,record.museum.contribution);
  assert.equal(decode((await unzip(anonymous.blob)).get('orb-record.json')),raw);
  const cleared=await buildMuseumPackage({...base(),orbJSON:raw,creatorName:'',creatorNote:''});
  assert.equal(cleared.manifest.museum.creator,undefined);assert.equal(cleared.manifest.museum.attribution,'anonymous');assert.deepEqual(cleared.manifest.museum.contribution,{expression:'Original expression'});
  const replaced=await buildMuseumPackage({...base(),orbJSON:raw,creatorName:'New contributor',creatorNote:'New note',expression:''});
  assert.equal(replaced.manifest.museum.creator.displayName,'New contributor');assert.deepEqual(replaced.manifest.museum.contribution,{note:'New note'});
  const staleAnonymous=await buildMuseumPackage({...base(),orbJSON:{museum:{...record.museum,attribution:'anonymous'}}});
  assert.equal(staleAnonymous.manifest.museum.attribution,'anonymous');assert.equal(staleAnonymous.manifest.museum.creator,undefined);
  const legacyCreator=await buildMuseumPackage({...base(),orbJSON:{museum:{creator:{displayName:'Legacy credit'}}}});
  assert.equal(legacyCreator.manifest.museum.attribution,'named');assert.equal(legacyCreator.manifest.museum.creator.displayName,'Legacy credit');
  const unknown=await buildMuseumPackage({...base(),orbJSON:{legacy:true,museum:{legacy:true}}});
  assert.equal(unknown.manifest.museum.creator,undefined);assert.equal(unknown.manifest.museum.contribution,undefined);assert.equal(unknown.manifest.museum.attribution,'anonymous');
  assert.deepEqual(record.museum.contribution,{note:'Original note',expression:'Original expression'});
});

test('plain ORB records with a data field remain records; old metadata omissions are valid',async()=>{
  const record={id:'old',name:'Old format',data:{nodes:[{id:'point1'}]}};
  const result=await buildMuseumPackage({...base(),orbJSON:record});const files=await unzip(result.blob);assert.deepEqual(JSON.parse(decode(files.get('orb-record.json'))),record);assert.deepEqual(record,{id:'old',name:'Old format',data:{nodes:[{id:'point1'}]}});assert.deepEqual(result.manifest.museum.library,[]);
});

test('hostile names, case collisions and creator text are inert and every file survives',async()=>{
  const result=await buildMuseumPackage({...base(),title:'<img src=x onerror=alert(1)>',creatorName:'A <script>alert(1)</script>',description:'<iframe src="https://evil.test">',audioFiles:[file('../voice.mp3','one'),file('voice.mp3','two'),file('VOICE.mp3','three'),file('CON.mp3','four'),file('<img src=x onerror=alert(1)>.mp3','five')]});
  const files=await unzip(result.blob),names=[...files.keys()];assert.equal(result.manifest.bundledAudio.length,5);assert.equal(new Set(names.map(n=>n.toLowerCase())).size,names.length);assert.ok(names.every(n=>!n.split('/').some(p=>p==='..'||p==='.')&&!n.includes('\\')));
  const cover=decode(files.get('cover.html'));assert.doesNotMatch(cover,/<script|<iframe|<img/i);assert.match(cover,/&lt;script&gt;/);assert.ok(result.warnings.some(w=>w.includes('Filename mapped')));assert.equal(decode(files.get('content/voice.mp3')),'two');assert.equal(decode(files.get('content/VOICE-2.mp3')),'three');
});

test('relative references distinguish bundled from missing, external links are never fetched',async()=>{
  const originalFetch=globalThis.fetch;let network=0;globalThis.fetch=()=>{network++;throw new Error('Network forbidden');};
  try{
    const source='<!doctype html><html><body><img src="photo.png"><audio src="missing.mp3"></audio><img src="https://example.org/image.jpg"><a href="javascript:alert(1)">x</a><a href="#point">point</a></body></html>';
    const result=await buildMuseumPackage({...base(),html:file('index.html',source),mediaFiles:[file('photo.png','image')]});assert.equal(network,0);assert.equal(result.manifest.localReferences.find(r=>r.reference==='photo.png').status,'bundled_path');assert.equal(result.manifest.localReferences.find(r=>r.reference==='missing.mp3').status,'not_bundled_or_unresolved');assert.equal(result.manifest.externalReferences[0].url,'https://example.org/image.jpg');assert.equal(result.manifest.externalReferences.length,1);
  }finally{globalThis.fetch=originalFetch;}
});

test('getter/toJSON/cycle metadata is rejected without running code',async()=>{
  let ran=0;const getter={};Object.defineProperty(getter,'title',{enumerable:true,get(){ran++;return 'x';}});
  await assert.rejects(buildMuseumPackage({...base(),orbJSON:getter}),invalid('INVALID_JSON'));
  await assert.rejects(buildMuseumPackage({...base(),library:{toJSON(){ran++;return [];}}}),invalid('INVALID_JSON'));
  const cyclic={};cyclic.self=cyclic;await assert.rejects(buildMuseumPackage({...base(),orbJSON:cyclic}),invalid('INVALID_JSON'));
  const input=base();Object.defineProperty(input,'creatorName',{get(){ran++;return 'name';}});await assert.rejects(buildMuseumPackage(input),invalid('INVALID_INPUT'));
  assert.equal(ran,0);
});

test('size limits reject visibly before reading oversized inputs and do not silently drop audio',async()=>{
  let read=0;const pretend=(name,size)=>({name,size,arrayBuffer(){read++;throw Error('Must not read');}});
  await assert.rejects(buildMuseumPackage({...base(),audioFiles:[pretend('huge.mp3',PACKAGE_LIMITS.fileBytes+1)]}),invalid('FILE_TOO_LARGE','audioFiles[0]'));
  await assert.rejects(buildMuseumPackage({...base(),html:pretend('huge.html',PACKAGE_LIMITS.htmlBytes+1)}),invalid('FILE_TOO_LARGE','html'));
  await assert.rejects(buildMuseumPackage({...base(),audioFiles:[pretend('a.mp3',100*1024*1024),pretend('b.mp3',100*1024*1024),pretend('c.mp3',100*1024*1024)]}),invalid('PACKAGE_TOO_LARGE'));
  assert.equal(read,0);
  await assert.rejects(buildMuseumPackage({...base(),audioFiles:[file('good.mp3','ok'),file('empty.mp3',new Uint8Array())]}),invalid('EMPTY_FILE','audioFiles[1]'));
});

test('extension, invalid JSON, sparse arrays, too many reaches and public email credit fail clearly',async()=>{
  await assert.rejects(buildMuseumPackage({...base(),mediaFiles:[file('run.exe','x')]}),invalid('UNSUPPORTED_FILE'));
  await assert.rejects(buildMuseumPackage({...base(),audioFiles:[file('wrong.png','x')]}),invalid('UNSUPPORTED_FILE'));
  await assert.rejects(buildMuseumPackage({...base(),orbJSON:'{"bad":'}),invalid('INVALID_JSON'));
  await assert.rejects(buildMuseumPackage({...base(),orbJSON:'[]'}),invalid('INVALID_JSON'));
  await assert.rejects(buildMuseumPackage({...base(),reaches:new Array(17).fill({})}),invalid('INVALID_REACHES'));
  await assert.rejects(buildMuseumPackage({...base(),audioFiles:new Array(1)}),invalid('INVALID_INPUT'));
  await assert.rejects(buildMuseumPackage({...base(),creatorName:'person@example.org'}),invalid('DISPLAY_NAME_REQUIRED'));
  await assert.rejects(buildMuseumPackage({...base(),mediaFiles:new Array(256).fill(file('image.png','x'))}),invalid('TOO_MANY_FILES'));
});

test('SHA-256 fallback and CRC match independent implementations at padding boundaries',()=>{
  assert.equal(crc32(encode('123456789')),0xcbf43926);
  for(const size of [0,1,3,55,56,63,64,65,127,128,129,4096,65537]){const bytes=randomBytes(size);assert.equal(sha256Fallback(bytes),hash(bytes),`SHA-256 length ${size}`);assert.equal(crc32(bytes),slowCRC(bytes));}
});

test('async arrayBuffer file adapter and promises are supported, records stay inert',async()=>{
  const bytes=encode(html),adapter={name:'async.html',size:bytes.length,async arrayBuffer(){return bytes.buffer;}};
  const result=await buildMuseumPackage({title:'Async source',html:adapter,audioFiles:[{name:'voice.ogg',data:Promise.resolve(encode('recorded audio'))}]});
  const files=await unzip(result.blob);assert.equal(decode(files.get('content/async.html')),html);assert.equal(decode(files.get('content/voice.ogg')),'recorded audio');
});

test('supporting CSS/JS/MJS dependencies retain exact bytes without being executed',async()=>{
  const js='globalThis.PACKAGE_DEPENDENCY_EXECUTED=true;\n',css='body { color: red; }\r\n',mjs='throw Error("Do not run this");\n';
  const result=await buildMuseumPackage({...base(),mediaFiles:[file('app.js',js),file('theme.css',css)],attachments:[{...file('module.mjs',mjs),kind:'dependency'}]});
  const files=await unzip(result.blob);assert.equal(decode(files.get('content/app.js')),js);assert.equal(decode(files.get('content/theme.css')),css);assert.equal(decode(files.get('content/module.mjs')),mjs);assert.equal(result.manifest.bundledMedia.filter(f=>f.kind==='dependency').length,3);assert.equal(globalThis.PACKAGE_DEPENDENCY_EXECUTED,undefined);assert.ok(result.warnings.some(w=>w.includes('Supporting CSS/JS/MJS')));
});

test('long multibyte title suffixes are bounded without losing the build',async()=>{
  const result=await buildMuseumPackage({...base(),title:'A.'+'山'.repeat(100)});assert.ok(encode(result.filename).length<=195);assert.match(result.filename,/-orb-review\.zip$/);
});

test('manually added library rows combine with imported sources and keep differing editions',async()=>{
  const first={title:'Source',url:'https://example.org/source',type:'book',edition:'first'},second={...first,edition:'second'},extra={title:'New source',url:'https://example.org/new',type:'website'};
  const result=await buildMuseumPackage({...base(),orbJSON:{museum:{library:[first,second]},library:[first]},library:[first,extra]});
  assert.equal(result.manifest.museum.library.length,3);assert.deepEqual(JSON.parse(JSON.stringify(result.manifest.museum.library)),[first,second,extra]);
});

test('caller buffer mutations during asynchronous hashing cannot corrupt package integrity',async()=>{
  const audio=new Uint8Array([1,2,3,4]);
  const result=await buildMuseumPackage({...base(),audioFiles:[file('voice.mp3',audio)]},{onProgress:event=>{if(event.phase==='hashing'&&event.filename==='voice.mp3')queueMicrotask(()=>{audio[0]=99;});}});
  const files=await unzip(result.blob),saved=files.get('content/voice.mp3'),metadata=result.manifest.files.find(f=>f.path==='content/voice.mp3');assert.deepEqual(saved,new Uint8Array([1,2,3,4]));assert.equal(metadata.sha256,hash(saved));assert.equal(audio[0],99);
});

test('reference scanner ignores inline JavaScript, CSS, JSON, comments and textareas',async()=>{
  const source=`<!doctype html><html><head><style>/* href="fake-style.css" */ .example:after{content:'<img src="fake-css.png">'}</style><script type="application/json">{"example":"src=\\"fake-json.png\\""}</script></head><body>
  <!-- <img src="fake-comment.png"> --><textarea><img src="fake-textarea.png"> href="fake-text.txt"</textarea><title><img src="fake-title.png"></title>
  <script>const i={};i.href=F(n.url),i.target="_blank",i.rel="noopener";const example='<audio src="fake-script.mp3"></audio>';globalThis.SCANNER_MUST_NOT_RUN=true;</script>
  <button onclick="location.href='fake-handler.html'" data-src="fake-data.png">Go</button>
  <img src="real.png"><audio src=real.mp3></audio><video poster='real-poster.jpg'></video><script src="real-app.js"></script><link rel="stylesheet" href="real-style.css"><a href="https://example.org/source?a=1&amp;b=2">Source</a>
  </body></html>`;
  const result=await buildMuseumPackage({...base(),html:file('index.html',source),audioFiles:[file('real.mp3','audio')],mediaFiles:[file('real.png','image'),file('real-poster.jpg','image'),file('real-app.js','code'),file('real-style.css','style')],orbJSON:{sources:[{url:'https://example.org/from-record'}]}});
  assert.deepEqual(result.manifest.localReferences.map(ref=>ref.reference).sort(),['real-app.js','real-poster.jpg','real-style.css','real.mp3','real.png']);assert.ok(result.manifest.localReferences.every(ref=>ref.status==='bundled_path'));
  assert.ok(result.manifest.externalReferences.some(ref=>ref.url==='https://example.org/source?a=1&b=2'));assert.ok(result.manifest.externalReferences.some(ref=>ref.url==='https://example.org/from-record'));assert.equal(globalThis.SCANNER_MUST_NOT_RUN,undefined);assert.ok(!result.warnings.some(w=>w.includes('relative HTML reference')));
});

test('tag scanning respects quoted angle brackets, case, duplicate attributes and raw-text endings',async()=>{
  const source=`<!doctype html><HTML><body><img alt="> <img src='fake.png'>" SRC="real.png" src="ignored-duplicate.png"><ScRiPt>const example='<img src="another-fake.png">';</sCrIpT ><audio SRC="voice&#46;mp3"></audio><iframe src="https://example.org/frame"><img src="fallback-only.png"></iframe><!-- href="unfinished-comment.txt"`;
  const result=await buildMuseumPackage({...base(),html:file('index.html',source),audioFiles:[file('voice.mp3','audio')],mediaFiles:[file('real.png','image')]});assert.deepEqual(result.manifest.localReferences.map(ref=>ref.reference),['real.png','voice.mp3']);assert.equal(result.manifest.externalReferences[0].url,'https://example.org/frame');
});
