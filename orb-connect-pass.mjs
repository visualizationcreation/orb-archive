// Authored organizational pass, 2026-09-16. These are navigational collections,
// not new contributed editions. Membership reasons are editorial associations.
const mushroom='faf7c234be6830e344412a06f7f3209722ca790bac5fa8b10d1caab2d4a54e9f';
const rock='9db61f4fc86568127b29f4ad0670e271d06b770717c48b5ceaf51534d645dbc0';
const park='fda9c9649abb86b8d4eb199d0b667adb1b32c8f9808b556b99bd40670ae48148';
const food='ecc7ca1015fadddb949a148a8b020929b3a415121d62936d4f1eecb2d420e21f';
const postal='5e021d6818874eabe257dfc22358f6d0141573e994806e620dfb883f321af981';
const orsay=['34e3418d45ca094712392c38db7fc37cfecf9a07ef313cd97a061b5d9a1085aa','1e1165802b5fb2fccebe2be621c54987590383a5e225fd6ca2fe77f2b34a449b'];
export const pass={version:1,date:'2026-09-16',author:'ORB Connect · authored with Codex',groups:[
 {id:'forests-waters',title:'Forests & Waters',es:'Bosques y aguas',color:'#8ecbb7',summary:'Follow a watershed from forest floor to river, coast and city canopy. These worlds share places to notice, while keeping their distinct peoples and stories.',summaryEs:'Sigue el agua desde el suelo del bosque hasta el río, la costa y el arbolado urbano. Cada lugar conserva sus pueblos e historias.',members:[
 ['olympic-national-park','Mountains, rainforests, rivers and coast form the broad landscape.'],['quinault','A closer encounter with water, forest and the Quinault people.'],['south-sound-salmon-watching-guide','Follow living rivers through the return of salmon.'],[mushroom,'Look beneath the canopy at fungi and forest habitats.'],[park,'Cross to an urban forest: a comparison of wooded places, not a shared ecosystem.']]},
 {id:'mexico-voices',title:'Mexico: Places & Voices',es:'México: lugares y voces',color:'#e9b485',summary:'Move between a city forest, remembrance, regional cooking and changing musical scenes. Each is a different entrance into cultural life in Mexico.',summaryEs:'Recorre un bosque urbano, la memoria, la cocina regional y escenas musicales cambiantes: distintas entradas a la vida cultural de México.',members:[
 [park,'An urban forest brings museums, public space and layered histories together.'],['dia-de-muertos','Explore remembrance and regional traditions on their own terms.'],[rock,'Follow bands, concerts and the changing places of rock in Mexico.'],[food,'The cooking ORB includes Mexican and Yucatecan preparations within a wider Latin American scope.'],[postal,'Architecture and postal history offer another entrance into Mexico City.']]},
 {id:'seasons-gathering',title:'Food, Seasons & Gathering',es:'Alimentos, estaciones y encuentros',color:'#d6c47f',summary:'Begin with something you can notice: a changing leaf, a returning fish, a mushroom or a meal. Follow the different ways people observe seasons and gather around them.',summaryEs:'Empieza con una hoja, un pez que regresa, un hongo o una comida. Descubre formas de observar las estaciones y reunirse en torno a ellas.',members:[
 ['autumn-in-two-orbits','Poems and leaf photographs invite seasonal attention.'],['south-sound-salmon-watching-guide','Autumn viewing connects a seasonal event to particular places.'],[mushroom,'Field observation and careful identification; this connection is not an edibility recommendation.'],[food,'Move from observing the living world to techniques and traditions of cooking.'],['dia-de-muertos','A distinct seasonal tradition of remembrance and offerings.']]},
 {id:'belief-memory',title:'Belief, Memory & Meaning',es:'Creencias, memoria y sentido',color:'#c4b2dc',summary:'Explore how people hold a belief, remember a life or give a place meaning. The connections invite comparison without treating cultural traditions as psychological diagnoses.',summaryEs:'Explora cómo sostenemos creencias, recordamos una vida y damos sentido a un lugar. Compara perspectivas sin convertir tradiciones culturales en diagnósticos.',members:[
 ['core-belief','Examine belief patterns, protective rules and more flexible possibilities.'],['dia-de-muertos','Remembrance is expressed through offerings, craft and regional traditions.'],[park,'Trees, museums and public places carry different layers of memory.'],['autumn-in-two-orbits','Poetry offers another way to attend to change and meaning.']]},
 {id:'ways-seeing',title:'Ways of Seeing',es:'Formas de mirar',color:'#8bbfdf',summary:'Change the lens: learn a navigation method, question a belief, read a poem or examine a forecast. This is a collection of approaches, not a claim that they use the same evidence.',summaryEs:'Cambia de perspectiva: aprende a navegar, cuestiona una creencia, lee un poema o examina un pronóstico. Son enfoques distintos, con evidencias distintas.',members:[
 ['the-orb-skill','Learn the method for moving through questions and connected ideas.'],['crystal-ball-orb','Explore forecasts as possibilities to examine, rather than settled outcomes.'],['core-belief','Notice how assumptions shape interpretation.'],['autumn-in-two-orbits','See a familiar season through poems, photographs and listening.'],...orsay.map(id=>[id,'Slow-looking exercises and art offer a different way to see modern life.'])]},
 {id:'cities-museums',title:'Cities, Museums & Making',es:'Ciudades, museos y creación',color:'#dca99e',summary:'A station becomes a museum. A post office becomes a destination. A city forest opens into galleries and gardens. Follow the places people build to hold public life, art and memory.',summaryEs:'Una estación se convierte en museo. Un palacio postal invita a descubrirlo. Un bosque urbano abre caminos hacia galerías y jardines. Explora lugares de arte, memoria y vida pública.',members:[...orsay.map(id=>[id,'A preserved Musée d’Orsay edition: railway architecture, art and exercises in looking.']),[postal,'Discover a working civic building through its architecture and postal heritage.'],[park,'Museums, a castle and gardens connect cultural places within the urban forest.']]}
],links:[
 ['forests-waters','seasons-gathering','Follow forest habitats into seasonal observation.'],
 ['forests-waters','mexico-voices','Chapultepec opens a route from wooded places to Mexican cultural life.'],
 ['mexico-voices','belief-memory','Día de Muertos and Chapultepec offer different encounters with memory.'],
 ['mexico-voices','seasons-gathering','Cooking and seasonal traditions connect these collections.'],
 ['seasons-gathering','ways-seeing','Autumn can be encountered through observation or poetry.'],
 ['belief-memory','ways-seeing','Move from what we believe and remember to how we interpret.'],
 ['cities-museums','mexico-voices','Chapultepec and the Palacio Postal connect this route to Mexico City.'],
 ['cities-museums','ways-seeing','Move from the museum as a place to the art of looking.']
]};

export function createUniverse(catalog){
 const works=new Map(catalog.map(orb=>[orb.id,{...orb,kind:'work'}]));
 const titles=new Map();for(const work of works.values())titles.set(work.title,(titles.get(work.title)||0)+1);
 for(const work of works.values())if(titles.get(work.title)>1)work.editionLabel='Edition '+work.id.slice(0,6);
 const groups=pass.groups.map(group=>({...group,kind:'group',members:group.members.filter(([id])=>works.has(id))})).filter(g=>g.members.length);
 const nodes=new Map([...works,...groups.map(g=>[g.id,g])]);
 const edges=groups.flatMap(g=>g.members.map(([id,reason])=>({from:g.id,to:id,reason,kind:'membership'})));
 for(const [from,to,reason]of pass.links)if(nodes.has(from)&&nodes.has(to))edges.push({from,to,reason,kind:'bridge'});
 const grouped=new Set(edges.filter(e=>e.kind==='membership').map(e=>e.to));
 const arrivals=[...works.values()].filter(o=>!grouped.has(o.id));
 if(arrivals.length){const group={id:'new-arrivals',title:'New arrivals',es:'Nuevas llegadas',summary:'Published worlds waiting for the next organizing pass.',summaryEs:'Mundos publicados que esperan la próxima organización.',color:'#b7c5d2',kind:'group',members:arrivals.map(o=>[o.id,'A new published ORB, not yet placed in an authored collection.'])};groups.push(group);nodes.set(group.id,group);edges.push(...group.members.map(([id,reason])=>({from:group.id,to:id,reason,kind:'membership'})));}
 return {nodes,groups,edges,workCount:works.size};
}
export function neighborhood(graph,id){
 if(id==='universe'||!graph.nodes.has(id))return graph.groups.map(g=>({node:g,reason:g.summary}));
 return graph.edges.filter(e=>e.from===id||e.to===id).map(e=>({node:graph.nodes.get(e.from===id?e.to:e.from),reason:e.reason}));
}
export function pageOf(items,page=0,size=8){const pages=Math.max(1,Math.ceil(items.length/size)),index=Math.min(pages-1,Math.max(0,page));return {items:items.slice(index*size,(index+1)*size),page:index,pages};}
