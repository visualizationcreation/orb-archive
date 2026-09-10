/* A movable seam between the silver instrument and the reading window. */
(()=>{'use strict';
const workspace=document.querySelector('.studio-workspace');
const divider=document.getElementById('workspace-divider');
if(!workspace||!divider)return;
const desktop=matchMedia('(min-width:761px)'),key='orb-studio-column-width';
let preferred=null,drag=null,current=0;
try{const saved=localStorage.getItem(key),value=Number(saved);if(saved!==null&&Number.isFinite(value)&&value>=200&&value<=600)preferred=value}catch{}
const es=()=>document.documentElement.lang==='es';
function bounds(){return{min:200,max:Math.max(200,Math.floor(Math.min(600,workspace.clientWidth*.55,workspace.clientWidth-38-360)))}}
function defaultWidth(){return innerWidth<=1050?240:300}
function update(value=preferred??defaultWidth()){
  if(!desktop.matches)return;
  const {min,max}=bounds();current=Math.round(Math.max(min,Math.min(max,value)));
  workspace.style.setProperty('--studio-column-width',`${current}px`);
  divider.setAttribute('aria-valuemin',min);divider.setAttribute('aria-valuemax',max);divider.setAttribute('aria-valuenow',current);
  divider.setAttribute('aria-valuetext',es()?`Columna izquierda: ${current} píxeles`:`Left column: ${current} pixels`);
}
function language(){
  divider.setAttribute('aria-label',es()?'Ancho de la columna izquierda':'Left column width');
  divider.title=es()?'Arrastra para ajustar. Usa las flechas para cambiar el ancho; Intro o doble clic para restablecer.':'Drag to resize. Use arrow keys to adjust; Enter or double-click to reset.';
  update(drag?current:undefined);
}
function save(){preferred=current;try{localStorage.setItem(key,String(preferred))}catch{}}
function finish(commit){
  if(!drag)return;const before=drag;drag=null;
  document.body.classList.remove('studio-resizing');
  if(commit)save();else update(before.width);
  if(divider.hasPointerCapture(before.id))divider.releasePointerCapture(before.id);
}
function reset(){finish(false);preferred=null;try{localStorage.removeItem(key)}catch{}update()}
divider.addEventListener('pointerdown',event=>{
  if(!desktop.matches||!event.isPrimary||event.button!==0)return;
  event.preventDefault();divider.focus({preventScroll:true});
  drag={id:event.pointerId,x:event.clientX,width:current};
  divider.setPointerCapture(event.pointerId);document.body.classList.add('studio-resizing');
});
divider.addEventListener('pointermove',event=>{if(drag&&event.pointerId===drag.id)update(drag.width+event.clientX-drag.x)});
divider.addEventListener('pointerup',event=>{if(drag&&event.pointerId===drag.id)finish(true)});
divider.addEventListener('pointercancel',()=>finish(false));
divider.addEventListener('lostpointercapture',()=>finish(false));
divider.addEventListener('dblclick',reset);
divider.addEventListener('keydown',event=>{
  if(!desktop.matches)return;
  if(event.key==='Escape'&&drag){event.preventDefault();finish(false);return}
  if(event.key==='Enter'){event.preventDefault();reset();return}
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();finish(false);
  const {min,max}=bounds(),step=event.shiftKey?40:10;
  update(event.key==='Home'?min:event.key==='End'?max:current+(event.key==='ArrowLeft'?-step:step));save();
});
window.addEventListener('blur',()=>finish(false));
let observedWidth=0;
new ResizeObserver(()=>{const width=workspace.clientWidth;if(width!==observedWidth){observedWidth=width;finish(false);update()}}).observe(workspace);
desktop.addEventListener('change',()=>{finish(false);update()});
new MutationObserver(language).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
language();
})();
