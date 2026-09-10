'use strict';
// Public, explicitly published Orb Navigator orbs; no visitor or GitHub credentials.
(()=>{
  const root=document.getElementById('star-orbs'),status=document.getElementById('star-status'),refresh=document.getElementById('star-refresh');
  const base='https://star-navigator-informational-dimensions.netlify.app';
  const add=(parent,tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;parent.append(e);return e;};
  async function load(){
    refresh.disabled=true;status.textContent='Loading saved Orb Navigator orbs…';
    try{
      const response=await fetch(base+'/api/archive',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();
      const text=await response.text();if(text.length>200000)throw Error();const data=JSON.parse(text);
      if(data.version!==1||!Array.isArray(data.orbs)||data.orbs.length>100)throw Error();
      const fragment=document.createDocumentFragment();
      for(const orb of data.orbs){
        if(!/^[a-f0-9]{64}$/.test(orb.id)||typeof orb.title!=='string'||orb.title.length>100||typeof orb.description!=='string'||orb.description.length>350||!Number.isInteger(orb.pointCount))throw Error();
        const url=base+'/?orb='+orb.id,row=add(fragment,'article',null,'community-row'),body=add(row,'div');
        const a=add(add(body,'h3'),'a',orb.title);a.href=url;
        add(body,'p',orb.description);add(body,'div',orb.pointCount+' readings · AI synthesis · Published by a visitor','community-meta');
        const open=add(add(row,'div',null,'community-actions'),'a','Explore orb ↗');open.href=url;
      }
      root.replaceChildren(fragment);status.textContent=data.orbs.length?data.orbs.length+' saved Orb Navigator '+(data.orbs.length===1?'orb.':'orbs.'):'No orbs have been sent yet. Explore a subject in Orb Navigator, then choose Send orb to Orb Archive.';
    }catch{status.textContent='Saved orbs could not be loaded. Try Refresh or open Orb Navigator.';}finally{refresh.disabled=false;}
  }
  refresh.addEventListener('click',load);load();
})();
