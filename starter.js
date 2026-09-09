(()=>{
const field=document.getElementById('starter'),button=document.getElementById('copy-starter'),status=document.getElementById('copy-status');
const messages={en:'I’m new to AI. Help me explore a topic I choose in simple language. Ask me what I’m curious about, then offer three interesting directions. Take one step at a time. Separate established facts from uncertainty, and provide reliable sources for factual claims. Please reply in English.',es:'Soy nuevo en la IA. Ayúdame a explorar un tema que elija con palabras sencillas. Pregúntame qué me interesa y luego propón tres caminos interesantes. Avanza paso a paso. Distingue los hechos comprobados de la incertidumbre y proporciona fuentes fiables para las afirmaciones sobre hechos. Responde en español.'};
const sync=()=>{field.value=messages[document.documentElement.lang]||messages.en;status.textContent=''};
new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});sync();
button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(field.value);status.textContent=document.documentElement.lang==='es'?'Copiado. Pégalo en tu chat de IA.':'Copied. Paste it into your AI chat.'}catch{field.focus();field.select();status.textContent=document.documentElement.lang==='es'?'Selecciona y copia el mensaje de arriba.':'Select and copy the message above.'}});
})();
