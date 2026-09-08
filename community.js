'use strict';
(async function () {
  const root = document.getElementById('community-list'), status = document.getElementById('community-status');
  if (!root || !status) return;
  const safe = value => {try {const u = new URL(value); return typeof value === 'string' && value.length <= 500 && u.protocol === 'https:' && !u.username && !u.password && !u.port && !['localhost','127.0.0.1','[::1]'].includes(u.hostname);} catch {return false;}};
  const string = (s, max) => typeof s === 'string' && s.length > 0 && s.length <= max;
  const add = (parent, tag, text, cls) => {const el = document.createElement(tag); if (text) el.textContent = text; if (cls) el.className = cls; parent.append(el); return el;};
  const link = (parent, label, href) => {const a = add(parent,'a',label); a.href = href; a.rel = 'noopener noreferrer'; return a;};
  try {
    const response = await fetch(root.dataset.catalog, {cache:'no-store', signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw Error('Catalogue unavailable');
    const text = await response.text(); if (text.length > 2000000) throw Error('Catalogue too large');
    const data = JSON.parse(text);
    if (data.schemaVersion !== 1 || !Array.isArray(data.orbs) || data.orbs.length > 1000) throw Error('Invalid catalogue');
    const seen = new Set();
    for (const o of data.orbs) {
      if (!o || !string(o.id,100) || seen.has(o.id) || !string(o.title,100) || !string(o.description,300) || !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(o.creator || '') || !safe(o.url) || !safe(o.repository) || !/^https:\/\/github\.com\/[a-z\d-]+\/[\w.-]+$/i.test(o.repository) || !/^[a-f\d]{40}$/.test(o.revision || '') || !Array.isArray(o.tags) || o.tags.length > 5 || o.tags.some(t => !string(t,30)) || !o.media || typeof o.media.audio !== 'boolean' || typeof o.media.video !== 'boolean') throw Error('Invalid listing');
      seen.add(o.id);
    }
    const fragment = document.createDocumentFragment();
    for (const o of data.orbs) {
      const row = add(fragment,'article',null,'community-row'), body = add(row,'div');
      const h = add(body,'h3'); link(h,o.title,o.url);
      add(body,'p',o.description);
      const meta = add(body,'div',null,'community-meta'); link(meta,'@'+o.creator,'https://github.com/'+o.creator);
      add(meta,'span',o.tags.join(' · '));
      add(meta,'span','Reading'+(o.media.audio?' · Audio':'')+(o.media.video?' · Video':''));
      const actions = add(row,'div',null,'community-actions'); link(actions,'Explore ↗',o.url); link(actions,'Reviewed source ↗',o.repository+'/tree/'+o.revision);
    }
    root.replaceChildren(fragment);
    status.textContent = data.orbs.length ? `${data.orbs.length} approved community ${data.orbs.length === 1 ? 'ORB' : 'ORBs'}. Hosted by their creators; source links identify reviewed editions.` : 'No community ORBs have been featured yet. Submit yours for owner review.';
  } catch {
    root.replaceChildren(); status.textContent = 'The community catalogue could not be loaded. View the approved listings on GitHub or try again later.';
  }
})();
