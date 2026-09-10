/* ORB Fill generic-profile receiver. Local parsing only. Vendor provenance: references/file-contract.md in the downloadable skill. */
window.OrbFill=(()=>{
const Legacy=(()=>{const module={exports:{}};
function lex(src){
  const out=[]; let cur=null,key="",buf=[];
  const flush=()=>{ if(cur&&key){ (cur.f[key]=cur.f[key]||[]).push(buf.join("\n").trimEnd()); key="";buf=[];} };
  src.replace(/\r\n?/g,"\n").split("\n").forEach((line,i)=>{
    const t=line.trim();
    if(key && (/^\s/.test(line)||!t)){ buf.push(line.startsWith("  ")?line.slice(2):line.trimStart()); return; }
    flush();
    if(!t||t.startsWith("#"))return;
    const open=t.match(/^\[([A-Z][A-Z0-9_]*)\]$/), close=t.match(/^\[\/([A-Z][A-Z0-9_]*)\]$/);
    if(open){ if(cur)throw new Error(`Line ${i+1}: close [/${cur.tag}] before opening [${open[1]}].`);
      cur={tag:open[1],f:{}}; return; }
    if(close){ if(!cur||cur.tag!==close[1])throw new Error(`Line ${i+1}: unexpected [/${close[1]}].`);
      out.push(cur); cur=null; return; }
    if(!cur)throw new Error(`Line ${i+1}: fields must sit inside a [TAG] block.`);
    const c=line.indexOf(":"); if(c<0)throw new Error(`Line ${i+1}: expected "key: value".`);
    key=line.slice(0,c).trim(); const v=line.slice(c+1).trim();
    if(v==="|"){buf=[];}else{buf=[v];flush();}
  });
  flush(); if(cur)throw new Error(`[${cur.tag}] was never closed.`);
  return out;
}
const g=(b,k)=>((b.f[k]||[]).slice(-1)[0]||"").trim();
const req=(b,k)=>{const v=g(b,k); if(!v)throw new Error(`[${b.tag}] needs ${k}:`); return v;};
const list=(b,k)=>g(b,k).split(",").map(s=>s.trim()).filter(Boolean);
const num=(b,k,d)=>{const v=g(b,k); if(!v&&d!==undefined)return d; const n=Number(v);
  if(!Number.isFinite(n))throw new Error(`[${b.tag}] ${k}: must be a number.`); return n;};

function parseOrb(src){
  const bl=lex(src), orb=bl.find(b=>b.tag==="ORB");
  if(!orb)throw new Error("A tagged orb file must contain an [ORB] block.");
  const THREAD=bl.filter(b=>b.tag==="THREAD").map(b=>({id:req(b,"id"),label:req(b,"label"),
    gloss:g(b,"gloss")||undefined,entry:req(b,"entry"),cap:g(b,"cap")||undefined}));
  if(!THREAD.length)THREAD.push({id:"root",label:g(orb,"subject_label")||"root",entry:g(orb,"subject_id")});
  const WORLDS={}; THREAD.forEach(t=>WORLDS[t.id]=[]);
  const byId=new Map();
  bl.filter(b=>b.tag==="POINT").forEach(b=>{
    const w=g(b,"world")||THREAD[0].id, par=g(b,"parent");
    const p={id:req(b,"id"),label:req(b,"label"),level:num(b,"level",0),lon:num(b,"lon",0),
      view:req(b,"view"),tier:g(b,"tier")?num(b,"tier"):undefined,
      ab:g(b,"ab")?num(b,"ab"):undefined,period:g(b,"period")||undefined,
      parent:(par==="null"||!par)?null:par,
      upAlt:list(b,"up_alt").length?list(b,"up_alt"):undefined,
      refs:list(b,"refs").length?list(b,"refs"):undefined,
      records:list(b,"records"),
      tags:list(b,"tags"),frontier:g(b,"frontier")||undefined,
      forward:g(b,"forward")||undefined,back:g(b,"back")||undefined,
      does:g(b,"does")||undefined,when:g(b,"when")||undefined,
      reversible:g(b,"reversible")||undefined,forecloses:g(b,"forecloses")||undefined,
      cadence:g(b,"cadence")||undefined,phase:g(b,"phase")||undefined,
      phase_zero:g(b,"phase_zero")||undefined,spread:g(b,"spread")||undefined,
      clock:g(b,"clock")||undefined,angles:[],images:[],materials:[],recs:[],rhymes:[],pool:[],world:w};
    (WORLDS[w]=WORLDS[w]||[]).push(p); byId.set(p.id,p);
  });
  const attach=(tag,fn)=>bl.filter(b=>b.tag===tag).forEach(b=>{
    const p=byId.get(req(b,"point"));
    if(!p)throw new Error(`[${tag}] references an unknown point: ${g(b,"point")}`);
    fn(p,b);
  });
  attach("ANGLE",(p,b)=>p.angles.push({l:req(b,"label"),f:req(b,"claim")}));
  attach("MATERIAL",(p,b)=>p.materials.push({title:req(b,"title"),kind:g(b,"kind")||"",
    source:g(b,"source")||"",minutes:g(b,"minutes")||"",url:g(b,"url")||"",
    summary:g(b,"summary")||"",text:g(b,"text")||""}));
  attach("IMAGE",(p,b)=>p.images.push({src:req(b,"src"),alt:g(b,"alt")||"",
    caption:g(b,"caption")||"",credit:g(b,"credit")||"",href:g(b,"href")||""}));
  attach("RECORD",(p,b)=>p.records.push({year:req(b,"year"),event:g(b,"event")}));
  attach("RHYME",(p,b)=>p.rhymes.push({text:g(b,"text"),null_cause:g(b,"null_cause"),disanalogy:g(b,"disanalogy")}));
  attach("POOL",(p,b)=>p.pool.push({member:g(b,"member"),mechanism:g(b,"mechanism"),
    falsifier:g(b,"falsifier"),text:g(b,"text")}));
  const APEX=bl.filter(b=>b.tag==="APEX").map(b=>({a:req(b,"a"),b:req(b,"b"),apex:req(b,"apex"),
    note:g(b,"note")||"",degenerate:["true","yes","1"].includes(g(b,"degenerate").toLowerCase())}));
  const NUMBERS=bl.filter(b=>b.tag==="NUMBER").map(b=>({id:req(b,"id"),label:req(b,"label"),
    value:req(b,"value"),note:g(b,"note")||""}));
  const PORTALS=bl.filter(b=>b.tag==="PORTAL_AXIS").map(b=>({id:req(b,"id"),label:req(b,"label"),
    negative:g(b,"negative"),positive:g(b,"positive"),
    back_src:g(b,"back_src"),back_label:g(b,"back_label"),
    forward_src:g(b,"forward_src"),forward_label:g(b,"forward_label")}));
  const SOURCES=bl.filter(b=>b.tag==="SOURCE").map(b=>({id:g(b,"id")||undefined,title:req(b,"title"),
    publisher:g(b,"publisher")||undefined,date:g(b,"date")||undefined,kind:g(b,"kind")||undefined,
    url:g(b,"url")||undefined,points:list(b,"points")}));
  // BACK is the inverse of FORWARD unless stated. Authoring both invites
  // them to disagree, and a consequence link that runs one way only is
  // almost always an authoring slip rather than a real asymmetry.
  byId.forEach(p=>{ if(p.forward){ const nx=byId.get(p.forward); if(nx&&!nx.back)nx.back=p.id; } });
  return {SUBJECT:{id:req(orb,"subject_id"),label:req(orb,"subject_label")},THREAD,WORLDS,SOURCES,NUMBERS,PORTALS,APEX,
    BUILD:{kind:(g(orb,"kind")||"reading").toLowerCase(),density:g(orb,"density")||undefined,
      positions:g(orb,"positions")?num(orb,"positions"):byId.size,
      authored:g(orb,"authored")||undefined,note:g(orb,"note")||undefined,
      reduction:g(orb,"reduction")||undefined}};
}

/* ============ validator (subset, mirrors orb-validate.js) ============ */
function isTitleCase(s){const w=String(s).trim().split(/\s+/);
  const c=w.filter(x=>!/^(a|an|the|of|in|on|for|and|or|to|by|with|as|at|from)$/i.test(x));
  return c.length>=2 && c.every(x=>/^[A-Z0-9]/.test(x));}
const DEGEN_R=["how do these relate","both involve","what are the implications","tell me more"];
const DEGEN_W=["consider your options","think about the tradeoffs","review and iterate","assess your needs"];
function capacity(i,n){if(n<=1)return 12;const lat=58-116*i/(n-1);
  return Math.max(4,Math.round(12*Math.cos(lat*Math.PI/180)));}
function arc(a,b){const d=Math.abs(((a-b)%360+360)%360);return d>180?360-d:d;}
function validate(doc){
  const E=[],W=[],pts=Object.values(doc.WORLDS).flat(),byId=new Map(pts.map(p=>[p.id,p]));
  const kind=doc.BUILD.kind,working=kind==="working";
  if(!["reading","working","rhythm"].includes(kind))E.push(`kind must be reading, working or rhythm — got "${kind}".`);
  if(!byId.has(doc.SUBJECT.id))E.push(`subject_id "${doc.SUBJECT.id}" does not name a position.`);
  const seen=new Set();
  pts.forEach(p=>{
    if(seen.has(p.id))E.push(`Duplicate position id: ${p.id}`); seen.add(p.id);
    if(p.parent!=null&&!byId.has(p.parent))E.push(`${p.id}: parent "${p.parent}" does not resolve.`);
    (p.upAlt||[]).forEach(u=>{if(!byId.has(u))E.push(`${p.id}: up_alt "${u}" does not resolve.`);});
    if(p.forward&&!byId.has(p.forward))E.push(`${p.id}: forward "${p.forward}" does not resolve.`);
    if(p.back&&!byId.has(p.back))E.push(`${p.id}: back "${p.back}" does not resolve.`);
    if(p.lon<0||p.lon>359)E.push(`${p.id}: lon must be 0–359 — got ${p.lon}.`);
    if(!Number.isInteger(p.level))E.push(`${p.id}: level must be a whole number.`);
    if(p.frontier)p.frontier.split(",").map(s=>s.trim()).forEach(d=>{
      if(!["up","down","left","right","forward","back"].includes(d.toLowerCase()))
        E.push(`${p.id}: frontier "${d}" is not a direction.`);});
    if(working){
      if(!p.does)E.push(`${p.id}: a working position needs does:.`);
      if(!p.when)E.push(`${p.id}: a working position needs when:.`);
      const r=(p.reversible||"").toLowerCase();
      if(!r)E.push(`${p.id}: needs reversible: yes | partial | no.`);
      else if(r==="no"&&!p.forecloses)E.push(`${p.id}: reversible: no requires forecloses:.`);
    }
    if(kind==="rhythm"){
      const cad=(p.cadence||"").toLowerCase(), weak=cad==="once"||cad==="pair";
      if(p.period&&weak)E.push(`${p.id}: cadence "${cad}" cannot carry a period — two occurrences define an interval, not a rhythm.`);
      if(p.pool.length&&weak)E.push(`${p.id}: projection is closed under cadence "${cad}".`);
      if(p.pool.length&&p.pool.length<3)E.push(`${p.id}: a pool needs 3–5 members — found ${p.pool.length}.`);
      const mech=new Set();
      p.pool.forEach((m,i)=>{
        if(!m.mechanism)E.push(`${p.id}: pool member ${i+1} needs mechanism:.`);
        if(!m.falsifier)E.push(`${p.id}: pool member ${i+1} needs falsifier:.`);
        else if(!/\b(19|20|21)\d{2}\b/.test(m.falsifier))E.push(`${p.id}: pool member ${i+1} falsifier needs a year.`);
        const k=(m.mechanism||"").toLowerCase().replace(/[^a-z0-9 ]/g,"").trim();
        if(k&&mech.has(k))E.push(`${p.id}: two pool members share the mechanism "${m.mechanism}".`);
        mech.add(k);
        if(/\b(due|overdue|inevitable)\b/i.test(m.text||""))E.push(`${p.id}: a projection may not say "due" or "overdue".`);
      });
      if(p.pool.length&&!p.spread)E.push(`${p.id}: a pool requires spread:.`);
      if(p.phase&&!p.phase_zero)E.push(`${p.id}: phase requires phase_zero:.`);
    }
    p.images.forEach(im=>{
      if(!/^(https?:\/\/|data:image\/|\.?\/|[a-z0-9._-]+\/)/i.test(im.src))
        E.push(`${p.id}: image src must be http(s), a data:image URI, or a local path.`);
      if(!im.alt)W.push(`${p.id}: image has no alt text.`);
    });
    const vw=p.view.trim().split(/\s+/).length;
    if(vw<60)W.push(`${p.id}: reading is ${vw} words; under 60 is thin.`);
    if(p.angles.length<2)W.push(`${p.id}: ${p.angles.length} angle(s); every position should offer two ways onward.`);
    const degen=working?DEGEN_W:DEGEN_R;
    p.angles.forEach(a=>{const t=(a.l+" "+a.f).toLowerCase();
      const h=degen.find(d=>t.includes(d)); if(h)W.push(`${p.id}: angle "${a.l}" is degenerate ("${h}").`);});
    if(!working&&(isTitleCase(p.label)||p.label.trim().split(/\s+/).length<4))
      W.push(`${p.id}: label "${p.label}" reads as a filing category.`);
    if(p.tags.length>7)W.push(`${p.id}: ${p.tags.length} tags; past seven every filter returns everything.`);
  });
  (doc.SOURCES||[]).forEach(s=>{ if(!s.title)E.push("Every source needs a title.");
    (s.points||[]).forEach(id=>{if(!byId.has(id))E.push(`Source “${s.title}” references an unknown point: ${id}`);});});
  doc.THREAD.forEach(t=>{ if(!doc.WORLDS[t.id])E.push(`Missing world: ${t.id}`);
    else if(!byId.has(t.entry))E.push(`Missing thread entry: ${t.entry}`);});
  const levels=[...new Set(pts.map(p=>p.level))].sort((a,b)=>b-a);
  levels.forEach((lv,i)=>{const band=pts.filter(p=>p.level===lv),cap=capacity(i,levels.length);
    if(band.length>cap)W.push(`band level ${lv} holds ${band.length} positions; about ${cap} stay legible.`);
    if(band.length===1&&levels.length>1)W.push(`band level ${lv} has one member — a ring of one is a point.`);});
  pts.forEach(p=>{ if(p.parent==null)return; const par=byId.get(p.parent); if(!par)return;
    const d=arc(p.lon,par.lon);
    if(d>95)W.push(`${p.id}: sits ${Math.round(d)}° from parent "${p.parent}"; past 95° the DOWN-then-UP return breaks.`);});
  if(levels.length>1&&pts.every(p=>(p.ab||0)===0))
    W.push("every position reads ab: 0 across a multi-band orb — the anchor pass was probably skipped.");
  return {errors:E,warnings:W};
}


module.exports = { lex, parseOrb, validate };

return module.exports;})();
const Full=(()=>{const module={exports:{}};
/* Orb Studio — validator v2
 *
 * Takes the parsed orb document (output of the existing tagged-text or JSON
 * parser, AFTER the structural normaliser) and grades it.
 *
 *   const {errors, warnings} = validateOrb(doc);
 *   if (errors.length) -> refuse the file, show errors
 *   else -> load it, show warnings in a dismissible panel
 *
 * ERRORS are things that make the orb wrong or unnavigable.
 * WARNINGS are things that make it thin. The file still loads: an author
 * fixing warnings is the loop this exists to create, and an author fighting
 * a rejection over a one-member ring stops using the tool.
 *
 * No dependencies. Pure function. Safe to run on every load.
 */

const DEGENERATE_READING = [
  "how do these relate", "both involve", "what are the implications",
  "tell me more", "what is the connection", "why does this matter",
  "explore further", "learn more about"
];

const DEGENERATE_WORKING = [
  "consider your options", "think about the tradeoffs", "evaluate what works",
  "review and iterate", "assess your needs", "weigh the pros and cons",
  "decide what is best", "plan accordingly"
];

const FORBIDDEN_PROJECTION = ["due", "overdue", "inevitable", "certain to"];

// Label-grammar heuristics. Deliberately narrow: these exist to catch
// "The Syllable Method", not to parse English. A whitelist of verbs was
// tried first and produced false positives on every ordinary verb outside
// the list (costs, oscillate, dominates, settles), so the test is now
// structural — Title Case, or too short to be a claim.
function isTitleCase(s) {
  const w = String(s).trim().split(/\s+/);
  if (w.length < 2) return false;
  const content = w.filter(x => !/^(a|an|the|of|in|on|for|and|or|to|by|with|as|at|from)$/i.test(x));
  if (content.length < 2) return false;
  return content.every(x => /^[A-Z0-9]/.test(x));
}

const SUBJECT_LEAD = /^(the|a|an|this|these|that|those|its|his|her|their|our|my)\b/i;

function words(s) { return String(s || "").trim().split(/\s+/).filter(Boolean); }
function lc(s) { return String(s || "").toLowerCase(); }

/* ---------- geometry ---------- */

// Bands are spread across ±58° latitude. Ring circumference scales with
// cos(latitude), so the outermost bands hold roughly half what the
// equatorial band does. Twelve legible slots at the equator.
function bandCapacity(bandIndex, bandCount) {
  if (bandCount <= 1) return 12;
  const lat = 58 - (116 * bandIndex) / (bandCount - 1);
  return Math.max(4, Math.round(12 * Math.cos((lat * Math.PI) / 180)));
}

function arc(a, b) {
  const d = Math.abs(((a - b) % 360 + 360) % 360);
  return d > 180 ? 360 - d : d;
}

// Minimum legible gap at a band: 30° at the equator, scaled by 1/cos(lat).
// Labels closer than this collide and the studio drops them.
function minGap(bandIndex, bandCount) {
  if (bandCount <= 1) return 30;
  const lat = 58 - (116 * bandIndex) / (bandCount - 1);
  return 30 / Math.cos((lat * Math.PI) / 180);
}

// A folded ring spans ±95°, so it holds roughly half a closed one.
function foldedCapacity(bandIndex, bandCount) {
  return Math.floor(190 / minGap(bandIndex, bandCount)) + 1;
}

// Pearson r, for the ab/ring-distance collinearity check.
function corr(xs, ys) {
  const n = xs.length;
  if (n < 4) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/* ---------- text similarity (for the substitution test) ---------- */

function shingles(text, n = 3) {
  const w = words(lc(text).replace(/[^a-z0-9\s]/g, " "));
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
}

function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let hit = 0;
  for (const s of a) if (b.has(s)) hit++;
  return hit / Math.min(a.size, b.size);
}

/* ---------- main ---------- */

function validateOrb(doc) {
  const errors = [];
  const warnings = [];
  const E = (msg, where) => errors.push(where ? `${where}: ${msg}` : msg);
  const W = (msg, where) => warnings.push(where ? `${where}: ${msg}` : msg);

  if (!doc || typeof doc !== "object") { E("The file is not an orb document."); return { errors, warnings }; }

  const build = doc.BUILD || {};
  const kindRaw = lc(build.kind || "reading");
  const KINDS = ["reading", "working", "rhythm"];
  if (!KINDS.includes(kindRaw)) {
    E(`kind must be one of ${KINDS.join(", ")} — got "${build.kind}".`);
  }
  const kind = KINDS.includes(kindRaw) ? kindRaw : "reading";
  const isWorking = kind === "working";
  const isRhythm = kind === "rhythm";

  const threads = Array.isArray(doc.THREAD) ? doc.THREAD : [];
  const worlds = doc.WORLDS || {};
  const points = Object.values(worlds).flat();
  const byId = new Map(points.map(p => [p.id, p]));

  if (!points.length) { E("The orb contains no positions."); return { errors, warnings }; }

  /* --- referential integrity --- */

  if (doc.SUBJECT && doc.SUBJECT.id && !byId.has(doc.SUBJECT.id)) {
    E(`subject_id "${doc.SUBJECT.id}" does not name a position.`);
  }

  for (const p of points) {
    if (p.parent != null && !byId.has(p.parent)) {
      E(`parent "${p.parent}" does not resolve.`, p.id);
    }
    (p.upAlt || []).forEach(u => {
      if (!byId.has(u)) E(`up_alt "${u}" does not resolve.`, p.id);
    });
    if (p.forward && !byId.has(p.forward)) E(`forward "${p.forward}" does not resolve.`, p.id);
    if (p.back && !byId.has(p.back)) E(`back "${p.back}" does not resolve.`, p.id);
    if (p.forward === p.id) E("forward points at itself.", p.id);
    (p.refs || []).forEach(r => {
      if (!byId.has(r)) W(`refs "${r}" does not resolve.`, p.id);
    });
    if (!Number.isFinite(p.lon) || p.lon < 0 || p.lon > 359) {
      E(`lon must be 0–359 — got ${p.lon}.`, p.id);
    }
    if (!Number.isInteger(p.level)) {
      E(`level must be a whole number — got ${p.level}.`, p.id);
    }
    if (p.frontier) {
      const dirs = ["up", "down", "left", "right", "forward", "back"];
      String(p.frontier).split(",").map(s => s.trim()).filter(Boolean).forEach(d => {
        if (!dirs.includes(lc(d))) E(`frontier "${d}" is not a direction.`, p.id);
      });
    }
  }

  /* --- mode gates: WORKING --- */

  if (isWorking) {
    const red = lc(build.reduction || "");
    if (!red.includes("offer") && !red.includes("perform")) {
      E("A working orb must declare in reduction: that it offers moves and does not perform them.");
    }
    for (const p of points) {
      if (!p.does) E("a working position needs does:.", p.id);
      if (!p.when) E("a working position needs when:.", p.id);
      const rev = lc(p.reversible);
      if (!rev) E("a working position needs reversible: yes | partial | no.", p.id);
      else if (!["yes", "partial", "no"].includes(rev)) {
        E(`reversible must be yes, partial or no — got "${p.reversible}".`, p.id);
      } else if (rev === "no" && !p.forecloses) {
        E("reversible: no requires forecloses: — you may not mark a move irreversible without saying what it costs.", p.id);
      }
    }
  }

  /* --- mode gates: RHYTHM --- */

  if (isRhythm) {
    const CAD = ["once", "pair", "motif", "periodic", "metronomic"];
    for (const p of points) {
      const cad = lc(p.cadence);
      if (cad && !CAD.includes(cad)) E(`cadence must be one of ${CAD.join(", ")}.`, p.id);
      const weak = cad === "once" || cad === "pair";
      const recs = (p.records || []).length;

      if (p.period && weak) {
        E(`cadence "${cad}" cannot carry a period — two occurrences define an interval, not a rhythm.`, p.id);
      }
      if (cad === "motif" && p.period) {
        E("a motif has no period — name the shape instead.", p.id);
      }
      if ((p.pool || []).length && weak) {
        E(`projection is closed under cadence "${cad}" — remove the pool or raise the cadence with more dated records.`, p.id);
      }
      if (!weak && cad && recs && recs < 3) {
        E(`cadence "${cad}" claims recurrence but only ${recs} dated record(s) are present.`, p.id);
      }
      if (p.phase && weak) {
        W(`phase is undefined under cadence "${cad}".`, p.id);
      }
      if (p.phase && !p.phase_zero) {
        E("phase requires phase_zero: — a phase without a named reference event cannot be checked.", p.id);
      }
      if (cad === "metronomic" && !p.clock) {
        W("metronomic regularity in human affairs almost always means an imposed calendar — name it in clock: or say the reading is anomalous.", p.id);
      }

      const pool = p.pool || [];
      if (pool.length) {
        if (pool.length < 3) {
          E(`a projection pool needs 3–5 members — found ${pool.length}. A single forecast is the weakest available output.`, p.id);
        }
        if (pool.length > 5) W(`pool has ${pool.length} members; past five they are usually rewordings.`, p.id);
        const mechs = new Set();
        pool.forEach((m, i) => {
          if (!m.mechanism) E(`pool member ${i + 1} needs mechanism:.`, p.id);
          if (!m.falsifier) E(`pool member ${i + 1} needs falsifier:.`, p.id);
          if (m.falsifier && !/\b(19|20|21)\d{2}\b/.test(m.falsifier)) {
            E(`pool member ${i + 1} falsifier needs a year.`, p.id);
          }
          const key = lc(m.mechanism).replace(/[^a-z0-9 ]/g, "").trim();
          if (key && mechs.has(key)) {
            E(`two pool members share the mechanism "${m.mechanism}" — count distinct mechanisms, not members.`, p.id);
          }
          mechs.add(key);
          const bad = FORBIDDEN_PROJECTION.find(w => new RegExp(`\\b${w}\\b`, "i").test(m.text || m.falsifier || ""));
          if (bad) E(`"${bad}" may not appear in a projection — a cycle being late is not evidence it is owed.`, p.id);
        });
        const spread = lc(p.spread);
        if (!spread) E("a pool requires spread: converged | split | dispersed.", p.id);
        else if (!["converged", "split", "dispersed"].includes(spread)) {
          E(`spread must be converged, split or dispersed — got "${p.spread}".`, p.id);
        }
      }

      if ((p.rhymes || []).length) {
        const NULLS = ["shared driver", "shared-driver", "base rate", "base-rate", "selection", "definition drift", "definition-drift"];
        p.rhymes.forEach((r, i) => {
          const hay = lc(r.null_cause || r.text || "");
          if (!NULLS.some(n => hay.includes(n))) {
            E(`rhyme ${i + 1} must name one of: shared driver, base rate, selection, definition drift.`, p.id);
          }
          if (!r.disanalogy) {
            E(`rhyme ${i + 1} needs disanalogy: — an analogy offered without its difference is advocacy.`, p.id);
          }
        });
      }
    }
  }

  /* --- quality warnings (all modes) --- */

  for (const p of points) {
    (p.images || []).forEach(im => {
      if (!im.src) E("every image needs a src.", p.id);
      else if (!/^(https?:\/\/|data:image\/|\.?\/|[a-z0-9._-]+\/)/i.test(im.src))
        E("image src must be http(s), a data:image URI, or a local path.", p.id);
      if (!im.alt) W("image has no alt text.", p.id);
    });

    const vw = words(p.view).length;
    if (vw < 60) W(`reading is ${vw} words; under 60 is thin.`, p.id);

    const angles = p.angles || [];
    if (angles.length < 2) W(`${angles.length} angle(s); every position should offer two ways onward.`, p.id);

    const degen = isWorking ? DEGENERATE_WORKING : DEGENERATE_READING;
    angles.forEach(a => {
      const t = lc(`${a.l || ""} ${a.f || ""}`);
      const hit = degen.find(d => t.includes(d));
      if (hit) W(`angle "${a.l || a.f}" is degenerate ("${hit}").`, p.id);
    });

    // label grammar, mode-aware
    const label = String(p.label || "").trim();
    if (isWorking) {
      if (SUBJECT_LEAD.test(label)) {
        W(`label "${label}" reads as a description, not a move. Working orbs take imperatives.`, p.id);
      }
    } else if (isTitleCase(label) || words(label).length < 4) {
      W(`label "${label}" reads as a filing category — a predicate makes a claim, a noun phrase names a drawer.`, p.id);
    }

    // tags
    const tags = p.tags || [];
    if (tags.length > 7) W(`${tags.length} tags; past seven every filter returns everything.`, p.id);
  }

  /* --- geometry --- */

  const levels = [...new Set(points.map(p => p.level))].sort((a, b) => b - a); // high = abstract
  levels.forEach((lv, idx) => {
    const band = points.filter(p => p.level === lv);
    const cap = bandCapacity(idx, levels.length);
    if (band.length > cap) {
      W(`band level ${lv} holds ${band.length} positions; about ${cap} stay legible at that latitude.`);
    }
    if (band.length === 1 && levels.length > 1) {
      W(`band level ${lv} has one member — a ring of one is a point.`);
    }
    // even spacing = the ring was probably never ordered
    if (band.length >= 4) {
      const lons = band.map(p => p.lon).sort((a, b) => a - b);
      const gaps = lons.map((l, i) => arc(l, lons[(i + 1) % lons.length]));
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const spread = Math.max(...gaps) - Math.min(...gaps);
      if (mean > 0 && spread < 1) {
        W(`band level ${lv} is spaced to the degree — the gap channel carries no information.`);
      }
    }
  });

  // meridian: a child must sit within 95° of its parent or UP lands elsewhere
  for (const p of points) {
    if (p.parent == null) continue;
    const par = byId.get(p.parent);
    if (!par) continue;
    const d = arc(p.lon, par.lon);
    if (d > 95) {
      W(`sits ${Math.round(d)}° from parent "${p.parent}"; past 95° the DOWN-then-UP return breaks.`, p.id);
    }
  }

  // ---- placement: computed, or counted off? ----
  // Every rule below is stated in placement.md and enforced by placement.js.
  // They land here so a hand-placed file cannot pass upload silently.
  const bandCount = levels.length;
  const isCycle = /\bcycle\b/i.test(String(build.ring || build.topology || ""));

  for (const lv of levels) {
    const band = points.filter(p => p.level === lv);
    if (band.length < 2) continue;
    const lons = band.map(p => ((p.lon % 360) + 360) % 360);

    // labels that collide: below the band's minimum legible gap
    const m = minGap(levels.indexOf(lv), bandCount);
    const sorted = [...lons].sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      const g = ((sorted[(i + 1) % sorted.length] - sorted[i]) + 360) % 360;
      if (sorted.length > 1 && g > 0.01 && g < m - 0.5) {
        W(`band ${lv}: two positions sit ${Math.round(g)}° apart but this latitude needs ${Math.round(m)}° — labels will collide and the studio drops them. Run placement.js.`);
        break;
      }
    }

    // folded ring: nothing past 95° from the meridian unless it is a cycle
    if (!isCycle && band.length > foldedCapacity(levels.indexOf(lv), bandCount)) {
      W(`band ${lv}: ${band.length} positions exceed the folded-ring capacity of ${foldedCapacity(levels.indexOf(lv), bandCount)} at this latitude. Re-level, split a thread, or declare a cycle.`);
    }
  }

  // ab measured from the subject and lon driven by the same distance are
  // one judgement rendered twice
  const withAb = points.filter(p => typeof p.ab === "number" && typeof p.lon === "number");
  const r = corr(withAb.map(p => arc(p.lon, 0)), withAb.map(p => p.ab));
  if (r !== null && Math.abs(r) > 0.9) {
    W(`ab tracks angular distance from the meridian at r=${r.toFixed(2)} — ab is not adding an independent judgement. Score d from the band's reference member, not from the subject.`);
  }

  // ---- the antipodal law, measured from content ----
  // SKILL.md says relatedness should fall off toward the antipode. That is
  // the whole point of the ring axis and nothing checked it. View overlap
  // is a proxy for relatedness, so it should DECLINE with angular distance.
  for (const lv of levels) {
    const band = points.filter(p => p.level === lv);
    if (band.length < 5) continue;
    const sh = band.map(p => shingles(p.view));
    const dists = [], sims = [];
    for (let i = 0; i < band.length; i++) {
      for (let j = i + 1; j < band.length; j++) {
        dists.push(arc(band[i].lon, band[j].lon));
        sims.push(overlap(sh[i], sh[j]));
      }
    }
    const r = corr(dists, sims);
    if (r !== null && r > -0.1) {
      W(`band level ${lv}: view similarity does not fall off with angular distance (r=${r.toFixed(2)}) — the ring is ordered but the order carries no semantic gradient. Positions opposite each other should be the least alike.`);
    }
  }

  // substitution test: a view that could be pasted under a neighbour's label
  for (const lv of levels) {
    const band = points.filter(p => p.level === lv).sort((a, b) => a.lon - b.lon);
    if (band.length < 2) continue;
    const sh = band.map(p => shingles(p.view));
    for (let i = 0; i < band.length; i++) {
      const j = (i + 1) % band.length;
      if (i === j) continue;
      const o = overlap(sh[i], sh[j]);
      if (o > 0.35) {
        W(`reading overlaps ${Math.round(o * 100)}% with ring neighbour "${band[j].id}" — the band may be saying one thing twice.`, band[i].id);
      }
    }
  }

  // a consequence axis that loops is not a consequence axis
  for (const p of points) {
    let hop = p.forward, n = 0;
    while (hop && n++ < points.length) {
      if (hop === p.id) { W(`forward chain loops back to itself in ${n} step(s) — consequence should not cycle.`, p.id); break; }
      hop = (byId.get(hop) || {}).forward;
    }
  }

  // the anchor pass
  if (levels.length > 1) {
    const abs = points.map(p => (p.ab == null ? 0 : p.ab));
    if (abs.every(a => a === 0)) {
      W("every position reads ab: 0 across a multi-band orb — the anchor pass was probably skipped.");
    }
  }

  // tag vocabulary health
  const tagCount = new Map();
  points.forEach(p => (p.tags || []).forEach(t => tagCount.set(t, (tagCount.get(t) || 0) + 1)));
  const singles = [...tagCount].filter(([, n]) => n === 1).map(([t]) => t);
  if (singles.length > 3) {
    W(`${singles.length} tags are used once (${singles.slice(0, 4).join(", ")}…) — singleton tags filter to nothing.`);
  }

  return { errors, warnings };
}

if (typeof module !== "undefined") module.exports = { validateOrb, bandCapacity };

return module.exports;})();
const {lex,parseOrb,validate}=Legacy;const {validateOrb}=Full;
const fields = {
  ORB: 'subject_id subject_label kind density positions authored note reduction',
  THREAD: 'id label entry gloss cap',
  POINT: 'world id label level lon view parent tier ab up_alt forward back refs tags frontier',
  ANGLE: 'point label claim',
  SOURCE: 'id title url publisher date kind points',
};
const check = (ok, message) => { if (!ok) throw new Error(message); };
function keys(obj, allowed, where) {
  check(obj && typeof obj === 'object' && !Array.isArray(obj), `${where}: expected object`);
  for (const key of Object.keys(obj)) check(allowed.split(' ').includes(key), `${where}: unsupported field ${key}; refusing to discard it`);
}
function text(value, where) {
  check(typeof value === 'string' && value.trim().length > 0, `${where}: needs nonempty text`);
}
function slug(value, where) { check(typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), `${where}: needs a lowercase slug`); }
function array(value, where) { check(Array.isArray(value), `${where}: expected array`); }
function link(value, where) {
  let url; try { url = new URL(value); } catch { throw new Error(`${where}: invalid URL`); }
  check(['http:', 'https:'].includes(url.protocol) && !url.username && !url.password, `${where}: needs an HTTP(S) URL without credentials`);
}
function inspect(src) {
  const errors = [], warnings = [];
  try {
    const blocks = lex(src);
    for (const b of blocks) {
      check(fields[b.tag], `Unsupported block [${b.tag}] in generic profile`);
      for (const k of Object.keys(b.f)) {
        check(fields[b.tag].split(' ').includes(k), `[${b.tag}]: unsupported field ${k}`);
        check(b.f[k].length === 1, `[${b.tag}]: duplicate key ${k}`);
      }
    }
    check(blocks.filter(b => b.tag === 'ORB').length === 1, 'Expected exactly one ORB block');
    const doc = parseOrb(src), pts = Object.values(doc.WORLDS).flat();
    check(doc.BUILD.kind === 'reading', 'Generic profile supports kind: reading only');
    const unique = (items, name) => {
      const seen = new Set();
      for (const p of items) { slug(p.id, name); check(!seen.has(p.id), `Duplicate ${name}: ${p.id}`); seen.add(p.id); }
      return seen;
    };
    const ids = unique(pts, 'point ID'), threads = unique(doc.THREAD, 'thread ID');
    unique(doc.SOURCES, 'source ID');
    check(Number.isInteger(doc.BUILD.positions) && doc.BUILD.positions === pts.length && pts.length > 0, 'positions does not match the actual point count');
    const byId = new Map(pts.map(p => [p.id, p]));
    for (const p of pts) {
      check(threads.has(p.world), `${p.id}: undeclared thread ${p.world}`);
      check(Number.isInteger(p.ab) && p.ab >= 0 && p.ab <= 3, `${p.id}: ab must be an integer 0–3`);
      for (const ref of [...(p.refs || []), ...(p.upAlt || []), p.parent, p.forward, p.back].filter(Boolean)) {
        check(ids.has(ref), `${p.id}: unknown point ${ref}`);
        check(ref !== p.id, `${p.id}: self reference`);
      }
      for (const tag of p.tags) check(/^[a-z0-9-]+:[^,\s:]+$/i.test(tag), `${p.id}: malformed facet ${tag}`);
      const seen = new Set([p.id]); let parent = p.parent;
      while (parent) { check(!seen.has(parent), `${p.id}: parent cycle`); seen.add(parent); parent = byId.get(parent)?.parent; }
    }
    for (const t of doc.THREAD) check(byId.get(t.entry)?.world === t.id, `${t.id}: entry must belong to this thread`);
    for (const s of doc.SOURCES) {
      link(s.url, s.id); check(s.points.length > 0, `${s.id}: source needs attached points`);
      for (const id of s.points) check(ids.has(id), `${s.id}: unknown point ${id}`);
    }
    for (const validator of [validate, validateOrb]) {
      const result = validator(doc); errors.push(...result.errors); warnings.push(...result.warnings);
    }
    return {errors: [...new Set(errors)], warnings: [...new Set(warnings)], point_count: pts.length, doc};
  } catch (e) { return {errors: [e.message], warnings, point_count: 0}; }
}

return {inspect};})();
