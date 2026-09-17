// One editorial home per saved orb. Associative links remain in Orb Connect,
// but the museum's presentation is a tree, independent of click order.
const primary={
 'olympic-national-park':'forests-waters','quinault':'forests-waters',
 'south-sound-salmon-watching-guide':'seasons-gathering','autumn-in-two-orbits':'seasons-gathering',
 'core-belief':'belief-memory','dia-de-muertos':'mexico-voices','the-orb-skill':'ways-seeing','crystal-ball-orb':'ways-seeing',
 'faf7c234be6830e344412a06f7f3209722ca790bac5fa8b10d1caab2d4a54e9f':'forests-waters',
 '9db61f4fc86568127b29f4ad0670e271d06b770717c48b5ceaf51534d645dbc0':'mexico-voices',
 'fda9c9649abb86b8d4eb199d0b667adb1b32c8f9808b556b99bd40670ae48148':'cities-museums',
 'ecc7ca1015fadddb949a148a8b020929b3a415121d62936d4f1eecb2d420e21f':'seasons-gathering',
 '5e021d6818874eabe257dfc22358f6d0141573e994806e620dfb883f321af981':'cities-museums',
 '34e3418d45ca094712392c38db7fc37cfecf9a07ef313cd97a061b5d9a1085aa':'orsay-editions',
 '1e1165802b5fb2fccebe2be621c54987590383a5e225fd6ca2fe77f2b34a449b':'orsay-editions'
};
const structures=[
 {id:'living-world',title:'Nature & Living Systems',es:'Naturaleza y sistemas vivos',color:'#8ecbb7',summary:'Forests, waters, seasons and the living world.',summaryEs:'Bosques, aguas, estaciones y el mundo vivo.',children:['forests-waters','seasons-gathering']},
 {id:'human-worlds',title:'Places & Culture',es:'Lugares y cultura',color:'#e9b485',summary:'Places, cultural life, cities and museums.',summaryEs:'Lugares, vida cultural, ciudades y museos.',children:['mexico-voices','cities-museums']},
 {id:'ideas-inner-worlds',title:'Ideas & Inner Worlds',es:'Ideas y mundos interiores',color:'#b9b3dc',summary:'Ways of looking, navigating, interpreting and understanding belief.',summaryEs:'Formas de mirar, navegar, interpretar y comprender las creencias.',children:['ways-seeing','belief-memory']},
 {id:'orsay-editions',title:'Musée d’Orsay · saved editions',es:'Musée d’Orsay · ediciones guardadas',color:'#dca99e',summary:'Two separately saved editions, collected in one place.',summaryEs:'Dos ediciones guardadas por separado, reunidas en un solo lugar.',children:[]}
];
export function createMuseumTree(graph){
 const nodes=new Map(graph.nodes),parent=new Map(),children=new Map([['universe',[]]]);
 for(const item of structures)if(item.id==='orsay-editions'?[...nodes.keys()].some(id=>primary[id]===item.id):item.children.some(id=>nodes.has(id)))nodes.set(item.id,{...item,kind:'group',treeOnly:true});
 function attach(id,owner){if(!nodes.has(id)||parent.has(id))return;const p=nodes.has(owner)?owner:'universe';parent.set(id,p);if(!children.has(p))children.set(p,[]);children.get(p).push(id);if(!children.has(id))children.set(id,[]);}
 for(const item of structures){attach(item.id,item.id==='orsay-editions'?'cities-museums':'universe');for(const child of item.children)attach(child,item.id);}
 for(const node of nodes.values())if(node.kind==='group')attach(node.id,'universe');
 for(const node of nodes.values())if(node.kind==='work'){
  const fallback=graph.edges.find(e=>e.kind==='membership'&&e.to===node.id)?.from;
  attach(node.id,primary[node.id]||fallback||'universe');
 }
 return {...graph,nodes,parent,children};
}
