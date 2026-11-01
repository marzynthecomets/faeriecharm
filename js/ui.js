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
  reset(){ this.data = newProfile(); this.save(); },
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

// ---------- little helpers ----------
let toastT;
function say(text){ const c = $('#callout'); c.textContent = text; c.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => c.classList.remove('show'), 2200); }
