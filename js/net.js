// Two-phone play. Both phones share one maze. Each phone writes its own spot in the maze (only when it
// steps into a new space), its status, and "found my key"; events carry scrolls, gems picked up, snipped walls, and "won".
//
// Backends:
//   firebase : real play across phones. Needs CONFIG.firebase (see README → Two-phone play).
//   local    : add ?local to the URL to test with two tabs of the same browser, no internet needed.
//
// Room layout:  rooms/CODE = { level, started, players: { host: {...}, guest: {...} }, events: { id: {...} } }
const Net = (() => {
  // ~120 friendly 4-letter words. Every game gets its own: a code is claimed in one step (see claim()), so groups
  // starting at the same moment never share one, and a code frees up again once its game is over.
  const CODE_WORDS = ('MOSS FERN LEAF ROOT SEED BARK PINE WREN OWLS BEES DEWY LILY SAGE MINT BUDS VINE POND HILL NEST PLUM KIWI LARK DOVE STAR MOON GLOW RAIN MIST SNOW BOLT ' +
    'ACORN TWIG BUSH REED KELP CLAY SAND DUNE CAVE PEAK LAKE COVE TIDE WAVE GUST WIND HAZE DAWN DUSK NOON ' +
    'FROG TOAD NEWT MOTH WASP SWAN DEER HARE MOLE VOLE LAMB CALF FAWN FOAL PUMA LYNX SEAL CRAB CLAM KOI ' +
    'ROSE IRIS ARUM FIGS PEAR LIME KALE CORN OATS RICE BEAN PEAS NUTS HONEY JAM TEAL GOLD JADE RUBY OPAL ' +
    'RUNE ORBS WAND BELL HARP DRUM KITE BOAT RAFT DOCK MAPS PATH GATE DOOR ARCH TOWER LAMP WICK GEMS KEYS ' +
    'PUFF ZOOM ZING HOOT CHIP BLIP TWIN DUET PALS CREW TEAM JOLLY COSY SNUG WARM SOFT KIND BRAVE BOLD WISH').split(' ').filter(w => /^[A-Z]{4}$/.test(w));
  const NICKNAMES = ['Wren','Pip','Moss','Fern','Clover','Juniper','Sorrel','Bryony','Hazel','Rowan','Sprig','Thistle'];
  const pick = list => list[Math.floor(Math.random() * list.length)];

  let backend = null, code = null, role = null, level = 0, myName = '', joinedAt = 0;
  let playersCb = null, eventsCb = null, lastPlayers = {};

  // ---------- Firebase backend ----------
  function firebaseBackend(){
    if (!window.firebase || !CONFIG.firebase) return null;
    if (!firebase.apps.length) firebase.initializeApp(CONFIG.firebase);
    const db = firebase.database();
    let offset = 0; db.ref('.info/serverTimeOffset').on('value', s => { offset = s.val() || 0; });
    const room = c => db.ref('rooms/' + c);
    let offs = [];
    return {
      name: 'firebase',
      now: () => Date.now() + offset,
      async get(c){ const s = await room(c).get(); return s.exists() ? s.val() : null; },
      async claim(c, data, free){ const r = await room(c).transaction(cur => (cur === null || free(cur)) ? data : undefined); return r.committed; },
      async set(c, data){ await room(c).set(data); },
      async update(c, path, patch){ await room(c).child(path).update(patch); },
      async push(c, ev){ await room(c).child('events').push({ ...ev, t: firebase.database.ServerValue.TIMESTAMP }); },
      presence(c, r){ const ref = room(c).child('players/' + r + '/online'); ref.set(true); ref.onDisconnect().set(false); },
      watch(c, onRoom, onEvent, since){
        const r1 = room(c), h1 = r1.on('value', s => onRoom(s.val() || {}));
        const r2 = room(c).child('events'), h2 = r2.on('child_added', s => { const ev = s.val(); if (ev && ev.t >= since) onEvent(ev); });
        offs.push(() => r1.off('value', h1), () => r2.off('child_added', h2));
      },
      unwatch(){ offs.forEach(f => f()); offs = []; }
    };
  }

  // ---------- local test backend (two tabs, same browser) ----------
  function localBackend(){
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('faeriecharm-local') : null;
    const key = c => 'fc-room-' + c;
    const read = c => { try { return JSON.parse(localStorage.getItem(key(c))); } catch (e) { return null; } };
    const write = (c, v) => { localStorage.setItem(key(c), JSON.stringify(v)); bc && bc.postMessage(c); fire(c); };
    let watchers = [];
    const fire = c => watchers.forEach(w => w.c === c && w.tick());
    bc && (bc.onmessage = e => fire(e.data));
    // the other tab's write can land after its message, so re-check when storage itself changes
    addEventListener('storage', e => { if (e.key && e.key.startsWith('fc-room-')) fire(e.key.slice(8)); });
    const setPath = (obj, path, patch) => { let o = obj; path.split('/').forEach(p => { o[p] = o[p] || {}; o = o[p]; }); Object.assign(o, patch); };
    return {
      name: 'local',
      now: () => Date.now(),
      async get(c){ return read(c); },
      async claim(c, data, free){ const cur = read(c); if (cur && !free(cur)) return false; write(c, data); return true; },
      async set(c, data){ write(c, data); },
      async update(c, path, patch){ const v = read(c) || {}; setPath(v, path, patch); write(c, v); },
      async push(c, ev){ const v = read(c) || {}; v.events = v.events || {}; v.events['e' + Date.now() + Math.random().toString(36).slice(2, 6)] = { ...ev, t: Date.now() }; write(c, v); },
      presence(c, r){ this.update(c, 'players/' + r, { online: true }); addEventListener('pagehide', () => this.update(c, 'players/' + r, { online: false })); },
      watch(c, onRoom, onEvent, since){
        const seen = new Set();
        const w = { c, tick(){ const v = read(c) || {}; onRoom(v); Object.entries(v.events || {}).sort((a, b) => a[1].t - b[1].t).forEach(([id, ev]) => { if (!seen.has(id)){ seen.add(id); if (ev.t >= since) onEvent(ev); } }); } };
        watchers.push(w); w.tick();
      },
      unwatch(){ watchers = []; }
    };
  }

  function getBackend(){
    if (backend) return backend;
    const wantLocal = /[?&]local\b/.test(location.search) || location.hash === '#local';   // #local works in the Claude preview too
    backend = wantLocal ? localBackend() : firebaseBackend();
    return backend;
  }

  function watchRoom(){
    backend.unwatch();
    backend.watch(code, v => { lastPlayers = v.players || {}; playersCb && playersCb(lastPlayers, v); }, ev => { if (ev.from !== role && eventsCb) eventsCb(ev); }, joinedAt);
  }

  return {
    available: () => !!getBackend(),
    get role(){ return role; }, get code(){ return code; }, get level(){ return level; }, get myName(){ return myName; },
    friendRole: () => role === 'host' ? 'guest' : 'host',

    async createRoom(lv, name){
      const b = getBackend(); role = 'host'; level = lv; myName = name || pick(NICKNAMES); code = null;
      // a code is free if nobody's hosting it, its game has been left by both players, or it's over 3 hours old
      const now = b.now(), free = r => { const p = r.players || {}, on = k => p[k] && p[k].online;
        return !on('host') && !on('guest') || now - (r.created || 0) > 3*3600e3; };
      const fresh = { level, started: false, created: now, players: { host: { name: myName, status: 'solving', half: false, won: false, online: true } } };
      const order = CODE_WORDS.slice().sort(() => Math.random() - 0.5);
      for (let i = 0; i < Math.min(order.length, 40) && !code; i++) if (await b.claim(order[i], fresh, free)) code = order[i];
      if (!code) throw new Error('So many games right now! Try again in a minute.');
      joinedAt = now;
      b.presence(code, 'host'); watchRoom();
      return { code, name: myName };
    },

    async joinRoom(c, name){
      const b = getBackend(); c = String(c || '').trim().toUpperCase();
      if (!/^[A-Z]{4}$/.test(c)) return { error: 'Codes are 4 letters, like MOSS.' };
      const v = await b.get(c);
      if (!v || !v.players || !v.players.host || !v.players.host.online) return { error: `No game called ${c} right now. Check the code with your friend.` };
      if (v.players.guest && v.players.guest.online) return { error: 'That game already has two players.' };
      code = c; role = 'guest'; level = v.level || 0;
      if (name) myName = name; else do { myName = pick(NICKNAMES); } while (myName === v.players.host.name);
      joinedAt = b.now();
      await b.update(code, 'players/guest', { name: myName, status: 'solving', half: false, won: false, online: true });
      b.presence(code, 'guest'); watchRoom();
      return { code, level, name: myName, friendName: v.players.host.name };
    },

    onPlayers(cb){ playersCb = cb; if (code) cb(lastPlayers, {}); },
    onEvents(cb){ eventsCb = cb; },
    setMine(patch){ if (code) backend.update(code, 'players/' + role, patch); },
    setRoom(patch){ if (code) backend.update(code, '', patch); },
    send(ev){ if (code) backend.push(code, { ...ev, from: role }); },
    leave(){ if (!code) return; backend.update(code, 'players/' + role, { online: false }); backend.unwatch(); code = null; role = null; playersCb = eventsCb = null; lastPlayers = {}; }
  };
})();
