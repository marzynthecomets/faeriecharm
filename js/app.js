// Screen flow: Load → Map → Entry → (Friend) → Game → Level complete → Stall / Bracelet.
(() => {
let FRIEND = CONFIG.friendName;   // the scripted friend, or the real friend's nickname after a two-phone game
let entryLevel = 0, lastResult = null, stallTab = 'boost', stallPick = 'dash', bracePick = 'peek';

function go(name){
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === 'scr-' + name));
  renderGemPills();
  (render[name] || (() => {}))();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b){ e.preventDefault(); go(b.dataset.go); } });

const render = {};

// ---------- load ----------
render.load = () => {
  const bar = $('#loadBar'); bar.style.width = '0%';
  requestAnimationFrame(() => requestAnimationFrame(() => bar.style.width = '100%'));
  clearTimeout(render.load.t); render.load.t = setTimeout(() => go('map'), 1700);
};
$('#scr-load').addEventListener('click', () => { clearTimeout(render.load.t); go('map'); });

// ---------- map ----------
// Each level sits on a gate in the map art (positions in js/config.js → map.gates).
function gateBadge(state, n){
  if (state === 'locked') return '<svg width="22" height="24" viewBox="0 0 22 24" aria-hidden="true"><rect x="3" y="10" width="16" height="12" rx="2" fill="#fff"/><path d="M6 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="#fff" stroke-width="2.6"/></svg>';
  if (state === 'done') return '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M6 13.5l5 5 9-10" fill="none" stroke="#1a1a1a" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return String(n);
}
render.map = () => {
  if (Net.code) Net.leave();   // back on the map = the two-phone game is over
  const M = CONFIG.map, art = $('#mapArt');
  if (art.getAttribute('src') !== M.image) art.src = M.image;
  const st = $('#mapStage'); st.style.width = M.width + 'px'; st.style.height = M.height + 'px';
  const cs = $('.cloud-stall'); cs.style.left = M.stall.x + 'px'; cs.style.top = M.stall.y + 'px';
  renderHang($('#mapArc'), hangSlots(Profile.data.boost), false);
  const wrap = $('#levelSpots'); wrap.innerHTML = '';
  CONFIG.levels.forEach((lv, i) => {
    const g = M.gates[i]; if (!g) return;
    const state = Profile.data.done.includes(i) ? 'done' : Profile.unlocked(i) ? 'open' : 'locked';
    const b = document.createElement('button');
    b.className = 'gate ' + state;
    Object.assign(b.style, { left: (g.x - g.w/2) + 'px', top: (g.y - g.h/2) + 'px', width: g.w + 'px', height: g.h + 'px' });
    b.setAttribute('aria-label', `Level ${i+1}, ${lv.name}${state === 'locked' ? ', locked. Finish the level before it to open' : state === 'done' ? ', finished. Play again' : '. Play'}`);
    b.innerHTML = `<span class="gate-badge">${gateBadge(state, i+1)}</span><span class="gate-label">${state === 'locked' ? 'Locked' : esc(lv.name)}</span>`;
    b.onclick = () => { if (state === 'locked'){ say('Finish the level before this one to open it'); return; } entryLevel = i; go('entry'); };
    wrap.appendChild(b);
  });
  fitStage();
};
// Fit the map between the hanging bracelet and the bottom of the screen so every gate (badge on top, name below)
// is fully visible, however short the phone's browser window is. The art fills the width; if a very short
// screen needs it smaller, a sliver of the dark background shows at the sides.
function fitStage(){
  const scr = $('#scr-map'), st = $('#mapStage'); if (!scr.classList.contains('on')) return;
  const M = CONFIG.map, r = scr.getBoundingClientRect(), W = r.width, H = r.height;
  const chainW = Math.min(W * 0.62, 300), charmH = Math.min(W * 0.25, 118, H * 0.14);
  const charmsBottom = chainW / 2.288 * 0.716 - 4 + charmH;                   // bottom of the lower middle charm
  const top = Math.min(...M.gates.map(g => g.y - g.h/2 - 42));               // highest gate badge, in art pixels
  const bottom = Math.max(...M.gates.map(g => g.y + g.h/2 + 56));            // lowest gate name tag
  const fit = (H - 14 - charmsBottom) / (bottom - top);                        // largest scale that shows every gate
  const s = Math.min(fit, Math.max(W / M.width, (H - charmsBottom + 40) / M.height));
  const y = Math.max(charmsBottom + 8 - top * s, H - M.height * s);           // no gap at the bottom when there's room
  st.style.transform = `translate(${(W - M.width*s)/2}px, ${y}px) scale(${s})`;
  $('#mapFade').style.height = (Math.max(0, y) + 56) + 'px';
}
addEventListener('resize', fitStage);

// settings
$('#settingsBtn').onclick = () => { $('#resetBtn').textContent = 'Reset my progress'; $('#resetBtn').dataset.armed = ''; $('#settingsOv').hidden = false; };
$('#settingsClose').onclick = () => { $('#settingsOv').hidden = true; };
$('#resetBtn').onclick = e => {
  const b = e.currentTarget;
  if (!b.dataset.armed){ b.dataset.armed = '1'; b.textContent = 'Tap again to erase gems, charms, and levels'; return; }
  Profile.reset(); $('#settingsOv').hidden = true; render.map(); renderGemPills(); say('Progress reset');
};

// ---------- level entry ----------
render.entry = () => {
  const lv = CONFIG.levels[entryLevel];
  $('#entryNum').textContent = `Level ${entryLevel + 1}`;
  $('#entryName').textContent = lv.name;
  $('#entryBlurb').textContent = lv.blurb;
  $('#entryReward').textContent = CONFIG.levelReward;
  const bg = $('#entryBg'), scr = $('#scr-entry');
  scr.classList.toggle('has-art', !!lv.entryArt); bg.hidden = !lv.entryArt;
  if (lv.entryArt && bg.getAttribute('src') !== lv.entryArt) bg.src = lv.entryArt;
  fitEntry();
};
// Lay the level screen out on the door art itself: the text sits inside the door, the play button on the path
// below it, and the art is scaled and nudged so the whole thing fits above the "Play with a friend" button.
function fitEntry(){
  const scr = $('#scr-entry'), lv = CONFIG.levels[entryLevel], D = lv.entryDoor, bg = $('#entryBg'), card = $('.entry-card'), play = $('#entryPlay');
  [bg, card, play].forEach(el => el.removeAttribute('style'));
  if (!scr.classList.contains('on') || !lv.entryArt || !D) return;
  const r = scr.getBoundingClientRect(), W = r.width, H = r.height, [iw, ih] = D.image;
  const friendTop = H - 36 - 64 - 14;                                   // keep clear of the friend button
  const s = Math.max(W / iw, H / ih);                                   // always fill the screen
  const tx = W/2 - D.play[0]*s;                                         // the door's centre on the screen's centre
  // slide the art up so the play button sits just above the friend button (short screens crop leaves off the top)
  const ty = Math.min(0, Math.max(H - ih*s, friendTop - (D.play[1] + D.playSize/2)*s));
  Object.assign(bg.style, { inset: 'auto', objectFit: 'fill', width: iw*s + 'px', height: ih*s + 'px', left: tx + 'px', top: ty + 'px' });
  Object.assign(card.style, { left: tx + D.text[0]*s + 'px', top: ty + D.text[1]*s + 'px', width: (D.text[2] - D.text[0])*s + 'px', height: (D.text[3] - D.text[1])*s + 'px', transform: 'none', padding: '0' });
  const ps = Math.min(D.playSize*s, 170);
  Object.assign(play.style, { width: ps + 'px', left: (D.play[0] - D.text[0])*s + 'px', top: (D.play[1] - D.text[1])*s - ps/2 + 'px', bottom: 'auto' });
}
addEventListener('resize', () => { if ($('#scr-entry').classList.contains('on')) fitEntry(); });
function play(mode, live){
  go('game');
  FRIEND = live ? live.friendName : CONFIG.friendName;
  Game.start({ level: live ? live.level : entryLevel, mode, live: !!live, friendName: FRIEND, onWin: finished, onLeave: () => { Net.leave(); go('map'); } });
}
$('#entryPlay').onclick = () => play('solo');

// ---------- pick a friend ----------
render.friend = () => {
  const on = Net.available();
  $('#liveBox').hidden = !on; $('#liveOff').hidden = on; $('#hostBtn').disabled = !on; $('#joinBtn').disabled = !on;
};

// ---------- two phones (js/net.js) ----------
// One kid taps "Start a game" and gets a 4-letter code; the other types it in. Both jump into the maze together.
let roomMode = null, roomStarting = false, roomFriend = null;
function enterRoom(mode){ roomMode = mode; go('room'); }
$('#hostBtn').onclick = () => enterRoom('host');
$('#joinBtn').onclick = () => enterRoom('join');
$('#roomBack').onclick = () => { Net.leave(); go('friend'); };
render.room = () => {
  roomStarting = false; roomFriend = null;
  const host = roomMode === 'host';
  $('#roomTitle').textContent = host ? 'Start a game' : 'Join a game';
  $('#roomHost').hidden = !host; $('#roomJoin').hidden = host; $('#joinActions').hidden = host; $('#codeGo').disabled = false;
  $('#roomTip').innerHTML = host ? 'Show this code to your friend. When they type it in, you both jump into the maze!' : 'Ask your friend for their <b style="white-space:nowrap">4-letter code</b> and type it here.';
  $('#roomYou').textContent = ''; $('#joinMsg').textContent = ''; $('#joinMsg').className = 'fc-wait';
  $('#roomWait').textContent = 'Waiting for your friend…'; $('#roomWait').className = 'fc-wait';
  Net.leave();
  if (host){
    $('#roomCode').textContent = '····';
    Net.createRoom(entryLevel).then(r => {
      $('#roomCode').textContent = r.code; $('#roomYou').textContent = `Your faerie name is ${r.name}`;
      Net.onPlayers(p => { if (p.guest && p.guest.online && !roomStarting) startLive(p.guest.name); });
    }).catch(err => { $('#roomWait').textContent = err.message || "Couldn't make a game. Check the internet and try again."; });
  } else { $('#codeInput').value = ''; setTimeout(() => $('#codeInput').focus(), 50); }
};
$('#codeInput').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
$('#codeInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#codeGo').click(); });
$('#codeGo').onclick = async () => {
  const m = $('#joinMsg'); m.className = 'fc-wait'; m.textContent = 'Looking…'; $('#codeGo').disabled = true;
  try {
    const r = await Net.joinRoom($('#codeInput').value);
    if (r.error){ m.textContent = r.error; m.className = 'fc-wait err'; $('#codeGo').disabled = false; return; }
    $('#roomYou').textContent = `Your faerie name is ${r.name}`;
    startLive(r.friendName);
  } catch (err){ m.textContent = "Couldn't connect. Check the internet and try again."; m.className = 'fc-wait err'; $('#codeGo').disabled = false; }
};
function startLive(friendName){
  roomStarting = true; roomFriend = friendName;
  const el = roomMode === 'host' ? $('#roomWait') : $('#joinMsg');
  el.textContent = `${friendName} is here! Starting…`; el.className = 'fc-wait ok';
  Net.onPlayers(p => Game.netPlayers(p[Net.friendRole()]));
  Net.onEvents(ev => { if (ev.type === 'hi') hiFromFriend(ev.emoji); else Game.netEvent(ev); });
  setTimeout(() => play('duo', { friendName, level: Net.level }), 1200);
}

// ---------- level complete ----------
function finished(r){
  const d = Profile.data, firstTime = !d.done.includes(r.level);
  if (firstTime) d.done.push(r.level);
  let newFriendCharm = false;
  if (r.mode === 'duo'){ if (!d.duoDone.includes(r.level)) d.duoDone.push(r.level); if (!Profile.owns('friend')){ Profile.give('friend'); newFriendCharm = true; } }
  Profile.addGems(CONFIG.levelReward);
  lastResult = { ...r, newFriendCharm, live: !!Net.code };
  go('win');
}
render.win = () => {
  const r = lastResult, lv = CONFIG.levels[r.level], duo = r.mode === 'duo';
  // step 1: "You did it!"
  $('#callout').classList.remove('show');   // don't leave "The door opens!" floating over the faerie
  $('#winStep1').hidden = false; $('#winStep2').hidden = true; $('#winStep3').hidden = true;
  $('#winTitle').textContent = 'You did it!';
  $('#winSub').innerHTML = duo ? `You and <b>${esc(FRIEND)}</b> opened the ${esc(lv.name)}!` : `${esc(lv.name)} completed!`;
  $('#winHigh').hidden = !duo; $('#winHighLabel').textContent = `High five ${FRIEND}`; $('#hiReply').textContent = '';
  const t = Math.round(r.time), mm = Math.floor(t/60), ss = String(t%60).padStart(2,'0');
  $('#winStats').textContent = [`${mm}:${ss}`, `${r.gemsFound} found`].concat(duo ? [`${r.sent} scrolls sent`, `${r.received} received`] : []).join(' · ');
  sparkBurst($('#winSparks'));   // a burst of sparkles out from behind the faerie
  replay($('#winStep1'));
  // step 2 content (shown after Continue)
  const earned = CONFIG.levelReward + (r.gemsFound || 0), cheapest = Math.min(...Object.values(CONFIG.charms).map(c => c.price).filter(p => p > 0));
  $('#winGemCount').dataset.to = earned;
  $('#winGemNote').textContent = Profile.data.gems >= cheapest ? "You can buy a new charm at Bramble's stall." : `Save ${cheapest - Profile.data.gems} more for a charm at Bramble's stall.`;
  // a new Friendship charm gets its own celebration after the gems, so the gems screen just says Continue
  const newCharm = duo && r.newFriendCharm;
  $('#winFriendRow').hidden = !duo || newCharm; $('#winGemActions').hidden = newCharm; $('#winGemNext').hidden = !newCharm;
  $('#winFriendSub').innerHTML = `You and <b>${esc(FRIEND)}</b> each got one for finishing together. It's on your bracelet!`;
  $('#winFriendIcon').innerHTML = icon('friend', 22);
  $('#winFriendNote').innerHTML = r.newFriendCharm ? `<b>New!</b> A Friendship charm. ${esc(FRIEND)} has the matching half.` : `You and ${esc(FRIEND)} both wear the Friendship charm.`;
};
function sparkBurst(el, n = 26){
  el.innerHTML = '';
  for (let i = 0; i < n; i++){
    const a = (i / n) * Math.PI * 2 + Math.random()*0.3, d = 110 + Math.random()*120, e = document.createElement('i');
    e.style.cssText = `--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d}px;--d:${(Math.random()*0.35).toFixed(2)}s;--s:${(0.6 + Math.random()*0.9).toFixed(2)}`;
    el.appendChild(e);
  }
}
$('#winToFriend').onclick = () => { $('#winStep2').hidden = true; const st = $('#winStep3'); st.hidden = false; sparkBurst($('#winSparks3'), 32); replay(st); };
function replay(el){ el.classList.remove('play'); void el.offsetWidth; el.classList.add('play'); }
$('#winContinue').onclick = () => {
  $('#winStep1').hidden = true; const st = $('#winStep2'); st.hidden = false; replay(st);
  const out = $('#winGemCount'), to = +out.dataset.to || 0, reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce){ out.textContent = to; return; }
  out.textContent = 0; const t0 = performance.now() + 650;
  const tick = now => { const k = Math.max(0, Math.min(1, (now - t0) / 900)); out.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1 && !st.hidden) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
};
$$('[data-hi]').forEach(b => b.onclick = () => {
  const e = b.dataset.hi; $('#hiReply').textContent = `Sent ${e} to ${FRIEND}…`;
  if (lastResult && lastResult.live){ Net.send({type:'hi', emoji:e}); return; }
  setTimeout(() => { $('#hiReply').textContent = `${FRIEND}: ${e}${e} best team!!`; }, 1400);
});
function hiFromFriend(e){ if ($('#scr-win').classList.contains('on')) $('#hiReply').textContent = `${FRIEND} sent ${e}!`; }

// ---------- stall ----------
// where charms hang on the stall art's two ropes, in % of the stall image (x, y of the ring top).
// The stall is shown zoomed in, so only roughly x 22-80% of the image is on screen.
const STALL_SPOTS = [[31,36.5],[49,38.5],[67,36.5],[40,56],[58,56]];
let stallFresh = true;   // nothing is picked when you walk up to the stall
render.stall = () => {
  if (stallFresh){ stallPick = null; stallFresh = false; }
  $$('#stallTabs [role="tab"]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === stallTab)));
  const ids = stallTab === 'boost' ? CONFIG.stallBoost : [...CONFIG.stallStyle, ...(Profile.owns('friend') ? ['friend'] : [])];
  if (stallPick && !ids.includes(stallPick)) stallPick = null;
  const wrap = $('#stallCharms'); wrap.innerHTML = '';
  ids.slice(0, STALL_SPOTS.length).forEach((id, i) => {
    const [x, y] = STALL_SPOTS[i], c = CONFIG.charms[id], owned = Profile.owns(id), b = document.createElement('button');
    b.className = 'stall-charm' + (id === stallPick ? ' picked' : '') + (owned ? ' owned' : '');
    b.style.left = x + '%'; b.style.top = y + '%'; b.style.setProperty('--sway', (i % 2 ? -1 : 1) * (1.2 + i*0.3) + 'deg');
    b.setAttribute('aria-pressed', String(id === stallPick));
    b.setAttribute('aria-label', `${c.name}${owned ? ', owned' : c.price == null ? ', earned with a friend' : `, ${c.price} gems`}`);
    b.innerHTML = `<span class="charm-glow" aria-hidden="true"></span><span class="art-hang">${icon(id, 40)}</span><span class="price">${owned ? '✓ Owned' : c.price == null ? 'Friend' : c.price + ' ' + GEM(12)}</span>`;
    b.onclick = () => { stallPick = stallPick === id ? null : id; render.stall(); };
    wrap.appendChild(b);
  });
  const buy = $('#buyBtn'), label = buy.querySelector('span'), tile = $('#stallPreview');
  if (!stallPick){
    tile.hidden = true; buy.hidden = true;
    $('#brambleTitle').textContent = stallTab === 'boost' ? 'Welcome, little faerie!' : 'Ooh, pretty things!';
    $('#brambleSay').textContent = stallTab === 'boost' ? 'Boost charms help you in the maze. Tap one to take a look.' : 'Style charms make your bracelet sparkle. Tap one to take a look.';
    return;
  }
  const c = CONFIG.charms[stallPick], owned = Profile.owns(stallPick), need = (c.price || 0) - Profile.data.gems;
  tile.hidden = false; tile.innerHTML = icon(stallPick, 44);
  $('#brambleTitle').textContent = `Ooh, the ${c.name} charm!`;
  $('#brambleSay').textContent = c.say;
  buy.hidden = false;
  if (owned){ buy.disabled = true; label.textContent = 'You have this one ✓'; }
  else if (c.price == null){ buy.disabled = true; label.textContent = 'Earn it with a friend'; }
  else if (need > 0){ buy.disabled = true; label.innerHTML = `Need ${need} more ${GEM(18)}`; }
  else { buy.disabled = false; label.innerHTML = `Buy for ${c.price} gem${c.price > 1 ? 's' : ''}`; }
};
$$('#stallTabs [role="tab"]').forEach(t => t.onclick = () => { stallTab = t.dataset.tab; stallPick = null; render.stall(); });
$('#buyBtn').onclick = () => {
  const c = CONFIG.charms[stallPick]; if (!stallPick || Profile.owns(stallPick) || c.price == null || Profile.data.gems < c.price) return;
  Profile.addGems(-c.price); Profile.give(stallPick); renderGemPills();
  bracePick = stallPick; render.stall();
  // Bramble says it in her bubble, so no pop-up covers it
  $('#brambleTitle').textContent = `Yay! The ${c.name} charm is yours!`;
  $('#brambleSay').textContent = Profile.isOn(stallPick) ? "I put it on your bracelet." : 'Your bracelet is full, so it\'s waiting in your charms.';
};
document.addEventListener('click', e => { if (e.target.closest('[data-go="stall"]')) stallFresh = true; }, true);

// ---------- bracelet (3D: drag to spin and tilt, tap a charm to see it) ----------
// 10 spots around the band, boost and style taking turns (boost spots 0-4, style spots 0-4).
// The band is drawn as gold links around a tilted circle; charms hang straight down from it.
const BR = { rot: 0, tilt: 0.5, vRot: 0, target: null, sel: null, idle: true, imgs: {}, hits: [], drag: null, raf: 0, last: 0 };
const BR_SPOTS = Array.from({length: 10}, (_, i) => ({ type: i % 2 ? 'style' : 'boost', index: i >> 1, ang: i * Math.PI * 2 / 10 }));
const brImg = src => { if (!BR.imgs[src]){ const im = new Image(); im.src = src; BR.imgs[src] = im; } return BR.imgs[src]; };
let braceSel = null;   // null | { spot }  (spot = index into BR_SPOTS)

render.bracelet = () => {
  braceSel = null; BR.idle = true; BR.target = null; BR.vRot = 0;
  Object.values(CONFIG.charms).forEach(c => c.art && brImg(c.art));
  $('#braceHint').classList.remove('gone');
  braceCard(); braceSize();
  cancelAnimationFrame(BR.raf); BR.last = performance.now(); BR.raf = requestAnimationFrame(braceLoop);
};
function braceSize(){
  const st = $('#braceStage'), cv = $('#braceCanvas'), r = st.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  if (!r.width) return;
  cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
  BR.w = r.width; BR.h = r.height; BR.dpr = dpr;
}
addEventListener('resize', () => { if ($('#scr-bracelet').classList.contains('on')) braceSize(); });

// 3D → screen. The band lies flat (y = 0); tilt tips it toward you; F = how strong the perspective is.
function brGeom(){
  const W = BR.w, H = BR.h, R = Math.min(W * 0.4, H * 0.36, 200), charmH = R * 0.66;
  const st = Math.sin(BR.tilt), cy = H/2 - charmH * 0.6;
  return { W, H, R, charmH, cx: W/2, cy, F: R * 5.5, st, ct: Math.cos(BR.tilt) };
}
function brProj(g, x, y, z){   // returns screen x, y, perspective scale, depth (bigger = closer)
  const yy = y * g.ct - z * g.st, zz = y * g.st + z * g.ct, s = g.F / (g.F + zz);
  return { x: g.cx + x * s, y: g.cy + yy * s, s, near: -zz };
}
const brPoint = (g, a) => brProj(g, g.R * Math.sin(a), 0, -g.R * Math.cos(a));   // a = 0 is the front

function braceLoop(t){
  if (!$('#scr-bracelet').classList.contains('on')) return;
  const dt = Math.min(0.05, (t - BR.last) / 1000); BR.last = t;
  if (!BR.drag){
    if (BR.target !== null){
      let d = BR.target - BR.rot; d = Math.atan2(Math.sin(d), Math.cos(d));
      BR.rot += d * Math.min(1, dt * 7); if (Math.abs(d) < 0.002){ BR.rot = BR.target; BR.target = null; }
    } else if (Math.abs(BR.vRot) > 0.02){ BR.rot += BR.vRot * dt; BR.vRot *= Math.pow(0.04, dt); }
    else if (BR.idle && !matchMedia('(prefers-reduced-motion: reduce)').matches) BR.rot += dt * 0.25;
  }
  braceDraw(t / 1000);
  BR.raf = requestAnimationFrame(braceLoop);
}

function braceDraw(time){
  const cv = $('#braceCanvas'), ctx = cv.getContext('2d'), g = brGeom(), d = Profile.data;
  ctx.setTransform(BR.dpr, 0, 0, BR.dpr, 0, 0); ctx.clearRect(0, 0, g.W, g.H);
  // soft golden light behind the bracelet
  const glow = ctx.createRadialGradient(g.cx, g.cy + g.R * 0.25, 0, g.cx, g.cy + g.R * 0.25, g.R * 1.6);
  glow.addColorStop(0, 'rgba(255,214,110,.22)'); glow.addColorStop(1, 'rgba(255,214,110,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, g.W, g.H);
  const items = [];
  // chain links
  const N = 46;
  for (let i = 0; i < N; i++){
    const a = i / N * Math.PI * 2 + BR.rot, p = brPoint(g, a), q = brPoint(g, a + 0.02);
    const tx = q.x - p.x, ty = q.y - p.y, tl = Math.hypot(tx, ty) || 1;
    // the link's short side: along the band's radius (flat links) or straight up (standing links)
    const flat = i % 2 === 0;
    const m = flat ? brProj(g, g.R * 1.03 * Math.sin(a), 0, -g.R * 1.03 * Math.cos(a)) : brProj(g, g.R * Math.sin(a), g.R * 0.03, -g.R * Math.cos(a));
    const mx = m.x - p.x, my = m.y - p.y, perp = Math.abs(mx * ty - my * tx) / tl / (g.R * 0.03);
    items.push({ z: p.near, kind: 'link', p, ang: Math.atan2(ty, tx), long: (Math.PI * 2 * g.R / N) * 0.95 * p.s, short: Math.max(0.16, Math.min(1, perp)) * g.R * 0.075 * p.s });
  }
  // charms + empty spots
  BR_SPOTS.forEach((sp, i) => {
    const a = sp.ang + BR.rot, p = brPoint(g, a), id = d[sp.type][sp.index];
    items.push({ z: p.near - 0.5, kind: 'charm', p, i, id, sp, a });
  });
  items.sort((A, B) => A.z - B.z);
  BR.hits = [];
  for (const it of items){
    const shade = 0.5 + 0.5 * Math.max(0, Math.min(1, (it.z / g.R + 1) / 2));   // back is darker
    if (it.kind === 'link') brLink(ctx, it, shade);
    else brCharm(ctx, g, it, shade, time);
  }
}
function brLink(ctx, it, shade){
  ctx.save(); ctx.translate(it.p.x, it.p.y); ctx.rotate(it.ang);
  const rx = it.long * 0.62, ry = Math.max(1.2, it.short), w = Math.max(1.4, it.long * 0.2);
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.lineWidth = w + 2; ctx.strokeStyle = `rgba(70,46,10,${0.9})`; ctx.stroke();
  const gr = ctx.createLinearGradient(0, -ry - w, 0, ry + w);
  gr.addColorStop(0, '#fbe7a1'); gr.addColorStop(0.45, '#d9ad4f'); gr.addColorStop(1, '#8c6420');
  ctx.lineWidth = w; ctx.strokeStyle = gr; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.6); ctx.lineWidth = Math.max(0.8, w * 0.3); ctx.strokeStyle = 'rgba(255,250,220,.85)'; ctx.stroke();
  if (shade < 1){ ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); ctx.lineWidth = w + 2; ctx.strokeStyle = `rgba(12,24,16,${(1 - shade) * 0.9})`; ctx.stroke(); }
  ctx.restore();
}
// a darker copy of a charm for the back of the bracelet (shading only the charm, not the box around it)
const BR_TMP = document.createElement('canvas');
function brShaded(im, shade){
  const c = BR_TMP, x = c.getContext('2d'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  x.globalCompositeOperation = 'source-over'; x.clearRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'source-atop'; x.fillStyle = `rgba(12,24,16,${(1 - shade) * 0.85})`; x.fillRect(0, 0, c.width, c.height);
  return c;
}
function brCharm(ctx, g, it, shade, time){
  const { p, id, i } = it, picked = braceSel && braceSel.spot === i, sway = Math.sin(time * 1.6 + i * 1.3) * 0.05;
  const topY = p.y + g.R * 0.035 * p.s;
  ctx.save(); ctx.translate(p.x, topY); ctx.rotate(sway);
  if (id && CONFIG.charms[id].art){
    const im = brImg(CONFIG.charms[id].art), h = g.charmH * p.s, w = im.naturalWidth ? h * im.naturalWidth / im.naturalHeight : h * 0.7;
    if (picked){ const gl = ctx.createRadialGradient(0, h * 0.55, 0, 0, h * 0.55, h * 0.8); gl.addColorStop(0, `rgba(255,224,110,${0.75 + 0.2 * Math.sin(time * 4)})`); gl.addColorStop(1, 'rgba(255,214,90,0)'); ctx.fillStyle = gl; ctx.fillRect(-h, -h * 0.3, h * 2, h * 1.8); }
    if (im.complete && im.naturalWidth){
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8 * p.s; ctx.shadowOffsetY = 4 * p.s;
      ctx.drawImage(shade < 0.98 ? brShaded(im, shade) : im, -w/2, -h * 0.02, w, h); ctx.shadowColor = 'transparent';
    }
    BR.hits.push({ i, x: p.x - w/2, y: topY, w, h, z: it.z });
  } else {
    // empty spot: a dashed ring on a short gold drop, with a little boost / style mark
    const r = g.charmH * 0.2 * p.s, cy = r * 1.9;
    ctx.globalAlpha = 0.45 + 0.55 * shade;
    ctx.strokeStyle = '#c9a24e'; ctx.lineWidth = 2 * p.s; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, cy - r); ctx.stroke();
    ctx.setLineDash([4 * p.s, 3 * p.s]); ctx.strokeStyle = picked ? '#fff3b0' : 'rgba(240,214,140,.95)'; ctx.lineWidth = (picked ? 3 : 2) * p.s;
    ctx.fillStyle = picked ? 'rgba(255,224,110,.3)' : 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.arc(0, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(244,239,226,.85)'; ctx.beginPath();
    const k = r * 0.5;
    if (it.sp.type === 'boost'){ ctx.moveTo(k*0.15, cy - k); ctx.lineTo(-k*0.55, cy + k*0.15); ctx.lineTo(0, cy + k*0.15); ctx.lineTo(-k*0.15, cy + k); ctx.lineTo(k*0.55, cy - k*0.15); ctx.lineTo(0, cy - k*0.15); }
    else { for (let j = 0; j < 8; j++){ const aa = j * Math.PI / 4, rr = j % 2 ? k * 0.32 : k; ctx.lineTo(Math.sin(aa) * rr, cy - Math.cos(aa) * rr); } }
    ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    BR.hits.push({ i, x: p.x - r * 1.3, y: topY, w: r * 2.6, h: cy + r * 1.3, z: it.z });
  }
  ctx.restore();
}

// drag to spin (sideways) and tilt (up and down); a quick tap picks a charm
(() => {
  const cv = $('#braceCanvas');
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    BR.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 };
    BR.vRot = 0; BR.target = null; BR.idle = false; $('#braceHint').classList.add('gone');
  });
  cv.addEventListener('pointermove', e => {
    const dr = BR.drag; if (!dr || e.pointerId !== dr.id) return;
    const dx = e.clientX - dr.x, dy = e.clientY - dr.y, now = performance.now(), g = brGeom();
    BR.rot += dx / g.R * 0.9; BR.tilt = Math.max(0.22, Math.min(1.05, BR.tilt + dy * 0.004));
    BR.vRot = 0.8 * BR.vRot + 0.2 * (dx / g.R * 0.9) / Math.max(0.008, (now - dr.t) / 1000);
    dr.x = e.clientX; dr.y = e.clientY; dr.t = now; dr.moved = Math.max(dr.moved, Math.hypot(e.clientX - dr.sx, e.clientY - dr.sy));
  });
  const up = e => {
    const dr = BR.drag; if (!dr || e.pointerId !== dr.id) return; BR.drag = null;
    if (performance.now() - dr.t > 80) BR.vRot = 0;   // let go after stopping: no spin
    if (dr.moved < 8){
      BR.vRot = 0;
      const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const hit = BR.hits.filter(h => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h).sort((a, b) => b.z - a.z)[0];
      braceTap(hit ? hit.i : null);
    }
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
})();
function braceTap(i){
  braceSel = i === null || (braceSel && braceSel.spot === i) ? null : { spot: i };
  if (braceSel) BR.target = -BR_SPOTS[i].ang;   // spin it round to the front
  braceCard();
}

// the bottom 30%: what's picked, and what you can do with it
function braceCard(){
  const card = $('#braceCard'), d = Profile.data;
  const worn = t => d[t].filter(Boolean).length;
  if (!braceSel){
    card.innerHTML = `<div class="bc-row"><div class="bc-text"><div class="eyebrow">YOUR BRACELET</div><div class="h3">Spin it round!</div>
      <div class="body">Drag to spin, then tap a charm to see what it does. Boost ${worn('boost')}/5 · Style ${worn('style')}/5</div></div></div>
      <button class="px-btn blue" data-go="stall"><span>Get more charms</span></button>`;
    return;
  }
  const sp = BR_SPOTS[braceSel.spot], id = d[sp.type][sp.index];
  if (id){
    const c = CONFIG.charms[id], inMaze = sp.type === 'boost' && hangSlots(d.boost).includes(id);
    card.innerHTML = `<div class="bc-row"><div class="preview-tile">${icon(id, 44)}</div><div class="bc-text">
      <div class="bc-name"><span class="h3">${esc(c.name)}</span><em class="bc-tag ${c.type}">${c.type === 'boost' ? 'Boost' : 'Style'}</em></div>
      <div class="body">${esc(c.say)}</div>${sp.type === 'boost' ? `<div class="bc-note">${inMaze ? 'Comes into the maze with you' : 'Only your first 3 boost charms come into the maze'}</div>` : ''}</div></div>
      <button class="px-btn green" id="braceOff"><span>Take it off</span></button>`;
    $('#braceOff').onclick = () => { Profile.unequip(id); braceCard(); };
    return;
  }
  const label = sp.type, choices = Object.keys(CONFIG.charms).filter(k => CONFIG.charms[k].type === label && Profile.owns(k) && !Profile.isOn(k));
  card.innerHTML = `<div class="bc-text"><div class="eyebrow">EMPTY ${label.toUpperCase()} SPOT</div><div class="h3">${choices.length ? `Pick a ${label} charm` : `No ${label} charms to add`}</div>
    ${choices.length ? '' : `<div class="body">Bramble sells ${label} charms at her stall.</div>`}</div>
    ${choices.length ? `<div class="bc-tray">${choices.map(k => `<button class="bc-choice" data-put="${k}">${icon(k, 40)}<span>${esc(CONFIG.charms[k].name)}</span></button>`).join('')}</div>`
      : `<button class="px-btn blue" data-go="stall"><span>Visit Bramble's stall</span></button>`}`;
  $$('#braceCard [data-put]').forEach(b => b.onclick = () => { const k = b.dataset.put; d[sp.type][sp.index] = k; Profile.save(); braceCard(); });
}

go('load');
})();
