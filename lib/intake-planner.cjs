'use strict';

/*
 * Offline intake engine contract (version 1)
 *
 * planIntake(candidate, catalog, options?) accepts JSON metadata, not HTML or an
 * authored ORB document. Candidate: {id?, title?, description?, tags?, category?,
 * url?, editions?: [{id,url?,label?}], connections?: [catalogId]}. A title or URL
 * is required. Catalog is the existing {orbs:[...]} manifest or a record array;
 * records require their existing id and title. Other catalog fields are ignored
 * after bounded JSON validation. options: {existingConnections?: [{from,to}],
 * maxConnections?: 1..12, maxBridges?: 0..2}.
 *
 * Returns a review plan only. Exact title/URL/ID matches require duplicate review;
 * similar titles require repetition review. Neither case merges or deletes a
 * record or edition. IDs are copied verbatim; edition references are retained.
 * Connection scores rank metadata overlap, not truth, quality or probabilities.
 * A bridge is only a topic draft between two related catalog records with
 * different submitted tags/categories; it contains no authored readings.
 * Known direct/shared links or an existing topic covering both tags suppress it.
 *
 * No filesystem, network, model calls, DOM or evaluation. The caller loads the
 * manifest and extracts metadata from imported ORBs. This engine cannot resolve
 * metadata from a URL, establish factual support, detect semantic duplicates,
 * or know links not supplied in connections/existingConnections. Render all
 * returned strings with textContent; the return value is data, never HTML.
 */

const LIMITS=Object.freeze({candidateBytes:65536,catalogBytes:2097152,optionBytes:262144,catalogRecords:1000,title:180,description:4000,tags:32,tag:80,category:100,id:128,url:2048,editions:64,connections:128,edges:5000,depth:16,nodes:100000});
const LIMITATIONS=Object.freeze([
 'Suggestions use titles, tags and categories only; keyword overlap does not establish a factual relationship.',
 'An exact metadata match is a duplicate-review flag, not proof that two authored ORBs or editions contain the same work.',
 'Bridge drafts are proposed topics requiring human review and separate authorship; no bridge content is generated.',
 'The planner does not fetch URLs, inspect readings, verify publication or modify the catalog.',
 'Only supplied connection IDs and edges are known; missing graph data can produce redundant suggestions.'
]);
class IntakeValidationError extends Error{
 constructor(message,path='input'){super(message);this.name='IntakeValidationError';this.code='INVALID_INTAKE';this.path=path;}
}
function invalid(message,path){throw new IntakeValidationError(message,path);}

// Bound the whole JSON payload, including fields the planner does not use.
// Reject accessors/toJSON functions rather than executing caller-supplied code.
function boundedJSON(value,maximum,path){
 let bytes=0,nodes=0;const ancestors=new Set(),encoder=new TextEncoder();
 function charge(text){if(text.length>maximum)invalid('JSON input exceeds its size limit.',path);bytes+=encoder.encode(JSON.stringify(text)).length;if(bytes>maximum)invalid('JSON input exceeds its size limit.',path);}
 function walk(item,depth){
  if(++nodes>LIMITS.nodes||depth>LIMITS.depth)invalid('JSON input is too deeply nested or contains too many values.',path);
  if(item===null||typeof item==='boolean'){bytes+=5;return;}
  if(typeof item==='number'){if(!Number.isFinite(item))invalid('JSON numbers must be finite.',path);bytes+=24;return;}
  if(typeof item==='string'){charge(item);return;}
  if(typeof item!=='object')invalid('Use JSON data without executable values.',path);
  if(ancestors.has(item))invalid('JSON input must not contain cycles.',path);
  if(!Array.isArray(item)&&Object.getPrototypeOf(item)!==Object.prototype&&Object.getPrototypeOf(item)!==null)invalid('Use plain JSON objects.',path);
  if(Array.isArray(item)&&item.length>LIMITS.nodes)invalid('JSON arrays contain too many values.',path);
  ancestors.add(item);bytes+=2;
  const descriptors=Object.getOwnPropertyDescriptors(item);
  if(Reflect.ownKeys(descriptors).some(key=>typeof key!=='string'))invalid('JSON input must not contain symbol fields.',path);
  if(Array.isArray(item)&&(Object.keys(descriptors).length!==item.length+1||Object.keys(descriptors).some(key=>key!=='length'&&(!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=item.length))))invalid('Use dense JSON arrays without extra fields.',path);
  for(const [key,descriptor]of Object.entries(descriptors)){
   if(Array.isArray(item)&&key==='length')continue;
   if(!Object.hasOwn(descriptor,'value'))invalid('JSON input must not contain getters or setters.',path);
   if(!descriptor.enumerable)invalid('Use plain enumerable JSON fields.',path);
   charge(key);bytes+=2;walk(descriptor.value,depth+1);
  }
  ancestors.delete(item);
  if(bytes>maximum)invalid('JSON input exceeds its size limit.',path);
 }
 walk(value,0);
}
function object(value,path){if(!value||typeof value!=='object'||Array.isArray(value))invalid('Expected a JSON object.',path);return value;}
function text(value,max,path,required=false){
 if(value===undefined||value===null){if(required)invalid('A nonempty text value is required.',path);return '';}
 if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))invalid('Text is invalid or exceeds its field limit.',path);
 const result=value.trim();if(required&&!result)invalid('A nonempty text value is required.',path);return result;
}
function identifier(value,path,required=false){const id=text(value,LIMITS.id,path,required);if(id&&!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id))invalid('Use a stable ID with letters, digits, dots, underscores, colons or hyphens.',path);return id||null;}
function urlValue(value,path){
 const source=text(value,LIMITS.url,path);if(!source)return null;
 let url;try{url=new URL(source);}catch{invalid('Use an absolute public HTTPS URL.',path);}
 if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.includes('.')||/(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname)||/^\[|^\d+\.\d+\.\d+\.\d+$/.test(url.hostname))invalid('Use an absolute public HTTPS URL without credentials or a private host.',path);
 return url.href;
}
function list(value,max,path){if(value===undefined)return [];if(!Array.isArray(value)||value.length>max)invalid('List is invalid or exceeds its item limit.',path);return value;}
function normalizeTitle(value){return String(value).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}
const stop=new Set('a an the and or of to in on at by for from with about as el la los las un una de del en y o para por con orb'.split(' '));
const terms=value=>[...new Set(normalizeTitle(value).split(' ').filter(word=>word&&!stop.has(word)))];
const lexical=(a,b)=>a<b?-1:a>b?1:0;
const unique=values=>[...new Set(values)];
function normalizeRecord(value,path,catalog=false){
 const record=object(value,path),id=identifier(record.id,path+'.id',catalog),title=text(record.title,LIMITS.title,path+'.title',catalog),url=urlValue(record.url,path+'.url');
 if(!title&&!url)invalid('Provide a title or a published ORB URL.',path);
 const tags=list(record.tags,LIMITS.tags,path+'.tags').map((tag,i)=>text(tag,LIMITS.tag,path+'.tags['+i+']',true));
 const tagMap=new Map();for(const tag of tags){const key=normalizeTitle(tag);if(!key)invalid('Tags need letters or digits.',path+'.tags');if(!tagMap.has(key))tagMap.set(key,tag);}
 const editionIDs=new Set();
 const editions=list(record.editions,LIMITS.editions,path+'.editions').map((edition,i)=>{
  const at=path+'.editions['+i+']';object(edition,at);const editionId=identifier(edition.id,at+'.id',true);
  if(editionIDs.has(editionId))invalid('Edition IDs must be unique within a record.',at+'.id');editionIDs.add(editionId);
  return {id:editionId,url:urlValue(edition.url,at+'.url'),label:text(edition.label,LIMITS.title,at+'.label')};
 });
 return {id,title,description:text(record.description,LIMITS.description,path+'.description'),category:text(record.category,LIMITS.category,path+'.category'),url,tags:[...tagMap.values()],editions,connections:unique(list(record.connections,LIMITS.connections,path+'.connections').map((id,i)=>identifier(id,path+'.connections['+i+']',true)))};
}
function canonicalURL(value){if(!value)return null;const url=new URL(value);url.hash='';return url.href;}
function reference(record){return {id:record.id,title:record.title,url:record.url,editionIds:record.editions.map(edition=>edition.id),editions:record.editions.map(edition=>({...edition}))};}
function intersection(left,right){const set=new Set(right);return left.filter(value=>set.has(value));}
function reason(code,text,values=[]){return {code,text,values};}
function compare(candidate,record){
 const titleKey=normalizeTitle(candidate.title),recordKey=normalizeTitle(record.title),left=terms(candidate.title),right=terms(record.title),sharedTitle=intersection(left,right);
 const candidateTags=new Map(candidate.tags.map(tag=>[normalizeTitle(tag),tag])),recordTags=record.tags.map(normalizeTitle),sharedTags=intersection([...candidateTags.keys()],recordTags).sort(lexical);
 const similarity=left.length+right.length?2*sharedTitle.length/(left.length+right.length):0;
 const urls=unique([record.url,...record.editions.map(edition=>edition.url)].filter(Boolean).map(canonicalURL));
 const incomingURLs=unique([candidate.url,...candidate.editions.map(edition=>edition.url)].filter(Boolean).map(canonicalURL));
 const reasons=[];
 if(candidate.id&&candidate.id===record.id)reasons.push(reason('same_id','The submitted stable ID already exists.'));
 if(titleKey&&titleKey===recordKey)reasons.push(reason('same_title','The normalized titles are identical.'));
 const sameURLs=intersection(incomingURLs,urls);if(sameURLs.length)reasons.push(reason('same_url','A submitted URL matches this ORB or one of its editions.',sameURLs));
 if(reasons.length)return {...reference(record),score:100,classification:'duplicate_review',reasons,sharedTags:sharedTags.map(tag=>candidateTags.get(tag))};
 if(sharedTitle.length)reasons.push(reason('shared_title_terms','These title words overlap; this does not establish identical content.',sharedTitle));
 if(sharedTags.length)reasons.push(reason('shared_tags','The submitted and catalog tags overlap.',sharedTags.map(tag=>candidateTags.get(tag))));
 const sameCategory=!!candidate.category&&normalizeTitle(candidate.category)===normalizeTitle(record.category);
 if(sameCategory)reasons.push(reason('same_category','Both records use the same catalog category.',[record.category]));
 const score=Math.min(99,Math.round(similarity*50)+Math.min(40,sharedTags.length*20)+(sameCategory?10:0));
 const classification=similarity>=.78&&sharedTitle.length>=2?'near_duplicate_review':sharedTags.length||score>=25&&sharedTitle.length>=2?'connection_review':null;
 return {...reference(record),score,classification,reasons,sharedTags:sharedTags.map(tag=>candidateTags.get(tag))};
}
function edgeKey(from,to){return JSON.stringify([from,to].sort(lexical));}
function stableDraftID(value){let first=2166136261,second=2246822507;for(const ch of value){first=Math.imul(first^ch.codePointAt(0),16777619)>>>0;second=Math.imul(second^ch.codePointAt(0),3266489909)>>>0;}return 'bridge-'+first.toString(16).padStart(8,'0')+second.toString(16).padStart(8,'0');}
function planIntake(input,catalog,options={}){
 boundedJSON(input,LIMITS.candidateBytes,'candidate');boundedJSON(catalog,LIMITS.catalogBytes,'catalog');boundedJSON(options,LIMITS.optionBytes,'options');
 object(options,'options');
 const maxConnections=options.maxConnections??8,maxBridges=options.maxBridges??2;
 if(!Number.isInteger(maxConnections)||maxConnections<1||maxConnections>12)invalid('Choose between 1 and 12 connection suggestions.','options.maxConnections');
 if(!Number.isInteger(maxBridges)||maxBridges<0||maxBridges>2)invalid('Choose between zero and two bridge drafts.','options.maxBridges');
 const candidate=normalizeRecord(input,'candidate'),rows=Array.isArray(catalog)?catalog:object(catalog,'catalog').orbs;
 if(!Array.isArray(rows)||rows.length>LIMITS.catalogRecords)invalid('Catalog must contain at most 1,000 records.','catalog.orbs');
 const records=rows.map((row,i)=>normalizeRecord(row,'catalog.orbs['+i+']',true)),byID=new Map();
 for(const record of records){if(byID.has(record.id))invalid('Catalog stable IDs must be unique.','catalog.orbs');byID.set(record.id,record);}
 const edges=new Set(),adjacent=new Map();
 function addEdge(from,to,path){
  if(!byID.has(from)&&from!==candidate.id||!byID.has(to)&&to!==candidate.id)invalid('A connection refers to an unknown stable ID.',path);
  if(from===to)return;edges.add(edgeKey(from,to));
  for(const[a,b]of [[from,to],[to,from]]){if(!adjacent.has(a))adjacent.set(a,new Set());adjacent.get(a).add(b);}
 }
 for(const record of records)for(const id of record.connections)addEdge(record.id,id,'catalog.connections');
 for(const [i,edge]of list(options.existingConnections,LIMITS.edges,'options.existingConnections').entries()){const path='options.existingConnections['+i+']';object(edge,path);addEdge(identifier(edge.from,path+'.from',true),identifier(edge.to,path+'.to',true),path);}
 for(const id of candidate.connections)if(!byID.has(id))invalid('A submitted connection refers to an unknown catalog ID.','candidate.connections');
 const existingCandidateLinks=new Set(candidate.connections);
 if(candidate.id)for(const id of adjacent.get(candidate.id)||[])existingCandidateLinks.add(id);
 const matches=records.map(record=>compare(candidate,record)).filter(match=>match.classification).sort((a,b)=>b.score-a.score||lexical(a.id,b.id));
 const duplicates=matches.filter(match=>match.classification==='duplicate_review'),nearDuplicates=matches.filter(match=>match.classification==='near_duplicate_review');
 const connections=matches.filter(match=>match.classification==='connection_review').slice(0,maxConnections).map(match=>({...match,alreadyConnected:existingCandidateLinks.has(match.id),basis:'catalog_metadata_only',needsReview:true}));
 const decision=duplicates.length?'duplicate_review':nearDuplicates.length?'near_duplicate_review':!candidate.title?'needs_metadata':'new_candidate';
 const bridges=[];
 if(decision==='new_candidate'&&maxBridges){
  const viable=connections.filter(match=>match.sharedTags.length&&!match.alreadyConnected);
  for(let i=0;i<viable.length&&bridges.length<maxBridges;i++)for(let j=i+1;j<viable.length&&bridges.length<maxBridges;j++){
   const a=viable[i],b=viable[j],left=byID.get(a.id),right=byID.get(b.id);
   if(!left.category||!right.category||normalizeTitle(left.category)===normalizeTitle(right.category)||edges.has(edgeKey(a.id,b.id)))continue;
   if([...adjacent.get(a.id)||[]].some(id=>adjacent.get(b.id)?.has(id)))continue;
   const pair=a.sharedTags.flatMap(first=>b.sharedTags.map(second=>[first,second])).find(([first,second])=>normalizeTitle(first)!==normalizeTitle(second));if(!pair)continue;
   const facets=pair.slice().sort((first,second)=>lexical(normalizeTitle(first),normalizeTitle(second))),keys=facets.map(normalizeTitle),title=facets.join(' & ');
   const covers=record=>{const tags=new Set(record.tags.map(normalizeTitle)),words=new Set(terms(record.title));return keys.every(key=>tags.has(key)||terms(key).length&&terms(key).every(word=>words.has(word)));};
   // Existing topics and the submitted title can already supply this bridge.
   if(records.some(covers)||keys.every(key=>terms(key).length&&terms(key).every(word=>terms(candidate.title).includes(word))))continue;
   if(bridges.some(draft=>normalizeTitle(draft.title)===normalizeTitle(title)))continue;
   const connects=[a.id,b.id].sort(lexical);
   bridges.push({draftId:stableDraftID(JSON.stringify([normalizeTitle(candidate.title),connects,keys])),title,connects,status:'needs_review',needsReview:true,authored:false,basis:'catalog_metadata_only',reasons:[reason('distinct_shared_tags','Each endpoint overlaps a different submitted tag. A person must decide whether a separate bridge topic would be useful.',facets)],reviewQuestion:'Would a separate ORB connecting these topics add something beyond the submitted ORB and a direct link?'});
  }
 }
 return {version:1,decision,needsReview:true,candidate:{...candidate,editions:candidate.editions.map(edition=>({...edition})),connections:[...candidate.connections]},catalogCount:records.length,duplicates,nearDuplicates,connections,bridges,limitations:[...LIMITATIONS],actionsApplied:[]};
}

const api={planIntake,normalizeTitle,IntakeValidationError,LIMITS,LIMITATIONS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof window!=='undefined')window.ORBIntakePlanner=Object.freeze(api);
