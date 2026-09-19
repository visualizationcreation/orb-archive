'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const vm=require('node:vm');
const {planIntake,IntakeValidationError,LIMITS}=require('../lib/intake-planner.cjs');

const orb=(id,title,extra={})=>({id,title,url:'https://example.org/orbs/'+id+'/',tags:[],category:'',editions:[{id:id+'-legacy-v1',label:'Original',url:'https://example.org/orbs/'+id+'/original/'}],...extra});
const catalog=[
 orb('watershed-legacy','Wetlands field guide',{category:'Nature',tags:['Ecology']}),
 orb('memory-legacy','Remembering together',{category:'Culture',tags:['Remembrance']}),
 orb('piano-legacy','Piano practice',{category:'Arts',tags:['Music']})
];
const candidate={title:'River celebrations',description:'A proposed collection entry.',category:'Culture',tags:['Ecology','Remembrance','Music'],url:'https://example.org/new-orb/'};

test('real catalog exact title matching ignores diacritics and preserves all legacy IDs and editions',()=>{
 const manifest=JSON.parse(readFileSync(join(__dirname,'../orbs.json'),'utf8')),before=JSON.stringify(manifest);
 const plan=planIntake({title:'  DIA de Muertos  '},manifest);
 assert.equal(plan.catalogCount,manifest.orbs.length);assert.equal(plan.decision,'duplicate_review');assert.equal(plan.duplicates.length,1);
 const match=plan.duplicates[0],original=manifest.orbs.find(item=>item.id==='dia-de-muertos');
 assert.equal(match.id,original.id);assert.equal(match.score,100);assert.ok(match.reasons.some(reason=>reason.code==='same_title'));
 assert.deepEqual(match.editionIds,original.editions.map(edition=>edition.id));
 assert.deepEqual(plan.actionsApplied,[]);assert.deepEqual(plan.bridges,[]);assert.equal(JSON.stringify(manifest),before);
});

test('an edition URL or stable ID collision requires review without overwriting or merging editions',()=>{
 const source=orb('Old_ID:1','An older title'),before=JSON.stringify(source);
 for(const input of [{title:'A different title',id:source.id},{url:source.editions[0].url+'#point-3'}]){
  const plan=planIntake(input,[source]);assert.equal(plan.decision,'duplicate_review');assert.equal(plan.duplicates[0].id,'Old_ID:1');
  assert.deepEqual(plan.duplicates[0].editions,source.editions);assert.deepEqual(plan.actionsApplied,[]);
 }
 assert.equal(JSON.stringify(source),before);
});

test('near repetition requests review and never treats it as an automatic merge',()=>{
 const plan=planIntake({title:'Core Belief'},[orb('core-belief','Core Belief ORB')]);
 assert.equal(plan.decision,'near_duplicate_review');assert.deepEqual(plan.duplicates,[]);
 assert.equal(plan.nearDuplicates[0].id,'core-belief');assert.ok(plan.nearDuplicates[0].reasons.some(reason=>reason.code==='shared_title_terms'));
 assert.deepEqual(plan.actionsApplied,[]);assert.deepEqual(plan.bridges,[]);
});

test('unrelated new topics and category-only overlap produce no invented connections or bridge content',()=>{
 const plan=planIntake({title:'Spacecraft propulsion',category:'Nature',tags:['Rocket engines']},catalog);
 assert.equal(plan.decision,'new_candidate');assert.deepEqual(plan.connections,[]);assert.deepEqual(plan.bridges,[]);
 assert.ok(plan.limitations.some(line=>line.includes('does not establish a factual relationship')));
 const urlOnly=planIntake({url:'https://example.org/unseen/'},catalog);
 assert.equal(urlOnly.decision,'needs_metadata');assert.deepEqual(urlOnly.connections,[]);assert.deepEqual(urlOnly.bridges,[]);
});

test('connection ranking and at most two topic drafts are deterministic and explicitly unverified',()=>{
 const first=planIntake(candidate,catalog),second=planIntake(candidate,catalog.slice().reverse());
 assert.deepEqual(first,second);assert.equal(first.connections.length,3);assert.equal(first.bridges.length,2);
 for(const match of first.connections){assert.ok(match.id.endsWith('-legacy'));assert.ok(match.score>0);assert.equal(match.needsReview,true);assert.equal(match.basis,'catalog_metadata_only');assert.ok(match.reasons.some(reason=>reason.code==='shared_tags'));}
 for(const draft of first.bridges){assert.match(draft.draftId,/^bridge-[a-f0-9]{16}$/);assert.equal(draft.status,'needs_review');assert.equal(draft.authored,false);assert.equal(draft.connects.length,2);assert.equal(draft.basis,'catalog_metadata_only');assert.equal('readings' in draft,false);assert.equal('sources' in draft,false);}
 assert.deepEqual(planIntake(candidate,catalog,{maxBridges:0}).bridges,[]);
 assert.equal(planIntake(candidate,catalog,{maxBridges:1}).bridges.length,1);
});

test('known direct links, shared connectors and submitted existing links suppress unnecessary bridges',()=>{
 const pair=catalog.slice(0,2),input={...candidate,tags:['Ecology','Remembrance']};
 const direct=planIntake(input,pair,{existingConnections:[{from:pair[0].id,to:pair[1].id}]});assert.deepEqual(direct.bridges,[]);
 const fromRecord=planIntake(input,[{...pair[0],connections:[pair[1].id]},pair[1]]);assert.deepEqual(fromRecord.bridges,[]);
 const known=planIntake({...input,connections:pair.map(item=>item.id)},pair);assert.deepEqual(known.bridges,[]);assert.ok(known.connections.every(item=>item.alreadyConnected));
 const connector=orb('connector-legacy','A reviewed existing connection');
 const shared=planIntake(input,[...pair,connector],{existingConnections:pair.map(item=>({from:item.id,to:connector.id}))});assert.deepEqual(shared.bridges,[]);
});

test('an existing topic or the submitted title can already fill the proposed bridge',()=>{
 const pair=catalog.slice(0,2),input={...candidate,tags:['Ecology','Remembrance']};
 assert.deepEqual(planIntake(input,[...pair,orb('existing-bridge','Ecology and remembrance')]).bridges,[]);
 assert.deepEqual(planIntake({...input,title:'Ecology and remembrance'},pair).bridges,[]);
 assert.deepEqual(planIntake(input,[pair[0],{...pair[1],category:'Nature'}]).bridges,[]);
});

test('validation bounds all submitted JSON including ignored text and rejects invalid or private URLs',()=>{
 for(const input of [null,{},[],{title:'x'.repeat(LIMITS.title+1)},{title:'Valid',tags:Array(33).fill('tag')},{title:'Valid',extra:'x'.repeat(LIMITS.candidateBytes)},{title:'Valid',description:'\u0000unsafe'}])assert.throws(()=>planIntake(input,[]),IntakeValidationError);
 for(const url of ['javascript:alert(1)','data:text/html,<script>x</script>','http://example.org/','https://user:secret@example.org/','https://127.0.0.1/','https://[::1]/','https://localhost/','https://private.internal/'])assert.throws(()=>planIntake({title:'Valid',url},[]),IntakeValidationError);
 assert.throws(()=>planIntake({title:'Valid'},Array.from({length:1001},(_,i)=>orb('orb-'+i,'Topic '+i))),IntakeValidationError);
 assert.throws(()=>planIntake(candidate,catalog,{maxBridges:3}),IntakeValidationError);
 assert.throws(()=>planIntake(candidate,catalog,{existingConnections:[{from:'missing',to:catalog[0].id}]}),IntakeValidationError);
 assert.throws(()=>planIntake(candidate,[catalog[0],catalog[0]]),IntakeValidationError);
 assert.throws(()=>planIntake({title:'Valid',ignored:Array(1000000000)},[]),IntakeValidationError);
 assert.throws(()=>planIntake({title:'Valid',ignored:Array(10)},[]),IntakeValidationError);
 assert.throws(()=>planIntake({title:'Valid',ignored:'\\'.repeat(40000)},[]),IntakeValidationError);
});

test('intake is inert data: HTML is not executed and getters or toJSON functions are rejected without invocation',()=>{
 let invoked=0;const getter={title:'A topic'};Object.defineProperty(getter,'description',{enumerable:true,get(){invoked++;return 'hidden';}});
 assert.throws(()=>planIntake(getter,[]),IntakeValidationError);
 assert.throws(()=>planIntake({title:'A topic',toJSON(){invoked++;return {}; }},[]),IntakeValidationError);assert.equal(invoked,0);
 const title='<img src=x onerror="alert(1)">';assert.equal(planIntake({title},[]).candidate.title,title);
 const cyclic={title:'A topic'};cyclic.self=cyclic;assert.throws(()=>planIntake(cyclic,[]),IntakeValidationError);
});

test('the same dependency-free planner works in a browser sandbox without network access',()=>{
 const window={},context=vm.createContext({window,URL,TextEncoder});
 vm.runInContext(readFileSync(join(__dirname,'../lib/intake-planner.cjs'),'utf8'),context);
 assert.equal(typeof window.ORBIntakePlanner.planIntake,'function');
 const plan=vm.runInContext('window.ORBIntakePlanner.planIntake({title:"An offline topic"},[])',context);
 assert.equal(plan.decision,'new_candidate');assert.equal(plan.bridges.length,0);
});

test('a submitted Reach retains the authored point and resolves only the catalog target URL',()=>{
 const submitted={sourcePoint:{id:'p7',title:'The upstream forest'},target:{id:catalog[0].id,url:catalog[0].url+'#unverified-anchor'},relation:'shared_mechanism',reason:'Compare the described watershed processes.',evidence:[{url:'https://example.org/evidence/river',title:'Field notes',note:'Submitted source; not checked by the planner.'}],approved:true};
 const plan=planIntake({...candidate,reaches:[submitted]},catalog),reach=plan.reaches.find(item=>item.basis==='submitted_reach');
 assert.equal(plan.reachVersion,1);assert.deepEqual(reach.sourcePoint,submitted.sourcePoint);assert.equal(reach.sourcePointStatus,'supplied_not_checked');
 assert.equal(reach.target.id,catalog[0].id);assert.equal(reach.target.url,catalog[0].url);assert.equal(reach.target.verification,'catalog_match_only');
 assert.equal(reach.relation,submitted.relation);assert.equal(reach.reason,submitted.reason);assert.equal(reach.evidence[0].url,submitted.evidence[0].url);assert.equal(reach.evidence[0].verification,'unverified');
 assert.equal(reach.evidenceStatus,'supplied_unverified');assert.equal(reach.reviewStatus,'needs_review');assert.equal(reach.approved,false);assert.equal(reach.resolution,'catalog_target');
 assert.equal(plan.reaches.filter(item=>item.target?.id===catalog[0].id).length,1,'explicit Reach replaces the generic suggestion to the same target');
});

test('Reach identity can resolve an exact edition URL or unique diacritic-normalized catalog title',()=>{
 const existing=orb('legacy-dia','Día de Muertos');
 const plan=planIntake({title:'A new subject',reaches:[{target:{url:existing.editions[0].url}},{target:{topic:'DIA DE MUERTOS'}}]},[existing]);
 assert.equal(plan.reaches[0].target.editionId,existing.editions[0].id);assert.equal(plan.reaches[0].target.url,existing.editions[0].url);
 assert.equal(plan.reaches[1].target.id,existing.id);assert.equal(plan.reaches[1].target.title,existing.title);assert.equal(plan.reaches[1].target.url,existing.url);
 assert.ok(plan.reaches.every(item=>item.approved===false&&item.evidenceStatus==='not_supplied'));
});

test('conflicting or ambiguous Reach identity remains unresolved instead of replacing an author-supplied URL',()=>{
 for(const target of [
  {id:catalog[0].id,url:catalog[1].url},
  {id:catalog[0].id,url:'https://example.org/guessed/'},
  {id:'invented-id',url:catalog[0].url},
  {topic:catalog[0].title,url:'https://example.org/guessed/'}
 ]){
  const plan=planIntake({title:'A new subject',reaches:[{target}]},catalog),reach=plan.reaches[0];
  assert.equal(reach.target,null);assert.equal(reach.resolution,'unresolved');assert.ok(reach.issues.includes('target_identity_conflict'));assert.deepEqual(plan.connectorTopics,[]);
 }
 const ambiguous=planIntake({title:'A new subject',reaches:[{target:{topic:'Repeated title'}}]},[orb('first','Repeated title'),orb('second','Repeated title')]);
 assert.equal(ambiguous.reaches[0].target,null);assert.ok(ambiguous.reaches[0].issues.includes('ambiguous_target'));assert.deepEqual(ambiguous.connectorTopics,[]);
});

test('unknown Reach topics produce at most two unlinked, unauthored connector drafts',()=>{
 const reaches=['River rituals','Seasonal memory','Watershed sound','River rituals'].map((topic,i)=>({sourcePoint:{id:'p'+i},target:{id:'unknown-'+i,url:'https://example.org/not-cataloged/'+i,topic},relation:'analogy',reason:'An author-proposed comparison for review.'}));
 const plan=planIntake({title:'A new subject',reaches},catalog);
 assert.equal(plan.connectorTopics.length,2);assert.deepEqual(plan.bridges,[]);
 for(const topic of plan.connectorTopics){assert.equal(topic.id,null);assert.equal(topic.url,null);assert.equal(topic.authored,false);assert.equal(topic.publicationStatus,'not_published');assert.equal(topic.status,'needs_review');}
 assert.ok(plan.reaches.every(reach=>reach.target===null&&reach.approved===false));
 assert.equal(plan.reaches[0].connectorDraftId,plan.reaches[3].connectorDraftId);assert.equal(plan.reaches[2].resolution,'unresolved');assert.ok(plan.reaches[2].issues.includes('connector_budget_reached'));
 assert.equal(plan.connectorTopics[0].sourceReachIds.length,2);
 const withoutTopic=planIntake({title:'A new subject',reaches:[{target:{id:'unknown'}}]},catalog);
 assert.equal(withoutTopic.reaches[0].target,null);assert.deepEqual(withoutTopic.connectorTopics,[]);
});

test('Reach connector drafts share the old bridge budget and preserve previous planner results',()=>{
 const before=planIntake(candidate,catalog),after=planIntake({...candidate,reaches:[{target:{topic:'An unlisted connector'}}]},catalog);
 for(const field of ['version','decision','duplicates','nearDuplicates','connections','bridges','actionsApplied'])assert.deepEqual(after[field],before[field]);
 assert.equal(after.bridges.length,2);assert.equal(after.connectorTopics.length,0);assert.equal(after.reaches[0].resolution,'unresolved');
 for(const reach of before.reaches){assert.equal(reach.basis,'catalog_metadata_only');assert.equal(reach.sourcePoint,null);assert.deepEqual(reach.evidence,[]);assert.equal(reach.relation,'related');assert.ok(catalog.some(item=>item.id===reach.target.id&&item.url===reach.target.url));}
 assert.equal(planIntake({title:'A new subject',reaches:[{target:{topic:'Unknown'}}]},catalog,{maxBridges:0}).connectorTopics.length,0);
});

test('near-repeat or URL-less targets require review and never create a pretend published connector',()=>{
 const near=planIntake({title:'A new subject',reaches:[{target:{topic:'Core Belief'}}]},[orb('belief','Core Belief ORB')]);
 assert.equal(near.reaches[0].target,null);assert.ok(near.reaches[0].issues.includes('similar_catalog_topic_requires_review'));assert.equal(near.reaches[0].possibleTargets[0].id,'belief');assert.deepEqual(near.connectorTopics,[]);
 const noURL=planIntake({title:'A new subject',reaches:[{target:{id:'unpublished'}}]},[{id:'unpublished',title:'An unpublished record'}]);
 assert.equal(noURL.reaches[0].target,null);assert.ok(noURL.reaches[0].issues.includes('catalog_target_has_no_url'));assert.deepEqual(noURL.connectorTopics,[]);
});

test('Reach fields and evidence are bounded, validated and cannot grant themselves approval',()=>{
 const target={id:catalog[0].id};
 for(const reach of [{target:{url:'javascript:alert(1)'}},{target,sourcePoint:{id:'bad/id'}},{target,relation:'x'.repeat(81)},{target,reason:'x'.repeat(1201)},{target,evidence:Array.from({length:9},()=>({url:'https://example.org/source'}))},{target,evidence:[{}]},{target,evidence:[{url:'http://example.org/source'}]}])assert.throws(()=>planIntake({title:'A new subject',reaches:[reach]},catalog),IntakeValidationError);
 assert.throws(()=>planIntake({title:'A new subject',reaches:Array.from({length:17},()=>({target}))},catalog),IntakeValidationError);
 const reach={target,approved:true,reviewStatus:'approved',evidence:[{url:'https://example.org/source',verification:'verified'}]};
 const result=planIntake({title:'A new subject',reaches:[reach,reach,{...reach,reason:'A different authored reason'}]},catalog);
 assert.equal(result.reaches.length,2);assert.equal(new Set(result.reaches.map(item=>item.reachId)).size,2);
 for(const item of result.reaches){assert.equal(item.approved,false);assert.equal(item.reviewStatus,'needs_review');assert.equal(item.evidence[0].verification,'unverified');}
});
