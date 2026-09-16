(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./directory-renderer.cjs'));
  else root.ORBMuseum=factory({escapeHtml,safeLink,featured,availability,pointCount,runtime,renderOrbEntry});
})(typeof globalThis!=='undefined'?globalThis:this,function(r){
  'use strict';const e=r.escapeHtml;
  function identity(orb){
    const meta=orb.museum||{},mode=meta.attribution,raw=typeof meta.creator?.displayName==='string'?meta.creator.displayName.trim():'';
    const creator=mode==='anonymous'?'':raw;
    const suffix=mode==='anonymous'?'an anonymous orb':creator?'an orb by '+creator:'';
    const contribution=meta.contribution&&typeof meta.contribution==='object'?meta.contribution:{};
    const note=typeof contribution.note==='string'?contribution.note.trim():'',expression=typeof contribution.expression==='string'?contribution.expression.trim():'';
    return {creator,suffix,note,expression,hasAbout:!!(suffix||note||expression)};
  }
  function displayTitle(orb){const id=identity(orb);return String(orb.title||'Untitled orb')+(id.suffix?' — '+id.suffix:'');}
  function titleHTML(orb){const id=identity(orb);return e(orb.title)+(id.suffix?'<span class="orb-byline"> — '+e(id.suffix)+'</span>':'');}
  function holdings(orb){
    const meta=orb.museum||{},f=r.featured(orb),library=[],audio=[];
    const add=(list,item)=>{const url=r.safeLink(item.url);if(url&&!list.some(entry=>entry.url===url&&entry.language===(item.language||'')))list.push({title:item.title||item.name||'Included material',url,type:item.type||'',language:item.language||'',durationLabel:item.durationLabel||r.runtime(item.durationSeconds)});};
    (meta.library||[]).forEach(item=>add(library,item));
    if(r.safeLink(orb.imageCredits))add(library,{title:'Image library & credits',url:orb.imageCredits,type:'Images'});
    if(r.safeLink(f?.sourceUrl))add(library,{title:'Edition source files',url:f.sourceUrl,type:'Source record'});
    (meta.audio||[]).forEach(item=>add(audio,item));
    if(!audio.length)(orb.availableJourneys||[]).filter(item=>item.narrationReady===true).forEach(item=>add(audio,{...item,title:item.name,url:r.safeLink(item.url)||f.url}));
    return {library,audio,...identity(orb),legacy:meta.legacy===true};
  }
  function languageLabel(item){const key=String(item.language||'').toLowerCase(),label=({en:'English',es:'Español',english:'English',spanish:'Español'})[key]||item.language||'';return label&&!String(item.title).toLowerCase().includes(label.toLowerCase())?label:'';}
  function links(items){return '<ul>'+items.map(item=>'<li><a href="'+e(item.url)+'">'+e(item.title)+' <span aria-hidden="true">↗</span></a>'+(item.durationLabel||item.type||item.language?'<small>'+e([item.type,languageLabel(item),item.durationLabel].filter(Boolean).join(' · '))+'</small>':'')+'</li>').join('')+'</ul>';}
  function aboutPoint(orb){const id=identity(orb);if(!id.hasAbout)return '';return '<details class="orb-about-point"><summary><span class="about-point-sphere" aria-hidden="true"></span><span>About this orb</span><span class="about-point-chevron" aria-hidden="true">+</span></summary><div class="orb-about-reading">'+(id.suffix?'<p class="about-attribution">'+e(displayTitle(orb))+'</p>':'')+(id.note?'<h3>A personal note</h3><p class="contributor-copy orb-content">'+e(id.note)+'</p>':'')+(id.expression?'<h3>How I hope you experience this orb</h3><p class="contributor-copy orb-content">'+e(id.expression)+'</p>':'')+'</div></details>';}
  function extras(orb){const h=holdings(orb);if(!h.library.length&&!h.audio.length)return '';return '<details class="museum-holdings"><summary>Library & recordings <span>'+e([h.library.length?h.library.length+' library '+(h.library.length===1?'item':'items'):'',h.audio.length?h.audio.length+' '+(h.audio.length===1?'recording':'recordings'):''].filter(Boolean).join(' · '))+'</span></summary><div class="holdings-grid">'+(h.library.length?'<section><h3>Library & sources</h3>'+links(h.library)+'</section>':'')+(h.audio.length?'<section><h3>Listen to this edition</h3>'+links(h.audio)+'</section>':'')+'</div></details>';}
  function entry(orb){return r.renderOrbEntry(orb).replace('<article class="orb-row"','<article id="orb-'+e(orb.id)+'" class="orb-row"').replace('>'+e(orb.title)+'</a></h2>','>'+titleHTML(orb)+'</a></h2>').replace('<details class="version-details">',aboutPoint(orb)+extras(orb)+'<details class="version-details">');}
  function overview(orb){const f=r.featured(orb),h=holdings(orb),a=r.availability(orb);return '<p class="eyebrow">'+e(orb.category||'From the museum')+'</p><h2>'+titleHTML(orb)+'</h2><p class="overview-description">'+e(orb.description)+'</p><p class="overview-meta">'+(r.pointCount(orb)||'Included')+' readings'+(a.audio?' · Recorded audio':'')+(a.video?' · Film':'')+'</p><a class="primary-link" href="'+e(f.url)+'">Enter this ORB <span aria-hidden="true">↗</span></a><a class="edition-link" href="#orb-'+e(orb.id)+'">Library, recordings & editions</a>'+aboutPoint(orb)+(h.audio.length?'<div class="overview-listen"><h3>Also inside</h3>'+links(h.audio.slice(0,2))+'</div>':'')+'<p class="vault-note">A finished world of readings and real sources. Follow its links at your own pace.</p>';}
  return {identity,displayTitle,titleHTML,holdings,links,aboutPoint,extras,entry,overview};
});
