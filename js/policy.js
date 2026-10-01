// Alcohol policy presets and the auto-check that reads every post against the university's policy.

export const DRINKS = { beer: 'Beer', wine: 'Wine', cider: 'Cider & perry', mead: 'Mead', spirits: 'Spirits' };

export const PRESETS = {
  label: {
    name: 'Labelled, not banned',
    blurb: 'Alcohol is allowed but always labelled, so students can filter it out.',
    informal: 'label', club: 'label',
    drinks: { beer: true, wine: true, cider: true, mead: true, spirits: true }, maxGlasses: 0,
    req: { responsible: false, food: false, soft: false, members: false },
    venueOnly: false, venues: '', noRecruit: true, noTeaching: false, flagAction: 'queue'
  },
  regulated: {
    name: 'Regulated',
    blurb: 'No alcohol at informal meetups. Official clubs can serve beer, wine or cider after a short declaration.',
    informal: 'block', club: 'declare',
    drinks: { beer: true, wine: true, cider: true, mead: true, spirits: false }, maxGlasses: 1,
    req: { responsible: true, food: true, soft: true, members: true },
    venueOnly: true, venues: 'Student bar, Union terrace', noRecruit: true, noTeaching: true, flagAction: 'queue'
  },
  dry: {
    name: 'Alcohol-free',
    blurb: 'No alcohol at any event posted on Tagalong, informal or official.',
    informal: 'block', club: 'block',
    drinks: { beer: true, wine: true, cider: true, mead: true, spirits: false }, maxGlasses: 1,
    req: { responsible: true, food: true, soft: true, members: true },
    venueOnly: true, venues: 'Student bar', noRecruit: true, noTeaching: true, flagAction: 'queue'
  }
};

const clone = o => JSON.parse(JSON.stringify(o));
export const defaultPolicy = () =>
  Object.assign(clone(PRESETS.regulated), { preset: 'regulated', contact: 'studentlife@demo-university.example' });
export const presetPolicy = (key, contact) => Object.assign(clone(PRESETS[key]), { preset: key, contact });

const WORDS = {
  strong: ['alcohol', 'alcool', 'beer', 'beers', 'bière', 'biere', 'wine', 'wines', 'vin', 'apéro', 'apero', 'aperitif', 'cocktail', 'cocktails', 'shots', 'shot', 'pint', 'pints', 'prosecco', 'champagne', 'cider', 'cidre', 'vodka', 'rum', 'whisky', 'whiskey', 'tequila', 'gin', 'sangria', 'spritz', 'mead', 'booze', 'pub', 'happy hour'],
  maybe: ['drinks', 'drink', 'bar', 'soirée', 'soiree', 'prés', 'pregame', 'pre-drinks'],
  spirits: ['vodka', 'rum', 'whisky', 'whiskey', 'tequila', 'gin', 'shots', 'shot', 'cocktail', 'cocktails', 'liqueur', 'pastis', 'absinthe', 'jäger', 'jager', 'spirits'],
  excess: ['open bar', 'all you can drink', 'unlimited drinks', 'bottomless', 'drinking game', 'drinking games', 'beer pong', 'flip cup', 'kings cup', "king's cup", 'chug', 'à volonté', 'a volonte', 'shotgun', 'pub crawl', 'bar crawl'],
  recruit: ['recruitment', 'recruiting', 'initiation', 'integration', 'inté', 'hazing', 'rush week', 'pledge'],
  teaching: ['classroom', 'library', 'lecture hall', 'lecture theatre', 'amphi', 'amphitheatre', 'salle de cours', 'seminar room']
};
// Matched at the start of a word, so "fucking" is caught too.
const RUDE = ['fuck', 'shit', 'bitch', 'cunt', 'pussy', 'nigg', 'faggot', 'retard', 'whore', 'slut', 'putain', 'merde', 'connard', 'connasse', 'salope', 'enculé', 'encule', 'nazi'];

const reCache = {};
const escRe = w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function findAll(list, text, prefix) {
  return list.filter(w => {
    const k = (prefix ? 'p:' : 'w:') + w;
    const re = reCache[k] || (reCache[k] = new RegExp('(^|[^\\p{L}])' + escRe(w) + (prefix ? '' : '(?=$|[^\\p{L}])'), 'iu'));
    return re.test(text);
  });
}
export const isRude = text => findAll(RUDE, text, true).length > 0;

const q = w => '“' + w + '”';
export const drinkList = keys => {
  const n = keys.map(k => DRINKS[k].toLowerCase());
  return n.length < 2 ? n.join('') : n.slice(0, -1).join(', ') + ' or ' + n[n.length - 1];
};
const allowedDrinks = P => Object.keys(DRINKS).filter(k => P.drinks[k]);
const venueOk = (P, place) => P.venues.split(',').map(v => v.trim().toLowerCase()).filter(Boolean).some(v => place.toLowerCase().includes(v));

// Returns { out: ok|label|review|contact|block, R: [{l, t}], involves }
export function check(post, P) {
  const text = [post.title, post.desc || '', post.place].join(' ').toLowerCase();
  const R = []; let out = 'ok';
  const rank = { ok: 0, label: 1, review: 2, block: 3 };
  const bump = o => { if (rank[o] > rank[out]) out = o; };
  const official = post.space === 'official', d = post.decl || {}, mode = official ? P.club : P.informal;

  if (isRude(text)) { R.push({ l: 'block', t: 'Keep it friendly: this post contains language that isn\'t allowed.' }); bump('block'); }
  const ex = findAll(WORDS.excess, text);
  if (ex.length) { R.push({ l: 'block', t: `Drinking games, open bars and crawls aren't allowed on Tagalong (found ${q(ex[0])}).` }); bump('block'); }
  const strong = findAll(WORDS.strong, text), maybe = findAll(WORDS.maybe, text);
  let involves = !!post.alcohol || ex.length > 0;
  if (!post.alcohol && strong.length) { involves = true; R.push({ l: 'info', t: `Mentions ${q(strong[0])} but alcohol isn't ticked, so the auto-check treats it as involving alcohol.` }); }
  if (!involves && maybe.length && mode !== 'label') { R.push({ l: 'review', t: `Mentions ${q(maybe[0])}, which might mean alcohol. A person should check.` }); bump('review'); }
  if (involves) {
    if (mode === 'block') { R.push({ l: 'block', t: official ? 'Club events can\'t involve alcohol at this university.' : 'Informal meetups can\'t involve alcohol at this university.' }); bump('block'); }
    else if (mode === 'flag' || mode === 'approve') { R.push({ l: 'review', t: `Alcohol at ${official ? 'club events' : 'informal meetups'} needs approval from Student Life.` }); bump('review'); }
    else bump('label');
    if (mode !== 'block') {
      if (P.noRecruit) { const r = findAll(WORDS.recruit, text); if (r.length) { R.push({ l: 'block', t: `No alcohol at recruitment or integration events (found ${q(r[0])}).` }); bump('block'); } }
      if (P.noTeaching) { const r = findAll(WORDS.teaching, text); if (r.length) { R.push({ l: 'block', t: `No alcohol in teaching spaces (found ${q(r[0])}).` }); bump('block'); } }
      const drinks = official && post.alcohol ? (d.drinks || []) : [];
      const sp = findAll(WORDS.spirits, text);
      if (!P.drinks.spirits && (sp.length || drinks.includes('spirits'))) { R.push({ l: 'block', t: `Spirits aren't allowed${sp.length ? ` (found ${q(sp[0])})` : ''}. Only ${drinkList(allowedDrinks(P))}.` }); bump('block'); }
      const bad = drinks.filter(k => k !== 'spirits' && !P.drinks[k]);
      if (bad.length) { R.push({ l: 'block', t: `${drinkList(bad)} isn't allowed here.` }); bump('block'); }
      if (official && mode === 'declare') {
        if (!post.alcohol) { R.push({ l: 'block', t: 'Tick “This event serves alcohol” and fill in the declaration.' }); bump('block'); }
        else {
          const miss = [];
          if (!drinks.length) miss.push('which drinks are served');
          if (P.maxGlasses && (+d.glasses || 0) > P.maxGlasses) { R.push({ l: 'block', t: `The limit is ${P.maxGlasses} glass${P.maxGlasses > 1 ? 'es' : ''} per person (declared ${d.glasses}).` }); bump('block'); }
          if (P.req.responsible && !(d.resp || '').trim()) miss.push('a responsible person');
          if (P.req.responsible && !d.trained) miss.push('confirmation they did the prevention training');
          if (P.req.food && !d.food) miss.push('food');
          if (P.req.soft && !d.soft) miss.push('soft drinks priced below alcohol');
          if (P.req.members && !d.members) miss.push('members-only access');
          if (miss.length) { R.push({ l: 'block', t: 'The declaration still needs: ' + miss.join(', ') + '.' }); bump('block'); }
          if (P.venueOnly && !venueOk(P, post.place)) { R.push({ l: 'review', t: `Alcohol outside the approved venues (${P.venues}) needs Student Life approval.` }); bump('review'); }
        }
      }
    }
  }
  if (out === 'review' && P.flagAction === 'contact') out = 'contact';
  return { out, R, involves };
}

export function policySummary(P) {
  const li = [];
  li.push({ label: 'Informal meetups can involve alcohol. They are labelled and can be filtered out.', flag: 'Informal meetups that involve alcohol wait for Student Life approval.', block: 'Informal meetups can\'t involve alcohol.' }[P.informal]);
  const dl = drinkList(allowedDrinks(P));
  li.push({ label: 'Club events can serve alcohol. It is always labelled.', declare: `Club events can serve ${dl}${P.maxGlasses ? ` (max ${P.maxGlasses} per person)` : ''} after a short declaration.`, approve: 'Club events with alcohol need Student Life approval.', block: 'Club events can\'t serve alcohol.' }[P.club]);
  li.push('Open bars, drinking games and crawls are blocked everywhere.');
  if (P.noRecruit) li.push('No alcohol at recruitment or integration events.');
  if (P.noTeaching) li.push('No alcohol in classrooms, lecture halls or libraries.');
  li.push(P.flagAction === 'queue' ? 'Unclear posts wait for a quick staff review.' : `Unclear posts are stopped and the organiser is asked to email ${P.contact}.`);
  return li;
}
