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
 * Additive Reach contract (reachVersion 1): candidate.reaches, at most 16,
 * contains {sourcePoint?:{id,title?},target?:{id?,url?,topic?},relation?,reason?,
 * evidence?:[{url,title?,note?}]}. IDs/URLs must agree with the supplied catalog;
 * a unique exact topic title can also resolve a catalog target. Unknown or
 * conflicting targets never become navigable links. Explicit unknown topics
 * may become connectorTopics, sharing the two-draft budget with bridges.
 * plan.reaches supplies target, resolution, sourcePoint, relation, reason,
 * unverified evidence and reviewStatus='needs_review'; approved is always false.
 * Metadata-only connections also receive Reach proposals. Source point existence
 * is not checked without the authored document. Reaches stay outside signed ORB
 * content and conceptual edges. The caller handles the separate portable JSON
 * block {schemaVersion:1,reaches:[...]} and passes that array as candidate.reaches.
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

const LIMITS=Object.freeze({candidateBytes:65536,catalogBytes:2097152,optionBytes:262144,catalogRecords:1000,title:180,description:4000,tags:32,tag:80,category:100,id:128,url:2048,editions:64,connections:128,edges:5000,reaches:16,reachEvidence:8,reachRelation:80,reachReason:1200,evidenceNote:800,depth:16,nodes:100000});
const LIMITATIONS=Object.freeze([
 'Suggestions use titles, tags and categories only; keyword overlap does not establish a factual relationship.',
 'An exact metadata match is a duplicate-review flag, not proof that two authored ORBs or editions contain the same work.',
 'Bridge drafts are proposed topics requiring human review and separate authorship; no bridge content is generated.',
 'The planner does not fetch URLs, inspect readings, verify publication or modify the catalog.',
 'Only supplied connection IDs and edges are known; missing graph data can produce redundant suggestions.',
 'Reach targets are matched to supplied catalog metadata, not checked live. Source points and submitted evidence require separate review; no Reach is automatically approved.'
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
function normalizeReaches(value){
 return list(value,LIMITS.reaches,'candidate.reaches').map((reach,index)=>{
  const path='candidate.reaches['+index+']';object(reach,path);
  let sourcePoint=null;
  if(reach.sourcePoint!==undefined&&reach.sourcePoint!==null){object(reach.sourcePoint,path+'.sourcePoint');sourcePoint={id:identifier(reach.sourcePoint.id,path+'.sourcePoint.id',true),title:text(reach.sourcePoint.title,LIMITS.title,path+'.sourcePoint.title')};}
  const target=reach.target===undefined?{}:object(reach.target,path+'.target');
  const evidence=list(reach.evidence,LIMITS.reachEvidence,path+'.evidence').map((item,i)=>{
   const at=path+'.evidence['+i+']';object(item,at);const url=urlValue(item.url,at+'.url');if(!url)invalid('Reach evidence needs a public HTTPS URL.',at+'.url');
   return {url,title:text(item.title,LIMITS.title,at+'.title'),note:text(item.note,LIMITS.evidenceNote,at+'.note')};
  });
  return {sourcePoint,target:{id:identifier(target.id,path+'.target.id'),url:urlValue(target.url,path+'.target.url'),topic:text(target.topic,LIMITS.title,path+'.target.topic')},relation:text(reach.relation,LIMITS.reachRelation,path+'.relation')||'related',reason:text(reach.reason,LIMITS.reachReason,path+'.reason'),evidence};
 });
}
function catalogTarget(record,requestedURL=null){
 const requested=canonicalURL(requestedURL),edition=requested?record.editions.find(item=>canonicalURL(item.url)===requested):null;
 const url=edition?.url||(requested&&canonicalURL(record.url)===requested?record.url:null)||record.url||record.editions.find(item=>item.url)?.url;
 if(!url)return null;
 return {id:record.id,title:record.title,url,editionId:edition?.id||record.editions.find(item=>item.url===url)?.id||null,verification:'catalog_match_only'};
}
function planReaches(candidate,submitted,records,connections,bridges,decision,maxBridges){
 const byID=new Map(records.map(record=>[record.id,record])),byURL=new Map(),byTitle=new Map();
 for(const record of records){
  const title=normalizeTitle(record.title);if(!byTitle.has(title))byTitle.set(title,[]);byTitle.get(title).push(record);
  for(const url of unique([record.url,...record.editions.map(edition=>edition.url)].filter(Boolean).map(canonicalURL))){if(!byURL.has(url))byURL.set(url,[]);byURL.get(url).push(record);}
 }
 function resolve(target){
  const matchingURL=target.url?byURL.get(canonicalURL(target.url))||[]:[],matchingTitle=target.topic?byTitle.get(normalizeTitle(target.topic))||[]:[];
  if(target.id){
   const record=byID.get(target.id);
   if(!record)return {issue:matchingURL.length||matchingTitle.length?'target_identity_conflict':'unknown_target',allowConnector:!matchingURL.length&&!matchingTitle.length};
   if(target.url&&!matchingURL.some(item=>item.id===record.id))return {issue:'target_identity_conflict'};
   const known=catalogTarget(record,target.url);return known?{target:known}:{issue:'catalog_target_has_no_url'};
  }
  if(target.url){
   if(matchingURL.length===1)return {target:catalogTarget(matchingURL[0],target.url)};
   if(matchingURL.length>1)return {issue:'ambiguous_target'};
   return {issue:matchingTitle.length?'target_identity_conflict':'unknown_target',allowConnector:!matchingTitle.length};
  }
  if(matchingTitle.length===1){const known=catalogTarget(matchingTitle[0]);return known?{target:known}:{issue:'catalog_target_has_no_url'};}
  if(matchingTitle.length>1)return {issue:'ambiguous_target'};
  return {issue:target.topic?'unknown_target':'target_not_supplied',allowConnector:!!target.topic};
 }
 const reaches=[],connectorTopics=[],resolvedIDs=new Set();
 function createReach(input,basis,resolved){
  const reachId=stableDraftID(JSON.stringify([candidate.id,normalizeTitle(candidate.title),input])).replace('bridge-','reach-');
  const result={reachId,sourcePoint:input.sourcePoint?{...input.sourcePoint}:null,sourcePointStatus:input.sourcePoint?'supplied_not_checked':'not_supplied',requestedTarget:{...input.target},target:resolved.target||null,relation:input.relation,reason:input.reason||(basis==='catalog_metadata_only'?'Catalog metadata overlaps. Review whether the authored ORBs support a useful connection.':'A reviewer must supply or confirm the reason for this connection.'),evidence:input.evidence.map(item=>({...item,verification:'unverified'})),evidenceStatus:input.evidence.length?'supplied_unverified':'not_supplied',basis,resolution:resolved.target?'catalog_target':'unresolved',connectorDraftId:null,reviewStatus:'needs_review',approved:false,issues:resolved.issue?[resolved.issue]:[]};
  if(resolved.target)resolvedIDs.add(resolved.target.id);
  return result;
 }
 for(const input of submitted){
  const resolved=resolve(input.target),reach=createReach(input,'submitted_reach',resolved);
  if(reaches.some(item=>item.reachId===reach.reachId))continue;
  if(!resolved.target&&resolved.allowConnector&&input.target.topic){
   const near=records.filter(record=>{
    const left=terms(input.target.topic),right=terms(record.title),shared=intersection(left,right).length;
    return shared>=2&&2*shared/(left.length+right.length)>=.78;
   });
   if(near.length){reach.issues.push('similar_catalog_topic_requires_review');reach.possibleTargets=near.sort((a,b)=>lexical(a.id,b.id)).slice(0,8).map(record=>catalogTarget(record)).filter(Boolean);}
   else{
    let draft=connectorTopics.find(item=>normalizeTitle(item.title)===normalizeTitle(input.target.topic));
    if(!draft&&decision==='new_candidate'&&bridges.length+connectorTopics.length<maxBridges){
     draft={draftId:stableDraftID(JSON.stringify([normalizeTitle(candidate.title),normalizeTitle(input.target.topic)])).replace('bridge-','connector-'),title:input.target.topic,id:null,url:null,status:'needs_review',needsReview:true,authored:false,publicationStatus:'not_published',basis:'submitted_topic_only',sourceReachIds:[],reviewQuestion:'Is this a useful new connecting topic, or should this Reach point to an existing ORB?'};connectorTopics.push(draft);
    }
    if(draft){draft.sourceReachIds.push(reach.reachId);reach.resolution='proposed_connector';reach.connectorDraftId=draft.draftId;}
    else reach.issues.push(decision!=='new_candidate'?'intake_review_required':'connector_budget_reached');
   }
  }
  reaches.push(reach);
 }
 for(const match of connections){
  if(reaches.length>=LIMITS.reaches)break;if(resolvedIDs.has(match.id))continue;
  const target={id:match.id,url:null,topic:match.title},resolved=resolve(target);
  reaches.push(createReach({sourcePoint:null,target,relation:'related',reason:'',evidence:[]},'catalog_metadata_only',resolved));
 }
 return {reaches,connectorTopics};
}
function planIntake(input,catalog,options={}){
 boundedJSON(input,LIMITS.candidateBytes,'candidate');boundedJSON(catalog,LIMITS.catalogBytes,'catalog');boundedJSON(options,LIMITS.optionBytes,'options');
 object(options,'options');
 const maxConnections=options.maxConnections??8,maxBridges=options.maxBridges??2;
 if(!Number.isInteger(maxConnections)||maxConnections<1||maxConnections>12)invalid('Choose between 1 and 12 connection suggestions.','options.maxConnections');
 if(!Number.isInteger(maxBridges)||maxBridges<0||maxBridges>2)invalid('Choose between zero and two bridge drafts.','options.maxBridges');
 const candidate=normalizeRecord(input,'candidate'),submittedReaches=normalizeReaches(input.reaches),rows=Array.isArray(catalog)?catalog:object(catalog,'catalog').orbs;
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
 const reachPlan=planReaches(candidate,submittedReaches,records,connections,bridges,decision,maxBridges);
 return {version:1,reachVersion:1,decision,needsReview:true,candidate:{...candidate,editions:candidate.editions.map(edition=>({...edition})),connections:[...candidate.connections],...(input.reaches!==undefined?{reaches:submittedReaches}:{})},catalogCount:records.length,duplicates,nearDuplicates,connections,bridges,...reachPlan,limitations:[...LIMITATIONS],actionsApplied:[]};
}

const api={planIntake,normalizeTitle,IntakeValidationError,LIMITS,LIMITATIONS};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
if(typeof window!=='undefined')window.ORBIntakePlanner=Object.freeze(api);
