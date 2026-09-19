import test from 'node:test';
import assert from 'node:assert/strict';
import {collectMuseumMedia,applyPointImageReplacements} from './museum-media-model.mjs';
import {createMuseumMediaLoader} from './museum-media-discovery.mjs';
const old='https://example.org/old.jpg',fresh='https://example.org/new.jpg';
const record={content:{readings:[{id:'p1'},{id:'p2'}]},readingImages:[{src:old,node:'p1'}]};
const saved={readingImages:[{src:fresh,node:'p1'}],imageReplacements:[{node:'p1',from:old,to:fresh}]};
test('display correction replaces an exact point image while retaining signed content',async()=>{
 const before=JSON.stringify(record),loader=createMuseumMediaLoader({storage:null,indexURL:'https://example.org/index.json',fetchImpl:async()=>Response.json({schemaVersion:1,orbs:{fixture:saved}})});
 const result=await loader({record,listing:{id:'fixture'}});
 assert.deepEqual(result.items.filter(i=>i.kind==='image').map(i=>i.url),[fresh]);assert.equal(JSON.stringify(record),before);
});
test('missing or mismatched replacements cannot hide an existing image',()=>{
 const items=collectMuseumMedia(record);
 for(const change of [{node:'p1',from:old,to:fresh},{node:'p2',from:old,to:fresh},{node:'p1',from:old,to:'javascript:bad'}])assert.deepEqual(applyPointImageReplacements(items,[change]),items);
});
test('correction preserves an image still assigned to another point and non-image media',()=>{
 const items=collectMuseumMedia({...record,readingImages:[{src:old,nodes:['p1','p2']},{src:fresh,node:'p1'}],presentation:{media:[{kind:'audio',url:'https://example.org/audio.mp3',node:'p1'}]}});
 const result=applyPointImageReplacements(items,saved.imageReplacements);
 assert.deepEqual(result.find(i=>i.url===old).nodes,['p2']);assert.equal(result.filter(i=>i.kind==='audio').length,1);
});
