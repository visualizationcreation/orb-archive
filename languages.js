/* Site-interface translations. Published ORBs and historical source records retain their own language. */
(()=>{
  const dictionary=window.ORB_SPANISH||{}, originals=new WeakMap(),attributes=new WeakMap();
  const params=new URLSearchParams(location.search);let saved;try{saved=localStorage.getItem('orb-site-language')}catch{}
  let language=params.get('lang')||saved||'en';if(language!=='es')language='en';
  function translate(text){const key=text.trim();let result=dictionary[key];if(!result){result=key.replace(/^(\d+) of (\d+) ORBs$/,'$1 de $2 ORBs').replace(/^(\d+) editions?$/,'$1 ediciones').replace(/^Listen( · .* ↗)$/,'Escuchar$1').replace(/^Watch( · .* ↗)$/,'Ver$1');}return text.replace(key,result||key);}
  function apply(root=document.body){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
    while(n=walker.nextNode()){if(n.parentElement.closest('script,style,code,textarea,.version-body,.community-row,.language-options,.orb-content'))continue;let original=originals.get(n);if(original===undefined){original=n.nodeValue;originals.set(n,original)}const value=language==='es'?translate(original):original;if(n.nodeValue!==value)n.nodeValue=value;}
    root.querySelectorAll('[aria-label],[placeholder]').forEach(el=>{let original=attributes.get(el);if(!original){original={};for(const name of ['aria-label','placeholder'])if(el.hasAttribute(name))original[name]=el.getAttribute(name);attributes.set(el,original)}for(const [name,value]of Object.entries(original))el.setAttribute(name,language==='es'?translate(value):value)});
    if(document.documentElement.lang!==language)document.documentElement.lang=language;document.title=language==='es'?translate(document.querySelector('title').dataset.english):document.querySelector('title').dataset.english;
    document.querySelectorAll('[data-language]').forEach(a=>{a.toggleAttribute('aria-current',a.dataset.language===language);if(a.dataset.language===language)a.setAttribute('aria-current','page')});
    document.querySelectorAll('a[href]').forEach(a=>{const u=new URL(a.href,location.href);if(u.origin===location.origin&&u.pathname.startsWith(new URL('./',location.href).pathname)&&/\/(?:index\.html|about\.html|start\.html|studio\.html|studio\.html)?$/.test(u.pathname)&&!a.dataset.language){u.searchParams.set('lang',language);a.href=u.href}});
    document.querySelectorAll('.language-note').forEach(el=>el.hidden=language!=='es');
  }
  document.querySelector('title').dataset.english=document.title;
  const observer=new MutationObserver(()=>{observer.disconnect();apply();observe()});
  function observe(){observer.observe(document.body,{childList:true,subtree:true,characterData:true})}
  function setLanguage(value){observer.disconnect();language=value;try{localStorage.setItem('orb-site-language',value)}catch{}const u=new URL(location.href);u.searchParams.set('lang',value);history.replaceState(null,'',u);apply();document.querySelector('.language-menu').open=false;observe()}
  document.querySelectorAll('[data-language]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();setLanguage(a.dataset.language)}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){const menu=document.querySelector('.language-menu');if(menu.open){menu.open=false;menu.querySelector('summary').focus()}}});
  apply();observe();
})();
