import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {collectMuseumMedia,museumMediaAccess} from '../museum-media-model.mjs';

const youtube='https://www.youtube.com/watch?v=xGZt80vYokI';
const readings=[{id:'water',label:'Water'},{id:'trees',label:'Trees'},{label:'Sky'}];
const photo={node:'water',src:'https://upload.wikimedia.org/wikipedia/commons/a/a1/forest.jpg',title:'A forest',credit:'Photographer',license:'CC BY 4.0',licenseURL:'https://creativecommons.org/licenses/by/4.0/',source:'https://commons.wikimedia.org/wiki/File:forest.jpg'};

test('saved point photos retain every attribution field without changing the record',()=>{
 const record={content:{readings},readingImages:[photo,{...photo,node:'trees',generated:true}]},before=structuredClone(record),items=collectMuseumMedia(record);
 assert.equal(items.length,1);const item=items[0];assert.equal(item.kind,'image');assert.equal(item.access,'direct');assert.deepEqual(item.nodes,['water','trees']);assert.equal(item.node,'water');assert.equal(item.credit,photo.credit);assert.equal(item.licenseURL,photo.licenseURL);assert.equal(item.source,photo.source);assert.equal(item.generated,true);assert.equal(item.provenance,'saved-image');assert.deepEqual(record,before);
});
test('YouTube variants dedupe with source reading associations and approved embed metadata',()=>{
 const record={content:{readings,sources:[{title:'River film',publisher:'Park service',url:youtube+'&t=9',readings:[1,0,2,-1,9,'1']}]},presentation:{media:[{kind:'video',url:'https://youtu.be/xGZt80vYokI?si=tracking',node:'water',title:'River film',caption:'Saved caption'}]}};
 const [item]=collectMuseumMedia(record);assert.equal(collectMuseumMedia(record).length,1);assert.equal(item.url,youtube);assert.equal(item.kind,'video');assert.equal(item.access,'embed');assert.equal(item.provider,'YouTube');assert.match(item.embed,/^https:\/\/www.youtube-nocookie.com\/embed\/xGZt80vYokI\?playsinline=1$/);assert.equal(item.poster,'https://i.ytimg.com/vi/xGZt80vYokI/hqdefault.jpg');assert.deepEqual(item.nodes,['water','trees','2']);assert.deepEqual(item.provenances,['attached-media','source']);assert.equal(item.caption,'Saved caption');
 for(const url of ['https://m.youtube.com/shorts/xGZt80vYokI','https://www.youtube-nocookie.com/embed/xGZt80vYokI'])assert.equal(museumMediaAccess(url).url,youtube);
});
test('known provider canonicalization never accepts spoofed iframe hosts or IDs',()=>{
 const vimeo=collectMuseumMedia({presentation:{media:[{kind:'video',url:'https://vimeo.com/12345678?utm_source=a'},{kind:'video',url:'https://player.vimeo.com/video/12345678'}]}});assert.equal(vimeo.length,1);assert.equal(vimeo[0].embed,'https://player.vimeo.com/video/12345678');assert.equal(vimeo[0].poster,null);
 for(const url of ['https://youtube.com.evil.example/watch?v=xGZt80vYokI','https://evil.example/embed/xGZt80vYokI','https://www.youtube.com/watch?v=bad','https://www.youtube.com/embed/xGZt80vYokI/anything','https://youtu.be/xGZt80vYokI/anything']){const access=museumMediaAccess(url,{kind:'video'});assert.equal(access.embed,null);assert.equal(access.access,'external');}
});
test('direct file types and saved public asset endpoints use native players, pages stay external',()=>{
 for(const [url,kind] of [['https://example.com/image.avif','image'],['https://example.com/movie.mp4','video'],['https://example.com/voice.opus','audio']]){const item=museumMediaAccess(url);assert.equal(item.kind,kind);assert.equal(item.access,'direct');}
 const endpoint='https://orb-astra--star-navigator-informational-dimensions.netlify.app/api/museum-asset?id='+'a'.repeat(64);assert.equal(museumMediaAccess(endpoint,{kind:'audio'}).access,'direct');
 assert.equal(museumMediaAccess('https://example.com/journey.html',{kind:'audio'}).access,'external');assert.equal(museumMediaAccess('https://example.com/movie.mp4',{kind:'audio'}).kind,'audio');
 const [item]=collectMuseumMedia({presentation:{media:[{kind:'video',url:'https://example.com/film.html',embed:'https://evil.example/',poster:'https://evil.example/poster.jpg'}]}});assert.equal(item.embed,null);assert.equal(item.poster,null);
});
test('provider pages ending in image or video extensions are never mistaken for direct files',()=>{
 for(const url of ['https://commons.wikimedia.org/wiki/File:Forest.jpg','https://en.wikipedia.org/wiki/File:Forest.svg','https://archive.org/details/a-film.mp4','https://unsplash.com/photos/forest.jpg']){
  assert.equal(museumMediaAccess(url,{kind:'image'}).access,'external');assert.equal(museumMediaAccess(url,{kind:'image',savedImage:true}).access,'external');
 }
 assert.equal(museumMediaAccess('https://upload.wikimedia.org/wikipedia/commons/a/aa/Forest.jpg').access,'direct');
});
test('private, local, data, executable and malformed links are dropped from every URL field',()=>{
 const bad=['javascript:alert(1)','data:image/png;base64,AA','blob:https://example.com/a','http://example.com/a.mp3','https://127.0.0.1/a.jpg','https://[::1]/','https://private.local/a.mp4','https://user:pass@example.com/a.mp3','https://example.com/a.mp4?token=secret','https://example.com/a.jpg#access_token=secret','https://example.com/a\n.mp3'];
 for(const url of bad){assert.equal(museumMediaAccess(url),null,url);assert.deepEqual(collectMuseumMedia({readingImages:[{src:url}],presentation:{media:[{kind:'audio',url}]},museum:{library:[{url}],audio:[{url}]},content:{sources:[{url}]}}),[]);}
 const [item]=collectMuseumMedia({readingImages:[{...photo,source:bad[0],licenseURL:bad[8]}]});assert.equal(item.source,null);assert.equal(item.licenseURL,null);
});
test('museum audio dedupes attached audio and preserves recording metadata',()=>{
 const url='https://example.com/read.mp3',items=collectMuseumMedia({presentation:{media:[{kind:'audio',url,node:'trees',title:'Reading'}]},museum:{audio:[{title:'Reading',url,language:'es',durationLabel:'2:15',durationSeconds:135}]}});
 assert.equal(items.length,1);assert.equal(items[0].kind,'audio');assert.equal(items[0].language,'es');assert.equal(items[0].durationSeconds,135);assert.deepEqual(items[0].nodes,['trees']);assert.deepEqual(items[0].provenances,['attached-media','saved-audio']);
});
test('known external media providers dedupe tracking variants without inventing native files',()=>{
 const items=collectMuseumMedia({museum:{library:[{title:'Episode',url:'https://open.spotify.com/intl-es/episode/Ab123?si=a'},{title:'Same episode',url:'https://open.spotify.com/episode/Ab123?si=b'},{title:'Film',url:'https://www.facebook.com/reel/1611318427287347'},{title:'Same film',url:'https://www.facebook.com/watch/?v=1611318427287347'}]}});
 assert.equal(items.length,2);assert.equal(items[0].kind,'audio');assert.equal(items[0].access,'external');assert.equal(items[1].kind,'video');assert.equal(items[1].access,'external');assert.ok(items.every(item=>item.embed===null));
});
test('source associations use reading indices, never neighboring-point positions',()=>{
 const items=collectMuseumMedia({content:{readings,neighbors:[{id:'neighbor-not-a-reading'}],sources:[{title:'Study',url:'https://example.com/study',readings:[2,8,'0']}]}});assert.deepEqual(items[0].nodes,['2']);assert.equal(items[0].kind,'source');
});
test('world image reading keys resolve only when the saved label matches and topics stay separate',()=>{
 const items=collectMuseumMedia({content:{readings},worldImages:{'reading:1:Trees':{...photo,node:undefined},'topic:Canopy':{src:'https://example.com/canopy.jpg',node:'world-topic-0'},'reading:0:Wrong title':{src:'https://example.com/stale.jpg'}}});
 assert.deepEqual(items[0].nodes,['trees']);assert.deepEqual(items[1].nodes,['world-topic-0']);assert.deepEqual(items[2].nodes,[]);
});
test('static listing films and ready journeys preserve page links without claiming playable files',()=>{
 const listing={title:'Forest',url:'https://example.com/edition/',filmStudy:{title:'Forest film',url:'https://example.com/film.html',durationSeconds:68},videoUrl:youtube,availableJourneys:[{name:'Recorded journey',narrationReady:true,durationSeconds:120},{name:'Not recorded',url:'https://example.com/missing.mp3',narrationReady:false}]};
 const items=collectMuseumMedia(null,{listing});assert.equal(items.length,3);assert.equal(items.find(i=>i.title==='Forest film').access,'external');const journey=items.find(i=>i.title==='Recorded journey');assert.equal(journey.url,listing.url);assert.equal(journey.kind,'audio');assert.equal(journey.access,'external');assert.ok(!items.some(i=>i.title==='Not recorded'));
});
test('discovery and a record-shaped static index retain distinct provenance and safe metadata',()=>{
 const items=collectMuseumMedia({readingImages:[{...photo,discovered:true}]},{listing:{savedMedia:{readingImages:[{src:'https://example.com/indexed.jpg',title:'Archived photo'}],museum:{audio:[{title:'Recorded',url:'https://example.com/saved.mp3'}]}}}});
 assert.deepEqual(items.map(i=>i.provenance),['discovered-image','indexed-saved-image','indexed-saved-audio']);assert.ok(items.every(i=>i.generated===false));
});
test('only an explicit same-directory owned mirror mapping merges indexed and listing asset URLs',()=>{
 const original='https://visualizationcreation.github.io/forest/',mirror='https://orbiversity.com/forest/',audio={title:'Recording',url:original+'voice.mp3?v=2'},savedMedia={originalURL:mirror,museum:{audio:[{title:'Recording',url:mirror+'voice.mp3?v=2'}]}},listing={url:original,museum:{audio:[audio]},savedMedia};
 const [item]=collectMuseumMedia(null,{listing});assert.equal(collectMuseumMedia(null,{listing}).length,1);assert.equal(item.url,mirror+'voice.mp3?v=2');assert.deepEqual(item.provenances,['indexed-saved-audio','listing-audio']);
 for(const changed of [{...listing,savedMedia:{...savedMedia,originalURL:'https://evil.example/forest/'}},{...listing,savedMedia:{...savedMedia,originalURL:'https://orbiversity.com/different/'}},{...listing,url:'https://someone-else.github.io/forest/'}])assert.equal(collectMuseumMedia(null,{listing:changed}).length,2);
 const versions=collectMuseumMedia(null,{listing:{...listing,museum:{audio:[{...audio,url:original+'voice.mp3?v=1'}]}}});assert.equal(versions.length,2,'Distinct media revisions retain distinct URLs');
});
test('the static catalog exposes real saved recordings and films without generated placeholders',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../orbs.json',import.meta.url),'utf8')).orbs;
 const quinault=collectMuseumMedia(null,{listing:catalog.find(o=>o.id==='quinault')});assert.equal(quinault.filter(i=>i.kind==='audio'&&i.access==='direct').length,9);assert.ok(quinault.some(i=>i.kind==='video'&&i.url.endsWith('/forest-sample.html')&&i.access==='external'));
 const crystal=collectMuseumMedia(null,{listing:catalog.find(o=>o.id==='crystal-ball-orb')});assert.equal(crystal.filter(i=>i.kind==='audio').length,0);
});
test('untrusted titles and captions remain plain text and oversized inputs are bounded',()=>{
 const title='<img src=x onerror=alert(1)>',record={presentation:{media:[{kind:'video',url:youtube,title,caption:'<script>bad()</script>'}]}},[item]=collectMuseumMedia(record);assert.equal(item.title,title);assert.equal(item.caption,record.presentation.media[0].caption);assert.equal(item.html,undefined);assert.equal(item.srcdoc,undefined);
 assert.equal(collectMuseumMedia({museum:{audio:Array.from({length:3000},(_,i)=>({title:'Clip',url:`https://example.com/${i}.mp3`}))}}).length,2048);
});
