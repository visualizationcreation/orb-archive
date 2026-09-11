/* Copy only on an explicit click. Keep a selectable fallback for denied clipboard access. */
(()=>{'use strict';
const es=()=>document.documentElement.lang==='es';
window.ORBCopy=async(text,field,status,message)=>{
  status.textContent='';
  try{
    await navigator.clipboard.writeText(text);
    status.textContent=message;
    return true;
  }catch{
    field.value=text;field.hidden=false;field.focus();field.select();field.setSelectionRange(0,field.value.length);
    status.textContent=es()?'No se pudo copiar automáticamente. El texto completo está seleccionado: usa Copiar en tu dispositivo o Ctrl/Cmd+C.':'Automatic copying was unavailable. The complete text is selected: use Copy on your device or Ctrl/Cmd+C.';
    return false;
  }
};
const field=document.querySelector('[data-orbfill-request]'),button=document.querySelector('[data-copy-orbfill]'),status=document.querySelector('[data-orbfill-status]');
if(!field||!button||!status)return;
const english=field.value;
const spanish='Usa orbfill para crear un ORB de 40 puntos sobre [tu tema]. Valida el archivo .orb.txt etiquetado completo. Indica el número real de puntos y las notas de validación pendientes. Incluye todo el texto ORB validado en un único bloque de código de texto con botón Copiar, un enlace Abrir ORB Studio (https://visualizationcreation.github.io/orb-archive/studio.html) y el archivo .orb.txt descargable. Indícame que copie el texto, abra Studio, elija Pegar texto ORB y después Comprobar y abrir. Si el texto completo supera el límite de respuesta, proporciona una página HTML verificada con un botón Copiar texto ORB y el enlace a Studio; no recortes el ORB.';
let previous=english;
function sync(){if(field.value===previous){field.value=es()?spanish:english;previous=field.value}status.textContent=''}
new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});sync();
button.addEventListener('click',()=>window.ORBCopy(field.value,field,status,es()?'Solicitud copiada. Pégala en tu chat de IA.':'Request copied. Paste it into your AI chat.'));
})();
