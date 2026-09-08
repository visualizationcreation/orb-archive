// Build with: node build-directory.cjs. No dependencies or network needed.
const fs=require('fs'),path=require('path'),r=require('./directory-renderer.cjs');
const root=__dirname,read=f=>fs.readFileSync(path.join(root,f),'utf8');
const catalog=JSON.parse(read('orbs.json')),ids=new Set(),editions=new Set();
if(!Array.isArray(catalog.orbs))throw Error('Expected orbs array');
for(const o of catalog.orbs){if(o.status==='inactive')throw Error('Inactive ORBs belong in Archived Orbs (Inactive)');if(!o.id||ids.has(o.id))throw Error('Missing or duplicate ORB ID');ids.add(o.id);if(!Array.isArray(o.editions)||!o.editions.length)throw Error('An ORB needs an edition');for(const e of o.editions){if(e.status==='inactive')throw Error('Inactive edition in active catalog');if(!e.id||editions.has(e.id))throw Error('Missing or duplicate edition ID');editions.add(e.id);if(!r.safeLink(e.url))throw Error('Edition URLs must use HTTPS');}if(!o.editions.some(e=>e.id===o.featuredEdition))throw Error('Featured edition missing');}
let html=read('index.html');const replace=(regex,value)=>{if(!regex.test(html))throw Error('Template marker missing');html=html.replace(regex,()=>value);};
replace(/<div id="entries">[\s\S]*?<\/div><div class="empty"/,'<div id="entries">'+r.filterCatalog(catalog.orbs).map(r.renderOrbEntry).join('\n')+'</div><div class="empty"');
replace(/<script type="application\/json" id="orb-catalog">[\s\S]*?<\/script>/,'<script type="application/json" id="orb-catalog">'+JSON.stringify(catalog).replaceAll('<','\\u003c')+'</script>');
replace(/(<p id="count"[^>]*>)[\s\S]*?<\/p>/,'<p id="count" role="status" aria-live="polite">'+catalog.orbs.length+' '+(catalog.orbs.length===1?'ORB':'ORBs')+'</p>');
replace(/<select id="topic">[\s\S]*?<\/select>/,'<select id="topic"><option value="all">All topics</option>'+[...new Set(catalog.orbs.map(o=>o.category).filter(Boolean))].sort().map(t=>'<option value="'+r.escapeHtml(t)+'">'+r.escapeHtml(t)+'</option>').join('')+'</select>');
const renderer=read('directory-renderer.cjs').replace(/if\(typeof module[^\n]+/,'');new Function(renderer);new Function(read('library.js'));fs.writeFileSync(path.join(root,'directory.js'),renderer);fs.writeFileSync(path.join(root,'index.html'),html);console.log('Built '+ids.size+' active ORBs; '+editions.size+' editions.');
