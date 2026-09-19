import test from 'node:test';
import assert from 'node:assert/strict';
import {createMuseumMediaLoader, wikipediaReference, commonsImage} from '../museum-media-discovery.mjs';
import {extractExhibitMedia, parseJSONAssignment} from '../scripts/build-museum-media-index.mjs';

const image = {query: {pages: {7: {title: 'File:Chapultepec.jpg', imageinfo: [{mime: 'image/jpeg', thumburl: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Chapultepec.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Chapultepec.jpg', extmetadata: {Artist: {value: '<b>A real photographer</b>'}, LicenseShortName: {value: 'CC BY-SA 4.0'}, LicenseUrl: {value: 'https://creativecommons.org/licenses/by-sa/4.0/'}, ImageDescription: {value: 'Chapultepec seen above its trees.'}}}]}}}};
const index = {schemaVersion: 1, orbs: {}};
const record = {content: {title: 'Chapultepec · A Forest of Stories', sources: [{url: 'https://en.wikipedia.org/wiki/Chapultepec'}]}};
const listing = {id: 'test-orb', title: record.content.title};
const indexURL = 'https://orbiversity.com/orb-archive/museum-media-index.json';

test('saved media is available immediately without contacting any external search provider', async () => {
  const calls = [];
  const load = createMuseumMediaLoader({indexURL, storage: null, fetchImpl: async url => {calls.push(url); return Response.json(index);}});
  const result = await load({record: {readingImages: [{src: 'https://example.org/saved.jpg', title: 'Saved photograph'}]}, listing});
  assert.equal(result.status, 'saved'); assert.equal(result.items[0].url, 'https://example.org/saved.jpg');
  assert.deepEqual(calls, [indexURL]);
});

test('exact Wikipedia sources produce credited Commons metadata and cached results without model calls', async () => {
  const calls = [], memory = new Map(), storage = {getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value)};
  const fetchImpl = async (value, options) => {
    const url = new URL(value); calls.push(url.href); assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    if (url.href === indexURL) return Response.json(index);
    assert.equal(url.pathname, '/w/api.php'); assert.equal(url.searchParams.get('origin'), '*');
    assert.equal(url.searchParams.has('gsrsearch'), false);
    if (url.hostname === 'en.wikipedia.org') {assert.equal(url.searchParams.get('titles'), 'Chapultepec'); return Response.json({query: {pages: {1: {ns: 0, title: 'Chapultepec', pageimage: 'Chapultepec.jpg'}}}});}
    assert.equal(url.hostname, 'commons.wikimedia.org'); return Response.json(image);
  };
  const load = createMuseumMediaLoader({indexURL, storage, fetchImpl});
  const first = await load({record, listing}); const again = await load({record, listing});
  assert.equal(first.status, 'ready'); assert.equal(first.items.find(item => item.kind === 'image').credit, 'A real photographer');
  assert.equal(first.items.find(item => item.kind === 'image').provenance, 'discovered-image');
  assert.deepEqual(again, first); assert.equal(calls.length, 3);
  const newLoader = createMuseumMediaLoader({indexURL, storage, fetchImpl}); await newLoader({record, listing}); assert.equal(calls.length, 4);
});

test('uncited title fallback rejects an unrelated or redirected Wikipedia title', async () => {
  let calls = 0;
  const load = createMuseumMediaLoader({indexURL, storage: null, fetchImpl: async url => {calls++; return Response.json(url === indexURL ? index : {query: {pages: {1: {ns: 0, title: 'Unrelated title', pageimage: 'Wrong.jpg'}}}});}});
  const result = await load({listing: {id: 'different', title: 'Exact subject'}});
  assert.equal(result.status, 'no_match'); assert.equal(result.items.length, 0); assert.equal(calls, 2);
});

test('stale selections abort lookup and never return the old image into a new orb', async () => {
  let announce; const started = new Promise(resolve => announce = resolve);
  const load = createMuseumMediaLoader({indexURL, storage: null, fetchImpl: async (url, {signal}) => {
    if (url === indexURL) return Response.json(index);
    announce(); return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once: true}));
  }});
  const selection = new AbortController();
  const old = load({record, listing, signal: selection.signal}); const rejected = assert.rejects(old, error => error.name === 'AbortError'); await started; selection.abort();
  const current = await load({record: {readingImages: [{src: 'https://example.org/new.jpg', title: 'New image'}]}, listing});
  await rejected; assert.equal(current.items[0].url, 'https://example.org/new.jpg');
});

test('null records are safe while an edition is opening', async () => {
  const load = createMuseumMediaLoader({indexURL, storage: null, fetchImpl: async () => Response.json(index)});
  assert.deepEqual(await load({record: null, listing: null}), {items: [], status: 'no_match'});
});

test('HTTP-success provider errors remain unavailable rather than a false no-match result', async () => {
  const load = createMuseumMediaLoader({indexURL, storage: null, fetchImpl: async url => Response.json(url === indexURL ? index : {error: {code: 'ratelimited'}})});
  assert.equal((await load({record, listing})).status, 'unavailable');
});

test('discovery rejects unsafe references, incompatible licenses and excessive responses', async () => {
  for (const url of ['https://en.wikipedia.org.evil.test/wiki/Forest', 'https://localhost/wiki/Forest', 'https://en.wikipedia.org/wiki/File:Forest.jpg', 'https://en.wikipedia.org/wiki/Forest?token=secret', 'https://en.wikipedia.org:1234/wiki/Forest']) assert.equal(wikipediaReference(url), null);
  const restricted = structuredClone(image); restricted.query.pages[7].imageinfo[0].extmetadata.LicenseShortName.value = 'All rights reserved'; assert.equal(commonsImage(restricted), null);
  const hostile = structuredClone(image); hostile.query.pages[7].imageinfo[0].thumburl = 'https://example.org/proxy.jpg'; assert.equal(commonsImage(hostile), null);
  const load = createMuseumMediaLoader({indexURL, storage: null, fetchImpl: async url => url === indexURL ? Response.json(index) : new Response(' '.repeat(1024 * 1024 + 1))});
  assert.equal((await load({record, listing})).status, 'unavailable');
});

test('legacy index parses JSON without executing JS and retains saved source credits and video URLs', () => {
  globalThis.__museumExecuted = false;
  const value = parseJSONAssignment('window.DATA={"title":"Literal","x":"} not the end"}; globalThis.__museumExecuted=true;');
  assert.equal(value.title, 'Literal'); assert.equal(globalThis.__museumExecuted, false);
  assert.equal(parseJSONAssignment('window.DATA=runSomething();'), null);
  const html = '<script id="point-media-data" type="application/json">' + JSON.stringify({point: '<figure><img src="photo.jpg" alt="The real scene"><figcaption>Caption <span class="media-credit">Original photographer · <a href="credits.html">Source</a></span></figcaption></figure>'}) + '</script><script>globalThis.__museumExecuted=true;</script>';
  const saved = extractExhibitMedia(html, 'https://orbiversity.com/exhibit/', {title: 'Exhibit'});
  assert.equal(saved.readingImages.length, 1); assert.equal(saved.readingImages[0].credit, 'Original photographer');
  assert.equal(saved.readingImages[0].src, 'https://orbiversity.com/exhibit/photo.jpg'); assert.equal(saved.readingImages[0].source, 'https://orbiversity.com/exhibit/credits.html');
  const videos = extractExhibitMedia('window.ORB_VIDEOS=[{"url":"https://www.youtube.com/watch?v=abcdefghijk","title":{"en":"A real film"},"point":"p1"}];', 'https://orbiversity.com/exhibit/videos.js', {title: 'Exhibit'}, {javascript: true});
  assert.equal(videos.presentation.media[0].title, 'A real film'); assert.equal(globalThis.__museumExecuted, false);
});
