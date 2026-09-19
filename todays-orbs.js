(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ORBToday=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function introduction(value){const text=String(value||'').trim();if(text.length<180||/[.!?。！？][”’"']?$/.test(text))return text;const sentences=text.match(/^([\s\S]*[.!?。！？])\s+[^.!?。！？]*$/);return sentences&&sentences[1].length>=60?sentences[1]:text.replace(/\s+\S*$/,'')+'…';}
  function safeURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
  function publicationDate(orb){
    // A presentation update must never make an older work a new arrival.
    const raw=orb.publishedAt||orb.firstPublished||'';
    if(!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(raw))return null;
    const day=raw.slice(0,10),date=new Date(raw.length===10?raw+'T12:00:00Z':raw);
    if(!Number.isFinite(date.getTime())||new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day)return null;
    return {raw,date,dateOnly:raw.length===10};
  }
  const localDay=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  function entries(catalog,{now=new Date()}={}){
    const seen=new Set();return catalog.flatMap(orb=>{
      if(!orb?.id||seen.has(orb.id)||orb.status==='inactive')return [];
      const featured=(orb.editions||[]).find(e=>e.id===orb.featuredEdition)||(orb.editions||[])[0];
      const url=safeURL(featured?.url||orb.url);if(!url)return [];seen.add(orb.id);
      const published=publicationDate(orb),today=published&&(published.dateOnly?published.raw===localDay(now):localDay(published.date)===localDay(now)&&published.date<=now);
      // Do not expose scheduled entries as published before their timestamp.
      if(published&&(published.dateOnly?published.raw>localDay(now):published.date>now))return [];
      const creator=orb.museum?.attribution==='named'?String(orb.museum?.creator?.displayName||'').trim():'';
      return [{id:orb.id,title:String(orb.title||'Untitled ORB'),description:introduction(orb.description),note:String(orb.museum?.contribution?.note||''),creator,url,published,today:!!today,points:Number.isInteger(orb.pointCount)?orb.pointCount:null,category:String(orb.category||'')}];
    }).sort((a,b)=>(b.published?.date.getTime()||0)-(a.published?.date.getTime()||0)||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
  }
  function render(catalog,{now=new Date(),limit=8,locale='en',staticMode=false}={}){
    const es=locale.startsWith('es'),t=(en,sp)=>es?sp:en,rows=entries(catalog,{now}),shown=rows.slice(0,limit),todayCount=rows.filter(row=>row.today).length;
    let group='';
    const markup=shown.map(row=>{
      const next=staticMode?'recent':row.today?'today':'earlier';
      const heading=next!==group?'<li class="arrival-group"><h3>'+t(next==='today'?'Today':next==='earlier'?'Earlier additions':'Latest additions',next==='today'?'Hoy':next==='earlier'?'Adiciones anteriores':'Últimas adiciones')+'</h3></li>':'';group=next;
      const date=row.published?new Intl.DateTimeFormat(es?'es':'en',{dateStyle:'medium',...(row.published.dateOnly?{timeZone:'UTC'}:{})}).format(row.published.date):t('Publication date not recorded','Fecha de publicación no registrada');
      return heading+'<li class="arrival"><span class="arrival-orb" aria-hidden="true"></span><article><div class="arrival-meta"><span>'+escape(row.creator||t('Anonymous contributor','Colaborador anónimo'))+'</span><span aria-hidden="true"> · </span>'+(row.published?'<time datetime="'+escape(row.published.raw)+'">'+escape(date)+'</time>':escape(date))+'</div><h3><a href="'+escape(row.url)+'">'+escape(row.title)+'</a></h3>'+(row.description?'<p>'+escape(row.description)+'</p>':'')+(row.note?'<details class="arrival-note"><summary>'+t('A note from the contributor','Una nota del colaborador')+'</summary><blockquote>'+escape(row.note)+'</blockquote></details>':'')+'<div class="arrival-foot">'+escape([row.category,row.points?row.points+t(' readings',' lecturas'):''].filter(Boolean).join(' · '))+'<a href="'+escape(row.url)+'">'+t('Explore this ORB','Explorar este ORB')+' <span aria-hidden="true">→</span></a></div></article></li>';
    }).join('');
    const empty=!rows.length?t('No published ORBs yet. The next addition will appear here.','Aún no hay ORBs publicados. La próxima adición aparecerá aquí.'):!staticMode&&!todayCount?t('No new ORBs today yet. Explore the latest additions below.','Aún no hay ORBs nuevos hoy. Explora las últimas adiciones abajo.'):'';
    return {html:(empty?'<p class="arrival-empty">'+empty+'</p>':'')+'<ol class="arrival-list">'+markup+'</ol>',remaining:Math.max(0,rows.length-shown.length),total:rows.length,todayCount};
  }
  return {publicationDate,entries,render};
});
