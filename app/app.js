/* Taskbound: everything on screen. The Offload parser is in tasks-core.js; art in art.js.
   The numbers are balanced in docs/decisions/game-loop.md ("Balance"); change them there first. */
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NATIVE = window.TaskboundNative || null;
const nat = (fn, ...a) => { try { return NATIVE && NATIVE[fn] ? NATIVE[fn](...a) : undefined } catch (e) { return undefined } };

/* ---------- numbers (game-loop.md, "Balance"; task sizes and daily limits are Pawgress's) ---------- */
const SIZES = {
  tiny: { embers: 1, prov: 1, label: 'Tiny', hint: 'Under 5 min' }, small: { embers: 2, prov: 1, label: 'Small', hint: '5 to 15 min' },
  medium: { embers: 4, prov: 2, label: 'Medium', hint: '15 to 45 min' }, big: { embers: 8, prov: 3, label: 'Big', hint: 'An hour or more' }
}; // the time guides are Pawgress's
const DAILY_EMBERS = 40, DAILY_PROV = 8, PROV_MAX = 12, PROV_START = 6;
const ROOMS = [ // the order the keep wakes
  ['the Gatehouse', 5], ['the Great Hall', 10], ['the Library', 20], ['the Chapel', 30], ['the Kitchens', 40], ['the Armoury', 50], ['the Observatory', 60], ['the Tower Top', 85]];

// Journeys: one knight, one journey at a time. Times, provisions and silver are Pawgress's errands (game-loop.md, "Balance").
// x, y: the place on the star chart (a 358 px square, the keep at the centre); ring: which ring it sits on.
const JOURNEYS = [
  { id: 'garden', name: 'The Hush Garden', ring: 'I', sec: 15 * 60, prov: 1, silver: 5, x: 209, y: 127,
    tale: 'Flowers that only open when nobody is talking. Bramble likes it there.' },
  { id: 'mill', name: 'The Drowned Mill', ring: 'II', sec: 60 * 60, prov: 2, silver: 11, x: 80, y: 143,
    tale: 'The wheel still turns underwater. Someone leaves letters there.' },
  { id: 'ruins', name: 'The Glass Ruins', ring: 'III', sec: 3 * 3600, prov: 3, silver: 18, x: 275, y: 294,
    tale: 'A city made of old windows. The light inside is always morning.' }];
const JOURNEY_BY = Object.fromEntries(JOURNEYS.map(j => [j.id, j]));
/* Found things (game-loop.md, "Found things"): sometimes a journey brings one home, more often from the outer rings.
   Each is a small boost for one journey; they wait in the satchel, never spoil, and the oldest goes with the next
   journey. Whether a journey finds something is fixed when it sets out. Effects as gear: shorter (%), more (%), flat. */
const FOUND = [
  { id: 'thyme', name: 'A sprig of wild thyme', tale: 'It smells of the way home.', shorter: 20 },
  { id: 'pebble', name: 'A pebble with a hole in it', tale: 'Someone will want it.', flat: 4 },
  { id: 'flower', name: 'A pressed flower', tale: 'Nobody can say no to it.', more: 25 },
  { id: 'moth', name: 'A lost lantern-moth', tale: 'It flies ahead and waits.', shorter: 35 }];
const FOUND_BY = Object.fromEntries(FOUND.map(f => [f.id, f]));
const FIND_CHANCE = { garden: 0.2, mill: 0.35, ruins: 0.5 }, SATCHEL_MAX = 30;
const lower = s => s.charAt(0).toLowerCase() + s.slice(1);

// The Market (docs/decisions/game-loop.md). Prices and effects: "Balance" there.
// Furnishings: five per room (game-loop.md), sold once the room is awake. Each has its own place in the room's painting
// (art/rooms.py): keep each room's list in the same order as FURN there. Ids never change: saves keep them.
const ROOM_ART = ['gatehouse', 'hall', 'library', 'chapel', 'kitchens', 'armoury', 'observatory', 'tower'];
const ROOM_WARM = ['The gate is warm.', 'The hall is warm.', 'The library is warm.', 'The chapel is warm.', 'The kitchens are warm.',
  'The armoury is warm.', 'The observatory is warm.', 'The tower top is warm.'];
const FURNISH = [
  [['lantern', 'A lantern that remembers names', 'It says hello when you come home.', 15], ['moss', 'A doormat of moss', 'Soft underfoot. Slightly alive.', 10],
    ['bench', 'A bench for taking boots off', 'Nobody hurries here.', 15], ['heron', 'A coat hook shaped like a heron', 'It holds things very carefully.', 20],
    ['umbrellas', 'A pot of umbrellas, one for every weather', 'Including a few that have not happened yet.', 20]],
  [['table', 'A long table for nobody in particular', 'There is always a spare seat.', 40], ['whale', 'A tapestry of a sleeping whale', 'It breathes, if you watch long enough.', 30],
    ['hearth', 'A hearth that knows who came in from the rain', 'It burns a little brighter for them.', 45], ['chandelier', 'A chandelier of candle stubs', 'Made from candles you have lit.', 50],
    ['rug', 'A rug the colour of late autumn', 'Footsteps go quiet on it.', 25]],
  [['ladder', 'A ladder to the top shelf', 'The top shelf is higher than it looks.', 45], ['chair', 'A reading chair that hums', 'Quietly, and only the good parts.', 60],
    ['shelves', 'Shelves of books still being written', 'They fill in a little each night.', 65], ['lamp', 'A lamp with a green shade', 'It only lights the page you are on.', 40],
    ['globe', 'A globe of places nobody has named', 'Turn it and the seas move.', 75]],
  [['candles', 'Candles that light themselves', 'They wait until you sit down.', 60], ['glass', 'A window of coloured glass', 'It shows a different sky each day.', 75],
    ['pew', 'Pews worn smooth', 'Many people have rested here.', 55], ['font', 'A font of still water', 'It holds the sky upside down.', 65],
    ['bells', 'Bells of folded paper', 'They ring only for good news.', 45]],
  [['kettle', 'A kettle always nearly boiling', 'Tea is never more than a moment away.', 70], ['herbs', 'Herbs hung to dry', 'The kitchen smells of somewhere warm.', 50],
    ['oven', 'A bread oven, faintly warm', 'Nobody remembers lighting it.', 90], ['pans', 'Copper pans in a row', 'Each one rings a different note.', 65],
    ['honey', 'Honey from the moths', 'Sweet, and faintly silver.', 40]],
  [['stand', 'A stand for your armour', 'It keeps the shape of whoever last wore it.', 90], ['whetstone', 'A whetstone that sings', 'One note, very softly.', 70],
    ['banners', 'Banners of houses that never were', 'Their colours change when nobody looks.', 75], ['swords', 'Wooden practice swords', 'Worn soft at the grips.', 65],
    ['shield', 'A shield polished like a mirror', 'It shows you a little braver.', 105]],
  [['scope', 'A brass telescope', 'It mostly looks at the moon, fondly.', 140], ['starmap', 'A map of stars that moved', 'Someone keeps it up to date.', 120],
    ['orrery', 'An orrery of nine moons', 'One of them is new.', 160], ['daybed', 'A daybed under the open roof', 'For counting stars until you lose count.', 110],
    ['stars', 'A jar of fallen stars', 'Warm to hold.', 130]],
  [['bell', 'A bell with no clapper', 'It rings anyway, once a year.', 160], ['moonseat', 'A chair for watching the moon', 'The best seat in the keep.', 140],
    ['vane', 'A weathervane of a sleeping fox', 'It points wherever is calm.', 150], ['brazier', 'A brazier for the long nights', 'The embers here never quite go out.', 120],
    ['chimes', 'Wind chimes of old keys', 'They play the doors they once opened.', 130]]
].map((room, r) => room.map(([id, name, tale, price]) => ({ id: 'f-' + id, room: r, name, tale, price })));
// Gear for the knight: one of each slot is worn. Armour shortens journeys, weapons bring more silver,
// trinkets bring silver or provisions home, or shorten journeys a little. A journey's effects are fixed when it sets out.
const SLOTS = [['armour', 'Armour', 'shorter journeys'], ['weapon', 'Weapons', 'more silver'], ['trinket', 'Trinkets', 'small kindnesses']];
const GEAR = [
  { id: 'cloak', slot: 'armour', name: 'Moth-wing cloak', tale: 'Weighs nothing.', price: 30, shorter: 10 },
  { id: 'ringmail', slot: 'armour', name: 'Ringmail of quiet links', tale: 'Never clinks.', price: 80, shorter: 20 },
  { id: 'plate', slot: 'armour', name: 'Starlit plate', tale: 'Lit from inside.', price: 160, shorter: 30 },
  { id: 'leaves', slot: 'armour', name: 'A coat of pressed leaves', tale: 'It rustles like a library.', price: 280, shorter: 40 },
  { id: 'moonscale', slot: 'armour', name: 'Mail of moon-scales', tale: 'It rings like a bell a long way off.', price: 400, shorter: 50 },
  { id: 'staff', slot: 'weapon', name: 'Thorn staff', tale: 'Parts brambles politely.', price: 30, more: 10 },
  { id: 'blade', slot: 'weapon', name: 'Lantern blade', tale: 'Mostly a light.', price: 80, more: 15 },
  { id: 'hook', slot: 'weapon', name: 'Moon-hook', tale: 'For lifting lost things out of deep water.', price: 160, more: 20 },
  { id: 'bellspear', slot: 'weapon', name: 'Bell-spear of the night watch', tale: 'It only ever rings the hour.', price: 280, more: 25 },
  { id: 'promise', slot: 'weapon', name: 'A sword that was a promise', tale: 'It was kept.', price: 400, more: 30 },
  { id: 'acorn', slot: 'trinket', name: 'Acorn charm', tale: 'Something might grow from it.', price: 40, back: 1 },
  { id: 'jar', slot: 'trinket', name: 'Jar of glow-worms', tale: 'They find dropped coins.', price: 60, per: 1 },
  { id: 'feather', slot: 'trinket', name: "A heron's feather", tale: 'It knows the way back.', price: 100, shorter: 10 },
  { id: 'key', slot: 'trinket', name: 'A key that fits nothing', tale: 'Yet.', price: 150, per: 1, back: 1 },
  { id: 'map', slot: 'trinket', name: 'A map that draws itself', tale: 'Faintly, as you walk.', price: 220, per: 2 },
  { id: 'purse', slot: 'trinket', name: 'A purse that remembers', tale: 'Full of small returns.', price: 320, per: 2, back: 1 }];
const ITEM_BY = Object.fromEntries([...FURNISH.flat(), ...GEAR].map(i => [i.id, i]));
// What one piece of gear does; a trinket may do two things ("+2 silver for each provision and 1 provision home ...").
const perText = n => `+${n} silver for each provision`, backText = n => plural(n, 'provision') + ' home from the Glass Ruins';
const gearText = g => [g.shorter && g.shorter + '% shorter', g.more && '+' + g.more + '% silver', g.flat && `+${g.flat} silver a journey`,
  g.per && perText(g.per), g.back && backText(g.back)].filter(Boolean).join(' and ');
/* What the worn gear does: shorter (%), more (% silver), flat (silver a journey, found things only), per (silver for
   each provision the journey takes, so longer journeys stay the better buy), back (provisions home; only from the Glass
   Ruins, and only one, so no journey ever pays better per provision than a longer one: game-loop.md, "Balance"). */
function gearPerks() {
  const p = { shorter: 0, more: 0, flat: 0, per: 0, back: 0 };
  Object.values(S.wear).forEach(id => { const g = ITEM_BY[id]; if (g) for (const k in p) p[k] += g[k] || 0 });
  return p;
}
// What goes with the next journey: the worn gear and the oldest found thing in the satchel.
function perks() {
  const p = gearPerks(), f = FOUND_BY[S.satchel[0]];
  if (f) for (const k of ['shorter', 'more', 'flat']) p[k] += f[k] || 0;
  return p;
}
// A journey with the worn gear: its length in seconds, the silver it earns and the provisions that come home.
function trip(d, p = perks()) {
  return { sec: Math.round(d.sec * (100 - p.shorter) / 100), silver: Math.ceil(d.silver * (100 + p.more) / 100) + p.flat + p.per * d.prov, back: Math.max(0, Math.min(p.back, d.prov - 2)) };
}
/* Who you are (game-loop.md, "Choosing who you are"): chosen on the first start, changed in Settings, looks only.
   An empty name is Bramble, the keep's old name for its wanderer. */
const HERO = [['knight', 'Knight', 'Steady and sworn. Keeps the old vows of the keep.'], ['cleric', 'Cleric', 'Carries a lantern for anyone tired or lost.'],
  ['bandit', 'Bandit', 'Quiet feet, quick hands, a soft spot for strays.'], ['barbarian', 'Barbarian', 'Big, warm and loud. Carries the heavy things.']];
const HERO_BY = Object.fromEntries(HERO.map(h => [h[0], h]));
const NAME_MAX = 20, cleanName = v => String(v || '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
const who = () => S.hero.name || 'Bramble';
const heroWord = () => HERO_BY[S.hero.cls][1].toLowerCase();
const isTest = () => nat('isTestBuild') === true;
const speed = () => isTest() && S.fast ? 12 : 1; // test builds can run journeys 12 times faster

/* ---------- saved state ---------- */
const KEY = 'taskbound.v1';
function fresh() { return { v: 1, tasks: [], nextId: 1, embers: 0, silver: 0, prov: PROV_START, woken: 0, offered: 0, day: isoDay(), dayEmbers: 0, dayProv: 0, askedNotify: false, journey: null, pick: 'garden', fast: false, owned: [], wear: {}, stall: 'keep', rem: cleanRem(), cfg: cleanCfg(), lists: [], exactTip: false, hero: { cls: 'knight', name: '' }, met: false, satchel: [] } }
// Checks a save field by field, so a damaged or older save still loads. Never rename or drop a field without handling it here.
function cleanState(o) {
  const f = fresh(); if (!o || typeof o !== 'object') return f;
  const num = (v, d, lo = 0, hi = 1e9) => Number.isFinite(+v) ? Math.min(hi, Math.max(lo, Math.floor(+v))) : d;
  const s = {
    v: 1, nextId: num(o.nextId, 1, 1), embers: num(o.embers, 0), silver: num(o.silver, 0), prov: num(o.prov, PROV_START, 0, PROV_MAX),
    woken: num(o.woken, 0, 0, ROOMS.length), offered: num(o.offered, 0), day: typeof o.day === 'string' ? o.day : f.day,
    dayEmbers: num(o.dayEmbers, 0), dayProv: num(o.dayProv, 0), askedNotify: o.askedNotify === true, tasks: [],
    journey: o.journey && JOURNEY_BY[o.journey.id] && Number.isFinite(+o.journey.end) && Number.isFinite(+o.journey.start)
      ? { id: o.journey.id, start: +o.journey.start, end: +o.journey.end, silver: num(o.journey.silver, JOURNEY_BY[o.journey.id].silver),
          back: num(o.journey.back, 0, 0, JOURNEY_BY[o.journey.id].prov), found: FOUND_BY[o.journey.found] ? o.journey.found : null,
          used: FOUND_BY[o.journey.used] ? o.journey.used : null } : null,
    satchel: (Array.isArray(o.satchel) ? o.satchel.filter(id => FOUND_BY[id]) : []).slice(0, SATCHEL_MAX),
    pick: JOURNEY_BY[o.pick] ? o.pick : 'garden', fast: o.fast === true,
    owned: [...new Set(Array.isArray(o.owned) ? o.owned.filter(id => ITEM_BY[id]) : [])], wear: {}, stall: o.stall === 'knight' ? 'knight' : 'keep',
    rem: cleanRem(o.rem), cfg: cleanCfg(o.cfg), exactTip: o.exactTip === true, met: o.met === true,
    hero: { cls: o.hero && HERO_BY[o.hero.cls] ? o.hero.cls : 'knight', name: cleanName(o.hero && o.hero.name) },
    lists: [...new Set((Array.isArray(o.lists) ? o.lists : []).map(listKey).filter(Boolean))].slice(0, 40)
  };
  // Only gear the knight owns can be worn, in its own slot.
  if (o.wear && typeof o.wear === 'object') SLOTS.forEach(([k]) => { const g = ITEM_BY[o.wear[k]]; if (g && g.slot === k && s.owned.includes(g.id)) s.wear[k] = g.id });
  (Array.isArray(o.tasks) ? o.tasks : []).forEach(t => {
    if (!t || typeof t.text !== 'string' || !t.text.trim()) return;
    s.tasks.push({
      id: num(t.id, s.nextId++, 1), text: t.text.slice(0, 200), size: SIZES[t.size] ? t.size : 'small',
      rep: t.rep && typeof t.rep === 'object' ? t.rep : null, when: t.when || 'any', due: ISO.test(t.due || '') ? t.due : '',
      remind: typeof t.remind === 'string' ? t.remind : '', remindMin: num(t.remindMin, 0),
      steps: Array.isArray(t.steps) ? t.steps.filter(x => x && typeof x.t === 'string') : [],
      later: !!t.later, hideUntil: ISO.test(t.hideUntil || '') ? t.hideUntil : '',
      doneOn: ISO.test(t.doneOn || '') ? t.doneOn : '', tidied: ISO.test(t.tidied || '') ? t.tidied : '', earned: num(t.earned, 0), en: num(t.en, 0),
      list: listKey(t.list), note: typeof t.note === 'string' ? t.note.slice(0, 500).trim() : '', ord: Number.isFinite(+t.ord) && t.ord !== null && t.ord !== '' ? num(t.ord, 0, 0, 1e6) : null
    });
  });
  s.nextId = Math.max(s.nextId, ...s.tasks.map(t => t.id + 1), 1);
  return s;
}
/* Settings (docs/decisions/tasks.md). Reminders follow Pawgress's (528f356 remCfg): every kind has its own switch, and a
   saved time or choice that isn't valid goes back to its default. "Pals coming home" is "Back from a journey" here, and
   there is no Just start timer. */
const REM_DEFAULT = { morning: { on: true, t: '09:00' }, evening: { on: true, t: '19:30' }, brief: { on: true, am: '07:30', pm: '20:30' },
  nag: 0, quick: false, defMin: 0, journeys: true, tasks: true, exact: false };
const REM_OPTS = [[0, 'At that time'], [10, '10 min before'], [30, '30 min before'], [60, '1 hour before'], [120, '2 hours before'], [1440, '1 day before']];
function cleanRem(r) {
  r = r && typeof r === 'object' ? r : {};
  const okT = v => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null, D = REM_DEFAULT, o = x => x && typeof x === 'object' ? x : {};
  const day = k => ({ on: o(r[k]).on === undefined ? D[k].on : o(r[k]).on === true, t: okT(o(r[k]).t) || D[k].t });
  return { morning: day('morning'), evening: day('evening'),
    brief: { on: o(r.brief).on === undefined ? D.brief.on : o(r.brief).on === true, am: okT(o(r.brief).am) || D.brief.am, pm: okT(o(r.brief).pm) || D.brief.pm },
    nag: [0, 120, 240].includes(r.nag) ? r.nag : 0, quick: r.quick === true, defMin: REM_OPTS.some(([v]) => v === r.defMin) ? r.defMin : 0,
    journeys: r.journeys !== false, tasks: r.tasks !== false, exact: r.exact === true };
}
const remCfg = () => S.rem; // also read by the parser (tasks-core.js) for the default reminder
// Tasks and Offload: the size a task gets when Offload can't guess one, and how long Not today waits.
const CFG_DEF = { defSize: 'small', snooze: 1 }, SNOOZE = { 1: 'tomorrow', 2: 'in 2 days', 7: 'next week' };
function cleanCfg(c) { c = c && typeof c === 'object' ? c : {}; return { defSize: SIZES[c.defSize] ? c.defSize : CFG_DEF.defSize, snooze: SNOOZE[c.snooze] ? c.snooze : CFG_DEF.snooze } }
const cfg = () => S.cfg; // also read by the parser for the default size
/* Lists (Pawgress's, 528f356): one per candle, typed as #home or picked in the edit sheet; saved on their own, so an
   empty list stays. Names are kept in lower case and shown with a capital. */
const listKey = v => String(v || '').trim().replace(/^#/, '').replace(/\s+/g, ' ').toLowerCase().slice(0, 20);
const listName = l => l ? l.charAt(0).toUpperCase() + l.slice(1) : '';
const allLists = () => [...new Set([...S.lists, ...S.tasks.map(t => t.list)].filter(Boolean))].sort();
function addList(l) { l = listKey(l); if (!l) return ''; if (!S.lists.includes(l) && S.lists.length < 40) S.lists.push(l); return l }
const ISO = /^\d{4}-\d{2}-\d{2}$/;
let hadSave = false;
function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY) } catch (e) { }
  if (!raw) raw = nat('savedState') || null; // a new phone: Android's backup copy
  hadSave = !!raw;
  try { return cleanState(raw ? JSON.parse(raw) : null) } catch (e) { return fresh() }
}
let S = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) { toast("Couldn't save. Your phone may be low on space.") }
  nat('saveState', JSON.stringify(S));
  queueSync();
}
// A new day: the daily limits start again, and repeating candles lit on an earlier day come back unlit.
function rollDay() {
  const d = isoDay(); if (S.day === d) return false;
  S.day = d; S.dayEmbers = 0; S.dayProv = 0;
  S.tasks.forEach(t => { if (t.rep && t.doneOn && t.doneOn < d) { t.doneOn = ''; t.earned = 0; t.en = 0 } });
  return true;
}

/* ---------- tasks ---------- */
const today = () => isoDay();
const doneToday = t => t.doneOn === today();
const isDue = t => !t.later && !(t.hideUntil && t.hideUntil > today()) && !(t.due && t.due > today()) && (!t.rep || repOn(t.rep, new Date()));
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
// Each amount stays on one line ("8\u00a0embers"), so a narrow screen breaks between them, not inside one.
const earnText = (e, p) => [e ? plural(e, 'ember') : '', p ? plural(p, 'provision') : ''].filter(Boolean).map(x => x.replace(' ', '\u00a0')).join(' · ') || 'nothing more today';
const sizeOf = t => SIZES[t.size] || SIZES.small;
function fmtDayShort(iso) { const [y, m, d] = iso.split('-').map(Number), x = new Date(y, m - 1, d), diff = Math.round((x - new Date(new Date().toDateString())) / 864e5); return diff === 1 ? 'Tomorrow' : diff < 7 ? DOW[x.getDay()] : x.getDate() + ' ' + MON[x.getMonth()] }
function nextOn(t) { // the next day a waiting task comes round
  if (t.later) return 'Later';
  if (t.hideUntil && t.hideUntil > today()) return fmtDayShort(t.hideUntil);
  if (t.due && t.due > today()) return fmtDayShort(t.due);
  if (t.rep) for (let i = 1; i <= 62; i++) { const d = addDays(i); if (repOn(t.rep, d)) return fmtDayShort(isoDay(d)) }
  return '';
}
function metaText(t) {
  const a = [];
  if (t.remind) a.push(fmtTime(t.remind)); else if (t.when && t.when !== 'any') a.push(t.when);
  a.push(sizeOf(t).label.toLowerCase());
  if (t.rep) a.push('repeats');
  if (t.steps.length) a.push(plural(t.steps.length, 'step'));
  if (t.note) a.push('note');
  if (t.list && !listPick) a.push(listName(t.list));
  return a.join(' · ');
}
// What finishing a task pays today, within the daily limits.
function payFor(t) {
  const z = sizeOf(t), e = Math.max(0, Math.min(z.embers, DAILY_EMBERS - S.dayEmbers));
  const p = Math.max(0, Math.min(z.prov, DAILY_PROV - S.dayProv, PROV_MAX - S.prov));
  return { e, p };
}
function light(t) {
  rollDay();
  const r = payFor(t);
  t.doneOn = today(); t.earned = r.e; t.en = r.p;
  S.embers += r.e; S.dayEmbers += r.e; S.prov += r.p; S.dayProv += r.p;
  return r;
}
// Tidy candles: today's lit candles shown under Burning are put away (nothing is lost; what they earned stays).
function tidy() {
  const ids = $$('#tasklist li.task.lit').map(li => +li.dataset.id), ts = S.tasks.filter(t => ids.includes(t.id) && doneToday(t));
  if (!ts.length) return;
  ts.forEach(t => t.tidied = today()); save(); renderTasks();
  toast(ts.length === 1 ? 'Tidied 1 candle away.' : `Tidied ${ts.length} candles away.`, () => { ts.forEach(t => t.tidied = ''); save(); renderTasks() });
}
function unlight(t, r) {
  t.doneOn = ''; t.tidied = ''; t.earned = 0; t.en = 0;
  S.embers = Math.max(0, S.embers - r.e); S.dayEmbers = Math.max(0, S.dayEmbers - r.e);
  S.prov = Math.max(0, S.prov - r.p); S.dayProv = Math.max(0, S.dayProv - r.p);
}
// Later means no day yet (Pawgress's toLater): the candle drops its day, its Not today and its reminder time.
function toLater(t) { t.later = true; t.due = ''; t.hideUntil = ''; t.remind = ''; t.remindMin = 0 }
function makeTask(p) {
  return { id: S.nextId++, text: p.text, size: p.size || p.guess || 'small', rep: p.rep || null, when: p.when || 'any', due: p.due || '',
    remind: p.remind || '', remindMin: p.remindMin || 0, steps: (p.steps || []).map(x => ({ t: x, done: false })), later: !!p.later,
    hideUntil: '', doneOn: '', earned: 0, en: 0, list: addList(p.list || listPick), note: '', ord: null };
}

/* Done lines (copied from Pawgress app.js at 528f356): the open task a done line is about has the same words, or the
   same words once the past tense is put back ("called the GP" ticks "Call the GP") or dropped ("did the washing up"
   ticks "Washing up"). Leading words like "the" or "my" don't count. */
const QA_DROP = new Set(['did', 'done', 'finished', 'completed', 'sorted']);
const qaEmpty = p => !/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(p.text) || (p.done && QA_DROP.has(qaNorm(p.text)));
const qaCore = t => qaNorm(t).replace(/^(?:(?:the|my|a|an|some|our)\s+)+/, '');
function qaDoneKeys(text) {
  const n = qaNorm(text), m = n.match(/^([a-z']+)\s*(.*)$/), keys = new Set([qaCore(n)]); if (!m) return keys;
  const [, w, rest] = m, add = x => keys.add(qaCore((x + ' ' + rest).trim()));
  if (QA_DROP.has(w)) keys.add(qaCore(rest));
  if (QA_BASE[w]) add(QA_BASE[w]);
  else if (/ed$/.test(w)) { const a = w.replace(/ied$/, 'y').replace(/([^aeiou])\1ed$/, '$1').replace(/ed$/, ''); add(a); add(a + 'e'); add(w.replace(/d$/, '')); add(w.replace(/ed$/, '')) }
  keys.delete(''); return keys;
}
const qaMatch = p => { const keys = qaDoneKeys(p.text); return S.tasks.find(t => !doneToday(t) && !t.doneOn && isDue(t) && keys.has(qaCore(t.text))) };

/* The Well's lines, sorted (Pawgress's qaLines and qaItems, 528f356): indented lines under a task become its steps, at
   most 50 lines are read, and each item says whether it is a duplicate (already open, or the same as a line above), could
   be a done thing, and which lines it came from (so its stone can take them out of the well). `undone` holds the done
   lines turned back into tasks on their stones, keyed by the line's words. */
const QA_INDENT = /^(?:\t| {2,})/;
const wellLines = raw => String(raw).split(/\r?\n/).map((l, i) => ({ l, i })).filter(x => x.l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim());
// Saved candles say when: 'any' where the parser says null, so both read as no time of day here (Pawgress has the same
// mismatch, so its "already on your list" never matched a task without a time of day).
const haveKey = t => qaKey({ ...t, when: t.when === 'any' ? null : t.when });
function wellItems(raw, undone = new Set()) {
  const have = new Set(S.tasks.filter(t => !t.doneOn).map(haveKey)), seen = new Set(), out = [];
  wellLines(raw).slice(0, 50).forEach(x => {
    const last = out[out.length - 1];
    if (QA_INDENT.test(x.l) && last && !last.p.done) {
      const st = x.l.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ x]?\])?\s*/i, '').trim().slice(0, 60);
      if (st && last.p.steps.length < 8) { last.p.steps.push(st.charAt(0).toUpperCase() + st.slice(1)); last.kids.push(x.i) }
      return;
    }
    qaExpand(x.l).forEach(l => {
      const key = l.trim().toLowerCase(); let p = qaParse(l); const could = p.done;
      if (could && undone.has(key)) p = qaParse('to do: ' + l.trim());
      if (qaEmpty(p)) return;
      if (!p.list && listPick) p.list = listPick; // while a list is picked, new lines go into it
      const k = (p.done ? 'done|' : '') + qaKey(p), dup = p.done ? seen.has(k) : have.has(k) || seen.has(k); seen.add(k);
      out.push({ i: x.i, p, dup, could, key, kids: [] });
    });
  });
  return out;
}
// Just the lines to add (used by the checks and anything else that wants the parsed lines).
const parseAll = (raw, undone) => wellItems(raw, undone).filter(x => !x.dup).map(x => x.p);
/* Adds parsed lines: new candles are set down; done things are lit straight away (an open task with the same words is lit
   instead of adding a copy, once however many lines name it). Returns counts and an undo. */
function commit(ps) {
  rollDay(); const added = [], made = [], lit = new Map();
  ps.forEach(p => {
    if (p.done) { const same = qaMatch(p); if (same) { if (!lit.has(same)) lit.set(same, null); return } }
    const t = makeTask(p); S.tasks.push(t); added.push(t);
    if (p.done) { made.push(t); lit.set(t, null) }
  });
  let got = { e: 0, p: 0 };
  lit.forEach((_, t) => { const r = light(t); lit.set(t, r); got.e += r.e; got.p += r.p });
  save(); askNotifyOnce();
  return { added: added.filter(t => !made.includes(t)), lit: [...lit.keys()], got, undo: () => {
    lit.forEach((r, t) => { if (!made.includes(t)) unlight(t, r); else { S.embers = Math.max(0, S.embers - r.e); S.dayEmbers = Math.max(0, S.dayEmbers - r.e); S.prov = Math.max(0, S.prov - r.p); S.dayProv = Math.max(0, S.dayProv - r.p) } });
    S.tasks = S.tasks.filter(t => !added.includes(t)); save(); renderAll();
  } };
}
function commitText(r) {
  const parts = [];
  if (r.added.length) parts.push(r.added.length === 1 ? `"${r.added[0].text}" set down` : plural(r.added.length, 'candle') + ' set down');
  if (r.lit.length) parts.push(r.lit.length === 1 ? `"${r.lit[0].text}" lit` : plural(r.lit.length, 'candle') + ' lit');
  const got = r.got.e || r.got.p ? ` +${earnText(r.got.e, r.got.p)}.` : '';
  return parts.join(', ') + '.' + got;
}

/* ---------- screens ---------- */
let tab = 'keep', openTask = null, justLit = null;
let journeyTimer = null;
function setTab(t) {
  clearInterval(journeyTimer); journeyTimer = null;
  if (t === 'journeys') { wasAway = !!S.journey && !isBack(); journeyTimer = setInterval(() => { if (!document.hidden) tickJourneys() }, 1000) }
  if (t !== 'tasks') sel = null; // choosing ends when you leave the candles
  tab = t;
  $$('.screen').forEach(s => s.hidden = s.id !== 's-' + t);
  $$('.rune').forEach(b => b.dataset.tab === t ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  if (t === 'tasks') renderTasks();
  if (t === 'keep') renderKeep();
  if (t === 'journeys') renderJourneys();
  if (t === 'market') renderMarket();
}
function renderStores() { $('#n-embers').textContent = S.embers; $('#n-silver').textContent = S.silver; $('#n-prov').textContent = S.prov }

function renderKeep() {
  renderStores();
  // the sculpted keep you can turn ; the flat painting until then, or where it can't be drawn
  if (!ART.keep3d($('#keep-scene'), S.woken)) $('#keep-scene').innerHTML = ART.keep(S.woken);
  $('#rooms-count').textContent = `${S.woken} of ${ROOMS.length} rooms`;
  // Each lit window is a way into its room; the dark ones are only pictures.
  $('#arches').innerHTML = ROOMS.map(([name], i) => i < S.woken
    ? `<button type="button" data-room="${i}" aria-label="Go into ${esc(name)}">${ART.arch('lit', furnishedIn(i))}</button>`
    : `<span aria-hidden="true">${ART.arch(i === S.woken && S.offered ? 'part' : 'dark')}</span>`).join('');
  const off = $('#offer');
  if (S.woken >= ROOMS.length) { $('#relight-line').textContent = 'Every room is awake. The keep remembers everything.'; off.innerHTML = ''; return }
  const [name, cost] = ROOMS[S.woken], need = cost - S.offered;
  $('#relight-line').innerHTML = `${esc(cap(name))} ${S.offered ? 'stirs' : 'sleeps'}. <b>${plural(need, 'ember')}</b> will wake it.`;
  // As in Pawgress's growing up: the button that finishes waking is always "Wake it".
  const btns = [];
  if (need > 1) btns.push([1, 'Offer 1']);
  if (need > 5) btns.push([5, 'Offer 5']);
  btns.push([need, 'Wake it, ' + need, true]);
  off.innerHTML = btns.map(([n, l, main]) => `<button type="button" data-offer="${n}"${main ? ' class="main"' : ''}${S.embers < n ? ' disabled' : ''}>${l}</button>`).join('');
}
const furnishedIn = r => FURNISH[r].filter(f => S.owned.includes(f.id)).length;

/* ---------- rooms you can enter (game-loop.md): Dusty at 0 to 1 in place, Swept at 2 to 3, Lived in at 4 to 5 ---------- */
const STAGES = ['Dusty', 'Swept', 'Lived in'];
const stageOf = n => n <= 1 ? 0 : n <= 3 ? 1 : 2;
// Which frame of the room's painting: bit i is set when its furnishing i is in place (art/rooms.py).
const roomMask = r => FURNISH[r].reduce((m, f, i) => S.owned.includes(f.id) ? m | 1 << i : m, 0);
let roomOpen = null;
function roomLines(r, n) {
  if (n <= 1) return ['Dusty and cold. It remembers being loved.', 'Each furnishing brings it back a little.'];
  if (n <= 3) return ['Swept clean. Someone sits here again.', `${n === 2 ? 'Two more' : 'One more'} and it will feel lived in.`];
  return ['Lived in. ' + ROOM_WARM[r], n < FURNISH[r].length ? 'One more and everything is in place.' : 'Everything is in place. Rest a while.'];
}
function renderRoom() {
  const r = roomOpen; if (r == null) return;
  const name = cap(ROOMS[r][0]), n = furnishedIn(r), st = stageOf(n), all = FURNISH[r].length;
  const here = FURNISH[r].filter(f => S.owned.includes(f.id)).map(f => f.name.charAt(0).toLowerCase() + f.name.slice(1));
  $('#room-scene').innerHTML = ART.room(ROOM_ART[r], roomMask(r), `${name}, ${STAGES[st].toLowerCase()}${here.length ? ': ' + here.join(', ') : ', with nothing in place yet'}`);
  $('#room-back-l').textContent = tab === 'market' ? 'Market' : 'The keep';
  $('#room-silver').textContent = S.silver;
  $('#room-h').textContent = name;
  const [a, b] = roomLines(r, n);
  $('#room-line').innerHTML = `${esc(a)}<span>${esc(b)}</span>`;
  $('#room-stages').innerHTML = STAGES.map((s, i) => `<li${i < st ? ' class="past"' : i === st ? ' aria-current="step"' : ''}>${s}</li>`).join('');
  $('#room-count').textContent = `In this room · ${n} of ${all}`;
  $('#room-list').innerHTML = FURNISH[r].map(f => S.owned.includes(f.id)
    ? `<li class="on"><span>${esc(f.name)}</span><span>In place</span></li>`
    : `<li><span>${esc(f.name)}</span><span>${f.price} silver</span></li>`).join('');
  $('#room-end').innerHTML = n < all ? '<button type="button" class="ember-btn" data-act="room-market">To the Market</button>'
    : '<p>More may wake here one day.</p>';
}
function openRoom(r) {
  if (!(r >= 0 && r < S.woken)) return;
  roomOpen = r; renderRoom();
  const el = $('#room'); el.hidden = false; el.scrollTop = 0; $('#close-room').focus();
}
function closeRoom(focus = true) {
  const r = roomOpen; roomOpen = null; $('#room').hidden = true;
  if (!focus) return;
  renderAll(); const b = $(`#s-${tab} [data-room="${r}"]`); if (b) b.focus();
}
function roomToMarket() {
  const r = roomOpen; closeRoom(false);
  S.stall = 'keep'; save(); setTab('market');
  const h = $(`#wares [data-room="${r}"]`); if (h) { h.scrollIntoView({ block: 'start' }); h.focus() }
}

/* ---------- the Market ---------- */
function buyBtn(i) {
  const short = S.silver < i.price;
  return `<button type="button" class="buy" data-buy="${i.id}"${short ? ' disabled' : ''} aria-label="Buy ${esc(i.name)} for ${i.price} silver${short ? ` (you have ${S.silver})` : ''}">${i.price} silver</button>`;
}
const row = (i, sub, end) => `<li class="ware"><div><span class="name">${esc(i.name)}</span><span class="meta">${esc(sub)}</span></div>${end}</li>`;
function renderMarket() {
  renderStores();
  $('#market-sub').textContent = `Stalls under the spire. ${S.silver} silver in your purse.`;
  $$('[data-stall]').forEach(b => b.setAttribute('aria-pressed', b.dataset.stall === S.stall));
  $('#stall-who').textContent = heroWord(); $('[data-stall="knight"]').setAttribute('aria-label', `For the ${heroWord()}`);
  let h = '';
  if (S.stall === 'keep') {
    for (let r = 0; r < S.woken; r++) {
      const n = furnishedIn(r), all = FURNISH[r].length;
      h += `<div class="ware-h"><h2 class="group-h">${ART.arch('lit', n)}<span>${esc(cap(ROOMS[r][0]))} <span class="nowrap">· ${n} of ${all}</span></span></h2>` +
        `<button type="button" class="sm-btn" data-room="${r}" aria-label="Go into ${esc(ROOMS[r][0])}">Go in</button></div>`;
      // A room with everything in place folds away to one line.
      h += n === all ? '<p class="room-done">Lived in. Everything is in place.</p>'
        : '<ul>' + FURNISH[r].map(f => row(f, f.tale, S.owned.includes(f.id) ? '<span class="have">In place</span>' : buyBtn(f))).join('') + '</ul>';
    }
    const asleep = ROOMS.length - S.woken;
    if (asleep) h += `<p class="sleeping">${S.woken ? `${cap(numWord(asleep))} ${asleep === 1 ? 'room still sleeps' : 'rooms still sleep'}. Wake them on Home and their stalls open here.`
      : `Every room still sleeps. Wake ${ROOMS[0][0]} on Home and its stall opens here.`}</p>`;
  } else {
    const p = gearPerks(), sum = [p.shorter && `Journeys ${p.shorter}% shorter`, p.more && `+${p.more}% silver`, p.flat && `+${p.flat} silver a journey`,
      p.per && perText(p.per), p.back && backText(p.back)].filter(Boolean).join(' · ');
    h += `<section class="worn" aria-label="What ${esc(who())} wears"><span class="knight">${ART.hero(S.hero.cls, S.wear, 3, who())}</span><div>
      ${SLOTS.map(([k, label]) => `<span><span class="muted">${label.replace(/s$/, '')}</span> · ${S.wear[k] ? esc(ITEM_BY[S.wear[k]].name) : 'nothing yet'}</span>`).join('')}
      <b class="ember">${sum || 'Gear helps on journeys.'}</b></div></section>`;
    SLOTS.forEach(([k, label, what]) => {
      h += `<h2 class="group-h ware-h">${label}: ${what}</h2><ul>`;
      h += GEAR.filter(g => g.slot === k).map(g => row(g, g.tale + ' ' + cap(gearText(g)) + '.',
        S.wear[k] === g.id ? '<button type="button" class="buy worn-btn" disabled>Worn</button>'
          : S.owned.includes(g.id) ? `<button type="button" class="buy wear-btn" data-wear="${g.id}" aria-label="Wear ${esc(g.name)}">Wear</button>` : buyBtn(g))).join('') + '</ul>';
    });
  }
  $('#wares').innerHTML = h;
}
// Buying spends silver; gear is worn straight away. Undo puts everything back as it was.
function buy(id) {
  const i = ITEM_BY[id]; if (!i || S.owned.includes(id) || S.silver < i.price) return;
  if (i.room != null && i.room >= S.woken) return;
  const was = { ...S.wear };
  S.silver -= i.price; S.owned.push(id); if (i.slot) S.wear[i.slot] = id;
  save(); renderMarket();
  toast(i.slot ? `${i.name}, worn.` : `${i.name}, in ${ROOMS[i.room][0]}.`, () => {
    if (!S.owned.includes(id)) return;
    S.owned = S.owned.filter(x => x !== id); S.silver += i.price; S.wear = was; save(); renderMarket();
  });
}
function wear(id) { const g = ITEM_BY[id]; if (!g || !g.slot || !S.owned.includes(id)) return; S.wear[g.slot] = id; save(); renderMarket() }

function offer(n) {
  if (S.woken >= ROOMS.length || S.embers < n) return;
  const [name, cost] = ROOMS[S.woken]; n = Math.min(n, cost - S.offered);
  S.embers -= n; S.offered += n;
  if (S.offered >= cost) { S.woken++; S.offered = 0; save(); renderKeep(); toast(cap(name) + ' is awake.'); return }
  save(); renderKeep();
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Notes: plain text with web links you can tap (Pawgress's linkify, 528f356).
const linkify = t => esc(t).replace(/https?:\/\/[^\s<]+[^\s<.,;:!?)'"]/g, u => `<a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40)}</a>`).replace(/\n/g, '<br>');
// A waiting or Later candle can be brought into today, unless it only repeats on other days.
const canToday = t => !(t.rep && !repOn(t.rep, new Date()));
// Move up and Move down, for screen readers and keyboards (hidden until focused), and the grip that drags.
const mover = t => `<button type="button" class="grip" tabindex="-1" aria-hidden="true" data-grip="${t.id}">${ART.icon.grip}</button>` +
  `<button type="button" class="sr-f" data-move="${t.id}" data-v="-1">Move up<span class="sr">: ${esc(t.text)}</span></button><button type="button" class="sr-f" data-move="${t.id}" data-v="1">Move down<span class="sr">: ${esc(t.text)}</span></button>`;
function taskRow(t, kind) {
  if (sel && kind !== 'lit') return pickRow(t, kind);
  const open = openTask === t.id && kind !== 'lit';
  if (kind === 'lit') return `<li class="task lit${justLit === t.id ? ' just' : ''}" data-id="${t.id}"><span class="wick" role="img" aria-label="Lit">${ART.candle(t.size, true)}</span>
    <div class="body"><span class="name">${esc(t.text)}</span><span class="earn">+${earnText(t.earned, t.en)}</span></div></li>`;
  const note = open && t.note ? `<li class="task-note">${linkify(t.note)}</li>` : '';
  const name = `<button type="button" class="linkish" data-open="${t.id}" aria-expanded="${open}"><span class="name">${esc(t.text)}</span><span class="meta">${esc(metaText(t))}</span></button>`;
  // A waiting or Later candle opens too, so its day and the rest can be changed; it can't be lit until its day comes.
  if (kind === 'waiting' || kind === 'later') {
    return `<li class="task waiting" data-id="${t.id}"><span class="wick">${ART.candle(t.size, false)}</span>
    <div class="body">${name}<span class="earn">${esc(nextOn(t))}</span></div>${kind === 'later' ? mover(t) : ''}</li>
    ${open ? `<li class="task-tools">${canToday(t) ? `<button type="button" data-today="${t.id}">Do it today</button>` : ''}<button type="button" data-edit="${t.id}">Edit</button><button type="button" data-del="${t.id}">Put it out</button></li>` : ''}${note}`;
  }
  const r = payFor(t);
  return `<li class="task" data-id="${t.id}"><button type="button" class="wick" data-light="${t.id}" aria-label="Light the candle: ${esc(t.text)}">${ART.candle(t.size, false)}</button>
    <div class="body">${name}<span class="earn">${earnText(r.e, r.p)}</span></div>${mover(t)}</li>
    ${open ? `<li class="task-tools"><button type="button" data-edit="${t.id}">Edit</button><button type="button" data-snooze="${t.id}">Not today</button>${t.rep ? '' : `<button type="button" data-later="${t.id}">Keep for later</button>`}<button type="button" data-del="${t.id}">Put it out</button></li>` : ''}${note}`;
}
/* Select several (Pawgress's, 528f356): while choosing, every unlit candle is a row you tap to choose; the candle gives
   way to a small box on the thread, and its tools, grip and lighting wait until you're done. Lit candles can't be chosen. */
function pickRow(t, kind) {
  const on = sel.has(t.id), r = kind === 'open' ? payFor(t) : null;
  return `<li class="task pick${kind === 'open' ? '' : ' waiting'}${on ? ' picked' : ''}" data-id="${t.id}"><button type="button" class="wick" tabindex="-1" aria-hidden="true" data-choose="${t.id}"><span class="pickbox"></span></button>
    <div class="body"><button type="button" class="linkish" data-choose="${t.id}" aria-pressed="${on}"><span class="sr">Choose: </span><span class="name">${esc(t.text)}</span><span class="meta">${esc(metaText(t))}</span></button><span class="earn">${r ? earnText(r.e, r.p) : esc(nextOn(t))}</span></div></li>`;
}
// The bar under the candles while choosing: how many are chosen, and what can be done to them all at once.
function selBar() {
  const el = $('#selbar'); el.hidden = !sel; $('#s-tasks').classList.toggle('selecting', !!sel); if (!sel) { el.innerHTML = ''; return }
  const n = sel.size, ps = S.tasks.filter(t => sel.has(t.id)), off = n ? '' : ' disabled';
  el.innerHTML = `<p class="sel-n" aria-live="polite">${n ? n + ' chosen' : 'Tap candles to choose them'}</p><div class="sel-acts">` +
    (ps.some(t => !isDue(t) && canToday(t)) ? `<button type="button" class="sm-btn" data-bulk="today">Do today</button>` : '') +
    (ps.some(isDue) || !n ? `<button type="button" class="sm-btn" data-bulk="snooze"${off}>Not today</button>` : '') +
    `<button type="button" class="sm-btn" data-bulk="later"${ps.some(t => !t.rep && !t.later) ? '' : ' disabled'}>Keep for later</button>` +
    `<button type="button" class="sm-btn" data-bulk="del"${off}>Put it out</button></div>`;
}
// Changes to several candles at once, with one Undo that puts the whole list back as it was.
function bulk(v) {
  if (!sel || !sel.size) return;
  const ps = S.tasks.filter(t => sel.has(t.id)), snap = JSON.stringify(S.tasks), td = today(), wait = cfg().snooze; let n = 0;
  if (v === 'del') { S.tasks = S.tasks.filter(t => !sel.has(t.id)); n = ps.length }
  else ps.forEach(t => {
    if (v === 'today') { if (isDue(t) || !canToday(t)) return; t.later = false; t.hideUntil = ''; if (t.due > td) t.due = td; n++ }
    else if (v === 'snooze') { if (!isDue(t)) return; t.hideUntil = isoDay(addDays(wait)); n++ }
    else if (v === 'later') { if (t.rep || t.later) return; toLater(t); n++ }
  });
  if (!n) { toast('Nothing to change there.'); return }
  const w = n === 1 ? '1 candle' : n + ' candles', one = n === 1;
  sel = null; openTask = null; save(); renderTasks(); $('#tsel').focus();
  toast(v === 'del' ? `Put out ${w}.` : v === 'today' ? `${cap(w)} ${one ? 'joins' : 'join'} today.` : v === 'later' ? `${cap(w)} kept for later.`
    : `${cap(w)} ${one ? 'waits' : 'wait'} until ${SNOOZE[wait]}.`, () => { S.tasks = JSON.parse(snap); save(); renderTasks() });
}
// Today's order: candles you've moved come first, in your order; the rest by reminder time, then as they were set down.
const byOrd = (a, b) => { const oa = a.ord != null, ob = b.ord != null; return oa && ob && a.ord !== b.ord ? a.ord - b.ord : oa !== ob ? (oa ? -1 : 1) : 0 };
const taskCmp = (a, b) => byOrd(a, b) || ((a.remind || '99') < (b.remind || '99') ? -1 : (a.remind || '99') > (b.remind || '99') ? 1 : a.id - b.id);
let listPick = '', listNew = false, laterOpen = false, taskQ = '', sel = null;
function listsBar() {
  const ls = allLists(); if (listPick && !ls.includes(listPick)) listPick = '';
  const el = $('#lists'); el.hidden = !ls.length;
  if (!ls.length) { el.innerHTML = ''; return }
  if (listNew && $('#list-in')) return; // keep a half-typed name
  el.innerHTML = [['', 'All'], ...ls.map(l => [l, listName(l)])].map(([v, n]) => `<button type="button" class="lchip" data-list="${esc(v)}" aria-pressed="${listPick === v}">${esc(n)}</button>`).join('') +
    (listNew ? `<form class="lnew" data-listform="chip"><label for="list-in" class="sr">New list name</label><input id="list-in" class="input" type="text" maxlength="20" autocomplete="off" placeholder="New list"><button type="submit" class="lchip">Add</button></form>`
      : `<button type="button" class="lchip add" data-act="list-new" aria-label="New list">${ART.icon.plus}</button>`);
}
function renderTasks() {
  rollDay(); exactTipCheck();
  const d = new Date(); $('#today-date').textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  listsBar();
  // Search (Pawgress's): shows once there are 6 candles, and looks in the words and the notes.
  const qs = taskQ.trim().toLowerCase(), found = t => !qs || t.text.toLowerCase().includes(qs) || (t.note || '').toLowerCase().includes(qs);
  $('#tsearch').hidden = S.tasks.length < 6 && !qs;
  const inList = t => (!listPick || t.list === listPick) && found(t);
  const openT = S.tasks.filter(t => isDue(t) && !t.doneOn && inList(t)), litAll = S.tasks.filter(t => doneToday(t) && inList(t)), lit = litAll.filter(t => t.tidied !== today()),
    waiting = S.tasks.filter(t => !t.doneOn && !isDue(t) && !t.later && inList(t)), later = S.tasks.filter(t => t.later && !t.doneOn && inList(t));
  openT.sort(taskCmp); waiting.sort((a, b) => nextSort(a) - nextSort(b)); later.sort((a, b) => byOrd(a, b) || a.id - b.id);
  // Select several: only unlit candles can be chosen; it ends by itself once there is nothing left to choose.
  const unlit = S.tasks.filter(t => !t.doneOn);
  if (sel) { sel.forEach(id => { if (!unlit.some(t => t.id === id)) sel.delete(id) }); if (!unlit.length) sel = null }
  const ts = $('#tsel'); ts.hidden = unlit.length < 2 && !sel; ts.textContent = sel ? 'Done' : 'Select'; ts.setAttribute('aria-pressed', String(!!sel));
  if (sel) openTask = null;
  const nFound = openT.length + lit.length + waiting.length + later.length;
  $('#tasks-sub').textContent = qs ? (nFound ? `${cap(numWord(nFound))} ${nFound === 1 ? 'candle matches' : 'candles match'}.` : 'No candle matches that.') : openT.length ? `${cap(numWord(openT.length))} unlit. No hurry.` : litAll.length ? 'Every candle is lit. Rest now.'
    : listPick && (waiting.length || later.length) ? `Nothing in ${listName(listPick)} today.` : listPick ? `Nothing in ${listName(listPick)} yet.` : 'Nothing here yet. Cast something into the well.';
  let h = '';
  if (remindersOff()) h += `<p class="note remind-off">Reminders are off, so candles with a time won't call you. <button type="button" class="linkbtn" data-act="notify">Turn them on</button></p>`;
  if (exactTipNow) h += `<p class="note remind-off" id="exact-tip">Want reminders on the exact minute? <span class="tipbtns"><button type="button" class="linkbtn" data-act="exact-tip-on">Turn on</button><button type="button" class="linkbtn" data-act="exact-tip-no">No thanks</button></span></p>`;
  if (openT.length) h += `<ul data-sec="today">${openT.map(t => taskRow(t, 'open')).join('')}</ul>`;
  // Tidy candles (developer, 9 Nov 2026): puts today's lit candles away; repeating ones still come back on their day.
  if (lit.length) h += `<div class="group-row"><h2 class="group-h">Burning</h2>${sel ? '' : '<button type="button" class="tidy-link" data-act="tidy">Tidy candles</button>'}</div><ul>${lit.map(t => taskRow(t, 'lit')).join('')}</ul>`;
  if (S.dayEmbers >= DAILY_EMBERS) h += `<p class="note">The embers are full for today. More gather tomorrow.</p>`;
  if (waiting.length) h += `<h2 class="group-h">Waiting in the dark</h2><ul>${waiting.map(t => taskRow(t, 'waiting')).join('')}</ul>`;
  const lOpen = laterOpen || !!qs || !!sel;
  if (later.length) h += `<h2 class="group-h"><button type="button" class="fold" data-act="later-fold" aria-expanded="${lOpen}">Kept for later · ${later.length}</button></h2>${lOpen ? `<ul data-sec="later">${later.map(t => taskRow(t, 'later')).join('')}</ul>` : ''}`;
  $('#tasklist').innerHTML = h;
  justLit = null; selBar();
}
/* Reordering (Pawgress's, 528f356): the grip drags a candle within Today or Later, and Move up / Move down do the same
   from a keyboard. The order shown is saved as each candle's `ord` (every candle in that group), so new candles go below. */
function saveOrder(ids) { ids.forEach((id, i) => { const t = S.tasks.find(x => x.id === id); if (t) t.ord = i }); save(); renderTasks() }
const secIds = ul => $$(`#tasklist ul[data-sec="${ul}"] > li.task`).map(li => +li.dataset.id);
function moveTask(id, v) {
  const li = $(`#tasklist li.task[data-id="${id}"]`), ul = li && li.parentElement; if (!ul) return;
  const ids = secIds(ul.dataset.sec), i = ids.indexOf(id), j = i + v; if (j < 0 || j >= ids.length) return;
  ids.splice(i, 1); ids.splice(j, 0, id); saveOrder(ids);
  const b = $(`[data-move="${id}"][data-v="${v}"]`); if (b) b.focus();
}
let tdrag = null;
document.addEventListener('pointerdown', e => {
  const g = e.target.closest && e.target.closest('.grip'); if (!g || tdrag || (e.button && e.button !== 0)) return;
  const li = g.closest('li.task'), ul = li.parentElement, items = [...ul.querySelectorAll(':scope > li.task')]; if (items.length < 2) return;
  e.preventDefault(); try { g.setPointerCapture(e.pointerId) } catch (_) { }
  const box = $('#s-tasks'), sy = box.scrollTop, mids = items.map(x => { const r = x.getBoundingClientRect(); return r.top + sy + r.height / 2 });
  tdrag = { li, ul, items, mids, box, h: li.getBoundingClientRect().height, from: items.indexOf(li), to: items.indexOf(li), y0: e.clientY + sy, id: e.pointerId };
  li.classList.add('dragging');
});
document.addEventListener('pointermove', e => {
  if (!tdrag || e.pointerId !== tdrag.id) return; e.preventDefault();
  const b = tdrag.box; if (e.clientY < 90) b.scrollTop -= 10; else if (e.clientY > window.innerHeight - 150) b.scrollTop += 10;
  const dy = e.clientY + b.scrollTop - tdrag.y0, c = tdrag.mids[tdrag.from] + dy; let to = tdrag.from;
  tdrag.mids.forEach((m, i) => { if (i < tdrag.from && c < m) to = Math.min(to, i); if (i > tdrag.from && c > m) to = Math.max(to, i) });
  tdrag.to = to; tdrag.li.style.transform = `translateY(${dy}px)`;
  tdrag.items.forEach((x, i) => { if (x !== tdrag.li) x.style.transform = i > tdrag.from && i <= to ? `translateY(${-tdrag.h}px)` : i < tdrag.from && i >= to ? `translateY(${tdrag.h}px)` : '' });
}, { passive: false });
function dragEnd(e) {
  if (!tdrag || (e && e.pointerId !== tdrag.id)) return; const d = tdrag; tdrag = null;
  d.items.forEach(x => x.style.transform = ''); d.li.classList.remove('dragging');
  if (d.to === d.from) return;
  const ids = d.items.map(x => +x.dataset.id), [id] = ids.splice(d.from, 1); ids.splice(d.to, 0, id); openTask = null; saveOrder(ids);
}
document.addEventListener('pointerup', dragEnd); document.addEventListener('pointercancel', dragEnd);
const NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const numWord = n => NUMW[n] || String(n);
const nextSort = t => { for (let i = 0; i <= 62; i++) { const d = addDays(i), iso = isoDay(d); if ((!t.due || t.due <= iso) && (!t.hideUntil || t.hideUntil <= iso) && (!t.rep || repOn(t.rep, d))) return i } return 99 };

function renderAll() { renderStores(); renderBackDot(); if (tab === 'tasks') renderTasks(); if (tab === 'keep') renderKeep(); if (tab === 'journeys') renderJourneys(); if (tab === 'market') renderMarket() }

/* ---------- editing a candle ---------- */
/* Pawgress's task sheet (setTaskForm, the edit half of addTask, repStartOpts, updRepUI and the repeat listeners; app.js
   at 528f356), in the Hollow Keep look: words, size, day, time of day, repeats, reminder and steps. Lists, notes and the
   Keep for later tick come with the sorting work (docs/decisions/open-items.md). */
let editId = null, editFrom = null;
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const repDays = v => v === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : v === 'weekdays' ? [1, 2, 3, 4, 5] : v === 'weekends' ? [0, 6] : null;
const edDays = () => $$('#ed-daygrid input:checked').map(c => +c.value);
function edSizeHint() { const r = $('input[name="ed-size"]:checked'), z = r && SIZES[r.value]; $('#ed-size-hint').textContent = z ? `${z.label}: ${z.hint}.` : '' }
// "Starting" for every-2-weeks repeats: this week or next week, showing the first chosen day's date.
function edStartOpts(from) {
  const now = new Date(), thisMon = mondayOf(now), nextMon = new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() + 7);
  const days = edDays().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const lab = (m, w) => { if (!days.length) return w; const d = new Date(m.getFullYear(), m.getMonth(), m.getDate() + (days[0] + 6) % 7); return `${w} (${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]})` };
  let pick = isoDay(thisMon);
  if (from && ISO.test(from)) { const k = weekNo(now) - weekNo(new Date(from + 'T12:00:00')); pick = ((k % 2) + 2) % 2 === 0 ? isoDay(thisMon) : isoDay(nextMon) }
  $('#ed-start').innerHTML = `<option value="${isoDay(thisMon)}">${lab(thisMon, 'This week')}</option><option value="${isoDay(nextMon)}">${lab(nextMon, 'Next week')}</option>`;
  $('#ed-start').value = pick;
}
function edRepUI() { const v = $('#ed-rep').value; $('#ed-days').hidden = v !== 'custom' && v !== 'fortnight'; $('#ed-start-wrap').hidden = v !== 'fortnight'; $('#ed-dom-wrap').hidden = v !== 'monthly' }
function openEdit(t) {
  if (!$('#ed-size-row').children.length) {
    $('#ed-size-row').innerHTML = Object.entries(SIZES).map(([k, z]) => `<label><input class="sr" type="radio" name="ed-size" value="${k}"><span class="opt"><span class="mini" aria-hidden="true">${ART.candle(k, false)}</span><b>${z.label}</b></span></label>`).join('');
    $('#ed-daygrid').innerHTML = [1, 2, 3, 4, 5, 6, 0].map(i => `<label><input class="sr" type="checkbox" value="${i}"><span aria-label="${DOW_LONG[i]}">${DOW[i]}</span></label>`).join('');
    $('#ed-dom').innerHTML = Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">${ordinal(i + 1)}</option>`).join('') + '<option value="31">Last day</option>';
  }
  editId = t.id; editFrom = t.id;
  $('#ed-text').value = t.text;
  const r = $(`input[name="ed-size"][value="${SIZES[t.size] ? t.size : 'small'}"]`); if (r) r.checked = true; edSizeHint();
  $('#ed-due').value = t.due || '';
  let v = 'none';
  if (t.rep && t.rep.dom) v = 'monthly'; else if (t.rep && t.rep.every === 2) v = 'fortnight';
  else if (t.rep && t.rep.days) { const k = t.rep.days.slice().sort().join(); v = k === '0,1,2,3,4,5,6' ? 'daily' : k === '1,2,3,4,5' ? 'weekdays' : k === '0,6' ? 'weekends' : 'custom' }
  $('#ed-rep').value = v; $('#ed-when').value = ['morning', 'afternoon', 'evening'].includes(t.when) ? t.when : 'any';
  $$('#ed-daygrid input').forEach(c => c.checked = !!(t.rep && t.rep.days && t.rep.days.includes(+c.value)));
  $('#ed-dom').value = String(t.rep && t.rep.dom || Math.min(new Date().getDate(), 31));
  edStartOpts(t.rep && t.rep.every === 2 ? t.rep.from : null); edRepUI();
  $('#ed-remind').value = t.remind || '';
  // A reminder Offload read as "45 mins before" keeps its own choice in the list.
  const rm = String(t.remindMin || 0), sel = $('#ed-rmin'); sel.querySelectorAll('option[data-x]').forEach(o => o.remove());
  if (![...sel.options].some(o => o.value === rm)) sel.insertAdjacentHTML('beforeend', `<option value="${rm}" data-x="1">${rm} min before</option>`);
  sel.value = rm;
  $('#ed-steps').value = t.steps.map(s => s.t).join('\n');
  edLists(t.list); $('#ed-note').value = t.note || ''; $('#ed-later').checked = !!t.later; $('#ed-later-wrap').hidden = !!t.rep;
  $('#ed-more').open = !!(t.steps.length || t.rep || t.remind || (t.when && t.when !== 'any') || t.list || t.note || t.later);
  $('#edit').hidden = false; $('#app').setAttribute('aria-hidden', 'true'); $('#edit').scrollTop = 0;
  setTimeout(() => $('#ed-text').focus(), 30);
}
// The List choice: None, every list, and New list, which shows a name box (Pawgress's task form).
function edLists(cur) {
  $('#ed-list').innerHTML = `<option value="">None</option>` + allLists().map(l => `<option value="${esc(l)}">${esc(listName(l))}</option>`).join('') + `<option value="+">New list</option>`;
  $('#ed-list').value = cur || ''; $('#ed-list-name').value = ''; $('#ed-list-new').hidden = true;
}
$('#ed-list').addEventListener('change', () => { const n = $('#ed-list').value === '+'; $('#ed-list-new').hidden = !n; if (n) $('#ed-list-name').focus() });
function closeEdit() {
  $('#edit').hidden = true; $('#app').removeAttribute('aria-hidden'); editId = null;
  const back = editFrom != null && $(`[data-open="${editFrom}"]`); editFrom = null;
  if (back) back.focus();
}
// Saves the sheet. As in Pawgress: ticked steps with the same words stay ticked, and a day, a reminder time or a repeat
// takes a candle out of Later (Later candles have no day and no reminders). Undo puts every field back.
function saveEdit() {
  const t = S.tasks.find(x => x.id === editId); if (!t) { closeEdit(); return }
  const text = $('#ed-text').value.trim();
  if (!text) { toast('Type what needs doing first.'); $('#ed-text').focus(); return }
  const rv = $('#ed-rep').value; let rep = null;
  if (rv === 'custom' || rv === 'fortnight') {
    const days = edDays(); if (!days.length) { toast('Pick at least one day, or choose Just once.'); return }
    rep = { days }; if (rv === 'fortnight') { rep.every = 2; rep.from = $('#ed-start').value || mondayIso(new Date()) }
  } else if (rv === 'monthly') rep = { dom: +$('#ed-dom').value || 1 };
  else if (rv !== 'none') rep = { days: repDays(rv) };
  const before = JSON.parse(JSON.stringify(t)), due = $('#ed-due').value || '';
  const lines = $('#ed-steps').value.split('\n').map(s => s.trim().slice(0, 60)).filter(Boolean).slice(0, 8);
  t.text = text.slice(0, 160); t.size = ($('input[name="ed-size"]:checked') || {}).value || 'small';
  t.steps = lines.map(l => t.steps.find(s => s.t === l) || { t: l, done: false });
  if (due !== t.due) t.hideUntil = ''; // a day picked by hand wins over "Not today"
  t.due = due; t.rep = rep; t.when = $('#ed-when').value; t.remind = $('#ed-remind').value || ''; t.remindMin = +$('#ed-rmin').value || 0;
  const lv = $('#ed-list').value; t.list = lv === '+' ? addList($('#ed-list-name').value) : listKey(lv);
  t.note = $('#ed-note').value.trim().slice(0, 500);
  // As in Pawgress: a day, a reminder time or a repeat wins over Keep for later, and the message says so.
  let msg = 'Saved.';
  if ($('#ed-later').checked && !t.rep) { if (t.due || t.remind) { t.later = false; msg = 'Saved. It has a day or a time, so it stays out of Later.' } else toLater(t) }
  else t.later = false;
  openTask = null; save(); askNotifyOnce(); renderTasks(); closeEdit(); // drawn first, so focus goes back to the new row
  toast(msg, () => { Object.keys(t).forEach(k => delete t[k]); Object.assign(t, before); save(); renderTasks() });
}
$('#edit-form').addEventListener('submit', e => { e.preventDefault(); saveEdit() });
$('#ed-size-row').addEventListener('change', edSizeHint);
$('#ed-rep').addEventListener('change', () => {
  const v = $('#ed-rep').value;
  if ((v === 'custom' || v === 'fortnight') && !edDays().length) $$('#ed-daygrid input').forEach(c => c.checked = v === 'custom' ? [1, 2, 3, 4, 5].includes(+c.value) : +c.value === new Date().getDay());
  if (v === 'monthly' && ISO.test($('#ed-due').value)) $('#ed-dom').value = String(+$('#ed-due').value.slice(8));
  edStartOpts($('#ed-start').value); edRepUI();
});
$('#ed-daygrid').addEventListener('change', () => { if ($('#ed-rep').value === 'fortnight') edStartOpts($('#ed-start').value) });

/* ---------- journeys ---------- */
const isBack = () => !!S.journey && S.journey.end <= Date.now();
function fmtLeft(ms) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  if (m < 60) return plural(m, 'minute');
  const h = Math.floor(m / 60), r = m % 60;
  return plural(h, 'hour') + (r ? ' ' + plural(r, 'minute') : '');
}
// A journey's length in whole minutes: "14 min", "1 hour", "2 hours 42 min".
function fmtLength(sec) { const m = Math.max(1, Math.round(sec / 60)), h = Math.floor(m / 60), r = m % 60; return h ? plural(h, 'hour') + (r ? ' ' + r + ' min' : '') : m + ' min' }
// The places on the chart, labelled with their length as the worn gear makes it.
const chartPlaces = () => JOURNEYS.map(d => ({ ...d, len: fmtLength(trip(d).sec) }));
function renderBackDot() { $('#back-dot').hidden = !isBack(); $('#back-dot .sr').textContent = ` (${who()} is back)` }
function renderJourneys() {
  renderBackDot();
  const j = S.journey, now = Date.now(), away = j && !isBack(), back = isBack();
  const frac = j ? Math.min(1, Math.max(0, (now - j.start) / Math.max(1, j.end - j.start))) : 0;
  $('#journey-sub').textContent = back ? `${who()} is home.` : away ? `${who()} is away.` : `${who()} is home. ${S.prov ? plural(S.prov, 'provision') + ' packed.' : 'No provisions packed yet.'}`;
  const sel = j ? j.id : S.pick;
  $('#chart').innerHTML = `<div id="chart-art">${ART.chart(chartPlaces(), sel, j ? { id: j.id, frac: back ? 1 : frac, cls: S.hero.cls } : null)}</div>` +
    JOURNEYS.map(d => `<button type="button" class="place${d.id === sel ? ' on' : ''}" data-pick="${d.id}" style="left:${(d.x / 358 * 100).toFixed(2)}%;top:${(d.y / 358 * 100).toFixed(2)}%"${j ? ' disabled' : ''} aria-pressed="${d.id === sel}" aria-label="${esc(d.name)}, ${fmtLength(trip(d).sec)}"></button>`).join('');
  const d = JOURNEY_BY[sel], card = $('#dest');
  if (back) {
    card.innerHTML = `<div class="row-between"><h2 class="title">${esc(who())} is home</h2><span class="eyebrow">Ring ${d.ring}</span></div>
      <p class="muted">Back from ${esc(d.name.replace(/^The /, 'the '))} with ${plural(j.silver, 'piece')} of silver${j.back ? (j.found ? ', ' : ' and ') + plural(j.back, 'provision') : ''}${j.found ? ' and ' + esc(lower(FOUND_BY[j.found].name)) : ''}.</p>
      <div class="dest-row"><span></span><button type="button" class="ember-btn" data-act="collect">Collect ${j.silver} silver</button></div>`;
  } else if (away) {
    card.innerHTML = `<div class="row-between"><h2 class="title">${esc(d.name)}</h2><span class="eyebrow">Ring ${d.ring}</span></div>
      <p class="muted">${esc(who())} is on the way. Back in <b id="j-left">${fmtLeft(j.end - now)}</b>${speed() > 1 ? ' (fast)' : ''}.</p>
      <div class="bar" id="j-bar" role="progressbar" aria-label="Journey" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(frac * 100)}"><span style="width:${(frac * 100).toFixed(1)}%"></span></div>`;
  } else {
    const short = S.prov < d.prov, t = trip(d), worn = SLOTS.map(([k]) => ITEM_BY[S.wear[k]]).filter(Boolean);
    card.innerHTML = `<div class="row-between"><h2 class="title">${esc(d.name)}</h2><span class="eyebrow">Ring ${d.ring}</span></div>
      <p class="muted">${esc(d.tale)}</p>
      <div class="dest-row"><span>${fmtLength(t.sec)} · ${plural(d.prov, 'provision')} · <b class="ember">earns ${t.silver} silver</b>${t.back ? ` · ${plural(t.back, 'provision')} home` : ''}</span>
      <button type="button" class="ember-btn" data-act="send"${short ? ' disabled' : ''}>Send</button></div>
      ${short ? `<p class="muted small">${S.prov ? `Needs ${plural(d.prov, 'provision')}; you have ${S.prov}.` : 'Lighting candles packs provisions.'}</p>` : ''}
      ${worn.length ? `<p class="muted small" id="gear-line">With ${worn.map(g => esc(lower(g.name))).join(', ')}.</p>` : ''}
      ${satchelLine()}`;
  }
  const fw = $('#fast-wrap'); fw.hidden = !isTest(); $('#fast').checked = !!S.fast;
}
// The satchel: the found thing that goes with the next journey, and how many more wait.
function satchelLine() {
  const f = FOUND_BY[S.satchel[0]]; if (!f) return '';
  const more = S.satchel.length - 1;
  return `<p class="muted small" id="found-line">Taking ${esc(lower(f.name))} from your satchel: ${gearText(f).replace(' a journey', '')}.` +
    `${more ? ` ${cap(numWord(more))} more ${more === 1 ? 'waits' : 'wait'} for later journeys.` : ''}</p>`;
}
// Every second while Journeys is open: move the countdown, the bar and the knight on the chart, without redrawing the
// buttons (so focus stays put). The whole screen is redrawn once, when the knight gets home.
let wasAway = false;
function tickJourneys() {
  const j = S.journey;
  if (!j || isBack()) { if (wasAway) { wasAway = false; renderJourneys() } return }
  wasAway = true;
  const now = Date.now(), frac = Math.min(1, (now - j.start) / Math.max(1, j.end - j.start)), left = $('#j-left'), bar = $('#j-bar');
  if (left) left.textContent = fmtLeft(j.end - now);
  if (bar) { bar.setAttribute('aria-valuenow', Math.round(frac * 100)); bar.firstElementChild.style.width = (frac * 100).toFixed(1) + '%' }
  const art = $('#chart-art'); if (art) art.innerHTML = ART.chart(chartPlaces(), j.id, { id: j.id, frac, cls: S.hero.cls });
}
function sendJourney() {
  const d = JOURNEY_BY[S.pick]; if (S.journey || !d || S.prov < d.prov) return;
  const now = Date.now(), t = trip(d), used = S.satchel[0] || null;
  const found = S.satchel.length - (used ? 1 : 0) < SATCHEL_MAX && Math.random() < FIND_CHANCE[d.id] ? FOUND[Math.floor(Math.random() * FOUND.length)].id : null;
  if (used) S.satchel.shift();
  S.prov -= d.prov; S.journey = { id: d.id, start: now, end: now + t.sec * 1000 / speed(), silver: t.silver, back: t.back, found, used };
  save(); renderStores(); renderJourneys();
  toast(`${who()} sets out for ${d.name.replace(/^The /, 'the ')}.`, () => {
    if (!S.journey || S.journey.id !== d.id) return;
    if (S.journey.used) S.satchel.unshift(S.journey.used);
    S.journey = null; S.prov += d.prov; save(); renderStores(); renderJourneys();
  });
}
function collectJourney() {
  if (!isBack()) return;
  const n = S.journey.silver, b = Math.min(S.journey.back || 0, PROV_MAX - S.prov), f = FOUND_BY[S.journey.found];
  S.silver += n; S.prov += b; S.pick = S.journey.id; S.journey = null;
  if (f && S.satchel.length < SATCHEL_MAX) S.satchel.push(f.id);
  save(); renderStores(); renderJourneys(); toast(`+${n} silver${b ? ', +' + plural(b, 'provision') : ''}${f ? ', and ' + lower(f.name) : ''}.`);
}

/* ---------- the Well ---------- */
/* Pawgress's Offload screen (528f356: qaOpen, qaClose, qaPreview, qaDump, qaNote and their listeners) in the Well's
   look: each line rises as a runestone saying what was understood; a stone's × takes its lines out of the well, a done
   line's diamond turns it back into a task, and duplicates show dimmed and are skipped. */
let wellFrom = null;
const wellUndone = new Set();
function openWell(text) {
  wellFrom = document.activeElement;
  $('#well').hidden = false; $('#app').setAttribute('aria-hidden', 'true');
  const ta = $('#well-in'); if (text != null) ta.value = String(text);
  previewWell(); setTimeout(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }, 30);
}
function closeWell() {
  $('#well').hidden = true; $('#app').removeAttribute('aria-hidden');
  if (wellFrom && wellFrom.focus && document.contains(wellFrom)) wellFrom.focus();
}
// Adds text to whatever is already in the well (shared text, speech, a line from quick add), then opens it.
function addToWell(text) {
  const ta = $('#well-in'), cur = ta.value.replace(/\s+$/, ''), t = String(text || '').replace(/\s+$/, '');
  openWell(t.trim() ? (cur ? cur + '\n' : '') + t.replace(/^\s*\n/, '') : undefined);
}
// What a stone says it understood, in plain words (Pawgress's qaNote), starting with its list.
function wellNote(p) {
  const a = p.list ? [listName(p.list)] : [];
  if (p.done) return a.concat('already done').join(' · ');
  if (p.later) a.push('later');
  if (p.steps && p.steps.length) a.push(plural(p.steps.length, 'step') + ': ' + p.steps.join(', '));
  if (p.rep) a.push(repPhrase(p.rep));
  if (p.due) a.push(p.due === today() ? 'due today' : 'due ' + fmtDayShort(p.due).replace(/^Tomorrow$/, 'tomorrow'));
  if (p.when && p.when !== 'any' && !p.remind) a.push(p.when);
  if (p.needTime) a.push('add a time to get a reminder');
  if (p.remind) { const m = p.remindMin; a.push('reminder ' + (m ? (m >= 1440 && m % 1440 === 0 ? plural(m / 1440, 'day') : m >= 60 && m % 60 === 0 ? plural(m / 60, 'hour') : m + ' min') + ' before ' : 'at ') + fmtTime(p.remind)) }
  const sz = p.size || p.guess; if (sz && sz !== 'small') a.push(SIZES[sz].label.toLowerCase());
  return a.join(' · ');
}
function previewWell() {
  const raw = $('#well-in').value, xs = wellItems(raw, wellUndone), ul = $('#well-preview');
  $('#rose-h').hidden = !xs.length;
  ul.innerHTML = xs.map(x => {
    const n = x.dup ? (x.p.done ? 'same as a line above' : 'already on your list') : wellNote(x.p);
    const flip = x.could ? `<button type="button" class="st-d" data-well="flip" data-k="${esc(x.key)}" aria-pressed="${x.p.done}" aria-label="Already done: ${esc(x.p.text)}"></button>` : '';
    return `<li class="${x.p.done ? 'done' : ''}${x.dup ? ' dim' : ''}">${flip}<span class="st-t">${esc(x.p.text)}${n ? ` <span>· ${esc(n)}</span>` : ''}</span>` +
      `<button type="button" class="st-x" data-well="rm" data-i="${[x.i, ...x.kids].join(',')}" aria-label="Take out ${esc(x.p.text)}">${ART.icon.close || '×'}</button></li>`;
  }).join('');
  const keep = xs.filter(x => !x.dup), add = keep.filter(x => !x.p.done).length, done = keep.length - add, go = $('#well-go');
  go.disabled = !keep.length;
  go.textContent = !keep.length ? 'Cast it in' : [add ? 'Set down ' + plural(add, 'candle') : '', done ? 'light ' + done : ''].filter(Boolean).join(', ').replace(/^l/, 'L');
  $('#well-note').hidden = wellLines(raw).length <= 50;
}
// Plain words for a repeat (from Pawgress's repPhrase, shortened).
function repPhrase(rep) {
  if (rep.dom) return rep.dom === 31 ? 'last day of the month' : 'every month on the ' + ordinal(rep.dom);
  const k = rep.days.slice().sort().join(), w = k === '0,1,2,3,4,5,6' ? 'every day' : k === '1,2,3,4,5' ? 'weekdays' : k === '0,6' ? 'weekends' : 'every ' + rep.days.map(i => DOW[i]).join(', ');
  return rep.every === 2 ? w.replace('every', 'every other') : w;
}
function castWell() {
  const xs = wellItems($('#well-in').value, wellUndone), keep = xs.filter(x => !x.dup), skipped = xs.filter(x => x.dup && !x.p.done).length;
  if (!keep.length) return;
  const r = commit(keep.map(x => x.p)); wellUndone.clear(); $('#well-in').value = ''; closeWell();
  setTab('tasks'); toast(commitText(r) + (skipped ? ` Skipped ${skipped} already on your list.` : ''), r.undo);
}
// Quick add: one line (Pawgress's qaAdd). It adds even if the same candle is already there, as Pawgress does.
function quickAdd(raw) {
  const t = String(raw).trim();
  if (!t) { toast('Type a task, or open the well for lots at once.'); return false }
  if (/^(?:did|done|finished)\s*:?$/i.test(t)) { toast('Type what you did, then add it.'); return false }
  const ps = qaExpand(t).map(qaParse).filter(p => !qaEmpty(p));
  if (!ps.length) { toast(/^(?:i\s+)?(?:did|done|finished)\b/i.test(t) ? 'Type what you did, then add it.' : 'Type what needs doing first.'); return false }
  const r = commit(ps); renderTasks(); renderStores(); toast(commitText(r), r.undo); return true;
}

/* ---------- reminders ---------- */
/* Every kind Pawgress has (buildPlan, 528f356), each with its own switch in Settings: the morning and evening prompts,
   the daily briefing, "Still to do" notes, the reminders set on candles, and the knight back from a journey (Pawgress's
   pals coming home). The plan covers 14 days and is sent whole to Android (NativeBridge.setPlan), which replaces the old
   one. Lit candles, Not today and Later are respected; Later candles get no reminders and stay out of the briefing. */
const PLAN_DAYS = 14, PLAN_MAX = 400;
const atTime = (d, hhmm) => { const [h, m] = String(hhmm || '09:00').split(':').map(Number); const x = new Date(d); x.setHours(h || 0, m || 0, 0, 0); return x.getTime() };
// A stable id per notification (kind + day + task), so a rebuilt plan keeps the same ids.
const planId = key => { let x = 5381; for (let i = 0; i < key.length; i++) x = ((x * 33) ^ key.charCodeAt(i)) >>> 0; return 10000 + (x % 1000000000) };
// Back from a journey after the day's last reminder (and before the first morning one) comes quietly, on its own channel.
// With no reminders on, that is 9pm to 8am (Pawgress's palCh).
function journeyCh(at, r) {
  const m = t => { const [h, mi] = String(t).split(':').map(Number); return h * 60 + (mi || 0) }, on = [];
  if (r.morning.on) on.push(m(r.morning.t)); if (r.evening.on) on.push(m(r.evening.t));
  if (r.brief.on) on.push(m(r.brief.am), m(r.brief.pm));
  if (r.nag) { const st = r.nag / 60; on.push((8 + Math.floor((21 - 8) / st) * st) * 60, 8 * 60) }
  const eve = on.filter(x => x >= 720), morn = on.filter(x => x < 720), last = eve.length ? Math.max(...eve) : 21 * 60, first = morn.length ? Math.min(...morn) : 8 * 60;
  const d = new Date(at), x = d.getHours() * 60 + d.getMinutes();
  return x > last || x < first ? 'journeys_night' : 'journeys';
}
const candles = n => n === 1 ? '1 candle' : n + ' candles';
const names = a => a.slice(0, 3).map(t => t.text).join(', ') + (a.length > 3 ? ' and ' + (a.length - 3) + ' more' : '');
function buildPlan(now = Date.now()) {
  const r = S.rem, plan = [], once = {}, t0 = new Date(now), todayIso = isoDay(t0);
  const j = S.journey;
  if (r.journeys && j && j.end > now) {
    const d = JOURNEY_BY[j.id];
    plan.push({ id: planId('journey'), at: j.end, ch: journeyCh(j.end, r), act: 'journeys', title: `${who()} is home`,
      body: `Back from ${d.name.replace(/^The /, 'the ')} with ${plural(j.silver, 'piece')} of silver.` });
  }
  // Candles that come round on a day: not lit (a repeat lit today is done for today), not Later, not waiting.
  const onDay = (t, d, k) => { const diso = isoDay(d);
    if (t.later || (t.hideUntil && diso < t.hideUntil) || (t.due && diso < t.due)) return false;
    if (t.rep) return repOn(t.rep, d) && !(k === 0 && t.doneOn === todayIso);
    return !t.doneOn };
  const litToday = S.tasks.some(t => t.doneOn === todayIso);
  for (let k = 0; k < PLAN_DAYS; k++) {
    const d = new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + k), diso = isoDay(d);
    if (r.morning.on) { const at = atTime(d, r.morning.t); if (at > now) plan.push({ id: planId('am' + diso), at, ch: 'reminders', act: 'dump', title: 'Good morning from the keep', body: 'Anything on your mind? Cast it into the well.' }) }
    if (r.evening.on && !(k === 0 && litToday)) { const at = atTime(d, r.evening.t); if (at > now) plan.push({ id: planId('pm' + diso), at, ch: 'reminders', act: 'dump', title: 'The keep is quiet now', body: 'Cast in anything for tomorrow, then let it go.' }) }
    if (r.brief.on) {
      const am = atTime(d, r.brief.am);
      if (am > now) { const xs = S.tasks.filter(t => onDay(t, d, k)).sort(taskCmp); if (xs.length) plan.push({ id: planId('ba' + diso), at: am, ch: 'reminders', act: 'tasks', title: `${candles(xs.length)} for today`, body: names(xs) }) }
      const pm = atTime(d, r.brief.pm);
      if (pm > now) {
        const nd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1), niso = isoDay(nd);
        const xs = S.tasks.filter(t => (t.rep || !t.doneOn) && !t.later && !(t.hideUntil && niso < t.hideUntil) && (t.due === niso || (t.rep && repOn(t.rep, nd))) && (!t.due || t.due <= niso)).sort(taskCmp);
        if (xs.length) plan.push({ id: planId('bp' + diso), at: pm, ch: 'reminders', act: 'tasks', title: `Tomorrow: ${candles(xs.length)} waiting`, body: names(xs) });
      }
    }
    // Still to do: candles whose day has gone by, every 2 or 4 hours between 8am and 9pm, for three days at most.
    if (r.nag && k < 3) {
      const over = S.tasks.filter(t => !t.doneOn && !t.later && t.due && t.due < diso && !(t.hideUntil && diso < t.hideUntil));
      if (over.length) for (let h = 8; h <= 21; h += r.nag / 60) {
        const at = atTime(d, String(h).padStart(2, '0') + ':00'); if (at <= now) continue;
        plan.push({ id: planId('n' + diso + '-' + h), at, ch: 'reminders', act: 'tasks', title: over.length === 1 ? 'One candle is still waiting' : `${cap(numWord(over.length))} candles are still waiting`, body: 'Light the smallest, or give it a Not today.' });
      }
    }
    if (r.tasks) S.tasks.forEach(t => {
      if (!t.remind || t.later) return;
      const mins = t.remindMin || 0, at = atTime(d, t.remind) - mins * 60000; if (at <= now) return;
      if ((t.hideUntil && diso < t.hideUntil) || (t.due && diso < t.due)) return;
      if (t.rep) { if (!repOn(t.rep, d) || (k === 0 && t.doneOn === todayIso)) return }
      else { if (t.doneOn || once[t.id]) return; if (t.due && t.due >= todayIso && diso !== t.due) return; once[t.id] = 1 }
      plan.push({ id: planId('t' + t.id + '-' + diso), at, ch: 'reminders', act: 'tasks',
        title: mins ? `Coming up: ${t.text}` : `Time for: ${t.text}`,
        body: mins === 1440 ? `Tomorrow at ${fmtTime(t.remind)}. Its candle is waiting.` : mins ? `At ${fmtTime(t.remind)}. Its candle is waiting.` : 'Its candle is waiting. Starting counts.' });
    });
  }
  // Reminders on the minute: everything the person set a time for. The knight coming home stays as it is.
  if (r.exact) plan.forEach(e => { if (e.ch === 'reminders') e.x = 1 });
  return plan.sort((a, b) => a.at - b.at).slice(0, PLAN_MAX);
}
let planSig = '', syncT = null;
function syncReminders() {
  if (!NATIVE) return;
  nat('setQuickAdd', !!S.rem.quick);
  const sig = JSON.stringify(buildPlan());
  if (sig === planSig) return;
  planSig = sig; nat('setPlan', sig);
}
function queueSync() { if (!NATIVE) return; clearTimeout(syncT); syncT = setTimeout(syncReminders, 700) }
const hasTimed = () => S.tasks.some(t => t.remind && !t.later && !t.doneOn);
// Notifications off while something is planned: one quiet line on the candles screen, with a way to turn them on.
const remindersOff = () => NATIVE && nat('canNotify') === false && S.rem.tasks && hasTimed();
// Android asks once whether Taskbound may send notifications: the first time there is something to send.
function askNotifyOnce() { if (!NATIVE || S.askedNotify || !buildPlan().length || nat('canNotify') !== false) return; S.askedNotify = true; save(); nat('requestPermission') }
// Reminders on the minute need Android's "Alarms and reminders" access, which the person grants.
const canExact = () => nat('canExact') === true;
/* The one-time offer (Pawgress's exactTip): the first time a candle gets a reminder time on Android while the switch is
   off, a line under the candles asks "Want reminders on the exact minute?". It stays for that visit and never comes back.
   Candles that already had a time when the app opened don't count. */
let exactTipNow = false;
const remIdsAtLoad = new Set(S.tasks.filter(t => t.remind).map(t => t.id));
function exactTipCheck() {
  if (S.exactTip || !NATIVE || !NATIVE.canExact || S.rem.exact || !S.rem.tasks) return;
  if (S.tasks.some(t => t.remind && !t.doneOn && !remIdsAtLoad.has(t.id))) { S.exactTip = true; exactTipNow = true; save() }
}

/* ---------- settings ---------- */
/* Pawgress's Settings, shortened to what Taskbound has (look.md): Reminders (Android only), grouped Daily / Notify me
   about / More, then Tasks and Offload with the lists. A time or option shows only while its switch is on. */
let setFrom = null;
function openSettings() {
  setFrom = document.activeElement; renderSettings();
  $('#settings').hidden = false; $('#app').setAttribute('aria-hidden', 'true'); $('#settings').scrollTop = 0;
  setTimeout(() => $('#close-settings').focus(), 30);
}
function closeSettings() {
  $('#settings').hidden = true; $('#app').removeAttribute('aria-hidden');
  if (setFrom && setFrom.focus && document.contains(setFrom)) setFrom.focus();
}
const sw = (k, on, label, extra = '') => `<div class="set-row"><label class="switch"><input type="checkbox" data-rem="${k}"${on ? ' checked' : ''}><span class="knob" aria-hidden="true"></span><span>${label}</span></label>${extra}</div>`;
const timeIn = (attr, v, label) => `<input class="input set-in" type="time" ${attr} value="${v}" aria-label="${label}">`;
const pick = (attr, opts, v, label) => `<select class="input set-in" ${attr} aria-label="${label}">${opts.map(([x, l]) => `<option value="${x}"${String(v) === String(x) ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
function renderSettings() {
  // A box being typed in sends its change before it is redrawn, not halfway through.
  const f = document.activeElement; if (f && f !== document.body && $('#set-body').contains(f)) f.blur();
  const r = S.rem; let h = '';
  if (NATIVE) {
    h += `<section class="set-card" aria-labelledby="set-rem-h"><h3 id="set-rem-h" class="set-h">Reminders</h3>`;
    if (nat('canNotify') === false) h += `<p class="fine">Notifications are switched off for Taskbound.</p><div><button type="button" class="ghost-btn wide" data-set="allow-notify">Allow notifications</button></div>`;
    h += `<p class="group-h">Daily</p>
      ${sw('morning', r.morning.on, 'Morning prompt', r.morning.on ? timeIn('data-remt="morning"', r.morning.t, 'Morning prompt time') : '')}
      ${sw('evening', r.evening.on, 'Evening prompt', r.evening.on ? timeIn('data-remt="evening"', r.evening.t, 'Evening prompt time') : '')}
      ${sw('brief', r.brief.on, 'Daily briefing')}
      ${r.brief.on ? `<div class="set-row sub"><label for="rem-am" class="fine">Today's candles at</label>${timeIn('id="rem-am" data-remb="am"', r.brief.am, '').replace(' aria-label=""', '')}</div>
      <div class="set-row sub"><label for="rem-pm" class="fine">Tomorrow's candles at</label>${timeIn('id="rem-pm" data-remb="pm"', r.brief.pm, '').replace(' aria-label=""', '')}</div>` : ''}
      <p class="group-h">Notify me about</p>
      ${sw('tasks', r.tasks, 'Candle reminders')}
      ${r.tasks ? `<div class="set-row sub"><label for="rem-def" class="fine">Default reminder</label>${pick('id="rem-def" data-remsel="defMin"', REM_OPTS, r.defMin, 'Default reminder').replace(' aria-label="Default reminder"', '')}</div>` : ''}
      <div class="set-row"><label for="rem-nag">Still to do</label>${pick('id="rem-nag" data-remsel="nag"', [[0, 'Off'], [120, 'Every 2 hours'], [240, 'Every 4 hours']], r.nag, 'Still to do').replace(' aria-label="Still to do"', '')}</div>
      ${sw('journeys', r.journeys, 'Back from a journey')}
      <p class="group-h">More</p>
      ${sw('quick', r.quick, 'Quick add in notifications')}
      ${NATIVE.canExact ? sw('exact', r.exact, 'Reminders on the minute') + (r.exact && !canExact() ? `<p class="fine">Taskbound needs Alarms and reminders access for this.</p><div><button type="button" class="ghost-btn wide" data-set="allow-exact">Allow</button></div>` : '') : ''}
      <div><button type="button" class="ghost-btn wide" data-set="notif-settings">Notification settings</button></div></section>`;
  }
  h = `<section class="set-card" aria-labelledby="set-you-h"><h3 id="set-you-h" class="set-h">Who you are</h3>
    <div class="field"><label for="set-name" class="lbl">Your name</label><input id="set-name" class="input" type="text" maxlength="${NAME_MAX}" autocomplete="off" spellcheck="false" data-heroname value="${esc(S.hero.name)}" placeholder="Bramble"></div>
    <div class="heroes small" role="group" aria-label="Who wakes the keep">${HERO.map(([k, n]) => heroCard(k, n, '', S.hero.cls === k, 2, 'data-hero')).join('')}</div>
    <p class="fine">Only how you look. Gear works the same for all.</p></section>` + h;
  const ls = allLists();
  h += `<section class="set-card" aria-labelledby="set-tasks-h"><h3 id="set-tasks-h" class="set-h">Tasks and Offload</h3>
    <div class="set-row"><label for="cfg-size">Default size</label>${pick('id="cfg-size" data-cfgsel="defSize"', Object.entries(SIZES).map(([k, z]) => [k, z.label]), S.cfg.defSize, '').replace(' aria-label=""', '')}</div>
    <p class="fine">For lines the well can't size.</p>
    <div class="set-row"><label for="cfg-snooze">Not today returns</label>${pick('id="cfg-snooze" data-cfgsel="snooze"', [[1, 'Tomorrow'], [2, 'In 2 days'], [7, 'Next week']], S.cfg.snooze, '').replace(' aria-label=""', '')}</div>
    <p class="group-h">Lists</p>
    ${ls.length ? `<ul class="lman">${ls.map(l => `<li><input class="input" type="text" maxlength="20" value="${esc(listName(l))}" data-listname="${esc(l)}" aria-label="Rename ${esc(listName(l))}"><button type="button" class="linkbtn" data-set="list-del" data-v="${esc(l)}" aria-label="Remove ${esc(listName(l))}">Remove</button></li>`).join('')}</ul>`
      : `<p class="fine">Lists keep candles apart: home, work, the allotment. Type #home on a line in the well, or make one here.</p>`}
    <form class="lnew" data-listform="settings"><label for="set-list-in" class="sr">New list name</label><input id="set-list-in" class="input" type="text" maxlength="20" autocomplete="off" placeholder="New list"><button type="submit" class="ghost-btn wide">Add</button></form>
  </section>`;
  $('#set-body').innerHTML = h;
}
// Renaming a list moves its candles with it; removing one leaves its candles where they are, with Undo.
function renameList(from, to) {
  to = listKey(to); if (!to || to === from || !allLists().includes(from)) return false;
  S.lists = [...new Set(S.lists.map(x => x === from ? to : x).concat(to))]; S.tasks.forEach(t => { if (t.list === from) t.list = to });
  if (listPick === from) listPick = to; return true;
}
function removeList(l) {
  const was = { lists: S.lists.slice(), ids: S.tasks.filter(t => t.list === l).map(t => t.id) };
  S.lists = S.lists.filter(x => x !== l); S.tasks.forEach(t => { if (t.list === l) t.list = '' }); if (listPick === l) listPick = '';
  save(); renderSettings(); renderTasks();
  toast(`Removed ${listName(l)}.${was.ids.length ? ' Its candles are still here.' : ''}`, () => {
    S.lists = was.lists; S.tasks.forEach(t => { if (was.ids.includes(t.id)) t.list = l }); save(); renderSettings(); renderTasks();
  });
}
function settingsAct(b) {
  const a = b.dataset.set;
  if (a === 'allow-notify') { S.askedNotify = true; save(); nat('requestPermission'); setTimeout(renderSettings, 1500) }
  else if (a === 'allow-exact') nat('requestExact');
  else if (a === 'notif-settings') nat('openNotificationSettings');
  else if (a === 'list-del') removeList(b.dataset.v);
}
// One of the four you can be: a framed card with its picture, name and (on the first start) a line about them.
function heroCard(k, name, line, on, size, attr) {
  return `<button type="button" class="hero-card${on ? ' on' : ''}" ${attr}="${k}" aria-pressed="${on}"><span class="hero-art">${ART.hero(k, {}, size, '')}</span>
    <span class="hero-name">${name}</span>${line ? `<span class="hero-line">${line}</span>` : ''}</button>`;
}
$('#set-body').addEventListener('change', e => {
  const t = e.target, r = S.rem;
  if (t.dataset.rem) {
    const k = t.dataset.rem; if (k === 'morning' || k === 'evening' || k === 'brief') r[k].on = t.checked; else r[k] = t.checked;
    save(); planSig = ''; syncReminders(); askNotifyOnce();
    if (k === 'exact' && t.checked && !canExact()) nat('requestExact');
    renderSettings(); const f = $(`#set-body [data-rem="${k}"]`); if (f) f.focus();
  } else if (t.dataset.remt) { r[t.dataset.remt].t = t.value || REM_DEFAULT[t.dataset.remt].t; save() }
  else if (t.dataset.remb) { r.brief[t.dataset.remb] = t.value || REM_DEFAULT.brief[t.dataset.remb]; save() }
  else if (t.dataset.remsel) { r[t.dataset.remsel] = +t.value || 0; save(); askNotifyOnce() }
  else if ('heroname' in t.dataset) { S.hero.name = cleanName(t.value); t.value = S.hero.name; save(); renderAll() }
  else if (t.dataset.cfgsel) { S.cfg[t.dataset.cfgsel] = t.dataset.cfgsel === 'snooze' ? +t.value : t.value; S.cfg = cleanCfg(S.cfg); save() }
  else if (t.dataset.listname) {
    const from = t.dataset.listname;
    if (renameList(from, t.value)) { save(); renderTasks(); toast(`Renamed to ${listName(listKey(t.value))}.`); renderSettings() } else t.value = listName(from);
  }
});

/* ---------- the first start ---------- */
/* Shown once (game-loop.md, "Choosing who you are"; canvas row "First start"): the keep asleep, three small rites, then
   choosing who you are and a name. Skip goes straight to the choice, which can't be skipped. An older save, from
   before this was built, starts at the choice. */
let firstStep = 0, firstPick = 'knight', firstName = '';
const steps = n => `<div class="steps" role="img" aria-label="Step ${n} of 3">${[1, 2, 3].map(i => `<span${i === n ? ' class="on"' : ''}></span>`).join('')}</div>`;
function showFirst(n) {
  const el = $('#first');
  if (n === 3 && firstStep !== 3) { firstPick = S.hero.cls; firstName = S.hero.name }
  firstStep = n; el.hidden = false; el.dataset.step = n; $('#app').setAttribute('aria-hidden', 'true');
  const skip = '<button type="button" class="first-skip" data-first="skip">Skip</button>';
  let h = '';
  if (n === 1) h = `<div class="first-keep" aria-hidden="true">${ART.keep(0)}</div>${skip}
    <div class="first-foot"><p class="eyebrow">Welcome, wanderer</p><h1 class="title" id="first-h" tabindex="-1">The keep<br>is sleeping</h1>
    <p class="first-lead">Taskbound is a gentle place to put down everything on your mind. Each thing you finish wakes a little more of this old keep.</p>
    <p class="muted">Nothing here is ever late. Nothing is lost.</p>
    <div class="first-go"><button type="button" class="ember-btn tall" data-first="next">Show me</button>${steps(1)}</div></div>`;
  else if (n === 2) {
    const rite = (icon, head, text) => `<li><span class="rite-ic" aria-hidden="true">${icon}</span><div><h2>${head}</h2><p>${text}</p></div></li>`;
    h = `${skip}<div class="first-page"><p class="eyebrow">How the keep wakes</p><h1 class="title" id="first-h" tabindex="-1">Three small<br>rites</h1>
    <ol class="rites">${rite(`<span class="rite-well">${ART.icon.sigil || ''}</span>`, 'Cast it into the well', 'Type or say everything on your mind, all at once. The well sorts it into candles for you.')}
    ${rite(ART.candle('small', true), 'Light a candle when it’s done', 'A taller candle is a bigger task. Each one you light gives embers and provisions.')}
    ${rite(`<span class="rite-pair">${ART.store.ember}${ART.store.prov}</span>`, 'Wake the keep, then wander', 'Embers wake its rooms, one by one. Provisions send you on journeys, home with silver to furnish them.')}</ol>
    <p class="first-calm">No streaks and no deadlines. Rest whenever you like; the keep will wait.</p>
    <div class="first-go"><button type="button" class="ember-btn tall" data-first="next">Next</button>${steps(2)}</div></div>`;
  } else h = `<div class="first-page choose"><p class="eyebrow center">Before the first candle</p><h1 class="title center" id="first-h" tabindex="-1">Who wakes<br>the keep?</h1>
    <p class="muted center">You can change this any time in Settings.</p>
    <div class="heroes" role="group" aria-label="Who wakes the keep">${HERO.map(([k, nm, line]) => heroCard(k, nm, line, firstPick === k, 3, 'data-first-hero')).join('')}</div>
    <div class="field"><label for="first-name" class="lbl">Your name</label><input id="first-name" class="input" type="text" maxlength="${NAME_MAX}" autocomplete="off" spellcheck="false" enterkeyhint="done" value="${esc(firstName)}" placeholder="Bramble">
    <p class="fine">Leave it empty and the keep calls you Bramble.</p></div>
    <div class="first-go"><button type="button" class="ember-btn tall" data-first="begin">Begin as the ${HERO_BY[firstPick][1].toLowerCase()}</button>${steps(3)}</div></div>`;
  $('#first-body').innerHTML = h; el.scrollTop = 0;
  setTimeout(() => { const f = $('#first-h'); if (f && !(document.activeElement && document.activeElement.closest('[data-first-hero]'))) f.focus() }, 30);
}
function firstAct(b) {
  const a = b.dataset.first;
  if (a === 'next') showFirst(firstStep + 1);
  else if (a === 'skip') showFirst(3);
  else if (a === 'begin') {
    const i = $('#first-name'); S.hero = { cls: firstPick, name: cleanName(i ? i.value : firstName) }; S.met = true; save();
    $('#first').hidden = true; $('#app').removeAttribute('aria-hidden'); firstStep = 0; renderAll();
    toast(`Welcome, ${who()}. The keep is listening.`);
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-first-hero]'); if (!b) return;
  const i = $('#first-name'); if (i) firstName = i.value; firstPick = b.dataset.firstHero; showFirst(3);
  const f = $(`[data-first-hero="${firstPick}"]`); if (f) f.focus();
});
document.addEventListener('input', e => { if (e.target.id === 'first-name') firstName = e.target.value });
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'first-name') { e.preventDefault(); firstAct({ dataset: { first: 'begin' } }) } });

/* ---------- toast ---------- */
let toastT = null;
function toast(msg, undo) {
  const el = $('#toast'); clearTimeout(toastT);
  el.innerHTML = `<p>${esc(msg)}</p>${undo ? '<button type="button" id="toast-undo">Undo</button>' : ''}`;
  el.hidden = false;
  if (undo) $('#toast-undo').onclick = () => { undo(); el.hidden = true };
  toastT = setTimeout(() => el.hidden = true, undo ? 6000 : 3500);
}

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.tab) return setTab(b.dataset.tab);
  if (b.dataset.offer) return offer(+b.dataset.offer);
  if (b.dataset.room != null) return openRoom(+b.dataset.room);
  if (b.dataset.act === 'room-market') return roomToMarket();
  if (b.dataset.pick) { if (!S.journey) { S.pick = b.dataset.pick; save(); renderJourneys() } return }
  if (b.dataset.act === 'send') return sendJourney();
  if (b.dataset.act === 'collect') return collectJourney();
  if (b.dataset.stall) { S.stall = b.dataset.stall; save(); renderMarket(); return }
  if (b.dataset.buy) return buy(b.dataset.buy);
  if (b.dataset.wear) return wear(b.dataset.wear);
  if (b.dataset.edit) { if (b.dataset.edit === 'close') closeEdit(); else { const t = S.tasks.find(x => x.id === +b.dataset.edit); if (t) openEdit(t) } return }
  if (b.dataset.act === 'notify') { if (S.askedNotify) nat('openNotificationSettings'); else { S.askedNotify = true; save(); nat('requestPermission') } return }
  if (b.dataset.move) return moveTask(+b.dataset.move, +b.dataset.v);
  if (b.dataset.list != null) { listPick = b.dataset.list; listNew = false; openTask = null; renderTasks(); return }
  if (b.dataset.act === 'list-new') { listNew = true; renderTasks(); setTimeout(() => { const i = $('#list-in'); if (i) i.focus() }, 0); return }
  if (b.dataset.act === 'later-fold') { laterOpen = !laterOpen; renderTasks(); const f = $('[data-act="later-fold"]'); if (f) f.focus(); return }
  if (b.dataset.act === 'exact-tip-on') { exactTipNow = false; S.rem.exact = true; save(); planSig = ''; syncReminders(); if (!canExact()) nat('requestExact'); else toast('Reminders will come on the minute.'); renderTasks(); return }
  if (b.dataset.act === 'exact-tip-no') { exactTipNow = false; renderTasks(); return }
  if (b.dataset.set) return settingsAct(b);
  if (b.dataset.hero) { S.hero.cls = b.dataset.hero; save(); renderSettings(); renderAll(); const f = $(`#set-body [data-hero="${b.dataset.hero}"]`); if (f) f.focus(); return }
  if (b.dataset.first) return firstAct(b);
  if (b.dataset.act === 'tidy') return tidy();
  if (b.dataset.act === 'select') { sel = sel ? null : new Set(); openTask = null; renderTasks(); $('#tsel').focus(); return }
  if (b.dataset.choose) { if (!sel) return; const n = +b.dataset.choose; if (sel.has(n)) sel.delete(n); else sel.add(n); renderTasks(); const f = $(`.linkish[data-choose="${n}"]`); if (f) f.focus(); return }
  if (b.dataset.bulk) return bulk(b.dataset.bulk);
  const id = +(b.dataset.light || b.dataset.open || b.dataset.snooze || b.dataset.later || b.dataset.today || b.dataset.del || 0), t = id && S.tasks.find(x => x.id === id);
  if (t && b.dataset.light) { const r = light(t); justLit = t.id; openTask = null; save(); renderTasks(); renderStores(); toast(`"${t.text}" lit.${r.e || r.p ? ' +' + earnText(r.e, r.p) + '.' : ''}`, () => { unlight(t, r); save(); renderAll() }); return }
  if (t && b.dataset.open) { openTask = openTask === id ? null : id; renderTasks(); return }
  if (t && b.dataset.snooze) { const n = cfg().snooze; t.hideUntil = isoDay(addDays(n)); openTask = null; save(); renderTasks(); toast(`"${t.text}" waits until ${SNOOZE[n]}.`, () => { t.hideUntil = ''; save(); renderTasks() }); return }
  if (t && b.dataset.later) { const was = { ...t }; toLater(t); openTask = null; save(); renderTasks(); toast(`"${t.text}" kept for later.`, () => { Object.assign(t, was); save(); renderTasks() }); return }
  if (t && b.dataset.today) { const was = { ...t }; t.later = false; t.hideUntil = ''; if (t.due > today()) t.due = today(); openTask = null; save(); renderTasks(); toast(`"${t.text}" joins today.`, () => { Object.assign(t, was); save(); renderTasks() }); return }
  if (t && b.dataset.del) { const i = S.tasks.indexOf(t); S.tasks.splice(i, 1); openTask = null; save(); renderTasks(); toast(`"${t.text}" put out.`, () => { S.tasks.splice(i, 0, t); save(); renderTasks() }); return }
});
// A new list, from the + chip (it is picked straight away) or from Settings (Pawgress's list forms).
document.addEventListener('submit', e => {
  const f = e.target.dataset && e.target.dataset.listform; if (!f) return; e.preventDefault();
  const i = e.target.querySelector('input'), l = listKey(i.value); if (!l) { i.focus(); return }
  const had = allLists().includes(l); addList(l); save();
  if (f === 'chip') { listNew = false; listPick = l; renderTasks(); const c = $(`#lists [data-list="${CSS.escape(l)}"]`); if (c) c.focus() }
  else { renderSettings(); const n = $('#set-list-in'); if (n) n.focus() }
  toast(had ? listName(l) + ' is already a list.' : 'Added ' + listName(l) + '.' + (f === 'chip' ? ' New candles go into it while it is picked.' : ''));
});
document.addEventListener('focusout', e => { if (e.target.id === 'list-in' && listNew) setTimeout(() => { const f = document.activeElement; if (listNew && !(f && f.closest && f.closest('.lnew'))) { listNew = false; renderTasks() } }, 120) });
$('#task-q').addEventListener('input', e => { taskQ = e.target.value; renderTasks() });
$('#quick').addEventListener('submit', e => { e.preventDefault(); const inp = $('#qa-in'); if (quickAdd(inp.value)) inp.value = ''; inp.focus() });
// Pasting several lines into quick add takes them to the well, as in Pawgress.
$('#qa-in').addEventListener('paste', e => {
  const tx = (e.clipboardData || window.clipboardData).getData('text') || '';
  if (tx.split(/\r?\n/).filter(l => l.trim()).length < 2) return;
  e.preventDefault(); const cur = e.target.value.trim(); e.target.value = ''; addToWell((cur ? cur + '\n' : '') + tx);
});
// Offload carries anything typed in quick add into the well with it.
$('#open-well').addEventListener('click', () => { const i = $('#qa-in'), v = tab === 'tasks' ? i.value.trim() : ''; if (v) { i.value = ''; addToWell(v) } else openWell() });
$('#fast').addEventListener('change', e => { S.fast = e.target.checked; save(); renderJourneys() });
$('#close-well').addEventListener('click', closeWell);
$('#well-in').addEventListener('input', previewWell);
$('#well-preview').addEventListener('click', e => {
  const b = e.target.closest('[data-well]'); if (!b) return;
  if (b.dataset.well === 'rm') {
    const ta = $('#well-in'), gone = new Set(b.dataset.i.split(',').map(Number));
    ta.value = ta.value.split(/\r?\n/).filter((l, i) => !gone.has(i)).join('\n'); previewWell();
    const next = $('#well-preview .st-x'); (next || ta).focus();
  } else if (b.dataset.well === 'flip') {
    const k = b.dataset.k; if (wellUndone.has(k)) wellUndone.delete(k); else wellUndone.add(k); previewWell();
    const same = [...$$('#well-preview [data-well="flip"]')].find(x => x.dataset.k === k); if (same) same.focus();
  }
});
$('#well-go').addEventListener('click', castWell);
$('#well-speak').addEventListener('click', () => nat('speak'));
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#first').hidden) { if (firstStep > 1) showFirst(firstStep - 1); return }
  if (e.target.id === 'list-in') { listNew = false; renderTasks(); const a = $('#lists [data-act="list-new"]'); if (a) a.focus() }
  else if (!$('#room').hidden) closeRoom(); else if (!$('#settings').hidden) closeSettings(); else if (!$('#edit').hidden) closeEdit(); else if (!$('#well').hidden) closeWell();
  else if (sel && tab === 'tasks') { sel = null; renderTasks(); $('#tsel').focus() }
});
$('#open-settings').addEventListener('click', openSettings);
$('#close-room').addEventListener('click', () => closeRoom());
$('#close-settings').addEventListener('click', closeSettings);

/* ---------- the Android shell (all optional) ---------- */
window.__share = text => addToWell(text); // shared text and speech join what is already in the well
window.__back = () => { if (!$('#first').hidden) { if (firstStep > 1) showFirst(firstStep - 1); return true } if (!$('#room').hidden) { closeRoom(); return true } if (!$('#settings').hidden) { closeSettings(); return true } if (!$('#edit').hidden) { closeEdit(); return true } if (!$('#well').hidden) { closeWell(); return true } if (sel) { sel = null; renderTasks(); return true } if (openTask) { openTask = null; renderTasks(); return true } if (tab !== 'keep') { setTab('keep'); return true } return false };
window.__act = a => { if (a === 'add' || a === 'offload' || a === 'dump') openWell(); else if (a === 'tasks') setTab('tasks'); else if (a === 'journeys') setTab('journeys'); else if (a === 'speak') nat('speak') };
window.addEventListener('taskbound-notify-changed', () => { planSig = ''; syncReminders(); if (tab === 'tasks') renderTasks(); if (!$('#settings').hidden) renderSettings() });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { exactTipNow = false; clearTimeout(syncT); syncReminders() }
  else { planSig = ''; if (rollDay()) save(); renderAll(); renderRoom(); if (!$('#settings').hidden) renderSettings(); queueSync() }
});
window.__sysTheme = () => nat('setBars', true);

/* ---------- start ---------- */
$$('[data-icon]').forEach(el => el.insertAdjacentHTML('afterbegin', ART.icon[el.dataset.icon] || ''));
$$('[data-art]').forEach(el => { const a = el.dataset.art; el.innerHTML = ART.store[a] || ART[a] || '' });
/* Pixel runes, the rail and pixel-framed buttons (look.md, "Pixel runes and buttons"). Each framed button gets a frame
   drawn to its own size on the x3 grid; the kind comes from CSS (--px-kind, and --px-focus while focused), so a button
   that changes state or size is redrawn. */
$$('[data-rune]').forEach(el => el.innerHTML = ART.runeHtml(el.dataset.rune));
const FRAMED = '.offer button, .ember-btn, .buy, .stalls button, .ghost-btn.wide, .task-tools button, .sm-btn';
const pxCache = new Map();
function pxFrame(el) {
  const w = el.offsetWidth, h = el.offsetHeight; if (!w || !h) return;
  const cs = getComputedStyle(el), base = cs.getPropertyValue('--px-kind').trim(); if (!base) return;
  const kind = base + (cs.getPropertyValue('--px-focus').trim() === '1' ? '-focus' : ''), small = kind.startsWith('small-');
  const gw = Math.floor(w / 3), gh = small ? 10 : Math.floor(h / 3), key = kind + ':' + gw + 'x' + gh;
  if (el._px === key) return; el._px = key;
  let url = pxCache.get(key); if (!url) { url = `url("data:image/svg+xml,${encodeURIComponent(ART.frame(gw, gh, kind))}")`; pxCache.set(key, url) }
  el.style.backgroundImage = url; el.style.backgroundSize = `${gw * 3}px ${gh * 3}px`;
  el.style.backgroundPosition = `${Math.floor((w - gw * 3) / 2)}px ${Math.floor((h - gh * 3) / 2)}px`;
}
const pxRO = typeof ResizeObserver === 'function' ? new ResizeObserver(es => es.forEach(e => pxFrame(e.target))) : null;
function pxScan() { $$(FRAMED).forEach(el => { if (!el._pxSeen && pxRO) { el._pxSeen = 1; pxRO.observe(el) } pxFrame(el) }) }
let pxQ = 0;
new MutationObserver(() => { if (!pxQ) pxQ = requestAnimationFrame(() => { pxQ = 0; pxScan() }) })
  .observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled', 'aria-pressed', 'class', 'hidden'] });
document.addEventListener('focusin', e => { const b = e.target.closest && e.target.closest(FRAMED); if (b) pxFrame(b) });
document.addEventListener('focusout', e => { const b = e.target.closest && e.target.closest(FRAMED); if (b) requestAnimationFrame(() => pxFrame(b)) });
function drawRail() {
  const nav = $('.runes'), d = $('.rune .dia'), r = $('.rail'); if (!nav || !d || !r) return;
  const n = nav.getBoundingClientRect(), b = d.getBoundingClientRect();
  r.innerHTML = ART.rail(Math.floor((n.width - 20) / 3));
  r.style.top = Math.round(b.top + b.height / 2 - n.top - nav.clientTop - 4) + 'px';
}
drawRail(); pxScan();
if (pxRO) new ResizeObserver(drawRail).observe($('.runes'));
if (NATIVE && NATIVE.speak) { $('#well-speak').hidden = false; $('#well-voice-tip').hidden = false }
nat('setBars', true);
rollDay(); save(); setTab('keep');
if (!S.met) showFirst(hadSave ? 3 : 1);
setTimeout(() => { planSig = ''; syncReminders() }, 1500);
setInterval(() => { if (document.hidden) return; if (rollDay()) { save(); renderAll() } else renderBackDot() }, 15000);
