// Index existing, public exhibit media without executing any exhibit JavaScript.
// This is a maintainer build step, never a visitor-controlled proxy.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {publicURL} from '../museum-publications.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ownedHosts = new Set(['orbiversity.com', 'www.orbiversity.com', 'visualizationcreation.github.io']);
const extras = {
  quinault: ['data.js', 'forest-sample.html'],
  'south-sound-salmon-watching-guide': ['data.js'],
  'dia-de-muertos': ['photos.js', 'videos.js'],
  'autumn-in-two-orbits': ['orb-data.js', 'film-data.js'],
};
const text = value => typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(?:39|x27);/g, "'").replace(/\s+/g, ' ').trim() : '';
const localized = value => text(typeof value === 'string' ? value : value?.en || value?.es);
const attr = (tag, key) => text(tag.match(new RegExp('(?:^|\\s)' + key + '\\s*=\\s*(["\'])(.*?)\\1', 'is'))?.[2]);
const absolute = (value, base) => {if (typeof value !== 'string' || !value || /^(?:data|blob|javascript):/i.test(value)) return null; try {return publicURL(new URL(value, base).href);} catch {return null;}};

export function parseJSONAssignment(source) {
  // Only the JSON literal is decoded. No eval, VM, dynamic import or script execution.
  const start = source.match(/^\s*window\.[A-Z_]+\s*=\s*/)?.[0].length;
  if (!start || !['{', '['].includes(source[start])) return null;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {if (escaped) escaped = false; else if (ch === '\\') escaped = true; else if (ch === '"') quoted = false; continue;}
    if (ch === '"') quoted = true;
    else if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {if (--depth === 0) {try {return JSON.parse(source.slice(start, i + 1));} catch {return null;}}}
  }
  return null;
}

export function extractExhibitMedia(source, base, listing, {javascript = false} = {}) {
  const images = [], media = [], audio = [], sourceURLs = new Set();
  function image(value, node = null, fallbackTitle = listing.title) {
    const src = absolute(value.file || value.image || value.src || value.url, base); if (!src || !/\.(?:jpe?g|png|webp|gif|avif|svg)(?:$|\?)/i.test(src)) return;
    const source = absolute(value.sourceUrl || value.source || base, base), credit = localized(value.credit || value.creator || value.photographer);
    images.push({node, src, title: localized(value.caption) || localized(value.title) || localized(value.alt) || fallbackTitle, source, ...(credit ? {credit} : {}), ...(value.license || value.rights ? {license: text(value.license || value.rights)} : {}), ...(absolute(value.licenseURL || value.licenseUrl, base) ? {licenseURL: absolute(value.licenseURL || value.licenseUrl, base)} : {}), ...(/AI-generated|generated.*illustration|locally generated|imagined.*handset/i.test([value.provenance, value.credit, value.caption, value.alt].join(' ')) ? {generated: true} : {})});
  }
  function attached(kind, value, node = null) {
    const url = absolute(value.url || value.file || value.audio, base); if (!url) return;
    const title = localized(value.title) || listing.title;
    if (kind === 'audio') audio.push({url, title, ...(node ? {node} : {}), ...(value.language ? {language: value.language} : {}), ...(Number.isFinite(value.durationSeconds || value.duration) ? {durationSeconds: value.durationSeconds || value.duration} : {}), ...(value.credit ? {credit: text(value.credit)} : {}), ...(value.license ? {license: text(value.license)} : {}), ...(absolute(value.sourceUrl, base) ? {source: absolute(value.sourceUrl, base)} : {}), ...(absolute(value.licenseUrl, base) ? {licenseURL: absolute(value.licenseUrl, base)} : {})});
    else media.push({id: 'saved-' + media.length, node, kind, url, title, caption: localized(value.caption || value.description), ...(value.publisher ? {credit: text(value.publisher)} : {})});
  }
  function htmlImages(html, node = null) {
    const safe = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    for (const match of safe.matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/gi)) {
      const figure = match[1], img = figure.match(/<img\b[^>]*>/i)?.[0]; if (!img) continue;
      const caption = figure.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] || '';
      const credit = caption.match(/<span\b[^>]*class=["'][^"']*media-credit[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1];
      const sourceLink = [...caption.matchAll(/<a\b[^>]*>/gi)].map(m => attr(m[0], 'href')).find(Boolean);
      image({src: attr(img, 'src'), title: attr(img, 'alt'), source: sourceLink || base, credit: credit ? text(credit).replace(/Source.*$/i, '').replace(/[·\s]+$/, '') : undefined, caption: text(caption), alt: attr(img, 'alt')}, node);
    }
    for (const match of safe.matchAll(/<img\b[^>]*>/gi)) {const src = absolute(attr(match[0], 'src'), base); if (src && !images.some(item => item.src === src)) image({src, title: attr(match[0], 'alt'), source: base}, node);}
    for (const match of safe.matchAll(/<(video|audio)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const src = attr(match[0].slice(0, match[0].indexOf('>') + 1), 'src') || attr(match[2].match(/<source\b[^>]*>/i)?.[0] || '', 'src');
      if (src) attached(match[1], {url: src, title: attr(match[0], 'aria-label') || listing.title}, node);
    }
    for (const match of safe.matchAll(/<a\b[^>]*>/gi)) {const url = absolute(attr(match[0], 'href'), base); if (url && /\.wikipedia\.org\//.test(url)) sourceURLs.add(url);}
  }
  function data(value, key = '') {
    if (!value || typeof value !== 'object') return;
    if (key === 'point-media-data') {for (const [node, fragment] of Object.entries(value)) if (typeof fragment === 'string') htmlImages(fragment, node); return;}
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item?.file && item?.source && item?.license) for (const node of item.pointIds?.length ? item.pointIds : [null]) image(item, node);
        else if (item?.url && /youtube\.com\/watch|youtu\.be\//.test(item.url)) attached('video', item, item.point || null);
      }
      return;
    }
    for (const item of Object.values(value.sources || {})) {const url = absolute(item?.url, base); if (url) sourceURLs.add(url);}
    for (const [name, item] of Object.entries(value.media || {})) if (item?.file) image(item, item.pointId || name);
    for (const point of [...(Array.isArray(value.points) ? value.points : []), ...(Array.isArray(value.poems) ? value.poems : [])]) {
      if (point.photo) image({...point.photo, caption: point.photo.caption || point.imageTitle || point.alt}, point.id);
      if (point.audio) attached('audio', {url: point.audio, title: point.title, duration: point.duration}, point.id);
    }
    if (value.music?.file) attached('audio', {...value.music, credit: [value.music.composer, value.music.performer].filter(Boolean).join(' · ')});
    for (const film of value.films?.languages || []) if (/^[a-zA-Z0-9_-]{11}$/.test(film.youtubeId || '')) attached('video', {url: 'https://www.youtube.com/watch?v=' + film.youtubeId, title: listing.title + ' · ' + film.language.toUpperCase(), caption: value.films.description});
  }
  if (javascript) data(parseJSONAssignment(source));
  else {
    for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) if (/type\s*=\s*["']application\/json["']/i.test(match[1])) try {data(JSON.parse(match[2]), attr(match[1], 'id'));} catch {}
    htmlImages(source);
  }
  return {readingImages: images, presentation: {version: 1, media}, museum: {audio}, sourceURLs: [...sourceURLs]};
}

async function getOwned(url, maximum = 32 * 1024 * 1024) {
  for (let redirects = 0; redirects < 4; redirects++) {
    if (!publicURL(url) || !ownedHosts.has(new URL(url).hostname)) throw Error('Only owned public exhibit pages can be indexed.');
    const response = await fetch(url, {redirect: 'manual', signal: AbortSignal.timeout(15000), credentials: 'omit'});
    if ([301, 302, 307, 308].includes(response.status)) {url = new URL(response.headers.get('location'), url).href; continue;}
    if (!response.ok || Number(response.headers.get('content-length')) > maximum) throw Error('Exhibit source could not be read: ' + response.status);
    const reader = response.body.getReader(), chunks = []; let size = 0;
    try {for (;;) {const {done, value} = await reader.read(); if (done) break; size += value.length; if (size > maximum) {await reader.cancel(); throw Error('Exhibit source exceeds bounds.');} chunks.push(value);}} finally {reader.releaseLock();}
    return {url, text: Buffer.concat(chunks).toString('utf8')};
  }
  throw Error('Too many exhibit redirects.');
}

export async function buildMuseumMediaIndex() {
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'orbs.json'), 'utf8')), result = {schemaVersion: 1, generatedAt: new Date().toISOString(), orbs: {}}, diagnostics = [];
  for (const listing of catalog.orbs) {
    const page = await getOwned(listing.url), parts = [extractExhibitMedia(page.text, page.url, listing)];
    for (const filename of extras[listing.id] || []) {
      try {const source = await getOwned(new URL(filename, page.url).href, filename.endsWith('.html') ? 32 * 1024 * 1024 : 2 * 1024 * 1024); parts.push(extractExhibitMedia(source.text, source.url, listing, {javascript: filename.endsWith('.js')}));}
      catch (error) {diagnostics.push({id: listing.id, file: filename, issue: error.message});}
    }
    const unique = (values, key) => {const seen = new Set(); return values.filter(value => {const k = key(value); if (seen.has(k)) return false; seen.add(k); return true;});};
    const readingImages = unique(parts.flatMap(part => part.readingImages), image => image.src + '|' + image.node);
    // This oldest exhibit updates its initial caption from app.js. Preserve the
    // actual runtime attribution verified there, rather than its stale HTML.
    if (listing.id === 'quinault') for (const image of readingImages) if (new URL(image.src).pathname.endsWith('/lake-quinault.jpg')) Object.assign(image, {
      title: 'Lake Quinault, south shore', credit: 'Olympic National Park', license: 'Public domain',
      licenseURL: 'https://creativecommons.org/publicdomain/mark/1.0/',
      source: 'https://commons.wikimedia.org/wiki/File:Lake_Quinault_South_Shore_1-27-11_ONP_photo_(3)_(17126356720).jpg',
    });
    // Structured metadata takes precedence over a bare HTML image reference.
    const metadataScore = image => Number(!!image.credit) + Number(!!image.license) + Number(!!image.licenseURL);
    readingImages.sort((a, b) => metadataScore(b) - metadataScore(a));
    const media = unique(parts.flatMap(part => part.presentation.media), item => item.url).map((item, i) => ({...item, id: 'saved-' + i}));
    const audio = unique(parts.flatMap(part => part.museum.audio), item => item.url);
    result.orbs[listing.id] = {readingImages, presentation: {version: 1, media}, museum: {audio}, sourceURLs: [...new Set(parts.flatMap(part => part.sourceURLs))], originalURL: page.url};
    console.log(JSON.stringify({id: listing.id, images: readingImages.length, videos: media.length, recordings: audio.length}));
  }
  // Preserve owner-reviewed point images, including immutable public editions
  // that are supplied by the live feed rather than the static catalog.
  try {
    const reviewed=JSON.parse(await fs.readFile(path.join(root,'museum-point-media.json'),'utf8'));
    if(reviewed.schemaVersion===1&&reviewed.orbs&&typeof reviewed.orbs==='object')Object.assign(result.orbs,reviewed.orbs);
  } catch(error) {if(error.code!=='ENOENT')throw error;}
  await fs.writeFile(path.join(root, 'museum-media-index.json'), JSON.stringify(result, null, 2) + '\n');
  if (diagnostics.length) console.log(JSON.stringify({diagnostics}));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await buildMuseumMediaIndex();
