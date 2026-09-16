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
 assert.equal(plan.catalogCount,8);assert.equal(plan.decision,'duplicate_review');assert.equal(plan.duplicates.length,1);
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
