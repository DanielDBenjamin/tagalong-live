import { connect } from './backend.js';
import { check, DRINKS, isRude } from './policy.js';
import { CAMPUS_NAME } from './config.js';
import { CLUBS, clubInfo } from './clubs.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CATS = ['Food', 'Games', 'Sport', 'Study', 'Walks', 'Languages', 'Culture', 'Nights out'];
const YEARS = ['1st year', '2nd year', '3rd year', 'Master', 'Exchange'];
const WHENS = [['any', 'Any time'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['weekend', 'Weekend']];
const WHEN_RE = { today: /^(Today|Tonight)/, tomorrow: /^Tomorrow/, weekend: /^(Sat|Sun)/ };
const SIZES = [['any', 'Any size'], ['small', 'Up to 6'], ['ten', 'Up to 10'], ['open', 'No limit']];
const EXAMPLES = [
  { label: 'Apéro, not declared', as: 'me', title: 'Apéro on the terrace', desc: 'Bring something to share', place: 'Union terrace', cat: 'Food', alc: false },
  { label: 'Beer pong', as: 'me', title: 'Beer pong night', desc: '', place: 'Résidence C', cat: 'Nights out', alc: true },
  { label: 'Club wine tasting', as: 'Oenology Society', title: 'Wine & cheese welcome', desc: 'Meet the new exchange students', place: 'Student bar', cat: 'Culture', alc: true,
    decl: { drinks: ['wine'], glasses: 1, resp: 'Clara', trained: true, food: true, soft: true, members: true } },
  { label: 'Club cocktails', as: 'Business Club', title: 'Welcome cocktails', desc: 'Integration night for new members', place: 'Lecture hall B', cat: 'Nights out', alc: true,
    decl: { drinks: ['spirits'], glasses: 2, resp: '', trained: false, food: false, soft: false, members: false } }
];
const SHARE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M5 11v9h14v-9"/></svg>';
const AHEAD_TEXT = '3 people are in. The plan is going ahead!';
const I = {
  search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  plus: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/></svg>',
  chat: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m15 5-7 7 7 7"/></svg>',
  clock: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pin: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  ppl: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/></svg>',
  lock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  shield: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6z"/></svg>',
  phone: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M11 18h2"/></svg>',
  tick: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>'
};

let api, APP = null, SID = null, PLANS = [], PEOPLE = {}, MSGS = [];
let peopleLoaded = false, plansLoaded = false, subs = [], msgUnsub = null, toastTimer;
let prev = {}, flash = {};
const ui = { screen: 'loading', planId: null, seg: 'all', q: '', year: '1st year', newcomer: true, showFilters: false,
  cat: 'All', club: '', when: 'any', size: 'any', newOnly: false, space: false, noAlc: false };
const NO_FILTERS = { cat: 'All', club: '', when: 'any', size: 'any', newOnly: false, space: false, noAlc: false };

const me = () => PEOPLE[api.uid];
const person = id => PEOPLE[id] || { name: 'Someone', year: '' };
const count = p => p.going.length + (p.extra || 0);
// Every plan needs at least 3 people; max 0 means there's no upper limit.
const full = p => p.max > 0 && count(p) >= p.max;
const sizeText = p => p.max > 0 ? `3 to ${p.max} people` : '3 or more people, no limit';
const sizeBucket = p => p.official || !(p.max > 0) ? 'open' : p.max <= 6 ? 'small' : 'ten';
const panelCount = () => ['when', 'size', 'newOnly', 'space', 'noAlc'].filter(k => ui[k] !== NO_FILTERS[k]).length;
const live = p => !['review', 'declined', 'removed'].includes(p.status);
const fmtTime = ms => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
const minsLeft = p => Math.max(0, Math.ceil((p.deadlineAt - Date.now()) / 60000));
// A deadline of 0 means the presenter switched auto-cancel off.
const expired = p => p.status === 'open' && p.deadlineAt > 0 && p.deadlineAt < Date.now() && p.going.length < 3;
const curPlan = () => PLANS.find(p => p.id === ui.planId);
const isFlash = id => flash[id] && Date.now() - flash[id] < 1500;
function anon(s) { return ({ '1st year': 'A 1st-year', '2nd year': 'A 2nd-year', '3rd year': 'A 3rd-year', 'Master': 'A Master\'s student', 'Exchange': 'An exchange student' })[s?.year] || 'A student'; }
const log = (kind, text, extra = {}) => api.addLog(SID, { kind, text, ...extra });

/* ---------- Data ---------- */
async function start() {
  try { api = await connect(); }
  catch (e) {
    console.error(e);
    $('#ph-body').innerHTML = `<div class="center"><div class="logo">Tagalong</div><div>Couldn't connect. Check your internet connection and reload the page.</div></div>`;
    return;
  }
  if (api.mode === 'local') $('#banner').innerHTML = '<div class="banner">Local test mode: only syncs between tabs in this browser.</div>';
  api.watchApp(app => {
    APP = app;
    if (!app || !app.sid) { ui.screen = 'waiting'; render(); return; }
    if (app.sid !== SID) switchSession(app.sid);
    else if (ui.screen === 'post') runCheck();
  });
  setInterval(tickDeadlines, 5000);
  setInterval(() => { if (ui.screen === 'home' || ui.screen === 'detail') softUpdate(); }, 20000);
}
function switchSession(sid) {
  subs.forEach(u => u()); subs = []; stopMsgs();
  SID = sid; PLANS = []; PEOPLE = {}; prev = {}; peopleLoaded = plansLoaded = false;
  ui.screen = 'loading'; render();
  subs.push(api.watch(sid, 'people', list => { PEOPLE = Object.fromEntries(list.map(p => [p.id, p])); peopleLoaded = true; afterData(); }));
  subs.push(api.watch(sid, 'plans', list => { onPlans(list); plansLoaded = true; afterData(); }));
}
function afterData() {
  if (!peopleLoaded || !plansLoaded) return;
  if (!me()) { if (ui.screen !== 'welcome') { ui.screen = 'welcome'; render(); } return; }
  if (['loading', 'welcome', 'waiting'].includes(ui.screen)) {
    // #post or #plan-<id> open a screen directly (handy for sharing a plan link).
    const h = location.hash.slice(1);
    if (h === 'post' || h === 'chats') go(h);
    else if (h.startsWith('plan-') && PLANS.some(p => p.id === h.slice(5))) go('detail', h.slice(5));
    else { ui.screen = 'home'; render(); }
    return;
  }
  softUpdate();
}
function onPlans(list) {
  const first = !plansLoaded;
  for (const p of list) {
    const was = prev[p.id];
    if (!first) {
      if (!was || was.n !== p.going.length || was.status !== p.status) flash[p.id] = Date.now();
      if (was && was.status !== p.status) notifyChange(p, was.status);
    }
    prev[p.id] = { status: p.status, n: p.going.length };
  }
  PLANS = list;
}
function notifyChange(p, from) {
  const mine = p.going.includes(api.uid), host = p.host === api.uid;
  if (p.status === 'ahead' && mine) toast(`<span><b>It's on!</b> ${esc(p.title)} is going ahead. The group chat is open.</span>`, 'ok', { label: 'Open chat', act: 'chat', id: p.id });
  else if (p.status === 'cancelled' && mine) toast(`<span>${esc(p.title)} didn't reach 3 people, so it's cancelled. Everyone was notified.</span>`);
  else if (from === 'review' && host && live(p)) toast(`<span>Student Life approved ${esc(p.title)}. It's live.</span>`, 'ok', { label: 'View', act: 'open', id: p.id });
  else if (p.status === 'declined' && host) toast(`<span>Student Life didn't approve ${esc(p.title)}.</span>`);
  else if (p.status === 'removed' && (mine || host)) toast(`<span>${esc(p.title)} was removed by the organisers.</span>`);
}
function tickDeadlines() {
  if (!SID) return;
  for (const p of PLANS) {
    if (expired(p) && (p.host === api.uid || p.going.includes(api.uid)))
      api.patchPlan(SID, p.id, { status: 'cancelled' }).catch(() => { });
  }
}
function watchMsgs(id) {
  stopMsgs(); MSGS = [];
  msgUnsub = api.watchMessages(SID, id, list => { MSGS = list; if (ui.screen === 'chat') renderMsgs(); });
}
function stopMsgs() { if (msgUnsub) { msgUnsub(); msgUnsub = null; } }

/* ---------- Rendering ---------- */
function avatar(id) {
  const p = person(id), mine = id === api.uid;
  const hue = (String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 4) + 1;
  return `<span class="av ${mine ? 'me' : ''}" style="background:var(--av${hue})" title="${esc(mine ? 'You' : p.name)}">${esc(mine ? 'You' : (p.name || '?')[0])}</span>`;
}
function alcShort(p) {
  const d = p.decl;
  if (!d || !d.drinks || !d.drinks.length) return 'Alcohol';
  return 'Alcohol · ' + d.drinks.map(k => DRINKS[k]).join(', ') + (d.glasses ? ` · max ${d.glasses}/person` : '');
}
function badges(p) {
  let h = p.official ? `<span class="b b-official">Official · ${esc(p.club)}</span>` : `<span class="b b-inf">Informal · free</span>`;
  if (p.newcomer) h += `<span class="b b-new">Newcomer-friendly</span>`;
  if (p.alcohol) h += `<span class="b b-alc">${esc(alcShort(p))}</span>`;
  if (p.host === api.uid) h += `<span class="b b-you">Your plan</span>`;
  return h;
}
function statusText(p) {
  const n = count(p);
  if (p.status === 'review') return `<span class="st st-warn">Waiting for Student Life</span>`;
  if (p.status === 'declined') return `<span class="st st-x">Not approved</span>`;
  if (p.status === 'removed') return `<span class="st st-x">Removed</span>`;
  if (p.official) return `<span class="st st-off">Official event</span>`;
  if (p.status === 'ahead') return `<span class="st st-go">✓ Going ahead</span>`;
  if (p.status === 'cancelled') return `<span class="st st-x">Cancelled</span>`;
  return `<span class="st st-warn">Needs ${3 - n} more${p.deadlineAt ? ` · ${minsLeft(p)} min left` : ''}</span>`;
}
function visiblePlans() {
  const q = ui.q.trim().toLowerCase(), rank = { open: 0, ahead: 1, official: 1, review: 2, cancelled: 3, declined: 4, removed: 5 };
  return PLANS.filter(p => {
    if (p.status === 'removed') return false;
    if (!live(p) && p.host !== api.uid) return false;
    if (ui.seg === 'official' && !p.official) return false;
    if (ui.seg === 'informal' && p.official) return false;
    if (ui.seg === 'official' && ui.club && p.club !== ui.club) return false;
    if (ui.cat !== 'All' && p.cat !== ui.cat) return false;
    if (ui.when !== 'any' && !WHEN_RE[ui.when].test(p.when)) return false;
    if (ui.size !== 'any' && sizeBucket(p) !== ui.size) return false;
    if (ui.newOnly && !p.newcomer) return false;
    if (ui.space && (full(p) || !['open', 'ahead', 'official'].includes(p.status))) return false;
    if (ui.noAlc && p.alcohol) return false;
    if (q && !(p.title + ' ' + p.cat + ' ' + p.place + ' ' + (p.club || '')).toLowerCase().includes(q)) return false;
    return true;
  }).sort((a, b) => rank[a.status] - rank[b.status] || (b.newcomer ? 1 : 0) - (a.newcomer ? 1 : 0) || b.postedAt - a.postedAt);
}
function feedHTML() {
  const ps = visiblePlans();
  if (!ps.length) {
    const filtered = ui.q || ui.seg !== 'all' || Object.keys(NO_FILTERS).some(k => ui[k] !== NO_FILTERS[k]);
    return filtered ? `<div class="empty">No plans match these filters.<br><button class="filt" data-act="clear">Clear filters</button></div>`
      : `<div class="empty">Nothing here yet. Be the first: tap Post and suggest something to do.</div>`;
  }
  return ps.map(p => {
    const n = count(p);
    const mine = p.going.includes(api.uid) && live(p) ? ' · you\'re in' : '';
    return `<button class="card ${['cancelled', 'declined'].includes(p.status) ? 'cx' : ''} ${isFlash(p.id) ? 'flash' : ''}" data-act="open" data-id="${p.id}">
      <div class="badges">${badges(p)}</div>
      <div class="c-title">${esc(p.title)}</div>
      <div class="c-meta">${esc(p.when)} · ${esc(p.place)}</div>
      <div class="c-foot"><span>${n} going${p.official ? '' : p.max > 0 ? ` · max ${p.max}` : ' · no limit'}${mine}</span>${statusText(p)}</div></button>`;
  }).join('');
}
function hintHTML() {
  const p = PLANS.find(x => x.status === 'open' && x.going.length === 2 && !x.going.includes(api.uid));
  if (!p) return '';
  return `<button class="hint" data-act="open" data-id="${p.id}"><b>Make it happen:</b> ${esc(p.title)} needs one more person. Join to make it 3.</button>`;
}
function welcomeHTML() {
  return `<div class="ph-pad welcome">
    <div class="logo">Tagalong</div>
    <div class="tag">Welcome from ${esc(CAMPUS_NAME)} student life</div>
    <h1>Let's find your people on campus</h1>
    <div class="verified">${I.tick} Class demo: everyone who scans the code joins the same campus.</div>
    <div id="install"></div>
    <form class="form" id="welcome-form" novalidate>
      <label>Your first name<input type="text" id="w-name" maxlength="20" autocomplete="given-name" placeholder="e.g. Alex"></label>
      <div class="sub" style="font-weight:600">Year</div>
      <div class="chips">${YEARS.map(y => `<button type="button" class="chip" data-act="year" data-v="${y}" aria-pressed="${ui.year === y}">${y}</button>`).join('')}</div>
      <div class="sub" style="font-weight:600">Are you new on campus?</div>
      <div class="seg two"><button type="button" data-act="newc" data-v="1" aria-pressed="${ui.newcomer}">Yes, I'm new</button><button type="button" data-act="newc" data-v="0" aria-pressed="${!ui.newcomer}">Been here a while</button></div>
      <div class="note">Only your first name and year are saved. The presenter wipes everything after class.</div>
      <div class="err" id="w-err" aria-live="polite"></div>
      <button class="primary" type="submit">Show me what's on</button>
    </form></div>`;
}
function homeHTML() {
  return `<div class="ph-pad">
    <div class="ph-head"><div><div class="logo">Tagalong</div><div class="sub">Hi ${esc(me().name)} · ${esc(CAMPUS_NAME)}</div></div>
      <button class="free" data-act="free" aria-pressed="${ui.when === 'today'}">I'm free tonight</button></div>
    <label class="search">${I.search}<input id="q" type="search" placeholder="I want to do something…" value="${esc(ui.q)}" aria-label="Search plans"></label>
    <div id="filters">${filtersHTML()}</div>
    <div id="install"></div>
    <div id="hint"></div>
    <div class="eyebrow">Happening soon</div>
    <div class="feed" id="feed"></div></div>`;
}
function filtersHTML() {
  const chip = (act, v, label, on) => `<button class="chip" data-act="${act}" data-v="${esc(v)}" aria-pressed="${on}">${esc(label)}</button>`;
  const n = panelCount();
  let h = `<div class="seg">${[['all', 'All'], ['official', 'Official clubs'], ['informal', 'Informal']].map(([k, l]) => `<button data-act="seg" data-k="${k}" aria-pressed="${ui.seg === k}">${l}</button>`).join('')}</div>`;
  if (ui.seg === 'official') {
    const upcoming = c => PLANS.filter(p => p.official && p.club === c && live(p)).length;
    h += `<div class="scroll-row" role="group" aria-label="Club">${chip('club', '', 'All clubs', !ui.club)}${CLUBS.map(c => chip('club', c.name, c.name + (upcoming(c.name) ? ` · ${upcoming(c.name)}` : ''), ui.club === c.name)).join('')}</div>`;
  }
  h += `<div class="scroll-row" role="group" aria-label="Category">${['All', ...CATS].map(c => chip('cat', c, c === 'All' ? 'Everything' : c, ui.cat === c)).join('')}</div>
    <div class="filt-row"><button class="filt" data-act="filters" aria-expanded="${ui.showFilters}">Filters${n ? ` · ${n}` : ''}</button>
      ${n || ui.cat !== 'All' || ui.club ? '<button class="filt" data-act="clear">Clear</button>' : ''}</div>`;
  if (ui.showFilters) h += `<div class="fpanel">
      <div class="sub">When</div><div class="chips">${WHENS.map(([k, l]) => chip('when', k, l, ui.when === k)).join('')}</div>
      <div class="sub">Group size</div><div class="chips">${SIZES.map(([k, l]) => chip('size', k, l, ui.size === k)).join('')}</div>
      <div class="chips">${chip('newOnly', '', 'Newcomer-friendly', ui.newOnly)}${chip('space', '', 'Still has space', ui.space)}${chip('noAlc', '', 'No alcohol', ui.noAlc)}</div></div>`;
  return h;
}
function alcBoxHTML(p) {
  if (!p.alcohol) return '';
  const d = p.decl || {}; const li = [];
  if (d.drinks && d.drinks.length) li.push('Serves: ' + d.drinks.map(k => DRINKS[k]).join(', '));
  if (d.glasses) li.push(`Limit: ${d.glasses} glass${d.glasses > 1 ? 'es' : ''} per person`);
  if (d.food) li.push('Food provided');
  if (d.soft) li.push('Soft drinks cheaper than alcohol');
  if (d.members) li.push(`Members of ${p.club || 'the club'} only`);
  if (d.resp) li.push(`Responsible: ${d.resp}${d.trained ? ' (prevention training done)' : ''}`);
  if (!li.length) li.push('This plan involves alcohol. It\'s labelled so anyone can filter it out.');
  return `<div class="box alc-box"><div class="eyebrow">Alcohol at this event</div><ul>${li.map(x => `<li>${esc(x)}</li>`).join('')}</ul><small>Checked against ${esc(CAMPUS_NAME)}'s alcohol policy</small></div>`;
}
function detailHTML(p) {
  if (!p) return `<div class="center">This plan is no longer available.<button class="ghost" data-act="home">Back to Home</button></div>`;
  const n = count(p), inn = p.going.includes(api.uid), host = person(p.host);
  let rule = '';
  if (['review', 'declined', 'removed'].includes(p.status)) {
    const head = { review: 'Waiting for Student Life', declined: 'Not approved by Student Life', removed: 'Removed by the organisers' }[p.status];
    const body = { review: 'Only you can see this plan until a staff member approves it.', declined: 'Student Life didn\'t approve this plan.', removed: 'This plan was taken down.' }[p.status];
    const rs = (p.reasons || []).filter(r => r.l !== 'info');
    rule = `<div class="box rule"><div class="rule-top"><span>${head}</span></div><p>${body}${rs.length ? ' The auto-check flagged:' : ''}</p>
      ${rs.length ? `<ul class="reasons">${rs.map(r => `<li>${esc(r.t)}</li>`).join('')}</ul>` : ''}</div>`;
  } else if (!p.official) {
    const k = Math.min(p.going.length, 3);
    const cls = p.status === 'ahead' ? 'ok' : p.status === 'cancelled' ? 'x' : '';
    const msg = p.status === 'ahead' ? 'Going ahead. The group chat is open for everyone who joined.'
      : p.status === 'cancelled' ? `Cancelled: only ${p.going.length} joined in time, so everyone was notified.`
        : p.deadlineAt ? `Meetups are never one-on-one. If fewer than 3 people join by ${fmtTime(p.deadlineAt)} (${minsLeft(p)} min), the plan is cancelled and everyone is notified.`
          : 'Meetups are never one-on-one. The plan goes ahead as soon as 3 people have joined.';
    const room = p.max > 0 ? `Room for up to ${p.max}.` : 'No upper limit: everyone is welcome.';
    rule = `<div class="box rule ${cls}"><div class="rule-top"><span>${p.status === 'ahead' ? `${p.going.length} going` : 'Needs at least 3 people to go ahead'}</span><span>${k} of 3 minimum</span></div>
      <div class="bar3">${[0, 1, 2].map(i => `<i class="${i < k ? 'on' : ''}"></i>`).join('')}</div><p>${msg} ${room}</p></div>`;
  }
  const hostBox = p.official
    ? `<div class="box host"><span class="av" style="background:var(--av2)">${esc(p.club[0])}</span><div><b>${esc(p.club)}</b><small>Official club${clubInfo(p.club) ? ' · ' + esc(clubInfo(p.club).blurb) : ''}</small></div></div>`
    : `<div class="box host">${avatar(p.host)}<div><b>Posted by ${p.host === api.uid ? 'you' : esc(host.name)}</b><small>${esc(host.year)} · verified student</small></div></div>`;
  const leaveBtn = `<button class="ghost" data-act="leave" data-id="${p.id}">Can't make it</button>`;
  let btns;
  if (p.status === 'review') btns = `<button class="primary" disabled>Pending review</button>`;
  else if (p.status === 'declined') btns = `<button class="primary" disabled>Not approved</button>`;
  else if (p.status === 'removed') btns = `<button class="primary" disabled>Removed</button>`;
  else if (p.status === 'cancelled') btns = `<button class="primary" disabled>Cancelled</button>`;
  else if (inn && p.status === 'ahead') btns = `<button class="primary go" data-act="chat" data-id="${p.id}">Open group chat</button>${leaveBtn}`;
  else if (inn && p.official) btns = `<button class="primary" disabled>You're going</button>${p.host === api.uid ? '' : leaveBtn}`;
  else if (inn) btns = `<button class="primary" disabled>You're in · needs ${3 - p.going.length} more</button>${p.host === api.uid ? '' : leaveBtn}`;
  else if (full(p)) btns = `<button class="primary" disabled>Full</button>`;
  else btns = `<button class="primary" data-act="join" data-id="${p.id}">${!p.official && p.going.length === 2 ? 'Join · makes it 3' : 'Join'}</button><button class="ghost" data-act="home">Not today</button>`;
  const shown = p.going.slice(0, 12);
  return `<div class="d-head"><button class="back" data-act="home" aria-label="Back">${I.back}</button>
      <div class="badges">${badges(p)}</div><h2>${esc(p.title)}</h2>${p.desc ? `<div class="c-meta">${esc(p.desc)}</div>` : ''}</div>
    <div class="ph-pad">${rule}${alcBoxHTML(p)}${hostBox}
      <div class="box"><div class="row">${I.clock}${esc(p.when)}</div><div class="row">${I.pin}${esc(p.place)}</div>
      <div class="row">${I.ppl}${p.official ? 'Open to everyone' : sizeText(p)} · ${esc(p.cat)}${p.newcomer ? ' · newcomer-friendly' : ''}</div></div>
      <div class="eyebrow">Who's going · ${n}</div>
      <div class="avs">${shown.map(avatar).join('')}${n > shown.length ? `<span class="av" style="background:var(--off-soft)">+${n - shown.length}</span>` : ''}</div>
    </div>
    <div class="d-foot"><div class="acts">${btns}</div>${p.official || !live(p) || p.status !== 'open' ? '' : '<div class="cap">The group chat opens once the plan goes ahead</div>'}</div>`;
}
function postHTML() {
  return `<div class="ph-pad"><div class="logo">Post a plan</div>
    <div class="sub">Try an example to see the auto-check:</div>
    <div class="ex-row">${EXAMPLES.map((e, i) => `<button type="button" class="ex" data-act="ex" data-i="${i}">${esc(e.label)}</button>`).join('')}</div>
    <form class="form" id="post-form" novalidate>
      <label>Post as<select id="f-as"><option value="me">Me (informal plan)</option>${CLUBS.map(c => `<option value="${esc(c.name)}">${esc(c.name)} (official club)</option>`).join('')}</select></label>
      <div class="note" id="club-note" hidden>Demo only: in the real app, only verified club admins can post as a club.</div>
      <label>What do you want to do?<input type="text" id="f-title" maxlength="50" placeholder="e.g. Sunset picnic in the park"></label>
      <label>Details (optional)<input type="text" id="f-desc" maxlength="80" placeholder="Anything people should know"></label>
      <div class="two"><label>Category<select id="f-cat">${CATS.map(c => `<option>${c}</option>`).join('')}</select></label>
      <label>When<select id="f-when"><option>Today 17:30</option><option>Tonight 20:00</option><option>Tomorrow 12:30</option><option>Sat 15:00</option></select></label></div>
      <label>Where<input type="text" id="f-place" maxlength="40" placeholder="Pick a public place" value="Student union terrace"></label>
      <label id="f-max-wrap">Group size (at least 3)<select id="f-max"><option value="6" selected>3 to 6 people</option><option value="10">3 to 10 people</option><option value="0">3 or more, no limit</option></select></label>
      <label class="chk"><input type="checkbox" id="f-new" checked>Newcomer-friendly</label>
      <label class="chk"><input type="checkbox" id="f-alc"><span id="f-alc-l">Involves alcohol</span></label>
      <fieldset class="decl" id="decl" hidden><legend>Alcohol declaration</legend>
        <div class="dchips">${Object.keys(DRINKS).map(k => `<label class="dchip"><input type="checkbox" id="d-${k}">${DRINKS[k]}</label>`).join('')}</div>
        <label>Max per person<select id="d-gl"><option value="1">1 glass</option><option value="2">2 glasses</option><option value="3">3 glasses</option></select></label>
        <label>Responsible person<input type="text" id="d-resp" maxlength="30" placeholder="Name"></label>
        <label class="chk"><input type="checkbox" id="d-trained">They've done the prevention training</label>
        <label class="chk"><input type="checkbox" id="d-food">Food provided</label>
        <label class="chk"><input type="checkbox" id="d-soft">Soft drinks cheaper than alcohol</label>
        <label class="chk"><input type="checkbox" id="d-members">Members only</label>
      </fieldset>
      <div id="check" aria-live="polite"></div>
      <button class="primary" type="submit" id="post-btn">Post to campus</button>
    </form></div>`;
}
function chatsHTML() {
  const mine = PLANS.filter(p => !p.official && p.going.includes(api.uid) && p.status !== 'removed');
  const rows = mine.length ? mine.map(p => {
    if (p.status === 'ahead') return `<button class="chat-row" data-act="chat" data-id="${p.id}"><b>${esc(p.title)}</b><small>Group chat · ${p.going.length} people</small></button>`;
    if (p.status === 'cancelled') return `<button class="chat-row" disabled><b>${esc(p.title)}</b><small>Cancelled: didn't reach 3 people</small></button>`;
    if (p.status === 'review') return `<button class="chat-row" data-act="open" data-id="${p.id}"><b>${esc(p.title)}</b><small>Waiting for Student Life to approve the plan</small></button>`;
    if (p.status === 'declined') return `<button class="chat-row" disabled><b>${esc(p.title)}</b><small>Not approved by Student Life</small></button>`;
    return `<button class="chat-row" data-act="open" data-id="${p.id}"><b>${esc(p.title)}</b><small>${I.lock} Opens once 3 people join · ${p.going.length} of 3 so far</small></button>`;
  }).join('') : `<div class="empty">No chats yet. A plan's chat opens once it reaches 3 people. Join something on Home.</div>`;
  return `<div class="ph-pad"><div class="logo">Chats</div><div class="feed">${rows}</div></div>`;
}
function chatHTML(p) {
  if (!p || p.status !== 'ahead' || !p.going.includes(api.uid)) return detailHTML(p);
  return `<div class="chat-wrap"><div class="c-headbar"><button class="back" data-act="chats" aria-label="Back">${I.back}</button><div><b>${esc(p.title)}</b><small>${p.going.length} people · going ahead</small></div></div>
    <div class="msgs" id="msgs"></div>
    <form class="composer" id="chat-form"><input id="chat-in" placeholder="Message the group" autocomplete="off" maxlength="300" aria-label="Message"><button type="submit">Send</button></form></div>`;
}
function renderMsgs() {
  const m = $('#msgs'); if (!m) return;
  const atEnd = m.scrollHeight - m.scrollTop - m.clientHeight < 60;
  m.innerHTML = MSGS.length ? MSGS.map(x => x.from === 'sys' ? `<div class="msg sys"><span>${esc(x.text)}</span></div>`
    : x.from === api.uid ? `<div class="msg mine"><span>${esc(x.text)}</span></div>`
      : `<div class="msg"><small>${esc(person(x.from).name)}</small><span>${esc(x.text)}</span></div>`).join('')
    : '<div class="empty">Say hi to the group.</div>';
  if (atEnd || !m.dataset.init) { m.scrollTop = m.scrollHeight; m.dataset.init = 1; }
}

function go(screen, id) {
  if (id != null) ui.planId = id;
  if (screen === 'chat') watchMsgs(ui.planId); else stopMsgs();
  ui.screen = screen; render(); window.scrollTo(0, 0);
}
function render() {
  const body = $('#ph-body'), s = ui.screen;
  if (s === 'loading') body.innerHTML = `<div class="center"><div class="logo">Tagalong</div><div>Connecting to campus…</div></div>`;
  else if (s === 'waiting') body.innerHTML = `<div class="center"><div class="logo">Tagalong</div><div>The campus isn't open yet. The presenter needs to open the console first.</div></div>`;
  else if (s === 'welcome') body.innerHTML = welcomeHTML();
  else if (s === 'home') body.innerHTML = homeHTML();
  else if (s === 'detail') body.innerHTML = detailHTML(curPlan());
  else if (s === 'post') body.innerHTML = postHTML();
  else if (s === 'chats') body.innerHTML = chatsHTML();
  else if (s === 'chat') { body.innerHTML = chatHTML(curPlan()); renderMsgs(); }
  renderNav();
  if (s === 'home') updateFeed();
  renderInstall();
  if (s === 'post') runCheck();
}
function renderNav() {
  const nav = $('#ph-nav');
  nav.hidden = !['home', 'post', 'chats'].includes(ui.screen);
  if (nav.hidden) return;
  const n = PLANS.filter(p => p.status === 'ahead' && p.going.includes(api.uid)).length;
  nav.innerHTML = [['home', 'Home', I.home], ['post', 'Post', I.plus], ['chats', 'Chats', I.chat]].map(([k, l, ic]) =>
    `<button data-act="${k}" ${ui.screen === k ? 'aria-current="page"' : ''}>${ic}${l}${k === 'chats' && n ? `<span class="dot-badge">${n}</span>` : ''}</button>`).join('');
}
function updateFilters() {
  const f = $('#filters'); if (f) f.innerHTML = filtersHTML();
  const free = document.querySelector('[data-act=free]'); if (free) free.setAttribute('aria-pressed', ui.when === 'today');
  updateFeed();
}
function updateFeed() { const f = $('#feed'); if (f) { f.innerHTML = feedHTML(); $('#hint').innerHTML = hintHTML(); } }
// Refreshes data-driven parts without touching anything the person is typing into.
function softUpdate() {
  if (ui.screen === 'home') updateFeed();
  else if (ui.screen === 'detail') $('#ph-body').innerHTML = detailHTML(curPlan());
  else if (ui.screen === 'chats') $('#ph-body').innerHTML = chatsHTML();
  else if (ui.screen === 'chat') { const p = curPlan(); if (!p || p.status !== 'ahead') render(); }
  renderNav();
}
function toast(html, kind, action) {
  clearTimeout(toastTimer);
  $('#toast-slot').innerHTML = `<div class="toast ${kind || ''}" role="status">${html}${action ? `<button data-act="${action.act}" data-id="${action.id}">${esc(action.label)}</button>` : ''}</div>`;
  toastTimer = setTimeout(() => { $('#toast-slot').innerHTML = ''; }, 5500);
}

/* ---------- Install as an app ---------- */
let installEvt = null;
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isAndroid = () => /android/i.test(navigator.userAgent);
let installDismissed = false; try { installDismissed = localStorage.getItem('tl-install-dismissed') === '1'; } catch { }
function installHTML() {
  if (standalone() || installDismissed) return '';
  let body;
  if (installEvt) body = `<span><b>Get the app.</b> Install Tagalong on your phone.</span><button class="inst-btn" data-act="install">Install</button>`;
  else if (isIOS()) body = `<span><b>Get the app:</b> tap ${SHARE} Share, then <b>Add to Home Screen</b>.</span>`;
  else if (isAndroid()) body = `<span><b>Get the app:</b> open the browser menu ⋮ and tap <b>Install app</b> or <b>Add to Home screen</b>.</span>`;
  else return '';
  return `<div class="install">${I.phone}${body}<button class="inst-x" data-act="install-x" aria-label="Dismiss">×</button></div>`;
}
function renderInstall() { const el = $('#install'); if (el) el.innerHTML = installHTML(); }
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; renderInstall(); });
window.addEventListener('appinstalled', () => { installEvt = null; renderInstall(); toast('<span>Tagalong is on your home screen.</span>', 'ok'); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('[tagalong] service worker', e));

/* ---------- Posting ---------- */
function readForm() {
  const as = $('#f-as').value, club = as !== 'me', alc = $('#f-alc').checked;
  return {
    space: club ? 'official' : 'informal', club: club ? as : null, title: $('#f-title').value.trim(), desc: $('#f-desc').value.trim(),
    cat: $('#f-cat').value, when: $('#f-when').value, place: $('#f-place').value.trim() || 'Campus', max: club ? 0 : +$('#f-max').value,
    newcomer: $('#f-new').checked, alcohol: alc,
    decl: club && alc ? {
      drinks: Object.keys(DRINKS).filter(k => $('#d-' + k).checked), glasses: +$('#d-gl').value, resp: $('#d-resp').value.trim(),
      trained: $('#d-trained').checked, food: $('#d-food').checked, soft: $('#d-soft').checked, members: $('#d-members').checked
    } : null
  };
}
const CK_HEAD = { ok: 'Good to go', label: 'Posts with an alcohol label', review: 'A Student Life staff member will take a quick look', contact: 'Contact Student Life before posting', block: 'This can\'t be posted yet' };
const BTN = { ok: 'Post to campus', label: 'Post with alcohol label', review: 'Send for a quick review', contact: 'Contact Student Life first', block: 'Fix the issues to post' };
function runCheck() {
  if (ui.screen !== 'post' || !$('#post-form') || !APP) return;
  const post = readForm(), club = post.space === 'official';
  $('#f-max-wrap').hidden = club; $('#club-note').hidden = !club;
  $('#f-alc-l').textContent = club ? 'This event serves alcohol' : 'Involves alcohol';
  $('#decl').hidden = !(club && post.alcohol);
  const box = $('#check'), btn = $('#post-btn');
  if (!post.title) {
    box.innerHTML = `<div class="check ok"><div class="ck-h">${I.shield} Auto-check is on</div><div>Every post is read against ${esc(CAMPUS_NAME)}'s alcohol policy before it goes live.</div></div>`;
    btn.textContent = 'Post to campus'; return;
  }
  const res = check(post, APP.policy);
  const items = res.R.map(r => `<li>${esc(r.t)}</li>`);
  if (res.out === 'contact') items.push(`<li>Email ${esc(APP.policy.contact)} to get it approved.</li>`);
  if (!items.length) items.push(res.out === 'label' ? '<li>Declaration complete. Students will see exactly what is served.</li>' : '<li>Nothing in this post needs a check.</li>');
  box.innerHTML = `<div class="check ${res.out}"><div class="ck-h">${I.shield} ${CK_HEAD[res.out]}</div><ul>${items.join('')}</ul><div class="ck-f">Auto-check · ${esc(CAMPUS_NAME)} alcohol policy</div></div>`;
  btn.textContent = BTN[res.out];
}
function fillExample(i) {
  const e = EXAMPLES[i];
  $('#f-as').value = e.as; $('#f-title').value = e.title; $('#f-desc').value = e.desc; $('#f-place').value = e.place; $('#f-cat').value = e.cat; $('#f-alc').checked = e.alc;
  const d = e.decl || { drinks: [], glasses: 1, resp: '', trained: false, food: false, soft: false, members: false };
  Object.keys(DRINKS).forEach(k => { $('#d-' + k).checked = d.drinks.includes(k); });
  $('#d-gl').value = d.glasses; $('#d-resp').value = d.resp; $('#d-trained').checked = d.trained; $('#d-food').checked = d.food; $('#d-soft').checked = d.soft; $('#d-members').checked = d.members;
  runCheck();
}
const deadlineFrom = now => { const w = APP.settings?.windowMin ?? 10; return w > 0 ? now + w * 60000 : 0; };
let posting = false, lastPostAt = 0;
async function submitPost() {
  if (posting) return;
  const wait = Math.ceil((lastPostAt + 20000 - Date.now()) / 1000);
  if (wait > 0) { toast(`<span>You just posted. You can post again in ${wait} seconds.</span>`); return; }
  const post = readForm();
  if (!post.title) { $('#f-title').focus(); return; }
  const res = check(post, APP.policy);
  const firstIssue = (res.R.find(r => r.l === 'block') || res.R.find(r => r.l === 'review') || { t: '' }).t;
  if (res.out === 'block' || res.out === 'contact') {
    log('blocked', `Auto-check stopped “${post.title}”: ${res.out === 'contact' ? 'organiser asked to contact Student Life' : firstIssue}`);
    toast(`<span>Not posted. ${res.out === 'contact' ? 'Contact Student Life to get it approved.' : 'Fix the issues shown under the form.'}</span>`);
    return;
  }
  posting = true;
  const official = post.space === 'official';
  const plan = {
    ...post, official, alcohol: res.involves, host: api.uid, going: [api.uid], extra: 0,
    status: res.out === 'review' ? 'review' : official ? 'official' : 'open',
    postedAt: Date.now(), deadlineAt: deadlineFrom(Date.now()), reasons: res.R
  };
  try {
    const id = await api.addPlan(SID, plan);
    lastPostAt = Date.now();
    if (res.out === 'review') {
      log('review', `Auto-check sent “${post.title}” to Student Life: ${firstIssue}`);
      toast(`<span>Sent to Student Life for a quick check. You'll be told when it's approved.</span>`);
    } else {
      log('post', `${post.title} was posted (${post.cat})${res.involves ? ' with an alcohol label' : ''}`, { alc: res.involves });
      toast(`<span>Posted${res.involves ? ' with an alcohol label' : ''}.${official ? '' : ' It goes ahead once 2 more people join.'}</span>`, 'ok');
    }
    go('detail', id);
  } catch (e) {
    console.error(e); toast('<span>Couldn\'t post. Check your connection and try again.</span>');
  } finally { posting = false; }
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const id = b.dataset.id, p = PLANS.find(x => x.id === id), act = b.dataset.act;
  if (act === 'open') { $('#toast-slot').innerHTML = ''; go('detail', id); }
  else if (act === 'home' || act === 'post' || act === 'chats') go(act);
  else if (act === 'chat') { $('#toast-slot').innerHTML = ''; go('chat', id); }
  else if (act === 'free') { ui.when = ui.when === 'today' ? 'any' : 'today'; b.setAttribute('aria-pressed', ui.when === 'today'); updateFilters(); }
  else if (act === 'seg') { ui.seg = b.dataset.k; ui.club = ''; updateFilters(); }
  else if (act === 'filters') { ui.showFilters = !ui.showFilters; updateFilters(); }
  else if (act === 'clear') { Object.assign(ui, NO_FILTERS); updateFilters(); }
  else if (act === 'cat' || act === 'club' || act === 'when' || act === 'size') { ui[act] = b.dataset.v; updateFilters(); }
  else if (act === 'newOnly' || act === 'space' || act === 'noAlc') { ui[act] = !ui[act]; updateFilters(); }
  else if (act === 'year') { ui.year = b.dataset.v; ui.newcomer = ui.year === '1st year' || ui.year === 'Exchange'; document.querySelectorAll('[data-act=year]').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === ui.year)); document.querySelectorAll('[data-act=newc]').forEach(x => x.setAttribute('aria-pressed', (x.dataset.v === '1') === ui.newcomer)); }
  else if (act === 'newc') { ui.newcomer = b.dataset.v === '1'; document.querySelectorAll('[data-act=newc]').forEach(x => x.setAttribute('aria-pressed', x.dataset.v === b.dataset.v)); }
  else if (act === 'ex') fillExample(+b.dataset.i);
  else if (act === 'install' && installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; renderInstall(); }); }
  else if (act === 'install-x') { installDismissed = true; try { localStorage.setItem('tl-install-dismissed', '1'); } catch { } renderInstall(); }
  else if (act === 'join' && p) {
    b.disabled = true;
    api.joinPlan(SID, id, api.uid, AHEAD_TEXT).then(ahead => {
      log('join', `${anon(me())} joined ${p.title}`);
      if (!ahead && p.status === 'open') toast(`<span>You're in. ${esc(p.title)} needs ${Math.max(0, 2 - p.going.length)} more to go ahead.</span>`);
    }).catch(err => { toast(`<span>${esc(err.message || 'Couldn\'t join. Try again.')}</span>`); b.disabled = false; });
  }
  else if (act === 'leave' && p) {
    api.leavePlan(SID, id, api.uid).then(() => { log('leave', `${anon(me())} can't make it to ${p.title}`); toast(`<span>Got it. You've left ${esc(p.title)}.</span>`); });
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { ui.q = e.target.value; updateFeed(); }
  else if (e.target.closest('#post-form')) runCheck();
});
document.addEventListener('change', e => { if (e.target.closest('#post-form')) runCheck(); });
document.addEventListener('submit', async e => {
  e.preventDefault();
  if (e.target.id === 'welcome-form') {
    const name = $('#w-name').value.trim().replace(/\s+/g, ' ');
    const err = $('#w-err');
    if (!name) { err.textContent = 'Add your first name so your group knows who you are.'; return; }
    if (isRude(name)) { err.textContent = 'Please use your real first name.'; return; }
    err.textContent = '';
    try {
      await api.setDoc(SID, 'people', api.uid, { name, year: ui.year, newcomer: ui.newcomer, at: Date.now() });
      log('scan', `${anon({ year: ui.year })} joined the campus`);
    } catch (x) { console.error(x); err.textContent = 'Couldn\'t join. Check your connection and try again.'; }
  } else if (e.target.id === 'post-form') submitPost();
  else if (e.target.id === 'chat-form') {
    const inp = $('#chat-in'), v = inp.value.trim(); if (!v) return;
    if (isRude(v)) { toast('<span>Keep it friendly. That message wasn\'t sent.</span>'); return; }
    inp.value = '';
    api.sendMessage(SID, ui.planId, { from: api.uid, text: v }).catch(x => { console.error(x); toast('<span>Message not sent. Try again.</span>'); });
  }
});

start();
