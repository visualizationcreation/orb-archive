const API='https://www.orbforma.com/api/museum-comments';
const KEY='orb-museum-comment-identity-v1';
const make=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const button=(text,fn)=>{const el=make('button',text);el.type='button';el.onclick=fn;return el;};
function identity(){
 try{let saved=JSON.parse(localStorage.getItem(KEY)||'null');if(!/^[a-f0-9]{64}$/.test(saved?.key||''))saved={key:Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join(''),name:'',ids:[]};if(!Array.isArray(saved.ids))saved.ids=[];localStorage.setItem(KEY,JSON.stringify(saved));return saved;}catch{return null;}
}
export function mountMuseumComments(){
 if(!document.querySelector('[data-comments-style]')){const css=make('link');css.rel='stylesheet';css.href=new URL('./museum-comments.css',import.meta.url);css.dataset.commentsStyle='';document.head.append(css);}
 const element=make('section','','museum-comments');element.id='orb-comments';element.setAttribute('aria-label','ORB discussion');element.hidden=true;
 const heading=make('h2','Comments'),about=make('p','','comments-about'),status=make('p','','comments-status');status.setAttribute('role','status');
 const header=make('div','','comments-heading'),refresh=button('Refresh',()=>load());header.append(heading,refresh);
 const form=make('form'),nameLabel=make('label','Display name'),name=make('input'),textLabel=make('label','Add to the conversation'),text=make('textarea');
 name.maxLength=60;name.required=true;name.autocomplete='nickname';text.maxLength=1200;text.rows=3;text.required=true;nameLabel.append(name);textLabel.append(text);
 const trap=make('label','Website');trap.className='comments-trap';trap.setAttribute('aria-hidden','true');const website=make('input');website.tabIndex=-1;website.autocomplete='off';trap.append(website);
 const note=make('p','Comments are public. Display names are unverified. Keep it kind and on topic. Up to 10 comments a day per browser.','comments-policy');
 const replyStatus=make('p','','comments-reply-status'),cancel=button('Cancel reply',()=>{parent=null;replyStatus.textContent='';cancel.hidden=true;});cancel.hidden=true;
 const submit=make('button','Post comment');submit.type='submit';submit.className='comments-submit';
 const actions=make('div','','comments-actions');actions.append(submit,cancel);form.append(nameLabel,textLabel,trap,replyStatus,actions,note);
 const list=make('div','','comments-list'),more=button('Show more comments',()=>{limit+=10;render();});more.hidden=true;
 const manage=make('a','Owner moderation');manage.className='comments-manage';manage.href='https://www.orbforma.com/comments.html';
 element.append(header,about,form,status,list,more,manage);
 let orb=null,serial=0,rows=[],parent=null,owner=false,limit=10,posting=false,pending=null,abort;
 const drafts=new Map();let person=identity();name.value=person?.name||'';
 async function api(method='GET',body,id=orb,signal){
  const response=await fetch(API+'?orb='+encodeURIComponent(id),{method,credentials:location.origin==='https://www.orbforma.com'?'same-origin':'omit',signal:signal||AbortSignal.timeout(20000),...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Comments could not load. Try Refresh.');return data;
 }
 function render(){
  list.replaceChildren();heading.textContent=rows.filter(c=>!c.deleted).length+' comments';
  const roots=rows.filter(c=>!c.parent).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
  function row(c,reply=false){
   const article=make('article','',reply?'comment comment-reply':'comment');article.id='comment-'+c.id;
   const by=make('div','','comment-by'),avatar=make('span',c.deleted?'':c.name.slice(0,1).toLocaleUpperCase(),'comment-avatar');avatar.setAttribute('aria-hidden','true');
   const author=make('strong',c.deleted?'Comment removed':c.name),date=make('time',new Date(c.createdAt).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'}));date.dateTime=c.createdAt;by.append(avatar,author,date);
   article.append(by,make('p',c.deleted?'This comment has been removed. Replies remain available.':c.text,'comment-text'));
   const controls=make('div','','comment-controls');
   if(!c.deleted&&!reply)controls.append(button('Reply',()=>{parent=c.id;replyStatus.textContent='Replying to '+c.name;cancel.hidden=false;text.focus();}));
   if(!c.deleted&&(owner||person?.ids.includes(c.id))){const remove=button('Remove',async()=>{
    if(!confirm('Remove this comment? Its replies will remain.'))return;
    const target=orb;remove.disabled=true;try{const data=await api('POST',{action:'delete',id:c.id,clientKey:person?.key},target);if(orb!==target)return;rows=rows.map(item=>item.id===c.id?data.comment:item);render();status.textContent='Comment removed.';}catch(error){if(target===orb){status.textContent=error.message;remove.disabled=false;}}
   });controls.append(remove);}
   article.append(controls);return article;
  }
  for(const root of roots.slice(0,limit)){
   const article=row(root),replies=rows.filter(c=>c.parent===root.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
   if(replies.length){const detail=make('details','','comment-replies');detail.append(make('summary',replies.length+(replies.length===1?' reply':' replies')));for(const c of replies)detail.append(row(c,true));article.append(detail);}
   list.append(article);
  }
  if(!roots.length)list.append(make('p','Be the first to share a thought about this ORB.','comments-empty'));
  more.hidden=roots.length<=limit;
 }
 async function load(){
  if(!orb)return;const current=++serial,id=orb;abort?.abort();abort=new AbortController();refresh.disabled=true;status.textContent='Loading comments…';
  try{const data=await api('GET',null,id,AbortSignal.any([abort.signal,AbortSignal.timeout(20000)]));if(current!==serial)return;rows=data.comments;owner=data.owner;render();status.textContent='Newest comments first.';}catch(error){if(current===serial)status.textContent=error.name==='AbortError'?'Comments did not load. Try Refresh.':error.message;}finally{if(current===serial)refresh.disabled=false;}
 }
 form.onsubmit=async event=>{
  event.preventDefault();if(posting||!orb||!form.reportValidity())return;person=identity();
  if(!person){status.textContent='Browser storage is unavailable. Enable it to post and remove your comments.';return;}
  const id=orb,content={action:'post',clientKey:person.key,name:name.value.trim(),text:text.value.trim(),parent,website:website.value};
  const fingerprint=JSON.stringify({orb:id,...content});if(pending?.fingerprint!==fingerprint)pending={fingerprint,id:crypto.randomUUID()};
  person.name=content.name;person.ids=[...new Set([...person.ids,pending.id])].slice(-500);try{localStorage.setItem(KEY,JSON.stringify(person));}catch{status.textContent='Could not save your comment identity. Enable browser storage and try again.';return;}
  posting=true;submit.disabled=true;status.textContent='Posting comment…';
  try{const data=await api('POST',{...content,id:pending.id},id);drafts.delete(id);if(orb!==id)return;rows=rows.filter(c=>c.id!==data.comment.id);rows.push(data.comment);text.value='';parent=null;cancel.hidden=true;replyStatus.textContent='';pending=null;render();status.textContent='Your comment is published.';}catch(error){if(id===orb)status.textContent=error.message;}finally{posting=false;submit.disabled=false;}
 };
 function update(listing){
  const id=listing?.id||null;if(id===orb)return;
  if(orb)drafts.set(orb,{text:text.value,parent});serial++;abort?.abort();orb=id;rows=[];owner=false;parent=null;pending=null;limit=10;list.replaceChildren();element.hidden=!orb;
  if(!orb)return;
  const draft=drafts.get(id);text.value=draft?.text||'';parent=draft?.parent||null;replyStatus.textContent=parent?'Continue your reply':'';cancel.hidden=!parent;
  about.textContent='A conversation about '+(listing.title||'this ORB')+'.';heading.textContent='Comments';manage.href='https://www.orbforma.com/comments.html?orb='+encodeURIComponent(id);void load();
 }
 return {element,update,destroy(){serial++;abort?.abort();element.remove();}};
}
