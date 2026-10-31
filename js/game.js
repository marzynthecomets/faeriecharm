// FaerieCharm maze engine. Tweak values in js/config.js first; edit here for new mechanics.
// Exposes window.Game.start({ level, mode, onWin, onLeave }).
(() => {
const screen = $('#scr-game'), canvas = $('#world'), ctx = canvas.getContext('2d');
const FRIEND = CONFIG.friendName;
const C = 64, WALL = 16;
const DIRS = { up:{bit:1,dx:0,dy:-1,opp:4}, right:{bit:2,dx:1,dy:0,opp:8}, down:{bit:4,dx:0,dy:1,opp:1}, left:{bit:8,dx:-1,dy:0,opp:2} };
const DLIST = ['up','right','down','left'];
const MESSAGES = CONFIG.messages, EMOJIS = CONFIG.emojis, REPLIES = CONFIG.replies;
const HOLD_DELAY = CONFIG.holdDelay, REPEAT = CONFIG.repeatEvery, STEP_MS = CONFIG.stepMs;

// ---------- maze ----------
let W = 7, H = 12, mine, theirs, dist, KEY, START, DOOR, GEM_CELLS;
function makeRng(seed){ let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function genMaze(seed, sx, sy, extra){
  const r = makeRng(seed), open = new Uint8Array(W*H), vis = new Uint8Array(W*H);
  const st = [[sx,sy]]; vis[sy*W+sx] = 1;
  while (st.length){
    const [x,y] = st[st.length-1];
    const nb = DLIST.filter(k => { const d = DIRS[k], nx = x+d.dx, ny = y+d.dy; return nx>=0 && ny>=0 && nx<W && ny<H && !vis[ny*W+nx]; });
    if (!nb.length){ st.pop(); continue; }
    const d = DIRS[nb[Math.floor(r()*nb.length)]], nx = x+d.dx, ny = y+d.dy;
    open[y*W+x] |= d.bit; open[ny*W+nx] |= d.opp; vis[ny*W+nx] = 1; st.push([nx,ny]);
  }
  let added = 0, guard = 0;
  while (added < extra && guard++ < 500){
    const x = Math.floor(r()*W), y = Math.floor(r()*H), d = DIRS[DLIST[Math.floor(r()*4)]], nx = x+d.dx, ny = y+d.dy;
    if (nx<0 || ny<0 || nx>=W || ny>=H || (open[y*W+x] & d.bit)) continue;
    open[y*W+x] |= d.bit; open[ny*W+nx] |= d.opp; added++;
  }
  return open;
}
function bfs(open, sx, sy){
  const d = new Int16Array(W*H).fill(-1), q = [[sx,sy]]; d[sy*W+sx] = 0;
  while (q.length){
    const [x,y] = q.shift();
    for (const k of DLIST){ const dd = DIRS[k]; if (!(open[y*W+x] & dd.bit)) continue; const i = (y+dd.dy)*W + x+dd.dx; if (d[i] < 0){ d[i] = d[y*W+x]+1; q.push([x+dd.dx, y+dd.dy]); } }
  }
  return d;
}
function buildLevel(lv){
  W = lv.width; H = lv.height;
  START = {x:0, y:H-1}; DOOR = {x:W-1, y:0};
  mine = genMaze(lv.seed, START.x, START.y, 4);
  theirs = genMaze(lv.friendSeed, W-1, H-1, 4);
  dist = bfs(mine, START.x, START.y);
  let best = -1; KEY = null;
  for (let i=0;i<W*H;i++){ const x=i%W, y=(i/W)|0; if (x===DOOR.x && y===DOOR.y) continue; if (y < 2 && x > W-3) continue; if (dist[i] > best){ best = dist[i]; KEY = {x,y}; } }
  const de = [];
  for (let i=0;i<W*H;i++){ const x=i%W, y=(i/W)|0; let n=0; for (const k of DLIST) if (mine[i] & DIRS[k].bit) n++;
    if (n===1 && !(x===START.x&&y===START.y) && !(x===KEY.x&&y===KEY.y) && !(x===DOOR.x&&y===DOOR.y)) de.push({x,y,d:dist[i]}); }
  de.sort((a,b)=>a.d-b.d);
  const out = [];
  if (de.length <= 5) out.push(...de); else for (let j=0;j<5;j++) out.push(de[Math.round(j*(de.length-1)/4)]);
  let k = 0; while (out.length < 5 && k < W*H){ const x=k%W, y=(k/W)|0; if (!out.some(c=>c.x===x&&c.y===y) && !(x===START.x&&y===START.y) && !(x===KEY.x&&y===KEY.y) && dist[k]>4) out.push({x,y}); k+=7; }
  GEM_CELLS = out.map(c => c.x + ',' + c.y);
}
function hsh(a,b,c){ let h = (Math.imul(a,73856093) ^ Math.imul(b,19349663) ^ Math.imul(c,83492791)) >>> 0; h = (h ^ (h>>>13)) >>> 0; h = Math.imul(h, 1274126177) >>> 0; return (h % 1000) / 1000; }

// ---------- state ----------
let S = null, opts = null, active = false;
const cam = {x:0, y:0, z:1, peek:0, glow:0};
const cellCenter = (x,y) => ({x:x*C + C/2, y:y*C + C/2});
function fresh(){
  const duo = opts.mode === 'duo', slots = Profile.data.boost.slice(), uses = {};
  slots.forEach(id => { if (id) uses[id] = 1; });
  S = {
    duo, slots, uses, lent:null,
    px:START.x, py:START.y, anim:null, queue:[], facing:'up', foot:[], repDir:null, pendDir:null, repNext:0,
    gemCells:new Set(GEM_CELLS), gemsFound:0, haveHalf:false, friendHalf:false,
    peekUntil:-1, glowUntil:-1, now:0, paused:true, won:false, door:0,
    sent:0, received:0, pending:[], playerHalfAt:null,
    friend:{ state:'solving', halfAt:CONFIG.friend.findsHalfAt, stuckAt:CONFIG.friend.getsStuckAt, unstuckAt:0, helped:false, wasStuck:false, sentHelp:false,
      events:CONFIG.friend.scriptedScrolls.map(e => ({...e})) }
  };
  const p = cellCenter(S.px, S.py); cam.x = p.x; cam.y = p.y - 60; cam.z = 1; cam.peek = 0; cam.glow = 0;
}

// ---------- input ----------
let joyDir = null, keyDir = null, joyId = null, jx = 0, jy = 0;
const stick = $('#stick'), knob = $('#knob'), arrows = {up:stick.querySelector('.up'),down:stick.querySelector('.down'),left:stick.querySelector('.left'),right:stick.querySelector('.right')};
function idleStick(){ const r = screen.getBoundingClientRect(); stick.style.left = '92px'; stick.style.top = (r.height - 110) + 'px'; stick.classList.add('idle'); knob.style.transform = ''; for (const k in arrows) arrows[k].classList.remove('on'); }
canvas.addEventListener('pointerdown', e => {
  if (!S || S.paused || S.won || joyId !== null) return;
  joyId = e.pointerId; canvas.setPointerCapture(e.pointerId);
  const r = screen.getBoundingClientRect(); jx = e.clientX - r.left; jy = e.clientY - r.top;
  stick.style.left = jx + 'px'; stick.style.top = jy + 'px'; stick.classList.remove('idle'); $('#hint').hidden = true;
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId !== joyId) return;
  const r = screen.getBoundingClientRect(); let dx = e.clientX - r.left - jx, dy = e.clientY - r.top - jy;
  const d = Math.hypot(dx,dy), m = 38; if (d > m){ dx = dx/d*m; dy = dy/d*m; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  joyDir = d < 18 ? null : (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  for (const k in arrows) arrows[k].classList.toggle('on', k === joyDir);
});
const endJoy = e => { if (e.pointerId !== joyId) return; joyId = null; joyDir = null; idleStick(); };
canvas.addEventListener('pointerup', endJoy); canvas.addEventListener('pointercancel', endJoy);
const KEYS = {ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
const held = [];
addEventListener('keydown', e => { if (!active || sheetOpen) return; const d = KEYS[e.code]; if (!d) return; e.preventDefault(); if (!held.includes(d)) held.push(d); keyDir = held[held.length-1]; });
addEventListener('keyup', e => { const d = KEYS[e.code]; if (!d) return; const i = held.indexOf(d); if (i>=0) held.splice(i,1); keyDir = held[held.length-1] || null; });

// ---------- movement ----------
function canGo(x,y,dir){ return !!(mine[y*W+x] & DIRS[dir].bit); }
function startMove(dir, dur){
  if (!canGo(S.px, S.py, dir)) return false;
  const d = DIRS[dir];
  S.foot.push({...cellCenter(S.px,S.py), dir}); if (S.foot.length > 12) S.foot.shift();
  S.anim = {fx:S.px, fy:S.py, tx:S.px+d.dx, ty:S.py+d.dy, t:0, dur};
  S.facing = dir; return true;
}
function arrive(){
  S.px = S.anim.tx; S.py = S.anim.ty; S.anim = null;
  const id = S.px + ',' + S.py;
  if (S.gemCells.has(id)){ S.gemCells.delete(id); S.gemsFound++; Profile.addGems(1); popGems(); say('+1 gem'); }
  if (!S.haveHalf && S.px === KEY.x && S.py === KEY.y){
    S.haveHalf = true; S.playerHalfAt = S.now;
    if (!S.duo) S.friendHalf = true;
    renderKey(true);
    say(!S.duo ? 'You found the key! Find the door' : S.friendHalf ? 'The key is whole! Find the door' : 'You found your half of the key!');
    updateStatus();
  }
  checkDoor();
}
function checkDoor(){ if (!S.won && S.haveHalf && S.friendHalf && S.px === DOOR.x && S.py === DOOR.y) win(); }
function updatePlayer(dt){
  const dir = sheetOpen ? null : (joyDir || keyDir);
  if (dir !== S.repDir){ S.repDir = dir; if (dir){ S.pendDir = dir; S.repNext = S.now + HOLD_DELAY; } }
  if (S.anim){ S.anim.t += dt*1000/S.anim.dur; if (S.anim.t >= 1) arrive(); return; }
  if (S.queue.length){ startMove(S.queue.shift(), 75); return; }
  if (S.pendDir){ const d = S.pendDir; S.pendDir = null; if (!startMove(d, STEP_MS)) S.facing = d; return; }
  if (dir && S.now >= S.repNext){ if (startMove(dir, STEP_MS)) S.repNext = S.now + REPEAT; }
}
function playerPix(){
  if (!S.anim) return cellCenter(S.px, S.py);
  const t = Math.min(1, S.anim.t), e = t<.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2;
  const a = cellCenter(S.anim.fx, S.anim.fy), b = cellCenter(S.anim.tx, S.anim.ty);
  return {x:a.x + (b.x-a.x)*e, y:a.y + (b.y-a.y)*e};
}

// ---------- charms ----------
$('#gameArc').addEventListener('click', e => { const b = e.target.closest('[data-charm]'); if (b) useCharm(b.dataset.charm); });
function useCharm(id){
  if (!S || S.paused || S.won) return;
  const name = CONFIG.charms[id].name;
  if (S.lent === id){ say(`Your ${name} is lent to ${FRIEND}`); return; }
  if (!(S.uses[id] > 0)){ say(`${name} is used up this level`); return; }
  if (id === 'peek'){ if (S.now < S.peekUntil) return; S.uses.peek--; S.peekUntil = S.now + CONFIG.peekSeconds; say('Peek! 3 seconds'); }
  if (id === 'glow'){ S.uses.glow--; S.glowUntil = S.now + CONFIG.glowSeconds; say('Glow!'); }
  if (id === 'dash'){
    if (S.anim || S.queue.length) return;
    const dir = S.facing; let x = S.px, y = S.py, n = 0;
    while (n < 2 && canGo(x,y,dir)){ x += DIRS[dir].dx; y += DIRS[dir].dy; n++; }
    if (!n){ say('A wall is in the way. Turn first'); return; }
    S.uses.dash--; S.queue = Array(n).fill(dir); say('Dash!');
  }
  if (id === 'snip'){
    if (S.anim) return;
    const d = DIRS[S.facing], nx = S.px + d.dx, ny = S.py + d.dy;
    if (canGo(S.px, S.py, S.facing)){ say('No wall in front of you'); return; }
    if (nx < 0 || ny < 0 || nx >= W || ny >= H){ say("That's the edge of the maze"); return; }
    mine[S.py*W+S.px] |= d.bit; mine[ny*W+nx] |= d.opp; S.uses.snip--; say('Snip! The thorns are gone');
  }
  renderCharms();
}
function renderCharms(){
  renderArc($('#gameArc'), S.slots, true);
  $$('#gameArc [data-charm]').forEach(b => {
    const id = b.dataset.charm, n = S.uses[id] || 0;
    b.classList.toggle('spent', n < 1 || S.lent === id);
    const badge = b.querySelector('.badge'); badge.hidden = n < 2; badge.textContent = n;
  });
}
function giveTempCharm(id){
  S.uses[id] = (S.uses[id] || 0) + 1;
  if (!S.slots.includes(id)){ const i = S.slots.indexOf(null); if (i >= 0) S.slots[i] = id; }
  renderCharms();
}

// ---------- HUD ----------
function popGems(){ const g = $('#gameGems'); g.classList.remove('pop'); void g.offsetWidth; g.classList.add('pop'); }
function renderKey(pop){
  $('#keyL').setAttribute('opacity', S.haveHalf ? 1 : 0);
  $('#keyR').setAttribute('opacity', S.friendHalf ? 1 : 0);
  const k = $('#keyBtn');
  k.setAttribute('aria-label', !S.duo ? (S.haveHalf ? 'You have the key' : 'Key not found yet')
    : S.haveHalf && S.friendHalf ? 'Key is whole' : S.haveHalf ? 'You have your half. Waiting on ' + FRIEND : S.friendHalf ? FRIEND + ' has her half. Find yours' : 'Key: no halves found yet');
  if (pop){ k.classList.remove('pop'); void k.offsetWidth; k.classList.add('pop'); }
}
function updateStatus(){
  if (!S.duo) return;
  const f = S.friend, t = $('#statusText');
  let html, warn = false;
  if (S.won) html = 'The door is open!';
  else if (S.haveHalf && S.friendHalf) html = 'The key is whole! Find the door ↗';
  else if (f.state === 'stuck'){ html = `<b>${esc(FRIEND)}</b> seems stuck…`; warn = true; }
  else if (S.friendHalf) html = `<b>${esc(FRIEND)}</b> found her half!`;
  else if (S.haveHalf) html = `<b>${esc(FRIEND)}</b> is almost there…`;
  else html = `<b>${esc(FRIEND)}</b> is solving…`;
  if (t.innerHTML !== html) t.innerHTML = html;
  $('#statusDot').classList.toggle('warn', warn); $('#scrollBtn').classList.toggle('nudge', warn);
}

// incoming scrolls
const inbox = []; let toastBusy = false, toastTimer;
function receive(scroll){ inbox.push(scroll); if (!toastBusy) nextToast(); }
function nextToast(){
  const t = $('#toast'), s = inbox.shift();
  if (!s || !active){ toastBusy = false; t.classList.remove('show'); return; }
  toastBusy = true; S.received++;
  if (s.gift === 'peek') giveTempCharm('peek');
  t.innerHTML = `<div class="avatar">${esc(FRIEND[0])}</div><div style="min-width:0"><div class="from">${esc(FRIEND.toUpperCase())} SENT A SCROLL</div>${s.msg ? `<div class="msg">${esc(s.msg)}</div>` : ''}${s.gift === 'peek' ? '<span class="gift">+1 Peek for you</span>' : ''}</div>${s.emoji ? `<div class="emo">${esc(s.emoji)}</div>` : ''}`;
  t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(nextToast, 350); }, 4200);
}
$('#toast').addEventListener('click', () => { clearTimeout(toastTimer); $('#toast').classList.remove('show'); setTimeout(nextToast, 300); });

// ---------- the scripted friend (see CONFIG.friend) ----------
function friendFinds(){
  const f = S.friend; if (S.friendHalf) return;
  S.friendHalf = true; f.state = 'found'; renderKey(true);
  receive({msg:'Got my half!!', emoji:'🎉'});
  if (S.haveHalf) say('The key is whole! Find the door');
  updateStatus(); checkDoor();
}
function updateFriend(){
  const f = S.friend;
  for (const ev of f.events) if (!ev.done && S.now >= ev.at && !S.won){ ev.done = true; receive({msg:ev.msg, emoji:ev.emoji}); }
  for (let i = S.pending.length-1; i >= 0; i--) if (S.now >= S.pending[i].at){ receive(S.pending[i].scroll); S.pending.splice(i,1); }
  if (S.friendHalf) return;
  if (f.state === 'solving' && !f.helped && !f.wasStuck && S.now >= f.stuckAt){
    f.state = 'stuck'; f.wasStuck = true; f.unstuckAt = S.now + CONFIG.friend.stuckFor; receive({msg:"I'm stuck!", emoji:'😵'});
  }
  if (f.state === 'stuck' && S.now >= f.unstuckAt) f.state = 'solving';
  if (S.haveHalf) f.halfAt = Math.min(f.halfAt, S.playerHalfAt + CONFIG.friend.findsHalfAfterYou);
  if (S.now >= f.halfAt) friendFinds();
}
function friendReact(sel){
  const f = S.friend; let delay = 2.4;
  const push = scroll => { S.pending.push({at:S.now + delay, scroll}); delay += 2.6; };
  if ((sel.peek || sel.lend) && !S.friendHalf){ f.helped = true; if (f.state === 'stuck') f.state = 'solving'; f.halfAt = Math.min(f.halfAt, S.now + CONFIG.friend.findsHalfAfterHelp); }
  if (sel.msg){
    if (sel.msg === "I'm stuck!"){
      if (!f.sentHelp){ f.sentHelp = true; push({msg:'Hang on! Sending you a Peek', emoji:'👀', gift:'peek'}); }
      else push({msg:'You can do it! Try a new path', emoji:'🌿'});
    } else push(REPLIES[sel.msg] || {msg:'Yay!', emoji:'🙂'});
  } else if (sel.emoji) push({msg:'', emoji:sel.emoji + sel.emoji});
  if (sel.peek) push({msg:'A Peek!! Now I can see the way', emoji:'⭐'});
  if (sel.lend) push({msg:`Thanks for the ${CONFIG.charms[sel.lend].name}! I'll give it back after`, emoji:'💨'});
  if (sel.gems > 0) push({msg:`${sel.gems} gem${sel.gems > 1 ? 's' : ''}?! Thank you`, emoji:'💖'});
  updateStatus();
}

// ---------- scroll sheet ----------
let sheetOpen = false, sel;
const msgWrap = $('#msgChips'), emoWrap = $('#emoChips');
MESSAGES.forEach(m => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = m; b.setAttribute('aria-pressed','false'); b.onclick = () => { sel.msg = sel.msg === m ? null : m; renderSheet(); }; msgWrap.appendChild(b); });
EMOJIS.forEach(e => { const b = document.createElement('button'); b.className = 'emo'; b.textContent = e; b.setAttribute('aria-pressed','false'); b.setAttribute('aria-label','Emoji ' + e); b.onclick = () => { sel.emoji = sel.emoji === e ? null : e; renderSheet(); }; emoWrap.appendChild(b); });
const lendable = () => S.slots.find(id => id && id !== 'peek' && S.uses[id] > 0 && S.lent !== id) || null;
$('#giftPeek').onclick = () => { if (!(S.uses.peek > 0)) return; sel.peek = !sel.peek; renderSheet(); };
$('#giftLend').onclick = () => { const id = lendable(); if (!id) return; sel.lend = sel.lend ? null : id; renderSheet(); };
$('#gemPlus').onclick = () => { sel.gems = Math.min(sel.gems + 1, Math.min(Profile.data.gems, CONFIG.maxGemGift)); renderSheet(); };
$('#gemMinus').onclick = () => { sel.gems = Math.max(0, sel.gems - 1); renderSheet(); };
function openSheet(){
  if (!S || S.paused || S.won) return;
  sel = {msg:null, emoji:null, peek:false, gems:0, lend:null}; sheetOpen = true; joyDir = null; idleStick();
  renderSheet(); $('#scrim').classList.add('show'); $('#sheet').classList.add('show'); $('#sheet').setAttribute('aria-hidden','false');
}
function closeSheet(){ sheetOpen = false; $('#scrim').classList.remove('show'); $('#sheet').classList.remove('show'); $('#sheet').setAttribute('aria-hidden','true'); }
function renderSheet(){
  [...msgWrap.children].forEach(b => b.setAttribute('aria-pressed', String(b.textContent === sel.msg)));
  [...emoWrap.children].forEach(b => b.setAttribute('aria-pressed', String(b.textContent === sel.emoji)));
  const gp = $('#giftPeek'), gl = $('#giftLend'), peeks = S.uses.peek || 0, lid = sel.lend || lendable();
  gp.disabled = peeks < 1; gp.setAttribute('aria-pressed', String(sel.peek)); $('#peekLeft').textContent = peeks + ' left';
  gl.disabled = !lid; gl.setAttribute('aria-pressed', String(!!sel.lend));
  $('#lendIcon').innerHTML = icon(lid || 'dash', 28);
  $('#lendName').textContent = lid ? CONFIG.charms[lid].name : 'Lend a charm';
  $('#lendNote').textContent = lid ? 'Lend for this level' : 'No charm to lend';
  $('#gemGift').textContent = sel.gems; $('#giftGems').setAttribute('aria-pressed', String(sel.gems > 0));
  const parts = [];
  if (sel.msg) parts.push(sel.msg); if (sel.emoji) parts.push(sel.emoji);
  const gifts = []; if (sel.peek) gifts.push('Peek'); if (sel.gems) gifts.push(sel.gems + (sel.gems > 1 ? ' gems' : ' gem')); if (sel.lend) gifts.push(CONFIG.charms[sel.lend].name + ' (lent)');
  let txt = parts.join(' '); if (gifts.length) txt += (txt ? ' + ' : '') + gifts.join(' + ');
  $('#previewText').textContent = txt || 'Pick a message, emoji, or gift';
  $('#sendBtn').disabled = !txt;
}
$('#scrollBtn').onclick = openSheet; $('#closeSheet').onclick = closeSheet; $('#scrim').onclick = closeSheet;
$('#sendBtn').onclick = () => {
  if (sel.peek) S.uses.peek--;
  if (sel.gems) Profile.addGems(-sel.gems);
  if (sel.lend) S.lent = sel.lend;
  S.sent++; renderCharms(); closeSheet(); say('Scroll sent to ' + FRIEND + '!');
  friendReact({...sel});
};

// ---------- overlays ----------
function setPaused(p){ S.paused = p; if (p){ joyDir = null; idleStick(); } }
$('#startBtn').onclick = () => { $('#intro').hidden = true; setPaused(false); say(S.duo ? 'Find your half of the key' : 'Find the key'); };
let keyTaps = [];
$('#keyBtn').onclick = () => {
  const t = performance.now(); keyTaps = keyTaps.filter(x => t - x < 900); keyTaps.push(t);
  if (keyTaps.length >= 3 && S.duo){ keyTaps = []; closeSheet(); $('#facOv').hidden = false; setPaused(true); return; }
  if (!S.paused) say($('#keyBtn').getAttribute('aria-label'));
};
$('#pauseBtn').onclick = () => { if (S.won || !$('#intro').hidden) return; closeSheet(); $('#pauseOv').hidden = false; setPaused(true); };
$('#resumeBtn').onclick = () => { $('#pauseOv').hidden = true; setPaused(false); };
$('#restartBtn').onclick = () => { $('#pauseOv').hidden = true; restart(); };
$('#leaveBtn').onclick = () => { $('#pauseOv').hidden = true; stop(); opts.onLeave && opts.onLeave(); };
$$('[data-fac]').forEach(b => b.onclick = () => {
  const a = b.dataset.fac;
  $('#facOv').hidden = true;
  if (a === 'restart'){ restart(); return; }
  setPaused(false);
  if (a === 'cheer') receive({msg:['You got this!','Almost there!','Go go go!'][Math.floor(Math.random()*3)], emoji:'💪'});
  if (a === 'stuck' && !S.friendHalf){ S.friend.state = 'stuck'; S.friend.unstuckAt = S.now + 25; S.friend.helped = false; receive({msg:"I'm stuck!", emoji:'😵'}); updateStatus(); }
  if (a === 'half') friendFinds();
  if (a === 'finish'){ S.haveHalf = true; S.friendHalf = true; renderKey(true); win(); }
});
function win(){
  S.won = true; updateStatus(); say('The door opens!');
  setTimeout(() => {
    setPaused(true);
    const result = { level: opts.level, mode: opts.mode, time: S.now, sent: S.sent, received: S.received, gemsFound: S.gemsFound };
    stop(); opts.onWin && opts.onWin(result);
  }, 1300);
}
function restart(){ start(opts); $('#intro').hidden = true; setPaused(false); say(S.duo ? 'Find your half of the key' : 'Find the key'); }

// ---------- render ----------
let vw = 0, vh = 0, dpr = 1;
function resize(){ const r = screen.getBoundingClientRect(); if (!r.width) return; vw = r.width; vh = r.height; dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(vw*dpr); canvas.height = Math.round(vh*dpr); canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px'; if (joyId === null) idleStick(); }
addEventListener('resize', () => { if (active) resize(); });
function playTop(){ const el = S.duo ? $('#status') : $('#gameTop'); const r = el.getBoundingClientRect(), a = screen.getBoundingClientRect(); return r.bottom - a.top; }

function drawMazeWalls(open, ox, color, isFriend){
  ctx.strokeStyle = color; ctx.lineWidth = WALL; ctx.lineCap = 'round'; ctx.beginPath();
  const segs = [];
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){
    const o = open[y*W+x], X = ox + x*C, Y = y*C;
    if (!(o & 1)) segs.push([X,Y,X+C,Y,x,y,1]);
    if (!(o & 8) && !(isFriend && x === 0)) segs.push([X,Y,X,Y+C,x,y,8]);
    if (y === H-1 && !(o & 4)) segs.push([X,Y+C,X+C,Y+C,x,y,4]);
    if (x === W-1 && !(o & 2) && isFriend) segs.push([X+C,Y,X+C,Y+C,x,y,2]);
  }
  for (const s of segs){ ctx.moveTo(s[0],s[1]); ctx.lineTo(s[2],s[3]); }
  ctx.stroke();
  if (isFriend) return;
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2; ctx.beginPath();
  for (const s of segs){
    const r = hsh(s[4], s[5], s[6]); if (r > 0.55) continue;
    const t = 0.25 + r, px = s[0] + (s[2]-s[0])*t, py = s[1] + (s[3]-s[1])*t;
    const horiz = s[1] === s[3], side = hsh(s[5], s[4], s[6]+3) > 0.5 ? 1 : -1;
    const nx = horiz ? 0 : side, ny = horiz ? side : 0, L = WALL/2 + 6;
    ctx.moveTo(px + nx*(WALL/2-2), py + ny*(WALL/2-2)); ctx.lineTo(px + nx*L + (horiz ? 4 : 0), py + ny*L + (horiz ? 0 : 4));
  }
  ctx.stroke();
}
function star(x,y,r){ ctx.beginPath(); for (let i=0;i<8;i++){ const a = i*Math.PI/4, rr = i%2 ? r*0.35 : r; ctx.lineTo(x + Math.cos(a)*rr, y + Math.sin(a)*rr); } ctx.closePath(); ctx.fill(); }
function drawDoor(){
  const x = W*C, y = 0, open = S.door, whole = S.haveHalf && S.friendHalf;
  ctx.save(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath();
  for (let a = 0; a <= 6; a++){ const ang = Math.PI + a*Math.PI/6; ctx.moveTo(x + Math.cos(ang)*38, y - 44 + Math.sin(ang)*38); ctx.lineTo(x + Math.cos(ang)*47, y - 44 + Math.sin(ang)*47); }
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x-38, y+4); ctx.lineTo(x-38, y-44); ctx.arc(x, y-44, 38, Math.PI, 0); ctx.lineTo(x+38, y+4); ctx.closePath();
  ctx.fillStyle = whole ? '#1a1a1a' : '#c4c4c4'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  if (open > 0){ ctx.beginPath(); ctx.moveTo(x-30, y+4); ctx.lineTo(x-30, y-44); ctx.arc(x, y-44, 30, Math.PI, 0); ctx.lineTo(x+30, y+4); ctx.closePath(); ctx.fillStyle = `rgba(255,255,255,${open})`; ctx.fill(); }
  if (!whole){ ctx.fillStyle = '#6b6b6b'; ctx.fillRect(x-9, y-34, 18, 14); ctx.strokeStyle = '#6b6b6b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y-34, 6, Math.PI, 0); ctx.stroke(); }
  else if (open < 0.5){ const tw = 0.5 + 0.5*Math.sin(S.now*5); ctx.fillStyle = `rgba(255,255,255,${0.6 + 0.4*tw})`; star(x, y-40, 9); star(x-16, y-18, 5); star(x+15, y-60, 5); }
  ctx.restore();
}
function drawThornWall(){
  const x = W*C; ctx.strokeStyle = '#1a1a1a'; ctx.lineCap = 'round';
  ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, H*C + 16); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.beginPath();
  for (let y = 24; y < H*C; y += 40){ ctx.moveTo(x, y); ctx.lineTo(x-13, y-8); ctx.moveTo(x, y); ctx.lineTo(x+13, y-8); }
  ctx.stroke();
}
function drawFoot(){
  const n = S.foot.length;
  S.foot.forEach((f, i) => {
    const a = 0.06 + 0.8*(i+1)/n, d = DIRS[f.dir], px = -d.dy, py = d.dx, ang = Math.atan2(d.dy, d.dx) + Math.PI/2;
    ctx.fillStyle = `rgba(26,26,26,${a})`;
    for (const s of [1,-1]){ ctx.beginPath(); ctx.ellipse(f.x + px*5*s - d.dx*5*s, f.y + py*5*s - d.dy*5*s, 4, 6, ang, 0, Math.PI*2); ctx.fill(); }
  });
}
function drawGems(){
  const bob = Math.sin(S.now*3)*2.5;
  for (const id of S.gemCells){
    const [gx, gy] = id.split(',').map(Number), c = cellCenter(gx, gy);
    ctx.beginPath(); ctx.moveTo(c.x, c.y-11+bob); ctx.lineTo(c.x+10, c.y-2+bob); ctx.lineTo(c.x, c.y+12+bob); ctx.lineTo(c.x-10, c.y-2+bob); ctx.closePath();
    ctx.fillStyle = '#cfe6f7'; ctx.fill(); ctx.strokeStyle = '#3d7fb5'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();
  }
}
function drawKey(){
  if (S.haveHalf) return;
  const c = cellCenter(KEY.x, KEY.y), bob = Math.sin(S.now*2.4)*3;
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(c.x, c.y+bob, 22 + Math.sin(S.now*4)*2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath();
  if (S.duo){ ctx.moveTo(c.x+1, c.y-14+bob); ctx.arc(c.x+1, c.y+bob, 14, -Math.PI/2, Math.PI/2, true); ctx.closePath(); }
  else ctx.arc(c.x, c.y+bob, 14, 0, Math.PI*2);
  ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.8; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = '#1a1a1a'; star(c.x+16, c.y-14+bob, 5);
}
function drawPlayer(){
  const p = playerPix(), d = DIRS[S.facing];
  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  const off = d.dy !== 0 ? [[-6,0],[6,0]] : [[0,-5],[0,5]];
  for (const o of off){ ctx.beginPath(); ctx.arc(p.x + o[0] + d.dx*3, p.y + o[1] + d.dy*3 - (d.dy===0?2:0), 3, 0, Math.PI*2); ctx.fill(); }
}
function render(dt){
  const top = playTop(), p = playerPix();
  const peeking = !S.paused && S.now < S.peekUntil, glowing = !S.paused && S.now < S.glowUntil;
  const k = 1 - Math.exp(-dt*6);
  cam.peek += ((peeking ? 1 : 0) - cam.peek) * k;
  cam.glow += ((glowing ? 1 : 0) - cam.glow) * k;
  cam.z += ((peeking ? 0.55 : 1) - cam.z) * k;
  cam.x += (p.x - cam.x) * (1 - Math.exp(-dt*8)); cam.y += (p.y - cam.y) * (1 - Math.exp(-dt*8));
  if (S.won) S.door = Math.min(1, S.door + dt*1.2);
  const cx = vw/2, cy = top + (vh - top)/2, z = cam.z;
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.fillStyle = '#e2e2e2'; ctx.fillRect(0,0,vw,vh);
  ctx.setTransform(dpr*z, 0, 0, dpr*z, dpr*(cx - cam.x*z), dpr*(cy - cam.y*z));
  ctx.fillStyle = '#efefef'; ctx.fillRect(0, 0, W*C, H*C);
  ctx.fillStyle = '#d3d3d3'; ctx.fillRect(W*C, 0, W*C, H*C);
  if (S.duo) drawMazeWalls(theirs, W*C, '#b4b4b4', true);
  drawFoot(); drawGems(); drawKey();
  drawMazeWalls(mine, 0, '#9a9a9a', false);
  drawThornWall(); drawDoor(); drawPlayer();
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const sx = cx + (p.x - cam.x)*z, sy = cy + (p.y - cam.y)*z, fogA = 0.96 * (1 - cam.peek), grow = 1 + (CONFIG.glowBoost - 1) * cam.glow;
  if (fogA > 0.01){
    const g = ctx.createRadialGradient(sx, sy, CONFIG.fogClear*grow, sx, sy, CONFIG.fogEdge*grow);
    g.addColorStop(0, 'rgba(226,226,226,0)'); g.addColorStop(1, `rgba(226,226,226,${fogA})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, vw, vh);
  }
}

// ---------- loop + public API ----------
let last = performance.now();
function loop(t){
  const dt = Math.min(0.05, (t - last)/1000); last = t;
  if (active && S){
    if (!S.paused){ S.now += dt; updatePlayer(dt); if (S.duo) updateFriend(); updateStatus(); }
    render(dt);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function start(o){
  opts = o; const lv = CONFIG.levels[o.level];
  buildLevel(lv); fresh();
  inbox.length = 0; toastBusy = false; $('#toast').classList.remove('show'); closeSheet();
  screen.classList.toggle('solo', !S.duo);
  $('#introTitle').textContent = `Level ${o.level + 1} · ${lv.name}`;
  $('#introText').innerHTML = S.duo
    ? `You and ${esc(FRIEND)} each have half of the maze. Find <b>your half of the key</b>. When both halves are found, meet at the door.`
    : 'Find <b>the key</b> hidden in the maze, then make your way to the door.';
  $('#introScrollTip').hidden = !S.duo;
  $('#intro').hidden = false; $('#pauseOv').hidden = true; $('#facOv').hidden = true; $('#hint').hidden = false;
  active = true; resize(); renderKey(false); renderCharms(); updateStatus(); renderGemPills();
}
function stop(){ active = false; closeSheet(); joyDir = null; keyDir = null; held.length = 0; }
window.Game = { start, stop };
})();
