/**
 * Offline Museum review packages. No network, DOM, HTML evaluation or upload.
 *
 * await buildMuseumPackage({ title, description?, creatorName?, html,
 *   orbJSON?, library?, reaches?, audioFiles?: [], mediaFiles?: [], attachments?: []
 * }, { onProgress? }) -> { blob, filename, manifest, warnings }
 *
 * html/files: File, Blob, or {name, data, kind?, type?}; data may be a Blob,
 * Uint8Array, ArrayBuffer, Promise of those, or an object with arrayBuffer().
 * orbJSON: File/Blob, JSON text, plain JSON record, or {name,data} file descriptor.
 * onProgress receives {phase,completed,total,filename?}. No download is triggered.
 * Errors have code + field. All supplied files are included or the build rejects.
 * Imported records remain unchanged. Submission metadata and Reach proposals stay
 * separate. File hashes verify bytes, never authorship, safety or factual claims.
 * A review ZIP is not a promise that remote or unselected dependencies work offline.
 */

const MiB = 1024 * 1024;
export const PACKAGE_LIMITS = Object.freeze({
  htmlBytes: 32 * MiB, jsonBytes: 8 * MiB, fileBytes: 128 * MiB,
  totalBytes: 256 * MiB, files: 256, title: 180, description: 4000,
  creatorName: 120, jsonDepth: 32, jsonNodes: 250000, references: 20000,
});
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', {fatal: true});
const EXTENSIONS = Object.freeze({
  html: new Set(['html', 'htm']),
  audio: new Set(['mp3', 'm4a', 'm4b', 'mp4', 'wav', 'wave', 'ogg', 'oga', 'opus', 'flac', 'aac', 'aiff', 'aif', 'weba', 'webm']),
  image: new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'tif', 'tiff', 'ico', 'svg']),
  document: new Set(['json', 'txt', 'md', 'csv', 'pdf', 'orb']),
  dependency: new Set(['css', 'js', 'mjs']),
});
export class MuseumPackageError extends Error {
  constructor(code, message, field = 'input') { super(message); this.name = 'MuseumPackageError'; this.code = code; this.field = field; }
}
const fail = (code, message, field) => { throw new MuseumPackageError(code, message, field); };
function own(object, key, fallback) {
  const d = Object.getOwnPropertyDescriptor(object, key);
  if (!d) return fallback;
  if (!Object.hasOwn(d, 'value')) fail('INVALID_INPUT', 'Input fields must not use getters or setters.', key);
  return d.value;
}
function text(value, name, max, required = false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail('INVALID_TEXT', `Use plain text of at most ${max} characters for ${name}.`, name);
  const result = value.trim();
  if (required && !result) fail('REQUIRED', `${name} is required.`, name);
  return result;
}
function plainJSON(input, field, max = PACKAGE_LIMITS.jsonBytes) {
  let bytes = 0, nodes = 0;
  const active = new Set();
  const charge = n => { bytes += n; if (bytes > max) fail('JSON_TOO_LARGE', `JSON exceeds the ${max / MiB} MiB limit.`, field); };
  function visit(value, depth) {
    if (++nodes > PACKAGE_LIMITS.jsonNodes || depth > PACKAGE_LIMITS.jsonDepth) fail('JSON_TOO_COMPLEX', 'JSON is too deeply nested or contains too many values.', field);
    if (value === null || typeof value === 'boolean') { charge(5); return value; }
    if (typeof value === 'number') { if (!Number.isFinite(value)) fail('INVALID_JSON', 'JSON numbers must be finite.', field); charge(24); return value; }
    if (typeof value === 'string') { if (value.length > max) fail('JSON_TOO_LARGE', 'JSON text exceeds its limit.', field); charge(encoder.encode(JSON.stringify(value)).length); return value; }
    if (typeof value !== 'object' || active.has(value)) fail('INVALID_JSON', 'Use JSON data without functions or cycles.', field);
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    if (!array && proto !== Object.prototype && proto !== null) fail('INVALID_JSON', 'Use plain JSON objects.', field);
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== 'string')) fail('INVALID_JSON', 'JSON cannot contain symbol fields.', field);
    if (array && (value.length > PACKAGE_LIMITS.jsonNodes || keys.length !== value.length + 1 || keys.some(key => key !== 'length' && (!/^(0|[1-9]\d*)$/.test(key) || +key >= value.length)))) fail('INVALID_JSON', 'Use dense JSON arrays without extra fields.', field);
    active.add(value); charge(2);
    const result = array ? [] : Object.create(null);
    for (const key of keys.sort()) {
      if (array && key === 'length') continue;
      const d = descriptors[key];
      if (!Object.hasOwn(d, 'value') || !d.enumerable) fail('INVALID_JSON', 'JSON cannot contain getters, setters or hidden fields.', field);
      charge(encoder.encode(JSON.stringify(key)).length + 2);
      result[key] = visit(d.value, depth + 1);
    }
    active.delete(value); return result;
  }
  return visit(input, 0);
}
function stableJSON(value) { return JSON.stringify(value, null, 2) + '\n'; }
function jsonBytes(value) { return encoder.encode(stableJSON(value)); }
function parseJSON(bytes, field) {
  if (bytes.byteLength > PACKAGE_LIMITS.jsonBytes) fail('JSON_TOO_LARGE', 'ORB JSON exceeds 8 MiB.', field);
  let value;
  try { value = JSON.parse(decoder.decode(bytes).replace(/^\uFEFF/, '')); }
  catch { fail('INVALID_JSON', 'The ORB record must contain valid UTF-8 JSON.', field); }
  return plainJSON(value, field);
}
function isBlob(value) { return typeof Blob !== 'undefined' && value instanceof Blob; }
function bytesView(value, field) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  fail('INVALID_FILE', 'File data must provide a Blob, Uint8Array or ArrayBuffer.', field);
}
function fileInput(input, field, fallback, forcedKind) {
  let name, data = input, type = '', kind = forcedKind, declaredSize;
  if (isBlob(input)) { name = typeof input.name === 'string' ? input.name : fallback; type = input.type; declaredSize = input.size; }
  else if (input && typeof input === 'object' && !(input instanceof ArrayBuffer) && !(input instanceof Uint8Array)) {
    name = own(input, 'name', fallback); type = own(input, 'type', ''); kind = forcedKind || own(input, 'kind', undefined);
    data = own(input, 'data', input); declaredSize = own(input, 'size');
  } else name = fallback;
  if (typeof name !== 'string' || !name || name.length > 1024) fail('INVALID_FILENAME', 'Each selected file needs a filename of at most 1024 characters.', field);
  const extension = name.toLowerCase().split('.').pop();
  if (!kind) kind = Object.keys(EXTENSIONS).find(k => k !== 'html' && EXTENSIONS[k].has(extension));
  if (!EXTENSIONS[kind]?.has(extension)) fail('UNSUPPORTED_FILE', `Unsupported ${kind || 'attachment'} file: ${name}. Select an audio, image, supported document or CSS/JS/MJS dependency file.`, field);
  if (isBlob(data)) declaredSize = data.size;
  if (data instanceof ArrayBuffer || data instanceof Uint8Array) declaredSize = data.byteLength;
  if (declaredSize !== undefined && (!Number.isSafeInteger(declaredSize) || declaredSize < 0)) fail('INVALID_FILE', 'File size must be a nonnegative integer.', field);
  if (declaredSize > PACKAGE_LIMITS.fileBytes) fail('FILE_TOO_LARGE', `${name} exceeds the 128 MiB file limit.`, field);
  return {name, data, declaredSize, type: typeof type === 'string' ? type.slice(0,120) : '', kind, field};
}
async function readFileBytes(file, max = PACKAGE_LIMITS.fileBytes) {
  if (file.declaredSize > max) fail('FILE_TOO_LARGE', `${file.name} exceeds its ${max / MiB} MiB size limit.`, file.field);
  let data = await file.data;
  if (isBlob(data) && data.size > max) fail('FILE_TOO_LARGE', `${file.name} exceeds its ${max / MiB} MiB size limit.`, file.field);
  if (data && typeof data.arrayBuffer === 'function') data = await data.arrayBuffer();
  const bytes = bytesView(data, file.field);
  if (bytes.byteLength > max) fail('FILE_TOO_LARGE', `${file.name} exceeds its ${max / MiB} MiB size limit.`, file.field);
  if (!bytes.byteLength) fail('EMPTY_FILE', `${file.name} is empty.`, file.field);
  // Caller-owned typed arrays can change while WebCrypto yields. Freeze the
  // selected bytes once so hashes, CRC and the ZIP always describe one snapshot.
  return bytes.slice();
}
function safeFilename(value) {
  let safe = value.normalize('NFKC').replace(/[\/\\:<>"|?*\u0000-\u001f\u007f]/g, '_').replace(/[\u202a-\u202e\u2066-\u2069]/g, '_').replace(/^\.+|[. ]+$/g, '').trim();
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe)) safe = '_' + safe;
  if (!safe) safe = 'file';
  if (encoder.encode(safe).length > 180) {
    const dot = safe.lastIndexOf('.'), candidateExtension = dot > 0 ? safe.slice(dot) : '';
    const ext = encoder.encode(candidateExtension).length <= 40 ? candidateExtension : '';
    let stem = ext ? safe.slice(0,dot) : safe;
    while (encoder.encode(stem + ext).length > 180) stem = [...stem].slice(0,-1).join('');
    safe = stem + ext;
  }
  return safe;
}
function uniqueName(value, used) {
  const base = safeFilename(value), dot = base.lastIndexOf('.');
  let name = base, index = 2;
  while (used.has(name.toLocaleLowerCase('en-US'))) { name = dot > 0 ? `${base.slice(0,dot)}-${index++}${base.slice(dot)}` : `${base}-${index++}`; }
  used.add(name.toLocaleLowerCase('en-US')); return name;
}
const CRC_TABLE = Uint32Array.from({length:256}, (_, n) => { let c = n; for(let i=0;i<8;i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
export function crc32(bytes) { let crc = 0xffffffff; for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }

// Native SHA-256 is preferred; the bounded, block-based fallback also works from
// file: or other contexts where WebCrypto is unavailable. No identity is signed.
const SHA_K = Uint32Array.from([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const rotr = (v,n) => (v >>> n) | (v << (32-n));
export function sha256Fallback(bytes) {
  const hash = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]), words = new Uint32Array(64);
  const length = Math.ceil((bytes.length+9)/64)*64, bitLength = bytes.length*8;
  for(let offset=0;offset<length;offset+=64) {
    for(let i=0;i<16;i++) { let word=0; for(let j=0;j<4;j++) {const pos=offset+i*4+j;let byte=pos<bytes.length?bytes[pos]:pos===bytes.length?128:0;if(pos>=length-8) byte=pos<length-4?Math.floor(bitLength/4294967296) >>> ((length-5-pos)*8) &255:bitLength >>> ((length-1-pos)*8)&255;word=(word<<8)|byte;}words[i]=word; }
    for(let i=16;i<64;i++){const x=words[i-15],y=words[i-2];words[i]=(words[i-16]+(rotr(x,7)^rotr(x,18)^(x>>>3))+words[i-7]+(rotr(y,17)^rotr(y,19)^(y>>>10)))>>>0;}
    let [a,b,c,d,e,f,g,h]=hash;
    for(let i=0;i<64;i++){const t1=(h+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+SHA_K[i]+words[i])>>>0,t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    [a,b,c,d,e,f,g,h].forEach((v,i)=>{hash[i]=(hash[i]+v)>>>0;});
  }
  return [...hash].map(v=>v.toString(16).padStart(8,'0')).join('');
}
async function sha256(bytes) {
  if (globalThis.crypto?.subtle) { try { const result = await globalThis.crypto.subtle.digest('SHA-256', bytes); return [...new Uint8Array(result)].map(b=>b.toString(16).padStart(2,'0')).join(''); } catch {} }
  return sha256Fallback(bytes);
}
function storedZip(files) {
  const parts=[], central=[]; let offset=0, centralSize=0;
  for(const file of files) {
    const name=encoder.encode(file.path), local=new Uint8Array(30+name.length), lv=new DataView(local.buffer);
    lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x800,true);lv.setUint16(12,33,true);lv.setUint32(14,file.crc32,true);lv.setUint32(18,file.size,true);lv.setUint32(22,file.size,true);lv.setUint16(26,name.length,true);local.set(name,30);
    parts.push(local,file.blob);
    const entry=new Uint8Array(46+name.length), cv=new DataView(entry.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x800,true);cv.setUint16(14,33,true);cv.setUint32(16,file.crc32,true);cv.setUint32(20,file.size,true);cv.setUint32(24,file.size,true);cv.setUint16(28,name.length,true);cv.setUint32(42,offset,true);entry.set(name,46);central.push(entry);centralSize+=entry.length;offset+=local.length+file.size;
  }
  const end=new Uint8Array(22), ev=new DataView(end.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,centralSize,true);ev.setUint32(16,offset,true);
  return new Blob([...parts,...central,end],{type:'application/zip'});
}
function safeWebURL(value) {
  if(typeof value!=='string'||value.length>4096||/[\u0000-\u0020\u007f]/.test(value)) return null;
  try {const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
function markupReferences(html, add) {
  const rawText = new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','noscript']);
  const named = {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};
  const decodeAttribute = value => value.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (match,entity) => {
    if(entity[0]!=='#')return named[entity.toLowerCase()];
    const code=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);
    return code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):'\ufffd';
  });
  let cursor=0;
  while(cursor<html.length){
    const start=html.indexOf('<',cursor);if(start<0)return;
    if(html.startsWith('<!--',start)){const end=html.indexOf('-->',start+4);cursor=end<0?html.length:end+3;continue;}
    const opening=/^<([a-z][a-z0-9:-]*)(?=[\s/>])/i.exec(html.slice(start,start+160));
    if(!opening){cursor=start+1;continue;}
    const tag=opening[1].toLowerCase();let at=start+opening[0].length,quote='',end=at;
    // Find the real tag boundary without interpreting JavaScript in attributes.
    for(;end<html.length;end++){const ch=html[end];if(quote){if(ch===quote)quote='';}else if(ch==='"'||ch==="'")quote=ch;else if(ch==='>')break;}
    if(end===html.length)return;
    const seen=new Set();
    while(at<end){
      while(at<end&&/[\s/]/.test(html[at]))at++;
      const nameStart=at;while(at<end&&!/[\s=/>]/.test(html[at]))at++;
      if(at===nameStart){at++;continue;}
      const name=html.slice(nameStart,at).toLowerCase();while(at<end&&/\s/.test(html[at]))at++;
      let value='';
      if(html[at]==='='){
        at++;while(at<end&&/\s/.test(html[at]))at++;
        if(html[at]==='"'||html[at]==="'"){const delimiter=html[at++],valueStart=at;while(at<end&&html[at]!==delimiter)at++;value=html.slice(valueStart,at);at++;}
        else{const valueStart=at;while(at<end&&!/\s/.test(html[at]))at++;value=html.slice(valueStart,at);}
      }
      if(!seen.has(name)&&['src','href','poster'].includes(name))add(decodeAttribute(value),'html:'+name);
      seen.add(name);
    }
    cursor=end+1;
    if(tag==='plaintext')return;
    if(rawText.has(tag)){
      // HTML raw text ends at its closing tag even if that text resembles code,
      // JSON, comments or further HTML. Never scan it for generated DOM URLs.
      const closing=new RegExp('</'+tag+'(?=[\\s/>])','gi');closing.lastIndex=cursor;const match=closing.exec(html);
      if(!match)return;const closeEnd=html.indexOf('>',match.index+tag.length+2);cursor=closeEnd<0?html.length:closeEnd+1;
    }
  }
}
function collectReferences(html, record, metadata) {
  const external=new Map(), local=new Map(); let visited=0;
  const add=(raw,source)=>{
    if(++visited>PACKAGE_LIMITS.references) fail('TOO_MANY_REFERENCES','The package contains too many link references.','references');
    if(typeof raw!=='string')return;const value=raw.trim();
    const url=safeWebURL(value);
    if(url){const key=url+'\n'+source;external.set(key,{url,source,status:'external_not_bundled',fetched:false});}
    else if(value&&!/^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(value))local.set(value+'\n'+source,{reference:value,source});
  };
  // Only actual markup attributes count. Raw script/style/RCDATA and comments
  // can contain source-code examples that are not file dependencies.
  markupReferences(html,add);
  function walk(value,path) {if(typeof value==='string'){if(/^https?:\/\//i.test(value))add(value,path);}else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))walk(v,path+'/'+k);}
  if(record)walk(record,'orb-record');walk(metadata,'submission');
  return {externalReferences:[...external.values()].sort((a,b)=>(a.url+' '+a.source).localeCompare(b.url+' '+b.source,'en')),localReferences:[...local.values()]};
}
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pathHref=path=>path.split('/').map(encodeURIComponent).join('/');
function makeCover(submission,files,warnings) {
  return '<!doctype html>\n<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(submission.title)+' · Review package</title><style>html{color-scheme:dark}body{max-width:54rem;margin:4rem auto;padding:0 1.5rem;font:16px/1.8 system-ui,sans-serif;color:#bed0dc;background:#08131d}h1{font-size:clamp(2rem,5vw,3rem);font-weight:400;line-height:1.2;letter-spacing:-.035em;color:#edf2f4}h2{font-size:1.2rem;font-weight:500;color:#dce8ef;margin-top:2rem}a{color:#efc49f;text-underline-offset:4px;overflow-wrap:anywhere}a:focus-visible{outline:2px solid #efc49f;outline-offset:4px}small{display:block;font-size:.8rem;color:#91aab9}ul{list-style:none;padding:0}li{padding:.8rem 0;border-bottom:1px solid #b5c9d326}code{overflow-wrap:anywhere}@media print{html{color-scheme:light}body{color:#222;background:#fff}h1,h2,a,small{color:#111}}</style><main><p>ORBIVERSITY · OWNER REVIEW</p><h1>'+esc(submission.title)+'</h1><p>'+esc(submission.description)+'</p>'+(submission.museum.creator?'<p>Signed by '+esc(submission.museum.creator.displayName)+'</p><small>Creator credit supplied by the contributor. Identity has not been verified; this is not a digital signature.</small>':'<p>No creator credit supplied.</p>')+'<h2>Included files</h2><p>This page does not execute or preview the submitted HTML. Opening a linked HTML file may run its authored scripts. Review the files before publication.</p><ul>'+files.map(f=>'<li><a href="'+pathHref(f.path)+'">'+esc(f.originalName||f.path)+'</a> <small>'+esc(f.kind)+' · '+f.size+' bytes</small></li>').join('')+'</ul><h2>Review notes</h2><ul>'+warnings.map(w=>'<li>'+esc(w)+'</li>').join('')+'</ul><p><a href="manifest.json">File hashes and package manifest</a> · <a href="submission.json">Submission metadata</a></p></main></html>\n';
}

export async function buildMuseumPackage(input, options = {}) {
  if(!input||typeof input!=='object'||Array.isArray(input))fail('INVALID_INPUT','Provide a submission object.','input');
  const title=text(own(input,'title'), 'title', PACKAGE_LIMITS.title, true), description=text(own(input,'description',''), 'description', PACKAGE_LIMITS.description), creatorName=text(own(input,'creatorName',''), 'creatorName', PACKAGE_LIMITS.creatorName);
  if(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(creatorName))fail('DISPLAY_NAME_REQUIRED','Use a creator display name rather than an email address.','creatorName');
  const onProgress=own(options,'onProgress');if(onProgress!=null&&typeof onProgress!=='function')fail('INVALID_INPUT','onProgress must be a function.','onProgress');
  const progress=(phase,completed,total,filename)=>onProgress?.({phase,completed,total,...(filename?{filename}:{})});
  const htmlInput=own(input,'html');if(!htmlInput)fail('REQUIRED','Select the completed HTML file.','html');
  const htmlFile=fileInput(htmlInput,'html','index.html','html'), selected=[htmlFile];
  for(const [key,kind]of [['audioFiles','audio'],['mediaFiles',undefined],['attachments',undefined]]){
    const array=own(input,key,[]);if(!Array.isArray(array))fail('INVALID_INPUT',`${key} must be an array of selected files.`,key);
    if(array.length+selected.length>PACKAGE_LIMITS.files)fail('TOO_MANY_FILES','Select at most 256 files per package.',key);
    for(let i=0;i<array.length;i++) {const d=Object.getOwnPropertyDescriptor(array,String(i));if(!d||!Object.hasOwn(d,'value'))fail('INVALID_INPUT','Use a dense array of files without getters.',key);selected.push(fileInput(d.value,`${key}[${i}]`,undefined,kind));}
  }
  progress('validating',0,selected.length);
  let record, recordBytes, recordName='orb-record.json';
  const sourceRecord=own(input,'orbJSON');
  if(sourceRecord!==undefined&&sourceRecord!==null){
    if(typeof sourceRecord==='string') {recordBytes=encoder.encode(sourceRecord);record=parseJSON(recordBytes,'orbJSON');}
    else if(isBlob(sourceRecord)||(sourceRecord&&typeof sourceRecord==='object'&&Object.hasOwn(sourceRecord,'name')&&Object.hasOwn(sourceRecord,'data')&&Object.keys(sourceRecord).every(key=>['name','data','type','size'].includes(key)))){
      const file=fileInput(sourceRecord,'orbJSON','orb-record.json','document');if(!/\.json$/i.test(file.name))fail('INVALID_JSON','Select a .json ORB record.','orbJSON');recordBytes=await readFileBytes(file,PACKAGE_LIMITS.jsonBytes);record=parseJSON(recordBytes,'orbJSON');recordName=file.name;
    }else {record=plainJSON(sourceRecord,'orbJSON');recordBytes=jsonBytes(record);}
    if(!record||typeof record!=='object'||Array.isArray(record))fail('INVALID_JSON','The ORB record must be a JSON object.','orbJSON');
  }
  const librarySources=[record?.museum?.library,record?.library,own(input,'library',[])].filter(value=>value!==undefined&&value!==null);
  const library=[], librarySeen=new Set();
  for(const source of librarySources){
    const clean=plainJSON(source,'library');
    // Legacy non-array metadata remains intact as an entry for owner review;
    // canonical descriptor arrays are combined without replacing prior editions.
    for(const item of Array.isArray(clean)?clean:[clean]){const key=stableJSON(item);if(!librarySeen.has(key)){librarySeen.add(key);library.push(item);}}
  }
  const reaches=plainJSON(own(input,'reaches',record?.reaches??[]),'reaches');
  if(!Array.isArray(reaches)||reaches.length>16)fail('INVALID_REACHES','Reach metadata must be an array of at most 16 proposals.','reaches');
  const museum={...(creatorName?{creator:{displayName:creatorName,creditType:'self_asserted_display_name',verified:false}}:{}),library,audio:record?.museum?.audio??[]};
  const submission={schemaVersion:1,title,description,museum,reaches,reviewStatus:'needs_owner_review',publicationApproved:false};
  const warnings=['This is a review package. Nothing has been uploaded or published.','Complete offline playback and links have not been verified. External links and unselected dependencies are not downloaded.','Creator credit is self-asserted. File hashes verify bytes, not identity, permissions, safety or factual accuracy.'];
  if(!record)warnings.push('No ORB JSON record was supplied. The original HTML is included; embedded metadata has not been extracted or validated.');
  const files=[], used=new Set();let totalBytes=0, htmlText='';
  if(selected.reduce((total,f)=>total+(f.declaredSize||0),recordBytes?.byteLength||0)>PACKAGE_LIMITS.totalBytes)fail('PACKAGE_TOO_LARGE','Selected files exceed 256 MiB. Remove files or split the submission.','files');
  const addBytes=async(bytes,path,kind,originalName,type='')=>{
    totalBytes+=bytes.byteLength;if(totalBytes>PACKAGE_LIMITS.totalBytes)fail('PACKAGE_TOO_LARGE','Selected and generated files exceed the 256 MiB package limit. Remove files or split the submission.','files');
    const item={path,kind,originalName,type,size:bytes.byteLength,sha256:await sha256(bytes),crc32:crc32(bytes),blob:new Blob([bytes])};files.push(item);return item;
  };
  for(let i=0;i<selected.length;i++){
    const file=selected[i];progress('reading',i,selected.length,file.name);
    const bytes=await readFileBytes(file,i===0?PACKAGE_LIMITS.htmlBytes:PACKAGE_LIMITS.fileBytes);
    if(i===0){try{htmlText=decoder.decode(bytes);}catch{fail('INVALID_HTML_ENCODING','Select a UTF-8 HTML file. The original bytes will be preserved.','html');}if(!/<(?:!doctype\s+html|html|head|body)\b/i.test(htmlText))fail('INVALID_HTML','The selected file does not appear to be an HTML document.','html');}
    const name=uniqueName(file.name,used);if(name!==file.name)warnings.push(`Filename mapped for safety or uniqueness: ${file.name} → content/${name}. Relative references may need review.`);
    if(file.kind==='image'&&/\.svg$/i.test(name))warnings.push(`SVG attachment ${name} may contain active content. It is bundled without executing or previewing it.`);
    progress('hashing',i,selected.length,file.name);await addBytes(bytes,'content/'+name,file.kind,file.name,file.type);progress('included',i+1,selected.length,file.name);
  }
  if(recordBytes)await addBytes(recordBytes,'orb-record.json','orb_record',recordName,'application/json');
  const bundled=files.filter(f=>f.path.startsWith('content/'));
  if(bundled.some(f=>f.kind==='dependency'))warnings.push('Supporting CSS/JS/MJS files are bundled as inert bytes for review. They have not been executed, previewed or approved; opening the original HTML may load them.');
  submission.bundledAudio=bundled.filter(f=>f.kind==='audio').map(f=>({path:f.path,originalName:f.originalName,bytes:f.size,sha256:f.sha256,status:'bundled'}));
  submission.bundledMedia=bundled.filter(f=>f.kind!=='html'&&f.kind!=='audio').map(f=>({path:f.path,originalName:f.originalName,kind:f.kind,bytes:f.size,sha256:f.sha256,status:'bundled'}));
  const references=collectReferences(htmlText,record,submission), paths=new Set(bundled.map(f=>f.path));
  const localReferences=references.localReferences.map(ref=>{let p=ref.reference.split(/[?#]/)[0];try{p=decodeURIComponent(p);}catch{}const resolved='content/'+p.replace(/^\.\//,'');return {...ref,status:paths.has(resolved)?'bundled_path':'not_bundled_or_unresolved',...(paths.has(resolved)?{path:resolved}:{})};});
  const unresolved=localReferences.filter(r=>r.status!=='bundled_path');
  if(unresolved.length)warnings.push(`${unresolved.length} relative HTML reference(s) are not matched to selected files. The manifest lists them for review.`);
  await addBytes(jsonBytes(submission),'submission.json','submission_metadata','submission.json','application/json');
  const readme=`ORBIVERSITY OWNER REVIEW PACKAGE\n\n${title}\n${creatorName?'Signed by '+creatorName:'No creator credit supplied.'}\n\nOpen cover.html for the file list. The original HTML is under content/.\nNo file has been uploaded, approved, installed or published.\nOriginal HTML and selected attachments are retained without executing them.\nOriginal ORB JSON, when supplied, is orb-record.json; submission.json contains additive Museum metadata and Reach proposals.\n\nREVIEW NOTES\n${warnings.map(w=>'- '+w).join('\n')}\n\nmanifest.json records SHA-256 and CRC32 for every other bundled file. Its own CRC32 is stored in the ZIP directory. Hashes do not establish contributor identity or permission.\n\nAll ${submission.bundledAudio.length} selected audio file(s) are included. Existing remote audio URLs remain external references; they are not downloads.\n`;
  await addBytes(encoder.encode(readme),'README.txt','review_instructions','README.txt','text/plain');
  await addBytes(encoder.encode(makeCover(submission,bundled,warnings)),'cover.html','review_cover','cover.html','text/html');
  const manifest={format:'orbiversity-review-package',schemaVersion:1,reviewStatus:'needs_owner_review',publicationApproved:false,title,description,museum,entrypoint:bundled[0].path,record:recordBytes?'orb-record.json':null,submission:'submission.json',cover:'cover.html',reaches,files:files.map(({blob,...f})=>f),bundledAudio:submission.bundledAudio,bundledMedia:submission.bundledMedia,externalReferences:references.externalReferences,localReferences,offline:{complete:false,status:'not_verified',externalFilesFetched:0},warnings,integrity:{algorithm:'SHA-256',scope:'Every bundled file except manifest.json; ZIP directory CRC32 also covers manifest.json.',identityVerified:false}};
  const manifestBytes=jsonBytes(manifest);await addBytes(manifestBytes,'manifest.json','manifest','manifest.json','application/json');
  progress('packing',selected.length,selected.length);
  const blob=storedZip(files);if(blob.size>PACKAGE_LIMITS.totalBytes)fail('PACKAGE_TOO_LARGE','The ZIP including metadata exceeds 256 MiB. Remove files or split the submission.','files');
  progress('complete',selected.length,selected.length);
  return {blob,filename:safeFilename(title)+'-orb-review.zip',manifest,warnings:[...warnings]};
}
