const test=require('node:test'),assert=require('node:assert/strict'),feed=require('../todays-orbs.js');
const item=(id,date,extra={})=>({id,title:id,url:'https://orbiversity.com/'+id+'/',firstPublished:date,...extra});
const now=new Date(2026,8,19,15,0,0);
test('publication chronology ignores update dates, preserves existing entries and deduplicates',()=>{
 const rows=feed.entries([item('old','2026-09-01',{updated:'2026-09-19'}),item('new','2026-09-19'),item('old','2026-09-19')],{now});
 assert.deepEqual(rows.map(x=>x.id),['new','old']);assert.equal(rows[0].today,true);assert.equal(rows[1].today,false);
});
test('date-only values retain their calendar day; timestamp today uses viewer local time',()=>{
 assert.equal(feed.entries([item('date','2026-09-19')],{now})[0].today,true);
 const timestamp=new Date(2026,8,19,0,10).toISOString();assert.equal(feed.entries([item('clock','',{publishedAt:timestamp})],{now})[0].today,true);
});
test('invalid dates, future publications, inactive works and unsafe destinations',()=>{
 assert.equal(feed.publicationDate(item('bad','2026-02-30')),null);
 assert.deepEqual(feed.entries([item('future','2026-09-20'),item('inactive','2026-09-19',{status:'inactive'}),item('unsafe','2026-09-19',{url:'javascript:alert(1)'})],{now}),[]);
 assert.equal(feed.entries([item('unknown','')],{now})[0].today,false);
});
test('all contributor text is escaped and anonymous preference wins',()=>{
 const value=item('x','2026-09-19',{title:'<img src=x onerror=alert(1)>',description:'<script>x</script>',museum:{attribution:'anonymous',creator:{displayName:'PRIVATE'},contribution:{note:'<b>hello</b>'}}});
 const {html}=feed.render([value],{now});assert(!html.includes('<script>'));assert(!html.includes('<img'));assert(!html.includes('PRIVATE'));assert(html.includes('&lt;b&gt;'));
});
test('quiet days, static fallback and pagination are truthful',()=>{
 const values=Array.from({length:12},(_,i)=>item('orb-'+i,'2026-09-18'));
 const rendered=feed.render(values,{now});assert.equal(rendered.remaining,4);assert(rendered.html.includes('No new ORBs today'));assert.equal((rendered.html.match(/class="arrival"/g)||[]).length,8);
 const fallback=feed.render(values,{now,staticMode:true});assert(fallback.html.includes('Latest additions'));assert(!fallback.html.includes('No new ORBs today'));
});
test('a server-truncated introduction ends with its last complete sentence',()=>{
 const whole='This saved reading follows a real place and explains how its history connects to a wider city story.';
 const description=whole+' A longer unfinished excerpt arrives from the publication listing and cuts off in the middle of an incomple';
 assert.equal(feed.entries([item('excerpt','2026-09-19',{description})],{now})[0].description,whole);
});
