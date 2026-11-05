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
  $('#liveBox').hidden = !Net.available();
  $('#friendAnjInitial').textContent = FRIEND[0];
  $('#friendAnjName').textContent = FRIEND;
  const list = $('#otherFriends'); list.innerHTML = '';
  CONFIG.otherFriends.forEach(f => {
    const row = document.createElement('div'); row.className = 'friend-row';
    row.innerHTML = `<div class="avatar big">${esc(f.name[0])}</div><div class="friend-info"><b>${esc(f.name)}</b><span>${esc(f.status)}</span></div><button class="pill-btn">Invite</button>`;
    row.querySelector('button').onclick = () => say(`Invite sent to ${f.name}! (Playtest: only ${FRIEND} can play now)`);
    list.appendChild(row);
  });
};
$('#friendPlay').onclick = () => play('duo');

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
  $('#roomHost').hidden = !host; $('#roomJoin').hidden = host;
  $('#roomTip').innerHTML = host ? 'Show this code to your friend. When they type it in, you both jump into the maze!' : 'Ask your friend for their <b>4-letter code</b> and type it here.';
  $('#roomYou').textContent = ''; $('#joinMsg').textContent = ''; $('#joinMsg').className = 'caption';
  $('#roomWait').textContent = 'Waiting for your friend…'; $('#roomWait').className = 'caption';
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
  const m = $('#joinMsg'); m.className = 'caption'; m.textContent = 'Looking…';
  try {
    const r = await Net.joinRoom($('#codeInput').value);
    if (r.error){ m.textContent = r.error; m.className = 'caption err'; return; }
    $('#roomYou').textContent = `Your faerie name is ${r.name}`;
    startLive(r.friendName);
  } catch (err){ m.textContent = "Couldn't connect. Check the internet and try again."; m.className = 'caption err'; }
};
function startLive(friendName){
  roomStarting = true; roomFriend = friendName;
  const el = roomMode === 'host' ? $('#roomWait') : $('#joinMsg');
  el.textContent = `${friendName} is here! Starting…`; el.className = 'caption ok';
  Net.onPlayers(p => Game.netPlayers(p[Net.friendRole()]));
  Net.onEvents(ev => { if (ev.type === 'hi') hiFromFriend(ev.emoji); else Game.netEvent(ev); });
  setTimeout(() => play('duo', { friendName, level: Net.level }), 1200);
}
$('#addFriend').onclick = () => say("Scan each other's codes in person. Coming after playtesting!");

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
  $('#winStep1').hidden = false; $('#winStep2').hidden = true;
  $('#winTitle').textContent = 'You did it!';
  $('#winSub').innerHTML = duo ? `You and <b>${esc(FRIEND)}</b> opened the ${esc(lv.name)}!` : `${esc(lv.name)} completed!`;
  $('#winHigh').hidden = !duo; $('#winHighLabel').textContent = `High five ${FRIEND}`; $('#hiReply').textContent = '';
  const t = Math.round(r.time), mm = Math.floor(t/60), ss = String(t%60).padStart(2,'0');
  $('#winStats').textContent = [`${mm}:${ss}`, `${r.gemsFound} found`].concat(duo ? [`${r.sent} scrolls sent`, `${r.received} received`] : []).join(' · ');
  const sp = $('#winSparks'); sp.innerHTML = '';   // a burst of sparkles out from behind the faerie
  for (let i = 0; i < 26; i++){
    const a = (i / 26) * Math.PI * 2 + Math.random()*0.3, d = 110 + Math.random()*120, e = document.createElement('i');
    e.style.cssText = `--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d}px;--d:${(Math.random()*0.35).toFixed(2)}s;--s:${(0.6 + Math.random()*0.9).toFixed(2)}`;
    sp.appendChild(e);
  }
  replay($('#winStep1'));
  // step 2 content (shown after Continue)
  const earned = CONFIG.levelReward + (r.gemsFound || 0), cheapest = Math.min(...Object.values(CONFIG.charms).map(c => c.price).filter(p => p > 0));
  $('#winGemCount').dataset.to = earned;
  $('#winGemNote').textContent = Profile.data.gems >= cheapest ? "You can buy a new charm at Bramble's stall." : `Save ${cheapest - Profile.data.gems} more for a charm at Bramble's stall.`;
  $('#winFriendRow').hidden = !duo;
  $('#winFriendIcon').innerHTML = icon('friend', 22);
  $('#winFriendNote').innerHTML = r.newFriendCharm ? `<b>New!</b> A Friendship charm. ${esc(FRIEND)} has the matching half.` : `You and ${esc(FRIEND)} both wear the Friendship charm.`;
};
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

// ---------- bracelet ----------
const RING = [[179,52],[260.1,78.4],[310.3,147.4],[310.3,232.6],[260.1,301.6],[179,328],[97.9,301.6],[47.7,232.6],[47.7,147.4],[97.9,78.4]];
// Nothing is selected until you tap: a worn charm shows its card (Take off), an empty slot shows the charms that fit it.
let braceSel = null;   // null | { id } | { type, index }
render.bracelet = () => {
  const d = Profile.data, wrap = $('#ringSlots'); wrap.innerHTML = '';
  if (braceSel && braceSel.id && !Profile.isOn(braceSel.id)) braceSel = null;
  RING.forEach(([x, y], i) => {
    const boost = i % 2 === 0, type = boost ? 'boost' : 'style', index = boost ? i/2 : (i-1)/2, id = d[type][index];
    const picked = braceSel && (id ? braceSel.id === id : braceSel.type === type && braceSel.index === index);
    const b = document.createElement('button');
    b.className = 'ring-slot ' + type + (id ? ' full' : '') + (picked ? ' picked' : '') + (id && hasArt(id) ? ' has-art' : '');
    b.style.left = (x / 358 * 100) + '%'; b.style.top = (y / 372 * 100) + '%';
    b.setAttribute('aria-label', id ? `${CONFIG.charms[id].name}, on your bracelet` : `Empty ${type} slot`);
    b.setAttribute('aria-pressed', String(!!picked));
    b.innerHTML = id ? icon(id, hasArt(id) ? 38 : 24) : (boost ? '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M8 1 3 8h4l-1 5 5-7H7Z"/></svg>' : '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1l1.5 4.5L13 7l-4.5 1.5L7 13l-1.5-4.5L1 7l4.5-1.5Z"/></svg>');
    // art charms point outward from the band, ring toward the hoop (slot i sits at -90° + 36°·i)
    if (id && hasArt(id)) b.querySelector('img').style.transform = `rotate(${-180 + 36*i}deg)`;
    b.onclick = () => { braceSel = picked ? null : (id ? { id } : { type, index }); render.bracelet(); };
    wrap.appendChild(b);
  });
  const info = $('#braceInfo'); info.hidden = !braceSel;
  if (!braceSel) return;
  const showCharm = !!braceSel.id;
  $('#braceDetail').hidden = !showCharm; $('#bracePick').hidden = showCharm;
  if (showCharm){
    const c = CONFIG.charms[braceSel.id];
    $('#braceIcon').innerHTML = icon(braceSel.id, 40);
    $('#braceName').textContent = c.name;
    $('#braceType').textContent = c.type === 'boost' ? 'Boost' : 'Style';
    $('#braceSay').textContent = c.say;
    return;
  }
  const { type, index } = braceSel, label = type === 'boost' ? 'boost' : 'style';
  const choices = Object.keys(CONFIG.charms).filter(id => CONFIG.charms[id].type === type && Profile.owns(id) && !Profile.isOn(id));
  $('#bracePickTitle').textContent = `Pick a ${label} charm for this spot`;
  const list = $('#slotChoices'); list.innerHTML = ''; list.hidden = !choices.length;
  choices.forEach(id => {
    const b = document.createElement('button'); b.className = 'tray-item';
    b.innerHTML = `${icon(id, 26)}<span>${esc(CONFIG.charms[id].name)}</span>`;
    b.onclick = () => { Profile.data[type][index] = id; Profile.save(); braceSel = { id }; render.bracelet(); say(`${CONFIG.charms[id].name} is on!`); };
    list.appendChild(b);
  });
  $('#bracePickEmpty').hidden = !!choices.length; $('#bracePickStall').hidden = !!choices.length;
  $('#bracePickEmpty').textContent = `You don't have any other ${label} charms yet. Bramble sells them at her stall!`;
};
$('#toggleBtn').onclick = () => { if (braceSel && braceSel.id){ Profile.unequip(braceSel.id); braceSel = null; render.bracelet(); } };
$('#braceClose').onclick = () => { braceSel = null; render.bracelet(); };

go('load');
})();
