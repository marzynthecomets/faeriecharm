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
const icon = (id, size) => `<svg width="${size}" height="${size}" viewBox="0 0 34 34" aria-hidden="true">${ICON[id] || ''}</svg>`;
const GEM = s => `<svg width="${s}" height="${s}" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 14 6 8 14.5 2 6Z" fill="#cfe6f7" stroke="#3d7fb5" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

// ---------- the hanging bracelet (5 boost slots) ----------
const ARC_HOOPS = [[39.4,13.5],[77.2,24.4],[115,28],[152.8,24.4],[190.6,13.5]];
const ARC_CHARMS = [[39.4,33],[77.2,43.4],[115,47],[152.8,43.4],[190.6,32.5]];
function braceletArcSvg(slots){
  let s = '<svg class="arc-art" width="230" height="70" viewBox="0 0 230 70" aria-hidden="true"><path d="M10 0Q115 56 220 0" fill="none" stroke="#1a1a1a" stroke-width="2.5"/>';
  ARC_HOOPS.forEach(([x,y]) => s += `<circle cx="${x}" cy="${y}" r="5" fill="#fff" stroke="#1a1a1a" stroke-width="2"/>`);
  ARC_CHARMS.forEach(([x,y], i) => {
    s += slots[i] ? `<circle cx="${x}" cy="${y}" r="16" fill="#fff" stroke="#1a1a1a" stroke-width="3"/>`
                  : `<circle cx="${x}" cy="${y}" r="15" fill="#fff" stroke="#8a8a8a" stroke-width="2" stroke-dasharray="4 3"/>`;
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
      ? `<button class="charm" data-charm="${id}" style="left:${x-22}px;top:${y-22}px" aria-label="Use ${esc(CONFIG.charms[id].name)}">${icon(id, 21)}<span class="badge" hidden></span></button>`
      : `<span class="charm" style="left:${x-22}px;top:${y-22}px">${icon(id, 21)}</span>`;
  });
  el.innerHTML = html;
}

// ---------- little helpers ----------
let toastT;
function say(text){ const c = $('#callout'); c.textContent = text; c.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => c.classList.remove('show'), 2200); }
