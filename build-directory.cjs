// Run after editing orbs.json. No dependencies or network access required.
const fs=require('fs'),path=require('path');
const {renderOrbEntry}=require('./directory-renderer.cjs');
const root=__dirname,manifest=JSON.parse(fs.readFileSync(path.join(root,'orbs.json'),'utf8'));
if(!Array.isArray(manifest.orbs))throw new Error('Expected an orbs array');
const editionIds=new Set(),projectIds=new Set();
for(const orb of manifest.orbs){
 if(!orb.id||projectIds.has(orb.id))throw new Error('Missing or duplicate project ID');projectIds.add(orb.id);
 if(!Array.isArray(orb.editions)||!orb.editions.length)throw new Error('Every project needs at least one edition');
 for(const edition of orb.editions){if(!edition.id||editionIds.has(edition.id))throw new Error('Missing or duplicate edition ID');editionIds.add(edition.id);if(new URL(edition.url).protocol!=='https:')throw new Error('Edition URLs must use HTTPS');}
 if(!orb.editions.some(e=>e.id===orb.featuredEdition))throw new Error('Featured edition must exist');
}
const file=path.join(root,'index.html');let html=fs.readFileSync(file,'utf8');
const replace=(pattern,value)=>{if(!pattern.test(html))throw new Error('Required template marker missing: '+pattern);html=html.replace(pattern,()=>value);};
replace(/<div id="entries">[\s\S]*?<\/div><p class="empty"/,'<div id="entries">'+manifest.orbs.map((o,i)=>renderOrbEntry(o,i)).join('\n')+'</div><p class="empty"');
replace(/<script type="application\/json" id="orb-catalog">[\s\S]*?<\/script>/,'<script type="application/json" id="orb-catalog">'+JSON.stringify(manifest).replaceAll('<','\\u003c')+'</script>');
const renderer=fs.readFileSync(path.join(root,'directory-renderer.cjs'),'utf8').replace(/if\(typeof module[^\n]+/,'');
replace(/\/\* ORB_RENDERER_START \*\/[\s\S]*?\/\* ORB_RENDERER_END \*\//,'/* ORB_RENDERER_START */\n'+renderer+'\n/* ORB_RENDERER_END */');
replace(/(<p class="results-label"[^>]*>)[^<]*(<\/p>)/,'<p class="results-label" id="count" role="status" aria-live="polite">'+manifest.orbs.length+' orbs · '+editionIds.size+' editions</p>');
for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new Function(match[1]);
fs.writeFileSync(file,html);console.log('Built '+manifest.orbs.length+' orbs and '+editionIds.size+' editions.');
