/* Taskbound art: pixel scenes, candles and icons, all as inline SVG. From the design canvas
   "Medieval task app mockups", row 2 (the Hollow Keep). */
const ART = (() => {
  const C = { void: '#0e050b', bone: '#ecdcbc', ember: '#f0a35a', glow: '#ffe0a0', flame: '#c4502e', unlit: '#3a1a24', wine: '#5e2232' };
  const px = (x, y, w, h, f, o) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"${o ? ` opacity="${o}"` : ''}/>`;
  // A sprite drawn pixel by pixel from character rows: each character is a colour from pal, '.' is empty.
  // Runs of one colour on a row become one rect.
  function sprite(rows, pal, ox = 0, oy = 0) {
    let o = '';
    rows.forEach((r, y) => { let x = 0; while (x < r.length) { const c = pal[r[x]]; if (!c) { x++; continue } let e = x; while (e + 1 < r.length && r[e + 1] === r[x]) e++; o += px(ox + x, oy + y, e - x + 1, 1, c); x = e + 1 } });
    return o;
  }
  const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const dith = (x, y, t) => (BAYER4[y & 3][x & 3] + .5) / 16 < t; // ordered dithering, as in the painted scenes

  // Home: the keep painted in real pixel art (art/keep.py, 130 x 282 pixels, drawn x3 with no smoothing; look.md).
  // Its windows are dark in the picture; each woken room lights one, in this order (the same list as art/keep.py).
  const WINDOWS = [[57, 84, 2, 3], [64, 70, 2, 4], [46, 76, 2, 3], [72, 80, 2, 3], [42, 88, 2, 3], [82, 70, 2, 3], [88, 86, 2, 3], [64, 46, 2, 4]];
  function keep(lit) {
    const win = WINDOWS.slice(0, lit).map(([x, y, w, h]) =>
      // a dithered halo of warm light round the window, the pane in ember, a hot pixel at its top
      [[-1, 0], [w, 0], [0, -1], [w - 1, h], [-1, h - 1], [w, h - 1]].map(([dx, dy]) => px(x + dx, y + dy, 1, 1, '#7a2e1c')).join('') +
      px(x, y, w, h, C.ember) + px(x, y, 1, 1, C.glow) + px(x + w - 1, y + h - 1, 1, 1, C.flame)).join('');
    return `<svg viewBox="0 0 130 282" preserveAspectRatio="xMidYMin slice" shape-rendering="crispEdges" role="img"
      aria-label="A keep on a stone spire under a huge ringed moon, a river of embers below, ${lit} of 8 windows lit">
      <image href="img/keep.png" width="130" height="282" style="image-rendering:pixelated"/>${win}</svg>`;
  }

  // A room, painted in real pixel art (art/rooms.py, 130 x 140 pixels, drawn with no smoothing). Each room has one sheet
  // of 32 frames (8 x 4): frame n shows furnishing i in place when bit i of n is set.
  function room(id, mask, label) {
    const x = (mask % 8) * 130, y = Math.floor(mask / 8) * 140;
    return `<svg viewBox="${x} ${y} 130 140" preserveAspectRatio="xMidYMin slice" shape-rendering="crispEdges" role="img" aria-label="${label.replace(/"/g, '&quot;')}">
      <image href="img/rooms/${id}.png" width="1040" height="560" style="image-rendering:pixelated"/></svg>`;
  }

  // A candle: taller for bigger tasks, in an iron dish, wax shaded in four tones with a melted rim and drips.
  // Lit candles carry a flame with a dithered halo.
  const H = { tiny: 6, small: 10, medium: 14, big: 18 };
  const WAX = ['#fff4dc', '#e8dcbe', '#cdbf9c', '#a8987a', '#76664c', '#3a2c20'];
  function candle(size, lit) {
    const h = H[size] || 10, top = 7, vh = top + h + 3, rows = [];
    for (let y = 0; y < vh; y++) rows.push('..........'.split(''));
    const set = (x, y, c) => { if (rows[y] && x >= 0 && x < 10) rows[y][x] = c };
    for (let y = top; y < top + h; y++) { set(2, y, 'k'); set(3, y, y % 4 === 1 ? 'w' : 'a'); set(4, y, 'a'); set(5, y, 'b'); set(6, y, 'c'); set(7, y, 'k') }
    set(3, top, 'w'); set(4, top, 'b'); set(5, top, 'b'); set(6, top, 'a'); set(2, top, 'd'); set(7, top, 'd'); // the melted pool
    set(2, top + 1, 'a'); set(2, top + 2, 'b'); set(1, top + 2, 'k'); set(1, top + 3, 'k'); set(2, top + 3, 'b'); // a drip down the left
    if (h > 8) { set(7, top + 3, 'c'); set(8, top + 4, 'k'); set(7, top + 4, 'c'); set(7, top + 5, 'k') } // and one on the right
    const d = top + h; // the dish
    for (let x = 0; x < 10; x++) set(x, d, x === 0 || x === 9 ? '.' : 'i');
    set(1, d, 'I'); set(2, d, 'I'); for (let x = 2; x < 8; x++) set(x, d + 1, 'j'); for (let x = 3; x < 7; x++) set(x, d + 2, 'n');
    if (lit) {
      [[5, 0, 'r'], [4, 1, 'f'], [5, 1, 'o'], [4, 2, 'o'], [5, 2, 'y'], [3, 3, 'r'], [4, 3, 'y'], [5, 3, 'W'], [6, 3, 'r'],
       [3, 4, 'f'], [4, 4, 'W'], [5, 4, 'y'], [6, 4, 'f'], [4, 5, 'o'], [5, 5, 'o'], [4, 6, 'g']].forEach(([x, y, c]) => set(x, y, c));
      [[2, 2], [7, 2], [3, 0], [6, 1], [2, 5], [7, 5]].forEach(([x, y]) => set(x, y, 'h'));
    } else { set(4, top - 1, 'n'); set(5, top - 2, 'n') } // a bent, cold wick
    const pal = { w: WAX[0], a: WAX[1], b: WAX[2], c: WAX[3], d: WAX[4], k: WAX[5], i: '#3e384a', I: '#6a6478', j: '#1e1a26', n: '#0e0c12',
      r: '#c4502e', f: '#f07a3a', o: '#f0a35a', y: '#ffd27a', W: '#fff0cf', g: '#5a140e', h: '#7a2e1c' };
    return `<svg width="20" height="${vh * 2}" viewBox="0 0 10 ${vh}" shape-rendering="crispEdges" aria-hidden="true">${sprite(rows.map(r => r.join('')), pal)}</svg>`;
  }

  // A room's window, for the row on Home and the Market's stalls: a pointed arch in a stone frame (lit from the left,
  // coursed, a pale sill). Lit: ember light, brightest at the sill, dithered, behind a mullion and transom, with the
  // room's furnishings as dark shapes on the sill. Part: night, ember rising from the bottom. Dark: night and two stars.
  const STONE = ['#160e1a', '#201424', '#2c1c30', '#3c2840', '#523852', '#6c4c66'];
  function inArch(x, y, inset) { // a pointed arch 18 wide, 26 tall
    const half = 8 - inset, cx = 9, spring = 9, apex = 1 + inset;
    if (y < apex || y > 25 - (inset ? 1 : 0)) return false;
    const w = y >= spring ? half : half * Math.sqrt(Math.max(0, (y - apex) / (spring - apex)));
    return Math.abs(x + .5 - cx) <= w;
  }
  function arch(state, furnished = 0) { // 'lit' | 'part' | 'dark'
    let o = '';
    for (let y = 0; y < 26; y++) for (let x = 0; x < 18; x++) {
      if (!inArch(x, y, 0)) continue;
      let c;
      if (!inArch(x, y, 2)) { // the stone frame
        const edge = !inArch(x - 1, y, 0) || !inArch(x, y - 1, 0);
        c = y >= 24 ? STONE[5] : edge ? STONE[1] : (y + (x > 9 ? 2 : 0)) % 5 === 0 ? STONE[1] : x < 9 ? STONE[4] : STONE[3];
        if (inArch(x + 1, y, 2) && x < 9) c = STONE[5]; // lit inner edge on the left
      } else if (state === 'lit') {
        const t = (y - 3) / 21;
        c = dith(x, y, t) ? (dith(x, y + 1, t - .4) ? '#ffd27a' : '#f0a35a') : (t > .3 ? '#f07a3a' : '#c4502e');
        if (x === 9 || y === 12) c = '#2a1018';
      } else if (state === 'part') {
        c = y > 18 ? (dith(x, y, (y - 18) / 6) ? '#f0a35a' : '#c4502e') : dith(x, y, .3) ? '#1e1026' : '#120a18';
        if (x === 9 || y === 12) c = '#0b0610';
      } else {
        c = dith(x, y, .25) ? '#1e1026' : '#120a18';
        if ((x === 5 && y === 7) || (x === 12 && y === 16)) c = '#6a5a7a';
        if (x === 9 || y === 12) c = '#0b0610';
      }
      o += px(x, y, 1, 1, c);
    }
    if (state === 'lit') { // furnishings: a chair and a table on the sill
      if (furnished > 0) o += `<g data-furn>${sprite(['k..', 'k..', 'kkk', 'k.k'], { k: '#4a140e' }, 4, 19)}</g>`;
      if (furnished > 1) o += `<g data-furn>${sprite(['kkkkk', '.k.k.', '.k.k.'], { k: '#4a140e' }, 10, 20)}</g>`;
    }
    return `<svg width="34" height="49" viewBox="0 0 18 26" shape-rendering="crispEdges" aria-hidden="true">${o}</svg>`;
  }

  // The knight, drawn pixel by pixel (24 x 30, shown x3): a great helm with a plume, pauldrons, a wine tabard and a
  // long cloak, in whatever is worn: wear = { armour, weapon, trinket } (item ids). Armour recolours the e/b/a pixels.
  const KNIGHT = [
    '..........o.............',
    '.........oR.............',
    '.........RR.............',
    '........KKrKK...........',
    '.......K34322K..........',
    '.......K43221K..........',
    '.......KKKKKKK..........',
    '.......K32K21K..........',
    '.......K32221K..........',
    '........K221K...........',
    '.........KKK............',
    '.....KKKK111KKKK.cc.....',
    '....KeebbKKKbbaaKcCCc...',
    '....KebbbaKtTKbaaaKcCqcc',
    '....KebbaKttTTKbaaKcCqCc',
    '....KsbaKtttTTtKaaKcCqCc',
    '...KssKKttttTttKKssKCqCc',
    '...KssK.KttgTtK.KssKCqCc',
    '...KsK..KllglK..KsKcCqCc',
    '....K...KttTttK..K.cCCqc',
    '........KttTttK....cCCqc',
    '.......KtttTtttK...cCCCc',
    '.......KPPpKpPPK...cCCCc',
    '.......KPPpKpPPK....cCCc',
    '.......KPpK.KpPK....cCCc',
    '.......KPpK.KpPK.....cCc',
    '.......KbaK.KbaK.....ccc',
    '......KbbaK.KbbaK.......',
    '......KffffKffffK.......',
    '......KKKKKKKKKKK.......'];
  const ARMOUR = { none: ['#8a6a50', '#6b4a30', '#4a3220'], cloak: ['#d4c4e8', '#b7a0d0', '#8a72a8'],
    ringmail: ['#b0b8cc', '#8892ad', '#5d6680'], plate: ['#f2eadc', '#c8bc98', '#8a7c5c'],
    leaves: ['#e0a060', '#b8683a', '#7a3e24'], moonscale: ['#e4eef4', '#a2c2d4', '#58788f'] };
  const WEAPON = {
    blade: ['..y.', '..W.', '..W.', '..W.', '..W.', '..W.', '..W.', '..W.', '..W.', '..W.', '..W.', '..W.', '..W.', '..d.', '.mmmm', '..m.', '..m.'],
    staff: ['.vg.', 'vvg.', '.wg.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.', '..w.'],
    bellspear: ['..b.', '.bBb', '.BBB', '.bBb', '..y.', ...Array(23).fill('..w.')],
    promise: ['..y.', '.ySy', '..S.', '..S.', '..S.', '..S.', '..S.', '..S.', '..S.', '..S.', '..S.', '..S.', '..S.', '..d.', '.bBBb', '..m.', '..b.'],
    hook: ['.zz.', 'z..z', '...z', '..zx', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.', '..x.']
  };
  const TRINKET = { acorn: ['.m.', 'mmm', 'uuu', '.u.'], jar: ['zzz', 'ttt', 'tTt', 'ttt'], key: ['gg.', 'g.g', 'gg.', '.g.', '.gg'],
    feather: ['..z', '.zz', '.zw', 'zw.', 'w..'], map: ['ppp', 'prp', 'ppr', 'ppp'], purse: ['.g.', 'mmm', 'mgm', 'mmm'] };
  // The other three you can be (game-loop.md, "Choosing who you are"), drawn the same way, 24 x 30, shown x3: the cleric
  // (a bone-white hood and robe, a wine stole with a gold sun, a lantern on a staff), the bandit (a moss-green hood and
  // short cloak, a wine scarf over the face, leather, a long knife and a purse) and the barbarian (wild rust hair and
  // beard, a fur mantle, bare arms, a great axe over the shoulder). Approved on the canvas, row "First start".
  const CLERIC = [
    '..g.........KKKK........', '.KgK.......K1112K.......', 'KoyoK.....K111223K......', 'KywyK.....K1cccc3K......',
    'KoyoK.....K1ceec3K......', '.KgK......K1cEEc3K......', '..w.......K12cc23K......', '..w......KK122233KK.....',
    '..w.....K1112tt2233K....', '..w....K11122tT22333K...', '..wK..K111122tT223333K..', '.KeeK.K11122tggT22333K..',
    '.KeeKK11112tgGgT2233K...', '..w.KK11112ttgTT2233K...', '..w..K1112ttttTT2333K...', '..w..K11122ttTT22333K...',
    '..w..K11122ttTT22333K...', '..w..K111222tT223333K...', '..w.K1111222tT2233333K..', '..w.K1111222tT2233333K..',
    '..w.K111122ttTT2333333K.', '..w.K11112222222333333K.', '..wK111112222222233333K.', '..wK1111122222222333333K',
    '..wK1111122222222333333K', '..w.K111112222222233333K', '..w..KK1112222222233KKK.', '..w....KKKbbaKKbbaKK....',
    '..w......KbbaK.KbbaK....', '.www.....KKKKK.KKKKK....'];
  const BANDIT = [
    '........................', '.........KKKK...........', '........K1122K..........', '.......K112223K.........',
    '.......K1cccc3K.........', '.......K1cycy3K.........', '.......K1tTTt3K.........', '......KK2tTTt33K........',
    '.....K1122tt2233K.......', '....K1122ebbbe2233K.....', '...K1122eebKbbae2333K...', '...K122eebbKbbaae233K...',
    '...K12KebbbKbbaaK233K...', '...K1KsKbbbKbbaKsK33K...', '...KKKsKgggGgggKsKK3K...', '....K.KKellKllaKK.K3K...',
    '....K..KebbKbmmmK.KK....', '.......KebbKbmMmK.zK....', '.......KPPpKpmmmK.zK....', '.......KPPpKpPPK..xK....',
    '.......KPPpKpPPK..KK....', '.......KPPpKpPPK........', '.......KPpK.KpPK........', '.......KPpK.KpPK........',
    '.......KPpK.KpPK........', '.......KPpK.KpPK........', '.......KbaK.KbaK........', '......KbbaK.KbbaK.......',
    '......KffffKffffK.......', '......KKKKKKKKKKK.......'];
  const BARBARIAN = [
    '...................wzz..', '.......KKKK........wZzz.', '......KHhHHK.......wZZzz', '.....KHhHHhHK......wZzz.',
    '.....KheeeehK......wzz..', '.....KhKeeKhK......w....', '.....KheEEehK......w....', '.....KhHHHHhK......w....',
    '......KHhhHK.......w....', '....KKuUUUUuuKK...K.....', '...KuUUuuuuuukkK.Kee....', '...KuUuuKKKuukkKKeEK....',
    '...KeKKllleellKKeEKw....', '..KeeK.leEEEEelKeK.w....', '..KeEK.llEEEEllKK..w....', '..KeEK.lgggGgglK...w....',
    '..KeeK.KbbbKbaaK...w....', '...KK..KbbbKbaaK...w....', '.......KbbbKbbaK...w....', '.......KbbaKbbaK........',
    '.......KPPpKpPPK........', '.......KPPpKpPPK........', '.......KPpK.KpPK........', '.......KePK.KpeK........',
    '.......KeEK.KeEK........', '.......KeEK.KeEK........', '.......KuuK.KuuK........', '......KuUuK.KuUuK.......',
    '......KffffKffffK.......', '......KKKKKKKKKKK.......'];
  const KPAL = { K: '#0b0610', 1: '#3e4458', 2: '#6b7590', 3: '#a8b0c8', 4: '#e0e4f0', r: '#8e2a14', R: '#c4502e', o: '#f0a35a',
    s: '#6b7590', t: '#5e2232', T: '#8a3444', l: '#3a2418', g: '#c8a462', c: '#1a0e1c', C: '#3a1c34', q: '#5a2c4a',
    P: '#3e2a36', p: '#2a1a24', f: '#1e1216' };
  /* Each one: its rows, its palette, which three keys the worn armour recolours (light, mid, dark), where a worn weapon
     goes, and the pixels of its own prop to take away first (columns, and rows kept, such as the hand on the staff). */
  const HEROES = {
    knight: { rows: KNIGHT, pal: { ...KPAL, e: '#8a6a50', b: '#6b4a30', a: '#4a3220' }, armour: 'eba', wx: 1 },
    cleric: { rows: CLERIC, pal: { K: '#0b0610', 1: '#f2e6cc', 2: '#cdbf9c', 3: '#8a7c5c', c: '#1a0e1c', e: '#c89a6a', E: '#8a6040',
      t: '#5e2232', T: '#8a3444', g: '#c8a462', G: '#ffd27a', o: '#f0a35a', y: '#ffd27a', w: '#6b4a30', b: '#6b4a30', a: '#4a3220' },
      armour: '123', wx: 0, prop: { from: 0, to: 4, keep: [11, 12] } },
    bandit: { rows: BANDIT, pal: { K: '#0b0610', 1: '#6a8a52', 2: '#45603a', 3: '#2a3e26', c: '#1a0e1c', y: '#7fd6c2', t: '#5e2232', T: '#8a3444',
      e: '#b98a55', b: '#8a5a32', a: '#5a3a1e', l: '#3a2418', s: '#c89a6a', g: '#6b4a30', G: '#c8a462', m: '#9c6f2c', M: '#e0b878',
      z: '#cfd3de', x: '#6b4a30', P: '#3e2a36', p: '#2a1a24', f: '#1e1216' }, armour: 'eba', wx: 0 },
    barbarian: { rows: BARBARIAN, pal: { K: '#0b0610', H: '#c4502e', h: '#8e2a14', e: '#d4a074', E: '#a2704a', u: '#8a6a50', U: '#c8a880',
      k: '#5a4232', l: '#3a2418', g: '#6b4a30', G: '#c8a462', b: '#8a3444', a: '#5e2232', P: '#3e2a36', p: '#2a1a24', f: '#1e1216',
      z: '#a8b0c8', Z: '#e0e4f0', x: '#5d6680', w: '#6b4a30' }, armour: 'Uuk', wx: 17, prop: { from: 19, to: 23, keep: [] } }
  };
  const HERO_NAME = { knight: 'knight', cleric: 'cleric', bandit: 'bandit', barbarian: 'barbarian' };
  // Draws who you are in what is worn: wear = { armour, weapon, trinket } (item ids). Looks only; gear works the same for all.
  function hero(cls = 'knight', wear = {}, size = 3, label) {
    const H = HEROES[cls] || HEROES.knight, pal = { ...H.pal }, arm = ARMOUR[wear.armour];
    if (arm) [...H.armour].forEach((k, i) => pal[k] = arm[i]);
    const wpn = WEAPON[wear.weapon], tk = TRINKET[wear.trinket];
    let rows = H.rows;
    if (wpn && H.prop) rows = rows.map((r, y) => H.prop.keep.includes(y) ? r : r.split('').map((c, x) => x >= H.prop.from && x <= H.prop.to ? '.' : c).join(''));
    const wpal = { W: '#ecdcbc', y: '#fff0cf', d: '#8a7c5c', m: '#6b4a30', w: '#6b4a30', v: '#5a8a50', g: '#3a6a3a', z: '#cfd3de', x: '#8892ad', b: '#c8a462', B: '#f0c85a', S: '#ffe9b0' };
    const tpal = { m: '#6b4a30', u: '#b98a55', z: '#cfd3de', t: '#4aa898', T: '#7fd6c2', g: '#f0c85a', w: '#8892ad', p: '#ecdcbc', r: '#8e2a14' };
    const body = (wpn ? sprite(wpn, wpal, H.wx, ['blade', 'promise'].includes(wear.weapon) ? 1 : 0) : '') + sprite(rows, pal) + (tk ? sprite(tk, tpal, 13, 19) : '');
    const al = label || 'The ' + (HERO_NAME[cls] || 'knight');
    return `<svg width="${24 * size}" height="${30 * size}" viewBox="0 0 24 30" shape-rendering="crispEdges" role="img" aria-label="${al.replace(/"/g, '&quot;')}">${body}</svg>`;
  }
  const knight = (wear = {}, size = 3) => hero('knight', wear, size);

  const ledge = `<svg viewBox="0 0 78 4" preserveAspectRatio="none" shape-rendering="crispEdges"><polygon points="0,4 0,2 6,2 6,1 13,1 13,3 20,3 20,0 27,0 27,2 35,2 35,1 43,1 43,3 51,3 51,0 58,0 58,2 66,2 66,1 72,1 72,3 78,3 78,4" fill="${C.void}"/></svg>`;
  // The candles' night sky, painted (art/night.py), very dark so the words stay easy to read.
  const stars = `<svg viewBox="0 0 130 282" preserveAspectRatio="xMaxYMin slice"><image href="img/night.png" width="130" height="282" style="image-rendering:pixelated"/></svg>`;
  const motes = `<svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMin slice" shape-rendering="crispEdges"><g fill="#7fd6c2" opacity=".5">${[[40, 120], [350, 150], [62, 520], [330, 470], [300, 96], [24, 300]].map(([x, y]) => px(x, y, 2, 2, '#7fd6c2')).join('')}</g></svg>`;
  const store = { // embers, silver and provisions, 7 x 7 pixel sprites shown x2
    ember: `<svg width="14" height="16" viewBox="0 0 7 8" shape-rendering="crispEdges" aria-hidden="true">${sprite(['...r...', '..ro...', '..oyr..', '.rywyo.', '.oywyo.', 'roo.oor', '.rRRRr.', '..RRR..'], { r: '#c4502e', o: '#f0a35a', y: '#ffd27a', w: '#fff0cf', R: '#5a140e' })}</svg>`,
    silver: `<svg width="14" height="14" viewBox="0 0 7 7" shape-rendering="crispEdges" aria-hidden="true">${sprite(['.kssk..', 'kswSsk.', 'swSSdsk', 'sSSddsk', 'kSddsk.', '.kssk..', '.......'], { k: '#5d6680', s: '#8892ad', S: '#cfd3de', w: '#f4f0fa', d: '#a8b0c8' }, 0, 0)}</svg>`,
    prov: `<svg width="14" height="14" viewBox="0 0 7 7" shape-rendering="crispEdges" aria-hidden="true">${sprite(['..mlm..', '..mgm..', '.uUUuk.', 'uUuuuuk', 'uUuuuuk', 'uuuuukk', '.kkkkk.'], { m: '#6b4a30', l: '#9c6f2c', g: '#c8a462', u: '#b98a55', U: '#e0b878', k: '#5a3a1e' })}</svg>`
  };


  // The star chart: the keep at the centre, one ring per journey length, unexplored places on the outer ring.
  // away = { id, frac }: the knight walks out for the first half of the journey and home for the second.
  const LABEL = { garden: [222, 126, 'start'], mill: [80, 177, 'middle'], ruins: [262, 322, 'middle'] };
  const fmtLen = s => s < 3600 ? (s / 60) + ' min' : (s / 3600) + (s === 3600 ? ' hour' : ' hours');
  function chart(places, sel, away) {
    const cx = 179, cy = 179, txt = (x, y, t, o = '') => `<text x="${x}" y="${y}" font-family="Atkinson Hyperlegible, sans-serif" ${o}>${t}</text>`;
    let h = `<svg viewBox="0 0 358 358" role="img" aria-label="A star chart: the keep at the centre and three rings, one place on each">`;
    h += `<image href="img/chart.png" width="358" height="358" style="image-rendering:pixelated"/>`; // the painted sky and rings (art/chart.py)
    h += `<g fill="#8a82c8" font-size="10" letter-spacing="1.5" text-anchor="middle">${txt(179, 116, 'I')}${txt(179, 71, 'II')}${txt(179, 26, 'III')}</g>`;
    h += `<g fill="#6a62a8" font-size="14" text-anchor="middle">${txt(40, 70, '?')}${txt(330, 190, '?')}${txt(70, 300, '?')}</g>`;
    const a = away && places.find(p => p.id === away.id);
    if (a) h += `<path d="M${cx} ${cy} L${a.x} ${a.y}" stroke="${C.ember}" stroke-width="2" stroke-dasharray="3 4" fill="none"/>`;
    h += `<g shape-rendering="crispEdges">${px(171, 173, 16, 12, C.void)}${px(170, 169, 4, 16, C.ember)}${px(184, 169, 4, 16, C.ember)}${px(176, 164, 6, 21, C.ember)}${px(178, 160, 2, 4, '#ffd27a')}${px(177, 178, 4, 7, C.void)}</g>`;
    h += txt(cx, 204, 'The keep', `fill="${C.bone}" font-size="13" text-anchor="middle"`);
    places.forEach(p => {
      const on = p.id === sel, [lx, ly, an] = LABEL[p.id] || [p.x, p.y + 30, 'middle'];
      h += on ? `<circle cx="${p.x}" cy="${p.y}" r="16" fill="none" stroke="${C.ember}" opacity=".6"/><rect x="${p.x - 7}" y="${p.y - 7}" width="14" height="14" transform="rotate(45 ${p.x} ${p.y})" fill="${C.ember}"/>`
        : `<rect x="${p.x - 5}" y="${p.y - 5}" width="10" height="10" transform="rotate(45 ${p.x} ${p.y})" fill="#1a1636" stroke="#b3add0" stroke-width="1.5"/>`;
      h += txt(lx, ly, p.name.replace(/^The /, ''), `fill="${C.bone}" font-size="15" font-weight="700" text-anchor="${an}"`) + txt(lx, ly + 17, p.len || fmtLen(p.sec), `fill="#c2bde0" font-size="14" text-anchor="${an}"`);
    });
    if (a) { // whoever you are: out, then home
      const t = away.frac < .5 ? away.frac * 2 : (1 - away.frac) * 2, kx = cx + (a.x - cx) * t, ky = cy + (a.y - cy) * t;
      h += `<g shape-rendering="crispEdges" transform="translate(${Math.round(kx - 12)} ${Math.round(ky - 30)})">${sprite(HEROES[away.cls] ? HEROES[away.cls].rows : KNIGHT, (HEROES[away.cls] || HEROES.knight).pal)}</g>`;
    }
    return h + '</svg>';
  }

  /* The interface in pixels (look.md, "Pixel runes and buttons", 9 Nov 2026): the runes, the Offload well, the rail and
     the framed buttons sit on the same x3 grid as the paintings, in the paintings' own ramps (art/pixelkit.py). Words stay
     in the readable typeface; only frames and icons are pixels. */
  const R = {
    gold: ['#24160a', '#3a2410', '#5a3a16', '#7a5420', '#9c6f2c', '#c8a462', '#e6c27a', '#fff1c4'],
    fire: ['#2a0808', '#5a140e', '#8e2a14', '#c4502e', '#f07a3a', '#f0a35a', '#ffd27a', '#fff0cf'],
    stone: ['#07050b', '#0e0b14', '#17121f', '#211a2b', '#2d2438', '#3b3047', '#4c3f57', '#5f5069', '#76667e', '#8f80a0'],
    violet: ['#0b0510', '#120818', '#1e0e2a', '#2c1640', '#3a2050', '#4c2c66'],
    iron: ['#040306', '#0a080e', '#141119', '#1e1a26', '#2c2736', '#3e384a', '#545064'],
    silver: ['#141119', '#1e1a26', '#2c2736', '#3e384a', '#545064', '#6e6a80', '#8e8aa0', '#b4b0c4'],
    teal: ['#031210', '#06201c', '#0c3830', '#145448', '#2a7e6c', '#4aa892', '#7fd6c2', '#d8fff4'],
    wax: ['#2a2218', '#4a3e2c', '#76684e', '#a69a7c', '#d0c6a8', '#ece4cc', '#fff8e6']
  };
  // a step along a ramp (t from 0 to 1), dithered between neighbouring steps
  const ramp = (r, t, x, y) => { t = Math.max(0, Math.min(1, t)) * (r.length - 1); const i = Math.floor(t); return i >= r.length - 1 ? r[r.length - 1] : dith(x, y, t - i) ? r[i + 1] : r[i] };
  const grid = (w, h) => Array.from({ length: h }, () => Array(w).fill(null));
  function gridSvg(g, s, extra = '') {
    let o = '';
    g.forEach((row, y) => { let x = 0; while (x < row.length) { const c = row[x]; if (!c) { x++; continue } let e = x; while (e + 1 < row.length && row[e + 1] === c) e++; o += px(x, y, e - x + 1, 1, c); x = e + 1 } });
    return `<svg width="${g[0].length * s}" height="${g.length * s}" viewBox="0 0 ${g[0].length} ${g.length}" shape-rendering="crispEdges" aria-hidden="true"${extra}>${o}</svg>`;
  }
  const stamp = (g, rows, pal, ox, oy) => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch] && g[oy + y] && x + ox < g[0].length) g[oy + y][ox + x] = pal[ch] }));

  // Rune icons, 7 x 7, from the app's own art: the keep on its spire, a real candle, a star-chart ring, a market stall.
  const RUNE_ICON = {
    keep: lit => [['...a...', '...a...', '..asa..', 'a.aaa.a', 'aasasaa', 'aaa.aaa', 'aaaaaaa'], {}],
    tasks: lit => [['...r...', '..ryr..', '...o...', '..wbk..', '..wbk..', '..wbk..', '.ddddd.'],
      lit ? { o: R.fire[7], y: R.fire[7], r: R.fire[6], w: R.wax[5], b: R.wax[3], k: R.fire[0], d: R.fire[0] }
        : { o: R.fire[5], y: R.fire[7], r: R.fire[3], w: R.wax[5], b: R.wax[3], k: R.wax[1], d: R.iron[5] }],
    journeys: lit => [['..aaa..', '.a...a.', 'a..y..a', 'a.yyy.a', 'a..y..a', '.a...a.', '..aaa..'], { y: lit ? R.fire[7] : R.fire[6] }],
    market: lit => [['.aaaaa.', 'arararr', 'rararar', '.a...a.', '.a.s.a.', '.a.s.a.', 'aaaaaaa'], { r: lit ? R.fire[1] : R.fire[3] }]
  };
  // A rune: a pixel diamond with a stepped gilt edge lit from the upper left. The current one is ember inside and glows
  // with the dithered halo the candle flames use. 25 x 25 (the diamond is 19 across, with room for the glow), drawn x3.
  function rune(name, lit) {
    const N = 25, c = 12, r = 9, g = grid(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const d = Math.abs(x - c) + Math.abs(y - c), tl = x + y < 2 * c;
      if (d > r) { const k = d - r; if (lit && k <= 3 && BAYER4[y & 3][x & 3] < [0, 11, 6, 2][k]) g[y][x] = R.fire[[0, 3, 2, 1][k]]; continue }
      g[y][x] = d === r ? R.gold[0] : d === r - 1 ? R.gold[tl ? (lit ? 7 : 6) : (lit ? 4 : 3)] : d === r - 2 ? R.gold[tl ? (lit ? 6 : 5) : (lit ? 3 : 2)]
        : d === r - 3 ? R.gold[1] : lit ? ramp(R.fire.slice(2, 7), 1 - Math.hypot(x - c, y - c + .8) / (r - 3), x, y)
        : ramp(R.violet.slice(1, 6), .75 - Math.hypot(x - c, y - c + .8) / (r - 3) * .8, x, y);
    }
    const [rows, pal] = RUNE_ICON[name](lit);
    stamp(g, rows, Object.assign(lit ? { a: R.fire[0], s: R.fire[2] } : { a: R.gold[6], s: R.gold[3] }, pal), c - 3, c - 3);
    return gridSvg(g, 3);
  }
  // The Offload sigil: a well mouth seen from above, a coursed stone ring with a gilt rim and teal light rising from deep
  // water, so it ties to the Well it opens. 24 x 24, drawn x3.
  function wellSigil() {
    const D = 24, c = (D - 1) / 2, g = grid(D, D);
    for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
      const r = Math.hypot(x - c, y - c), a = Math.atan2(y - c, x - c), light = Math.cos(a + 2.4);
      if (r > c + .5) continue;
      if (r > c - .6) g[y][x] = R.gold[0];
      else if (r > c - 1.6) g[y][x] = R.gold[light > .4 ? 7 : light > -.2 ? 6 : 4];
      else if (r > c - 2.6) g[y][x] = R.gold[light < 0 ? 2 : 3];
      else if (r > c - 5.6) { // stones in two courses, with dark joints
        const outer = r > c - 4.1, k = (a + Math.PI) / (2 * Math.PI) * 12 + (outer ? .5 : 0);
        g[y][x] = Math.abs(k - Math.round(k)) < .1 || Math.abs(r - (c - 4.1)) < .45 ? R.stone[1] : ramp(R.stone.slice(2, 9), .45 + light * .3 + (Math.floor(k) % 3) * .06, x, y);
      } else if (r > c - 6.6) g[y][x] = R.stone[0];
      else g[y][x] = ramp(R.teal.slice(1), (1 - r / (c - 6.6)) * .95, x, y);
    }
    [[-2, -2], [2, -1], [0, 2], [1, -4]].forEach(([dx, dy]) => g[Math.round(c) + dy][Math.round(c) + dx] = R.teal[7]); // motes of light
    return gridSvg(g, 3);
  }
  // The rail the runes are strung on: a studded gilt bar fading out in dithered steps at both ends. w in pixels (x3).
  function rail(w) {
    const g = grid(w, 3);
    for (let x = 0; x < w; x++) {
      const e = Math.min(x, w - 1 - x); if (e <= 12 && BAYER4[1][x & 3] >= e) continue;
      g[0][x] = R.gold[x & 1 ? 6 : 5]; g[1][x] = R.gold[4]; g[2][x] = R.gold[1];
      if (x % 8 === 4 && e > 6) { g[0][x] = g[1][x] = R.gold[7]; g[2][x] = R.gold[3] }
    }
    return gridSvg(g, 3);
  }
  // A framed button, w x h in pixels (x3): pointed, stepped ends with a diamond on each tip, a dark outline, a one-pixel
  // bevel (light above, dark below) and a dithered fill. Kinds: violet (the usual), ember (the one main action), iron
  // (worn or not yet); "-focus" lights the frame. Small buttons (a candle's tools, Select) have no tips and one gilt line.
  const FILL = { violet: [R.violet.slice(1, 6), .15, .55], ember: [R.fire.slice(1, 7), .05, .45], iron: [R.iron.slice(1, 7), .15, .55] };
  function frame(w, h, kind) {
    const small = kind.startsWith('small-'), focus = kind.endsWith('-focus'), base = kind.replace('small-', '').replace('-focus', '');
    const F = focus ? R.fire : base === 'iron' ? R.silver : base === 'ember' ? R.gold : R.gold.map((_, i) => R.gold[Math.max(0, i - 1)]);
    const [fill, t0, t1] = FILL[base], ox = small ? 0 : 2, W = w - ox * 2, taper = small ? 3 : Math.min(4, Math.max(3, Math.round(h / 5))), mid = (h - 1) / 2, g = grid(w, h);
    for (let y = 0; y < h; y++) {
      const ins = Math.round(taper * Math.abs(y - mid) / mid), x0 = ox + ins, x1 = ox + W - 1 - ins;
      for (let x = x0; x <= x1; x++) {
        g[y][x] = y === 0 || y === h - 1 || x === x0 || x === x1 ? F[0]
          : y === 1 || x === x0 + 1 ? F[y < mid ? 7 : 5] : y === h - 2 || x === x1 - 1 ? F[3]
          : !small && (y === 2 || y === h - 3 || x === x0 + 2 || x === x1 - 2) ? F[1]
          : ramp(fill, t0 + (1 - (y - 2) / Math.max(1, h - 5)) * t1, x, y);
      }
    }
    if (!small) [0, w - 1].forEach(tx => { const cy = Math.floor(mid); [[-1, 0, 6], [0, -1, 4], [0, 1, 4], [1, 0, 2], [0, 0, 7]].forEach(([dy, dx, i]) => { if (g[cy + dy] && tx + dx >= 0 && tx + dx < w) g[cy + dy][tx + dx] = F[i] }) });
    return gridSvg(g, 3, ' xmlns="http://www.w3.org/2000/svg"');
  }
  const runeHtml = name => `<span class="px-rest">${rune(name, false)}</span><span class="px-lit">${rune(name, true)}</span>`;

  const st = (d, w = 2) => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="square" aria-hidden="true">${d}</svg>`;
  const icon = {
    sigil: wellSigil(),
    plus: st('<path d="M12 5v14M5 12h14"/>', 2.6),
    close: st('<path d="M5 5l14 14M19 5L5 19"/>', 2.2),
    back: st('<path d="M15 5l-7 7 7 7"/>', 2.4),
    gear: st('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/><circle cx="12" cy="12" r="6.5"/>', 1.8),
    grip: st('<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>', 3),
    mic: st('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>')
  };

  /* Home's keep in 3D: the keep, its spire and the floating stones sculpted and baked into Gaussian splats with ink-studio
     (art/keep_splat.js writes keep-splat.js), drawn on the painting's own x3 pixel grid over the painted night (img/keep-sky.png,
     the same picture without the keep). Drag to turn it a little; let go and it settles back. Splats are drawn far to near as
     solid dabs (as ink-studio's renderer does), snapped to the scene's palette with ordered dithering, and rimmed by moonlight
     on their upper left like the painting. A woken room's window turns ember. keep3d(el, lit) returns false where it can't
     draw (no canvas, or no data), and Home falls back to the flat painting. */
  const K3 = { D: 60, F: 600, YT: 17, ZT: -0.2, ROW: 112, MAXYAW: 0.42, MAXPITCH: 0.1 };
  let k3 = null;
  // the ramps of the keep's palette (keep_splat_scene.js): rock, keep stone, a dark window, embers, wine, moon-touched edges
  const RAMPS = [[1, 8], [9, 16], [17, 17], [18, 24], [25, 27], [28, 29]], rampOf = i => RAMPS.findIndex(([a, b]) => i >= a && i <= b);
  function k3data() {
    if (k3 && k3.n) return k3;
    if (typeof KEEP_SPLAT === 'undefined') return null;
    const S = KEEP_SPLAT, bin = atob(S.data), n = S.n, P = new Float32Array(n * 3), C = new Float32Array(n * 6),
      col = new Uint8Array(n), win = new Uint8Array(n), ls = S.ls;
    const i16 = o => { const v = bin.charCodeAt(o) | bin.charCodeAt(o + 1) << 8; return v > 32767 ? v - 65536 : v };
    const i8 = o => { const v = bin.charCodeAt(o); return v > 127 ? v - 256 : v };
    for (let i = 0; i < n; i++) {
      const o = i * 14;
      P[i * 3] = i16(o) / 1000; P[i * 3 + 1] = i16(o + 2) / 1000 - K3.YT; P[i * 3 + 2] = i16(o + 4) / 1000 - K3.ZT;
      const a = i8(o + 6) * ls, b = i8(o + 7) * ls, c = i8(o + 8) * ls, d = i8(o + 9) * ls, e = i8(o + 10) * ls, f = i8(o + 11) * ls;
      // L = [[a,0,0],[b,c,0],[d,e,f]], Σ = L Lᵀ: xx xy xz yy yz zz
      C.set([a * a, a * b, a * d, b * b + c * c, b * d + c * e, d * d + e * e + f * f], i * 6);
      col[i] = bin.charCodeAt(o + 12); win[i] = bin.charCodeAt(o + 13);
    }
    const pal = S.pal.map(h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    const ramp = Uint8Array.from(col, c => rampOf(c));
    k3 = { n, P, C, col, win, ramp, pal, order: new Uint32Array(n), key: new Uint16Array(n), CX: new Float32Array(n), CY: new Float32Array(n), CZ: new Float32Array(n) };
    return k3;
  }
  const near = (pal, r, g, b, lo = 1, hi = pal.length - 1) => { let best = lo, bd = 1e9; for (let i = lo; i <= hi; i++) { const p = pal[i], d = (r - p[0]) ** 2 * .3 + (g - p[1]) ** 2 * .55 + (b - p[2]) ** 2 * .15; if (d < bd) { bd = d; best = i } } return best };
  const EMBER = [[240, 163, 90], [255, 224, 160], [196, 80, 46]], HALO = [122, 46, 28];
  // Draws the splats at a turn of yaw, pitch (radians) into a w x h pixel grid; returns ImageData (transparent where no keep)
  function k3draw(ctx, w, h, yaw, pitch, lit) {
    const G = k3data(), { n, P, C, col, win, ramp, pal, order, key, CX, CY, CZ } = G;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    // world -> camera: turn about y by yaw, then about x by pitch
    const R = [cy, 0, sy, sp * sy, cp, -sp * cy, -cp * sy, sp, cp * cy];
    const ox = (w - 130) / 2 + 65, oy = K3.ROW, F = K3.F, D = K3.D;
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      CX[i] = R[0] * x + R[1] * y + R[2] * z; CY[i] = R[3] * x + R[4] * y + R[5] * z; CZ[i] = R[6] * x + R[7] * y + R[8] * z;
    }
    // near first, so what's in front is laid first and covered pixels are skipped: a counting sort on depth in 4096 steps
    const cnt = G.cnt || (G.cnt = new Uint32Array(4097)), BIN = 4095 / 12;
    cnt.fill(0);
    for (let i = 0; i < n; i++) { const b = Math.max(0, Math.min(4095, ((6 - CZ[i]) * BIN) | 0)); key[i] = b; cnt[b + 1]++ }
    for (let b = 0; b < 4096; b++) cnt[b + 1] += cnt[b];
    for (let i = 0; i < n; i++) order[cnt[key[i]]++] = i;
    const N = w * h;
    if (!G.buf || G.buf.N !== N) G.buf = { N, cr: new Float32Array(N), cg: new Float32Array(N), cb: new Float32Array(N), ca: new Float32Array(N), cw: new Uint8Array(N), rp: new Uint8Array(N) };
    const { cr, cg, cb, ca, cw, rp } = G.buf;
    cr.fill(0); cg.fill(0); cb.fill(0); ca.fill(0); cw.fill(0); rp.fill(0);
    for (let k = 0; k < n; k++) {
      const i = order[k], dz = D - CZ[i], iz = 1 / dz, xc = CX[i], yc = CY[i];
      const sx = ox + F * xc * iz, syy = oy - F * yc * iz;
      if (sx < -4 || sx > w + 4 || syy < -4 || syy > h + 4) continue;
      // J R: the screen's two rows of the projection, carried back to the world
      const j0 = F * iz, j2 = F * xc * iz * iz, k1 = -F * iz, k2 = -F * yc * iz * iz;
      const a0 = j0 * R[0] + j2 * R[6], a1 = j0 * R[1] + j2 * R[7], a2 = j0 * R[2] + j2 * R[8];
      const b0 = k1 * R[3] + k2 * R[6], b1 = k1 * R[4] + k2 * R[7], b2 = k1 * R[5] + k2 * R[8];
      const q = i * 6, s00 = C[q], s01 = C[q + 1], s02 = C[q + 2], s11 = C[q + 3], s12 = C[q + 4], s22 = C[q + 5];
      const u0 = s00 * a0 + s01 * a1 + s02 * a2, u1 = s01 * a0 + s11 * a1 + s12 * a2, u2 = s02 * a0 + s12 * a1 + s22 * a2;
      const w0 = s00 * b0 + s01 * b1 + s02 * b2, w1 = s01 * b0 + s11 * b1 + s12 * b2, w2 = s02 * b0 + s12 * b1 + s22 * b2;
      const A = a0 * u0 + a1 * u1 + a2 * u2 + .15, Bq = b0 * u0 + b1 * u1 + b2 * u2, Cc = b0 * w0 + b1 * w1 + b2 * w2 + .15, det = A * Cc - Bq * Bq;
      if (det <= 0) continue;
      const k0 = Cc / det, kk1 = -Bq / det, kk2 = A / det, ex = Math.min(2 * Math.sqrt(A), 40), ey = Math.min(2 * Math.sqrt(Cc), 40);
      const x0 = Math.max(0, Math.floor(sx - ex)), x1 = Math.min(w - 1, Math.ceil(sx + ex)), y0 = Math.max(0, Math.floor(syy - ey)), y1 = Math.min(h - 1, Math.ceil(syy + ey));
      const wn = win[i], on = wn && wn <= lit, c = on ? EMBER[0] : pal[col[i]], rmp = ramp[i];
      for (let y = y0; y <= y1; y++) {
        const dy = y + .5 - syy;
        for (let x = x0; x <= x1; x++) {
          const dx = x + .5 - sx, qq = k0 * dx * dx + kk2 * dy * dy + 2 * kk1 * dx * dy;
          if (qq > 1.94) continue;
          const p = y * w + x, have = ca[p];
          if (have > .98) continue;
          // a solid dab: smoothstep(0.38, 0.62) of the Gaussian, so edges stay crisp
          let a = .99;
          if (qq > .956) { const g = Math.exp(-.5 * qq), t = (g - .38) / .24; a = .99 * t * t * (3 - 2 * t) }
          const k = a * (1 - have); // laid behind what is already there
          cr[p] += c[0] * k; cg[p] += c[1] * k; cb[p] += c[2] * k; ca[p] = have + k;
          if (have < .5 && have + k >= .5) { cw[p] = on ? 2 : wn ? 1 : 0; rp[p] = rmp } // the first solid thing seen here
        }
      }
    }
    const img = ctx.createImageData(w, h), o = img.data;
    const solid = p => ca[p] > .5;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!solid(p)) continue;
      const a = ca[p];
      let r = cr[p] / a, g = cg[p] / a, b = cb[p] / a;
      const t = ((BAYER4[y & 3][x & 3] + .5) / 16 - .5) * 10; // a little ordered noise before snapping to the palette
      let c;
      if (cw[p] === 2) c = (cw[p - w] !== 2 && y > 0) ? EMBER[1] : (cw[p + w] !== 2 ? EMBER[2] : EMBER[0]); // a hot pixel at the top
      else { const [lo, hi] = RAMPS[rp[p]] || RAMPS[0]; c = pal[near(pal, r + t, g + t, b + t, lo, hi)] } // within the ramp of what's in front
      // moonlight catches the keep's upper left edges: two steps up the stone's own ramp (rock 1-8, keep stone 9-16)
      if (cw[p] !== 2 && ((x > 0 && !solid(p - 1)) || (y > 0 && !solid(p - w)))) {
        const ci = pal.indexOf(c), top = ci <= 8 ? 8 : ci <= 16 ? 16 : ci;
        if (ci > 0 && ci !== 17) c = pal[Math.min(ci + 2, top)];
      }
      const q = p * 4; o[q] = c[0]; o[q + 1] = c[1]; o[q + 2] = c[2]; o[q + 3] = 255;
    }
    // stop the night showing through a gap in the stone: a clear pixel with stone either side of it (left and right, or above and
    // below) takes its neighbour's colour; twice, for gaps two pixels wide
    const A = q => q >= 0 && q < N * 4 && o[q + 3];
    for (let pass = 0; pass < 2; pass++) for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const q = (y * w + x) * 4;
      if (o[q + 3]) continue;
      const src = A(q - 4) && (A(q + 4) || (x < w - 2 && A(q + 8))) ? q - 4 : A(q - w * 4) && (A(q + w * 4) || A(q + w * 8)) ? q - w * 4 : -1;
      if (src < 0) continue;
      o[q] = o[src]; o[q + 1] = o[src + 1]; o[q + 2] = o[src + 2]; o[q + 3] = 255;
    }
    // a warm halo round each lit window, on the stone either side of it and above and below
    for (let p = 0; p < N; p++) if (cw[p] === 2) {
      const x = p % w;
      for (const nb of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w])
        if (nb >= 0 && nb < N && o[nb * 4 + 3] && cw[nb] !== 2) { o[nb * 4] = HALO[0]; o[nb * 4 + 1] = HALO[1]; o[nb * 4 + 2] = HALO[2] }
    }
    return img;
  }
  function keep3d(el, lit) {
    let v = el._k3;
    if (!v) {
      let c, ctx;
      try { if (!k3data()) return false; c = document.createElement('canvas'); ctx = c.getContext('2d') } catch (e) { return false }
      if (!ctx) return false;
      const sky = new Image(); sky.src = 'img/keep-sky.png';
      v = el._k3 = { c, ctx, sky, yaw: 0, pitch: 0, vy: 0, held: false, lit, raf: 0, w: 0, h: 0, buf: document.createElement('canvas') };
      c.className = 'keep3d'; c.setAttribute('role', 'img');
      el.innerHTML = ''; el.appendChild(c);
      const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
      const frame = () => {
        v.raf = 0;
        if (!v.held) { // settle back, gently
          const k = still() ? 1 : .12;
          v.yaw -= v.yaw * k; v.pitch -= v.pitch * k;
          if (Math.abs(v.yaw) < .002 && Math.abs(v.pitch) < .002) v.yaw = v.pitch = 0;
        }
        paint3d(v);
        if (!v.held && (v.yaw || v.pitch)) v.raf = requestAnimationFrame(frame);
      };
      v.kick = () => { if (!v.raf) v.raf = requestAnimationFrame(frame) };
      let sx = 0, sy = 0, y0 = 0, p0 = 0;
      c.addEventListener('pointerdown', e => { v.held = true; sx = e.clientX; sy = e.clientY; y0 = v.yaw; p0 = v.pitch; try { c.setPointerCapture(e.pointerId) } catch (er) { } });
      c.addEventListener('pointermove', e => {
        if (!v.held) return;
        const lim = (x, m) => Math.max(-m, Math.min(m, x));
        v.yaw = lim(y0 + (e.clientX - sx) * .005, K3.MAXYAW); v.pitch = lim(p0 + (e.clientY - sy) * .002, K3.MAXPITCH);
        v.kick();
      });
      const up = () => { if (v.held) { v.held = false; v.kick() } };
      c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up); c.addEventListener('lostpointercapture', up);
      sky.onload = () => v.kick();
      addEventListener('resize', () => v.kick());
      // the first time, it turns a little and settles, so it's plain the keep can be turned
      if (!still()) v.yaw = .22;
    }
    v.lit = lit;
    v.c.setAttribute('aria-label', `A keep on a stone spire under a huge ringed moon, a river of embers below, ${lit} of 8 windows lit. Drag to turn it.`);
    v.kick();
    return true;
  }
  function paint3d(v) {
    const el = v.c.parentNode; if (!el) return;
    const w = Math.max(1, Math.ceil(el.clientWidth / 3)), h = Math.max(1, Math.ceil(el.clientHeight / 3));
    if (w !== v.w || h !== v.h) { v.w = v.c.width = v.buf.width = w; v.h = v.c.height = v.buf.height = h; v.c.style.width = w * 3 + 'px'; v.c.style.height = h * 3 + 'px' }
    const { ctx } = v, ox = Math.round((w - 130) / 2 - v.yaw * 8), oy = Math.round(v.pitch * 10);
    ctx.fillStyle = '#050309'; ctx.fillRect(0, 0, w, h);
    if (v.sky.complete && v.sky.naturalWidth) ctx.drawImage(v.sky, ox, oy); // the night shifts a little the other way: it's far off
    const img = k3draw(ctx, w, h, v.yaw, v.pitch, v.lit), b = v.buf.getContext('2d');
    b.putImageData(img, 0, 0);
    ctx.drawImage(v.buf, 0, 0);
  }

  return { keep, keep3d, room, candle, arch, knight, hero, HEROES: Object.keys(HEROES), chart, ledge, stars, motes, store, icon, runeHtml, rail, frame };
})();
