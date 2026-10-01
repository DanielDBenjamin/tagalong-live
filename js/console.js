import { connect, newId } from './backend.js';
import { PRESETS, DRINKS, presetPolicy, defaultPolicy, policySummary } from './policy.js';
import { CAMPUS_NAME } from './config.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LOCK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
const STUDENT_URL = new URL('./', location.href).href;

let api, APP = null, SID = null, PLANS = [], PEOPLE = {}, LOG = [], subs = [], admin = false, plansLoaded = false;
let prev = {}, flash = {}, shellBuilt = false, appLoaded = false;
const TABS = ['live', 'policy', 'queue', 'settings'];
const ui = { tab: TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'live', confirmReset: false, busy: '' };

const count = p => p.going.length + (p.extra || 0);
const live = p => !['review', 'declined', 'removed'].includes(p.status);
const fmt = ms => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const isFlash = id => flash[id] && Date.now() - flash[id] < 1500;
const log = (kind, text, extra = {}) => SID && api.addLog(SID, { kind, text, ...extra });
function anon(s) { return ({ '1st year': 'A 1st-year', '2nd year': 'A 2nd-year', '3rd year': 'A 3rd-year', 'Master': 'A Master\'s student', 'Exchange': 'An exchange student' })[s?.year] || 'A student'; }

async function start() {
  try { api = await connect(); }
  catch (e) { console.error(e); $('#root').innerHTML = `<div class="login"><h1>Tagalong</h1><p class="intro">Couldn't connect to Firebase. Check js/config.js and your internet connection.</p></div>`; return; }
  if (api.mode === 'local') $('#banner').innerHTML = '<div class="banner">Local test mode: data only syncs between tabs in this browser. Add your Firebase config to share it with phones.</div>';
  api.onAuth(a => { admin = a.admin; shellBuilt = false; ensureApp(); renderAll(); });
  api.watchApp(app => {
    APP = app; appLoaded = true;
    ensureApp();
    if (app && app.sid !== SID) switchSession(app.sid);
    renderAll();
  });
  setInterval(tickDeadlines, 5000);
  setInterval(() => { if (admin && ui.tab === 'live') renderLive(); }, 20000);
}
let creating = false;
// Creates the campus the first time the presenter signs in, once we know none exists yet.
function ensureApp() {
  if (!admin || !appLoaded || APP || creating) return;
  creating = true;
  api.setApp({ sid: newId(), policy: defaultPolicy(), settings: { windowMin: 10 } }).finally(() => { creating = false; });
}
function switchSession(sid) {
  subs.forEach(u => u()); subs = [];
  SID = sid; PLANS = []; PEOPLE = {}; LOG = []; prev = {}; plansLoaded = false;
  subs.push(api.watch(sid, 'people', list => { PEOPLE = Object.fromEntries(list.map(p => [p.id, p])); renderData(); }));
  subs.push(api.watch(sid, 'plans', list => { onPlans(list); plansLoaded = true; renderData(); }));
  subs.push(api.watch(sid, 'log', list => { LOG = list.sort((a, b) => b.at - a.at); renderData(); }));
}
// The console is the one place that writes "went ahead" and "cancelled" to the activity log.
function onPlans(list) {
  for (const p of list) {
    const was = prev[p.id];
    if (plansLoaded) {
      if (!was || was.n !== p.going.length || was.status !== p.status) flash[p.id] = Date.now();
      if (was && was.status !== p.status && admin) {
        if (p.status === 'ahead') log('ahead', `${p.title} reached 3 people and is going ahead`);
        if (p.status === 'cancelled') log('cancel', `${p.title} was cancelled: only ${p.going.length} joined in time`);
      }
    }
    prev[p.id] = { status: p.status, n: p.going.length };
  }
  PLANS = list;
}
function tickDeadlines() {
  if (!admin || !SID) return;
  for (const p of PLANS) if (p.status === 'open' && p.deadlineAt < Date.now() && p.going.length < 3) api.patchPlan(SID, p.id, { status: 'cancelled' }).catch(() => { });
}

/* ---------- Rendering ---------- */
function renderAll() {
  if (!api) return;
  if (!admin) { renderLogin(); return; }
  if (!APP) { $('#root').innerHTML = `<div class="login"><h1>Tagalong</h1><p class="intro">Opening the campus…</p></div>`; return; }
  if (!shellBuilt) buildShell();
  renderTabs(); renderData();
  if (ui.tab === 'policy') renderPolicy();
  if (ui.tab === 'settings') renderSettings();
}
function renderData() {
  if (!admin || !shellBuilt) return;
  renderRoom(); renderTabs();
  if (ui.tab === 'live') renderLive();
  if (ui.tab === 'queue') renderQueue();
}
function renderLogin(err = '') {
  shellBuilt = false;
  $('#root').innerHTML = `<form class="login panel" id="login-form">
    <h1>Tagalong console</h1>
    <p class="intro">Sign in with the presenter account to run the class demo.${api.mode === 'local' ? ' In local test mode any email and password works.' : ''}</p>
    <input type="email" id="l-email" placeholder="Email" autocomplete="username" aria-label="Email">
    <input type="password" id="l-pw" placeholder="Password" autocomplete="current-password" aria-label="Password">
    <div class="err" id="l-err">${esc(err)}</div>
    <button class="primary" type="submit">Sign in</button>
    <p class="intro">Students don't need this page. They open <b>${esc(STUDENT_URL)}</b></p>
  </form>`;
}
function buildShell() {
  shellBuilt = true;
  $('#root').innerHTML = `<div class="cwrap">
    <aside class="panel qr-panel">
      <h1>Tagalong</h1>
      <div class="sub">Scan to join ${esc(CAMPUS_NAME)}</div>
      <div class="qr-box" id="qr" aria-label="QR code for the student app"></div>
      <div class="qr-url">${esc(STUDENT_URL)}</div>
      <div><div class="joined" id="joined">0</div><div class="sub">students on campus</div></div>
      <div class="room" id="room"></div>
    </aside>
    <section class="panel">
      <div class="p-head"><div><h2>University console</h2><span class="meta">${esc(CAMPUS_NAME)} · live</span></div><div class="tabs" role="tablist" id="ctabs"></div></div>
      <div class="pane" id="c-live"></div>
      <div class="pane" id="c-policy" hidden></div>
      <div class="pane" id="c-queue" hidden></div>
      <div class="pane" id="c-settings" hidden></div>
    </section></div>`;
  if (window.QRCode) new window.QRCode($('#qr'), { text: STUDENT_URL, width: 440, height: 440, colorDark: '#231C17', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
  else $('#qr').textContent = 'QR code unavailable offline';
}
function renderTabs() {
  const n = PLANS.filter(p => p.status === 'review').length;
  $('#ctabs').innerHTML = [['live', 'Live'], ['policy', 'Alcohol policy'], ['queue', 'Review queue'], ['settings', 'Settings']].map(([k, l]) =>
    `<button role="tab" data-tab="${k}" aria-selected="${ui.tab === k}">${l}${k === 'queue' && n ? `<span class="cnt">${n}</span>` : ''}</button>`).join('');
  ['live', 'policy', 'queue', 'settings'].forEach(k => { $('#c-' + k).hidden = ui.tab !== k; });
}
function realPeople() { return Object.entries(PEOPLE).filter(([, p]) => !p.bot); }
function renderRoom() {
  const grp = new Set(); PLANS.forEach(p => { if (p.status === 'ahead') p.going.forEach(id => grp.add(id)); });
  const ppl = realPeople().sort((a, b) => a[1].at - b[1].at);
  $('#joined').textContent = ppl.length;
  $('#room').innerHTML = ppl.map(([id, p]) => {
    const hue = (id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 4) + 1;
    return `<span class="av ${grp.has(id) ? 'grp' : ''} ${Date.now() - p.at < 3000 ? 'new-in' : ''}" style="background:var(--av${hue})" title="${esc(p.name)}">${esc((p.name || '?')[0])}</span>`;
  }).join('');
}
function renderLive() {
  const inf = PLANS.filter(p => !p.official && live(p));
  const ahead = inf.filter(p => p.status === 'ahead').length, canc = inf.filter(p => p.status === 'cancelled').length, open = inf.length - ahead - canc;
  const pct = inf.length ? Math.round(ahead / inf.length * 100) : 0;
  const ppl = realPeople().map(([id, p]) => ({ id, ...p })), newcomers = ppl.filter(p => p.newcomer);
  const grp = new Set(); PLANS.forEach(p => { if (p.status === 'ahead') p.going.forEach(id => grp.add(id)); });
  const newIn = newcomers.filter(p => grp.has(p.id)).length;
  const cat = {}; PLANS.filter(live).forEach(p => { cat[p.cat] = (cat[p.cat] || 0) + p.going.length; });
  const cats = Object.entries(cat).filter(c => c[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 6), cmax = Math.max(1, ...cats.map(c => c[1]));
  const order = { ahead: 0, open: 1, official: 2, cancelled: 3 };
  const plans = PLANS.filter(live).sort((a, b) => order[a.status] - order[b.status] || b.postedAt - a.postedAt);
  const k = kind => LOG.filter(l => l.kind === kind);
  const posted = k('post'), blocked = k('blocked').length, review = k('review').length, checked = posted.length + blocked + review;
  $('#c-live').innerHTML = `
    <div class="kpis">
      <div class="kpi"><span class="k">Students on Tagalong</span><span class="v">${ppl.length}</span><span class="s">verified, this campus</span></div>
      <div class="kpi"><span class="k">Plans posted</span><span class="v">${inf.length}</span><span class="s">${open} still filling</span></div>
      <div class="kpi hl"><span class="k">Reached 3 people</span><span class="v">${pct}%</span><span class="s">${ahead} going ahead · ${canc} cancelled</span></div>
      <div class="kpi"><span class="k">Newcomers in a group</span><span class="v">${newIn}<small style="font-size:17px;color:var(--muted)"> / ${newcomers.length}</small></span><span class="s">1st-years and exchange</span></div>
    </div>
    <div class="modstrip"><strong>Auto-check</strong><span><span class="big">${checked - review}</span> of ${checked} posts handled without staff</span><span>${posted.length} published (${posted.filter(l => l.alc).length} with alcohol label)</span><span>${blocked} stopped</span><span>${review} sent to Student Life</span></div>
    <div class="cols">
      <div class="sec"><div class="eyebrow">Plans right now</div><div class="plist">${plans.length ? plans.map(p => {
        const kk = Math.min(p.going.length, 3);
        const pill = p.official ? '<span class="pill of">Official</span>' : p.status === 'ahead' ? '<span class="pill go">Going ahead</span>' : p.status === 'cancelled' ? '<span class="pill x">Cancelled</span>' : `<span class="pill warn">Needs ${3 - kk}</span>`;
        const mid = p.official ? `<span class="n">${count(p)} going</span>` : `<div class="bar3">${[0, 1, 2].map(i => `<i class="${i < kk ? 'on' : ''}"></i>`).join('')}</div>`;
        return `<div class="pl ${isFlash(p.id) ? 'flash' : ''}"><span class="t">${esc(p.title)}<small>${esc(p.cat)}${p.alcohol ? ' · alcohol' : ''}${p.official ? '' : ' · ' + p.going.length + ' joined'}</small></span>${mid}${pill}<button class="rm" data-rm="${p.id}" title="Remove this plan">Remove</button></div>`;
      }).join('') : '<div class="empty">No plans yet. Ask the room: what would you do this week if you had people to do it with?</div>'}</div></div>
      <div class="sec">
        <div class="eyebrow">Live activity</div>
        ${LOG.length ? `<ul class="acts-log">${LOG.slice(0, 8).map(l => `<li><time>${fmt(l.at)}</time><span class="${esc(l.kind)}">${esc(l.text)}</span></li>`).join('')}</ul>` : '<div class="empty">Waiting for the first scan…</div>'}
        ${cats.length ? `<div class="eyebrow" style="margin-top:8px">Popular activities</div>
        <div class="bars">${cats.map(([c, v]) => `<div class="r"><span>${esc(c)}</span><span class="track"><span class="fill" style="width:${v / cmax * 100}%"></span></span><span class="c">${v}</span></div>`).join('')}</div>` : ''}
      </div>
    </div>
    <div class="privacy">${LOCK} Anonymised. The university sees counts and year groups, never names or chats.</div>`;
}
function renderQueue() {
  const qs = PLANS.filter(p => p.status === 'review');
  $('#c-queue').innerHTML = `<p class="intro">Staff only see posts the auto-check isn't sure about. Everything else is published or stopped automatically, with the reason shown to the organiser.</p>` +
    (qs.length ? qs.map(p => {
      const by = p.official ? p.club : `An informal plan by ${anon(PEOPLE[p.host]).replace(/^An? /, m => m.toLowerCase())}`;
      const alc = p.alcohol ? `<div><span class="b b-alc">Alcohol${p.decl?.drinks?.length ? ' · ' + p.decl.drinks.map(k => DRINKS[k]).join(', ') : ''}${p.decl?.glasses ? ` · max ${p.decl.glasses}/person` : ''}</span></div>` : '';
      return `<div class="qitem"><div class="qtop"><b>${esc(p.title)}</b><small>${esc(by)} · ${esc(p.when)} · ${esc(p.place)}</small></div>${alc}
        <ul class="reasons">${(p.reasons || []).map(r => `<li>${esc(r.t)}</li>`).join('')}</ul>
        <div class="qacts"><button class="primary go" data-q="approve" data-id="${p.id}">Approve</button><button class="ghost" data-q="decline" data-id="${p.id}">Decline</button></div></div>`;
    }).join('') : `<div class="empty">Nothing to review. The auto-check has handled every post so far.</div>`);
}
const optBtns = (key, opts) => `<div class="opts">${opts.map(([v, l]) => `<button class="opt" data-pol="${key}" data-v="${v}" aria-pressed="${String(APP.policy[key]) === String(v)}">${l}</button>`).join('')}</div>`;
const chk = (key, label, on) => `<label class="chkline"><input type="checkbox" data-polk="${key}" ${on ? 'checked' : ''}>${label}</label>`;
function renderPolicy() {
  const P = APP.policy, showDecl = P.club === 'declare' || P.club === 'approve';
  $('#c-policy').innerHTML = `
    <p class="intro">Each university chooses how strict Tagalong is. Pick a starting point, then adjust it to match your own rules. Changes apply to new posts straight away, on every phone.</p>
    <div class="presets">${Object.entries(PRESETS).map(([k, p]) => `<button class="preset" data-preset="${k}" aria-pressed="${P.preset === k}"><b>${p.name}</b><span>${p.blurb}</span></button>`).join('')}</div>
    ${P.preset === 'custom' ? `<div class="custom-note">Customised for ${esc(CAMPUS_NAME)}</div>` : ''}
    <div class="prow"><div><h3>Informal meetups</h3><p>Plans any student can post</p></div>
      <div class="pctl">${optBtns('informal', [['label', 'Allowed with label'], ['flag', 'Needs approval'], ['block', 'Not allowed']])}</div></div>
    <div class="prow"><div><h3>Official club events</h3><p>Events by verified clubs and associations</p></div>
      <div class="pctl">${optBtns('club', [['label', 'Allowed with label'], ['declare', 'Allowed with a declaration'], ['approve', 'Needs approval'], ['block', 'Not allowed']])}</div></div>
    ${showDecl ? `<div class="prow"><div><h3>Declaration rules</h3><p>What a club has to state before it can post</p></div>
      <div class="pctl">
        <span class="sublabel">Drinks allowed</span><div class="opts">${Object.keys(DRINKS).map(k => chk('drinks.' + k, DRINKS[k], P.drinks[k])).join('')}</div>
        <label class="chkline">Max per person <select class="psel" data-polk="maxGlasses">${[[1, '1 glass'], [2, '2 glasses'], [3, '3 glasses'], [0, 'No limit']].map(([v, l]) => `<option value="${v}" ${P.maxGlasses == v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <span class="sublabel">Required</span>
        ${chk('req.responsible', 'A named responsible person who did prevention training', P.req.responsible)}
        ${chk('req.food', 'Food provided', P.req.food)}
        ${chk('req.soft', 'Soft drinks cheaper than alcohol', P.req.soft)}
        ${chk('req.members', 'Members only', P.req.members)}
        ${chk('venueOnly', 'Only at approved venues (others go to review)', P.venueOnly)}
        <input class="ptext" type="text" id="pol-venues" data-polk="venues" value="${esc(P.venues)}" aria-label="Approved venues, separated by commas" placeholder="Approved venues, separated by commas">
      </div></div>` : ''}
    <div class="prow"><div><h3>Always blocked</h3><p>Checked on every post, informal or official</p></div>
      <div class="pctl">
        <label class="chkline locked"><input type="checkbox" checked disabled>Open bars and fixed-price drinking (Tagalong rule, every campus)</label>
        <label class="chkline locked"><input type="checkbox" checked disabled>Drinking games, challenges and crawls (Tagalong rule, every campus)</label>
        ${chk('noRecruit', 'Alcohol at recruitment or integration events', P.noRecruit)}
        ${chk('noTeaching', 'Alcohol in teaching spaces (classrooms, lecture halls, libraries)', P.noTeaching)}
      </div></div>
    <div class="prow"><div><h3>When the auto-check isn't sure</h3><p>For example, a post mentions “drinks”</p></div>
      <div class="pctl">${optBtns('flagAction', [['queue', 'Hold it for staff review'], ['contact', 'Stop it and ask the organiser to get in touch']])}
        ${P.flagAction === 'contact' ? `<input class="ptext" type="text" id="pol-contact" data-polk="contact" value="${esc(P.contact)}" aria-label="Student Life contact email">` : ''}</div></div>
    <div class="summary"><b>What students are told</b><ul>${policySummary(P).map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`;
}
function renderSettings() {
  const w = APP.settings?.windowMin || 10;
  $('#c-settings').innerHTML = `
    <div class="setting"><h3>Time to reach 3 people</h3><p>How long a new informal plan has to find 3 people before it's cancelled. Short times work best in class.</p>
      <div class="opts">${[2, 5, 10, 20, 60].map(m => `<button class="opt" data-win="${m}" aria-pressed="${w === m}">${m} min</button>`).join('')}</div></div>
    <div class="setting"><h3>Starter plans</h3><p>Adds a few plans from example students so the feed isn't empty when the class first scans in. "Coffee after the lecture" starts at 2 of 3, so the first person to join makes it go ahead.</p>
      <div class="opts"><button class="ghost" data-act="warm" ${ui.busy ? 'disabled' : ''}>${ui.busy === 'warm' ? 'Adding…' : 'Add starter plans'}</button></div></div>
    <div class="setting"><h3>Reset the campus</h3><p>Deletes every name, plan, chat and activity entry, and sends everyone back to the sign-up screen. The alcohol policy and settings are kept. Do this after each class.</p>
      <div class="opts">${ui.confirmReset
        ? `<span class="err">Delete everything from this session?</span><button class="danger solid" data-act="reset-yes" ${ui.busy ? 'disabled' : ''}>${ui.busy === 'reset' ? 'Resetting…' : 'Yes, reset'}</button><button class="ghost" data-act="reset-no">Cancel</button>`
        : `<button class="danger" data-act="reset">Reset campus</button>`}</div></div>
    <div class="setting"><h3>Presenter</h3><p>${api.mode === 'local' ? 'Local test mode.' : 'Connected to Firebase.'} Students join at ${esc(STUDENT_URL)}</p>
      <div class="opts"><a class="ghost" href="${esc(STUDENT_URL)}" target="_blank" rel="noopener" style="text-decoration:none">Open the student app</a><button class="ghost" data-act="signout">Sign out</button></div></div>`;
}

/* ---------- Actions ---------- */
function savePolicy(policy) { return api.setApp({ policy }).catch(e => { console.error(e); alertBar('Couldn\'t save the policy. Check your connection.'); }); }
function setPol(path, v) {
  const P = JSON.parse(JSON.stringify(APP.policy));
  const ks = path.split('.'); let o = P; while (ks.length > 1) o = o[ks.shift()]; o[ks[0]] = v;
  P.preset = 'custom'; savePolicy(P);
}
function alertBar(msg) { $('#banner').innerHTML = `<div class="banner">${esc(msg)}</div>`; setTimeout(() => { $('#banner').innerHTML = ''; }, 6000); }
const BOTS = [
  ['bot-amira', 'Amira', '2nd year', false], ['bot-leo', 'Léo', '1st year', true], ['bot-yusuf', 'Yusuf', 'Exchange', true], ['bot-ines', 'Inès', '3rd year', false]
];
async function warmUp() {
  const now = Date.now(), win = (APP.settings?.windowMin || 10) * 60000;
  for (const [id, name, year, newcomer] of BOTS) await api.setDoc(SID, 'people', id, { name, year, newcomer, bot: true, at: now });
  const base = { desc: '', newcomer: true, alcohol: false, decl: null, extra: 0, reasons: [], postedAt: now, deadlineAt: now + win, space: 'informal', official: false, club: null };
  await api.addPlan(SID, { ...base, title: 'Coffee after the lecture', desc: 'Quick coffee and a chat, anyone welcome.', cat: 'Food', when: 'Today 16:00', place: 'Library café', max: 6, host: 'bot-amira', going: ['bot-amira', 'bot-leo'], status: 'open' });
  await api.addPlan(SID, { ...base, title: 'Board games night', desc: 'Bring a game or just turn up.', cat: 'Games', when: 'Tonight 19:30', place: 'Résidence B common room', max: 6, host: 'bot-yusuf', going: ['bot-yusuf'], status: 'open', deadlineAt: now + win * 2 });
  await api.addPlan(SID, { ...base, title: 'Campus photo walk', desc: 'Open to everyone. Any camera or phone is fine.', cat: 'Culture', when: 'Sat 11:00', place: 'Old town, meet at the fountain', max: 60, host: 'bot-ines', going: ['bot-ines'], status: 'official', space: 'official', official: true, club: 'Photography Club', extra: 11 });
}

document.addEventListener('submit', async e => {
  if (e.target.id !== 'login-form') return;
  e.preventDefault();
  const email = $('#l-email').value.trim(), pw = $('#l-pw').value;
  try {
    await api.signInAdmin(email, pw);
    if (!api.isAdmin()) renderLogin('Signed in, but this isn\'t a presenter account.');
  } catch (x) { console.error(x); renderLogin('That email or password didn\'t work.'); }
});
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b || b.disabled || !admin) return;
  if (b.dataset.tab) { ui.tab = b.dataset.tab; ui.confirmReset = false; renderAll(); return; }
  if (b.dataset.preset) {
    const k = b.dataset.preset;
    await savePolicy(presetPolicy(k, APP.policy.contact));
    log('policy', `Alcohol policy set to “${PRESETS[k].name}”`);
    return;
  }
  if (b.dataset.pol) { setPol(b.dataset.pol, b.dataset.v); return; }
  if (b.dataset.win) { api.setApp({ settings: { ...(APP.settings || {}), windowMin: +b.dataset.win } }); return; }
  if (b.dataset.rm) {
    const p = PLANS.find(x => x.id === b.dataset.rm); if (!p) return;
    await api.patchPlan(SID, p.id, { status: 'removed' }); log('removed', `Organisers removed “${p.title}”`); return;
  }
  if (b.dataset.q) {
    const p = PLANS.find(x => x.id === b.dataset.id); if (!p) return;
    if (b.dataset.q === 'approve') {
      const win = (APP.settings?.windowMin || 10) * 60000;
      await api.patchPlan(SID, p.id, { status: p.official ? 'official' : 'open', postedAt: Date.now(), deadlineAt: Date.now() + win });
      log('approve', `Student Life approved “${p.title}”`);
    } else {
      await api.patchPlan(SID, p.id, { status: 'declined' }); log('decline', `Student Life declined “${p.title}”`);
    }
    return;
  }
  const act = b.dataset.act;
  if (act === 'warm') { ui.busy = 'warm'; renderSettings(); try { await warmUp(); } catch (x) { console.error(x); alertBar('Couldn\'t add starter plans.'); } ui.busy = ''; renderSettings(); }
  else if (act === 'reset') { ui.confirmReset = true; renderSettings(); }
  else if (act === 'reset-no') { ui.confirmReset = false; renderSettings(); }
  else if (act === 'reset-yes') {
    ui.busy = 'reset'; renderSettings();
    const old = SID;
    try { await api.setApp({ sid: newId() }); await api.wipeSession(old); }
    catch (x) { console.error(x); alertBar('The reset didn\'t finish. Try again.'); }
    ui.busy = ''; ui.confirmReset = false; renderSettings();
  }
  else if (act === 'signout') { await api.signOutAdmin(); }
});
document.addEventListener('change', e => {
  const k = e.target.dataset.polk; if (!k || !admin) return;
  const v = e.target.type === 'checkbox' ? e.target.checked : k === 'maxGlasses' ? +e.target.value : e.target.value;
  setPol(k, v);
});

start();
