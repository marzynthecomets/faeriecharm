// FaerieCharm maze engine. Tweak values in js/config.js first; edit here for new mechanics.
// Exposes window.Game.start({ level, mode, onWin, onLeave }).
(() => {
const screen = $('#scr-game'), canvas = $('#world');
let ctx = canvas.getContext('2d');   // swapped briefly while the maze layer is drawn
let FRIEND = CONFIG.friendName, THEIR = 'her';   // the scripted friend, or the real friend's nickname in live play
const C = 78, WALL = 10;   // cell size and vine width (px); the stone border adds CONFIG.mazeArt.stoneWidth on each side
const DIRS = { up:{bit:1,dx:0,dy:-1,opp:4}, right:{bit:2,dx:1,dy:0,opp:8}, down:{bit:4,dx:0,dy:1,opp:1}, left:{bit:8,dx:-1,dy:0,opp:2} };
const DLIST = ['up','right','down','left'];
const MESSAGES = CONFIG.messages, EMOJIS = CONFIG.emojis, REPLIES = CONFIG.replies;
const HOLD_DELAY = CONFIG.holdDelay, REPEAT = CONFIG.repeatEvery, STEP_MS = CONFIG.stepMs;

// ---------- maze ----------
let W = 7, H = 12, mine, theirs, dist, KEY, START, DOOR, GEM_CELLS;
// Duo: both players share ONE maze (twice as wide). STARTS/KEYS are indexed by player (0 = host/you, 1 = guest/friend).
let DUO = false, ME = 0, STARTS = null, KEYCELLS = null, DOOR_CELLS = [], DOOR_PX = 0;
const PCOLOR = i => CONFIG.mazeArt.playerColors[i], PCOLOR_NAME = i => CONFIG.mazeArt.playerColorNames[i];
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
function pickGems(open, d, skip, n){
  const de = [];
  for (let i=0;i<W*H;i++){ const x=i%W, y=(i/W)|0; let k=0; for (const q of DLIST) if (open[i] & DIRS[q].bit) k++;
    if (k===1 && !skip(x,y)) de.push({x,y,d:d[i]}); }
  de.sort((a,b)=>a.d-b.d);
  const out = [];
  if (de.length <= n) out.push(...de); else for (let j=0;j<n;j++) out.push(de[Math.round(j*(de.length-1)/(n-1))]);
  let k = 0; while (out.length < n && k < W*H){ const x=k%W, y=(k/W)|0; if (!out.some(c=>c.x===x&&c.y===y) && !skip(x,y) && d[k]>4) out.push({x,y}); k+=7; }
  return out.map(c => c.x + ',' + c.y);
}
function buildDuo(lv){
  W = lv.width * 2; H = lv.height;
  STARTS = [{x:0, y:H-1}, {x:W-1, y:H-1}];
  const half = W/2;
  DOOR_CELLS = [{x:half-1, y:0}, {x:half, y:0}]; DOOR = DOOR_CELLS[0]; DOOR_PX = half*C;
  mine = genMaze(lv.seed, STARTS[0].x, STARTS[0].y, lv.width + 4);   // extra openings = more than one way through
  mine[half-1] |= DIRS.right.bit; mine[half] |= DIRS.left.bit;          // the two cells under the door form one doorway
  const d0 = bfs(mine, STARTS[0].x, STARTS[0].y), d1 = bfs(mine, STARTS[1].x, STARTS[1].y);
  // each player's key sits on the FRIEND's side, so you cross paths on the way
  const keyOn = (own, x0, x1) => { let best = -1, k = null;
    for (let y=2; y<=H-4; y++) for (let x=x0; x<x1; x++){ const i = y*W+x; if (own[i] > best){ best = own[i]; k = {x,y}; } }
    return k; };
  KEYCELLS = [keyOn(d0, half, W), keyOn(d1, 0, half)];
  const dmin = d0.map((v,i) => Math.min(v, d1[i]));
  const isSpecial = (x,y) => STARTS.some(c=>c.x===x&&c.y===y) || KEYCELLS.some(c=>c.x===x&&c.y===y) || DOOR_CELLS.some(c=>c.x===x&&c.y===y);
  GEM_CELLS = pickGems(mine, dmin, isSpecial, 6);
  START = STARTS[ME]; KEY = KEYCELLS[ME];
}
function buildLevel(lv, duo){
  DUO = duo;
  if (duo){ buildDuo(lv); return; }
  W = lv.width; H = lv.height;
  START = {x:0, y:H-1}; DOOR = {x:W-1, y:0}; DOOR_CELLS = [DOOR]; DOOR_PX = W*C;
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
function mkMate(c){ return {x:c.x, y:c.y, from:cellCenter(c.x,c.y), t:1, dur:1, facing:'up', foot:[]}; }
function mateTo(x, y, facing){   // move the friend's faerie (scripted or live); animates from wherever it's drawn now
  const m = S.mate; if (!m) return;
  if (facing) m.facing = facing;
  if (x === m.x && y === m.y) return;
  const from = matePix(), steps = Math.abs(x - m.x) + Math.abs(y - m.y);
  m.foot.push({...cellCenter(m.x, m.y), dir: m.facing}); if (m.foot.length > 10) m.foot.shift();
  m.from = from; m.x = x; m.y = y; m.t = 0; m.dur = Math.min(600, STEP_MS * Math.max(1, steps));
  if (!S.friendHalf && !S.live && x === KEYCELLS[1-ME].x && y === KEYCELLS[1-ME].y) setTimeout(() => S && S.mate && !S.friendHalf && friendFinds(), m.dur);
  checkDoorSoon(m.dur);
}
function matePix(){
  const m = S.mate, b = cellCenter(m.x, m.y); if (m.t >= 1) return b;
  const t = m.t, e = t<.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2;
  return {x:m.from.x + (b.x-m.from.x)*e, y:m.from.y + (b.y-m.from.y)*e};
}
function updateMate(dt){ const m = S.mate; if (m && m.t < 1) m.t = Math.min(1, m.t + dt*1000/m.dur); }
const atDoor = (x, y) => DOOR_CELLS.some(c => c.x === x && c.y === y);
const meAtDoor = () => !S.anim && atDoor(S.px, S.py);
const mateAtDoor = () => !!S.mate && atDoor(S.mate.x, S.mate.y);
let doorTimer = null;
function checkDoorSoon(ms){ clearTimeout(doorTimer); doorTimer = setTimeout(() => { if (active && S) { checkDoor(); updateStatus(); } }, ms + 20); }
function fresh(){
  const duo = opts.mode === 'duo', uses = {};
  // In the maze the bracelet hangs 4 charms: the first 4 boost charms you're wearing
  const slots = hangSlots(Profile.data.boost);
  slots.forEach(id => { if (id) uses[id] = 1; });
  S = {
    duo, live:!!opts.live, remote:{online:true, status:'solving', half:false}, stuckUntil:0, slots, uses, lent:null,
    px:START.x, py:START.y, anim:null, queue:[], facing:'up', foot:[], repDir:null, pendDir:null, repNext:0,
    gemCells:new Set(GEM_CELLS), gemsFound:0, haveHalf:false, friendHalf:false,
    peekUntil:-1, glowUntil:-1, now:0, paused:true, won:false, door:0,
    sent:0, received:0, pending:[], playerHalfAt:null,
    friend:{ state:'solving', stuckAt:CONFIG.friend.getsStuckAt, unstuckAt:0, helped:false, wasStuck:false, sentHelp:false, nextStep:1.2, pace:0.6,
      events:CONFIG.friend.scriptedScrolls.map(e => ({...e})) },
    mate: duo ? mkMate(STARTS[1-ME]) : null, mateKeyWarned:false
  };
  if (duo && !S.live){   // pace the scripted friend so she reaches her key around CONFIG.friend.findsHalfAt
    const len = Math.max(1, bfs(mine, KEYCELLS[1-ME].x, KEYCELLS[1-ME].y)[STARTS[1-ME].y*W + STARTS[1-ME].x]);
    S.friend.pace = Math.min(1.1, Math.max(0.4, (CONFIG.friend.findsHalfAt - CONFIG.friend.stuckFor*0.5) / len));
  }
  const p = cellCenter(S.px, S.py); cam.x = p.x; cam.y = p.y - 60; cam.z = 1; cam.peek = 0; cam.glow = 0;
}

// ---------- input: swipe to slide ----------
// A swipe slides your faerie that way until a wall stops it, or a spot where it could turn (picking up gems and keys on the way).
// You can swipe again before it stops: the next slide starts as soon as this one ends. Arrow keys slide too.
let swipe = null, nextSlide = null;
canvas.addEventListener('pointerdown', e => {
  if (!S || S.paused || S.won || swipe) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  swipe = { id: e.pointerId, x: e.clientX, y: e.clientY, dir: null };
});
canvas.addEventListener('pointermove', e => {
  if (!swipe || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
  if (Math.hypot(dx, dy) < CONFIG.swipeDistance) return;
  const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  swipe.x = e.clientX; swipe.y = e.clientY;
  if (dir === swipe.dir) return;   // one swipe = one slide; keep the finger down and swipe a new way to turn (an L-shape)
  swipe.dir = dir; slide(dir);
});
const endSwipe = e => { if (swipe && e.pointerId === swipe.id) swipe = null; };
canvas.addEventListener('pointerup', endSwipe); canvas.addEventListener('pointercancel', endSwipe);
const KEYS = {ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right'};
addEventListener('keydown', e => { if (!active || sheetOpen) return; const d = KEYS[e.code]; if (!d) return; e.preventDefault(); if (!e.repeat) slide(d); });
function slide(dir){
  if (!S || S.paused || S.won || sheetOpen) return;
  $('#hint').hidden = true;
  if (S.anim || S.queue.length){ nextSlide = dir; return; }   // still sliding: go this way next
  nextSlide = null;
  const d = DIRS[dir]; let x = S.px, y = S.py, n = 0;
  while (canGo(x, y, dir)){
    x += d.dx; y += d.dy; n++;
    if (stopsHere(x, y) || canTurn(x, y, dir)) break;
  }
  S.facing = dir;
  if (!n){ S.bump = { dir, t: S.now }; return; }   // a wall right there: a little bump
  S.queue = Array(n).fill(dir);
}
// A slide also stops where a side path opens, so you can choose which way to go (otherwise some paths can't be reached)
const canTurn = (x, y, dir) => !!(mine[y*W + x] & (dir === 'up' || dir === 'down' ? DIRS.left.bit | DIRS.right.bit : DIRS.up.bit | DIRS.down.bit));
// besides walls, a slide stops on the door once you have your key (so you can open it / meet your friend there)
const stopsHere = (x, y) => S.haveHalf && (S.duo ? atDoor(x, y) : (x === DOOR.x && y === DOOR.y));

// ---------- movement ----------
function canGo(x,y,dir){ return !!(mine[y*W+x] & DIRS[dir].bit); }
function startMove(dir, dur){
  if (!canGo(S.px, S.py, dir)) return false;
  const d = DIRS[dir];
  S.foot.push({...cellCenter(S.px,S.py), dir}); if (S.foot.length > 12) S.foot.shift();
  S.anim = {fx:S.px, fy:S.py, tx:S.px+d.dx, ty:S.py+d.dy, t:0, dur};
  S.facing = dir; S.lastDir = dir;
  if (S.live && S.duo) Net.setMine({x:S.anim.tx, y:S.anim.ty, f:dir});   // your friend sees you move
  return true;
}
function arrive(){
  S.px = S.anim.tx; S.py = S.anim.ty; S.anim = null;
  const id = S.px + ',' + S.py;
  if (S.gemCells.has(id)){ S.gemCells.delete(id); S.gemsFound++; Profile.addGems(1); popGems(); say('+1 gem'); if (S.live) Net.send({type:'gem', id}); }
  if (S.duo && !S.friendHalf && S.px === KEYCELLS[1-ME].x && S.py === KEYCELLS[1-ME].y){
    if (!S.mateKeyWarned){ S.mateKeyWarned = true; say(`That's ${FRIEND}'s key! Leave it for ${THEIR === 'their' ? 'them' : 'her'}`); }
  } else S.mateKeyWarned = false;
  if (!S.haveHalf && S.px === KEY.x && S.py === KEY.y){
    S.haveHalf = true; S.playerHalfAt = S.now; playSound(keySound);
    if (!S.duo) S.friendHalf = true;
    flyKey(cellCenter(KEY.x, KEY.y));
    if (S.live) Net.setMine({half:true, status:'solving'});
    say(!S.duo ? 'You found the key! Find the door' : S.friendHalf ? 'Both keys found! Meet at the door' : 'You found your key! Head to the door');
    updateStatus();
  }
  checkDoor();
}
function checkDoor(){
  if (S.won || !S.haveHalf || !S.friendHalf) return;
  if (!S.duo){ if (S.px === DOOR.x && S.py === DOOR.y) win(); return; }
  if (meAtDoor() && mateAtDoor()) win();   // duo: the door opens when you're BOTH standing at it
  else if (meAtDoor() && !S.waitSaid){ S.waitSaid = true; say(`Waiting for ${FRIEND} at the door…`); }
  if (!meAtDoor()) S.waitSaid = false;
}
function updatePlayer(dt){
  if (S.anim){ S.anim.t += dt*1000/S.anim.dur; if (S.anim.t >= 1) arrive(); return; }
  if (S.queue.length){ startMove(S.queue.shift(), CONFIG.slideMs); return; }
  if (nextSlide){ const d = nextSlide; nextSlide = null; slide(d); }
}
function playerPix(){
  if (!S.anim){
    const c = cellCenter(S.px, S.py), b = S.bump, k = b ? (S.now - b.t) / 0.22 : 1;
    if (k >= 1) return c;
    const o = Math.sin(k * Math.PI) * 8; return {x: c.x + DIRS[b.dir].dx * o, y: c.y + DIRS[b.dir].dy * o};
  }
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
    mine[S.py*W+S.px] |= d.bit; mine[ny*W+nx] |= d.opp; S.uses.snip--; layerDirty = true; say('Snip! The thorns are gone');
    if (S.live && S.duo) Net.send({type:'snip', x:S.px, y:S.py, dir:S.facing});
  }
  renderCharms();
  const fired = $(`#gameArc [data-charm="${id}"]`); if (fired){ fired.classList.remove('spent'); fired.classList.add('fired'); setTimeout(() => { if (active && S) renderCharms(); }, 650); }   // flash first, then grey out if it's used up
}
function renderCharms(){
  renderHang($('#gameArc'), S.slots, true);
  $$('#gameArc [data-charm]').forEach(b => {
    const id = b.dataset.charm, n = S.uses[id] || 0;
    b.classList.toggle('spent', n < 1 || S.lent === id);
    const badge = b.querySelector('.badge'); badge.hidden = n < 2; badge.textContent = n;
  });
}
function giveTempCharm(id){
  S.uses[id] = (S.uses[id] || 0) + 1;
  if (!S.slots.includes(id)){ const i = S.slots.indexOf(null); S.slots[i >= 0 ? i : S.slots.length - 1] = id; }   // full? it borrows the last spot for this level
  renderCharms();
}

// ---------- HUD ----------
function popGems(){ const g = $('#gameGems'); g.classList.remove('pop'); void g.offsetWidth; g.classList.add('pop'); }
function renderKey(pop, hold){
  const mine = $('#keyMine'), mate = $('#keyMate'), meWho = S.duo ? ME : 0;
  const have = S.haveHalf && hold !== 'mine';
  mine.src = have ? KEY_SRC(meWho) : 'art/key-grey.webp'; mine.classList.toggle('got', have);
  mate.hidden = !S.duo; $('#keyBtn').classList.toggle('two', S.duo);
  if (S.duo){ mate.src = S.friendHalf ? KEY_SRC(1 - ME) : 'art/key-grey.webp'; mate.classList.toggle('got', !!S.friendHalf); }
  const k = $('#keyBtn');
  k.setAttribute('aria-label', !S.duo ? (S.haveHalf ? 'You have the key' : 'Key not found yet')
    : S.haveHalf && S.friendHalf ? 'Both keys found. Meet at the door' : S.haveHalf ? 'You have your key. Waiting on ' + FRIEND : S.friendHalf ? FRIEND + ' has ' + THEIR + ' key. Find yours' : 'Keys: none found yet');
  if (pop){ k.classList.remove('pop'); void k.offsetWidth; k.classList.add('pop'); }
}
// the key you just picked up flies from the maze into its spot in the top right, then pops in with a sparkle
function flyKey(cell){
  const dest = $('#keyMine'), r = dest.getBoundingClientRect(), host = $('#scr-game'), hr = host.getBoundingClientRect();
  if (!VIEW || !r.width || !dest.animate){ renderKey(true); return; }
  renderKey(false, 'mine');
  const sx = VIEW.cx + (cell.x - VIEW.x) * VIEW.z, sy = VIEW.cy + (cell.y - VIEW.y) * VIEW.z;
  const ex = r.left - hr.left + r.width/2, ey = r.top - hr.top + r.height/2;
  const fly = document.createElement('img'); fly.className = 'key-fly'; fly.src = KEY_SRC(S.duo ? ME : 0); fly.alt = '';
  host.appendChild(fly);
  const mx = sx + (ex - sx) * 0.35, my = Math.min(sy, ey) - 30;
  const a = fly.animate([
    { transform: `translate(${sx}px,${sy}px) translate(-50%,-50%) scale(1) rotate(0deg)`, opacity: 1 },
    { transform: `translate(${sx}px,${sy - 34}px) translate(-50%,-50%) scale(1.9) rotate(-12deg)`, opacity: 1, offset: .28 },
    { transform: `translate(${mx}px,${my}px) translate(-50%,-50%) scale(1.5) rotate(8deg)`, opacity: 1, offset: .62 },
    { transform: `translate(${ex}px,${ey}px) translate(-50%,-50%) scale(.62) rotate(0deg)`, opacity: 1 }
  ], { duration: 1100, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'forwards' });
  a.onfinish = () => { fly.remove(); renderKey(true); sparkAt(ex, ey); };
}
function sparkAt(x, y){
  const host = $('#scr-game'), box = document.createElement('div'); box.className = 'key-sparks';
  box.style.left = x + 'px'; box.style.top = y + 'px';
  for (let i = 0; i < 10; i++){ const e = document.createElement('i'), ang = i / 10 * Math.PI * 2;
    e.style.setProperty('--dx', Math.cos(ang) * 34 + 'px'); e.style.setProperty('--dy', Math.sin(ang) * 34 + 'px'); box.appendChild(e); }
  host.appendChild(box); setTimeout(() => box.remove(), 900);
}
function updateStatus(){
  if (!S.duo) return;
  const f = S.live ? {state: S.remote.status} : S.friend, t = $('#statusText');
  let html, warn = false;
  if (S.won) html = 'The door is open!';
  else if (S.live && !S.remote.online){ html = `<b>${esc(FRIEND)}</b> lost connection…`; warn = true; }
  else if (S.haveHalf && S.friendHalf) html = meAtDoor() ? `Waiting for <b>${esc(FRIEND)}</b> at the door…` : mateAtDoor() ? `<b>${esc(FRIEND)}</b> is at the door! Go ↑` : 'Both keys found! Meet at the door ↑';
  else if (f.state === 'stuck'){ html = `<b>${esc(FRIEND)}</b> seems stuck…`; warn = true; }
  else if (S.friendHalf) html = `<b>${esc(FRIEND)}</b> found ${THEIR} key!`;
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
  const gifts = [];
  if (s.gift === 'peek'){ giveTempCharm('peek'); gifts.push('+1 Peek for you'); }
  if (s.gems > 0){ Profile.addGems(s.gems); renderGemPills(); popGems(); gifts.push(`+${s.gems} gem${s.gems > 1 ? 's' : ''}`); }
  if (s.lend && CONFIG.charms[s.lend]){ giveTempCharm(s.lend); gifts.push(`${CONFIG.charms[s.lend].name} lent to you`); }
  t.innerHTML = `<div class="avatar">${esc(FRIEND[0])}</div><div style="min-width:0"><div class="from">${esc(FRIEND.toUpperCase())} SENT A SCROLL</div>${s.msg ? `<div class="msg">${esc(s.msg)}</div>` : ''}${gifts.map(g => `<span class="gift">${esc(g)}</span>`).join(' ')}</div>${s.emoji ? `<div class="emo">${esc(s.emoji)}</div>` : ''}`;
  t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(nextToast, 350); }, 4200);
}
$('#toast').addEventListener('click', () => { clearTimeout(toastTimer); $('#toast').classList.remove('show'); setTimeout(nextToast, 300); });

// ---------- the scripted friend (see CONFIG.friend) ----------
function friendFinds(){
  const f = S.friend; if (S.friendHalf) return;
  S.friendHalf = true; f.state = 'found'; renderKey(true);
  receive({msg:'Got my key!!', emoji:'🎉'});
  if (S.haveHalf) say('Both keys found! Meet at the door');
  updateStatus(); checkDoor();
}
function friendStep(){   // one step along the shortest path to her key, then to the door
  const m = S.mate, goal = !S.friendHalf ? KEYCELLS[1-ME] : DOOR_CELLS[1-ME] || DOOR_CELLS[0];
  if (m.x === goal.x && m.y === goal.y) return;
  const d = bfs(mine, goal.x, goal.y), here = d[m.y*W + m.x];
  for (const k of DLIST){ const q = DIRS[k]; if (!(mine[m.y*W+m.x] & q.bit)) continue;
    const nx = m.x + q.dx, ny = m.y + q.dy; if (d[ny*W+nx] === here - 1){ mateTo(nx, ny, k); return; } }
}
function updateFriend(){
  const f = S.friend;
  for (const ev of f.events) if (!ev.done && S.now >= ev.at && !S.won){ ev.done = true; receive({msg:ev.msg, emoji:ev.emoji}); }
  for (let i = S.pending.length-1; i >= 0; i--) if (S.now >= S.pending[i].at){ receive(S.pending[i].scroll); S.pending.splice(i,1); }
  if (!S.friendHalf && f.state === 'solving' && !f.helped && !f.wasStuck && S.now >= f.stuckAt){
    f.state = 'stuck'; f.wasStuck = true; f.unstuckAt = S.now + CONFIG.friend.stuckFor; receive({msg:"I'm stuck!", emoji:'😵'});
  }
  const late = S.haveHalf && S.now >= S.playerHalfAt + CONFIG.friend.findsHalfAfterYou;   // don't keep you waiting too long
  if (f.state === 'stuck' && (S.now >= f.unstuckAt || late)) f.state = 'solving';
  if (S.won || f.state === 'stuck' || S.mate.t < 1 || S.now < f.nextStep) return;
  let every = f.helped ? 0.38 : f.pace;
  if (S.friendHalf) every = S.haveHalf && meAtDoor() ? 0.28 : 0.45;
  else if (S.haveHalf){   // you have your key: she catches up within CONFIG.friend.findsHalfAfterYou
    const left = bfs(mine, KEYCELLS[1-ME].x, KEYCELLS[1-ME].y)[S.mate.y*W + S.mate.x];
    const time = Math.max(1, S.playerHalfAt + CONFIG.friend.findsHalfAfterYou - S.now);
    every = Math.min(every, Math.max(0.25, time / Math.max(1, left)));
  }
  friendStep(); f.nextStep = S.now + every;
}
function friendReact(sel){
  const f = S.friend; let delay = 2.4;
  const push = scroll => { S.pending.push({at:S.now + delay, scroll}); delay += 2.6; };
  if ((sel.peek || sel.lend) && !S.friendHalf){ f.helped = true; if (f.state === 'stuck') f.state = 'solving'; }
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
let sheetOpen = false;
const msgWrap = $('#msgChips');
MESSAGES.forEach(m => { const b = document.createElement('button'); b.className = 'msg-btn'; b.textContent = m; b.onclick = () => sendScroll(m); msgWrap.appendChild(b); });
function openSheet(){
  if (!S || S.paused || S.won) return;
  sheetOpen = true; swipe = null; nextSlide = null;
  $('#scrim').classList.add('show'); $('#sheet').classList.add('show'); $('#sheet').setAttribute('aria-hidden','false');
}
function closeSheet(){ sheetOpen = false; $('#scrim').classList.remove('show'); $('#sheet').classList.remove('show'); $('#sheet').setAttribute('aria-hidden','true'); }
$('#scrollBtn').onclick = openSheet; $('#closeSheet').onclick = closeSheet; $('#scrim').onclick = closeSheet;
function sendScroll(msg){
  const sel = {msg, emoji:null, peek:false, gems:0, lend:null};
  S.sent++; closeSheet(); say('Scroll sent to ' + FRIEND + '!');
  if (S.live){
    Net.send({type:'scroll', msg, emoji:null, gift:null, gems:0, lend:null});
    if (msg === "I'm stuck!" && !S.haveHalf){ S.stuckUntil = S.now + 30; Net.setMine({status:'stuck'}); }
  } else friendReact(sel);
}

// ---------- overlays ----------
function setPaused(p){ S.paused = p; if (p){ swipe = null; nextSlide = null; } }
$('#startBtn').onclick = () => { $('#intro').hidden = true; setPaused(false); say(S.duo ? 'Find your key' : 'Find the key'); };
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
  if (S.live && a !== 'finish') return;   // live play: only finish/restart (the friend is a real kid)
  if (a === 'cheer') receive({msg:['You got this!','Almost there!','Go go go!'][Math.floor(Math.random()*3)], emoji:'💪'});
  if (a === 'stuck' && !S.friendHalf){ S.friend.state = 'stuck'; S.friend.unstuckAt = S.now + 25; S.friend.helped = false; receive({msg:"I'm stuck!", emoji:'😵'}); updateStatus(); }
  if (a === 'half'){ const k = KEYCELLS[1-ME]; mateTo(k.x, k.y); friendFinds(); }
  if (a === 'finish'){ S.haveHalf = true; S.friendHalf = true; renderKey(true); win(); }
});
function win(fromFriend){
  if (S.won) return;
  S.won = true;   // set first: telling the other phone can echo straight back here
  if (S.live && !fromFriend) Net.send({type:'win'}); S.haveHalf = S.friendHalf = true; renderKey(false); updateStatus(); say('The door opens!');
  setTimeout(() => {
    setPaused(true);
    const result = { level: opts.level, mode: opts.mode, time: S.now, sent: S.sent, received: S.received, gemsFound: S.gemsFound };
    stop(); opts.onWin && opts.onWin(result);
  }, 1300);
}
function restart(){ start(opts); $('#intro').hidden = true; setPaused(false); say(S.duo ? 'Find your key' : 'Find the key'); }

// ---------- render ----------
let vw = 0, vh = 0, dpr = 1;
function resize(){ const r = screen.getBoundingClientRect(); if (!r.width) return; vw = r.width; vh = r.height; dpr = Math.min(devicePixelRatio || 1, 2); canvas.width = Math.round(vw*dpr); canvas.height = Math.round(vh*dpr); canvas.style.width = vw + 'px'; canvas.style.height = vh + 'px'; }
addEventListener('resize', () => { if (active) resize(); });
function playTop(){ const el = S.duo ? $('#status') : $('#gameTop'); const r = el.getBoundingClientRect(), a = screen.getBoundingClientRect(); return r.bottom - a.top; }

// ---------- art (textures from CONFIG.mazeArt; falls back to flat colors if a file is missing) ----------
const ART = {}, PATTERN = {};
function loadArt(key, src){ if (!src) return; const im = new Image(); im.onload = () => { ART[key] = im; delete PATTERN[key]; layerDirty = true; }; im.src = src; }
loadArt('ground', CONFIG.mazeArt.ground); loadArt('walls', CONFIG.mazeArt.walls); loadArt('gem', 'art/gem.webp');
(CONFIG.mazeArt.playerSprites || []).forEach((src, i) => loadArt('faerie' + i, src));
['gold', 'pink', 'purple'].forEach(k => loadArt('key-' + k, 'art/key-' + k + '.webp'));
function pattern(key){
  const im = ART[key]; if (!im) return null;
  if (!PATTERN[key]){ const p = ctx.createPattern(im, 'repeat'), s = CONFIG.mazeArt.tileSize / im.width; if (p.setTransform) p.setTransform(new DOMMatrix([s,0,0,s,0,0])); PATTERN[key] = p; }
  return PATTERN[key];
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`; };

// Pixel stone bricks along both edges of every wall (sizes/colors in CONFIG.mazeArt)
function stoneBands(segs){
  const A = CONFIG.mazeArt, sw = A.stoneWidth, half = WALL/2 + 2, L = A.brickLength, cols = A.stoneColors;
  for (const s of segs){
    const horiz = s[1] === s[3], c = horiz ? s[1] : s[0];
    const a0 = (horiz ? s[0] : s[1]) - half - sw, a1 = (horiz ? s[2] : s[3]) + half + sw;
    for (const side of [-1, 1]){
      const b0 = side < 0 ? c - half - sw : c + half;
      const start = a0 - Math.floor(hsh(s[4], s[5], s[6] + side + 9) * L);
      for (let p = start; p < a1; p += L){
        const p0 = Math.max(p, a0), p1 = Math.min(p + L - 2, a1); if (p1 - p0 < 3) continue;
        const face = cols[Math.floor(hsh(Math.round(p), Math.round(c), side + 7) * cols.length)];
        const box = (q0, q1, r0, r1, col) => { ctx.fillStyle = col; horiz ? ctx.fillRect(q0, r0, q1 - q0, r1 - r0) : ctx.fillRect(r0, q0, r1 - r0, q1 - q0); };
        box(p0, p1, b0 + 1, b0 + sw - 1, face);                 // brick face
        box(p0, p1 - 2, b0 + 1, b0 + 3, A.stoneLight);          // highlight along the top / left
        box(p0, p1, b0 + sw - 3, b0 + sw - 1, A.stoneDark);     // shadow along the bottom / right
        box(p1 - 2, p1, b0 + 1, b0 + sw - 1, A.stoneDark);      // shadow at the brick's end
      }
    }
  }
}
function drawMazeWalls(open, ox, color, isFriend){
  const tex = pattern('walls'), A = CONFIG.mazeArt;
  ctx.lineCap = 'round';
  const segs = [];
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){
    const o = open[y*W+x], X = ox + x*C, Y = y*C;
    if (!(o & 1)) segs.push([X,Y,X+C,Y,x,y,1]);
    if (!(o & 8) && !(isFriend && x === 0)) segs.push([X,Y,X,Y+C,x,y,8]);
    if (y === H-1 && !(o & 4)) segs.push([X,Y+C,X+C,Y+C,x,y,4]);
    if (x === W-1 && !(o & 2) && (isFriend || DUO)) segs.push([X+C,Y,X+C,Y+C,x,y,2]);
  }
  const trace = () => { ctx.beginPath(); for (const s of segs){ ctx.moveTo(s[0],s[1]); ctx.lineTo(s[2],s[3]); } };
  if (tex){
    const sw = A.stoneWidth;
    ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
    trace(); ctx.strokeStyle = A.wallEdge; ctx.lineWidth = WALL + 2*(sw + 2) + 4; ctx.stroke(); // dark outline + mortar
    stoneBands(segs);                                                                         // pixel stone bricks
    trace(); ctx.strokeStyle = A.wallEdge; ctx.lineWidth = WALL + 4; ctx.stroke();            // mortar line next to the vines
    trace(); ctx.strokeStyle = tex; ctx.lineWidth = WALL; ctx.stroke();                       // the vine texture
    return;
  }
  trace(); ctx.strokeStyle = color; ctx.lineWidth = WALL; ctx.stroke();
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
  const x = DOOR_PX, y = 0, open = S.door, whole = S.haveHalf && S.friendHalf;
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
  const x = W*C, A = CONFIG.mazeArt; ctx.lineCap = 'round';
  ctx.strokeStyle = A.wallEdge; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, H*C + 16); ctx.stroke();
  ctx.strokeStyle = A.thorn; ctx.lineWidth = 3; ctx.beginPath();
  for (let y = 24; y < H*C; y += 40){ ctx.moveTo(x, y); ctx.lineTo(x-15, y-9); ctx.moveTo(x, y); ctx.lineTo(x+15, y-9); }
  ctx.stroke();
}
function drawFoot(foot, color){
  foot = foot || S.foot; const n = foot.length;
  foot.forEach((f, i) => {
    const a = 0.06 + 0.8*(i+1)/n, d = DIRS[f.dir], px = -d.dy, py = d.dx, ang = Math.atan2(d.dy, d.dx) + Math.PI/2;
    ctx.fillStyle = rgba(color || CONFIG.mazeArt.footprints, a);
    for (const s of [1,-1]){ ctx.beginPath(); ctx.ellipse(f.x + px*5*s - d.dx*5*s, f.y + py*5*s - d.dy*5*s, 4, 6, ang, 0, Math.PI*2); ctx.fill(); }
  });
}
function drawGems(){
  const bob = Math.sin(S.now*3)*2.5, im = ART.gem;
  for (const id of S.gemCells){
    const [gx, gy] = id.split(',').map(Number), c = cellCenter(gx, gy);
    if (im){ ctx.drawImage(im, c.x - 14, c.y - 14 + bob, 28, 28); continue; }
    ctx.beginPath(); ctx.moveTo(c.x, c.y-11+bob); ctx.lineTo(c.x+10, c.y-2+bob); ctx.lineTo(c.x, c.y+12+bob); ctx.lineTo(c.x-10, c.y-2+bob); ctx.closePath();
    ctx.fillStyle = '#cfe6f7'; ctx.fill(); ctx.strokeStyle = '#3d7fb5'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke();
  }
}
const KEY_ART = who => S.duo ? (who === 0 ? 'key-pink' : 'key-purple') : 'key-gold';
const KEY_SRC = who => 'art/' + KEY_ART(who) + '.webp';
function drawKeyArt(c, who, glow){
  const im = ART[KEY_ART(who)]; if (!im) return false;
  const bob = Math.sin(S.now*2.4 + who*2)*3, h = 50, w = h * im.width / im.height;
  ctx.fillStyle = rgba(glow, .38); ctx.beginPath(); ctx.arc(c.x, c.y + bob, 25 + Math.sin(S.now*4 + who)*2, 0, Math.PI*2); ctx.fill();
  ctx.save(); ctx.translate(c.x, c.y + bob); ctx.rotate(Math.sin(S.now*1.6 + who)*0.12);
  ctx.shadowColor = rgba(glow, .9); ctx.shadowBlur = 14;
  ctx.drawImage(im, -w/2, -h/2, w, h); ctx.restore();
  return true;
}
function drawDuoKey(k, i){
  if (drawKeyArt(cellCenter(k.x, k.y), i, PCOLOR(i))) return;
  const c = cellCenter(k.x, k.y), bob = Math.sin(S.now*2.4 + i*2)*3, col = PCOLOR(i);
  ctx.fillStyle = rgba(col, .45); ctx.beginPath(); ctx.arc(c.x, c.y+bob, 24 + Math.sin(S.now*4 + i)*2, 0, Math.PI*2); ctx.fill();
  ctx.save(); ctx.translate(c.x, c.y + bob); ctx.rotate(-Math.PI/4);
  ctx.fillStyle = col; ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.6; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.arc(-8, 0, 9, 0, Math.PI*2); ctx.fill(); ctx.stroke();                          // bow
  ctx.beginPath(); ctx.rect(0, -3.5, 17, 7); ctx.fill(); ctx.stroke();                                  // shaft
  ctx.beginPath(); ctx.rect(10, 3.5, 4, 6); ctx.rect(15, 3.5, 3, 4); ctx.fill(); ctx.stroke();          // teeth
  ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(-8, 0, 3, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}
// sounds (phones only allow sound after a tap, and every game starts with one, so this just works)
const keySound = new Audio('sound/key-found.mp3'); keySound.preload = 'auto';
function playSound(a){ try { a.currentTime = 0; const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
function drawKey(){
  if (S.duo){
    if (!S.haveHalf) drawDuoKey(KEYCELLS[ME], ME);
    if (!S.friendHalf) drawDuoKey(KEYCELLS[1-ME], 1-ME);
    return;
  }
  if (S.haveHalf) return;
  if (drawKeyArt(cellCenter(KEY.x, KEY.y), 0, '#ffd45a')) return;
  const c = cellCenter(KEY.x, KEY.y), bob = Math.sin(S.now*2.4)*3;
  ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(c.x, c.y+bob, 22 + Math.sin(S.now*4)*2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath();
  if (S.duo){ ctx.moveTo(c.x+1, c.y-14+bob); ctx.arc(c.x+1, c.y+bob, 14, -Math.PI/2, Math.PI/2, true); ctx.closePath(); }
  else ctx.arc(c.x, c.y+bob, 14, 0, Math.PI*2);
  ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 2.8; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.fillStyle = '#1a1a1a'; star(c.x+16, c.y-14+bob, 5);
}
// Each player is their faerie, seen from above (player 1 = pink, player 2 = purple). She leans into sideways moves,
// flutters her wings, and sits on a soft glow in her color so you never lose her in the fog.
const TILT = {};
function drawPlayer(p, facing, ring, who, moving){
  p = p || playerPix(); facing = facing || S.facing;
  who = who === undefined ? (S.duo ? ME : 0) : who; moving = moving === undefined ? !!S.anim : moving;
  ring = ring || PCOLOR(who);
  const im = ART['faerie' + who];
  ctx.fillStyle = rgba(ring, .28); ctx.beginPath(); ctx.ellipse(p.x, p.y + 6, 30, 22, 0, 0, Math.PI*2); ctx.fill();
  if (!im){   // art still loading: the old round faerie
    const d = DIRS[facing];
    ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(p.x, p.y, 21, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    const off = d.dy !== 0 ? [[-6,0],[6,0]] : [[0,-5],[0,5]];
    for (const o of off){ ctx.beginPath(); ctx.arc(p.x + o[0] + d.dx*3, p.y + o[1] + d.dy*3 - (d.dy===0?2:0), 3, 0, Math.PI*2); ctx.fill(); }
    return;
  }
  const want = moving ? DIRS[facing].dx * 0.26 : 0;
  TILT[who] = (TILT[who] || 0) + (want - (TILT[who] || 0)) * 0.2;
  const w = 76, h = w * im.height / im.width, bob = Math.sin(S.now * 4 + who * 2) * 2.5;
  const flap = 1 - 0.06 * (0.5 + 0.5 * Math.sin(S.now * (moving ? 26 : 12) + who));
  ctx.save(); ctx.translate(p.x, p.y + bob); ctx.rotate(TILT[who]); ctx.scale(flap, 1);
  ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5;
  ctx.drawImage(im, -w/2, -h/2 - 4, w, h);
  ctx.restore();
}
// The floor and walls don't move, so they're drawn once into a small layer at chunky pixel size
// (CONFIG.mazeArt.pixelScale) and redrawn only when the level, art, or a snipped wall changes.
let LAYER = null, layerDirty = true;
const LAYER_PAD = 60;
function buildLayer(){
  const A = CONFIG.mazeArt, ps = A.pixelScale, pad = LAYER_PAD;
  LAYER = LAYER || document.createElement('canvas');
  LAYER.width = Math.ceil((2*W*C + pad*2) / ps); LAYER.height = Math.ceil((H*C + pad*2) / ps);
  const main = ctx; ctx = LAYER.getContext('2d');
  ctx.setTransform(1/ps, 0, 0, 1/ps, pad/ps, pad/ps); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = pattern('ground') || A.groundColor; ctx.fillRect(0, 0, (DUO ? 1 : 2)*W*C, H*C);
  if (!DUO && S.duo) drawMazeWalls(theirs, W*C, '#b4b4b4', true);
  drawMazeWalls(mine, 0, '#9a9a9a', false);
  ctx = main; layerDirty = false;
}
let VIEW = null;
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
  const A = CONFIG.mazeArt, hedge = pattern('walls');
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.fillStyle = A.fog; ctx.fillRect(0,0,vw,vh);
  ctx.setTransform(dpr*z, 0, 0, dpr*z, dpr*(cx - cam.x*z), dpr*(cy - cam.y*z));
  // everything outside the maze is solid hedge, so the paths look carved out of it
  ctx.fillStyle = hedge || A.wallEdge; ctx.fillRect(-1500, -1500, W*C*2 + 3000, H*C + 3000);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-1500, -1500, W*C*2 + 3000, H*C + 3000);
  if (layerDirty) buildLayer();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(LAYER, -LAYER_PAD, -LAYER_PAD, LAYER.width * A.pixelScale, LAYER.height * A.pixelScale);
  ctx.imageSmoothingEnabled = true;
  const mp = S.duo ? matePix() : null;
  if (!S.duo){ ctx.fillStyle = A.friendTint; ctx.fillRect(W*C, 0, W*C, H*C); }   // solo: the right side is dimmed, you can't go there
  if (mp) drawFoot(S.mate.foot, PCOLOR(1-ME));
  drawFoot(); drawGems(); drawKey();
  if (!S.duo) drawThornWall();
  drawDoor();
  if (mp) drawPlayer(mp, S.mate.facing, PCOLOR(1-ME), 1-ME, S.mate.t < 1);
  drawPlayer();
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const toScreen = q => ({x: cx + (q.x - cam.x)*z, y: cy + (q.y - cam.y)*z});
  VIEW = {cx, cy, z, x: cam.x, y: cam.y};
  const me = toScreen(p), fogA = 0.96 * (1 - cam.peek), grow = 1 + (CONFIG.glowBoost - 1) * cam.glow;
  const lights = [{x:me.x, y:me.y, r0:CONFIG.fogClear*grow, r1:CONFIG.fogEdge*grow}];
  const ms = mp ? toScreen(mp) : null;
  if (ms) lights.push({x:ms.x, y:ms.y, r0:CONFIG.fogClear*0.45*z, r1:CONFIG.fogEdge*0.55*z});   // your friend carries a small light
  if (fogA > 0.01) drawFog(lights, fogA);
  if (ms) drawMateMarker(ms, top);
}
// Fog with a hole for each light (you, and your friend in duo)
let FOG = null;
function drawFog(lights, alpha){
  FOG = FOG || document.createElement('canvas');
  if (FOG.width !== canvas.width || FOG.height !== canvas.height){ FOG.width = canvas.width; FOG.height = canvas.height; }
  const f = FOG.getContext('2d');
  f.setTransform(1,0,0,1,0,0); f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, FOG.width, FOG.height);
  f.fillStyle = rgba(CONFIG.mazeArt.fog, alpha); f.fillRect(0, 0, FOG.width, FOG.height);
  f.setTransform(dpr,0,0,dpr,0,0); f.globalCompositeOperation = 'destination-out';
  for (const l of lights){
    const g = f.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r1);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(l.r0 / l.r1, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    f.fillStyle = g; f.fillRect(l.x - l.r1, l.y - l.r1, l.r1*2, l.r1*2);
  }
  ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(FOG, 0, 0); ctx.setTransform(dpr,0,0,dpr,0,0);
}
// Your friend's name over their faerie, or an arrow at the screen edge pointing to them
function drawMateMarker(m, top){
  const col = PCOLOR(1-ME), pad = 26, x0 = pad, x1 = vw - pad, y0 = top + pad, y1 = vh - 170;   // stay above the joystick
  const inside = m.x > x0 && m.x < x1 && m.y > y0 && m.y < y1;
  ctx.font = '600 12px "DM Sans", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (inside){
    const w = ctx.measureText(FRIEND).width + 14, y = m.y - 40*cam.z - 4;
    ctx.fillStyle = 'rgba(20,16,30,.78)'; ctx.beginPath(); ctx.roundRect(m.x - w/2, y - 10, w, 20, 10); ctx.fill();
    ctx.fillStyle = col; ctx.fillText(FRIEND, m.x, y + 0.5); return;
  }
  const cxs = (x0 + x1)/2, cys = (y0 + y1)/2, dx = m.x - cxs, dy = m.y - cys;
  const s = Math.min(Math.abs((x1 - cxs) / (dx || 1e-6)), Math.abs((y1 - cys) / (dy || 1e-6)));
  const ex = cxs + dx*s, ey = cys + dy*s, ang = Math.atan2(dy, dx);
  ctx.save(); ctx.translate(ex, ey);
  ctx.fillStyle = 'rgba(20,16,30,.85)'; ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.rotate(ang); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(25, 0); ctx.lineTo(17, -6); ctx.lineTo(17, 6); ctx.closePath(); ctx.fill();
  ctx.rotate(-ang); ctx.fillStyle = col; ctx.font = '700 14px "DM Sans", system-ui, sans-serif'; ctx.fillText(FRIEND[0].toUpperCase(), 0, 1);
  ctx.restore();
}

// ---------- loop + public API ----------
let last = performance.now();
function loop(t){
  const dt = Math.min(0.05, (t - last)/1000); last = t;
  if (active && S){
    if (!S.paused){ S.now += dt; updatePlayer(dt); if (S.duo && !S.live) updateFriend(); if (S.live) liveTick(); updateStatus(); }
    if (S.duo) updateMate(dt);
    render(dt);
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------- live play (two phones, see js/net.js) ----------
function liveTick(){ if (S.stuckUntil && (S.now > S.stuckUntil || S.haveHalf)){ S.stuckUntil = 0; Net.setMine({status:'solving'}); } }
function netPlayers(friend){
  if (!active || !S || !S.live || !friend) return;
  S.remote = {online: friend.online !== false, status: friend.status || 'solving', half: !!friend.half};
  if (S.duo && typeof friend.x === 'number' && typeof friend.y === 'number') mateTo(friend.x, friend.y, friend.f);
  if (S.remote.half && !S.friendHalf){
    S.friendHalf = true; renderKey(true);
    say(S.haveHalf ? 'Both keys found! Meet at the door' : `${FRIEND} found ${THEIR} key!`);
  }
  checkDoor();
  updateStatus();
}
function netEvent(ev){
  if (!active || !S || !S.live) return;
  if (ev.type === 'scroll') receive({msg:ev.msg, emoji:ev.emoji, gift:ev.gift, gems:ev.gems, lend:ev.lend});
  if (ev.type === 'win') win(true);
  if (ev.type === 'gem') S.gemCells.delete(ev.id);   // your friend grabbed it first
  if (ev.type === 'snip' && DIRS[ev.dir]){ const d = DIRS[ev.dir], nx = ev.x + d.dx, ny = ev.y + d.dy;
    if (nx >= 0 && ny >= 0 && nx < W && ny < H){ mine[ev.y*W+ev.x] |= d.bit; mine[ny*W+nx] |= d.opp; layerDirty = true; } }
}

function start(o){
  opts = o; const lv = CONFIG.levels[o.level];
  FRIEND = o.friendName || CONFIG.friendName; THEIR = o.live ? 'their' : 'her'; $$('.friend-name').forEach(e => e.textContent = FRIEND);
  ME = o.live && Net.role === 'guest' ? 1 : 0;
  buildLevel(lv, o.mode === 'duo'); fresh(); layerDirty = true;
  if (S.live) Net.setMine({half:false, status:'solving', won:false, x:START.x, y:START.y, f:'up'});
  ['cheer','stuck','half'].forEach(k => { $(`#facOv [data-fac="${k}"]`).hidden = !!o.live; });
  inbox.length = 0; toastBusy = false; $('#toast').classList.remove('show'); closeSheet();
  screen.classList.toggle('solo', !S.duo);
  $('#introTitle').textContent = `Level ${o.level + 1} · ${lv.name}`;
  $('#introText').innerHTML = S.duo
    ? `You and ${esc(FRIEND)} are in the <b>same maze</b>. Find <b>your ${PCOLOR_NAME(ME)} key</b>, then meet at the door. It only opens when you're <b>both</b> there.`
    : 'Find <b>the key</b> hidden in the maze, then make your way to the door.';
  $('#introScrollTip').hidden = !S.duo;
  $('#intro').hidden = false; $('#pauseOv').hidden = true; $('#facOv').hidden = true; $('#hint').hidden = false;
  active = true; resize(); renderKey(false); renderCharms(); updateStatus(); renderGemPills();
}
function stop(){ active = false; closeSheet(); swipe = null; nextSlide = null; }
window.Game = { start, stop, netPlayers, netEvent, get active(){ return active; } };
})();
