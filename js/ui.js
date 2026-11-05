// Shared pieces: saved progress, charm icons, the hanging bracelet, small helpers.

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// ---------- saved progress (lives in this browser only) ----------
const SAVE_KEY = 'faeriecharm.v1';
function newProfile(){
  return { gems: 0, owned: { peek: true }, boost: ['peek', null, null, null, null], style: [null, null, null, null, null], done: [], duoDone: [] };
}
const Profile = {
  data: newProfile(),
  load(){ try { const raw = localStorage.getItem(SAVE_KEY); if (raw) this.data = Object.assign(newProfile(), JSON.parse(raw)); } catch (e) {} },
  save(){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) {} },
  reset(){ const name = this.data.name; this.data = newProfile(); if (name) this.data.name = name; this.save(); },
  addGems(n){ this.data.gems = Math.max(0, this.data.gems + n); this.save(); renderGemPills(); },
  owns(id){ return !!this.data.owned[id]; },
  give(id){ this.data.owned[id] = true; this.equip(id); this.save(); },
  slots(id){ return CONFIG.charms[id].type === 'boost' ? this.data.boost : this.data.style; },
  isOn(id){ return this.slots(id).includes(id); },
  equip(id){ const s = this.slots(id); if (s.includes(id)) return true; const i = s.indexOf(null); if (i < 0) return false; s[i] = id; this.save(); return true; },
  unequip(id){ const s = this.slots(id), i = s.indexOf(id); if (i >= 0) s[i] = null; this.save(); },
  unlocked(level){ return level === 0 || this.data.done.includes(level - 1); }
};
Profile.load();

function renderGemPills(){ $$('.gem-count').forEach(el => el.textContent = Profile.data.gems); }

// ---------- charm icons (34×34) ----------
const ICON = {
  peek:   '<path d="M3 17C8 9 13 6 17 6s9 3 14 11c-5 8-10 11-14 11S8 25 3 17Z" fill="none" stroke="#1a1a1a" stroke-width="3" stroke-linejoin="round"/><circle cx="17" cy="17" r="5" fill="#1a1a1a"/>',
  dash:   '<path d="M9 17h15M18 11l6 6-6 6M4 12h4M4 22h4" fill="none" stroke="#1a1a1a" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
  snip:   '<circle cx="9" cy="24" r="4.5" fill="none" stroke="#1a1a1a" stroke-width="2.8"/><circle cx="25" cy="24" r="4.5" fill="none" stroke="#1a1a1a" stroke-width="2.8"/><path d="M12 21 26 6M22 21 8 6" stroke="#1a1a1a" stroke-width="2.8" stroke-linecap="round"/>',
  glow:   '<circle cx="17" cy="17" r="6" fill="none" stroke="#1a1a1a" stroke-width="2.8"/><path d="M17 3v4M17 27v4M3 17h4M27 17h4M7 7l3 3M24 24l3 3M27 7l-3 3M10 24l-3 3" stroke="#1a1a1a" stroke-width="2.6" stroke-linecap="round"/>',
  leaf:   '<path d="M7 27C7 14 15 7 28 6c0 13-8 21-21 21Z" fill="#c4c4c4" stroke="#1a1a1a" stroke-width="2.4" stroke-linejoin="round"/><path d="M7 27 20 14" stroke="#1a1a1a" stroke-width="2.2" stroke-linecap="round"/>',
  star:   '<path d="M17 4l3.8 8 8.7 1-6.4 6 1.7 8.6L17 23.4 9.2 27.6l1.7-8.6-6.4-6 8.7-1Z" fill="#ffffff" stroke="#1a1a1a" stroke-width="2.4" stroke-linejoin="round"/>',
  moon:   '<path d="M21 5a12 12 0 1 0 8 19A10 10 0 0 1 21 5Z" fill="#c4c4c4" stroke="#1a1a1a" stroke-width="2.4" stroke-linejoin="round"/>',
  shroom: '<path d="M5 18a12 11 0 0 1 24 0Z" fill="#c4c4c4" stroke="#1a1a1a" stroke-width="2.4" stroke-linejoin="round"/><path d="M13 18v8a4 3 0 0 0 8 0v-8" fill="#fff" stroke="#1a1a1a" stroke-width="2.4"/><circle cx="12" cy="13" r="2" fill="#fff"/><circle cx="20" cy="11" r="2.4" fill="#fff"/>',
  friend: '<path d="M16 5a12 12 0 0 0 0 24Z" fill="#1a1a1a"/><path d="M18 5a12 12 0 0 1 0 24Z" fill="#9a9a9a"/>'
};
const hasArt = id => !!(CONFIG.charms[id] && CONFIG.charms[id].art);
// charm picture: the charm's art if it has some (drawn a bit taller, since it includes its ring), otherwise the line icon
const icon = (id, size) => hasArt(id)
  ? `<img class="charm-art" src="${CONFIG.charms[id].art}" alt="" draggable="false" style="height:${Math.round(size * 1.35)}px">`
  : `<svg width="${size}" height="${size}" viewBox="0 0 34 34" aria-hidden="true">${ICON[id] || ''}</svg>`;
const GEM = s => `<img class="gem-img" src="art/gem.webp" width="${s}" height="${s}" alt="">`;

// ---------- the hanging bracelet (5 boost slots dangling from the gold chain art) ----------
// The chain image is 230px wide and drawn 50px above the bracelet box, so its top runs off the top of the screen.
// Each charm hangs on a short gold drop from the chain. ARC_CHARMS = charm centers; ARC_DROPS = where each drop meets the chain.
const ARC_CHARMS = [[42, 41], [78.5, 48], [115, 54], [151.5, 48], [188, 41]];
const ARC_DROPS = [3.5, 21.0, 41.0, 21.5, 3.5];
function braceletArcSvg(slots){
  let s = '<svg class="arc-art" width="230" height="70" viewBox="0 0 230 70" style="overflow:visible" aria-hidden="true"><image href="art/chain.webp" x="0" y="-50" width="230" height="100.5"/>';
  ARC_CHARMS.forEach(([x,y], i) => {
    const art = slots[i] && hasArt(slots[i]), top = art ? y - 20 : y - 14, from = Math.max(ARC_DROPS[i] - 3, -2);
    if (top - from > 2) s += `<path d="M${x} ${from}V${top}" stroke="#8a6a24" stroke-width="3.5"/><path d="M${x} ${from}V${top}" stroke="#e0c27a" stroke-width="1.5"/>`;
    if (art) return;   // charm art brings its own rings, so no jump ring or circle
    s += `<circle cx="${x}" cy="${top}" r="3" fill="#e0c27a" stroke="#8a6a24" stroke-width="1.5"/>`;
    s += slots[i] ? `<circle cx="${x}" cy="${y}" r="14" fill="#fff" stroke="#8a6a24" stroke-width="3"/>`
                  : `<circle cx="${x}" cy="${y}" r="13" fill="rgba(255,255,255,.8)" stroke="#b8954a" stroke-width="2" stroke-dasharray="4 3"/>`;
  });
  return s + '</svg>';
}
// fills a .arc element; interactive=true makes each charm a button (used in the maze)
function renderArc(el, slots, interactive){
  let html = braceletArcSvg(slots);
  slots.forEach((id, i) => {
    if (!id) return;
    const [x,y] = ARC_CHARMS[i];
    html += interactive
      ? `<button class="charm" data-charm="${id}" style="left:${x-22}px;top:${y-22}px" aria-label="Use ${esc(CONFIG.charms[id].name)}">${hasArt(id) ? icon(id, 31) : icon(id, 18)}<span class="badge" hidden></span></button>`
      : `<span class="charm" style="left:${x-22}px;top:${y-22}px">${hasArt(id) ? icon(id, 31) : icon(id, 18)}</span>`;
  });
  el.innerHTML = html;
}

// ---------- the big hanging bracelet (top of the map and the maze) ----------
// The gold chain with 4 charms hanging off it (the middle two a bit lower). The first 4 boost charms you wear.
// x / top are in the chain image's own units (230 × 100.5): where each charm's ring hooks onto the chain.
const HANG = [{x:30, top:22}, {x:87, top:53}, {x:143, top:53}, {x:200, top:22}];
const hangSlots = boost => { const s = boost.filter(Boolean).slice(0, HANG.length); while (s.length < HANG.length) s.push(null); return s; };
function renderHang(el, slots, interactive){
  let h = '<img class="hang-chain" src="art/chain.webp" alt="" draggable="false">';
  HANG.forEach((p, i) => {
    const id = slots[i], pos = `left:${(p.x/230*100).toFixed(2)}%;top:${(p.top/100.5*100).toFixed(2)}%`;
    if (!id){ h += `<span class="hang-empty" style="${pos}" aria-hidden="true"></span>`; return; }
    h += interactive
      ? `<button class="charm hang-charm" data-charm="${id}" style="${pos}" aria-label="Use ${esc(CONFIG.charms[id].name)}">${icon(id, 40)}<span class="badge" hidden></span></button>`
      : `<span class="charm hang-charm" style="${pos}">${icon(id, 40)}</span>`;
  });
  el.innerHTML = h;
}

// ---------- sound ----------
// Two music tracks: "Quest Begins" on the loading screen, map and menus, and the maze music inside a level.
// Switching screens crossfades between them. Effects play over the music (it dips while the key, buy or power-up sound plays).
// Volumes go through Web Audio gain, because iPhones ignore an <audio> element's own volume.
// Phones only allow sound after a tap: the game tries to start the music straight away, and if the phone says no,
// the loading screen waits for "Tap to start" (see app.js), and that tap starts it.
const Sound = (() => {
  // iPhones mute Web Audio when the ring/silent switch is on silent; "playback" tells Safari (16.4+) this is
  // media like a video, so the game is heard even on a silenced phone. Older browsers just ignore it.
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  const TRACK_VOL = { menu: 0.065, maze: 0.04 };   // menu track is a quieter recording, so it gets a bit more gain
  // effect volumes are set so each lands at a similar, soft loudness (the clips themselves vary a lot)
  const FX_VOL = { key: 0.06, gem: 1, powerup: 0.056, buy: 0.28, enter: 0.098, maze: 0.128 };
  const mk = src => { const a = new Audio(src); a.preload = 'auto'; return a; };
  // effects: <audio> elements are only a fallback. iPhones refuse to start an <audio> that wasn't started by a tap,
  // so gem and key sounds (which play when you touch them in the maze, not on a tap) are played from decoded
  // Web Audio buffers instead, which can play any time once the first tap has unlocked the audio.
  const FX_SRC = { key: 'sound/key-found.mp3', gem: 'sound/gem.mp3?v=2', powerup: 'sound/powerup.mp3', buy: 'sound/buy-charm.mp3', enter: 'sound/enter-chime.mp3?v=2', maze: 'sound/enter-maze.mp3' };
  const buffers = {}, fxGain = {};
  const fx = { key: mk('sound/key-found.mp3'), gem: mk('sound/gem.mp3?v=2'), powerup: mk('sound/powerup.mp3'), buy: mk('sound/buy-charm.mp3'), enter: mk('sound/enter-chime.mp3?v=2'), maze: mk('sound/enter-maze.mp3') };
  const tracks = { menu: mk('sound/menu-music.mp3?v=2'), maze: mk('sound/bg-music.mp3') };
  Object.values(tracks).forEach(t => t.loop = true);
  const gains = {}; let cur = 'menu', level = 1;   // level = how loud the current track is relative to its normal volume
  const music = () => tracks[cur];
  const shine = mk('sound/bracelet-shine.mp3'); shine.loop = true;   // sparkly loop while you look at your bracelet
  const SHINE_VOL = 0.2; let shineGain = null, shineOn = false, shineStop;
  let ctx = null, playing = false;
  const AC = window.AudioContext || window.webkitAudioContext;
  function route(el, vol){   // send an element through its own gain node (falls back to el.volume)
    if (!ctx){ el.volume = vol; return null; }
    try { const g = ctx.createGain(); g.gain.value = vol; ctx.createMediaElementSource(el).connect(g); g.connect(ctx.destination); return g; }
    catch (e){ el.volume = vol; return null; }
  }
  function setup(){
    if (ctx !== null || !AC) return;
    try { ctx = new AC(); } catch (e) { ctx = false; return; }
    Object.keys(tracks).forEach(k => gains[k] = route(tracks[k], k === cur ? TRACK_VOL[k] * level : 0));
    shineGain = route(shine, 0);
    Object.keys(fx).forEach(k => fx[k].volume = FX_VOL[k]);   // fallback only (until the buffers have loaded)
    if (ctx) Object.keys(FX_SRC).forEach(k => {
      const g = ctx.createGain(); g.gain.value = FX_VOL[k]; g.connect(ctx.destination); fxGain[k] = g;
      fetch(FX_SRC[k]).then(r => r.arrayBuffer()).then(data => new Promise((ok, no) => {
        const p = ctx.decodeAudioData(data, ok, no); if (p && p.then) p.then(ok, no);   // older Safari only has the callback form
      })).then(b => { buffers[k] = b; }).catch(() => {});
    });
  }
  // keep the audio unlocked: iPhones can pause it (a call, another app), and only a tap may wake it again
  const wake = () => { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); };
  if (!AC){ Object.keys(tracks).forEach(k => tracks[k].volume = TRACK_VOL[k]); Object.keys(fx).forEach(k => fx[k].volume = FX_VOL[k]); }
  const on = () => Profile.data.music !== false;
  const fadeTrack = (k, v, t = 0.15) => { if (gains[k]) gains[k].gain.setTargetAtTime(v, ctx.currentTime, t); else tracks[k].volume = v; };
  const setMusicVol = m => { level = m; fadeTrack(cur, TRACK_VOL[cur] * m); };
  // try to start the music; resolves true if it's actually playing
  function start(){
    if (!on() || document.hidden) return Promise.resolve(false);
    setup(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    try {
      const p = music().play();
      return (p && p.then ? p : Promise.resolve()).then(() => { playing = !(ctx && ctx.state === 'suspended'); return playing; }, () => (playing = false));
    } catch (e) { return Promise.resolve(false); }
  }
  // switch between the menu and maze music: the old one fades out, the new one fades in from the top
  function track(name){
    if (name === cur || !tracks[name]) return;
    const old = cur; cur = name;
    fadeTrack(old, 0, 0.3); setTimeout(() => { if (cur !== old) tracks[old].pause(); }, 1200);
    if (!gains[name]) tracks[name].volume = TRACK_VOL[name] * level; else gains[name].gain.value = 0;
    try { tracks[name].currentTime = 0; } catch (e) {}
    if (playing) { start(); fadeTrack(name, TRACK_VOL[name] * level, 0.3); }
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => addEventListener(ev, () => { setup(); wake(); if (!playing || music().paused) start(); }, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.hidden){ music().pause(); playing = false; } else start(); });
  let duck;
  const fadeShine = v => { if (shineGain) shineGain.gain.setTargetAtTime(v, ctx.currentTime, 0.25); else shine.volume = v; };
  return {
    start, track,
    // the bracelet screen's shimmer: fades in over the (quieter) music, fades out when you leave
    shimmer(onScreen){
      if (onScreen === shineOn) return; shineOn = onScreen; clearTimeout(shineStop);
      if (onScreen){
        setup(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
        if (!shineGain) shine.volume = SHINE_VOL;
        try { shine.currentTime = 0; const p = shine.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}
        fadeShine(SHINE_VOL); setMusicVol(0.5);
      } else { fadeShine(0); setMusicVol(1); shineStop = setTimeout(() => shine.pause(), 1200); }
    },
    play(name){ const a = fx[name]; if (!a) return; setup(); wake();
      let len = a.duration;
      if (buffers[name] && ctx){   // the reliable way: a fresh buffer source each time (overlapping gems are fine)
        try { const src = ctx.createBufferSource(); src.buffer = buffers[name]; src.connect(fxGain[name]); src.start(); len = buffers[name].duration; }
        catch (e) { try { a.currentTime = 0; a.play().catch(() => {}); } catch (e2) {} }
      } else { try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
      // the music steps back while the key, buy or power-up sound plays, then comes back when it ends
      const dip = { key: 0.3, powerup: 0, buy: 0.3 }[name];
      if (dip !== undefined){ setMusicVol(dip); clearTimeout(duck);
        const back = () => { clearTimeout(duck); setMusicVol(shineOn ? 0.5 : 1); };
        duck = setTimeout(back, ((len || 6) + 0.5) * 1000); } },
    get musicOn(){ return on(); },
    setMusic(v){ Profile.data.music = v; Profile.save(); if (v) start(); else { music().pause(); playing = false; } }
  };
})();

// ---------- little helpers ----------
let toastT;
function say(text){ const c = $('#callout'); c.textContent = text; c.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => c.classList.remove('show'), 2200); }
